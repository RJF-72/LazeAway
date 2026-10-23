import { useCallback, useEffect, useMemo, useState } from 'react'
import { LaserProvider, useLaser } from './hooks/useLaser'
import { ConnectionPanel } from './components/ConnectionPanel'
import { BedCanvas, type ImagePreview } from './components/BedCanvas'
import { HeightIndicator } from './components/HeightIndicator'
import { WebcamMonitor } from './components/WebcamMonitor'
import { CutControl, type Tab } from './components/CutControl'
import { ConsolePanel } from './components/ConsolePanel'
import { GCodePanel } from './components/GCodePanel'
import { TemplateSelector } from './components/TemplateSelector'
import { MaterialSelector } from './components/MaterialSelector'
import { ArtworkPanel } from './components/ArtworkPanel'
import { TextEngravePanel } from './components/TextEngravePanel'
import { Btn, Panel, StatusPill } from './components/ui'
import { geometryForTemplate, scaleGeometry, type TemplateGeometry } from '@shared/templateGeometry'
import { findMaterial, TEXAS_SPRUCE_DEFAULT } from '@shared/materialUtils'
import type { PhotoTone } from '@shared/photoTone'
import type { TexasTemplate } from '@shared/texasTemplatesTypes'
import type { Material } from '@shared/materialTypes'
import type { LoadedArtwork } from './lib/artwork'
import { setArtworkOutline, setImageOutlineThickness } from './lib/artwork'
import { clampOutlineThickness, OUTLINE_DEFAULT_PX } from './lib/imageImport'
import { generateTextGcode, estimateTextEngraving, textToPaths } from '@shared/textEngrave'
import type { Pt } from '@shared/texasPath'

const BED_W = 150
const BED_H = 200

/** Fit a natural size inside the bed (never scale up, only down). */
function fitBed(w: number, h: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 1, h: 1 }
  const k = Math.min(1, BED_W / w, BED_H / h)
  return { w: w * k, h: h * k }
}

export default function App() {
  return (
    <LaserProvider>
      <Shell />
    </LaserProvider>
  )
}

function Shell() {
  const { connection, status, pushLog, send, sendRealtime, stopStream, jobActive, startStream } =
    useLaser()
  const [template, setTemplate] = useState<TexasTemplate | null>(null)
  const [artwork, setArtwork] = useState<LoadedArtwork | null>(null)
  const [material, setMaterial] = useState<Material | null>(
    () => findMaterial(TEXAS_SPRUCE_DEFAULT) ?? null,
  )
  const [photoTone, setPhotoTone] = useState<PhotoTone>('medium')
  const [tab, setTab] = useState<Tab>('CUT')
  const [gcode, setGcode] = useState<string[]>([])
  // Job width in mm; height follows the artwork aspect (aspect always locked).
  const [widthMm, setWidthMm] = useState(1)
  // Raster tone: 0 lightest .. 100 darkest, plus ink-direction flip.
  const [darkness, setDarkness] = useState(50)
  const [invert, setInvert] = useState(false)
  // Outline (line art) line weight in pixels, 1 thin .. 5 bold.
  const [outlinePx, setOutlinePx] = useState(OUTLINE_DEFAULT_PX)

  // Text engraving state
  const [textEngraveText, setTextEngraveText] = useState('')
  const [textEngraveFontSize, setTextEngraveFontSize] = useState(10)
  const [textEngraveLetterSpacing, setTextEngraveLetterSpacing] = useState(1.0)
  const [textEngraveLineSpacing, setTextEngraveLineSpacing] = useState(1.2)
  const [textEngraveCenter, setTextEngraveCenter] = useState(true)
  const [textEngraveMaxWidth, setTextEngraveMaxWidth] = useState(0)
  const [textPreviewPaths, setTextPreviewPaths] = useState<Pt[][]>([])
  const [textPreviewBounds, setTextPreviewBounds] = useState({ minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 })

  // Update text preview
  const updateTextPreview = useCallback(() => {
    if (!textEngraveText.trim()) {
      setTextPreviewPaths([])
      setTextPreviewBounds({ minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 })
      return
    }
    const result = textToPaths({
      text: textEngraveText,
      size: textEngraveFontSize,
      letterSpacing: textEngraveLetterSpacing,
      lineSpacing: textEngraveLineSpacing,
      center: textEngraveCenter,
      originMode: 'center',
      maxWidth: textEngraveMaxWidth > 0 ? textEngraveMaxWidth : undefined,
    })
    setTextPreviewPaths(result.paths)
    setTextPreviewBounds(result.bounds)
  }, [textEngraveText, textEngraveFontSize, textEngraveLetterSpacing, textEngraveLineSpacing, textEngraveCenter, textEngraveMaxWidth])

  // Update preview when text engraving inputs change
  useEffect(() => {
    updateTextPreview()
  }, [updateTextPreview])

  // Natural geometry before user sizing (vector jobs only).
  const naturalGeom = useMemo(() => {
    if (artwork?.kind === 'vector') return artwork.geometry
    if (artwork) return null // image — bounds derive from width + aspect
    return template ? geometryForTemplate(template.id) : null
  }, [artwork, template])

  // Natural job size: imports are fitted to the bed; built-ins keep their
  // authored size (oversize built-ins still show the existing bed warning).
  const naturalSize = useMemo(() => {
    if (artwork?.kind === 'image') {
      // 96dpi reference size, never larger than the bed.
      const w = (artwork.wPx * 25.4) / 96
      const h = (artwork.hPx * 25.4) / 96
      return fitBed(w, h)
    }
    if (artwork?.kind === 'vector') {
      return fitBed(artwork.geometry.bounds.w, artwork.geometry.bounds.h)
    }
    if (naturalGeom) return { w: naturalGeom.bounds.w, h: naturalGeom.bounds.h }
    return null
  }, [artwork, naturalGeom])

  // Reset the size control whenever a different job is loaded.
  useEffect(() => {
    if (naturalSize) setWidthMm(Math.max(1, Math.round(naturalSize.w * 10) / 10))
  }, [naturalSize])

  // Active geometry (scaled to the chosen width), passed to bed + cut control.
  const geometry = useMemo<TemplateGeometry | null>(() => {
    if (artwork?.kind === 'image') {
      const h = widthMm * (artwork.hPx / artwork.wPx)
      return {
        paths: [],
        closed: [],
        bounds: {
          minX: -widthMm / 2,
          minY: -h / 2,
          maxX: widthMm / 2,
          maxY: h / 2,
          w: widthMm,
          h,
        },
        note: `Picture · ${artwork.wPx}×${artwork.hPx}px @ ${widthMm.toFixed(1)}mm wide`,
      }
    }
    if (naturalGeom) return scaleGeometry(naturalGeom, widthMm)
    return null
  }, [artwork, naturalGeom, widthMm])

  const jobName = artwork?.name ?? template?.name ?? null

  const imagePreview = useMemo<ImagePreview | null>(() => {
    if (artwork?.kind !== 'image' || !geometry) return null
    return { dataUrl: artwork.dataUrl, bounds: geometry.bounds, darkness, invert }
  }, [artwork, geometry, darkness, invert])

  const onSelectTemplate = useCallback(
    (t: TexasTemplate | undefined) => {
      const next = t ?? null
      if (next) setArtwork(null) // one active job at a time
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

  const onArtwork = useCallback(
    (a: LoadedArtwork | null) => {
      if (a) {
        setTemplate(null) // one active job at a time
        setTab('ENGRAVE')
      }
      setArtwork(a ? setImageOutlineThickness(a, outlinePx) : a)
    },
    [outlinePx],
  )

  // Outline toggle: swap the active picture between its grayscale original
  // and its edge-outline variant (bed preview + G-code follow together).
  const onOutlineChange = useCallback((on: boolean) => {
    setArtwork((a) => (a ? setArtworkOutline(a, on) : a))
  }, [])

  // Outline line weight: re-render the line-art variant at the new pixel
  // size. Preview and G-code both read the active bitmap, so they track.
  const onOutlinePx = useCallback((px: number) => {
    const next = clampOutlineThickness(px)
    setOutlinePx(next)
    setArtwork((a) => (a ? setImageOutlineThickness(a, next) : a))
  }, [])

  const onClearTemplate = useCallback(() => {
    setTemplate(null)
    setArtwork(null)
    setGcode([])
  }, [])

  const emergencyStop = useCallback(async () => {
    await sendRealtime('\x18') // Ctrl-X soft reset
    await send('M5') // laser off
    await send('G90') // absolute
    await stopStream()
    pushLog('⚠ EMERGENCY STOP — soft reset + M5 + G90', 'error')
  }, [send, sendRealtime, stopStream, pushLog])

  // Text engraving handlers
  const buildTextGcodeLines = useCallback(() => {
    const speed = material?.speed_mm_min ?? 800
    const power = material?.power_percent ?? 30
    const passes = material?.passes ?? 1
    const dpi = material?.dpi ?? 300
    return generateTextGcode({
      text: textEngraveText,
      size: textEngraveFontSize,
      speed,
      powerPercent: power,
      passes,
      dpi,
      letterSpacing: textEngraveLetterSpacing,
      lineSpacing: textEngraveLineSpacing,
      center: textEngraveCenter,
      originMode: 'center',
      maxWidth: textEngraveMaxWidth > 0 ? textEngraveMaxWidth : undefined,
      originAtStart: true,
    })
  }, [textEngraveText, textEngraveFontSize, textEngraveLetterSpacing, textEngraveLineSpacing, textEngraveCenter, textEngraveMaxWidth, material])

  // Stream errors must reach the on-screen log, not die silently.
  const streamTextOrLog = useCallback(
    async (lines: string[]) => {
      try {
        await startStream(lines)
      } catch (e) {
        pushLog(
          `Could not send the text job to the laser: ${e instanceof Error ? e.message : String(e)}`,
          'error',
        )
      }
    },
    [startStream, pushLog],
  )

  const doTextFrame = useCallback(async () => {
    if (!textPreviewPaths.length) {
      pushLog('Enter text first to frame.', 'error')
      return
    }
    const { generateBoundsFrame } = await import('@shared/texasPath')
    const lines = generateBoundsFrame(textPreviewBounds, 1000)
    setGcode(lines)
    pushLog('FRAMING text bounds — laser off', 'info')
    await streamTextOrLog(lines)
  }, [textPreviewPaths, textPreviewBounds, pushLog, streamTextOrLog, setGcode])

  // Offline creation: build the text G-code with NO laser connected.
  const doTextGenerate = useCallback(() => {
    if (!textEngraveText.trim()) {
      pushLog('Enter text to engrave.', 'error')
      return
    }
    const dpi = material?.dpi ?? 300
    const lines = buildTextGcodeLines()
    setGcode(lines)
    const estimate = estimateTextEngraving(textEngraveText, textEngraveFontSize, dpi)
    pushLog(
      `GENERATED: Text "${textEngraveText.slice(0, 30)}${textEngraveText.length > 30 ? '...' : ''}" — ${lines.length} lines of G-code, ~${estimate.width.toFixed(1)}×${estimate.height.toFixed(1)}mm. Export it from the G-Code panel, or connect the laser and press ENGRAVE TEXT.`,
      'info',
    )
  }, [textEngraveText, textEngraveFontSize, material, buildTextGcodeLines, pushLog, setGcode])

  const doTextStart = useCallback(async () => {
    if (!textEngraveText.trim()) {
      pushLog('Enter text to engrave.', 'error')
      return
    }
    const dpi = material?.dpi ?? 300
    const lines = buildTextGcodeLines()
    setGcode(lines)
    const estimate = estimateTextEngraving(textEngraveText, textEngraveFontSize, dpi)
    pushLog(
      `START: Text engrave "${textEngraveText.slice(0, 30)}${textEngraveText.length > 30 ? '...' : ''}" — ${lines.length} lines, ~${estimate.width.toFixed(1)}×${estimate.height.toFixed(1)}mm`,
      'info',
    )
    await streamTextOrLog(lines)
  }, [textEngraveText, textEngraveFontSize, material, buildTextGcodeLines, pushLog, streamTextOrLog, setGcode])

  const connColor =
    connection === 'connected' ? 'ok' : connection === 'error' ? 'danger' : 'muted'

  return (
    <div className="h-screen flex flex-col bg-[#121212]">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-4 px-4 py-2.5 bg-[#1b1b1b] border-b border-[#3a3a3a]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#ff6b35] flex items-center justify-center shadow-[0_0_18px_rgba(255,107,53,0.5)]">
            <span className="text-black font-black text-lg">L</span>
          </div>
          <div className="leading-tight">
            <h1 className="text-[15px] font-bold text-white">
              LazeAway
            </h1>
            <p className="text-[10px] text-[#ff8c5c] tracking-[0.18em] font-semibold uppercase">
              Laser Control
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
                <TemplateSelector selectedId={template?.id} onSelect={onSelectTemplate} />
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

            <ArtworkPanel active={artwork} onArtwork={onArtwork} />

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
              templateName={jobName}
              imagePreview={imagePreview}
              onClearTemplate={onClearTemplate}
            />
            <GCodePanel lines={gcode} />
            <ConsolePanel />
          </div>

          {/* Right column */}
          <div className="overflow-y-auto pr-1 flex flex-col gap-3 min-h-0">
            <CutControl
              template={template}
              artwork={artwork}
              geometry={geometry}
              material={material}
              tab={tab}
              onTabChange={setTab}
              onGcode={setGcode}
              widthMm={widthMm}
              onWidthMm={setWidthMm}
              naturalWidthMm={naturalSize?.w ?? null}
              darkness={darkness}
              onDarkness={setDarkness}
              invert={invert}
              onInvert={setInvert}
              outline={artwork?.kind === 'image' ? artwork.outline : false}
              onOutline={onOutlineChange}
              outlinePx={outlinePx}
              onOutlinePx={onOutlinePx}
            />
            <TextEngravePanel
              text={textEngraveText}
              onTextChange={setTextEngraveText}
              fontSize={textEngraveFontSize}
              onFontSizeChange={setTextEngraveFontSize}
              letterSpacing={textEngraveLetterSpacing}
              onLetterSpacingChange={setTextEngraveLetterSpacing}
              lineSpacing={textEngraveLineSpacing}
              onLineSpacingChange={setTextEngraveLineSpacing}
              center={textEngraveCenter}
              onCenterChange={setTextEngraveCenter}
              maxWidth={textEngraveMaxWidth}
              onMaxWidthChange={setTextEngraveMaxWidth}
              previewPaths={textPreviewPaths}
              previewBounds={textPreviewBounds}
              _material={material}
              connected={connection === 'connected'}
              jobActive={jobActive}
              onFrame={doTextFrame}
              onStart={doTextStart}
              onGenerate={doTextGenerate}
            />
            <HeightIndicator />
            <WebcamMonitor tone={photoTone} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-[#1b1b1b] border-t border-[#3a3a3a] text-[10px] text-[#6b7280]">
        <span>
          LazeAway • 150×200mm GRBL Laser Controller
        </span>
        <span className="font-mono">
          {jobActive ? 'JOB ACTIVE' : 'IDLE'} • {connection.toUpperCase()}
        </span>
      </footer>
    </div>
  )
}
