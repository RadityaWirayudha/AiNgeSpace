/**
 * Generates `build/icon.png` — the app icon electron-builder turns into the
 * Windows .ico (taskbar, Start menu, installer, desktop shortcut).
 *
 *   node scripts/make-icon.mjs [size]
 *
 * Why this file exists at all: electron-builder wants a square raster, and
 * nothing in this repo can turn an SVG into one. sharp, canvas and ImageMagick
 * are all absent, and two of the three need the MSVC toolchain this machine does
 * not have. So the artwork is rasterised here, dependency-free.
 *
 * Unlike the version this replaced — which hand-drew a `❯_` glyph out of signed
 * distance fields and therefore drifted from the real logo the moment the logo
 * changed — this one rasterises the actual path data from
 * `logo/wizard-fire-logo-v3.svg`. The paths are copied into PETALS/CREST below;
 * when the artwork changes, replace the strings and re-run. Nothing else here
 * knows what the shape is.
 *
 * Two deliberate departures from the source artwork, both because the .ico this
 * feeds also has to survive being downscaled to 16×16 by electron-builder:
 *
 *  - The spark particles (r=2 at 512) and the corner brackets (1.5px strokes)
 *    are dropped. Below ~128px they are not decoration, they are noise.
 *  - The pinwheel is scaled 1.18× about the centre, matching public/favicon.svg.
 *    The source leaves generous padding that reads as air in a 512px logo and as
 *    wasted pixels in a taskbar.
 */
import { deflateSync } from "node:zlib"
import { writeFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SIZE = Number(process.argv[2]) || 512

/** Vertical supersampling. Horizontal coverage is computed analytically. */
const SUBSAMPLES = 8

/** See the header note: the artwork's padding is too generous for an icon. */
const ZOOM = 1.18

// ------------------------------------------------------------------ artwork --

const PLATE = {
  radius: 96,
  // radialGradient cx/cy 50% r 75% over a 512 box.
  gradientRadius: 0.75 * 512,
  stops: [
    [0.0, [0x1a, 0x18, 0x29]],
    [0.65, [0x12, 0x11, 0x18]],
    [1.0, [0x09, 0x09, 0x0c]],
  ],
}

/**
 * Blurred discs behind the flames. `feGaussianBlur stdDeviation="30"` over a
 * filled circle has a closed-form profile, so these are evaluated analytically
 * rather than blurred — see `blurredDiscAlpha`.
 */
const AMBIENT = [
  { r: 130, sigma: 30, opacity: 0.18, rgb: [0x93, 0x33, 0xea] },
  { r: 80, sigma: 30, opacity: 0.15, rgb: [0xec, 0x48, 0x99] },
]

const CREST = [
  // The dashed r=170 ring is drawn solid here; a "6 10" dash pattern at 1.5px
  // is below the resolution of every size this icon is ever shown at.
  { r: 170, rgb: [0xc0, 0x26, 0xd3], opacity: 0.2, width: 1.5 },
  { r: 148, rgb: [0x93, 0x33, 0xea], opacity: 0.2, width: 1.5 },
]

/**
 * `stops` are the three colour stops of the quadrant's linear gradient, which
 * runs bottom-left → top-right across the path's own bounding box (SVG's
 * default `objectBoundingBox` gradient units).
 */
const PETALS = [
  {
    body: "M 235,115 C 175,120 128,160 132,222 C 134,242 148,246 164,238 C 186,226 204,202 218,178 C 228,160 236,138 235,115 Z",
    core: "M 224,136 C 186,146 156,176 158,212 C 168,206 185,190 198,170 C 208,154 218,142 224,136 Z",
    coreOpacity: 0.75,
    stops: ["#6b21a8", "#9333ea", "#c084fc"],
  },
  {
    body: "M 277,115 C 337,120 384,160 380,222 C 378,242 364,246 348,238 C 326,226 308,202 294,178 C 284,160 276,138 277,115 Z",
    core: "M 288,136 C 326,146 356,176 354,212 C 344,206 327,190 314,170 C 304,154 294,142 288,136 Z",
    coreOpacity: 0.75,
    stops: ["#9333ea", "#c026d3", "#f472b6"],
  },
  {
    body: "M 132,274 C 134,336 175,382 235,387 C 236,364 228,342 218,324 C 204,300 186,276 164,264 C 148,256 134,260 132,274 Z",
    core: "M 158,290 C 156,326 186,356 224,366 C 218,360 208,348 198,332 C 185,312 168,296 158,290 Z",
    coreOpacity: 0.65,
    stops: ["#581c87", "#7e22ce", "#e879f9"],
  },
  {
    body: "M 380,274 C 378,336 337,382 277,387 C 276,364 284,342 294,324 C 308,300 326,276 348,264 C 364,256 378,260 380,274 Z",
    core: "M 354,290 C 356,326 326,356 288,366 C 294,360 304,348 314,332 C 327,312 344,296 354,290 Z",
    coreOpacity: 0.65,
    stops: ["#a21caf", "#e11d48", "#fb7185"],
  },
]

/** The white→fuchsia highlight laid over each flame body. */
const CORE_STOPS = [
  { rgb: [0xff, 0xff, 0xff], alpha: 0.8 },
  { rgb: [0xf0, 0xab, 0xfc], alpha: 0.1 },
]

// -------------------------------------------------------------------- colour --

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

/** Picks a colour out of an offset-sorted stop list. */
function sampleStops(stops, t) {
  const u = Math.min(1, Math.max(0, t))
  let lo = stops[0]
  for (const stop of stops) {
    if (stop[0] <= u) {
      lo = stop
      continue
    }
    const span = stop[0] - lo[0]
    const k = span === 0 ? 0 : (u - lo[0]) / span
    return [
      lerp(lo[1][0], stop[1][0], k),
      lerp(lo[1][1], stop[1][1], k),
      lerp(lo[1][2], stop[1][2], k),
    ]
  }
  return lo[1]
}

/** Source-over composite into an RGBA byte buffer. */
function over(px, i, rgb, alpha) {
  if (alpha <= 0) return
  const a = Math.min(1, alpha)
  px[i] = Math.round(px[i] * (1 - a) + rgb[0] * a)
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + rgb[1] * a)
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + rgb[2] * a)
  px[i + 3] = Math.round(px[i + 3] * (1 - a) + 255 * a)
}

// ------------------------------------------------------------------ geometry --

/**
 * Curves are flattened to this many line segments each. At 512px a flame's
 * longest curve spans ~110px, so 24 puts the chord error well under a pixel —
 * and the supersampler cannot see it anyway.
 */
const SEGMENTS = 24

/**
 * Parses the subset of SVG path syntax the artwork uses: absolute M, L, C and Z.
 * Anything else is a mistake in the copied path data rather than a case to
 * handle silently, so it throws.
 */
function flattenPath(d, transform) {
  const tokens = d.match(/[MLCZmlcz]|-?\d*\.?\d+/g)
  if (!tokens) throw new Error(`unparseable path: ${d}`)

  const polygons = []
  let current = null
  let cursor = [0, 0]
  let at = 0

  const number = () => {
    const value = Number(tokens[at++])
    if (!Number.isFinite(value)) throw new Error(`expected a number in: ${d}`)
    return value
  }
  const push = (point) => current.push(transform(point))

  while (at < tokens.length) {
    const command = tokens[at++]
    switch (command) {
      case "M": {
        if (current && current.length > 1) polygons.push(current)
        current = []
        cursor = [number(), number()]
        push(cursor)
        break
      }
      case "L": {
        cursor = [number(), number()]
        push(cursor)
        break
      }
      case "C": {
        const [x0, y0] = cursor
        const x1 = number()
        const y1 = number()
        const x2 = number()
        const y2 = number()
        const x3 = number()
        const y3 = number()
        for (let s = 1; s <= SEGMENTS; s++) {
          const t = s / SEGMENTS
          const u = 1 - t
          const a = u * u * u
          const b = 3 * u * u * t
          const c = 3 * u * t * t
          const e = t * t * t
          push([a * x0 + b * x1 + c * x2 + e * x3, a * y0 + b * y1 + c * y2 + e * y3])
        }
        cursor = [x3, y3]
        break
      }
      case "Z":
      case "z": {
        if (current && current.length > 1) polygons.push(current)
        current = null
        break
      }
      default:
        throw new Error(`unsupported path command "${command}" in: ${d}`)
    }
  }
  if (current && current.length > 1) polygons.push(current)
  return polygons
}

/**
 * Coverage mask for a set of closed polygons under the nonzero winding rule.
 *
 * Vertical resolution comes from `SUBSAMPLES` scanlines per pixel row;
 * horizontal coverage of each inside-span is integrated exactly, which is where
 * most of the antialiasing quality comes from on the near-vertical flame edges.
 * The result is a Float32Array of size×size in 0..1.
 */
function rasterize(polygons, size) {
  const cov = new Float32Array(size * size)
  const edges = []
  let minY = Infinity
  let maxY = -Infinity

  for (const poly of polygons) {
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i]
      const [bx, by] = poly[(i + 1) % poly.length]
      if (ay === by) continue // horizontal edges contribute no crossings
      edges.push([ax, ay, bx, by])
      minY = Math.min(minY, ay, by)
      maxY = Math.max(maxY, ay, by)
    }
  }
  if (edges.length === 0) return cov

  const firstRow = Math.max(0, Math.floor(minY))
  const lastRow = Math.min(size - 1, Math.ceil(maxY))
  const step = 1 / SUBSAMPLES
  const crossings = []

  for (let row = firstRow; row <= lastRow; row++) {
    const base = row * size
    for (let s = 0; s < SUBSAMPLES; s++) {
      const y = row + (s + 0.5) * step
      crossings.length = 0

      for (const [ax, ay, bx, by] of edges) {
        // Half-open in y so a vertex shared by two edges is counted once.
        if (y < Math.min(ay, by) || y >= Math.max(ay, by)) continue
        const t = (y - ay) / (by - ay)
        crossings.push([ax + t * (bx - ax), by > ay ? 1 : -1])
      }
      if (crossings.length < 2) continue
      crossings.sort((p, q) => p[0] - q[0])

      let winding = 0
      let spanStart = 0
      for (const [x, dir] of crossings) {
        const was = winding
        winding += dir
        if (was === 0 && winding !== 0) {
          spanStart = x
          continue
        }
        if (was === 0 || winding !== 0) continue

        const x0 = Math.max(0, spanStart)
        const x1 = Math.min(size, x)
        if (x1 <= x0) continue
        const from = Math.floor(x0)
        const to = Math.min(size - 1, Math.ceil(x1) - 1)
        for (let px = from; px <= to; px++) {
          const overlap = Math.min(x1, px + 1) - Math.max(x0, px)
          if (overlap > 0) cov[base + px] += overlap * step
        }
      }
    }
  }

  for (let i = 0; i < cov.length; i++) if (cov[i] > 1) cov[i] = 1
  return cov
}

function boundsOf(polygons) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const poly of polygons) {
    for (const [x, y] of poly) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { minX, minY, maxX, maxY }
}

/** Distance to a rounded rectangle, negative inside. */
function roundedRectDist(px, py, cx, cy, half, r) {
  const qx = Math.abs(px - cx) - (half - r)
  const qy = Math.abs(py - cy) - (half - r)
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  )
}

/** 1px-wide analytic antialiasing: coverage of the half-plane d < 0. */
function coverage(d) {
  return Math.min(1, Math.max(0, 0.5 - d))
}

/** Abramowitz & Stegun 7.1.26 — plenty for an alpha channel. */
function erf(x) {
  const sign = x < 0 ? -1 : 1
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x)
  return sign * y
}

/**
 * Alpha of a disc of radius `r` after a Gaussian blur of `sigma`, at distance
 * `d` from its centre. Exact for a straight edge and a very good stand-in for a
 * disc once `r` is several times `sigma`, which it is for both ambient discs.
 */
function blurredDiscAlpha(d, r, sigma) {
  return 0.5 * (1 - erf((d - r) / (sigma * Math.SQRT2)))
}

// -------------------------------------------------------------------- render --

function render(size) {
  const s = size / 512
  const px = new Uint8Array(size * size * 4) // zero-filled = transparent
  const half = size / 2
  const centre = size / 2

  // Authored coordinates → device pixels, with the pinwheel zoom folded in.
  const place = ([x, y]) => [centre + (x - 256) * ZOOM * s, centre + (y - 256) * ZOOM * s]

  // Everything after the plate is clipped to it, so the glow does not bleed past
  // the rounded corners and the icon keeps a clean silhouette.
  const plateAlpha = new Float32Array(size * size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5
      const cy = y + 0.5
      const d = roundedRectDist(cx, cy, centre, centre, half, PLATE.radius * s)
      const a = coverage(d)
      if (a <= 0) continue
      const i = (y * size + x) * 4
      plateAlpha[y * size + x] = a
      const dist = Math.hypot(cx - centre, cy - centre) / (PLATE.gradientRadius * s)
      over(px, i, sampleStops(PLATE.stops, dist), a)

      // Inner hairline so the icon keeps an edge on a dark taskbar.
      const stroke = 2.5 * s
      over(px, i, [0x2e, 0x2a, 0x3d], coverage(Math.abs(d + stroke / 2) - stroke / 2) * a)
    }
  }

  for (const disc of AMBIENT) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const clip = plateAlpha[y * size + x]
        if (clip <= 0) continue
        const d = Math.hypot(x + 0.5 - centre, y + 0.5 - centre) / (ZOOM * s)
        const a = blurredDiscAlpha(d, disc.r, disc.sigma) * disc.opacity * clip
        if (a > 0.002) over(px, (y * size + x) * 4, disc.rgb, a)
      }
    }
  }

  for (const ring of CREST) {
    const rDevice = ring.r * ZOOM * s
    const halfWidth = Math.max(0.35, (ring.width * ZOOM * s) / 2)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const clip = plateAlpha[y * size + x]
        if (clip <= 0) continue
        const d = Math.abs(Math.hypot(x + 0.5 - centre, y + 0.5 - centre) - rDevice)
        const a = coverage(d - halfWidth) * ring.opacity * clip
        if (a > 0.002) over(px, (y * size + x) * 4, ring.rgb, a)
      }
    }
  }

  for (const petal of PETALS) {
    const rgbStops = petal.stops.map(hexRgb)
    const gradient = [
      [0, rgbStops[0]],
      [0.6, rgbStops[1]],
      [1, rgbStops[2]],
    ]

    /**
     * Fills one path, evaluating its gradient per pixel. SVG's default
     * `objectBoundingBox` units mean the axis is relative to *this* path's own
     * box, running from its bottom-left corner to its top-right.
     */
    const paint = (d, opacity, colourAt) => {
      const polygons = flattenPath(d, place)
      const box = boundsOf(polygons)
      const ax = box.minX
      const ay = box.maxY
      const dx = box.maxX - box.minX
      const dy = box.minY - box.maxY
      const len2 = dx * dx + dy * dy || 1
      const cov = rasterize(polygons, size)

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const a = cov[y * size + x] * opacity * plateAlpha[y * size + x]
          if (a <= 0.002) continue
          const t = ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / len2
          colourAt(px, (y * size + x) * 4, t, a)
        }
      }
    }

    paint(petal.body, 1, (buf, i, t, a) => over(buf, i, sampleStops(gradient, t), a))
    paint(petal.core, petal.coreOpacity, (buf, i, t, a) => {
      const u = Math.min(1, Math.max(0, t))
      const rgb = [
        lerp(CORE_STOPS[0].rgb[0], CORE_STOPS[1].rgb[0], u),
        lerp(CORE_STOPS[0].rgb[1], CORE_STOPS[1].rgb[1], u),
        lerp(CORE_STOPS[0].rgb[2], CORE_STOPS[1].rgb[2], u),
      ]
      over(buf, i, rgb, a * lerp(CORE_STOPS[0].alpha, CORE_STOPS[1].alpha, u))
    })
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
