/**
 * Kartu paket. Satu komponen, tiga pemakai: halaman `/harga`, overlay
 * "Pilih paket" di `/mulai`, dan (versi ringkasnya) kolom kanan `/mulai`.
 * Ditulis sekali supaya harga di ketiga tempat itu tidak mungkin melenceng.
 *
 * Susunannya mengikuti referensi image #7: ikon → nama → satu baris deskripsi →
 * angka besar berwarna → harga → daftar fitur bercentang → tombol di dasar.
 * Warnanya diganti ke ungu PurpSpace (#9333ea), bukan biru referensinya.
 *
 * Tombolnya masuk lewat `footer` dan bukan dirender di sini, karena di `/harga`
 * dia sebuah link ke `/mulai` sedangkan di overlay dia tombol yang mengubah
 * state — dua hal yang tidak enak dipaksa jadi satu prop.
 */
import { Check, Star, Zap } from "lucide-react"
import type { ReactNode } from "react"

import type { Plan } from "@/content/plans"
import { cn } from "@/lib/utils"

const ICONS = {
  basic: Star,
  pro: Zap,
} as const

export function PlanCard({
  plan,
  footer,
  className,
}: {
  plan: Plan
  footer?: ReactNode
  className?: string
}) {
  const Icon = ICONS[plan.id]

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 transition-colors",
        plan.featured
          ? "border-[var(--color-purple)] bg-[color-mix(in_srgb,var(--color-purple)_7%,#131316)] glow-purple-sm"
          : "border-[var(--bm-border)] bg-[var(--bm-pane)] hover:border-[var(--bm-text-dim)]",
        className
      )}
    >
      {plan.badge && (
        <span
          className={cn(
            "absolute -top-3 right-5 rounded-full px-3 py-1 text-[11px] font-medium",
            plan.featured
              ? "bg-[var(--color-purple)] text-white"
              : "border border-[var(--bm-border)] bg-[var(--bm-pane-header)] text-[var(--bm-text-secondary)]"
          )}
        >
          {plan.badge}
        </span>
      )}

      <div className="flex flex-col items-center text-center">
        <span
          className={cn(
            "mb-4 inline-flex size-11 items-center justify-center rounded-xl",
            plan.featured
              ? "bg-[var(--color-purple)] text-white"
              : "border border-[var(--bm-border)] bg-white/[0.03] text-[var(--bm-text-secondary)]"
          )}
        >
          <Icon className="size-5" />
        </span>

        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="mt-1.5 max-w-[26ch] text-[13px] leading-relaxed text-[var(--bm-text-secondary)]">
          {plan.tagline}
        </p>

        <p className="mt-5 text-2xl font-bold text-[var(--color-purple-light)]">
          {plan.headline}
        </p>
        <p className="mt-1 text-xs text-[var(--bm-text-dim)]">{plan.headlineNote}</p>

        <p className="mt-4">
          <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
          <span className="ml-1 text-sm text-[var(--bm-text-secondary)]">
            {plan.period}
          </span>
        </p>
      </div>

      <ul className="mt-6 space-y-3 border-t border-[var(--bm-border)] pt-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-[13px] leading-relaxed">
            <Check
              className={cn(
                "mt-0.5 size-4 shrink-0",
                plan.featured
                  ? "text-[var(--color-purple-light)]"
                  : "text-[var(--bm-text-dim)]"
              )}
            />
            <span className="text-[var(--bm-text-secondary)]">{feature}</span>
          </li>
        ))}
      </ul>

      {/* `mt-auto` supaya tombol kedua kartu tetap sebaris walaupun daftar
          fitur Pro dua kali lebih panjang dari Basic. */}
      {footer && <div className="mt-auto pt-8">{footer}</div>}
    </div>
  )
}
