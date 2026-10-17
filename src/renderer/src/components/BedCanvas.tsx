import { useMemo } from 'react'
import { useLaser } from '../hooks/useLaser'
import type { TemplateGeometry } from '@shared/templateGeometry'
import { Btn, Panel } from './ui'

export interface BedCanvasProps {
  geometry: TemplateGeometry | null
  templateName: string | null
  onClearTemplate: () => void
}

const BED_W = 150
const BED_H = 200

export function BedCanvas({ geometry, templateName, onClearTemplate }: BedCanvasProps) {
  const { status, trail, clearTrail } = useLaser()

  const mpos = status?.mpos ?? { x: 0, y: 0, z: 0 }
  const inside = Math.abs(mpos.x) <= BED_W / 2 && Math.abs(mpos.y) <= BED_H / 2

  // Grid lines every 10mm
  const xLines: number[] = []
  for (let x = -70; x <= 70; x += 10) xLines.push(x)
  const yLines: number[] = []
  for (let y = -90; y <= 90; y += 10) yLines.push(y)

  const trailPts = trail.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(' ')

  const bounds = geometry?.bounds ?? null
  const fitsBed = useMemo(() => {
    if (!bounds) return true
    return (
      bounds.minX >= -BED_W / 2 &&
      bounds.maxX <= BED_W / 2 &&
      bounds.minY >= -BED_H / 2 &&
      bounds.maxY <= BED_H / 2
    )
  }, [bounds])

  const pathEls = useMemo(() => {
    if (!geometry) return null
    return geometry.paths.map((pts, i) => {
      const d =
        pts.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
        (geometry.closed[i] ? ' Z' : '')
      return (
        <path
          key={i}
          d={d}
          fill={geometry.closed[i] ? 'rgba(239,68,68,0.06)' : 'none'}
          stroke="#ef4444"
          strokeWidth={1.1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )
    })
  }, [geometry])

  return (
    <Panel
      title="Bed — Center Origin (0,0)"
      right={
        <span className="text-[10px] text-[#6b7280] font-mono">
          {templateName ?? 'no template'} · ViewBox -75 -100 150 200
        </span>
      }
      bodyClassName="p-2"
    >
      <div className="flex flex-col gap-2">
        <div className="relative w-full" style={{ aspectRatio: '3 / 4' }}>
          <svg
            viewBox="-75 -100 150 200"
            className="w-full h-full rounded-lg bg-[#0d0d0d] border border-[#2c2c2c]"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* bed fill */}
            <rect x={-75} y={-100} width={150} height={200} fill="#141414" />

            {/* grid */}
            <g stroke="#2a2a2a" strokeWidth={0.25}>
              {xLines.map((x) => (
                <line key={`x${x}`} x1={x} y1={-100} x2={x} y2={100} />
              ))}
              {yLines.map((y) => (
                <line key={`y${y}`} x1={-75} y1={y} x2={75} y2={y} />
              ))}
            </g>

            {/* center axes */}
            <g stroke="#4b5563" strokeWidth={0.4}>
              <line x1={-75} y1={0} x2={75} y2={0} />
              <line x1={0} y1={-100} x2={0} y2={100} />
            </g>

            {/* bed border */}
            <rect
              x={-75}
              y={-100}
              width={150}
              height={200}
              fill="none"
              stroke="#3a3a3a"
              strokeWidth={0.6}
            />

            {/* origin crosshair + label */}
            <g stroke="#ff6b35" strokeWidth={0.8}>
              <line x1={-4} y1={0} x2={4} y2={0} />
              <line x1={0} y1={-4} x2={0} y2={4} />
            </g>
            <circle cx={0} cy={0} r={1.1} fill="#ff6b35" />
            <text x={2.5} y={-2.5} fill="#ff6b35" fontSize={4} fontWeight={700}>
              ORIGIN 0,0
            </text>

            {/* template geometry (machine coords, y-up -> flip) */}
            {pathEls && <g transform="scale(1,-1)">{pathEls}</g>}

            {/* template bounding box */}
            {bounds && (
              <rect
                x={bounds.minX}
                y={-bounds.maxY}
                width={bounds.w}
                height={bounds.h}
                fill="none"
                stroke={fitsBed ? '#ef4444' : '#eab308'}
                strokeWidth={0.4}
                strokeDasharray="2 2"
                opacity={0.8}
              />
            )}

            {/* jog trail */}
            {trail.length > 1 && (
              <polyline
                points={trailPts}
                fill="none"
                stroke="#ff6b35"
                strokeWidth={0.4}
                opacity={0.5}
              />
            )}

            {/* live position dot */}
            <circle
              cx={mpos.x}
              cy={-mpos.y}
              r={2}
              fill={inside ? '#ff3b30' : '#eab308'}
              stroke="#fff"
              strokeWidth={0.4}
            >
              <title>
                MPos {mpos.x.toFixed(2)}, {mpos.y.toFixed(2)} (Z {mpos.z.toFixed(2)})
              </title>
            </circle>

            {/* corner labels */}
            <text x={-73} y={-96} fill="#6b7280" fontSize={4}>
              X-75 Y+100
            </text>
            <text x={60} y={-96} fill="#6b7280" fontSize={4}>
              +75
            </text>
            <text x={-73} y={98} fill="#6b7280" fontSize={4}>
              Y-100
            </text>
          </svg>
        </div>

        {/* template controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="ghost" size="sm" onClick={onClearTemplate} disabled={!geometry}>
            Clear Template
          </Btn>
          <Btn variant="ghost" size="sm" onClick={clearTrail} disabled={trail.length === 0}>
            Clear Trail
          </Btn>
          <span className="text-[10px] text-[#6b7280] ml-auto tabular">
            MPos {mpos.x.toFixed(1)},{mpos.y.toFixed(1)},{mpos.z.toFixed(1)}
            {bounds && ` • ${bounds.w.toFixed(1)}×${bounds.h.toFixed(1)}mm`}
          </span>
        </div>

        {geometry && !fitsBed && (
          <div className="rounded border border-[#eab308] bg-[#eab308]/10 px-2 py-1.5 text-[11px] text-[#eab308]">
            ⚠ Template ({bounds!.w.toFixed(0)}×{bounds!.h.toFixed(0)}mm) is bigger than the
            150×200mm bed — reposition the stock or cut it in sections.
          </div>
        )}
        {geometry?.note && (
          <div className="text-[10px] text-[#6b7280]">{geometry.note}</div>
        )}
      </div>
    </Panel>
  )
}
