// Text to vector path conversion for engraving text/names.
// Uses a simple built-in font (Hershey-style) to generate G-code paths.

import type { Pt } from './texasPath'

// Simple stroke font data - each character is a series of strokes
// Format: { char: 'A', strokes: [[[x1,y1], [x2,y2], ...], ...] }
// Coordinates are in a 100x100 unit box, origin at bottom-left of char
const FONT_STROKES: Record<string, number[][][]> = {
  'A': [[[10, 0], [50, 100], [90, 0]], [[25, 50], [75, 50]]],
  'B': [[[10, 0], [10, 100]], [[10, 0], [70, 0], [90, 20], [90, 40], [70, 50], [10, 50]], [[10, 50], [70, 50], [90, 70], [90, 90], [70, 100], [10, 100]]],
  'C': [[[90, 90], [10, 90], [10, 10], [90, 10]]],
  'D': [[[10, 0], [10, 100]], [[10, 0], [80, 0], [90, 10], [90, 90], [80, 100], [10, 100]]],
  'E': [[[90, 0], [10, 0]], [[90, 50], [10, 50]], [[90, 100], [10, 100]], [[10, 0], [10, 100]]],
  'F': [[[90, 0], [10, 0], [10, 100]], [[10, 50], [70, 50]]],
  'G': [[[90, 90], [10, 90], [10, 10], [60, 10]], [[60, 10], [60, 50], [90, 50]]],
  'H': [[[10, 0], [10, 100]], [[90, 0], [90, 100]], [[10, 50], [90, 50]]],
  'I': [[[50, 0], [50, 100]], [[10, 0], [90, 0]], [[10, 100], [90, 100]]],
  'J': [[[90, 90], [90, 20], [70, 0], [30, 0], [10, 20], [10, 10]]],
  'K': [[[10, 0], [10, 100]], [[10, 50], [90, 100]], [[10, 50], [90, 0]]],
  'L': [[[10, 100], [10, 0], [90, 0]]],
  'M': [[[10, 0], [10, 100]], [[10, 100], [50, 0], [90, 100]], [[90, 0], [90, 100]]],
  'N': [[[10, 100], [10, 0], [90, 100]], [[90, 0], [90, 100]]],
  'O': [[[50, 95], [15, 80], [10, 50], [15, 20], [50, 5], [85, 20], [90, 50], [85, 80], [50, 95]]],
  'P': [[[10, 0], [10, 100]], [[10, 0], [80, 0], [90, 20], [90, 50], [80, 50], [10, 50]]],
  'Q': [[[50, 95], [15, 80], [10, 50], [15, 20], [50, 5], [85, 20], [90, 50], [85, 80], [50, 95]], [[60, 60], [90, 30]]],
  'R': [[[10, 0], [10, 100]], [[10, 0], [80, 0], [90, 20], [90, 50], [80, 50], [10, 50]], [[50, 50], [90, 100]]],
  'S': [[[90, 90], [10, 90], [10, 55], [80, 55], [80, 50], [10, 50], [10, 10], [90, 10]]],
  'T': [[[50, 100], [50, 0]], [[10, 100], [90, 100]]],
  'U': [[[10, 100], [10, 20], [50, 0], [90, 20], [90, 100]]],
  'V': [[[10, 100], [50, 0], [90, 100]]],
  'W': [[[10, 100], [30, 0], [50, 60], [70, 0], [90, 100]]],
  'X': [[[10, 100], [90, 0]], [[10, 0], [90, 100]]],
  'Y': [[[10, 100], [50, 50], [90, 100]], [[50, 50], [50, 0]]],
  'Z': [[[10, 100], [90, 100]], [[90, 100], [10, 0]], [[10, 0], [90, 0]]],
  '0': [[[20, 80], [10, 50], [20, 20], [80, 20], [90, 50], [80, 80], [20, 80]]],
  '1': [[[50, 100], [50, 0]], [[30, 100], [50, 80]]],
  '2': [[[10, 90], [90, 90], [90, 55], [10, 55], [10, 10], [90, 10]]],
  '3': [[[90, 90], [10, 90], [90, 50], [10, 50], [90, 10], [10, 10]]],
  '4': [[[10, 90], [10, 50], [90, 50]], [[90, 90], [90, 0]]],
  '5': [[[90, 90], [10, 90], [10, 50], [90, 50], [90, 10], [10, 10]]],
  '6': [[[90, 90], [10, 90], [10, 10], [90, 10], [90, 50], [10, 50]]],
  '7': [[[10, 100], [90, 100], [20, 0]]],
  '8': [[[50, 90], [10, 70], [10, 30], [50, 10], [90, 30], [90, 70], [50, 90]], [[50, 50], [10, 50], [90, 50]]],
  '9': [[[10, 10], [90, 10], [90, 90], [10, 90], [10, 50], [90, 50]]],
  ' ': [],
  '.': [[[45, 15], [55, 15], [55, 5], [45, 5], [45, 15]]],
  ',': [[[45, 20], [55, 10], [45, 10], [40, 20], [45, 20]]],
  '-': [[[10, 50], [90, 50]]],
  "'": [[[50, 90], [45, 80], [55, 80], [50, 90]]],
  '!': [[[50, 90], [50, 15]], [[45, 5], [55, 5], [55, 15], [45, 15], [45, 5]]],
  '?': [[[80, 90], [60, 90], [30, 60], [30, 40], [50, 40]], [[45, 15], [55, 15], [55, 5], [45, 5], [45, 15]]],
  ':': [[[50, 65], [50, 55]], [[50, 35], [50, 25]]],
  ';': [[[50, 65], [50, 55]], [[45, 20], [55, 10], [45, 10], [40, 20], [45, 20]]],
  '(': [[[60, 90], [20, 50], [60, 10]]],
  ')': [[[20, 90], [60, 50], [20, 10]]],
  '&': [[[70, 50], [50, 80], [30, 50], [50, 20], [70, 50]], [[30, 50], [10, 80]]],
  '@': [[[50, 30], [20, 50], [20, 90], [50, 70], [80, 90], [80, 50], [50, 30]], [[50, 70], [80, 70]]],
  '#': [[[15, 100], [15, 0]], [[85, 100], [85, 0]], [[10, 40], [90, 40]], [[10, 70], [90, 70]]],
  '$': [[[50, 100], [50, 0]], [[80, 90], [20, 90], [20, 60], [80, 60], [80, 30], [20, 30], [20, 10], [80, 10]]],
  '%': [[[90, 90], [10, 10]], [[90, 90], [90, 80], [70, 80], [50, 50], [30, 20], [10, 20], [10, 10]], [[10, 10], [10, 20], [30, 50], [50, 80], [70, 80], [90, 80], [90, 90]]],
  '+': [[[50, 10], [50, 90]], [[10, 50], [90, 50]]],
  '=': [[[10, 70], [90, 70]], [[10, 30], [90, 30]]],
  '/': [[[90, 100], [10, 0]]],
  '\\': [[[10, 100], [90, 0]]],
  '|': [[[50, 100], [50, 0]]],
  '_': [[[10, 10], [90, 10]]],
  '~': [[[10, 50], [30, 90], [50, 10], [70, 90], [90, 10]]],
  '^': [[[10, 50], [50, 90], [90, 50]]],
  '*': [[[50, 10], [50, 90]], [[10, 50], [90, 50]], [[10, 90], [90, 10]], [[10, 10], [90, 90]]],
  '"': [[[30, 90], [20, 80], [30, 70]], [[70, 90], [60, 80], [70, 70]]],
  '<': [[[90, 50], [10, 90], [90, 10]]],
  '>': [[[10, 50], [90, 90], [10, 10]]],
  '{': [[[50, 90], [10, 90], [50, 50], [10, 10], [50, 10]]],
  '}': [[[10, 90], [50, 90], [10, 50], [50, 10], [10, 10]]],
  '[': [[[20, 100], [20, 0]], [[10, 100], [10, 0]], [[10, 100], [30, 100]], [[10, 0], [30, 0]]],
  ']': [[[80, 100], [80, 0]], [[90, 100], [90, 0]], [[70, 100], [90, 100]], [[70, 0], [90, 0]]],
  'a': [[[10, 50], [10, 10], [30, 10], [50, 50], [50, 10], [70, 10], [70, 50], [50, 50], [30, 10]]],
  'b': [[[10, 90], [10, 10]], [[10, 50], [50, 50], [70, 30], [70, 10], [50, 10], [10, 10]]],
  'c': [[[70, 50], [10, 50], [10, 10], [70, 10]]],
  'd': [[[70, 90], [70, 10]], [[70, 50], [30, 50], [10, 30], [10, 10], [30, 10], [70, 10]]],
  'e': [[[70, 30], [10, 30], [10, 50], [70, 50], [70, 10], [10, 10]]],
  'f': [[[30, 90], [30, 10]], [[10, 60], [50, 60]], [[10, 10], [50, 10]]],
  'g': [[[70, 50], [10, 50], [10, 10], [70, 10], [70, -20], [50, -20], [30, 10], [10, 10]]],
  'h': [[[10, 90], [10, 10]], [[10, 50], [70, 50], [70, 10], [70, 90]]],
  'i': [[[50, 70], [50, 10]], [[50, 90], [50, 80]]],
  'j': [[[50, 90], [50, -20], [30, -40], [10, -20]], [[50, 70], [50, 60]]],
  'k': [[[10, 90], [10, 10]], [[10, 50], [70, 90]], [[10, 50], [70, 10]]],
  'l': [[[50, 90], [50, 10]]],
  'm': [[[10, 50], [10, 10], [50, 10], [50, 50], [30, 50], [30, 10], [70, 10], [70, 50]]],
  'n': [[[10, 50], [10, 10], [50, 10], [50, 50], [30, 50]]],
  'o': [[[50, 50], [10, 50], [10, 10], [50, 10], [70, 30], [70, 50], [50, 50]]],
  'p': [[[10, 50], [10, -20]], [[10, 50], [50, 50], [70, 30], [70, 10], [50, 10], [10, 10]]],
  'q': [[[70, 50], [70, -20]], [[70, 50], [30, 50], [10, 30], [10, 10], [30, 10], [70, 10]]],
  'r': [[[10, 50], [10, 10]], [[10, 30], [50, 30], [70, 50]]],
  's': [[[70, 50], [10, 50], [10, 30], [70, 30], [70, 10], [10, 10]]],
  't': [[[30, 70], [30, 10]], [[10, 70], [50, 70]], [[10, 10], [50, 10]]],
  'u': [[[10, 50], [10, 10], [50, 10], [50, 50], [70, 50], [70, 10], [90, 10], [90, 50]]],
  'v': [[[10, 50], [50, 10], [90, 50]]],
  'w': [[[10, 50], [30, 10], [50, 50], [70, 10], [90, 50]]],
  'x': [[[10, 50], [90, 10]], [[10, 10], [90, 50]]],
  'y': [[[10, 50], [50, 10], [90, 50], [90, -20], [70, -20], [50, 10]]],
  'z': [[[10, 50], [90, 50], [10, 10], [90, 10]]],
}

export interface TextToPathOptions {
  /** Text to convert */
  text: string
  /** Font size in mm (cap height) */
  size: number
  /** Letter spacing multiplier (1.0 = normal) */
  letterSpacing?: number
  /** Line spacing multiplier (1.0 = normal) */
  lineSpacing?: number
  /** Center the text at origin */
  center?: boolean
  /** Origin mode: 'center' or 'corner' */
  originMode?: 'center' | 'corner'
  /** Max width in mm (wraps text) */
  maxWidth?: number
}

export interface TextPathResult {
  paths: Pt[][]
  closed: boolean[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number }
  lines: string[]
}

/** Convert text to vector paths for laser engraving */
export function textToPaths(options: TextToPathOptions): TextPathResult {
  const {
    text,
    size,
    letterSpacing = 1.0,
    lineSpacing = 1.2,
    center = true,
    originMode = 'center',
    maxWidth,
  } = options

  const charWidth = size * 0.6 // approximate character width
  const charHeight = size
  const spaceWidth = charWidth * 0.3
  const scale = size / 100 // font units are 100x100

  const lines = text.split('\n')
  const allPaths: Pt[][] = []
  const allClosed: boolean[] = []

  let cursorX = 0
  let cursorY = 0
  const lineHeight = charHeight * lineSpacing

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    cursorX = 0

    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const ch = line[charIdx]
      const upperCh = ch.toUpperCase()
      const strokes = FONT_STROKES[upperCh] || FONT_STROKES['?'] || []

      // Check if we need to wrap
      if (maxWidth && cursorX + charWidth > maxWidth) {
        cursorX = 0
        cursorY -= lineHeight
        // Re-process this character on the new line
        charIdx--
        continue
      }

      for (const stroke of strokes) {
        const path: Pt[] = stroke.map(([x, y]) => ({
          x: (cursorX + x * scale) + (originMode === 'center' ? 0 : 0),
          y: (cursorY + y * scale) + (originMode === 'center' ? 0 : 0),
        }))
        if (path.length >= 2) {
          allPaths.push(path)
          allClosed.push(false) // text strokes are open paths
        }
      }

      cursorX += charWidth * letterSpacing
      if (ch === ' ') cursorX += spaceWidth * letterSpacing
    }

    cursorY -= lineHeight
  }

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const path of allPaths) {
    for (const pt of path) {
      if (pt.x < minX) minX = pt.x
      if (pt.x > maxX) maxX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.y > maxY) maxY = pt.y
    }
  }

  if (minX === Infinity) {
    minX = minY = maxX = maxY = 0
  }

  // Center if requested
  if (center) {
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    for (const path of allPaths) {
      for (const pt of path) {
        pt.x -= cx
        pt.y -= cy
      }
    }
    minX -= cx
    maxX -= cx
    minY -= cy
    maxY -= cy
  }

  return {
    paths: allPaths,
    closed: allClosed,
    bounds: { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY },
    lines: lines,
  }
}

/** Generate G-code for text engraving */
export interface TextGcodeOptions {
  text: string
  size: number // mm
  speed: number // mm/min
  powerPercent: number
  passes: number
  zStep?: number
  travelHeight?: number
  dpi?: number
  letterSpacing?: number
  lineSpacing?: number
  center?: boolean
  originMode?: 'center' | 'corner'
  maxWidth?: number
  originAtStart?: boolean
}

export function generateTextGcode(options: TextGcodeOptions): string[] {
  const {
    text,
    size,
    speed,
    powerPercent,
    passes,
    zStep = 0,
    travelHeight = 0,
    letterSpacing = 1.0,
    lineSpacing = 1.2,
    center = true,
    originMode = 'center',
    maxWidth,
    originAtStart = true,
  } = options

  const s = Math.round((Math.max(0, Math.min(100, powerPercent)) / 100) * 1000)

  const result = textToPaths({
    text,
    size,
    letterSpacing,
    lineSpacing,
    center,
    originMode,
    maxWidth,
  })

  const lines: string[] = []
  lines.push('; LazeAway text engraving')
  lines.push(`; Text: "${text.replace(/\n/g, '\\n')}"`)
  lines.push(`; Size: ${size}mm, Speed: ${speed}mm/min, Power: ${powerPercent}%, Passes: ${passes}`)
  lines.push('; Workspace center origin: 0,0 = bed center.')
  lines.push('G90 G21')
  if (originAtStart) lines.push('G92 X0 Y0')
  lines.push(`M4 S${s}`)

  for (let pass = 0; pass < passes; pass++) {
    const z = travelHeight - zStep * pass
    lines.push(`; pass ${pass + 1}/${passes}  Z=${z.toFixed(3)}`)
    lines.push('M5')
    lines.push(`G0 Z${z.toFixed(3)}`)

    for (let i = 0; i < result.paths.length; i++) {
      const path = result.paths[i]
      if (path.length === 0) continue
      const start = path[0]
      lines.push('M5')
      lines.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`)
      lines.push(`M4 S${s}`)
      lines.push(`G1 F${speed.toFixed(0)}`)
      for (let j = 1; j < path.length; j++) {
        const p = path[j]
        lines.push(`G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`)
      }
    }
  }

  lines.push('M5')
  lines.push(`G0 Z${travelHeight.toFixed(3)}`)
  lines.push('G0 X0 Y0')
  lines.push('; done')
  return lines
}

/** Quick estimate for text engraving */
export function estimateTextEngraving(text: string, size: number, dpi: number = 300): { width: number; height: number; approxLines: number } {
  const charWidth = size * 0.6
  const charHeight = size
  const lineHeight = charHeight * 1.2
  const lines = text.split('\n')
  
  let maxLineWidth = 0
  for (const line of lines) {
    const w = line.length * charWidth * 1.0
    if (w > maxLineWidth) maxLineWidth = w
  }
  
  const height = lines.length * lineHeight
  const interval = 25.4 / dpi
  const scanlines = Math.ceil(height / interval)
  const approxLines = scanlines * 3 // rough estimate
  
  return { width: maxLineWidth, height, approxLines }
}