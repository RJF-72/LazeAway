export function generateFocusTestGcode(focusMin: number = 20, focusMax: number = 35, step: number = 1): string[] {
  const lines: string[] = []
  lines.push('; FOCUS TEST - Artilume S1 6W')
  lines.push('; Test focus range 20-35mm in 1mm steps')
  lines.push('G90 G21')
  lines.push('M5')
  lines.push('G0 Z10')
  let y = 0
  for (let f = focusMin; f <= focusMax; f += step) {
    const label = Focus mm
    lines.push(; )
    lines.push(G0 X0 Y)
    lines.push(G0 Z) // approach
    lines.push(G1 Z F100)
    lines.push(M3 S300) // low power to mark
    lines.push(G1 X10 F500)
    lines.push(M5)
    lines.push(G0 Z)
    y += 15
  }
  lines.push('M5 G0 Z10')
  lines.push('G0 X0 Y0')
  return lines
}

export function generateKerfTestGcode(kerfGuess: number = 0.15, size: number = 10): string[] {
  const lines: string[] = []
  lines.push('; KERF TEST - Cut 10x10mm square')
  lines.push('; Measure actual vs cut size to calibrate kerf')
  lines.push('G90 G21')
  lines.push('M5 G0 Z10')
  lines.push('G0 X0 Y0')
  lines.push('G1 Z2 F100')
  lines.push('M3 S1000')
  lines.push(G1 X F250)
  lines.push(G1 Y F250)
  lines.push(G1 X0 F250)
  lines.push(G1 Y0 F250)
  lines.push('M5')
  lines.push('G0 Z10')
  return lines
}

export function generatePowerSpeedTestGcode(): string[] {
  const lines: string[] = []
  lines.push('; POWER/SPEED TEST - 5x5 Grid')
  lines.push('; Power 10-100% (S100-S1000) vs Speed 100-500mm/min')
  lines.push('G90 G21')
  lines.push('M5 G0 Z10')
  const speeds = [100, 200, 300, 400, 500]
  const powers = [10, 25, 50, 75, 100]
  let idx = 0
  for (let r = 0; r < powers.length; r++) {
    for (let c = 0; c < speeds.length; c++) {
      const x = c * 15
      const y = r * 15
      const p = powers[r]
      const s = speeds[c]
      lines.push(; P% Smm/min)
      lines.push(G0 X Y Z5)
      lines.push(M3 S)
      lines.push(G1 X Y F)
      lines.push('M5')
      idx++
    }
  }
  lines.push('G0 Z10 X0 Y0')
  return lines
}

export function generateIntervalTestGcode(): string[] {
  const lines: string[] = []
  lines.push('; INTERVAL TEST - Engrave accuracy test')
  lines.push('G90 G21')
  lines.push('M5 G0 Z10')
  const intervals = [0.06, 0.07, 0.08, 0.09, 0.1]
  for (let i = 0; i < intervals.length; i++) {
    const y = i * 10
    lines.push(; Interval mm)
    lines.push(G0 X0 Y Z5)
    lines.push(M3 S300)
    lines.push(G1 X20 F2000)
    lines.push('M5')
  }
  lines.push('G0 Z10 X0 Y0')
  return lines
}
