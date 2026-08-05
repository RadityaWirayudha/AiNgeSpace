/**
 * Kolom kanan `/mulai` — ringkasan paket yang sedang dipilih, dengan tombol
 * "Ganti" di pojok kanan atas (referensi image #2 dan #4).
 *
 * Isinya tetap sama di langkah "buat akun" maupun "pembayaran"; yang berubah
 * cuma kolom kiri. Itu pembacaan langsung dari kedua gambar itu — keduanya
 * halaman yang sama.
 */
import { Check } from "lucide-react"

import type { Plan } from "@/content/plans"
import { TRIAL_DAYS } from "@/content/plans"

export function PlanSummary({
  plan,
  onChange,
}: {
  plan: Plan
  onChange: () => void
}) {
  return (
    <aside className="rounded-2xl border border-[var(--bm-border)] bg-[var(--bm-pane)] p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold">{plan.name}</h2>
        <button
          type="button"
          onClick={onChange}
          className="text-[13px] text-[var(--bm-link)] underline-offset-4 hover:underline"
        >
          Ganti
        </button>
      </div>

      <p className="mt-5 text-2xl font-bold text-[var(--color-purple-light)]">
        {plan.headline}
      </p>
      <p className="mt-1 text-xs text-[var(--bm-text-dim)]">{plan.headlineNote}</p>

      <p className="mt-4">
        <span className="text-2xl font-bold tracking-tight">{plan.price}</span>
        <span className="ml-1 text-sm text-[var(--bm-text-secondary)]">
          {plan.period}
        </span>
      </p>

      <ul className="mt-6 space-y-3 border-t border-[var(--bm-border)] pt-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-[13px] leading-relaxed">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-purple-light)]" />
            <span className="text-[var(--bm-text-secondary)]">{feature}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] text-[var(--bm-link)]">
        Termasuk free trial {TRIAL_DAYS} hari. Batal kapan saja.
      </p>
    </aside>
  )
}
