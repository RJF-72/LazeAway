import { useMemo } from 'react'
import { getAllTexasTemplates } from '@shared/texasTemplatesUtils'
import type { TexasTemplate } from '@shared/texasTemplatesTypes'

export interface TemplateSelectorProps {
  onSelect: (template: TexasTemplate | undefined) => void
  /** Controlled selection — kept in sync with the app's active template. */
  selectedId?: number
}

export function TemplateSelector({ onSelect, selectedId }: TemplateSelectorProps) {
  const templates = useMemo(() => getAllTexasTemplates(), [])

  const handleChange = (id: string) => {
    const num = Number(id)
    const t = templates.find((x) => x.id === num)
    onSelect(t)
  }

  return (
    <select
      value={selectedId ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full px-2 py-1.5 text-xs bg-[#161616] border border-[#3a3a3a] rounded text-white"
    >
      <option value="">Select template...</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.id}. {t.name} - {t.type}
        </option>
      ))}
    </select>
  )
}
