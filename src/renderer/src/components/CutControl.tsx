import { useEffect, useMemo, useRef, useState } from 'react'
import { useLaser } from '../hooks/useLaser'
import { Btn, Field, Panel, StatusPill } from './ui'
import { PRESETS, DEFAULT_PRESET_BY_TAB, type MaterialPreset } from '@shared/presets'
import { generatePathsGcode, generateBoundsFrame } from '@shared/texasPath'
import type { TemplateGeometry } from '@shared/templateGeometry'
import type { TexasTemplate } from '@shared/texasTemplatesTypes'
import type { Material } from '@shared/materialTypes'

export type Tab = 'CUT' | 'ENGRAVE' | 'MARK'

export interface CutControlProps {
  template: TexasTemplate | null
  geometry: TemplateGeometry | null
  material: Material | null
  tab: Tab
  onTabChange: (t: Tab) => void
  onGcode: (lines: string[]) => void
}

function fmtTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function CutControl({
  template,
  geometry,
  material,
  tab,
  onTabChange,
  onGcode,
}: CutControlProps) {
  const {
    connection,
    progress,
    jobActive,
    startStream,
    pauseStream,
    resumeStream,
    stopStream,
    send,
    pushLog,
  } = useLaser()

  const [dpi, setDpi] = useState(300)
  const [power, setPower] = useState(100)
  const [speed, setSpeed] = useState(250)
  const [passes, setPasses] = useState(10)
  const [zStep, setZStep] = useState(0)
  const [testFire, setTestFire] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const intervalMm = 25.4 / dpi

  // Tick for elapsed/remaining while a job is running.
  useEffect(() => {
    if (!jobActive) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [jobActive])

  useEffect(() => {
    return () => {
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    setPower(p.power)
    setSpeed(p.speed)
    setPasses(p.passes)
    setZStep(p.zStep)
    setDpi(p.dpi)
  }

  const switchTab = (t: Tab) => {
    onTabChange(t)
    applyPreset(DEFAULT_PRESET_BY_TAB[t])
  }

  // A material picked in the Material Library drives the cut settings.
  useEffect(() => {
    if (!material) return
    setPower(material.power_percent)
    setSpeed(material.speed_mm_min)
    setPasses(material.passes)
    setZStep(material.z_step_per_pass_mm)
    setDpi(material.dpi)
    onTabChange(material.operation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material])

  const presetsForTab = useMemo(
    () => PRESETS.filter((p: MaterialPreset) => p.category === tab.toLowerCase()),
    [tab],
  )

  const buildGcode = (): string[] | null => {
    if (!geometry) return null
    return generatePathsGcode(
      geometry.paths,
      geometry.closed,
      {
        speed,
        powerPercent: power,
        passes,
        zStep,
        travelHeight: 0,
        optimize: true,
        tol: 0.03,
        originAtStart: true,
      },
      template?.name ?? 'template',
    )
  }

  const doStart = async () => {
    if (!template) {
      pushLog('Select a template in the left panel first.', 'error')
      return
    }
    if (!geometry) {
      pushLog(`"${template.name}" has no vector artwork yet — nothing to cut.`, 'error')
      return
    }
    const lines = buildGcode()
    if (!lines) return
    onGcode(lines)
    pushLog(`START: ${template.name} — streaming ${lines.length} lines (${tab})`, 'info')
    await startStream(lines)
  }

  const doFrame = async () => {
    if (!template || !geometry) {
      pushLog('Select a template with vector artwork first.', 'error')
      return
    }
    const lines = generateBoundsFrame(geometry.bounds, 1000)
    onGcode(lines)
    pushLog(`FRAME: ${template.name} bounds, laser off (S0)`, 'info')
    await startStream(lines)
  }

  // ---- Test fire: M3 Sxx for 2s then auto M5 ----
  const startTestFire = async (percent: number) => {
    if (testFire !== null) return
    const s = Math.round((percent / 100) * 1000)
    setTestFire(2)
    await send('M5')
    await send(`M3 S${s}`)
    pushLog(`TEST FIRE ${percent}% (M3 S${s}) — 2 second pulse`, 'info')

    countdownRef.current = setInterval(() => {
      setTestFire((v) => (v === null ? null : v - 1))
    }, 1000)

    testTimerRef.current = setTimeout(async () => {
      await send('M5')
      pushLog('TEST FIRE done — M5 laser off', 'info')
      setTestFire(null)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }, 2000)
  }

  // ---- progress math ----
  const frac =
    progress && progress.total > 0 ? Math.min(1, progress.sent / progress.total) : 0
  const pct = Math.round(frac * 100)
  const elapsed = progress?.startedAt ? now - progress.startedAt : 0
  const remaining = frac > 0.01 ? (elapsed / frac) * (1 - frac) : 0
  const currentPass = Math.min(passes, Math.floor(frac * passes) + 1)
  const running = progress?.running
  const paused = progress?.paused
  const connected = connection === 'connected'

  return (
    <Panel
      title="Cut Control"
      right={
        running ? (
          <StatusPill color="accent" label="LIVE" pulse />
        ) : paused ? (
          <StatusPill color="warn" label="PAUSED" />
        ) : progress?.done ? (
          <StatusPill color="ok" label="DONE" />
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#161616] border border-[#3a3a3a]">
          {(['CUT', 'ENGRAVE', 'MARK'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`btn py-2 text-xs tracking-wider ${
                tab === t
                  ? 'bg-[#ff6b35] text-black border-[#ff6b35]'
                  : 'bg-transparent text-[#9ca3af] hover:bg-[#232323] border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Active material */}
        {material && (
          <div className="rounded-lg bg-[#161616] border border-[#3a3a3a] px-3 py-2 text-[11px]">
            <span className="text-[#6b7280] uppercase tracking-wider font-semibold">
              Material
            </span>
            <div className="text-[#f5f5f5] font-semibold mt-0.5">
              {material.name}{' '}
              <span className="text-[#6b7280] font-normal">
                ({material.operation}) · {material.thickness_mm}mm
              </span>
            </div>
            {material.coating_required && (
              <div className="text-[#eab308] mt-0.5">⚠ {material.notes}</div>
            )}
          </div>
        )}

        {/* Presets + DPI */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Material preset">
            <select
              className="field"
              defaultValue={DEFAULT_PRESET_BY_TAB[tab]}
              key={tab}
              onChange={(e) => applyPreset(e.target.value)}
            >
              {presetsForTab.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="DPI" hint={`interval ${intervalMm.toFixed(4)} mm`}>
            <input
              className="field"
              type="number"
              min={50}
              max={1000}
              step={10}
              value={dpi}
              onChange={(e) => setDpi(Math.max(50, Number(e.target.value) || 300))}
            />
          </Field>
        </div>

        {/* Sliders */}
        <Slider label="Power" value={power} min={0} max={100} step={1} unit="%" onChange={setPower} />
        <Slider
          label="Speed"
          value={speed}
          min={50}
          max={1000}
          step={10}
          unit="mm/min"
          onChange={setSpeed}
          warn={speed > 500}
          warnText=">500mm/min risks the mid-job stall on complex paths"
        />
        <Slider label="Passes" value={passes} min={1} max={20} step={1} unit="" onChange={setPasses} />
        <Slider
          label="Z-Step / pass"
          value={zStep}
          min={0}
          max={2}
          step={0.05}
          unit="mm"
          onChange={setZStep}
          decimals={2}
        />

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="accent"
            size="lg"
            className="col-span-2 py-3 text-base"
            disabled={!connected || jobActive || !geometry}
            onClick={() => void doStart()}
          >
            ▶ START
          </Btn>
          <Btn
            variant="gantry"
            disabled={!connected || jobActive || !geometry}
            onClick={() => void doFrame()}
          >
            ⧉ FRAME
          </Btn>
          <Btn variant="warn" disabled={!running} onClick={() => void pauseStream()}>
            ❙❙ PAUSE
          </Btn>
          <Btn variant="ok" disabled={!paused} onClick={() => void resumeStream()}>
            ▶ RESUME
          </Btn>
          <Btn variant="danger" disabled={!jobActive} onClick={() => void stopStream()}>
            ■ STOP
          </Btn>
        </div>

        {!template && (
          <div className="text-[11px] text-[#eab308]">
            Select a template in the left panel to enable START / FRAME.
          </div>
        )}
        {template && !geometry && (
          <div className="text-[11px] text-[#eab308]">
            “{template.name}” has no vector artwork yet — START is disabled until the
            artwork is drawn.
          </div>
        )}

        {/* Test fire */}
        <div className="rounded-lg bg-[#161616] border border-[#3a3a3a] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="panel-title">Test Fire (2s auto-off)</span>
            {testFire !== null && (
              <span className="text-[11px] text-[#ff6b35] font-mono blink">
                FIRING {testFire}s
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn
              variant="ghost"
              disabled={!connected || jobActive || testFire !== null}
              onClick={() => void startTestFire(5)}
            >
              5% (M3 S50)
            </Btn>
            <Btn
              variant="ghost"
              disabled={!connected || jobActive || testFire !== null}
              onClick={() => void startTestFire(20)}
            >
              20% (M3 S200)
            </Btn>
          </div>
          <p className="text-[10px] text-[#6b7280] mt-1.5">
            Point at scrap with the shield down. Auto M5 after 2 seconds.
          </p>
        </div>

        {/* Progress */}
        <div className="rounded-lg bg-[#161616] border border-[#3a3a3a] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="panel-title">Job Progress</span>
            {running && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b35] live-dot" />
                <span className="text-[11px] font-bold text-[#ff6b35]">LIVE</span>
              </span>
            )}
          </div>
          <div className="h-3 rounded-full bg-[#2c2c2c] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ff6b35] to-[#ffa07a] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2 text-center tabular">
            <Stat label="Progress" value={`${pct}%`} />
            <Stat label="Pass" value={`${jobActive || progress?.done ? currentPass : 0}/${passes}`} />
            <Stat label="Elapsed" value={fmtTime(elapsed)} />
            <Stat label="Remaining" value={jobActive ? `~${fmtTime(remaining)}` : '--:--:--'} />
          </div>
          <div className="text-[10px] text-[#6b7280] mt-1 tabular">
            lines {progress?.sent ?? 0}/{progress?.total ?? 0}
            {progress?.error && (
              <span className="text-[#ef4444]"> • {progress.error}</span>
            )}
          </div>
        </div>

        <p className="text-[10px] text-[#6b7280] leading-relaxed">
          Anti-stutter: default {speed <= 250 ? '250' : speed}mm/min, acceleration
          $120/$121=300 on connect, 15-line GRBL buffer with ok-waiting, collinear
          merge on dense paths.
        </p>
      </div>
    </Panel>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  warn,
  warnText,
  decimals = 0,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
  warn?: boolean
  warnText?: string
  decimals?: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-semibold">
          {label}
        </span>
        <span className={`text-xs font-mono ${warn ? 'text-[#eab308]' : 'text-[#f5f5f5]'}`}>
          {value.toFixed(decimals)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {warn && warnText && (
        <div className="text-[10px] text-[#eab308] -mt-1">⚠ {warnText}</div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-[#6b7280] uppercase">{label}</span>
      <span className="text-sm text-[#f5f5f5]">{value}</span>
    </div>
  )
}
