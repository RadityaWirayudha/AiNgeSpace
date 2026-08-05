/**
 * Alur free trial — referensi image #2 → #3 → #4.
 *
 * Satu route, bukan empat. Ini pembacaan langsung dari gambarnya: image #2 dan
 * #4 halaman yang sama, dengan kolom kanan yang identik; yang berganti cuma isi
 * kolom kiri. Overlay pilih paket (image #3) menimpa keduanya.
 *
 * Karena user minta frontend dulu, seluruh alurnya hidup di state React: tidak
 * ada request, tidak ada akun yang dibuat, tidak ada kartu yang diproses.
 *
 * Kolom kanan disembunyikan di langkah "selesai" — begitu langganannya jadi,
 * ringkasan-yang-masih-bisa-diganti cuma bikin bingung.
 */
"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

import { PurpSpaceMark } from "@/components/brand/PurpSpaceMark"
import { AccountStep } from "@/components/mulai/AccountStep"
import { DoneStep } from "@/components/mulai/DoneStep"
import { PaymentStep } from "@/components/mulai/PaymentStep"
import { PlanPickerOverlay } from "@/components/mulai/PlanPickerOverlay"
import { PlanSummary } from "@/components/mulai/PlanSummary"
import { getPlan, type PlanId } from "@/content/plans"
import { cn } from "@/lib/utils"

type Step = "akun" | "bayar" | "selesai"

export function TrialFlow({ initialPlan }: { initialPlan: PlanId }) {
  const [planId, setPlanId] = useState<PlanId>(initialPlan)
  const [step, setStep] = useState<Step>("akun")
  const [pickerOpen, setPickerOpen] = useState(false)

  const plan = getPlan(planId)
  const done = step === "selesai"

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
            {step === "akun" && <AccountStep onNext={() => setStep("bayar")} />}
            {step === "bayar" && (
              <PaymentStep plan={plan} onNext={() => setStep("selesai")} />
            )}
            {done && <DoneStep plan={plan} />}
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
