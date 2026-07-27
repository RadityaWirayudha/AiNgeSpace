/**
 * Generates `build/icon.png` — the app icon electron-builder turns into the
 * Windows .ico.
 *
 * The one raster asset in the repo (`public/favicon.png`) is 1100×960, and
 * electron-builder rejects non-square icons, so the mark is drawn here instead.
 * Doing it with signed distance fields keeps the whole thing dependency-free:
 * no sharp, no canvas, no ImageMagick — none of which are installed, and two of
 * which would need the MSVC toolchain this machine does not have.
 *
 * Palette follows referensi.md §2: app background, live orange, accent green.
 *
 *   node scripts/make-icon.mjs [size]
 */
import { deflateSync } from "node:zlib"
import { writeFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SIZE = Number(process.argv[2]) || 512

const BG = [0x0e, 0x0e, 0x10]
const BORDER = [0x26, 0x26, 0x2b]
const ORANGE = [0xe0, 0x81, 0x3c]
const GREEN = [0x3e, 0xcf, 0x8e]

// ---------------------------------------------------------------- geometry --

function roundedRectDist(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - (halfW - r)
  const qy = Math.abs(py - cy) - (halfH - r)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r
}

/** Distance to a line segment — a capsule once the thickness is subtracted. */
function segmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** 1px-wide analytic antialiasing: coverage of the half-plane d < 0. */
function coverage(d) {
  return Math.min(1, Math.max(0, 0.5 - d))
}

function over(dst, i, rgb, alpha) {
  if (alpha <= 0) return
  const a = Math.min(1, alpha)
  dst[i] = Math.round(dst[i] * (1 - a) + rgb[0] * a)
  dst[i + 1] = Math.round(dst[i + 1] * (1 - a) + rgb[1] * a)
  dst[i + 2] = Math.round(dst[i + 2] * (1 - a) + rgb[2] * a)
  dst[i + 3] = Math.round(dst[i + 3] * (1 - a) + 255 * a)
}

// ------------------------------------------------------------------ render --

function render(size) {
  const s = size / 512 // all coordinates below are authored at 512
  const px = new Uint8Array(size * size * 4) // zero-filled = transparent

  const halfW = 256 * s
  const radius = 112 * s
  const center = size / 2

  // `❯` drawn as two capsules meeting at the vertex, plus a prompt underscore.
  const chevron = [
    [170 * s, 152 * s, 274 * s, 256 * s],
    [274 * s, 256 * s, 170 * s, 360 * s],
  ]
  const strokeHalf = 21 * s
  const bar = [306 * s, 358 * s, 402 * s, 358 * s]
  const barHalf = 17 * s

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5
      const cy = y + 0.5
      const i = (y * size + x) * 4

      const dPanel = roundedRectDist(cx, cy, center, center, halfW, halfW, radius)
      const panel = coverage(dPanel)
      if (panel <= 0) continue

      over(px, i, BG, panel)

      // Inner hairline so the icon keeps an edge on a dark taskbar.
      const stroke = 2.5 * s
      over(px, i, BORDER, coverage(Math.abs(dPanel + stroke / 2) - stroke / 2) * panel)

      let dGlyph = Infinity
      for (const [ax, ay, bx, by] of chevron) {
        dGlyph = Math.min(dGlyph, segmentDist(cx, cy, ax, ay, bx, by))
      }
      over(px, i, ORANGE, coverage(dGlyph - strokeHalf) * panel)

      const dBar = segmentDist(cx, cy, bar[0], bar[1], bar[2], bar[3])
      over(px, i, GREEN, coverage(dBar - barHalf) * panel)
    }
  }

  return px
}

// --------------------------------------------------------------- png encode --

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, "ascii")
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePng(pixels, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // One filter byte per scanline. Filter 0 (None) compresses fine here and
  // keeps the encoder trivial.
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

// -------------------------------------------------------------------- main --

const out = join(root, "build", "icon.png")
await mkdir(dirname(out), { recursive: true })
const png = encodePng(render(SIZE), SIZE)
await writeFile(out, png)
console.log(`[make-icon] wrote ${out} (${SIZE}x${SIZE}, ${png.length} bytes)`)
