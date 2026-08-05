/**
 * Langkah 2 — referensi image #4.
 *
 * Sama seperti langkah 1: frontend dulu, submit-nya cuma pindah langkah. Tidak
 * ada gateway pembayaran, tidak ada nomor kartu yang dikirim ke mana pun.
 * `autoComplete="off"` dipasang supaya browser tidak menawarkan kartu asli ke
 * form yang tidak akan memprosesnya.
 *
 * Tanggal tagihan pertama dihitung saat render. Aman dari selisih server/klien
 * karena komponen ini baru muncul setelah tombol di langkah 1 diklik — jadi ia
 * tidak pernah ikut dirender di server.
 */
"use client"

import { Lock } from "lucide-react"
import type { FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Field, SelectField } from "@/components/ui/field"
import { TRIAL_DAYS, type Plan } from "@/content/plans"

function firstChargeDate() {
  const date = new Date()
  date.setDate(date.getDate() + TRIAL_DAYS)
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function PaymentStep({
  plan,
  onNext,
}: {
  plan: Plan
  onNext: () => void
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <p className="text-center text-xs font-medium text-[var(--color-purple-light)]">
        Langkah terakhir
      </p>
      <h1 className="mt-2 text-center text-2xl font-bold tracking-tight">
        Selesaikan langgananmu
      </h1>
      <p className="mt-2 text-center text-[13px] text-[var(--bm-text-secondary)]">
        Masukkan informasi pembayaranmu untuk memulai paket {plan.name}.
      </p>

      <p className="mt-8 text-xs font-medium text-[var(--bm-text-secondary)]">
        Informasi pembayaran
      </p>

      <div className="mt-3 space-y-4">
        <Field
          label="Nomor kartu"
          name="kartu"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1234 1234 1234 1234"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Masa berlaku"
            name="berlaku"
            inputMode="numeric"
            autoComplete="off"
            placeholder="BB / TT"
            required
          />
          <Field
            label="Kode keamanan"
            name="cvc"
            inputMode="numeric"
            autoComplete="off"
            placeholder="CVC"
            required
          />
        </div>

        <SelectField label="Negara" name="negara" defaultValue="ID" required>
          <option value="ID">Indonesia</option>
          <option value="MY">Malaysia</option>
          <option value="SG">Singapura</option>
        </SelectField>

        <Field
          label="Kode pos"
          name="kodepos"
          inputMode="numeric"
          autoComplete="off"
          placeholder="12345"
          required
        />
      </div>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-[var(--bm-text-dim)]">
        <Lock className="size-3.5" />
        Informasi pembayaranmu aman dan terenkripsi.
      </p>

      <div className="mt-6 rounded-xl border border-[color-mix(in_srgb,var(--color-purple)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-purple)_10%,transparent)] p-4">
        <p className="text-[13px] font-medium">Free trial {TRIAL_DAYS} hari</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--bm-text-secondary)]">
          Kamu belum ditagih sampai {firstChargeDate()}. Batal kapan saja
          sebelum tanggal itu dan kamu tidak membayar apa pun.
        </p>
      </div>

      <Button type="submit" size="lg" className="mt-7 w-full">
        Mulai free trial
      </Button>
    </form>
  )
}
