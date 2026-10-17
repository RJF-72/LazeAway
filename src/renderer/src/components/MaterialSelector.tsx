import { useMemo, useState } from 'react'
import { getAllMaterials, getCategories, findMaterial, TEXAS_SPRUCE_DEFAULT } from '@shared/materialUtils'
import type { Material } from '@shared/materialTypes'
import { Btn, Field } from './ui'

export interface MaterialSelectorProps {
  onMaterialSelect: (material: Material | undefined) => void
  defaultMaterialId?: string
}

export function MaterialSelector({
  onMaterialSelect,
  defaultMaterialId = TEXAS_SPRUCE_DEFAULT,
}: MaterialSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedId, setSelectedId] = useState(defaultMaterialId)

  const materials = useMemo(() => getAllMaterials(), [])
  const categories = useMemo(() => ['All', ...getCategories()], [])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return materials.filter((m) => {
      const matchesSearch =
        q === '' || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [materials, searchTerm, selectedCategory])

  const selected = selectedId ? findMaterial(selectedId) : undefined

  const handleSelect = (id: string) => {
    setSelectedId(id)
    onMaterialSelect(id ? findMaterial(id) : undefined)
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>()
    for (const m of filtered) {
      const list = map.get(m.category) ?? []
      list.push(m)
      map.set(m.category, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search materials..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs bg-[#161616] border border-[#3a3a3a] rounded text-white"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-2 py-1.5 text-xs bg-[#161616] border border-[#3a3a3a] rounded text-white"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <Field label="Material">
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-[#161616] border border-[#3a3a3a] rounded text-white"
        >
          <option value="">Select material...</option>
          {grouped.map(([category, items]) => (
            <optgroup key={category} label={category}>
              {items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.operation}) - {m.thickness_mm}mm
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      {selected && (
        <div className="flex flex-col gap-2 rounded border border-[#3a3a3a] bg-[#161616] p-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <span className="text-[#9ca3af]">Operation</span>
            <span className="text-right font-semibold">{selected.operation}</span>
            <span className="text-[#9ca3af]">Power</span>
            <span className="text-right font-semibold">{selected.power_percent}%</span>
            <span className="text-[#9ca3af]">Speed</span>
            <span className="text-right font-semibold">{selected.speed_mm_min} mm/min</span>
            <span className="text-[#9ca3af]">Passes</span>
            <span className="text-right font-semibold">{selected.passes}</span>
            <span className="text-[#9ca3af]">Z step</span>
            <span className="text-right font-semibold">{selected.z_step_per_pass_mm} mm</span>
            <span className="text-[#9ca3af]">Focus</span>
            <span className="text-right font-semibold">{selected.focus_distance_mm} mm</span>
            <span className="text-[#9ca3af]">Interval</span>
            <span className="text-right font-semibold">{selected.interval_mm} mm</span>
            <span className="text-[#9ca3af]">Kerf</span>
            <span className="text-right font-semibold">{selected.kerf_mm} mm</span>
            <span className="text-[#9ca3af]">DPI</span>
            <span className="text-right font-semibold">{selected.dpi}</span>
          </div>

          {selected.coating_required && (
            <div className="rounded border border-[#eab308] bg-[#eab308]/10 px-2 py-1.5 text-[11px] text-[#eab308]">
              Coating required - {selected.notes}
            </div>
          )}
          {!selected.coating_required && selected.notes && (
            <p className="text-[10px] text-[#6b7280]">{selected.notes}</p>
          )}

          <Btn size="sm" variant="accent" onClick={() => onMaterialSelect(selected)}>
            Apply settings
          </Btn>
        </div>
      )}
    </div>
  )
}
