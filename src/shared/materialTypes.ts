import type { PhotoTone } from './photoTone'

export interface Material {
  id: string
  name: string
  category: string
  thickness_mm: number
  operation: 'CUT' | 'ENGRAVE' | 'MARK'
  power_percent: number
  speed_mm_min: number
  passes: number
  z_step_per_pass_mm: number
  focus_distance_mm: number
  interval_mm: number
  dpi: number
  kerf_mm: number
  air_assist: boolean
  notes: string
  color: string
  coating_required: boolean
  /** Webcam snapshot exposure preset tuned for this stock. */
  photo_tone: PhotoTone
}
export interface MaterialLibrary { materials: Material[] }
