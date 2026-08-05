/**
 * Langkah 2 — dulunya `PaymentStep.tsx`.
 *
 * Namanya berubah karena isinya berubah, dan namanya yang lama akan berbohong.
 * Seluruh field kartu dibuang: gateway-nya belum tersambung, dan gateway yang
 * dipilih (Stripe Indonesia) memang tidak menerima kartu sama sekali — cuma
 * transfer bank ke Virtual Account. Meminta nomor kartu ke form yang tidak akan
 * pernah memprosesnya bukan cuma kode mati, itu menyesatkan.
 *
 * Nol data instrumen pembayaran yang menyentuh server, dan nol yang disimpan.
 *
 * Tanggal akhir trial sengaja tidak dihitung di sini (`firstChargeDate()`
 * dihapus). Yang berhak menentukannya jam server, dan tanggal aslinya tampil di
 * layar berikutnya — dibaca dari database, bukan ditebak browser.
 */
"use client"

import { ShieldCheck } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { TRIAL_DAYS, type Plan } from "@/content/plans"

export function KonfirmasiStep({
  plan,
  email,
  onBack,
  onSubmit,
}: {
  plan: Plan
  email: string
  onBack: () => void
  /** Mengembalikan pesan error untuk ditampilkan di sini, atau `null`. */
  onSubmit: () => Promise<string | null>
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError(null)
    try {
      setError(await onSubmit())
    } finally {
      // Tetap dilepas meski berhasil: kalau alurnya pindah ke langkah 3,
      // komponen ini dilepas dan state-nya ikut hilang — tapi kalau gagal,
      // tombolnya harus bisa diklik lagi.
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <p className="text-center text-xs font-medium text-[var(--color-purple-light)]">
        Langkah terakhir
      </p>
      <h1 className="mt-2 text-center text-2xl font-bold tracking-tight">
        Konfirmasi paketmu
      </h1>
      <p className="mt-2 text-center text-[13px] text-[var(--bm-text-secondary)]">
        Cek sekali lagi, lalu akunmu langsung dibuat.
      </p>

      <dl className="mt-8 divide-y divide-[var(--bm-border)] rounded-xl border border-[var(--bm-border)]">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-[13px] text-[var(--bm-text-secondary)]">Email</dt>
          <dd className="truncate text-[13px] font-medium">{email}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-[13px] text-[var(--bm-text-secondary)]">Paket</dt>
          <dd className="text-[13px] font-medium">{plan.name}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-[13px] text-[var(--bm-text-secondary)]">
            Setelah trial
          </dt>
          <dd className="text-[13px] font-medium">
            {plan.price}
            <span className="text-[var(--bm-text-secondary)]">
              {plan.period}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-6 rounded-xl border border-[color-mix(in_srgb,var(--color-purple)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-purple)_10%,transparent)] p-4">
        <p className="text-[13px] font-medium">
          Free trial {TRIAL_DAYS} hari, gratis
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--bm-text-secondary)]">
          Selama {TRIAL_DAYS} hari ke depan kamu tidak membayar apa pun. Setelah
          itu trialnya berakhir dan kamu bisa memilih untuk berlangganan — tidak
          ada tagihan yang jalan sendiri.
        </p>
      </div>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-[var(--bm-text-dim)]">
        <ShieldCheck className="size-3.5" />
        Tidak ada data kartu yang diminta maupun disimpan.
      </p>

      {error && (
        <p className="mt-4 text-[13px] text-[var(--destructive)]">{error}</p>
      )}

      <Button type="submit" size="lg" className="mt-7 w-full" disabled={pending}>
        {pending ? "Membuat akun…" : `Mulai free trial ${TRIAL_DAYS} hari`}
      </Button>

      <button
        type="button"
        onClick={onBack}
        disabled={pending}
        className="mt-4 self-center text-[13px] text-[var(--bm-text-secondary)] underline-offset-4 hover:underline disabled:opacity-50"
      >
        Ganti email atau password
      </button>
    </form>
  )
}
