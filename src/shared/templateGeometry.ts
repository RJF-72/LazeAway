// Vector geometry for the 24 Texas templates.
//
// The template catalog (texasTemplates.json) is metadata only. This module
// supplies real, cuttable vector geometry (polylines in machine coordinates,
// mm, centered at the bed origin, y-up) for the templates whose shapes can be
// constructed exactly: the Texas outline family, stars, rosettes, fretboard
// inlays (true fret math), and simple iconic shapes.
//
// Templates whose artwork is genuinely artistic (longhorn, bluebonnets,
// filigree, treble clef, ...) return null from geometryForTemplate() — the UI
// must show "vector artwork pending" and refuse to START rather than cut the
// wrong shape.
import { texasPoints, mergeCollinear } from './texasPath'
import type { Pt } from './texasPath'

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  w: number
  h: number
}

export interface TemplateGeometry {
  /** Polylines in machine coords (mm), centered at origin, y-up. */
  paths: Pt[][]
  /** Per path: true = closed polygon, false = open polyline. */
  closed: boolean[]
  bounds: Bounds
  note?: string
}

// ---------- primitive builders ----------

function circlePts(cx: number, cy: number, r: number, seg = 72): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

function ellipsePts(cx: number, cy: number, rx: number, ry: number, seg = 48): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
  }
  return pts
}

/** Arc from a0 to a1 (radians), inclusive endpoints. */
function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, seg = 48): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

function starPts(cx: number, cy: number, rOuter: number, rInner: number, n = 5): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

function cubic(
  p0: Pt,
  c1: Pt,
  c2: Pt,
  p3: Pt,
  seg = 24,
): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const mt = 1 - t
    pts.push({
      x:
        mt * mt * mt * p0.x +
        3 * mt * mt * t * c1.x +
        3 * mt * t * t * c2.x +
        t * t * t * p3.x,
      y:
        mt * mt * mt * p0.y +
        3 * mt * mt * t * c1.y +
        3 * mt * t * t * c2.y +
        t * t * t * p3.y,
    })
  }
  return pts
}

function quad(p0: Pt, c: Pt, p1: Pt, seg = 20): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const mt = 1 - t
    pts.push({
      x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
    })
  }
  return pts
}

/** Vertical stadium (capsule) centered at (cx,cy), width w, total height h. */
function capsulePts(cx: number, cy: number, w: number, h: number, seg = 20): Pt[] {
  const r = w / 2
  const straight = Math.max(0, h - w) / 2
  const pts: Pt[] = []
  // top cap: 0 -> PI around (cx, cy+straight)
  for (let i = 0; i <= seg; i++) {
    const a = (Math.PI * i) / seg
    pts.push({ x: cx + r * Math.cos(a), y: cy + straight + r * Math.sin(a) })
  }
  // bottom cap: PI -> 2PI around (cx, cy-straight)
  for (let i = 1; i <= seg; i++) {
    const a = Math.PI + (Math.PI * i) / seg
    pts.push({ x: cx + r * Math.cos(a), y: cy - straight + r * Math.sin(a) })
  }
  return pts
}

/** Horizontal stadium (capsule) centered at (cx,cy), total width w, height h. */
function capsuleHPTs(cx: number, cy: number, w: number, h: number, seg = 20): Pt[] {
  const r = h / 2
  const straight = Math.max(0, w - h) / 2
  const pts: Pt[] = []
  // right cap: -90..90 around (cx+straight, cy)
  for (let i = 0; i <= seg; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / seg
    pts.push({ x: cx + straight + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  // left cap: 90..270 around (cx-straight, cy)
  for (let i = 1; i <= seg; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / seg
    pts.push({ x: cx - straight + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

function joinPaths(chains: Pt[][]): Pt[] {
  const out: Pt[] = []
  for (const c of chains) {
    if (out.length > 0) out.pop() // drop duplicated joint
    out.push(...c)
  }
  return out
}

export function pathsBounds(paths: Pt[][]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of paths) {
    for (const q of p) {
      if (q.x < minX) minX = q.x
      if (q.x > maxX) maxX = q.x
      if (q.y < minY) minY = q.y
      if (q.y > maxY) maxY = q.y
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

function make(paths: Pt[][], closed: boolean[], note?: string): TemplateGeometry {
  return { paths, closed, bounds: pathsBounds(paths), note }
}

// ---------- template geometries ----------

function texasGeom(scale: number, note?: string): TemplateGeometry {
  const pts = mergeCollinear(texasPoints(scale), true, 0.03)
  return make([pts], [true], note)
}

function loneStarInTexas(): TemplateGeometry {
  const outline = mergeCollinear(texasPoints(0.62), true, 0.03)
  // Star placement verified inside the outline (point-in-polygon fit).
  const star = starPts(7, -2, 13.5, 5.7)
  return make([outline, star], [true, true], 'Lone star inside the Texas outline')
}

function starburst(): TemplateGeometry {
  const paths: Pt[][] = []
  const closed: boolean[] = []
  const rays = 16
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2
    paths.push([
      { x: 10 * Math.cos(a), y: 10 * Math.sin(a) },
      { x: 44 * Math.cos(a), y: 44 * Math.sin(a) },
    ])
    closed.push(false)
  }
  paths.push(circlePts(0, 0, 10))
  closed.push(true)
  return make(paths, closed, '16-ray starburst')
}

function rosette(): TemplateGeometry {
  const outline = mergeCollinear(texasPoints(0.45), true, 0.03)
  return make(
    [circlePts(0, 0, 44), circlePts(0, 0, 37), circlePts(0, 0, 30), outline],
    [true, true, true, true],
    'Triple-ring rosette with Texas center',
  )
}

/** True fret positions for a 25.5" (647.7mm) scale, measured from the nut. */
function fretDist(n: number): number {
  return 647.7 * (1 - Math.pow(2, -n / 12))
}

function fretInlays(): TemplateGeometry {
  const paths: Pt[][] = []
  const closed: boolean[] = []
  // 12 markers: singles at 3,5,7,9,15,17,19,21,24 + double at 12
  const frets: Array<[number, number]> = [
    [3, 0], [5, 0], [7, 0], [9, 0],
    [12, -14], [12, 14],
    [15, 0], [17, 0], [19, 0], [21, 0], [24, 0],
  ]
  for (const [n, x] of frets) {
    paths.push(circlePts(x, fretDist(n), 3, 36))
    closed.push(true)
  }
  return make(
    paths,
    closed,
    '12 MOP dots at true 25.5" fret positions from the nut — exceeds the 200mm bed, cut in sections',
  )
}

function guitarPick(): TemplateGeometry {
  // Classic pick: sharp tip, gently curved shoulders, rounded top.
  const tip: Pt = { x: 0, y: -17 }
  const shoulderL: Pt = { x: -10.5, y: 3 }
  const shoulderR: Pt = { x: 10.5, y: 3 }
  const left = quad(tip, { x: -11.5, y: -8 }, shoulderL)
  const top = arcPts(0, 3, 10.5, Math.PI, 0, 28)
  const right = quad(shoulderR, { x: 11.5, y: -8 }, tip)
  return make([joinPaths([left, top, right])], [true], 'Classic pick silhouette ~31mm')
}

function heart(): TemplateGeometry {
  const dip: Pt = { x: 0, y: 18 }
  const bottom: Pt = { x: 0, y: 74 }
  const left = cubic(dip, { x: -14, y: 2 }, { x: -38, y: 6 }, { x: -44, y: 26 })
  const leftLow = cubic({ x: -44, y: 26 }, { x: -50, y: 46 }, { x: -24, y: 60 }, bottom)
  const rightLow = cubic(bottom, { x: 24, y: 60 }, { x: 50, y: 46 }, { x: 44, y: 26 })
  const right = cubic({ x: 44, y: 26 }, { x: 38, y: 6 }, { x: 14, y: 2 }, dip)
  const pts = joinPaths([left, leftLow, rightLow, right])
  // recenter vertically
  const b = pathsBounds([pts])
  const cy = (b.minY + b.maxY) / 2
  const centered = pts.map((p) => ({ x: p.x, y: p.y - cy }))
  return make([centered], [true], 'Heart ~88mm wide')
}

function horseshoe(): TemplateGeometry {
  const rO = 38
  const rI = 27
  const a0 = -Math.PI / 3 // -60deg
  const a1 = (4 * Math.PI) / 3 // 240deg — 300deg span, gap at the bottom
  const outer = arcPts(0, 0, rO, a0, a1, 64)
  const inner = arcPts(0, 0, rI, a1, a0, 64)
  const shoe = joinPaths([outer, inner])
  // nail holes along the mid arc
  const paths: Pt[][] = [shoe]
  const closed: boolean[] = [true]
  for (let k = 0; k < 6; k++) {
    const a = a0 + ((a1 - a0) * (k + 0.5)) / 6
    const r = (rO + rI) / 2
    paths.push(circlePts(r * Math.cos(a), r * Math.sin(a), 1.6, 16))
    closed.push(true)
  }
  return make(paths, closed, '300° shoe with nail holes')
}

function texasFlag(): TemplateGeometry {
  const outline = mergeCollinear(texasPoints(0.75), true, 0.03)
  // Divider + star placed inside the outline (chord/point-in-polygon fit).
  const divider: Pt[] = [{ x: -24.7, y: -4 }, { x: 32.5, y: -4 }]
  const star = starPts(-10, 8, 6, 2.5)
  return make(
    [outline, divider, star],
    [true, false, true],
    'Texas outline with flag divider + lone star (decorative)',
  )
}

function musicNotes(): TemplateGeometry {
  const paths: Pt[][] = []
  const closed: boolean[] = []
  // two beamed eighth notes
  const headL = ellipsePts(-14, -8, 6.5, 5)
  const headR = ellipsePts(14, -8, 6.5, 5)
  paths.push(headL, headR)
  closed.push(true, true)
  // stems (from head right edge up)
  paths.push([{ x: -7.5, y: -8 }, { x: -7.5, y: 28 }])
  closed.push(false)
  paths.push([{ x: 20.5, y: -8 }, { x: 20.5, y: 28 }])
  closed.push(false)
  // beam
  paths.push([{ x: -7.5, y: 28 }, { x: 20.5, y: 28 }])
  closed.push(false)
  paths.push([{ x: -7.5, y: 24 }, { x: 20.5, y: 24 }])
  closed.push(false)
  return make(paths, closed, 'Beamed eighth-note pair')
}

function cactus(): TemplateGeometry {
  // Saguaro: tall central column; each arm = horizontal bar out from the
  // trunk, then a vertical segment rising from the bar's outer end.
  const main = capsulePts(0, 0, 26, 90)
  const armLBar = capsuleHPTs(-21, 10, 26, 17) // spans x -34..-8
  const armLUp = capsulePts(-30, 27, 17, 34) // spans y 10..44
  const armRBar = capsuleHPTs(20, -4, 24, 17) // spans x 8..32
  const armRUp = capsulePts(30, 14, 17, 36) // spans y -4..32
  return make(
    [main, armLBar, armLUp, armRBar, armRUp],
    [true, true, true, true, true],
    'Saguaro ~90mm tall',
  )
}

// ---------- dispatch ----------

/**
 * Vector geometry for a template id, or null when the template needs real
 * artwork that does not exist yet. Never synthesize decorative artwork —
 * return null and let the UI say so.
 */
export function geometryForTemplate(id: number): TemplateGeometry | null {
  switch (id) {
    case 1: // Simple Texas Outline (master)
      return texasGeom(1, 'Master Texas outline — 95mm')
    case 2: // Texas Outline Small 50mm (headstock)
      return texasGeom(50 / 95, 'Headstock inlay — 50mm')
    case 3: // Texas Outline 95mm (soundhole)
      return texasGeom(1, 'Soundhole cut — 95mm')
    case 4: // Texas Flag Inside Outline
      return texasFlag()
    case 5: // Lone Star Inside Texas
      return loneStarInTexas()
    case 6: // Texas + Heart
      return heart()
    case 9: // Ornate Rosette with Texas Center
      return rosette()
    case 13: // Musical Notes + Texas
      return musicNotes()
    case 14: // Cactus + Texas
      return cactus()
    case 15: // Horseshoe + Texas
      return horseshoe()
    case 17: // Guitar Pick Texas
      return guitarPick()
    case 18: // Texas Starburst
      return starburst()
    case 21: // Fretboard Inlay Set - 12 markers
      return fretInlays()
    case 24: // Texas Soundhole Final
      return texasGeom(1, 'Final soundhole cut — 95mm')
    default:
      // 7 Longhorn, 8 Bluebonnet Bouquet, 10 Rope Border, 11 Treble Clef,
      // 12 Guitar Silhouette, 16 Deep-in-the-Heart Text, 19 Baroque,
      // 20 Mandala, 22 Filigree Guitar, 23 Bluebonnet Frame
      return null
  }
}

/** Template ids that have real vector geometry wired. */
export const WIRED_TEMPLATE_IDS = [1, 2, 3, 4, 5, 6, 9, 13, 14, 15, 17, 18, 21, 24]
