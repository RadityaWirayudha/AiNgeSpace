/**
 * Alur free trial — referensi image #2 → #3 → #4.
 *
 * Satu route, bukan empat. Ini pembacaan langsung dari gambarnya: image #2 dan
 * #4 halaman yang sama, dengan kolom kanan yang identik; yang berganti cuma isi
 * kolom kiri. Overlay pilih paket (image #3) menimpa keduanya.
 *
 * Yang menulis ke server cuma SATU titik: `POST /api/daftar` di langkah 2.
 * Langkah 1 sengaja tetap tanpa request — email dan password ditahan di state
 * sini sampai langkah 2 mengirim semuanya sekali jalan. Kalau akun dibuat lebih
 * awal lalu user menutup tab, yang tertinggal adalah akun Clerk tanpa langganan,
 * dan emailnya terkunci selamanya dari trial. Menunda seluruh penulisan
 * menghapus kelas bug itu.
 *
 * Password hanya hidup di memori komponen ini sampai request-nya terkirim —
 * tidak ke `localStorage`, tidak ke URL, tidak ke mana-mana.
 *
 * Kolom kanan disembunyikan di langkah "selesai" — begitu langganannya jadi,
 * ringkasan-yang-masih-bisa-diganti cuma bikin bingung.
 */
"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

import { PurpSpaceMark } from "@/components/brand/PurpSpaceMark"
import { AccountStep, type DataAkun } from "@/components/mulai/AccountStep"
import { DoneStep } from "@/components/mulai/DoneStep"
import { KonfirmasiStep } from "@/components/mulai/KonfirmasiStep"
import { PlanPickerOverlay } from "@/components/mulai/PlanPickerOverlay"
import { PlanSummary } from "@/components/mulai/PlanSummary"
import { getPlan, type PlanId } from "@/content/plans"
import type { LanggananView } from "@/lib/langganan"
import { cn } from "@/lib/utils"

type Step = "akun" | "konfirmasi" | "selesai"

export function TrialFlow({
  initialPlan,
  langganan,
}: {
  initialPlan: PlanId
  /** Terisi kalau cookie `ps_langganan` menunjuk ke baris yang masih ada. */
  langganan: LanggananView | null
}) {
  const [hasil, setHasil] = useState<LanggananView | null>(langganan)
  const [planId, setPlanId] = useState<PlanId>(langganan?.planId ?? initialPlan)
  const [step, setStep] = useState<Step>(langganan ? "selesai" : "akun")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [akun, setAkun] = useState<DataAkun | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const plan = getPlan(planId)
  const done = step === "selesai"

  /**
   * Dipanggil tombol di langkah 2. Nilai baliknya pesan error yang harus
   * ditampilkan di situ, atau `null` kalau tidak ada yang perlu ditampilkan —
   * entah karena berhasil, atau karena errornya milik langkah 1 dan alurnya
   * sudah dilempar balik ke sana.
   */
  async function daftar(): Promise<string | null> {
    if (!akun) {
      // Tidak mungkin lewat UI, tapi kalau sampai terjadi, mengirim body kosong
      // ke server jauh lebih membingungkan daripada balik ke langkah 1.
      setStep("akun")
      return null
    }

    let response: Response
    try {
      response = await fetch("/api/daftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...akun, planId }),
      })
    } catch {
      return "Tidak bisa menghubungi server. Periksa koneksimu, lalu coba lagi."
    }

    const data: unknown = await response.json().catch(() => null)

    if (response.ok) {
      setHasil(data as LanggananView)
      setStep("selesai")
      return null
    }

    const pesan =
      (data as { error?: string } | null)?.error ??
      "Pendaftaran gagal. Coba lagi sebentar lagi."

    // Email sudah dipakai, atau formatnya ditolak Clerk. Itu isian langkah 1,
    // jadi pesannya ditampilkan di sana — bukan di bawah tombol langkah 2 yang
    // tidak punya field email sama sekali.
    if ((data as { field?: string } | null)?.field === "email") {
      setEmailError(pesan)
      setStep("akun")
      return null
    }

    return pesan
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute inset-0 aurora-purple opacity-70" aria-hidden />

      {/* Header ringkas, seperti di referensi: logo kiri, jalan pulang di
          kanan. Nav lengkap sengaja tidak dipakai di sini supaya tidak ada
          jalan keluar yang tidak disengaja di tengah checkout. */}
      <header className="relative border-b border-[var(--bm-border)]">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <PurpSpaceMark className="size-6" title="PurpSpace" />
            <span className="text-[15px] font-semibold tracking-tight">
              PurpSpace
            </span>
          </Link>

          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-[var(--bm-text-secondary)] transition-colors hover:text-[var(--bm-text)]"
          >
            <ArrowLeft className="size-4" />
            Kembali ke beranda
          </Link>
        </div>
      </header>

      <main className="relative flex-1">
        <div
          className={cn(
            "mx-auto grid w-full gap-6 px-5 py-12 sm:py-16",
            done
              ? "max-w-md"
              : "max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-8"
          )}
        >
          <div className="rounded-2xl border border-[var(--bm-border)] bg-[var(--bm-pane)] p-6 sm:p-8">
            {step === "akun" && (
              <AccountStep
                defaultEmail={akun?.email ?? ""}
                serverError={emailError}
                onNext={(data) => {
                  setEmailError(null)
                  setAkun(data)
                  setStep("konfirmasi")
                }}
              />
            )}
            {step === "konfirmasi" && (
              <KonfirmasiStep
                plan={plan}
                email={akun?.email ?? ""}
                onBack={() => setStep("akun")}
                onSubmit={daftar}
              />
            )}
            {done && hasil && (
              <DoneStep
                planName={getPlan(hasil.planId).name}
                status={hasil.status}
                trialEndsLabel={hasil.trialEndsLabel}
              />
            )}
          </div>

          {!done && (
            <PlanSummary plan={plan} onChange={() => setPickerOpen(true)} />
          )}
        </div>
      </main>

      {pickerOpen && (
        <PlanPickerOverlay
          selected={planId}
          onSelect={setPlanId}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
