// Material presets tuned for the Artilume S1 6W. Speeds are deliberately kept
// low (<=500mm/min on complex paths) to avoid the mid-job stall bug where the
// controller freezes if acceleration is high or the planner is starved.

export interface MaterialPreset {
  id: string
  label: string
  category: 'cut' | 'engrave' | 'mark'
  power: number // 0-100 %
  speed: number // mm/min
  passes: number
  zStep: number // mm Z drop per pass
  dpi: number
  notes?: string
}

export const PRESETS: MaterialPreset[] = [
  {
    id: 'spruce-3-cut',
    label: 'Spruce 3mm CUT (anti-stutter safe)',
    category: 'cut',
    power: 100,
    speed: 250,
    passes: 10,
    zStep: 0,
    dpi: 300,
    notes: 'Slow + many passes. 250mm/min keeps the S1 planner fed on the Texas path.',
  },
  {
    id: 'basswood-3-cut',
    label: 'Basswood 3mm CUT',
    category: 'cut',
    power: 100,
    speed: 300,
    passes: 12,
    zStep: 0,
    dpi: 300,
    notes: 'Denser than spruce - add passes rather than speed.',
  },
  {
    id: 'texas-soundhole-cut',
    label: 'Texas Soundhole preset',
    category: 'cut',
    power: 100,
    speed: 250,
    passes: 12,
    zStep: 0,
    dpi: 300,
    notes: 'Optimized for the 95mm Texas outline. Collinear merge keeps segments under buffer limits.',
  },
  {
    id: 'spruce-3-engrave',
    label: 'Spruce 3mm ENGRAVE',
    category: 'engrave',
    power: 30,
    speed: 800,
    passes: 1,
    zStep: 0,
    dpi: 300,
    notes: 'Raster engrave. Lower power, higher speed, single pass.',
  },
  {
    id: 'mark',
    label: 'MARK / score line',
    category: 'mark',
    power: 12,
    speed: 600,
    passes: 1,
    zStep: 0,
    dpi: 300,
    notes: 'Light surface mark for layout lines.',
  },
]

export function presetById(id: string): MaterialPreset | undefined {
  return PRESETS.find((p) => p.id === id)
}

/** Default tab selection maps to a preset category. */
export const DEFAULT_PRESET_BY_TAB: Record<'CUT' | 'ENGRAVE' | 'MARK', string> = {
  CUT: 'spruce-3-cut',
  ENGRAVE: 'spruce-3-engrave',
  MARK: 'mark',
}
