// Exact Texas guitar soundhole-cut outline path + helpers to convert to
// center-origin points, optimize collinear segments and emit GRBL G-code.
//
// Coordinate reality for the Artilume S1: origin (0,0) is the CENTER of the
// 150x200mm bed. The raw path below is authored in a 95mm-wide space where
// x spans [0,95] and y spans [0,~82.92]. We center it by translating by
// (-47.5, -41.46) so the shape straddles the machine origin, then optionally
// scale about the origin for the 80mm variant.

// Raw SVG path 'd' for the Texas soundhole cut (exact data supplied).
export const TEXAS_PATH_D =
  'M 25.399 0 L 25.203 34.931 L 0 35.062 L 0.196 36.172 L 1.371 36.564 L 2.481 38.653 L 4.048 39.306 L 8.031 43.354 L 9.99 44.072 L 11.753 45.639 L 11.818 46.749 L 13.058 48.643 L 13.45 51.32 L 14.952 53.54 L 17.629 55.433 L 18.804 55.433 L 21.481 57.522 L 23.505 58.175 L 25.333 56.347 L 26.247 53.54 L 27.814 52.234 L 29.12 52.234 L 29.708 51.32 L 31.471 52.103 L 35.649 52.038 L 37.086 52.625 L 41.983 57.457 L 43.55 61.309 L 44.595 62.419 L 44.79 63.986 L 46.749 65.357 L 48.643 68.491 L 50.601 69.275 L 51.581 73.976 L 53.278 75.804 L 54.062 78.22 L 55.759 78.677 L 56.935 79.656 L 58.698 79.852 L 61.309 81.55 L 64.77 81.485 L 66.729 82.921 L 68.622 81.615 L 68.361 78.612 L 67.447 75.935 L 67.447 72.213 L 68.818 68.687 L 70.711 65.88 L 75.282 62.615 L 82.268 58.828 L 88.014 54.323 L 90.821 53.082 L 93.041 52.756 L 92.258 51.907 L 93.759 49.557 L 93.433 46.031 L 95 42.505 L 94.543 41.852 L 94.739 40.808 L 92.649 37.935 L 92.519 36.498 L 90.952 34.866 L 90.756 23.048 L 88.863 22.983 L 86.186 21.677 L 85.729 21.938 L 82.986 19.849 L 81.289 20.632 L 79.983 20.045 L 79.265 20.763 L 77.763 20.436 L 74.172 22.199 L 71.821 21.285 L 70.189 21.351 L 69.732 20.567 L 68.883 22.265 L 67.838 22.656 L 66.206 21.351 L 64.704 21.155 L 64.313 20.502 L 63.529 20.502 L 63.137 21.416 L 61.832 21.612 L 59.808 18.674 L 58.371 19.392 L 57.522 19.326 L 57.326 18.804 L 56.086 19.196 L 55.629 18.543 L 52.887 18.412 L 52.168 16.649 L 48.904 17.107 L 47.924 15.931 L 46.684 15.474 L 46.619 0 Z'

export interface Pt {
  x: number
  y: number
}

/**
 * Mirror / rotation applied to the centered outline before it is written as
 * machine coordinates. This lets the operator compensate for how the material
 * is mounted and for the machine's physical axis directions.
 */
export interface Orientation {
  /** Mirror across the Y axis (left <-> right). */
  flipX: boolean
  /** Mirror across the X axis (front <-> back). */
  flipY: boolean
  /** Quarter turns (90 deg each) counter-clockwise about the origin. */
  rotate90: number
}

export const IDENTITY_ORIENTATION: Orientation = {
  flipX: false,
  flipY: false,
  rotate90: 0,
}

/**
 * Apply mirroring (in the machine frame) followed by a rotation of
 * rotate90 * 90deg about the centered origin. Rotation keeps the shape
 * centered because it is applied to already-centered points.
 */
export function orientPoints(pts: Pt[], o: Orientation = IDENTITY_ORIENTATION): Pt[] {
  const turns = ((Math.round(o.rotate90) % 4) + 4) % 4
  const cos = [1, 0, -1, 0][turns]
  const sin = [0, 1, 0, -1][turns]
  return pts.map((p) => {
    const x = o.flipX ? -p.x : p.x
    const y = o.flipY ? -p.y : p.y
    return { x: x * cos - y * sin, y: x * sin + y * cos }
  })
}

/** Raw absolute points from the path 'd' (before centering). */
export function parseTexasRaw(d: string = TEXAS_PATH_D): Pt[] {
  const tokens = d.trim().split(/[\s,]+/)
  const pts: Pt[] = []
  let i = 0
  let cmd = ''
  while (i < tokens.length) {
    const tok = tokens[i]
    if (/^[MLZz]$/.test(tok)) {
      cmd = tok
      i++
      if (cmd === 'Z' || cmd === 'z') break
      continue
    }
    if (cmd === 'M' || cmd === 'L') {
      const x = parseFloat(tokens[i])
      const y = parseFloat(tokens[i + 1])
      if (!Number.isNaN(x) && !Number.isNaN(y)) pts.push({ x, y })
      i += 2
    } else {
      i++
    }
  }
  return pts
}

/**
 * Center the raw path at the machine origin (0,0) and optionally scale.
 * scale = 1 -> 95mm wide, scale = 0.842 -> ~80mm wide.
 * Returns closed polygon points (does not repeat first point).
 */
export function texasPoints(
  scale = 1,
  orientation: Orientation = IDENTITY_ORIENTATION,
  d: string = TEXAS_PATH_D,
): Pt[] {
  const raw = parseTexasRaw(d)
  const cx = 95 / 2      // 47.5
  const cy = 82.921 / 2  // 41.4605
  const centered = raw.map((p) => ({
    x: (p.x - cx) * scale,
    y: -(p.y - cy) * scale, // SVG y-down -> machine y-up
  }))
  return orientPoints(centered, orientation)
}

/**
 * Merge collinear (near-collinear) vertices to shrink long streams of tiny
 * segments that overflow the GRBL planner on complex paths. Keeps the outline
 * visually identical while cutting point count dramatically.
 *
 * @param tol maximum perpendicular deviation (mm) allowed when skipping a point
 */
export function mergeCollinear(pts: Pt[], closed = true, tol = 0.03): Pt[] {
  if (pts.length < 3) return pts.slice()
  const out: Pt[] = []
  const n = pts.length
  // For a closed shape, start from the first point and walk forward.
  const idx = (i: number) => pts[((i % n) + n) % n]

  out.push(idx(0))
  for (let i = 1; i < n; i++) {
    const prev = idx(i - 1)
    const cur = idx(i)
    const next = idx(i + 1)
    // perpendicular distance from cur to the line prev->next
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy)
    let dist: number
    if (len === 0) {
      dist = Math.hypot(cur.x - prev.x, cur.y - prev.y)
    } else {
      dist = Math.abs(dy * cur.x - dx * cur.y + next.x * prev.y - next.y * prev.x) / len
    }
    if (dist > tol) out.push(cur)
  }
  if (!closed) {
    const last = idx(n - 1)
    out.push(last)
  }
  return out
}

export interface GcodeOptions {
  speed: number // mm/min
  powerPercent: number // 0-100 -> S value
  passes: number
  zStep?: number // mm Z drop per pass (default 0)
  travelHeight?: number // Z height for safe travels (default 0)
  optimize?: boolean // merge collinear (default true)
  tol?: number // merge tolerance
  originAtStart?: boolean // emit G92 X0 Y0 (default true)
}

/**
 * Convert the Texas outline to GRBL G-code using the center origin.
 * Emits: G90 G21 [G92 X0 Y0], M3 S<power>, G0 to start, G1 around the
 * closed outline once per pass, optional Z-step for multi-pass cutting,
 * finally M5 and G0 X0 Y0.
 */
export function generateTexasGcode(scale = 1, opts: GcodeOptions): string[] {
  const {
    speed,
    powerPercent,
    passes,
    zStep = 0,
    travelHeight = 0,
    optimize = true,
    tol = 0.03,
    originAtStart = true,
  } = opts

  const s = Math.round((Math.max(0, Math.min(100, powerPercent)) / 100) * 1000)
  let pts = texasPoints(scale)
  if (optimize) pts = mergeCollinear(pts, true, tol)

  const start = pts[0]
  const lines: string[] = []
  lines.push('; Artilume S1 Texas soundhole cut')
  lines.push('; Center origin: 0,0 = bed center. 150x200mm area.')
  lines.push('G90 G21')
  if (originAtStart) lines.push('G92 X0 Y0')
  lines.push(`M4 S${s}`) // M4 = dynamic laser (ramps on/off) - safer than M3 for motion

  for (let pass = 0; pass < passes; pass++) {
    const z = travelHeight - zStep * pass
    lines.push(`; pass ${pass + 1}/${passes}  Z=${z.toFixed(3)}`)
    // move into position with laser off
    lines.push('M5')
    lines.push(`G0 Z${z.toFixed(3)}`)
    lines.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`)
    lines.push(`M4 S${s}`)
    lines.push(`G1 F${speed.toFixed(0)}`)
    for (let i = 1; i <= pts.length; i++) {
      const p = pts[i % pts.length]
      lines.push(`G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`)
    }
  }

  lines.push('M5')
  lines.push(`G0 Z${travelHeight.toFixed(3)}`)
  lines.push('G0 X0 Y0')
  lines.push('; done')
  return lines
}

/** Framing routine: travel the bounding box outline with the laser OFF (S0). */
export function generateFrameGcode(scale = 1, speed = 1000): string[] {
  const pts = texasPoints(scale)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return [
    '; FRAME - laser off trace of bounding box',
    'G90 G21',
    'G92 X0 Y0',
    'M5',
    `G1 F${speed.toFixed(0)}`,
    `G0 X${minX.toFixed(3)} Y${minY.toFixed(3)}`,
    `G1 X${maxX.toFixed(3)} Y${minY.toFixed(3)}`,
    `G1 X${maxX.toFixed(3)} Y${maxY.toFixed(3)}`,
    `G1 X${minX.toFixed(3)} Y${maxY.toFixed(3)}`,
    `G1 X${minX.toFixed(3)} Y${minY.toFixed(3)}`,
    'M5',
    'G0 X0 Y0',
  ]
}

/** Bounding box of the Texas outline at a given scale. */
export function texasBounds(scale = 1): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  const pts = texasPoints(scale)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/** SVG path string for the centered+scaled outline (used by the canvas). */
export function texasPathData(scale = 1): string {
  const pts = texasPoints(scale)
  const parts = pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`,
  )
  return parts.join(' ') + ' Z'
}
