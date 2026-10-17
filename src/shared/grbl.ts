// GRBL 1.1 status / message parsing helpers.
import type { GrblStatus } from './types'

const NUM = '-?\\d*\\.?\\d+'

function parseCoordTriple(src: string, key: string): { x: number; y: number; z: number } | null {
  const re = new RegExp(`${key}:(${NUM}),(${NUM}),(${NUM})`)
  const m = src.match(re)
  if (!m) return null
  return { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) }
}

/**
 * Parse a GRBL realtime status report like:
 *   <Idle|MPos:0.000,0.000,0.000|WPos:0.000,0.000,0.000|FS:0,0|WCO:0.000,0.000,0.000>
 * Returns null if the input isn't a status report.
 */
export function parseStatus(line: string): GrblStatus | null {
  const s = line.trim()
  if (!s.startsWith('<') || !s.endsWith('>')) return null
  const body = s.slice(1, -1)
  const parts = body.split('|')
  const state = parts[0] ? parts[0].split(':')[0] : 'Unknown'

  const mpos = parseCoordTriple(body, 'MPos') ?? { x: 0, y: 0, z: 0 }
  const wpos = parseCoordTriple(body, 'WPos') ?? { x: 0, y: 0, z: 0 }

  let feed = 0
  let speed = 0
  const fs = body.match(new RegExp(`FS:(${NUM})(?:,(${NUM}))?`))
  if (fs) {
    feed = parseFloat(fs[1])
    speed = fs[2] ? parseFloat(fs[2]) : 0
  }

  let buffer: GrblStatus['buffer'] | undefined
  const bf = body.match(/Bf:(\d+),(\d+)/)
  if (bf) buffer = { planner: parseInt(bf[1], 10), rx: parseInt(bf[2], 10) }

  let overrides: GrblStatus['overrides'] | undefined
  const ov = body.match(/Ov:(\d+),(\d+),(\d+)/)
  if (ov) {
    overrides = {
      feed: parseInt(ov[1], 10),
      rapid: parseInt(ov[2], 10),
      spindle: parseInt(ov[3], 10),
    }
  }

  return { state, mpos, wpos, feed, speed, buffer, overrides, raw: s }
}

/**
 * If WPos isn't provided but WCO is, derive WPos = MPos - WCO.
 * GRBL is configured (via $10=0) to report MPos + WCO, so compute WPos here.
 */
export function applyWco(status: GrblStatus, body: string): GrblStatus {
  const wco = parseCoordTriple(body, 'WCO')
  if (!wco) return status
  return {
    ...status,
    wpos: {
      x: status.mpos.x - wco.x,
      y: status.mpos.y - wco.y,
      z: status.mpos.z - wco.z,
    },
  }
}

/** True if a line is a GRBL `ok` response. */
export function isOk(line: string): boolean {
  return /^ok\s*$/i.test(line.trim())
}

/** True if a line is a GRBL `error:N` response. */
export function isError(line: string): boolean {
  return /^error:/i.test(line.trim())
}

/** Human friendly GRBL error description (subset commonly hit). */
export const GRBL_ERRORS: Record<string, string> = {
  'error:1': 'Command invalid in current state',
  'error:9': 'G-code locked out during alarm or jog',
  'error:20': 'Unsupported or invalid g-code command',
  'error:33': 'Feed rate undefined / invalid',
  'error:38': 'Laser mode requires a laser-enabled command',
  'error:46': 'Homing cycle not enabled ($22)',
}

export function describeError(line: string): string {
  const m = line.match(/error:(\d+)/i)
  if (!m) return line
  const code = m[1]
  return GRBL_ERRORS[`error:${code}`] ?? `GRBL error:${code}`
}

/** Realtime control characters used by GRBL 1.1. */
export const RT = {
  STATUS: '?', // 0x3F
  FEED_HOLD: '!', // 0x21
  CYCLE_START: '~', // 0x7E
  SOFT_RESET: '\x18', // 0x18  Ctrl-X
} as const

/** Convert a percentage (0-100) to GRBL spindle S value for 30=1000 max. */
export function powerToS(percent: number): number {
  const p = Math.max(0, Math.min(100, percent))
  return Math.round((p / 100) * 1000)
}
