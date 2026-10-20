// Machine profiles for different GRBL-based laser engravers.
// Each profile defines the GRBL settings, bed size, and capabilities.

export interface MachineProfile {
  id: string
  name: string
  manufacturer: string
  models: string[]
  /** Typical laser optical power in watts (diode). */
  laserPowerW: number
  /** Maximum spindle S value (GRBL $30). */
  spindleMax: number
  /** Minimum spindle S value (GRBL $31). */
  spindleMin: number
  /** Bed dimensions in mm. */
  bedWidthMm: number
  bedHeightMm: number
  /** Workspace origin mode: 'center' (0,0 at bed center) or 'corner' (0,0 at front-left). */
  originMode: 'center' | 'corner'
  /** GRBL $10 setting: 0 = report MPos+WCO, 1 = report MPos, 2 = report WPos. */
  reportMode: 0 | 1 | 2
  /** Default acceleration X/Y (GRBL $120/$121) in mm/s^2. */
  defaultAcceleration: number
  /** Junction deviation (GRBL $122) in mm. */
  junctionDeviation?: number
  /** Steps per mm X (GRBL $100). */
  stepsPerMmX?: number
  /** Steps per mm Y (GRBL $101). */
  stepsPerMmY?: number
  /** Steps per mm Z (GRBL $102). */
  stepsPerMmZ?: number
  /** Max travel X (GRBL $130) in mm. */
  maxTravelX?: number
  /** Max travel Y (GRBL $131) in mm. */
  maxTravelY?: number
  /** Max travel Z (GRBL $132) in mm. */
  maxTravelZ?: number
  /** Homing enabled (GRBL $22). */
  homingEnabled: boolean
  /** Laser mode (GRBL $32). Must be 1 for PWM laser control. */
  laserMode: 1
  /** PWM frequency (GRBL $33) in Hz. 0 = default. */
  pwmFrequency?: number
  /** S-value for laser off (GRBL $34) if supported. */
  laserOffS?: number
  /** Soft limits (GRBL $20). */
  softLimits: boolean
  /** Hard limits (GRBL $21). */
  hardLimits: boolean
  /** Connect sequence overrides (merged with base CONNECT_SEQUENCE). */
  connectOverrides?: string[]
  /** Typical max safe cut speed for this machine (mm/min). */
  maxSafeCutSpeed: number
  /** Typical max safe jog speed (mm/min). */
  maxJogSpeed: number
  /** Supports Z-axis. */
  hasZAxis: boolean
  /** Supports air assist control via M7/M8/M9. */
  hasAirAssist: boolean
  /** Notes for the operator. */
  notes: string
  /** Vendor ID for USB detection (optional). */
  vendorId?: string
  /** Product ID for USB detection (optional). */
  productId?: string
  /** Friendly name substring for auto-detection. */
  friendlyNameMatch?: string[]
}

export const MACHINE_PROFILES: MachineProfile[] = [
  {
    id: 'artilume-s1-6w',
    name: 'Artilume S1 6W',
    manufacturer: 'Artilume',
    models: ['S1', 'S1 Pro'],
    laserPowerW: 6,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 150,
    bedHeightMm: 200,
    originMode: 'center',
    reportMode: 0,
    defaultAcceleration: 300,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 150,
    maxTravelY: 200,
    maxTravelZ: 40,
    homingEnabled: false,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: false,
    connectOverrides: ['$120=300', '$121=300'],
    maxSafeCutSpeed: 500,
    maxJogSpeed: 3000,
    hasZAxis: true,
    hasAirAssist: false,
    notes: 'Default profile for Artilume S1 6W diode. Center-origin workspace. Low acceleration prevents mid-job stalls on complex paths.',
    vendorId: '1a86',
    productId: '7523',
    friendlyNameMatch: ['ch340', 'wch', 'usb serial'],
  },
  {
    id: 'artilume-s1-10w',
    name: 'Artilume S1 10W',
    manufacturer: 'Artilume',
    models: ['S1 10W', 'S1 Pro 10W'],
    laserPowerW: 10,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 150,
    bedHeightMm: 200,
    originMode: 'center',
    reportMode: 0,
    defaultAcceleration: 300,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 150,
    maxTravelY: 200,
    maxTravelZ: 40,
    homingEnabled: false,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: false,
    connectOverrides: ['$120=300', '$121=300'],
    maxSafeCutSpeed: 600,
    maxJogSpeed: 3000,
    hasZAxis: true,
    hasAirAssist: false,
    notes: '10W module on S1 chassis. Faster cuts possible but same acceleration limits.',
    vendorId: '1a86',
    productId: '7523',
    friendlyNameMatch: ['ch340', 'wch', 'usb serial'],
  },
  {
    id: 'ortur-lm3-5w',
    name: 'Ortur Laser Master 3 (5W)',
    manufacturer: 'Ortur',
    models: ['LM3 5W', 'LM3 LU2-4-SF'],
    laserPowerW: 5,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 400,
    bedHeightMm: 400,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 1000,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 400,
    maxTravelY: 400,
    maxTravelZ: 50,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: true,
    connectOverrides: [],
    maxSafeCutSpeed: 3000,
    maxJogSpeed: 5000,
    hasZAxis: true,
    hasAirAssist: true,
    notes: 'Large bed, corner origin. Higher acceleration than S1. Supports homing and air assist.',
    vendorId: '10c4',
    productId: 'ea60',
    friendlyNameMatch: ['ortur', 'silabs', 'cp210'],
  },
  {
    id: 'ortur-lm3-10w',
    name: 'Ortur Laser Master 3 (10W/20W)',
    manufacturer: 'Ortur',
    models: ['LM3 10W', 'LM3 20W', 'LU2-10A', 'LU2-20A'],
    laserPowerW: 10,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 400,
    bedHeightMm: 400,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 1000,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 400,
    maxTravelY: 400,
    maxTravelZ: 50,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: true,
    connectOverrides: [],
    maxSafeCutSpeed: 4000,
    maxJogSpeed: 5000,
    hasZAxis: true,
    hasAirAssist: true,
    notes: 'High power modules. Can cut thicker materials. Air assist highly recommended.',
    vendorId: '10c4',
    productId: 'ea60',
    friendlyNameMatch: ['ortur', 'silabs', 'cp210'],
  },
  {
    id: 'sculpfun-s9',
    name: 'Sculpfun S9 / S10',
    manufacturer: 'Sculpfun',
    models: ['S9', 'S10', 'S6 Pro', 'S30'],
    laserPowerW: 5,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 410,
    bedHeightMm: 420,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 1000,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 410,
    maxTravelY: 420,
    maxTravelZ: 50,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: true,
    connectOverrides: [],
    maxSafeCutSpeed: 3000,
    maxJogSpeed: 5000,
    hasZAxis: true,
    hasAirAssist: true,
    notes: 'Popular budget diode lasers. Corner origin. Good acceleration. S30 has 5W/10W/20W/33W modules.',
    vendorId: '1a86',
    productId: '7523',
    friendlyNameMatch: ['sculpfun', 'ch340', 'wch'],
  },
  {
    id: 'xtool-d1',
    name: 'xTool D1 / D1 Pro',
    manufacturer: 'xTool',
    models: ['D1', 'D1 Pro 5W', 'D1 Pro 10W', 'D1 Pro 20W', 'D1 Pro 40W'],
    laserPowerW: 10,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 432,
    bedHeightMm: 406,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 2000,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 432,
    maxTravelY: 406,
    maxTravelZ: 80,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: true,
    connectOverrides: [],
    maxSafeCutSpeed: 4000,
    maxJogSpeed: 6000,
    hasZAxis: true,
    hasAirAssist: true,
    notes: 'High acceleration, large bed. xTool uses custom firmware but GRBL-compatible. D1 Pro 40W is 4x10W combined.',
    vendorId: '10c4',
    productId: 'ea60',
    friendlyNameMatch: ['xtool', 'makeblock', 'silabs'],
  },
  {
    id: 'atomstack-a5-pro',
    name: 'Atomstack A5 Pro / X7 / X20',
    manufacturer: 'Atomstack',
    models: ['A5 Pro', 'X7', 'X20', 'X30 Pro', 'X40 Pro', 'S20 Pro', 'S30 Pro'],
    laserPowerW: 10,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 410,
    bedHeightMm: 400,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 1000,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 410,
    maxTravelY: 400,
    maxTravelZ: 50,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: true,
    connectOverrides: [],
    maxSafeCutSpeed: 3000,
    maxJogSpeed: 5000,
    hasZAxis: true,
    hasAirAssist: true,
    notes: 'Wide range of models. X-series have larger beds. Higher pro models have 20W-48W combined beams.',
    vendorId: '1a86',
    productId: '7523',
    friendlyNameMatch: ['atomstack', 'ch340', 'wch'],
  },
  {
    id: 'twotrees-ts2',
    name: 'TwoTrees TS2 / TS3 / TTS-55',
    manufacturer: 'TwoTrees',
    models: ['TS2', 'TS3', 'TTS-55', 'TTS-20', 'TTS-10'],
    laserPowerW: 10,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 450,
    bedHeightMm: 450,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 1000,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 450,
    maxTravelY: 450,
    maxTravelZ: 50,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: true,
    connectOverrides: [],
    maxSafeCutSpeed: 3000,
    maxJogSpeed: 5000,
    hasZAxis: true,
    hasAirAssist: true,
    notes: 'Large square bed. Good value machines. TTS series has built-in air assist pump.',
    vendorId: '1a86',
    productId: '7523',
    friendlyNameMatch: ['twotrees', 'tts', 'ch340', 'wch'],
  },
  {
    id: 'generic-grbl-400x400',
    name: 'Generic GRBL 400x400 (Corner Origin)',
    manufacturer: 'Generic',
    models: ['Any GRBL 1.1h+ diode laser'],
    laserPowerW: 5,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 400,
    bedHeightMm: 400,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 1000,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 400,
    maxTravelY: 400,
    maxTravelZ: 50,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: false,
    connectOverrides: [],
    maxSafeCutSpeed: 3000,
    maxJogSpeed: 5000,
    hasZAxis: true,
    hasAirAssist: false,
    notes: 'Fallback for any GRBL diode laser with ~400x400mm bed and corner origin. Adjust settings for your specific machine.',
    friendlyNameMatch: [],
  },
  {
    id: 'generic-grbl-300x300',
    name: 'Generic GRBL 300x300 (Corner Origin)',
    manufacturer: 'Generic',
    models: ['Any GRBL 1.1h+ diode laser'],
    laserPowerW: 5,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 300,
    bedHeightMm: 300,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 1000,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 300,
    maxTravelY: 300,
    maxTravelZ: 50,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: false,
    connectOverrides: [],
    maxSafeCutSpeed: 3000,
    maxJogSpeed: 5000,
    hasZAxis: true,
    hasAirAssist: false,
    notes: 'Fallback for smaller GRBL diode lasers (3018, 3020, etc.). Adjust settings for your specific machine.',
    friendlyNameMatch: [],
  },
  {
    id: 'generic-grbl-center',
    name: 'Generic GRBL Center-Origin (Artilume-style)',
    manufacturer: 'Generic',
    models: ['Any GRBL 1.1h+ with center-origin workspace'],
    laserPowerW: 6,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 150,
    bedHeightMm: 200,
    originMode: 'center',
    reportMode: 0,
    defaultAcceleration: 300,
    junctionDeviation: 0.01,
    stepsPerMmX: 80,
    stepsPerMmY: 80,
    stepsPerMmZ: 800,
    maxTravelX: 150,
    maxTravelY: 200,
    maxTravelZ: 40,
    homingEnabled: false,
    laserMode: 1,
    pwmFrequency: 1000,
    softLimits: true,
    hardLimits: false,
    connectOverrides: ['$120=300', '$121=300'],
    maxSafeCutSpeed: 500,
    maxJogSpeed: 3000,
    hasZAxis: true,
    hasAirAssist: false,
    notes: 'For machines like Artilume that use center-origin (0,0 at bed center). Low acceleration prevents stalls.',
    friendlyNameMatch: [],
  },
  {
    id: 'k40-grbl',
    name: 'K40 CO2 with GRBL Controller',
    manufacturer: 'Generic',
    models: ['K40', 'K40 upgraded with GRBL'],
    laserPowerW: 40,
    spindleMax: 1000,
    spindleMin: 0,
    bedWidthMm: 300,
    bedHeightMm: 200,
    originMode: 'corner',
    reportMode: 0,
    defaultAcceleration: 500,
    junctionDeviation: 0.01,
    stepsPerMmX: 157.48,
    stepsPerMmY: 157.48,
    stepsPerMmZ: 800,
    maxTravelX: 300,
    maxTravelY: 200,
    maxTravelZ: 100,
    homingEnabled: true,
    laserMode: 1,
    pwmFrequency: 5000,
    softLimits: true,
    hardLimits: true,
    connectOverrides: [],
    maxSafeCutSpeed: 5000,
    maxJogSpeed: 8000,
    hasZAxis: true,
    hasAirAssist: true,
    notes: 'CO2 laser with GRBL upgrade (Cohesion3D, LightObject, etc.). Different steps/mm. Higher power - faster speeds. PWM freq often 5kHz for LPSU.',
    friendlyNameMatch: ['k40', 'cohesion3d', 'lightobject'],
  },
]

export function findMachineProfile(id: string): MachineProfile | undefined {
  return MACHINE_PROFILES.find((p) => p.id === id)
}

export function getDefaultProfile(): MachineProfile {
  return MACHINE_PROFILES[0] // Artilume S1 6W
}

export function detectProfileFromPort(port: { vendorId?: string; productId?: string; friendlyName?: string }): MachineProfile | undefined {
  for (const profile of MACHINE_PROFILES) {
    if (profile.vendorId && port.vendorId?.toLowerCase() === profile.vendorId.toLowerCase()) {
      if (profile.productId && port.productId?.toLowerCase() === profile.productId.toLowerCase()) {
        return profile
      }
      if (!profile.productId) return profile
    }
    if (profile.friendlyNameMatch && port.friendlyName) {
      const name = port.friendlyName.toLowerCase()
      if (profile.friendlyNameMatch.some((m) => name.includes(m.toLowerCase()))) {
        return profile
      }
    }
  }
  return undefined
}

export function getConnectSequence(profile: MachineProfile): string[] {
  const base = [
    '$X', // unlock
    `$10=${profile.reportMode}`, // report mode
    `$32=${profile.laserMode}`, // laser mode ON
    `$30=${profile.spindleMax}`, // spindle max
    `$31=${profile.spindleMin}`, // spindle min
    `$120=${profile.defaultAcceleration}`, // X accel
    `$121=${profile.defaultAcceleration}`, // Y accel
  ]
  const overrides = profile.connectOverrides ?? []
  return [...base, ...overrides, 'M5', 'G90', 'G92 X0 Y0', '?']
}

export function powerToS(percent: number, spindleMax: number = 1000): number {
  const p = Math.max(0, Math.min(100, percent))
  return Math.round((p / 100) * spindleMax)
}

export function sToPower(s: number, spindleMax: number = 1000): number {
  return Math.max(0, Math.min(100, Math.round((s / spindleMax) * 100)))
}