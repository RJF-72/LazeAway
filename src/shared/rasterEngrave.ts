// Raster image engraving: grayscale pixels -> GRBL G-code.
//
// The machine runs GRBL 1.1h in laser mode ($32=1), so M4 (dynamic power,
// ramps PWM with motion speed) with a varying S value per segment produces
// true grayscale burns. The image is burned in scanlines: one G1 per run of
// equal quantized power, bidirectional (zigzag) to avoid dead-head travel.
//
// Tone curve: darkness 0..100 maps to a gamma applied to the ink amount
// (ink = 1 - luminance, or luminance when inverted). gamma > 1 keeps only
// dark pixels burning (light engraving); gamma < 1 lifts midtones (dark).
//   darkness 0   -> gamma 4.00 (lightest)
//   darkness 50  -> gamma 1.00 (linear)
//   darkness 100 -> gamma 0.25 (darkest)

export interface RasterGcodeOptions {
  /** Physical burn width in mm; height follows the pixel aspect ratio. */
  widthMm: number
  /** Dots per inch — sets the scanline interval (25.4 / dpi mm). */
  dpi: number
  /** Feed rate, mm/min. */
  speed: number
  /** Peak laser power 0-100 (S = power/100 * 1000). */
  powerPercent: number
  /** Burn passes (rarely more than 1 for photos). */
  passes: number
  /** Z drop per pass for multi-pass cutting through material. */
  zStep?: number
  /** Z height for travels between passes (default 0). */
  travelHeight?: number
  /** Tone: 0 lightest .. 100 darkest (default 50 = linear). */
  darkness?: number
  /** Swap ink direction (burn the light areas instead). */
  invert?: boolean
  /** Emit G92 X0 Y0 after homing the work origin (default true). */
  originAtStart?: boolean
}

export interface RasterResult {
  lines: string[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number }
  /** Effective physical height in mm. */
  heightMm: number
  /** Number of scanlines actually emitted. */
  scanlines: number
  /** Segments (G1 burn moves) emitted across all passes. */
  segments: number
}

/** Tone gamma for a darkness setting (see module header). */
export function darknessGamma(darkness: number): number {
  const d = Math.max(0, Math.min(100, darkness))
  return Math.pow(2, (50 - d) / 25)
}

/** Map one grayscale pixel (0 black .. 255 white) to an S value 0..1000. */
export function pixelToS(
  gray: number,
  darkness: number,
  invert: boolean,
  powerPercent: number,
): number {
  const g = Math.max(0, Math.min(255, gray))
  const ink = invert ? g / 255 : 1 - g / 255
  const toned = Math.pow(ink, darknessGamma(darkness))
  const peak = Math.round((Math.max(0, Math.min(100, powerPercent)) / 100) * 1000)
  return Math.round(toned * peak)
}

/** Quantize S into steps of 10 so adjacent pixels merge into one G1. */
function quantizeS(s: number): number {
  return Math.round(s / 10) * 10
}

/**
 * Convert a grayscale bitmap to GRBL engraving G-code.
 *
 * @param gray row-major luminance, length = wPx * hPx, 0 black .. 255 white
 */
export function rasterGcode(
  gray: Uint8ClampedArray | Uint8Array,
  wPx: number,
  hPx: number,
  opts: RasterGcodeOptions,
): RasterResult {
  const {
    widthMm,
    dpi,
    speed,
    powerPercent,
    passes,
    zStep = 0,
    travelHeight = 0,
    darkness = 50,
    invert = false,
    originAtStart = true,
  } = opts

  if (wPx < 1 || hPx < 1) throw new Error('rasterGcode: empty image')
  if (gray.length < wPx * hPx) throw new Error('rasterGcode: gray buffer too small')

  const heightMm = (widthMm * hPx) / wPx
  const pxW = widthMm / wPx // mm per pixel horizontally
  const pxH = heightMm / hPx // mm per pixel vertically

  const halfW = widthMm / 2
  const halfH = heightMm / 2

  // Scanline spacing from DPI; subsample source rows to match.
  const interval = 25.4 / Math.max(1, dpi)
  const rowStep = Math.max(1, Math.round(interval / Math.max(pxH, 1e-6)))

  // Minimum burn S worth emitting; below this the segment is pure travel.
  const minS = 8

  const lines: string[] = []
  lines.push('; Artilume S1 raster engraving')
  lines.push('; Center origin: 0,0 = bed center. 150x200mm area.')
  lines.push(
    `; image ${wPx}x${hPx}px -> ${widthMm.toFixed(1)}x${heightMm.toFixed(1)}mm ` +
      `@ ${dpi}dpi (row step ${rowStep}px), darkness ${darkness}${invert ? ' (inverted)' : ''}`,
  )
  lines.push('G90 G21')
  if (originAtStart) lines.push('G92 X0 Y0')

  let segments = 0
  let scanlines = 0

  for (let pass = 0; pass < passes; pass++) {
    const z = travelHeight - zStep * pass
    lines.push(`; pass ${pass + 1}/${passes}  Z=${z.toFixed(3)}`)
    lines.push('M5')
    lines.push(`G0 Z${z.toFixed(3)}`)

    // Top row of the image burns at max Y; zigzag alternates direction.
    let lineNo = 0
    for (let row = 0; row < hPx; row += rowStep, lineNo++) {
      const y = halfH - (row + 0.5) * pxH
      const leftToRight = lineNo % 2 === 0

      // Collect runs of equal quantized S in burn order for this row.
      type Run = { x0: number; x1: number; s: number }
      const runs: Run[] = []
      let cur: Run | null = null
      const pushPixel = (col: number, s: number) => {
        const xc = -halfW + (col + 0.5) * pxW
        const x0 = xc - pxW / 2
        const x1 = xc + pxW / 2
        if (cur && cur.s === s) {
          cur.x0 = Math.min(cur.x0, x0)
          cur.x1 = Math.max(cur.x1, x1)
        } else {
          if (cur) runs.push(cur)
          cur = { x0, x1, s }
        }
      }
      for (let i = 0; i < wPx; i++) {
        const col = leftToRight ? i : wPx - 1 - i
        pushPixel(col, quantizeS(pixelToS(gray[row * wPx + col], darkness, invert, powerPercent)))
      }
      if (cur) runs.push(cur)
      if (runs.length === 0) continue

      // Drop leading/trailing zero-power runs (pure travel).
      while (runs.length > 0 && runs[0].s < minS) runs.shift()
      while (runs.length > 0 && runs[runs.length - 1].s < minS) runs.pop()
      if (runs.length === 0) continue

      const start = runs[0]
      lines.push('M5')
      lines.push(`G0 X${start.x0.toFixed(3)} Y${y.toFixed(3)}`)
      lines.push(`G1 F${speed.toFixed(0)}`)

      for (const run of runs) {
        if (run.s < minS) {
          // White gap: laser off, glide across at feed rate.
          lines.push('M5')
          lines.push(`G1 X${run.x1.toFixed(3)}`)
        } else {
          lines.push(`M4 S${run.s}`)
          lines.push(`G1 X${run.x1.toFixed(3)}`)
          segments++
        }
      }
      scanlines++
    }
  }

  lines.push('M5')
  lines.push(`G0 Z${travelHeight.toFixed(3)}`)
  lines.push('G0 X0 Y0')
  lines.push('; done')

  return {
    lines,
    bounds: { minX: -halfW, minY: -halfH, maxX: halfW, maxY: halfH, w: widthMm, h: heightMm },
    heightMm,
    scanlines,
    segments,
  }
}

/**
 * Cheap pre-flight estimate of raster job size without building G-code.
 * Samples rows/cols to find how many scanlines contain burnable pixels and
 * guesses segment counts from average run length.
 */
export function estimateRasterLines(
  gray: Uint8ClampedArray | Uint8Array,
  wPx: number,
  hPx: number,
  widthMm: number,
  dpi: number,
  darkness: number,
  invert: boolean,
  powerPercent: number,
): { scanlines: number; lines: number; heightMm: number } {
  if (wPx < 1 || hPx < 1 || gray.length < wPx * hPx) {
    return { scanlines: 0, lines: 0, heightMm: 0 }
  }
  const heightMm = (widthMm * hPx) / wPx
  const pxH = heightMm / hPx
  const interval = 25.4 / Math.max(1, dpi)
  const rowStep = Math.max(1, Math.round(interval / Math.max(pxH, 1e-6)))
  const scanlines = Math.ceil(hPx / rowStep)
  const minS = 8

  let burnRows = 0
  let totalRuns = 0
  const colStep = Math.max(1, Math.floor(wPx / 128))
  let sampledRows = 0
  for (let row = 0; row < hPx; row += rowStep) {
    sampledRows++
    // Mirror the generator: count quantized-S runs (real G1 segments).
    let runs = 0
    let hasBurn = false
    let prevQ = -1
    for (let col = 0; col < wPx; col += colStep) {
      const s = pixelToS(gray[row * wPx + col], darkness, invert, powerPercent)
      const q = Math.round(s / 10) * 10
      if (q !== prevQ) {
        runs++
        if (q >= minS) hasBurn = true
      }
      prevQ = q
    }
    if (hasBurn) {
      burnRows++
      totalRuns += runs
    }
  }
  const burnFraction = sampledRows > 0 ? burnRows / sampledRows : 0
  const avgRunsPerRow = sampledRows > 0 ? Math.max(1, totalRuns / sampledRows) : 1
  const burnedScanlines = Math.round(scanlines * burnFraction)
  // Per row: M5 + G0 + G1 F setup, then 2 lines (state + move) per run.
  const perRow = 3 + Math.ceil(avgRunsPerRow) * 2
  const lines = 10 + burnedScanlines * perRow + 2 * (scanlines - burnedScanlines)
  return { scanlines: burnedScanlines, lines, heightMm }
}

/** Luminance buffer from RGBA ImageData-style pixels (Rec.709). */
export function rgbaToGray(rgba: Uint8ClampedArray, wPx: number, hPx: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(wPx * hPx)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2]
  }
  return out
}
