/**
 * Overlay "Pilih paket" — referensi image #3. Muncul saat "Ganti" di kolom
 * kanan diklik.
 *
 * Kartunya `PlanCard` yang sama dengan halaman `/harga`, cuma tombolnya diganti
 * dari link jadi tombol yang mengubah state lalu menutup overlay.
 */
"use client"

import { X } from "lucide-react"
import { useEffect } from "react"

import { PlanCard } from "@/components/harga/PlanCard"
import { Button } from "@/components/ui/button"
import { PLANS, type PlanId } from "@/content/plans"

export function PlanPickerOverlay({
  selected,
  onSelect,
  onClose,
}: {
  selected: PlanId
  onSelect: (id: PlanId) => void
  onClose: () => void
}) {
  // Escape menutup overlay, dan body dikunci supaya halaman di belakangnya
  // tidak ikut bergulir saat daftar paket lebih tinggi dari layar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pilih paket"
      className="animate-bm-fade-in fixed inset-0 z-50 overflow-y-auto bg-[#09090b]/85 backdrop-blur-sm scrollbar-thin"
    >
      <div className="animate-bm-dialog-in mx-auto w-full max-w-4xl px-5 py-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Pilih paket</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-[var(--bm-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--bm-text)]"
          >
            Tutup
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const isSelected = plan.id === selected
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                footer={
                  <Button
                    variant={isSelected ? "outline" : plan.featured ? "primary" : "outline"}
                    size="lg"
                    className="w-full"
                    disabled={isSelected}
                    onClick={() => {
                      onSelect(plan.id)
                      onClose()
                    }}
                  >
                    {isSelected ? "Paket terpilih" : `Pilih ${plan.name}`}
                  </Button>
                }
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
