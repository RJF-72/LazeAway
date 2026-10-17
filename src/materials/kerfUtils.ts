import type { Pt } from '../shared/texasPath'

/**
 * Apply kerf compensation for CUT operations
 * When cutting, offset path outward by kerf/2 to account for laser kerf width
 */
export function applyKerfCompensation(points: Pt[], kerfMm: number, outward: boolean = true): Pt[] {
  if (kerfMm <= 0) return points
  const offset = kerfMm / 2
  // Simple offset - for closed polygon, scale outward from centroid
  if (points.length < 3) return points
  // Calculate centroid
  let cx = 0, cy = 0
  for (const p of points) {
    cx += p.x; cy += p.y
  }
  cx /= points.length; cy /= points.length
  return points.map(p => {
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.sqrt(dx*dx + dy*dy)
    if (len === 0) return p
    const scale = (len + (outward ? offset : -offset)) / len
    return { x: cx + dx * scale, y: cy + dy * scale }
  })
}
