import { useCallback, useEffect, useRef, useState } from 'react'
import { useLaser } from '../hooks/useLaser'
import { Btn, Field } from './ui'

type Dir = 'up' | 'down' | 'left' | 'right' | 'ul' | 'ur' | 'dl' | 'dr'

const arrow: Record<Dir, string> = {
  ul: '↖',
  up: '↑',
  ur: '↗',
  left: '←',
  right: '→',
  dl: '↙',
  down: '↓',
  dr: '↘',
}

const vector: Record<Dir, [number, number]> = {
  ul: [-1, 1],
  up: [0, 1],
  ur: [1, 1],
  left: [-1, 0],
  right: [1, 0],
  dl: [-1, -1],
  down: [0, -1],
  dr: [1, -1],
}

const LAYOUT: (Dir | 'center' | null)[] = [
  'ul',
  'up',
  'ur',
  'left',
  'center',
  'right',
  'dl',
  'down',
  'dr',
]

export function JogPad() {
  const { jog, homeToCenter, connection, jogCancel } = useLaser()
  const [distance, setDistance] = useState(10)
  const [feed, setFeed] = useState(1000)
  const disabled = connection !== 'connected'

  // Continuous jog: while a direction is held, keep sending small relative
  // moves. This is the standard fix for laser controllers that lack true
  // continuous ($J=) jogging - a single long G1 would block the next command.
  const holdRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const dirRef = useRef<Dir | null>(null)
  const [holding, setHolding] = useState<Dir | null>(null)

  const stopHold = useCallback(() => {
    if (holdRef.current !== null) {
      clearTimeout(holdRef.current)
      clearInterval(holdRef.current)
      holdRef.current = null
    }
    setHolding(null)
    dirRef.current = null
  }, [])

  useEffect(() => stopHold, [stopHold])

  const doStep = useCallback(
    (dir: Dir, step: number) => {
      const [sx, sy] = vector[dir]
      // Normalize diagonals so speed feels consistent.
      const norm = sx !== 0 && sy !== 0 ? Math.SQRT1_2 : 1
      void jog(sx * step * norm, sy * step * norm, feed)
    },
    [jog, feed],
  )

  const onDown = useCallback(
    (dir: Dir) => {
      if (disabled) return
      startRef.current = Date.now()
      dirRef.current = dir
      // After a short hold, switch to continuous mode.
      holdRef.current = window.setTimeout(() => {
        setHolding(dir)
        const contStep = Math.max(0.5, Math.min(distance, 2))
        doStep(dir, contStep)
        holdRef.current = window.setInterval(() => {
          if (dirRef.current) doStep(dirRef.current, contStep)
        }, 120)
      }, 260)
    },
    [disabled, distance, doStep],
  )

  const onUp = useCallback(
    (dir: Dir) => {
      const held = Date.now() - startRef.current
      const wasHolding = holding === dir
      stopHold()
      if (disabled) return
      // Tap (short press) -> move the full selected distance.
      if (held < 260 && !wasHolding) {
        doStep(dir, distance)
      }
    },
    [disabled, distance, doStep, holding, stopHold],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jog step">
          <select
            className="field"
            value={distance}
            onChange={(e) => setDistance(Number(e.target.value))}
          >
            <option value={1}>1 mm</option>
            <option value={10}>10 mm</option>
            <option value={25}>25 mm</option>
          </select>
        </Field>
        <Field label="Feed mm/min">
          <input
            className="field"
            type="number"
            min={50}
            max={3000}
            step={50}
            value={feed}
            onChange={(e) => setFeed(Math.max(50, Number(e.target.value) || 50))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-1.5 select-none">
        {LAYOUT.map((cell, i) => {
          if (cell === null) return <div key={i} />
          if (cell === 'center') {
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => void homeToCenter()}
                title="Home to center (0,0)"
                className="btn bg-[#1f2937] hover:bg-[#273447] border-[#3b82f6] text-[#93c5fd] h-12 text-lg disabled:opacity-40"
              >
                ⌂
              </button>
            )
          }
          return (
            <button
              key={i}
              disabled={disabled}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                onDown(cell)
              }}
              onPointerUp={() => onUp(cell)}
              onPointerLeave={() => {
                if (holding === cell) stopHold()
              }}
              title={holding === cell ? 'Continuous jogging...' : `${distance}mm`}
              className={`btn h-12 text-xl border-[#3a3a3a] ${
                holding === cell
                  ? 'bg-[#ff6b35] text-black border-[#ff6b35]'
                  : 'bg-[#2c2c2c] hover:bg-[#383838] text-white'
              } disabled:opacity-40`}
            >
              {arrow[cell]}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <Btn
          variant="ghost"
          className="flex-1"
          disabled={disabled}
          onClick={() => void jogCancel()}
          title="Soft-reset to cancel any move"
        >
          Cancel Jog
        </Btn>
      </div>
      <p className="text-[10px] text-[#6b7280] leading-relaxed">
        Tap = step the selected distance. Hold = continuous jog (repeat moves).
      </p>
    </div>
  )
}
