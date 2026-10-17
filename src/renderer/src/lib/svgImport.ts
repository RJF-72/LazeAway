// SVG import: parse an SVG document into TemplateGeometry (machine coords,
// mm, y-up, centered at the bed origin) using the renderer's DOMParser.
//
// Handles the shapes a laser can actually follow: path, polyline, polygon,
// rect, circle, ellipse, line. Curves (C/S/Q/T/A) are flattened to
// polylines; transform attributes are composed via a matrix stack. Text is
// skipped (must be outlined in the SVG editor first) — callers get a warning.
// Stroke-only semantics: every subpath becomes a cut/engrave path; fills are
// ignored because the laser traces outlines.

import type { Pt } from '@shared/texasPath'
import type { TemplateGeometry } from '@shared/templateGeometry'
import { pathsBounds } from '@shared/templateGeometry'

export interface SvgImportResult {
  ok: true
  geometry: TemplateGeometry
  /** Physical width in mm at natural size (before user sizing). */
  naturalWidthMm: number
  /** Physical height in mm at natural size. */
  naturalHeightMm: number
  /** Non-fatal notes (skipped text, etc.). */
  warnings: string[]
}
export type SvgImportError = { ok: false; error: string }

// ---------- 2D affine matrix (SVG [a b c d e f]) ----------

interface Mat {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}
const IDENT: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function mul(m: Mat, n: Mat): Mat {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  }
}

function apply(m: Mat, x: number, y: number): Pt {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
}

function parseTransform(str: string | null): Mat {
  if (!str) return IDENT
  let m: Mat = IDENT
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(str)) !== null) {
    const name = match[1]
    const args = match[2]
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter((s) => s.length > 0)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    let t: Mat = IDENT
    switch (name) {
      case 'matrix':
        if (args.length >= 6) t = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] }
        break
      case 'translate':
        t = { ...IDENT, e: args[0] ?? 0, f: args[1] ?? 0 }
        break
      case 'scale':
        t = { ...IDENT, a: args[0] ?? 1, d: args.length > 1 ? args[1] : (args[0] ?? 1) }
        break
      case 'rotate': {
        const rad = ((args[0] ?? 0) * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        t = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
        if (args.length >= 3) {
          const [cx, cy] = [args[1], args[2]]
          t = mul(mul({ ...IDENT, e: cx, f: cy }, t), { ...IDENT, e: -cx, f: -cy })
        }
        break
      }
      case 'skewX':
        t = { ...IDENT, c: Math.tan(((args[0] ?? 0) * Math.PI) / 180) }
        break
      case 'skewY':
        t = { ...IDENT, b: Math.tan(((args[0] ?? 0) * Math.PI) / 180) }
        break
      default:
        break
    }
    m = mul(m, t)
  }
  return m
}

// ---------- unit → mm ----------

const PX_PER_MM = 96 / 25.4

function lengthToMm(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = raw.trim()
  if (s === '') return null
  const m = /^(-?[\d.]+(?:e-?\d+)?)\s*(px|pt|pc|mm|cm|in|%)?$/i.exec(s)
  if (!m) return null
  const v = Number(m[1])
  if (Number.isNaN(v)) return null
  switch ((m[2] ?? 'px').toLowerCase()) {
    case 'mm':
      return v
    case 'cm':
      return v * 10
    case 'in':
      return v * 25.4
    case 'pt':
      return (v * 25.4) / 72
    case 'pc':
      return (v * 25.4) / 6
    case '%':
      return null // resolved by caller against viewport
    default:
      return v / PX_PER_MM
  }
}

// ---------- path data flattening ----------

/** Tokenize an SVG path 'd' attribute into commands + number args. */function tokenizePath(d: string): (string | number)[] {
  const out: (string | number)[] = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?[\d.]+(?:[eE][-+]?\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) {
    if (m[1]) out.push(m[1])
    else {
      const n = Number(m[2])
      if (!Number.isNaN(n)) out.push(n)
    }
  }
  return out
}

function flattenPath(d: string): Pt[][] {
  const tok = tokenizePath(d)
  const subpaths: Pt[][] = []
  let cur: Pt[] = []
  let pos: Pt = { x: 0, y: 0 }
  let start: Pt = { x: 0, y: 0 }
  let prevCtrl: Pt | null = null // last cubic/quadratic control point (for S/T)
  let prevCtrlKind: 'cubic' | 'quad' | null = null
  let i = 0
  let cmd = ''

  const num = (): number => {
    const v = tok[i]
    i++
    return typeof v === 'number' ? v : Number(v)
  }
  const flush = () => {
    if (cur.length > 0) {
      subpaths.push(cur)
      cur = []
    }
  }
  const lineTo = (x: number, y: number) => {
    pos = { x, y }
    cur.push(pos)
  }
  const cubicTo = (c1: Pt, c2: Pt, p: Pt) => {
    const segs = 24
    for (let s = 1; s <= segs; s++) {
      const t = s / segs
      const mt = 1 - t
      cur.push({
        x: mt * mt * mt * pos.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p.x,
        y: mt * mt * mt * pos.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p.y,
      })
    }
    pos = p
    prevCtrl = c2
    prevCtrlKind = 'cubic'
  }
  const quadTo = (c: Pt, p: Pt) => {
    const segs = 18
    for (let s = 1; s <= segs; s++) {
      const t = s / segs
      const mt = 1 - t
      cur.push({
        x: mt * mt * pos.x + 2 * mt * t * c.x + t * t * p.x,
        y: mt * mt * pos.y + 2 * mt * t * c.y + t * t * p.y,
      })
    }
    pos = p
    prevCtrl = c
    prevCtrlKind = 'quad'
  }
  const arcTo = (
    rx: number,
    ry: number,
    rotDeg: number,
    largeArc: number,
    sweep: number,
    p: Pt,
  ) => {
    // Endpoint → center parameterization (SVG spec F.6), then sample.
    if (pos.x === p.x && pos.y === p.y) return
    rx = Math.abs(rx)
    ry = Math.abs(ry)
    if (rx === 0 || ry === 0) {
      lineTo(p.x, p.y)
      return
    }
    const phi = (rotDeg * Math.PI) / 180
    const cosP = Math.cos(phi)
    const sinP = Math.sin(phi)
    const dx2 = (pos.x - p.x) / 2
    const dy2 = (pos.y - p.y) / 2
    const x1p = cosP * dx2 + sinP * dy2
    const y1p = -sinP * dx2 + cosP * dy2
    let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if (lambda > 1) {
      const s = Math.sqrt(lambda)
      rx *= s
      ry *= s
      lambda = 1
    }
    const sign = largeArc !== sweep ? 1 : -1
    const denom = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    const numer = Math.max(0, rx * rx * ry * ry - denom)
    const coef = denom === 0 ? 0 : sign * Math.sqrt(numer / denom)
    const cxp = (coef * (rx * y1p)) / ry
    const cyp = (coef * (-ry * x1p)) / rx
    const cx = cosP * cxp - sinP * cyp + (pos.x + p.x) / 2
    const cy = sinP * cxp + cosP * cyp + (pos.y + p.y) / 2
    const ang = (ux: number, uy: number, vx: number, vy: number) => {
      const dot = ux * vx + uy * vy
      const len = Math.hypot(ux, uy) * Math.hypot(vx, vy)
      let a = Math.acos(Math.max(-1, Math.min(1, dot / len)))
      if (ux * vy - uy * vx < 0) a = -a
      return a
    }
    const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    let delta = ang(
      (x1p - cxp) / rx,
      (y1p - cyp) / ry,
      (-x1p - cxp) / rx,
      (-y1p - cyp) / ry,
    )
    if (!sweep && delta > 0) delta -= 2 * Math.PI
    if (sweep && delta < 0) delta += 2 * Math.PI
    const segs = Math.max(6, Math.ceil((Math.abs(delta) / Math.PI) * 24))
    for (let s = 1; s <= segs; s++) {
      const t = theta1 + (delta * s) / segs
      const cosT = Math.cos(t)
      const sinT = Math.sin(t)
      const x = cosP * rx * cosT - sinP * ry * sinT + cx
      const y = sinP * rx * cosT + cosP * ry * sinT + cy
      cur.push({ x, y })
    }
    // Ensure the endpoint lands exactly where requested.
    pos = { ...p }
    cur[cur.length - 1] = { ...p }
  }

  while (i < tok.length) {
    const t = tok[i]
    if (typeof t === 'string') {
      cmd = t
      i++
    } else if (cmd === '') {
      i++
      continue
    } else if (cmd === 'M') cmd = 'L'
    else if (cmd === 'm') cmd = 'l'

    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()

    switch (C) {
      case 'M': {
        const x = num()
        const y = num()
        flush()
        pos = rel ? { x: pos.x + x, y: pos.y + y } : { x, y }
        start = pos
        cur.push(pos)
        prevCtrl = null
        prevCtrlKind = null
        break
      }
      case 'L': {
        const x = num()
        const y = num()
        lineTo(rel ? pos.x + x : x, rel ? pos.y + y : y)
        prevCtrl = null
        prevCtrlKind = null
        break
      }
      case 'H': {
        const x = num()
        lineTo(rel ? pos.x + x : x, pos.y)
        prevCtrl = null
        prevCtrlKind = null
        break
      }
      case 'V': {
        const y = num()
        lineTo(pos.x, rel ? pos.y + y : y)
        prevCtrl = null
        prevCtrlKind = null
        break
      }
      case 'C': {
        const x1 = num()
        const y1 = num()
        const x2 = num()
        const y2 = num()
        const x = num()
        const y = num()
        const c1 = rel ? { x: pos.x + x1, y: pos.y + y1 } : { x: x1, y: y1 }
        const c2 = rel ? { x: pos.x + x2, y: pos.y + y2 } : { x: x2, y: y2 }
        const p = rel ? { x: pos.x + x, y: pos.y + y } : { x, y }
        cubicTo(c1, c2, p)
        break
      }
      case 'S': {
        const x2 = num()
        const y2 = num()
        const x = num()
        const y = num()
        // Smooth cubic: first control mirrors the previous cubic's second
        // control point; after any other command it degenerates to pos.
        // prevCtrl is mutated inside the helpers above (invisible to CFA),
        // so assert past TS's incorrect always-null narrowing.
        const pc = prevCtrl as Pt | null
        const c1 =
          pc && prevCtrlKind === 'cubic'
            ? { x: 2 * pos.x - pc.x, y: 2 * pos.y - pc.y }
            : { ...pos }
        const c2 = rel ? { x: pos.x + x2, y: pos.y + y2 } : { x: x2, y: y2 }
        const p = rel ? { x: pos.x + x, y: pos.y + y } : { x, y }
        cubicTo(c1, c2, p)
        break
      }
      case 'Q': {
        const x1 = num()
        const y1 = num()
        const x = num()
        const y = num()
        const c = rel ? { x: pos.x + x1, y: pos.y + y1 } : { x: x1, y: y1 }
        const p = rel ? { x: pos.x + x, y: pos.y + y } : { x, y }
        quadTo(c, p)
        break
      }
      case 'T': {
        const x = num()
        const y = num()
        const pq = prevCtrl as Pt | null
        const c =
          pq && prevCtrlKind === 'quad'
            ? { x: 2 * pos.x - pq.x, y: 2 * pos.y - pq.y }
            : { ...pos }
        const p = rel ? { x: pos.x + x, y: pos.y + y } : { x, y }
        quadTo(c, p)
        break
      }
      case 'A': {
        const rx = num()
        const ry = num()
        const rot = num()
        const large = num()
        const sweep = num()
        const x = num()
        const y = num()
        arcTo(rx, ry, rot, large, sweep, rel ? { x: pos.x + x, y: pos.y + y } : { x, y })
        prevCtrl = null
        prevCtrlKind = null
        break
      }
      case 'Z': {
        // Append the start point so the subpath is geometrically closed
        // (walk() detects closed via first==last).
        if (cur.length > 0) {
          const last = cur[cur.length - 1]
          if (Math.abs(last.x - start.x) > 1e-9 || Math.abs(last.y - start.y) > 1e-9) {
            cur.push({ ...start })
          }
        }
        flush()
        pos = start
        prevCtrl = null
        prevCtrlKind = null
        cmd = '' // no implicit repeat — a following number must start a new command
        break
      }
      default:
        i++
        break
    }
  }
  flush()
  // Drop degenerate subpaths (single points).
  return subpaths.filter((sp) => sp.length >= 2)
}

function rectPoints(x: number, y: number, w: number, h: number, rx: number, ry: number): Pt[] {
  if (rx <= 0 && ry <= 0) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]
  }
  rx = Math.min(rx > 0 ? rx : ry, w / 2)
  ry = Math.min(ry > 0 ? ry : rx, h / 2)
  const pts: Pt[] = []
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    const segs = 8
    for (let s = 0; s <= segs; s++) {
      const a = a0 + ((a1 - a0) * s) / segs
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
    }
  }
  arc(x + rx, y + ry, Math.PI, Math.PI * 1.5)
  arc(x + w - rx, y + ry, Math.PI * 1.5, Math.PI * 2)
  arc(x + w - rx, y + h - ry, 0, Math.PI / 2)
  arc(x + rx, y + h - ry, Math.PI / 2, Math.PI)
  return pts
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const segs = 72
  const pts: Pt[] = []
  for (let s = 0; s < segs; s++) {
    const a = (s / segs) * Math.PI * 2
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
  }
  return pts
}

function parsePointsAttr(raw: string): Pt[] {
  const nums = raw
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  const pts: Pt[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] })
  return pts
}

// ---------- document walk ----------

interface CollectCtx {
  subpaths: { pts: Pt[]; closed: boolean }[]
  warnings: string[]
  hasText: boolean
}

const SHAPE_TAGS = new Set(['path', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'line'])

function walk(el: Element, parent: Mat, ctx: CollectCtx): void {
  const m = mul(parent, parseTransform(el.getAttribute('transform')))
  const tag = el.tagName.toLowerCase().replace(/^.*:/, '')

  if (tag === 'text' || tag === 'tspan') {
    ctx.hasText = true
    return
  }

  if (SHAPE_TAGS.has(tag)) {
    let raw: { pts: Pt[]; closed: boolean }[] = []
    switch (tag) {
      case 'path': {
        const d = el.getAttribute('d')
        if (d) {
          raw = flattenPath(d).map((pts) => {
            const first = pts[0]
            const last = pts[pts.length - 1]
            const closed =
              Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6 && pts.length > 2
            return { pts, closed }
          })
        }
        break
      }
      case 'polyline': {
        const pts = parsePointsAttr(el.getAttribute('points') ?? '')
        if (pts.length >= 2) raw = [{ pts, closed: false }]
        break
      }
      case 'polygon': {
        const pts = parsePointsAttr(el.getAttribute('points') ?? '')
        if (pts.length >= 2) raw = [{ pts, closed: true }]
        break
      }
      case 'rect': {
        const x = Number(el.getAttribute('x') ?? 0)
        const y = Number(el.getAttribute('y') ?? 0)
        const w = Number(el.getAttribute('width') ?? 0)
        const h = Number(el.getAttribute('height') ?? 0)
        if (w > 0 && h > 0) {
          const rx = Number(el.getAttribute('rx') ?? 0) || 0
          const ry = Number(el.getAttribute('ry') ?? 0) || 0
          raw = [{ pts: rectPoints(x, y, w, h, rx, ry), closed: true }]
        }
        break
      }
      case 'circle': {
        const r = Number(el.getAttribute('r') ?? 0)
        if (r > 0)
          raw = [
            { pts: ellipsePoints(Number(el.getAttribute('cx') ?? 0), Number(el.getAttribute('cy') ?? 0), r, r), closed: true },
          ]
        break
      }
      case 'ellipse': {
        const rx = Number(el.getAttribute('rx') ?? 0)
        const ry = Number(el.getAttribute('ry') ?? 0)
        if (rx > 0 && ry > 0)
          raw = [
            {
              pts: ellipsePoints(Number(el.getAttribute('cx') ?? 0), Number(el.getAttribute('cy') ?? 0), rx, ry),
              closed: true,
            },
          ]
        break
      }
      case 'line': {
        const pts = [
          { x: Number(el.getAttribute('x1') ?? 0), y: Number(el.getAttribute('y1') ?? 0) },
          { x: Number(el.getAttribute('x2') ?? 0), y: Number(el.getAttribute('y2') ?? 0) },
        ]
        raw = [{ pts, closed: false }]
        break
      }
    }
    for (const sp of raw) {
      if (sp.pts.length >= 2) {
        ctx.subpaths.push({ pts: sp.pts.map((p) => apply(m, p.x, p.y)), closed: sp.closed })
      }
    }
    return
  }

  // Container elements (svg, g, a, switch, ...) — recurse.
  for (let i = 0; i < el.children.length; i++) {
    walk(el.children[i], m, ctx)
  }
}

// ---------- entry point ----------

export function parseSvg(svgText: string): SvgImportResult | SvgImportError {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  } catch {
    return { ok: false, error: 'Could not parse the SVG document.' }
  }
  if (doc.querySelector('parsererror')) {
    return { ok: false, error: 'The SVG file is malformed (XML parse error).' }
  }
  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase().replace(/^.*:/, '') !== 'svg') {
    return { ok: false, error: 'The file is not an SVG document.' }
  }

  // --- viewBox / intrinsic size → mm scale ---
  const vbRaw = (root.getAttribute('viewBox') ?? '').replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  const vb = vbRaw.map(Number)
  const hasViewBox = vb.length === 4 && vb.every((n) => !Number.isNaN(n)) && vb[2] > 0 && vb[3] > 0
  const wAttr = lengthToMm(root.getAttribute('width'))

  // Width in user units: viewBox width when present, else physical px size.
  const vbW = hasViewBox ? vb[2] : wAttr != null && wAttr > 0 ? wAttr * PX_PER_MM : 300

  // mm per user unit: prefer explicit physical width, else assume px@96dpi.
  let mmPerUnit: number
  if (wAttr != null && wAttr > 0) mmPerUnit = wAttr / vbW
  else mmPerUnit = 1 / PX_PER_MM

  const ctx: CollectCtx = { subpaths: [], warnings: [], hasText: false }
  walk(root, IDENT, ctx)

  if (ctx.subpaths.length === 0) {
    return {
      ok: false,
      error: ctx.hasText
        ? 'No cut paths found — the SVG contains only text. Convert text to outlines in your SVG editor and re-import.'
        : 'No cut paths found in this SVG (only fills/unsupported elements).',
    }
  }

  // --- user-unit → mm, flip y (SVG y-down → machine y-up), center at origin ---
  const mmPaths: Pt[][] = ctx.subpaths.map((sp) =>
    sp.pts.map((p) => ({ x: p.x * mmPerUnit, y: -p.y * mmPerUnit })),
  )
  const closed = ctx.subpaths.map((sp) => sp.closed)
  const bounds = pathsBounds(mmPaths)

  if (!Number.isFinite(bounds.w) || !Number.isFinite(bounds.h) || bounds.w <= 0) {
    return { ok: false, error: 'The SVG geometry has zero width — nothing to engrave.' }
  }

  // Center on the bounds midpoint so imports land on the bed origin.
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  const centered = mmPaths.map((path) => path.map((p) => ({ x: p.x - cx, y: p.y - cy })))

  const geometry: TemplateGeometry = {
    paths: centered,
    closed,
    bounds: pathsBounds(centered),
    note: `Imported SVG · ${centered.length} path(s)`,
  }

  if (ctx.hasText) ctx.warnings.push('Text elements skipped — outline text before import.')

  return {
    ok: true,
    geometry,
    naturalWidthMm: geometry.bounds.w,
    naturalHeightMm: geometry.bounds.h,
    warnings: ctx.warnings,
  }
}
