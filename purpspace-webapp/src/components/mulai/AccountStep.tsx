/**
 * Langkah 1 — referensi image #2.
 *
 * Frontend dulu: submit-nya cuma memanggil `onNext()`. Tidak ada request, tidak
 * ada penyimpanan, tidak ada akun yang benar-benar dibuat. Validasi HTML dasar
 * (`required`, `type="email"`, `minLength`) tetap dipasang supaya alurnya terasa
 * hidup waktu dites — dan pencocokan password dicek di sini karena tidak ada
 * atribut HTML yang bisa melakukannya.
 */
"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { TRIAL_DAYS } from "@/content/plans"

export function AccountStep({ onNext }: { onNext: () => void }) {
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (form.get("password") !== form.get("konfirmasi")) {
      setError("Konfirmasi password belum sama.")
      return
    }
    setError(null)
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <p className="text-center text-xs font-medium text-[var(--color-purple-light)]">
        Buat akunmu
      </p>
      <h1 className="mt-2 text-center text-2xl font-bold tracking-tight">
        Mulai paketmu
      </h1>
      <p className="mt-2 text-center text-[13px] text-[var(--bm-text-secondary)]">
        Kartu kredit diperlukan. Sudah termasuk free trial {TRIAL_DAYS} hari.
      </p>

      <div className="mt-8 space-y-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="kamu@contoh.com"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={8}
          required
        />
        <Field
          label="Konfirmasi password"
          name="konfirmasi"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={8}
          required
        />
      </div>

      <label className="mt-6 flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--bm-text-secondary)]">
        <input
          type="checkbox"
          name="setuju"
          required
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-purple)]"
        />
        <span>
          Dengan mencentang, kamu setuju dengan{" "}
          <span className="text-[var(--bm-link)]">Syarat &amp; Ketentuan</span> dan{" "}
          <span className="text-[var(--bm-link)]">Kebijakan Privasi</span>.
        </span>
      </label>

      {error && (
        <p className="mt-4 text-[13px] text-[var(--destructive)]">{error}</p>
      )}

      <Button type="submit" size="lg" className="mt-7 w-full">
        Buat akun
      </Button>
    </form>
  )
}
