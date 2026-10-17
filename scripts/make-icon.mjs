// Generates build/icon.ico (and preview PNG) without external deps.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const buildDir = resolve(root, '..', 'build')
mkdirSync(buildDir, { recursive: true })

// --- Minimal PNG encoder (RGBA, 8-bit) ---
function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // raw scanlines prefixed with filter byte 0
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- Raster canvas ---
class Canvas {
  constructor(size) {
    this.size = size
    this.data = Buffer.alloc(size * size * 4)
  }
  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return
    const i = (y * this.size + x) * 4
    const da = this.data[i + 3] / 255
    const sa = a
    const oa = sa + da * (1 - sa)
    if (oa <= 0) return
    this.data[i] = Math.round((r * sa + this.data[i] * da * (1 - sa)) / oa)
    this.data[i + 1] = Math.round((g * sa + this.data[i + 1] * da * (1 - sa)) / oa)
    this.data[i + 2] = Math.round((b * sa + this.data[i + 2] * da * (1 - sa)) / oa)
    this.data[i + 3] = Math.round(oa * 255)
  }
  // filled rounded rect
  roundRect(x0, y0, x1, y1, rad, r, g, b) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        // distance to rounded corner
        const cx = x < x0 + rad ? x0 + rad : x > x1 - rad ? x1 - rad : x
        const cy = y < y0 + rad ? y0 + rad : y > y1 - rad ? y1 - rad : y
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= rad * rad) this.blend(x, y, r, g, b, 1)
      }
    }
  }
  fillCircle(cx, cy, rad, r, g, b, a = 1) {
    const r2 = rad * rad
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= r2) this.blend(x, y, r, g, b, a)
      }
    }
  }
  // crosshair lines through center
  crosshair(cx, cy, len, thick, r, g, b, a = 1) {
    for (let t = -len; t <= len; t++) {
      for (let d = -thick; d <= thick; d++) {
        this.blend(cx + t, cy + d, r, g, b, a) // horizontal
        this.blend(cx + d, cy + t, r, g, b, a) // vertical
      }
    }
  }
  toPNG() {
    return encodePNG(this.size, this.size, this.data)
  }
}

function drawIcon(size) {
  const c = new Canvas(size)
  const S = size
  const cx = S / 2
  const cy = S / 2

  // Orange rounded-square body (blue gantry accent corner)
  c.roundRect(0, 0, S, S, Math.round(S * 0.18), 0xff, 0x6b, 0x35) // #FF6B35
  // subtle darker inner plate
  c.roundRect(Math.round(S * 0.1), Math.round(S * 0.1), Math.round(S * 0.9), Math.round(S * 0.9), Math.round(S * 0.12), 0x12, 0x12, 0x12) // #121212

  // Blue gantry bar across upper third
  const barY = Math.round(S * 0.3)
  for (let x = Math.round(S * 0.12); x < S * 0.88; x++) {
    for (let t = 0; t < Math.max(1, S * 0.045); t++) {
      c.blend(x, barY + t, 0x3b, 0x82, 0xf6, 1)
    }
  }

  // laser nozzle triangle hanging from gantry center
  const nozzleTop = barY + Math.max(1, S * 0.05)
  const nozzleBottom = Math.round(S * 0.56)
  const halfTop = Math.round(S * 0.09)
  for (let y = nozzleTop; y < nozzleBottom; y++) {
    const prog = (y - nozzleTop) / (nozzleBottom - nozzleTop)
    const half = Math.max(1, Math.round(halfTop * (1 - prog)))
    for (let x = Math.round(cx - half); x <= cx + half; x++) {
      c.blend(x, y, 0xd1, 0xd5, 0xdb, 1)
    }
  }

  // bright focus point + glow
  c.crosshair(cx, nozzleBottom, Math.round(S * 0.22), Math.max(1, Math.round(S * 0.012)), 0xff, 0xe2, 0x7a, 0.35)
  c.fillCircle(cx, nozzleBottom + Math.round(S * 0.04), Math.round(S * 0.055), 0xff, 0xf7, 0x7a, 0.95)
  c.fillCircle(cx, nozzleBottom + Math.round(S * 0.04), Math.round(S * 0.022), 0xff, 0xff, 0xff, 1)

  // origin crosshair at bottom center
  c.crosshair(cx, Math.round(S * 0.78), Math.round(S * 0.14), Math.max(1, Math.round(S * 0.014)), 0xef, 0x44, 0x44, 1)
  c.fillCircle(cx, Math.round(S * 0.78), Math.round(S * 0.028), 0xef, 0x44, 0x44, 1)

  return c.toPNG()
}

// Build ICO with multiple sizes
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = sizes.map((s) => ({ size: s, png: drawIcon(s) }))

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(pngs.length, 4)

const entries = []
let offset = 6 + pngs.length * 16
for (const { size, png } of pngs) {
  const e = Buffer.alloc(16)
  e[0] = size >= 256 ? 0 : size // width
  e[1] = size >= 256 ? 0 : size // height
  e[2] = 0 // palette
  e[3] = 0
  e.writeUInt16LE(1, 4) // planes
  e.writeUInt16LE(32, 6) // bpp
  e.writeUInt32LE(png.length, 8)
  e.writeUInt32LE(offset, 12)
  entries.push(e)
  offset += png.length
}

const ico = Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)])
writeFileSync(resolve(buildDir, 'icon.ico'), ico)
writeFileSync(resolve(buildDir, 'icon.png'), drawIcon(256))
console.log('Wrote build/icon.ico and build/icon.png')
