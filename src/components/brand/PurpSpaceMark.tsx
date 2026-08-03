/**
 * The PurpSpace mark — four flame petals in a pinwheel around an empty centre.
 *
 * The authoritative artwork is `logo/wizard-fire-logo-v3.svg`; the path data
 * below is copied from it verbatim so the shape is identical everywhere it
 * appears (sidebar tile, header, favicon, taskbar icon). Only the decoration
 * around the petals changes with size.
 *
 * Two things about the sizes this gets rendered at:
 *
 *  - The dark plate is opt-in. On a #0e0e10 sidebar an 18px dark tile reads as
 *    a hole rather than a logo, so the small placements draw the petals alone
 *    and let the panel behind them be the background. The plate is for surfaces
 *    that are not already dark — the favicon, the installer icon, marketing.
 *  - Everything that only exists at 512px is dropped below `detail="full"`:
 *    the dashed arcane crest, the spark particles, the corner brackets and the
 *    Gaussian glow all turn to mud at 20px and cost a filter pass to do it.
 *
 * Gradient ids come from `useId()` because more than one mark is on screen at
 * once (menu bar + sidebar), and duplicate ids in a document make every
 * instance resolve to whichever one the browser saw first.
 */
"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"

/** Petal bodies, in the 512×512 space of the source artwork. */
const PETALS = [
  {
    key: "tl",
    body: "M 235,115 C 175,120 128,160 132,222 C 134,242 148,246 164,238 C 186,226 204,202 218,178 C 228,160 236,138 235,115 Z",
    core: "M 224,136 C 186,146 156,176 158,212 C 168,206 185,190 198,170 C 208,154 218,142 224,136 Z",
    coreOpacity: 0.75,
    stops: ["#6b21a8", "#9333ea", "#c084fc"],
  },
  {
    key: "tr",
    body: "M 277,115 C 337,120 384,160 380,222 C 378,242 364,246 348,238 C 326,226 308,202 294,178 C 284,160 276,138 277,115 Z",
    core: "M 288,136 C 326,146 356,176 354,212 C 344,206 327,190 314,170 C 304,154 294,142 288,136 Z",
    coreOpacity: 0.75,
    stops: ["#9333ea", "#c026d3", "#f472b6"],
  },
  {
    key: "bl",
    body: "M 132,274 C 134,336 175,382 235,387 C 236,364 228,342 218,324 C 204,300 186,276 164,264 C 148,256 134,260 132,274 Z",
    core: "M 158,290 C 156,326 186,356 224,366 C 218,360 208,348 198,332 C 185,312 168,296 158,290 Z",
    coreOpacity: 0.65,
    stops: ["#581c87", "#7e22ce", "#e879f9"],
  },
  {
    key: "br",
    body: "M 380,274 C 378,336 337,382 277,387 C 276,364 284,342 294,324 C 308,300 326,276 348,264 C 364,256 378,260 380,274 Z",
    core: "M 354,290 C 356,326 326,356 288,366 C 294,360 304,348 314,332 C 327,312 344,296 354,290 Z",
    coreOpacity: 0.65,
    stops: ["#a21caf", "#e11d48", "#fb7185"],
  },
] as const

/** Sparks and corner brackets, `detail="full"` only. */
const SPARKS = [
  { cx: 230, cy: 85, r: 2.5, fill: "#ffffff", opacity: 0.8 },
  { cx: 282, cy: 85, r: 2.5, fill: "#f472b6", opacity: 0.9 },
  { cx: 395, cy: 180, r: 2, fill: "#e879f9", opacity: 0.7 },
  { cx: 117, cy: 180, r: 2, fill: "#c084fc", opacity: 0.7 },
  { cx: 230, cy: 415, r: 2, fill: "#ffffff", opacity: 0.7 },
  { cx: 282, cy: 415, r: 2.5, fill: "#fb7185", opacity: 0.8 },
] as const

const BRACKETS = [
  "M 120,120 L 140,120 M 120,120 L 120,140",
  "M 392,120 L 372,120 M 392,120 L 392,140",
  "M 120,392 L 140,392 M 120,392 L 120,372",
  "M 392,392 L 372,392 M 392,392 L 392,372",
] as const

/**
 * Without the plate the artwork is cropped to the petals, so an 18px box is
 * 18px of logo instead of 18px of mostly-empty padding. The window is kept
 * symmetric about (256,256) — the petals' own bounding box is not — otherwise
 * the pinwheel sits off-centre in its tile.
 */
const CROPPED_VIEWBOX = "115 115 282 282"
const FULL_VIEWBOX = "0 0 512 512"

interface PurpSpaceMarkProps {
  /** Extra classes for the `<svg>`; size it here (`size-[18px]`, `size-6`, …). */
  className?: string
  /** Draw the dark rounded panel behind the petals. Off by default. */
  plate?: boolean
  /** `"full"` adds the crest, sparks, brackets and glow. Only legible ≥ 64px. */
  detail?: "mark" | "full"
  /**
   * Decorative by default — the label next to it already says "PurpSpace". Pass
   * a title when the mark is the only thing identifying its control.
   */
  title?: string
}

export function PurpSpaceMark({
  className,
  plate = false,
  detail = "mark",
  title,
}: PurpSpaceMarkProps) {
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`
  const full = detail === "full"

  return (
    <svg
      viewBox={plate ? FULL_VIEWBOX : CROPPED_VIEWBOX}
      className={cn("shrink-0", className)}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <defs>
        {plate && (
          <radialGradient id={id("plate")} cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#1a1829" />
            <stop offset="65%" stopColor="#121118" />
            <stop offset="100%" stopColor="#09090c" />
          </radialGradient>
        )}
        {PETALS.map((petal) => (
          <linearGradient
            key={petal.key}
            id={id(petal.key)}
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={petal.stops[0]} />
            <stop offset="60%" stopColor={petal.stops[1]} />
            <stop offset="100%" stopColor={petal.stops[2]} />
          </linearGradient>
        ))}
        {full && (
          <>
            <linearGradient id={id("core")} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f0abfc" stopOpacity="0.1" />
            </linearGradient>
            <filter id={id("glow")} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={id("ambient")} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="30" />
            </filter>
          </>
        )}
      </defs>

      {plate && <rect width="512" height="512" rx="96" fill={`url(#${id("plate")})`} />}

      {full && (
        <>
          <circle
            cx="256"
            cy="256"
            r="130"
            fill="#9333ea"
            opacity="0.18"
            filter={`url(#${id("ambient")})`}
          />
          <circle
            cx="256"
            cy="256"
            r="80"
            fill="#ec4899"
            opacity="0.15"
            filter={`url(#${id("ambient")})`}
          />
          <g opacity="0.2" fill="none" strokeWidth="1.5">
            <circle
              cx="256"
              cy="256"
              r="170"
              stroke={`url(#${id("tr")})`}
              strokeDasharray="6 10"
            />
            <circle cx="256" cy="256" r="148" stroke={`url(#${id("tl")})`} />
          </g>
        </>
      )}

      <g filter={full ? `url(#${id("glow")})` : undefined}>
        {PETALS.map((petal) => (
          <g key={petal.key}>
            <path d={petal.body} fill={`url(#${id(petal.key)})`} />
            {full && (
              <path
                d={petal.core}
                fill={`url(#${id("core")})`}
                opacity={petal.coreOpacity}
              />
            )}
          </g>
        ))}
      </g>

      {full && (
        <>
          <g>
            {SPARKS.map((spark) => (
              <circle
                key={`${spark.cx}-${spark.cy}`}
                cx={spark.cx}
                cy={spark.cy}
                r={spark.r}
                fill={spark.fill}
                opacity={spark.opacity}
              />
            ))}
          </g>
          <g opacity="0.3" fill="none" stroke={`url(#${id("tr")})`} strokeWidth="1.5">
            {BRACKETS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </>
      )}
    </svg>
  )
}
