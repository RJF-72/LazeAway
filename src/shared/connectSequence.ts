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
export const CONNECT_SEQUENCE: string[] = [
  '$X',
  '$10=0',
  '$32=1',
  '$30=1000',
  '$31=0',
  '$120=300',
  '$121=300',
  'M5',
  'G90',
  'G92 X0 Y0',
  '?',
]

export const CONNECT_BAUD = 115200
