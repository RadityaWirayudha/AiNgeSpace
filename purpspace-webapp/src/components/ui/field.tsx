/**
 * Label + input, dipasangkan lewat `useId()` supaya mengklik labelnya benar-benar
 * memfokuskan inputnya — di form pembayaran yang isinya delapan kotak, itu
 * bedanya cukup terasa.
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
  children,
  ...props
}: Omit<ComponentProps<"input">, "children"> & {
  label: string
  hint?: ReactNode
  children?: never
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

export function SelectField({
  label,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { label: string }) {
  const id = useId()
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[var(--bm-text-secondary)]"
      >
        {label}
      </label>
      <select id={id} className={cn(CONTROL, "pr-8")} {...props}>
        {children}
      </select>
    </div>
  )
}
