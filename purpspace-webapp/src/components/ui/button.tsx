/**
 * Tombol website. Sengaja ditulis tangan, bukan disalin dari app desktop:
 * punya desktop bergantung pada `@base-ui/react` + `class-variance-authority`,
 * dan website ini tidak memasang keduanya. Radius-nya juga beda — app desktop
 * pakai `--radius 0.25rem` supaya chrome-nya rapat, sementara di halaman
 * marketing tombol setinggi 44px dengan sudut 4px kelihatan seperti kotak.
 */
import Link from "next/link"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type Variant = "primary" | "outline" | "ghost"
type Size = "sm" | "md" | "lg"

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0"

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--color-purple)] text-white hover:bg-[var(--color-purple-light)] active:bg-[var(--color-purple-dark)]",
  outline:
    "border border-[var(--bm-border)] bg-white/[0.02] text-[var(--bm-text)] hover:bg-white/[0.06] hover:border-[var(--bm-text-dim)]",
  ghost: "text-[var(--bm-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--bm-text)]",
}

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-[15px]",
}

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant
  size?: Size
  className?: string
} = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  )
}

/** Versi `<Link>`-nya, supaya CTA yang menavigasi tetap jadi anchor beneran. */
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />
}
