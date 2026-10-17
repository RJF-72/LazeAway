import { useEffect, useMemo, useRef, useState } from 'react'
import { useLaser } from '../hooks/useLaser'
import { Btn, Panel } from './ui'
import type { SerialLogEntry } from '@shared/types'

type Filter = 'ALL' | 'ERRORS' | 'POSITION'

const dirColor: Record<SerialLogEntry['dir'], string> = {
  tx: 'text-[#7aa9fb]',
  rx: 'text-[#c9c9c9]',
  info: 'text-[#22c55e]',
  error: 'text-[#ef4444]',
  realtime: 'text-[#eab308]',
}

function fmtClock(t: number): string {
  const d = new Date(t)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

export function ConsolePanel() {
  const { logs, clearLogs, pushLog } = useLaser()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'ERRORS') return logs.filter((l) => l.dir === 'error')
    if (filter === 'POSITION')
      return logs.filter((l) => /^G0|^G1|^G92|MPos|WPos/.test(l.line))
    return logs
  }, [logs, filter])

  useEffect(() => {
    if (!autoScroll) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [filtered, autoScroll])

  const exportLog = () => {
    const text = logs
      .map((l) => `[${fmtClock(l.t)}] ${l.dir.toUpperCase().padEnd(8)} ${l.line}`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `artilume-console-${Date.now()}.log`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    pushLog('console log exported', 'info')
  }

  return (
    <Panel
      title="Console"
      right={
        <span className="text-[10px] text-[#6b7280] font-mono">
          {logs.length} lines
        </span>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-col h-full">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#3a3a3a]">
          <div className="flex rounded-md overflow-hidden border border-[#3a3a3a]">
            {(['ALL', 'ERRORS', 'POSITION'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-[11px] font-semibold ${
                  filter === f
                    ? 'bg-[#ff6b35] text-black'
                    : 'bg-[#232323] text-[#9ca3af] hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] select-none cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>

          <div className="ml-auto flex gap-2">
            <Btn size="sm" variant="ghost" onClick={exportLog}>
              Export
            </Btn>
            <Btn size="sm" variant="ghost" onClick={clearLogs}>
              Clear
            </Btn>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-auto font-mono text-[11px] leading-[1.5] px-3 py-2 bg-[#0b0b0b] min-h-[140px] max-h-[320px]"
        >
          {filtered.length === 0 && (
            <div className="text-[#4b5563]">No entries.</div>
          )}
          {filtered.map((l, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap break-all">
              <span className="text-[#4b5563] shrink-0">{fmtClock(l.t)}</span>
              <span className={`shrink-0 w-16 ${dirColor[l.dir]}`}>
                {l.dir.toUpperCase()}
              </span>
              <span className="text-[#d4d4d4]">{l.line}</span>
            </div>
          ))}
        </div>

        {/* quick command input */}
        <QuickCommand />
      </div>
    </Panel>
  )
}

function QuickCommand() {
  const { send, connection } = useLaser()
  const [cmd, setCmd] = useState('')
  const disabled = connection !== 'connected'
  const submit = () => {
    const c = cmd.trim()
    if (!c) return
    void send(c)
    setCmd('')
  }
  return (
    <div className="flex gap-2 p-2 border-t border-[#3a3a3a] bg-[#161616]">
      <input
        className="field flex-1"
        placeholder={disabled ? 'not connected' : 'Send G-code / $setting…'}
        value={cmd}
        disabled={disabled}
        onChange={(e) => setCmd(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
      />
      <Btn size="sm" variant="accent" disabled={disabled || !cmd.trim()} onClick={submit}>
        Send
      </Btn>
    </div>
  )
}
