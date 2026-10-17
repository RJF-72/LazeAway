// Shared types between Electron main (Node) and renderer (browser).
// Kept dependency-free so both sides can import it.

export interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  vendorId?: string
  productId?: string
  friendlyName?: string
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export interface GrblStatus {
  state: string // Idle, Run, Hold, Alarm, Door, Check, Home, Tool, Busy
  mpos: { x: number; y: number; z: number }
  wpos: { x: number; y: number; z: number }
  feed: number
  speed: number
  buffer?: { planner: number; rx: number }
  overrides?: { feed: number; rapid: number; spindle: number }
  raw: string
}

export interface StreamProgress {
  sent: number
  total: number
  running: boolean
  paused: boolean
  done: boolean
  error: string | null
  startedAt: number | null
}

export type LogDirection = 'rx' | 'tx' | 'info' | 'error' | 'realtime'

export interface SerialLogEntry {
  line: string
  dir: LogDirection
  t: number
}

// IPC surface exposed on window.laser by the preload script.
export interface LaserApi {
  listPorts(): Promise<PortInfo[]>
  connect(path: string, baudRate?: number): Promise<{ ok: boolean; error?: string }>
  disconnect(): Promise<void>
  isConnected(): Promise<boolean>

  // Send a single G-code line (appends \n). Await resolves when written.
  send(line: string): Promise<void>
  // Send several lines in order with a small gap.
  sendLines(lines: string[], gapMs?: number): Promise<void>
  // Realtime GRBL character (?, !, ~, 0x18, 0x21, 0x24 ...). Sent raw, no newline.
  sendRealtime(char: string): Promise<void>

  // Streaming a whole job
  streamStart(lines: string[]): Promise<void>
  streamPause(): Promise<void>
  streamResume(): Promise<void>
  streamStop(): Promise<void>

  // Event subscriptions (return unsubscribe fn)
  onLine(cb: (entry: SerialLogEntry) => void): () => void
  onStatus(cb: (status: GrblStatus | null) => void): () => void
  onState(cb: (state: ConnectionState) => void): () => void
  onProgress(cb: (progress: StreamProgress) => void): () => void

  platform: string
}

declare global {
  interface Window {
    laser: LaserApi
  }
}
