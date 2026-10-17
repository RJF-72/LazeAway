import { useRef } from 'react'
import { Btn, Panel } from './ui'

export function GCodePanel({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const exportFile = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `artilume-job-${Date.now()}.nc`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      ref.current?.select()
      document.execCommand('copy')
    }
  }

  const motionCount = lines.filter((l) => /^G[01]/.test(l)).length

  return (
    <Panel
      title="G-Code Generator"
      right={
        <span className="text-[10px] text-[#6b7280] font-mono">
          {lines.length} lines • {motionCount} motion
        </span>
      }
      bodyClassName="p-2"
    >
      <div className="flex flex-col gap-2">
        <textarea
          ref={ref}
          readOnly
          value={lines.join('\n')}
          spellCheck={false}
          placeholder="G-code appears here when you START or FRAME a job, or load a template."
          className="field w-full h-[180px] resize-none text-[11px] leading-[1.45] whitespace-pre overflow-auto"
        />
        <div className="flex gap-2">
          <Btn size="sm" variant="ghost" disabled={lines.length === 0} onClick={exportFile}>
            Export .nc
          </Btn>
          <Btn size="sm" variant="ghost" disabled={lines.length === 0} onClick={() => void copy()}>
            Copy
          </Btn>
          <span className="text-[10px] text-[#6b7280] self-center ml-auto">
            Center origin • G90/G21 • M4 dynamic laser
          </span>
        </div>
      </div>
    </Panel>
  )
}
