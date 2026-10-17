// Sanity checks for the raster engraving generator (run against compiled
// output: node scripts/check-raster.mjs)
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { rasterGcode, pixelToS, darknessGamma, estimateRasterLines, rgbaToGray } = require(
  '../dist-electron/shared/rasterEngrave.js',
)

let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else {
    failed++
    console.error(`FAIL  ${name} ${extra}`)
  }
}

// --- tone curve ---
check('gamma(50) == 1', Math.abs(darknessGamma(50) - 1) < 1e-9)
check('gamma(0) == 4', Math.abs(darknessGamma(0) - 4) < 1e-9)
check('gamma(100) == 0.25', Math.abs(darknessGamma(100) - 0.25) < 1e-9)
const mid = 128
const lightS = pixelToS(mid, 0, false, 100)
const linearS = pixelToS(mid, 50, false, 100)
const darkS = pixelToS(mid, 100, false, 100)
check('darkness 0 < 50 < 100 for midtone', lightS < linearS && linearS < darkS,
  `(${lightS} ${linearS} ${darkS})`)
check('black -> peak S at any darkness', pixelToS(0, 50, false, 100) === 1000)
check('white -> S 0', pixelToS(255, 50, false, 100) === 0)
check('invert swaps black/white', pixelToS(0, 50, true, 100) === 0 && pixelToS(255, 50, true, 100) === 1000)
check('power scales S', pixelToS(0, 50, false, 50) === 500)

// --- gray conversion ---
const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 90, 90, 90, 255])
const g = rgbaToGray(rgba, 3, 1)
check('rgbaToGray black/white/gray', g[0] === 0 && g[1] === 255 && Math.abs(g[2] - 90) < 2,
  `[${g[0]},${g[1]},${g[2]}]`)

// --- gcode generation: 40x20 gradient image, 40mm wide @ 100dpi ---
const wPx = 40
const hPx = 20
const gray = new Uint8ClampedArray(wPx * hPx)
for (let y = 0; y < hPx; y++)
  for (let x = 0; x < wPx; x++) gray[y * wPx + x] = Math.round((x / (wPx - 1)) * 255)

const res = rasterGcode(gray, wPx, hPx, {
  widthMm: 40,
  dpi: 100,
  speed: 250,
  powerPercent: 80,
  passes: 1,
  darkness: 50,
  invert: false,
})

const { lines, bounds, heightMm, scanlines, segments } = res
check('bounds width 40', bounds.w === 40)
check('bounds height follows aspect', Math.abs(bounds.h - 20) < 1e-9, String(heightMm))
check('centered bounds', bounds.minX === -20 && bounds.maxX === 20)
check('scanlines == pixel rows at 100dpi/row', scanlines === hPx, String(scanlines))
check('segments > 0', segments > 0, String(segments))
check('header has G90 G21', lines.includes('G90 G21'))
check('header has G92 X0 Y0', lines.includes('G92 X0 Y0'))
check('footer returns to origin', lines.includes('G0 X0 Y0') && lines.includes('; done'))
check('starts with comment', lines[0].startsWith(';'))
check('no NaN in output', !lines.some((l) => l.includes('NaN')))
check('S values in range', lines.every((l) => {
  const m = /^M4 S(\d+)$/.exec(l)
  return !m || (Number(m[1]) >= 0 && Number(m[1]) <= 1000)
}))
check('Z per pass absent when zStep 0 only once', lines.filter((l) => l.startsWith('G0 Z')).length >= 1)

// gradient: leftmost column dark (high S), rightmost light
const sVals = lines.filter((l) => l.startsWith('M4 S')).map((l) => Number(l.slice(4)))
check('has S=800 (80% of dark pixels)', sVals.includes(800), `[${[...new Set(sVals)].slice(0, 8)}]`)
check('max S <= 800 (power cap)', Math.max(...sVals) <= 800)

// --- darkness affects line content ---
const lighter = rasterGcode(gray, wPx, hPx, {
  widthMm: 40, dpi: 100, speed: 250, powerPercent: 80, passes: 1, darkness: 0, invert: false,
})
const sumS = (r) => r.lines.filter((l) => l.startsWith('M4 S'))
  .reduce((a, l) => a + Number(l.slice(4)), 0)
check('darkness 0 burns less energy than 50', sumS(lighter) < sumS(res))

// --- invert: white-on-black flips runs ---
const inv = rasterGcode(gray, wPx, hPx, {
  widthMm: 40, dpi: 100, speed: 250, powerPercent: 80, passes: 1, darkness: 50, invert: true,
})
const invMax = Math.max(...inv.lines.filter((l) => l.startsWith('M4 S')).map((l) => Number(l.slice(4))))
check('invert: right edge (white source) burns hot', invMax === 800, String(invMax))

// --- multipass ---
const multi = rasterGcode(gray, wPx, hPx, {
  widthMm: 40, dpi: 100, speed: 250, powerPercent: 80, passes: 3, zStep: 0.5,
})
check('3 passes => 3x scanlines', multi.scanlines === hPx * 3, String(multi.scanlines))
check('z comments present', multi.lines.some((l) => l.includes('pass 3/3')))

// --- low DPI reduces scanlines (interval must exceed 1.5x row pitch) ---
const lowDpi = rasterGcode(gray, wPx, hPx, {
  widthMm: 40, dpi: 10, speed: 250, powerPercent: 80, passes: 1,
})
check('10dpi subsamples rows', lowDpi.scanlines < scanlines,
  `${lowDpi.scanlines} < ${scanlines}`)

// --- estimate doesn't wildly overrun actual ---
const est = estimateRasterLines(gray, wPx, hPx, 40, 100, 50, false, 80)
check('estimate within 50%..200% of actual',
  est.lines >= lines.length * 0.5 && est.lines <= lines.length * 2,
  `est ${est.lines} vs actual ${lines.length}`)

// --- empty image throws ---
let threw = false
try {
  rasterGcode(new Uint8ClampedArray(0), 0, 0, { widthMm: 10, dpi: 100, speed: 250, powerPercent: 50, passes: 1 })
} catch {
  threw = true
}
check('empty image throws', threw)

console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`)
process.exit(failed === 0 ? 0 : 1)
