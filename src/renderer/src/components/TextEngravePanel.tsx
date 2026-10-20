import { Btn, Field, Panel } from './ui'
import type { Pt } from '@shared/texasPath'

export interface TextEngravePanelProps {
  text: string
  onTextChange: (text: string) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  letterSpacing: number
  onLetterSpacingChange: (spacing: number) => void
  lineSpacing: number
  onLineSpacingChange: (spacing: number) => void
  center: boolean
  onCenterChange: (center: boolean) => void
  maxWidth: number
  onMaxWidthChange: (width: number) => void
  previewPaths: Pt[][]
  previewBounds: { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number }
  // material is kept for future use (e.g., showing estimated time)
  _material: { power_percent: number; speed_mm_min: number; passes: number; dpi: number } | null
  connected: boolean
  jobActive: boolean
  onFrame: () => void
  onStart: () => void
}

export function TextEngravePanel({
  text,
  onTextChange,
  fontSize,
  onFontSizeChange,
  letterSpacing,
  onLetterSpacingChange,
  lineSpacing,
  onLineSpacingChange,
  center,
  onCenterChange,
  maxWidth,
  onMaxWidthChange,
  previewPaths,
  previewBounds,
  _material: _,
  connected,
  jobActive,
  onFrame,
  onStart,
}: TextEngravePanelProps) {
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onTextChange(e.target.value)
  }

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFontSizeChange(Math.max(1, Math.min(200, Number(e.target.value) || 10)))
  }

  const handleLetterSpacingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onLetterSpacingChange(Math.max(0.1, Math.min(3, Number(e.target.value) || 1)))
  }

  const handleLineSpacingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onLineSpacingChange(Math.max(0.5, Math.min(3, Number(e.target.value) || 1.2)))
  }

  const handleMaxWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onMaxWidthChange(Math.max(0, Number(e.target.value) || 0))
  }

  const handleCenterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCenterChange(e.target.checked)
  }

  return (
    <Panel title="Text Engrave">
      <div className="flex flex-col gap-3">
        <Field label="Text" hint="Multi-line supported">
          <textarea
            className="field w-full min-h-[80px] resize-y font-mono text-xs"
            value={text}
            onChange={handleTextChange}
            placeholder="Type a name, word, or phrase..."
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Font size (mm)">
            <input
              className="field"
              type="number"
              min={1}
              max={200}
              step={0.5}
              value={fontSize}
              onChange={handleFontSizeChange}
            />
          </Field>
          <Field label="Letter spacing">
            <input
              className="field"
              type="number"
              min={0.1}
              max={3}
              step={0.1}
              value={letterSpacing}
              onChange={handleLetterSpacingChange}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Line spacing">
            <input
              className="field"
              type="number"
              min={0.5}
              max={3}
              step={0.1}
              value={lineSpacing}
              onChange={handleLineSpacingChange}
            />
          </Field>
          <Field label="Max width (0=auto)">
            <input
              className="field"
              type="number"
              min={0}
              max={150}
              step={1}
              value={maxWidth}
              onChange={handleMaxWidthChange}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={center}
            onChange={handleCenterChange}
            className="accent-[#ff6b35] w-4 h-4"
          />
          <span className="text-[11px] text-[#9ca3af]">Center text at origin</span>
        </label>

        {previewPaths.length > 0 && (
          <div className="rounded-lg bg-[#161616] border border-[#3a3a3a] p-2 text-[10px] text-[#6b7280]">
            <div className="font-semibold text-[#9ca3af] mb-1">Preview bounds</div>
            <div className="font-mono tabular">
              {previewBounds.w.toFixed(1)} × {previewBounds.h.toFixed(1)} mm
            </div>
            <div className="text-[10px] text-[#6b7280]">
              {previewPaths.length} stroke(s)
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="gantry"
            disabled={!connected || jobActive || !previewPaths.length}
            onClick={onFrame}
          >
            ⧉ FRAME
          </Btn>
          <Btn
            variant="accent"
            size="lg"
            className="col-span-2 py-3 text-base"
            disabled={!connected || jobActive || !text.trim()}
            onClick={onStart}
          >
            ▶ ENGRAVE TEXT
          </Btn>
        </div>

        <p className="text-[10px] text-[#6b7280] leading-relaxed">
          Uses built-in stroke font. For custom fonts, import an SVG via Artwork panel.
        </p>
      </div>
    </Panel>
  )
}