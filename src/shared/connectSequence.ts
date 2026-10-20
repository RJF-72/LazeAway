// The GRBL unlock / configuration sequence applied on connect.
// Shared so the renderer can re-run it on demand.
//
//  $X        unlock (clears alarm)
//  $10=0     report MPos + WCO
//  $32=1     LASER MODE ON  (required - otherwise the S1 refuses to fire)
//  $30=1000  spindle max = 1000 (0-100% maps to S0-S1000)
//  $31=0     spindle min
//  $120/$121 low acceleration to avoid the mid-job stall bug
//  M5        laser off
//  G90       absolute mode
//  G92 X0 Y0 set current position as the center origin
//  ?         request a status report
import { getConnectSequence, type MachineProfile } from './machineProfiles'

export function getConnectSequenceForProfile(profile: MachineProfile): string[] {
  return getConnectSequence(profile)
}

// Legacy default for Artilume S1 6W (backwards compatibility)
export const CONNECT_SEQUENCE: string[] = getConnectSequence({
  id: 'artilume-s1-6w',
  name: 'Artilume S1 6W',
  manufacturer: 'Artilume',
  models: ['S1'],
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
  notes: '',
  vendorId: '1a86',
  productId: '7523',
  friendlyNameMatch: ['ch340', 'wch', 'usb serial'],
})

export const CONNECT_BAUD = 115200
