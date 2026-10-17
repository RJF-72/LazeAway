import type { Material } from './materialTypes'
import library from './materialLibrary.json'

export function getAllMaterials(): Material[] {
  return library.materials as Material[]
}

export function getMaterialsByCategory(category: string): Material[] {
  return getAllMaterials().filter(m => m.category === category)
}

export function findMaterial(id: string): Material | undefined {
  return getAllMaterials().find(m => m.id === id)
}

// Texas guitar soundhole default - spruce/pine 3mm cut as specified
export const TEXAS_SPRUCE_DEFAULT = 'spruce_pine_3mm_cut_texas'

// Get all categories
export function getCategories(): string[] {
  const cats = new Set(getAllMaterials().map(m => m.category))
  return Array.from(cats).sort()
}
