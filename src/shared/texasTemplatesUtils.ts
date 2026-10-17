import templates from '../templates/texasTemplates.json'
import type { TexasTemplate } from './texasTemplatesTypes'

export function getAllTexasTemplates(): TexasTemplate[] {
  return templates as TexasTemplate[]
}

export function findTexasTemplate(id: number): TexasTemplate | undefined {
  return getAllTexasTemplates().find((t) => t.id === id)
}
