/**
 * Label + input, dipasangkan lewat `useId()` supaya mengklik labelnya benar-benar
 * memfokuskan inputnya.
 *
 * Pernah ada `SelectField` di sini juga, dipakai dropdown negara di form kartu.
 * Form kartunya dibuang bareng `PaymentStep`, jadi komponennya ikut dibuang —
 * bukan disimpan "siapa tahu nanti kepakai".
 */
"use client"

import { useId, type ComponentProps, type ReactNode } from "react"

import { cn } from "@/lib/utils"

const CONTROL =
  "h-10 w-full rounded-lg border border-[var(--bm-border)] bg-[#0b0b0d] px-3 text-sm text-[var(--bm-text)] outline-none transition-colors placeholder:text-[var(--bm-text-dim)] hover:border-[var(--bm-text-dim)] focus:border-[var(--color-purple)]"

export function Field({
  label,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: string
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[var(--bm-text-secondary)]"
      >
        {label}
      </label>
      <input id={id} className={CONTROL} {...props} />
      {hint && <p className="text-[11px] text-[var(--bm-text-dim)]">{hint}</p>}
    </div>
  )
}
