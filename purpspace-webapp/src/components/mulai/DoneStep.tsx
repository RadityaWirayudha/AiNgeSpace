/**
 * Langkah 3 — muara alurnya.
 *
 * Referensi tidak punya layar ini, tapi permintaan user punya: website-nya
 * "tempat download aplikasi PurpSpace desktop". Jadi setelah checkout, yang
 * ditawarkan bukan tombol "buka dashboard" — dashboard-nya ada di aplikasi
 * desktop — melainkan tombol unduh.
 *
 * Semua yang ditampilkan di sini datang dari baris `purpspace_subscriptions`,
 * bukan dari state klien: nama paketnya dari `plan_id`, kalimatnya bercabang di
 * `status`, dan tanggalnya dari `trial_ends_at` yang sudah diformat di server.
 * Itu sebabnya me-refresh halaman ini memberi jawaban yang sama persis.
 */
import { Check, Download } from "lucide-react"
import Link from "next/link"

import { buttonClass } from "@/components/ui/button"
import { DOWNLOAD_META, DOWNLOAD_URL } from "@/content/site"
import type { SubscriptionStatus } from "@/types/database"

export function DoneStep({
  planName,
  status,
  trialEndsLabel,
}: {
  planName: string
  status: SubscriptionStatus
  trialEndsLabel: string
}) {
  const kalimat: Record<SubscriptionStatus, string> = {
    trialing: `Paket ${planName} aktif, gratis sampai ${trialEndsLabel}.`,
    active: `Paket ${planName} aktif.`,
    past_due: `Paket ${planName} sedang menunggu pembayaran, tapi aplikasinya tetap bisa kamu pakai.`,
    canceled: `Paket ${planName} sudah berakhir. Kamu masih bisa memasang aplikasinya.`,
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-purple)_18%,transparent)] text-[var(--color-purple-light)]">
        <Check className="size-6" />
      </span>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">Akunmu siap</h1>
      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[var(--bm-text-secondary)]">
        {kalimat[status]} Langkah terakhir: pasang aplikasi desktop PurpSpace,
        lalu masuk pakai email yang barusan kamu daftarkan.
      </p>

      {/* `download`: berkasnya se-origin, jadi browser langsung menyimpannya
          dengan nama aslinya alih-alih menavigasi ke sana. */}
      <a
        href={DOWNLOAD_URL}
        download
        className={buttonClass({ size: "lg", className: "mt-8 w-full" })}
      >
        <Download className="size-4" />
        Unduh untuk {DOWNLOAD_META.platform}
      </a>

      <p className="mt-3 text-xs text-[var(--bm-text-dim)]">
        {DOWNLOAD_META.arch} · {DOWNLOAD_META.version}
      </p>

      <Link
        href="/"
        className="mt-6 text-[13px] text-[var(--bm-text-secondary)] underline-offset-4 hover:underline"
      >
        Kembali ke beranda
      </Link>
    </div>
  )
}
