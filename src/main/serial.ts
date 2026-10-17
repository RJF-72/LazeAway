// Serial + GRBL streaming manager (Node side).
// Owns the COM port, parses realtime status, and streams G-code with a
// bounded in-flight window so the 128-byte GRBL RX buffer never overflows.
import { SerialPort } from 'serialport'
import { parseStatus, isOk, isError, describeError, RT } from '../shared/grbl'
import { CONNECT_SEQUENCE } from '../shared/connectSequence'
import type {
  PortInfo,
  GrblStatus,
  SerialLogEntry,
  ConnectionState,
  StreamProgress,
  LogDirection,
} from '../shared/types'

export const BAUD_RATE = 115200

// Settings applied automatically on connect live in shared/connectSequence.ts
// (so the renderer can re-run the same sequence on demand).

const MAX_IN_FLIGHT = 15 // max unacknowledged lines
const MAX_IN_FLIGHT_BYTES = 90 // keep total unacked bytes < 128 RX buffer

type Cb<T> = (v: T) => void

export class SerialManager {
  private port: SerialPort | null = null
  private rxBuffer = ''
  private state: ConnectionState = 'disconnected'
  private lastStatus: GrblStatus | null = null

  private lineCbs = new Set<Cb<SerialLogEntry>>()
  private statusCbs = new Set<Cb<GrblStatus | null>>()
  private stateCbs = new Set<Cb<ConnectionState>>()
  private progressCbs = new Set<Cb<StreamProgress>>()

  private pollTimer: ReturnType<typeof setInterval> | null = null
  private pollIntervalMs = 500

  // Streaming state
  private streaming = false
  private queue: string[] = []
  private total = 0
  private index = 0
  private inFlight = 0
  private inFlightBytes = 0
  private inFlightSizes: number[] = []
  private paused = false
  private stopped = false
  private startedAt: number | null = null
  private lastError: string | null = null

  // ---- Events ----
  onLine(cb: Cb<SerialLogEntry>) {
    this.lineCbs.add(cb)
    return () => this.lineCbs.delete(cb)
  }
  onStatus(cb: Cb<GrblStatus | null>) {
    this.statusCbs.add(cb)
    return () => this.statusCbs.delete(cb)
  }
  onState(cb: Cb<ConnectionState>) {
    this.stateCbs.add(cb)
    return () => this.stateCbs.delete(cb)
  }
  onProgress(cb: Cb<StreamProgress>) {
    this.progressCbs.add(cb)
    return () => this.progressCbs.delete(cb)
  }

  private emitLine(line: string, dir: LogDirection) {
    const entry: SerialLogEntry = { line, dir, t: Date.now() }
    this.lineCbs.forEach((cb) => cb(entry))
  }
  private emitState(s: ConnectionState) {
    this.state = s
    this.stateCbs.forEach((cb) => cb(s))
  }
  private emitStatus(s: GrblStatus | null) {
    this.lastStatus = s
    this.statusCbs.forEach((cb) => cb(s))
  }
  private emitProgress() {
    const p: StreamProgress = {
      sent: this.index,
      total: this.total,
      running: this.streaming && !this.paused && !this.stopped,
      paused: this.paused,
      done: !this.streaming && this.total > 0 && this.index >= this.total,
      error: this.lastError,
      startedAt: this.startedAt,
    }
    this.progressCbs.forEach((cb) => cb(p))
  }

  // ---- Ports ----
  async listPorts(): Promise<PortInfo[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => {
      // `friendlyName` exists at runtime on Windows but isn't in the public
      // serialport type, so read it defensively.
      const friendly = (p as unknown as { friendlyName?: string }).friendlyName
      return {
        path: p.path,
        manufacturer: p.manufacturer,
        serialNumber: p.serialNumber,
        vendorId: p.vendorId,
        productId: p.productId,
        friendlyName: friendly ?? p.manufacturer,
      }
    })
  }

  isConnected(): boolean {
    return !!this.port?.isOpen
  }

  // ---- Connect / disconnect ----
  async connect(path: string, baudRate = BAUD_RATE): Promise<{ ok: boolean; error?: string }> {
    if (this.port?.isOpen) await this.disconnect()
    this.emitState('connecting')
    return new Promise((resolve) => {
      const port = new SerialPort({ path, baudRate, autoOpen: false })
      port.open((err) => {
        if (err) {
          this.emitState('error')
          this.emitLine(`open failed: ${err.message}`, 'error')
          resolve({ ok: false, error: err.message })
          return
        }
        this.port = port
        this.attach(port)
        this.emitState('connected')
        this.emitLine(`connected ${path} @ ${baudRate}`, 'info')
        this.startPolling()
        // Run the unlock / config sequence shortly after open.
        setTimeout(() => {
          this.runConnectSequence().catch(() => {})
        }, 300)
        resolve({ ok: true })
      })
    })
  }

  private attach(port: SerialPort) {
    port.on('data', (buf: Buffer) => this.onData(buf))
    port.on('error', (e: Error) => {
      this.emitLine(`serial error: ${e.message}`, 'error')
    })
    port.on('close', () => {
      this.emitLine('port closed', 'info')
      this.stopPolling()
      this.emitState('disconnected')
      this.port = null
    })
  }

  private async runConnectSequence() {
    for (const cmd of CONNECT_SEQUENCE) {
      await this.write(cmd + '\n', 'tx')
      await delay(40)
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling()
    this.clearStream()
    const port = this.port
    if (!port) {
      this.emitState('disconnected')
      return
    }
    return new Promise((resolve) => {
      port.close(() => {
        this.port = null
        this.emitState('disconnected')
        this.emitLine('disconnected', 'info')
        resolve()
      })
    })
  }

  // ---- Low-level IO ----
  private write(data: string, dir: LogDirection = 'tx'): Promise<void> {
    const port = this.port
    if (!port?.isOpen) return Promise.resolve()
    return new Promise((resolve) => {
      port.write(data, (err) => {
        if (err) this.emitLine(`write error: ${err.message}`, 'error')
        port.drain(() => {
          if (dir === 'tx') this.emitLine(data.replace(/\r?\n$/, ''), dir)
          resolve()
        })
      })
    })
  }

  /** Send a normal G-code line (newline terminated). */
  async send(line: string): Promise<void> {
    const trimmed = line.trim()
    if (!trimmed) return
    await this.write(trimmed + '\n', 'tx')
  }

  /** Send several lines in order, waiting a short time between each. */
  async sendLines(lines: string[], gapMs = 30): Promise<void> {
    for (const l of lines) {
      await this.send(l)
      await delay(gapMs)
    }
  }

  /** Send a single realtime control character (no newline, no ok). */
  async sendRealtime(char: string): Promise<void> {
    const port = this.port
    if (!port?.isOpen) return
    const buf = Buffer.from(char, 'binary')
    await new Promise<void>((resolve) => {
      port.write(buf, () => {
        this.emitLine(`[RT] ${describeRt(char)}`, 'realtime')
        port.drain(() => resolve())
      })
    })
  }

  // ---- Status polling ----
  private startPolling() {
    this.stopPolling()
    this.pollTimer = setInterval(() => {
      if (!this.port?.isOpen) return
      // Poll faster while streaming / moving.
      const running =
        this.streaming || ['Run', 'Busy', 'Jog'].includes(this.lastStatus?.state ?? '')
      const want = running ? 200 : 500
      if (want !== this.pollIntervalMs) {
        this.pollIntervalMs = want
        this.restartPolling()
      }
      void this.sendRealtime(RT.STATUS)
    }, this.pollIntervalMs)
  }
  private restartPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.pollTimer = setInterval(() => {
      if (!this.port?.isOpen) return
      void this.sendRealtime(RT.STATUS)
    }, this.pollIntervalMs)
  }
  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  // ---- RX parsing ----
  private onData(buf: Buffer) {
    this.rxBuffer += buf.toString('utf8')
    let idx: number
    while ((idx = this.rxBuffer.search(/\r?\n/)) >= 0) {
      const line = this.rxBuffer.slice(0, idx).replace(/\r$/, '')
      this.rxBuffer = this.rxBuffer.slice(idx).replace(/^\r?\n/, '')
      if (line.trim() === '') continue
      this.handleLine(line)
    }
  }

  private handleLine(raw: string) {
    const line = raw.trim()

    // Realtime status report
    if (line.startsWith('<') && line.endsWith('>')) {
      let st = parseStatus(line)
      if (st) {
        // Derive WPos from WCO if WPos absent
        if (!/WPos:/.test(line) && /WCO:/.test(line)) {
          const wcoMatch = line.match(/WCO:([-.\d]+),([-.\d]+),([-.\d]+)/)
          if (wcoMatch) {
            st = {
              ...st,
              wpos: {
                x: st.mpos.x - parseFloat(wcoMatch[1]),
                y: st.mpos.y - parseFloat(wcoMatch[2]),
                z: st.mpos.z - parseFloat(wcoMatch[3]),
              },
            }
          }
        }
        this.emitStatus(st)
        // Status lines are noisy in the console; log only state transitions.
        if (st.state !== this.lastLoggedState) {
          this.lastLoggedState = st.state
          this.emitLine(line, 'rx')
        }
      }
      return
    }

    // GRBL welcome / ALARM etc
    if (/^Grbl\s/i.test(line) || /^ALARM:/i.test(line)) {
      this.emitLine(line, 'info')
      return
    }

    if (isOk(line)) {
      this.onOk()
      return
    }
    if (isError(line)) {
      this.onErr(line)
      return
    }

    // Plain echo / other
    this.emitLine(line, 'rx')
  }

  private lastLoggedState = ''

  private onOk() {
    if (this.streaming) {
      this.inFlight--
      if (this.inFlight < 0) this.inFlight = 0
      const sz = this.inFlightSizes.shift()
      if (sz) this.inFlightBytes = Math.max(0, this.inFlightBytes - sz)
      this.pump()
    }
  }

  private onErr(line: string) {
    const msg = describeError(line)
    this.emitLine(line, 'error')
    if (this.streaming) {
      this.inFlight--
      if (this.inFlight < 0) this.inFlight = 0
      const sz = this.inFlightSizes.shift()
      if (sz) this.inFlightBytes = Math.max(0, this.inFlightBytes - sz)
      // A single line error shouldn't necessarily abort the whole job;
      // record it and keep streaming so the rest of the shape completes.
      this.lastError = msg
      this.emitProgress()
      this.pump()
    }
  }

  // ---- Streaming ----
  async streamStart(lines: string[]): Promise<void> {
    if (!this.port?.isOpen) throw new Error('Not connected')
    this.queue = lines.slice()
    this.total = lines.length
    this.index = 0
    this.inFlight = 0
    this.inFlightBytes = 0
    this.inFlightSizes = []
    this.streaming = true
    this.paused = false
    this.stopped = false
    this.lastError = null
    this.startedAt = Date.now()
    this.emitProgress()
    this.pump()
  }

  private pump() {
    if (!this.streaming || this.paused || this.stopped) return
    while (
      this.index < this.total &&
      this.inFlight < MAX_IN_FLIGHT &&
      this.inFlightBytes < MAX_IN_FLIGHT_BYTES
    ) {
      const line = this.queue[this.index]
      this.index++
      this.inFlight++
      const size = line.length + 1
      this.inFlightBytes += size
      this.inFlightSizes.push(size)
      // Fire and forget; GRBL acknowledges via 'ok' which drives the next pump.
      const port = this.port
      if (!port?.isOpen) return
      port.write(line + '\n', (err) => {
        if (err) this.emitLine(`write error: ${err.message}`, 'error')
      })
      // Log only the meaningful motion lines to keep console readable.
      if (/^(G[01]|M[345]|G9|G2)/i.test(line)) this.emitLine(line, 'tx')
    }
    this.emitProgress()

    if (this.index >= this.total && this.inFlight === 0) {
      this.finishStream()
    }
  }

  private finishStream() {
    this.streaming = false
    this.emitProgress()
    this.emitLine('; job complete', 'info')
  }

  async streamPause() {
    if (!this.streaming) return
    this.paused = true
    await this.sendRealtime(RT.FEED_HOLD)
    this.emitProgress()
  }

  async streamResume() {
    if (!this.streaming) return
    this.paused = false
    await this.sendRealtime(RT.CYCLE_START)
    this.emitProgress()
    this.pump()
  }

  async streamStop() {
    this.stopped = true
    this.paused = false
    // Halt motion immediately, kill laser, then reset the controller state.
    await this.sendRealtime(RT.FEED_HOLD)
    await this.write('M5\n', 'tx')
    await this.sendRealtime(RT.SOFT_RESET)
    this.clearStream()
    this.emitLine('; STOPPED - controller reset. Re-run unlock ($X) before next job.', 'info')
  }

  private clearStream() {
    this.streaming = false
    this.queue = []
    this.total = 0
    this.index = 0
    this.inFlight = 0
    this.inFlightBytes = 0
    this.inFlightSizes = []
    this.paused = false
    this.emitProgress()
  }
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function describeRt(char: string): string {
  switch (char) {
    case RT.STATUS:
      return 'status ?'
    case RT.FEED_HOLD:
      return 'feed hold !'
    case RT.CYCLE_START:
      return 'resume ~'
    case RT.SOFT_RESET:
      return 'soft reset Ctrl-X'
    default:
      return `0x${Buffer.from(char, 'binary')[0].toString(16)}`
  }
}
