import { useEffect, useState } from 'react'
import { useLaser } from '../hooks/useLaser'
import { Btn, Panel, StatusPill } from './ui'
import { JogPad } from './JogPad'

function stateColor(state: string): 'ok' | 'warn' | 'danger' | 'muted' | 'gantry' {
  switch (state) {
    case 'Idle':
      return 'ok'
    case 'Run':
    case 'Jog':
    case 'Busy':
      return 'gantry'
    case 'Hold':
    case 'Door':
    case 'Home':
    case 'Tool':
      return 'warn'
    case 'Alarm':
      return 'danger'
    default:
      return 'muted'
  }
}

export function ConnectionPanel() {
  const {
    ports,
    connection,
    status,
    refreshPorts,
    connect,
    disconnect,
    clearPorts,
    unlock,
    goToWorkspaceCenter,
    runReconnectSequence,
  } = useLaser()

  const [selected, setSelected] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const connected = connection === 'connected'

  // Auto-select the most likely laser port (CH340 / USB serial over Bluetooth
  // links are ignored in favour of a real USB serial device).
  useEffect(() => {
    if (ports.length === 0) {
      setSelected('')
      return
    }
    const likely = ports.find(
      (p) =>
        /ch340|wch|usb.?serial|silicon|ftdi|cp210/i.test(
          `${p.friendlyName ?? ''} ${p.manufacturer ?? ''}`,
        ) && !/bluetooth/i.test(`${p.friendlyName ?? ''} ${p.manufacturer ?? ''}`),
    )
    const firstReal = ports.find((p) => !/bluetooth/i.test(p.friendlyName ?? ''))
    setSelected((cur) => {
      if (cur && ports.some((p) => p.path === cur)) return cur
      return (likely ?? firstReal ?? ports[0]).path
    })
  }, [ports])

  const doConnect = async () => {
    if (!selected) return
    setBusy(true)
    try {
      await connect(selected)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title="Connection"
      right={
        <StatusPill
          color={connected ? 'ok' : connection === 'error' ? 'danger' : 'muted'}
          label={connection}
          pulse={connected}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {/* Port picker */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-semibold">
              COM Port
            </span>
            <button
              className="text-[11px] text-[#3b82f6] hover:text-[#7aa9fb]"
              onClick={() => void refreshPorts()}
            >
              ⟳ Rescan
            </button>
          </div>
          <select
            className="field"
            value={selected}
            disabled={connected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {ports.length === 0 && <option value="">No ports found</option>}
            {ports.map((p) => {
              const bt = /bluetooth/i.test(p.friendlyName ?? '')
              return (
                <option key={p.path} value={p.path}>
                  {p.path} — {p.friendlyName || p.manufacturer || 'unknown'}
                  {bt ? ' (BT)' : ''}
                </option>
              )
            })}
          </select>
          <span className="text-[10px] text-[#6b7280]">
            CH340 driver required. Use the USB-C <b>data</b> port (not charge-only).
          </span>
        </div>

        {/* Connect / disconnect */}
        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="accent"
            size="lg"
            disabled={connected || !selected || busy}
            onClick={() => void doConnect()}
          >
            {busy ? 'Connecting…' : 'CONNECT'}
          </Btn>
          <Btn
            variant="danger"
            size="lg"
            disabled={!connected}
            onClick={() => void disconnect()}
          >
            DISCONNECT
          </Btn>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          <Btn variant="warn" disabled={!connected} onClick={() => void unlock()}>
            UNLOCK $X
          </Btn>
          <Btn variant="gantry" disabled={!connected} onClick={() => void goToWorkspaceCenter()}>
            WORKSPACE CENTER (0,0)
          </Btn>
          <Btn variant="ghost" onClick={() => void clearPorts()}>
            CLEAR PORTS
          </Btn>
        </div>

        <Btn variant="ghost" size="sm" disabled={!connected} onClick={() => void runReconnectSequence()}>
          Re-run full unlock / config sequence ($32=1, $120=300 …)
        </Btn>

        {/* Live status readout */}
        <div className="rounded-lg bg-[#161616] border border-[#3a3a3a] p-3 font-mono text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#9ca3af]">GRBL STATUS</span>
            <StatusPill
              color={status ? stateColor(status.state) : 'muted'}
              label={status?.state ?? 'no data'}
              pulse={status?.state === 'Run' || status?.state === 'Jog'}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 tabular">
            <Coord label="MPos X" v={status?.mpos.x} />
            <Coord label="MPos Y" v={status?.mpos.y} />
            <Coord label="MPos Z" v={status?.mpos.z} />
          </div>
          <div className="grid grid-cols-3 gap-2 tabular mt-1">
            <Coord label="WPos X" v={status?.wpos.x} />
            <Coord label="WPos Y" v={status?.wpos.y} />
            <Coord label="WPos Z" v={status?.wpos.z} />
          </div>
          <div className="grid grid-cols-2 gap-2 tabular mt-1">
            <Coord label="Feed" v={status?.feed} unit="mm/min" />
            <Coord label="Spindle" v={status?.speed} unit="S" />
          </div>
          <div className="mt-2 text-[10px] text-[#6b7280] truncate" title={status?.raw}>
            {status?.raw ?? 'waiting for <...> report…'}
          </div>
        </div>

        <div className="border-t border-[#3a3a3a] pt-3">
          <h3 className="panel-title mb-2">Jog Pad</h3>
          <JogPad />
        </div>
      </div>
    </Panel>
  )
}

function Coord({ label, v, unit }: { label: string; v?: number; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-[#6b7280] uppercase">{label}</span>
      <span className="text-[#f5f5f5]">
        {v === undefined ? '—' : v.toFixed(3)}
        {unit ? <span className="text-[#6b7280]"> {unit}</span> : null}
      </span>
    </div>
  )
}
