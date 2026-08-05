/**
 * Halaman harga — referensi image #7.
 *
 * Referensinya punya tiga kartu (Basic / Pro / Ultra); PurpSpace cuma dua, jadi
 * gridnya dua kolom yang dikunci di tengah, bukan tiga kolom dengan satu slot
 * kosong.
 */
import type { Metadata } from "next"
import { Sparkles } from "lucide-react"

import { PlanCard } from "@/components/harga/PlanCard"
import { SiteFooter } from "@/components/site/SiteFooter"
import { SiteHeader } from "@/components/site/SiteHeader"
import { ButtonLink } from "@/components/ui/button"
import { PLANS, TRIAL_DAYS } from "@/content/plans"

export const metadata: Metadata = {
  title: "Harga — PurpSpace",
  description:
    "Dua paket PurpSpace: Basic Rp24.999/bulan dengan free trial 12 hari, dan Pro Rp49.999/bulan dengan Grid Terminal tanpa batas.",
}

export default function HargaPage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <section className="aurora-purple">
          <div className="mx-auto w-full max-w-6xl px-5 pt-16 pb-20 sm:pt-20">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bm-border)] bg-white/[0.03] px-3 py-1 text-xs text-[var(--bm-text-secondary)]">
                <Sparkles className="size-3.5 text-[var(--color-purple-light)]" />
                Paket Harga
              </span>

              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                Pilih paketmu
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
                Bayar bulanan, batal kapan saja. Mulai dari free trial{" "}
                {TRIAL_DAYS} hari — kartu kredit baru diminta saat kamu mendaftar.
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-3xl gap-6 sm:grid-cols-2">
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  footer={
                    <ButtonLink
                      href={`/mulai?paket=${plan.id}`}
                      variant={plan.featured ? "primary" : "outline"}
                      size="lg"
                      className="w-full"
                    >
                      {plan.cta}
                    </ButtonLink>
                  }
                />
              ))}
            </div>

            <p className="mt-10 text-center text-xs text-[var(--bm-text-dim)]">
              Harga dalam Rupiah. PurpSpace adalah aplikasi desktop — setelah
              berlangganan, unduh dan pasang di komputermu.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
