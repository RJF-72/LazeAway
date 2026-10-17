import { useCallback, useState } from 'react'
import { LaserProvider, useLaser } from './hooks/useLaser'
import { ConnectionPanel } from './components/ConnectionPanel'
import { BedCanvas } from './components/BedCanvas'
import { HeightIndicator } from './components/HeightIndicator'
import { WebcamMonitor } from './components/WebcamMonitor'
import { CutControl } from './components/CutControl'
import { ConsolePanel } from './components/ConsolePanel'
import { GCodePanel } from './components/GCodePanel'
import { Btn, StatusPill } from './components/ui'

export default function App() {
  return (
    <LaserProvider>
      <Shell />
    </LaserProvider>
  )
}

function Shell() {
  const { connection, status, pushLog, send, sendRealtime, stopStream, jobActive } =
    useLaser()
  const [templateScale, setTemplateScale] = useState<number | null>(null)
  const [gcode, setGcode] = useState<string[]>([])

  const onLoadTemplate = useCallback(
    (scale: number) => {
      setTemplateScale(scale)
      const size = scale === 1 ? '95mm' : scale === 0.842 ? '80mm' : `${scale}`
      pushLog(`Loaded Texas soundhole template (${size})`, 'info')
    },
    [pushLog],
  )

  const onClearTemplate = useCallback(() => {
    setTemplateScale(null)
    setGcode([])
  }, [])

  const emergencyStop = useCallback(async () => {
    await sendRealtime('\x18') // Ctrl-X soft reset
    await send('M5') // laser off
    await send('G90') // absolute
    await stopStream()
    pushLog('⚠ EMERGENCY STOP — soft reset + M5 + G90', 'error')
  }, [send, sendRealtime, stopStream, pushLog])

  const connColor =
    connection === 'connected' ? 'ok' : connection === 'error' ? 'danger' : 'muted'

  return (
    <div className="h-screen flex flex-col bg-[#121212]">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-4 px-4 py-2.5 bg-[#1b1b1b] border-b border-[#3a3a3a]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#ff6b35] flex items-center justify-center shadow-[0_0_18px_rgba(255,107,53,0.5)]">
            <span className="text-black font-black text-lg">A</span>
          </div>
          <div className="leading-tight">
            <h1 className="text-[15px] font-bold text-white">
              Artilume S1 Desktop Controller
            </h1>
            <p className="text-[10px] text-[#ff8c5c] tracking-[0.18em] font-semibold uppercase">
              Texas Guitar Edition
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[10px] text-[#6b7280] font-mono">
          <span className="px-2 py-0.5 rounded bg-[#161616] border border-[#3a3a3a]">
            GRBL 1.1h
          </span>
          <span className="px-2 py-0.5 rounded bg-[#161616] border border-[#3a3a3a]">
            CH340
          </span>
          <span className="px-2 py-0.5 rounded bg-[#161616] border border-[#3a3a3a]">
            6W • 150×200mm
          </span>
          <span className="px-2 py-0.5 rounded bg-[#161616] border border-[#3a3a3a]">
            115200
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <StatusPill color={connColor} label={connection} pulse={connection === 'connected'} />
          {status && (
            <span className="text-[11px] font-mono text-[#9ca3af] hidden lg:inline">
              {status.state} · {status.mpos.x.toFixed(1)},{status.mpos.y.toFixed(1)}
            </span>
          )}
          <Btn
            variant="danger"
            size="lg"
            className="font-black tracking-wide"
            onClick={() => void emergencyStop()}
            title="Ctrl-X + M5 + G90 (soft reset)"
          >
            ⛔ STOP
          </Btn>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-hidden p-3">
        <div className="grid h-full gap-3 grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)_400px]">
          {/* Left column */}
          <div className="overflow-y-auto pr-1 flex flex-col gap-3 min-h-0">
            <ConnectionPanel />
            <div className="panel p-3 text-[10px] text-[#6b7280] leading-relaxed">
              <p className="font-semibold text-[#9ca3af] mb-1">Hardware notes</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>USB-C data + 24V/3A brick BOTH required to fire</li>
                <li>USB alone = green light, no laser</li>
                <li>No Bluetooth / WiFi / camera on this model</li>
                <li>$32=1 enforced on connect (laser mode)</li>
              </ul>
            </div>
          </div>

          {/* Center column */}
          <div className="overflow-y-auto pr-1 flex flex-col gap-3 min-h-0">
            <BedCanvas
              templateScale={templateScale}
              onLoadTemplate={onLoadTemplate}
              onClearTemplate={onClearTemplate}
            />
            <GCodePanel lines={gcode} />
            <ConsolePanel />
          </div>

          {/* Right column */}
          <div className="overflow-y-auto pr-1 flex flex-col gap-3 min-h-0">
            <CutControl templateScale={templateScale} onGcode={setGcode} />
            <HeightIndicator />
            <WebcamMonitor />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-[#1b1b1b] border-t border-[#3a3a3a] text-[10px] text-[#6b7280]">
        <span>
          Artilume S1 6W Foldable • ACMER S1 clone • offline, no internet required
        </span>
        <span className="font-mono">
          {jobActive ? 'JOB ACTIVE' : 'IDLE'} • {connection.toUpperCase()}
        </span>
      </footer>
    </div>
  )
}
