import { useMemo, useState } from 'react'
import { getAllTexasTemplates } from '@shared/texasTemplatesUtils'
import type { TexasTemplate } from '@shared/texasTemplatesTypes'

export interface TemplateSelectorProps {
  onSelect: (template: TexasTemplate | undefined) => void
  defaultId?: number
}

export function TemplateSelector({ onSelect, defaultId }: TemplateSelectorProps) {
  const templates = useMemo(() => getAllTexasTemplates(), [])
  const [selectedId, setSelectedId] = useState<number | undefined>(defaultId)

  const handleChange = (id: string) => {
    const num = Number(id)
    const t = templates.find((x) => x.id === num)
    setSelectedId(num)
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
