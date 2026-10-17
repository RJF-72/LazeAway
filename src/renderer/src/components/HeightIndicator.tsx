import { useState } from 'react'
import { Panel, Field } from './ui'

type Zone = 'perfect' | 'ok' | 'bad'

function classify(d: number): Zone {
  if (d < 20 || d > 35) return 'bad'
  if (d >= 25 && d <= 30) return 'perfect'
  return 'ok'
}

const zoneStyle: Record<Zone, { stroke: string; text: string; label: string; bg: string }> = {
  perfect: {
    stroke: '#22c55e',
    text: 'text-[#22c55e]',
    bg: 'bg-[#22c55e]',
    label: 'PERFECT FOCUS',
  },
  ok: {
    stroke: '#eab308',
    text: 'text-[#eab308]',
    bg: 'bg-[#eab308]',
    label: 'ACCEPTABLE',
  },
  bad: {
    stroke: '#ef4444',
    text: 'text-[#ef4444]',
    bg: 'bg-[#ef4444]',
    label: 'OUT OF RANGE',
  },
}

export function HeightIndicator() {
  const [thickness, setThickness] = useState(3) // spruce 3mm
  const [focusBlock, setFocusBlock] = useState(20)
  const [distance, setDistance] = useState(27.5) // nozzle -> material, mm

  const zone = classify(distance)
  const style = zoneStyle[zone]

  // ---- diagram geometry (px) ----
  const scale = 4.6 // px per mm for the gap
  const bedY = 244
  const matPx = Math.max(6, thickness * 4)
  const matTop = bedY - matPx
  const gapPx = distance * scale
  const nozzleY = Math.max(8, matTop - gapPx)
  const headTop = Math.max(0, nozzleY - 56)

  const W = 260
  const cx = 118

  return (
    <Panel title="Height / Focus Indicator">
      <div className="flex flex-col gap-3">
        <div className="rounded-lg bg-[#0d0d0d] border border-[#2c2c2c] overflow-hidden">
          <svg viewBox={`0 0 ${W} ${bedY + 16}`} className="w-full h-[230px]">
            {/* bed */}
            <rect x={8} y={bedY} width={W - 16} height={14} fill="#3a3a3a" />
            <rect x={8} y={bedY} width={W - 16} height={3} fill="#5a5a5a" />
            <text x={12} y={bedY + 11} fill="#9ca3af" fontSize={8}>
              BED / honeycomb
            </text>

            {/* material */}
            <rect x={40} y={matTop} width={W - 80} height={matPx} fill="#8a5a2b" />
            <rect
              x={40}
              y={matTop}
              width={W - 80}
              height={matPx}
              fill="none"
              stroke="#b07d45"
              strokeWidth={0.8}
            />
            <text x={46} y={matTop + matPx / 2 + 3} fill="#f6e6cf" fontSize={8}>
              material {thickness}mm
            </text>

            {/* gantry / head block */}
            <rect x={cx - 42} y={headTop} width={84} height={22} rx={3} fill="#3b82f6" />
            <text x={cx - 34} y={headTop + 15} fill="#fff" fontSize={9} fontWeight={700}>
              LASER HEAD
            </text>
            {/* blue gantry rail */}
            <rect x={8} y={headTop - 6} width={W - 16} height={5} rx={2} fill="#1d4ed8" />

            {/* orange laser shield (stays ON while cutting) */}
            <path
              d={`M ${cx - 24} ${headTop + 22} L ${cx + 24} ${headTop + 22} L ${cx + 12} ${nozzleY - 4} L ${cx - 12} ${nozzleY - 4} Z`}
              fill="rgba(255,107,53,0.28)"
              stroke="#ff6b35"
              strokeWidth={1.2}
            />
            {/* nozzle */}
            <rect x={cx - 6} y={nozzleY - 10} width={12} height={10} fill="#d1d5db" />
            <path d={`M ${cx - 4} ${nozzleY} L ${cx + 4} ${nozzleY} L ${cx} ${nozzleY + 4} Z`} fill="#9ca3af" />

            {/* focus gap measurement */}
            <line x1={cx + 46} y1={nozzleY} x2={cx + 46} y2={matTop} stroke={style.stroke} strokeWidth={1.2} />
            <line x1={cx + 40} y1={nozzleY} x2={cx + 52} y2={nozzleY} stroke={style.stroke} strokeWidth={1.2} />
            <line x1={cx + 40} y1={matTop} x2={cx + 52} y2={matTop} stroke={style.stroke} strokeWidth={1.2} />
            <text
              x={cx + 54}
              y={(nozzleY + matTop) / 2 + 3}
              fill={style.stroke}
              fontSize={10}
              fontWeight={700}
            >
              {distance.toFixed(1)}mm
            </text>

            {/* focus block ghost */}
            <rect
              x={cx - 34}
              y={matTop - focusBlock * scale}
              width={20}
              height={focusBlock * scale}
              fill="rgba(148,163,184,0.12)"
              stroke="#94a3b8"
              strokeWidth={0.6}
              strokeDasharray="3 3"
            />
            <text
              x={cx - 60}
              y={matTop - (focusBlock * scale) / 2}
              fill="#94a3b8"
              fontSize={8}
            >
              focus block
            </text>
            <text
              x={cx - 60}
              y={matTop - (focusBlock * scale) / 2 + 9}
              fill="#94a3b8"
              fontSize={8}
            >
              {focusBlock}mm
            </text>

            {/* orange shield warning */}
            <text x={8} y={headTop + 12} fill="#ff8c5c" fontSize={8}>
              ⚠ orange shield ON
            </text>
          </svg>
        </div>

        {/* status banner */}
        <div
          className="rounded-lg px-3 py-2 border text-center"
          style={{
            borderColor: style.stroke,
            background: `${style.stroke}18`,
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <span className={`w-3 h-3 rounded-full ${style.bg}`} />
            <span className={`font-bold tracking-wide text-sm ${style.text}`}>
              {style.label}
            </span>
          </div>
          <div className="text-[11px] text-[#9ca3af] mt-0.5">
            Nozzle→material <b>{distance.toFixed(1)}mm</b> • ideal 25–30mm
          </div>
        </div>

        {/* inputs */}
        <div className="grid grid-cols-3 gap-2">
          <Field label="Material mm">
            <input
              className="field"
              type="number"
              min={0.5}
              max={30}
              step={0.5}
              value={thickness}
              onChange={(e) => setThickness(Math.max(0.5, Number(e.target.value) || 0.5))}
            />
          </Field>
          <Field label="Focus block mm">
            <input
              className="field"
              type="number"
              min={1}
              max={40}
              step={0.5}
              value={focusBlock}
              onChange={(e) => setFocusBlock(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="Nozzle→mat mm">
            <input
              className="field"
              type="number"
              min={0}
              max={60}
              step={0.5}
              value={distance}
              onChange={(e) => setDistance(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>

        <input
          type="range"
          min={10}
          max={45}
          step={0.5}
          value={distance}
          onChange={(e) => setDistance(Number(e.target.value))}
        />
        <div className="flex justify-between text-[10px] text-[#6b7280] -mt-2">
          <span className="text-[#ef4444]">&lt;20 red</span>
          <span className="text-[#eab308]">20–25</span>
          <span className="text-[#22c55e]">25–30 perfect</span>
          <span className="text-[#eab308]">30–35</span>
          <span className="text-[#ef4444]">&gt;35 red</span>
        </div>

        <div className="rounded-lg bg-[#161616] border border-[#3a3a3a] p-3 text-[11px] leading-relaxed text-[#c9c9c9]">
          <p>
            <b className="text-[#ff6b35]">To adjust focus:</b> Loosen the silver
            thumbscrew on the blue gantry, slide the head up/down to the target
            gap, then lock the thumbscrew.
          </p>
          <p className="mt-1.5 text-[#9ca3af]">
            Set the gap using the {focusBlock}mm focus block resting on the
            material, touching the nozzle. Fixed focus ≈25–30mm nozzle-to-material.
          </p>
          <p className="mt-1.5 text-[#ff8c5c]">
            ⚠ The <b>orange shield stays ON while cutting</b>. Only remove it for
            focusing / setup, never during a job.
          </p>
        </div>
      </div>
    </Panel>
  )
}
