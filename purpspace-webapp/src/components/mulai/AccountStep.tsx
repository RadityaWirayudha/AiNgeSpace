/**
 * Langkah 1 — referensi image #2.
 *
 * Tetap tanpa request: isinya cuma dinaikkan ke `TrialFlow`, yang mengirimnya
 * bersama pilihan paket di langkah 2. Alasannya ada di komentar `TrialFlow`.
 *
 * Yang diperiksa di sini hanya yang bisa diperiksa tanpa server: pencocokan
 * konfirmasi password (tidak ada atribut HTML yang bisa melakukannya) dan
 * centang S&K. Aturan password yang sebenarnya — panjang, kekuatan, apakah
 * pernah bocor — milik Clerk, dan jawabannya baru datang di langkah 2. Itu
 * yang masuk lewat `serverError`.
 */
"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { TRIAL_DAYS } from "@/content/plans"

export interface DataAkun {
  email: string
  password: string
  /** Centang S&K. Diperiksa ulang di server — atribut `required` bisa dilewati. */
  setuju: true
}

export function AccountStep({
  defaultEmail = "",
  serverError = null,
  onNext,
}: {
  /** Diisi kembali kalau user dilempar balik ke sini dari langkah 2. */
  defaultEmail?: string
  /** Pesan dari `/api/daftar` yang menyangkut field email. */
  serverError?: string | null
  onNext: (data: DataAkun) => void
}) {
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    const password = String(form.get("password") ?? "")
    if (password !== form.get("konfirmasi")) {
      setError("Konfirmasi password belum sama.")
      return
    }
    if (form.get("setuju") !== "on") {
      setError("Kamu perlu menyetujui Syarat & Ketentuan dulu.")
      return
    }

    setError(null)
    onNext({
      email: String(form.get("email") ?? "").trim(),
      password,
      setuju: true,
    })
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
        Free trial {TRIAL_DAYS} hari. Tanpa kartu kredit.
      </p>

      <div className="mt-8 space-y-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="kamu@contoh.com"
          defaultValue={defaultEmail}
          aria-invalid={serverError ? true : undefined}
          hint={
            serverError && (
              <span className="text-[var(--destructive)]">{serverError}</span>
            )
          }
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
        Lanjutkan
      </Button>
    </form>
  )
}
