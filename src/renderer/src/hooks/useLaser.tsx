import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  ConnectionState,
  GrblStatus,
  PortInfo,
  SerialLogEntry,
  StreamProgress,
} from '@shared/types'
import { RT } from '@shared/grbl'
import { CONNECT_SEQUENCE } from '@shared/connectSequence'

const MAX_LOGS = 4000
const MAX_TRAIL = 1200

export interface LaserCtx {
  ports: PortInfo[]
  connection: ConnectionState
  status: GrblStatus | null
  logs: SerialLogEntry[]
  progress: StreamProgress | null
  trail: { x: number; y: number }[]

  refreshPorts: () => Promise<void>
  connect: (path: string) => Promise<void>
  disconnect: () => Promise<void>
  clearPorts: () => Promise<void>

  send: (line: string) => Promise<void>
  sendLines: (lines: string[]) => Promise<void>
  sendRealtime: (char: string) => Promise<void>

  unlock: () => Promise<void>
  goToWorkspaceCenter: () => Promise<void>
  runReconnectSequence: () => Promise<void>

  jog: (dx: number, dy: number, feed: number) => Promise<void>
  jogCancel: () => Promise<void>

  startStream: (lines: string[]) => Promise<void>
  pauseStream: () => Promise<void>
  resumeStream: () => Promise<void>
  stopStream: () => Promise<void>

  pushLog: (line: string, dir?: SerialLogEntry['dir']) => void
  clearLogs: () => void
  clearTrail: () => void

  /** True while a job is actively streaming (running or paused). */
  jobActive: boolean
}

const Ctx = createContext<LaserCtx | null>(null)

export function useLaser(): LaserCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLaser must be used inside <LaserProvider>')
  return ctx
}

export function LaserProvider({ children }: { children: ReactNode }) {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [connection, setConnection] = useState<ConnectionState>('disconnected')
  const [status, setStatus] = useState<GrblStatus | null>(null)
  const [logs, setLogs] = useState<SerialLogEntry[]>([])
  const [progress, setProgress] = useState<StreamProgress | null>(null)
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([])

  const progressRef = useRef<StreamProgress | null>(null)
  progressRef.current = progress

  const pushLog = useCallback((line: string, dir: SerialLogEntry['dir'] = 'info') => {
    setLogs((prev) => {
      const next = prev.length >= MAX_LOGS ? prev.slice(prev.length - MAX_LOGS + 1) : prev
      return [...next, { line, dir, t: Date.now() }]
    })
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])
  const clearTrail = useCallback(() => setTrail([]), [])

  // ---- Wire up main -> renderer events once ----
  useEffect(() => {
    const offLine = window.laser.onLine((entry) => {
      setLogs((prev) => {
        const next = prev.length >= MAX_LOGS ? prev.slice(prev.length - MAX_LOGS + 1) : prev
        return [...next, entry]
      })
    })
    const offStatus = window.laser.onStatus((s) => {
      setStatus(s)
      if (s) {
        const { x, y } = s.mpos
        setTrail((prev) => {
          const last = prev[prev.length - 1]
          if (last && Math.hypot(last.x - x, last.y - y) < 0.05) return prev
          const next = prev.length >= MAX_TRAIL ? prev.slice(prev.length - MAX_TRAIL + 1) : prev
          return [...next, { x, y }]
        })
      }
    })
    const offState = window.laser.onState((st) => setConnection(st))
    const offProgress = window.laser.onProgress((p) => setProgress(p))
    return () => {
      offLine()
      offStatus()
      offState()
      offProgress()
    }
  }, [])

  const refreshPorts = useCallback(async () => {
    try {
      const list = await window.laser.listPorts()
      setPorts(list)
    } catch (e) {
      // A failed scan must not look like "no laser exists" — say what broke.
      pushLog(
        `Port scan failed: ${e instanceof Error ? e.message : String(e)} — no COM ports shown. ` +
          'Check the USB cable and the CH340 driver, then scan again.',
        'error',
      )
    }
  }, [pushLog])

  const connect = useCallback(
    async (path: string) => {
      pushLog(`connecting to ${path} ...`, 'info')
      const res = await window.laser.connect(path)
      if (!res.ok) pushLog(`connect failed: ${res.error ?? 'unknown'}`, 'error')
    },
    [pushLog],
  )

  const disconnect = useCallback(async () => {
    await window.laser.disconnect()
    setStatus(null)
  }, [])

  const clearPorts = useCallback(async () => {
    // Close the port, release the lock and forget the port list.
    await window.laser.disconnect()
    setStatus(null)
    setPorts([])
    setTrail([])
    pushLog('ports cleared / lock released', 'info')
    // Re-scan after a moment to allow the driver to settle.
    setTimeout(() => void refreshPorts(), 600)
  }, [pushLog, refreshPorts])

  const send = useCallback((line: string) => window.laser.send(line), [])
  const sendLines = useCallback((lines: string[]) => window.laser.sendLines(lines, 30), [])
  const sendRealtime = useCallback((char: string) => window.laser.sendRealtime(char), [])

  const unlock = useCallback(async () => {
    await sendRealtime(RT.SOFT_RESET)
    await new Promise((r) => setTimeout(r, 120))
    await send('$X')
    pushLog('UNLOCK: soft-reset + $X sent', 'info')
  }, [send, sendRealtime, pushLog])

  const goToWorkspaceCenter = useCallback(async () => {
    // Workspace center is the bed center at origin (0,0). This is the
    // dead center of the complete usable 150×200mm workspace.
    await send('G90')
    await send('G0 X0 Y0')
    pushLog('GO TO WORKSPACE CENTER (0,0): G0 X0 Y0', 'info')
  }, [send, pushLog])

  const runReconnectSequence = useCallback(async () => {
    pushLog('running full unlock/config sequence ...', 'info')
    await sendLines(CONNECT_SEQUENCE)
  }, [sendLines, pushLog])

  const jog = useCallback(
    async (dx: number, dy: number, feed: number) => {
      // Controlled relative jog: G91 -> G1 F<feed> -> back to G90.
      // G1 (not G0) so the selected feed rate is honoured and moves stay gentle.
      const parts: string[] = ['G91']
      const axes: string[] = []
      if (dx !== 0) axes.push(`X${dx.toFixed(3)}`)
      if (dy !== 0) axes.push(`Y${dy.toFixed(3)}`)
      if (axes.length === 0) {
        parts.push('G90')
        await send(parts.join(' '))
        return
      }
      parts.push(`G1 F${feed.toFixed(0)}`)
      parts.push(`G1 ${axes.join(' ')}`)
      parts.push('G90')
      await send(parts.join(' '))
    },
    [send],
  )

  const jogCancel = useCallback(async () => {
    await sendRealtime(RT.SOFT_RESET)
    pushLog('jog cancelled (soft reset)', 'info')
  }, [sendRealtime, pushLog])

  const startStream = useCallback(
    async (lines: string[]) => {
      await window.laser.streamStart(lines)
    },
    [],
  )
  const pauseStream = useCallback(async () => {
    await window.laser.streamPause()
  }, [])
  const resumeStream = useCallback(async () => {
    await window.laser.streamResume()
  }, [])
  const stopStream = useCallback(async () => {
    await window.laser.streamStop()
  }, [])

  const jobActive = !!progress && !progress.done && (progress.running || progress.paused)

  // Refresh ports on mount.
  useEffect(() => {
    void refreshPorts()
  }, [refreshPorts])

  const value = useMemo<LaserCtx>(
    () => ({
      ports,
      connection,
      status,
      logs,
      progress,
      trail,
      refreshPorts,
      connect,
      disconnect,
      clearPorts,
      send,
      sendLines,
      sendRealtime,
      unlock,
      goToWorkspaceCenter,
      runReconnectSequence,
      jog,
      jogCancel,
      startStream,
      pauseStream,
      resumeStream,
      stopStream,
      pushLog,
      clearLogs,
      clearTrail,
      jobActive,
    }),
    [
      ports,
      connection,
      status,
      logs,
      progress,
      trail,
      refreshPorts,
      connect,
      disconnect,
      clearPorts,
      send,
      sendLines,
      sendRealtime,
      unlock,
      goToWorkspaceCenter,
      runReconnectSequence,
      jog,
      jogCancel,
      startStream,
      pauseStream,
      resumeStream,
      stopStream,
      pushLog,
      clearLogs,
      clearTrail,
      jobActive,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
