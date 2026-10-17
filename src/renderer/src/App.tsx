import { useCallback, useMemo, useState } from 'react'
import { LaserProvider, useLaser } from './hooks/useLaser'
import { ConnectionPanel } from './components/ConnectionPanel'
import { BedCanvas } from './components/BedCanvas'
import { HeightIndicator } from './components/HeightIndicator'
import { WebcamMonitor } from './components/WebcamMonitor'
import { CutControl, type Tab } from './components/CutControl'
import { ConsolePanel } from './components/ConsolePanel'
import { GCodePanel } from './components/GCodePanel'
import { TemplateSelector } from './components/TemplateSelector'
import { MaterialSelector } from './components/MaterialSelector'
import { Btn, Panel, StatusPill } from './components/ui'
import { geometryForTemplate } from '@shared/templateGeometry'
import { findMaterial, TEXAS_SPRUCE_DEFAULT } from '@shared/materialUtils'
import type { PhotoTone } from '@shared/photoTone'
import type { TexasTemplate } from '@shared/texasTemplatesTypes'
import type { Material } from '@shared/materialTypes'

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
  const [template, setTemplate] = useState<TexasTemplate | null>(null)
  const [material, setMaterial] = useState<Material | null>(
    () => findMaterial(TEXAS_SPRUCE_DEFAULT) ?? null,
  )
  const [photoTone, setPhotoTone] = useState<PhotoTone>('medium')
  const [tab, setTab] = useState<Tab>('CUT')
  const [gcode, setGcode] = useState<string[]>([])

  const geometry = useMemo(
    () => (template ? geometryForTemplate(template.id) : null),
    [template],
  )

  const onSelectTemplate = useCallback(
    (t: TexasTemplate | undefined) => {
      const next = t ?? null
      setTemplate(next)
      if (!next) return
      const g = geometryForTemplate(next.id)
      if (g) {
        pushLog(
          `Template: ${next.name} — ${g.paths.length} path(s), ` +
            `${g.bounds.w.toFixed(1)}×${g.bounds.h.toFixed(1)}mm`,
          'info',
        )
      } else {
        pushLog(`Template: ${next.name} — vector artwork pending`, 'error')
      }
      // Suggest the matching operation tab for the template type.
      setTab(next.type === 'engrave' || next.type === 'ornate' ? 'ENGRAVE' : 'CUT')
    },
    [pushLog],
  )

  const onClearTemplate = useCallback(() => {
    setTemplate(null)
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

            <Panel title="Template">
              <div className="flex flex-col gap-2">
                <TemplateSelector defaultId={template?.id} onSelect={onSelectTemplate} />
                {template && (
                  <div className="text-[11px] leading-relaxed">
                    <div className="font-semibold text-[#f5f5f5]">{template.name}</div>
                    <div className="text-[#9ca3af]">
                      {template.subtitle} · {template.complexity}
                    </div>
                    <div className="text-[#6b7280]">
                      {template.material} — {template.detail}
                    </div>
                    {geometry ? (
                      <div className="text-[#6b7280] mt-1">
                        {geometry.paths.length} path(s) ·{' '}
                        {geometry.bounds.w.toFixed(1)}×{geometry.bounds.h.toFixed(1)}mm
                      </div>
                    ) : (
                      <div className="text-[#eab308] mt-1">
                        Vector artwork pending — pick another template to cut.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              title="Material Library"
              right={
                <span className="text-[10px] text-[#6b7280] font-mono">
                  {tab} only
                </span>
              }
            >
              <MaterialSelector
                operationFilter={tab}
                onMaterialSelect={(m) => {
                  setMaterial(m ?? null)
                  if (m) setPhotoTone(m.photo_tone)
                }}
              />
            </Panel>

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
              geometry={geometry}
              templateName={template?.name ?? null}
              onClearTemplate={onClearTemplate}
            />
            <GCodePanel lines={gcode} />
            <ConsolePanel />
          </div>

          {/* Right column */}
          <div className="overflow-y-auto pr-1 flex flex-col gap-3 min-h-0">
            <CutControl
              template={template}
              geometry={geometry}
              material={material}
              tab={tab}
              onTabChange={setTab}
              onGcode={setGcode}
            />
            <HeightIndicator />
            <WebcamMonitor tone={photoTone} />
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
