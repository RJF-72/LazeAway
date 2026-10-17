// SVG parser smoke test: bundles svgImport.ts, then runs assertions in a
// hidden Electron renderer (real Chromium DOMParser).
// Usage: node scripts/check-svg.mjs
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

// 1. Bundle the parser (iife exposing global SvgTest).
const bundle = spawnSync('npx', ['rolldown', '-c', 'rolldown.svgtest.config.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
if (bundle.status !== 0) process.exit(bundle.status ?? 1)

const bundleCode = readFileSync(join(root, '.tmp', 'svgtest', 'svgImport.iife.js'), 'utf8')

const CASES = [
  {
    name: 'rect + circle + transform',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50">
      <rect x="10" y="10" width="30" height="20"/>
      <circle cx="70" cy="25" r="10"/>
      <g transform="translate(5,5)"><line x1="0" y1="0" x2="10" y2="0"/></g>
    </svg>`,
    expectPaths: 3,
    expectClosed: [true, true, false],
    maxW: 100,
    minW: 40,
  },
  {
    name: 'curves + arcs flatten',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <path d="M10 100 C 10 10, 190 10, 190 100 S 10 190, 10 100 Z"/>
      <path d="M20 180 A 30 30 0 0 1 80 180 L 80 190 Z"/>
      <path d="M100 20 q 40 40 0 80 t -40 40"/>
    </svg>`,
    expectPaths: 3,
    minPoints: [49, 10, 30],
    expectClosed: [true, true, false],
  },
  {
    name: 'poly / polygon / rounded rect',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <polyline points="0,0 50,0 50,50"/>
      <polygon points="100,0 150,0 125,50"/>
      <rect x="0" y="100" width="80" height="40" rx="10"/>
    </svg>`,
    expectPaths: 3,
    expectClosed: [false, true, true],
  },
  {
    name: 'text only -> error mentioning outlines',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="50">Hi</text></svg>`,
    expectError: 'outline',
  },
  {
    name: 'malformed xml -> error',
    svg: '<svg><path d="M 0 0"',
    expectError: 'parse',
  },
  {
    name: 'relative commands + nested transforms',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g transform="scale(2)"><path d="m10 10 l20 0 l0 20 z"/></g>
    </svg>`,
    expectPaths: 1,
    expectClosed: [true],
  },
]

const harness = `
const { app, BrowserWindow } = require('electron')
const BUNDLE = ${JSON.stringify(bundleCode)}
const CASES = ${JSON.stringify(CASES)}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: true },
  })
  await win.loadURL('data:text/html,<html><body></body></html>')
  const out = []
  let failed = 0
  const log = (ok, msg) => {
    out.push((ok ? '  ok  ' : 'FAIL  ') + msg)
    if (!ok) failed++
  }

  await win.webContents.executeJavaScript(
    'var module = { exports: {} };' + BUNDLE +
    ';window.__svg = (typeof SvgTest !== "undefined" ? SvgTest : module.exports);undefined',
    true,
  )

  for (const c of CASES) {
    const r = await win.webContents.executeJavaScript(
      'JSON.stringify(window.__svg.parseSvg(' + JSON.stringify(c.svg) + '))',
      true,
    )
    const res = JSON.parse(r)
    if (c.expectError) {
      const got = res.ok === false ? res.error : '(parsed OK)'
      log(
        res.ok === false && got.toLowerCase().includes(c.expectError.toLowerCase()),
        c.name + ': error contains "' + c.expectError + '" [got: ' + got + ']',
      )
      continue
    }
    if (!res.ok) {
      log(false, c.name + ': unexpected error ' + res.error)
      continue
    }
    const g = res.geometry
    log(g.paths.length === c.expectPaths,
      c.name + ': ' + c.expectPaths + ' paths (got ' + g.paths.length + ')')
    if (c.expectClosed) {
      log(JSON.stringify(g.closed) === JSON.stringify(c.expectClosed),
        c.name + ': closed flags [got ' + JSON.stringify(g.closed) + ']')
    }
    if (c.minPoints) {
      c.minPoints.forEach((min, i) =>
        log(g.paths[i] && g.paths[i].length >= min,
          c.name + ': path ' + i + ' has >=' + min + ' pts (got ' + (g.paths[i] ? g.paths[i].length : 0) + ')'))
    }
    const finite = g.paths.every((p) => p.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y)))
    log(finite, c.name + ': all points finite')
    log(g.bounds.w > 0 && g.bounds.h > 0,
      c.name + ': bounds ' + g.bounds.w.toFixed(1) + 'x' + g.bounds.h.toFixed(1))
    if (c.maxW) log(g.bounds.w <= c.maxW + 0.01, c.name + ': width <= ' + c.maxW)
    if (c.minW) log(g.bounds.w >= c.minW, c.name + ': width >= ' + c.minW + ' (got ' + g.bounds.w.toFixed(1) + ')')
    const cx = (g.bounds.minX + g.bounds.maxX) / 2
    const cy = (g.bounds.minY + g.bounds.maxY) / 2
    log(Math.abs(cx) < 0.01 && Math.abs(cy) < 0.01,
      c.name + ': centered (' + cx.toFixed(3) + ',' + cy.toFixed(3) + ')')
  }

  const unitSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50"><rect x="0" y="0" width="100" height="50"/></svg>'
  const unitRes = JSON.parse(await win.webContents.executeJavaScript(
    'JSON.stringify(window.__svg.parseSvg(' + JSON.stringify(unitSvg) + '))', true))
  log(unitRes.ok && Math.abs(unitRes.naturalWidthMm - 100) < 0.01,
    'mm units honored: width=' + (unitRes.ok ? unitRes.naturalWidthMm : 'ERR') + ' (want 100)')

  const pxSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect x="0" y="0" width="96" height="96"/></svg>'
  const pxRes = JSON.parse(await win.webContents.executeJavaScript(
    'JSON.stringify(window.__svg.parseSvg(' + JSON.stringify(pxSvg) + '))', true))
  log(pxRes.ok && Math.abs(pxRes.naturalWidthMm - 25.4) < 0.1,
    'px@96dpi: width=' + (pxRes.ok ? pxRes.naturalWidthMm.toFixed(2) : 'ERR') + 'mm (want 25.40)')

  console.log(out.join('\\n'))
  console.log(failed === 0 ? '\\nALL SVG CHECKS PASSED' : '\\n' + failed + ' CHECK(S) FAILED')
  app.exit(failed === 0 ? 0 : 1)
}).catch((err) => {
  console.error('HARNESS ERROR', err)
  app.exit(1)
})
`

mkdirSync(join(root, '.tmp', 'svgtest'), { recursive: true })
const harnessPath = join(root, '.tmp', 'svgtest', 'harness.cjs')
writeFileSync(harnessPath, harness, 'utf8')

const result = spawnSync('npx', ['electron', harnessPath], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
