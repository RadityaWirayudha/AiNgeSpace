/**
 * Landing page — referensi image #1.
 *
 * Susunannya: pill badge → judul dua baris (baris pertama ungu) → subheading →
 * dua tombol. Di bawahnya section fitur yang menjawab "PurpSpace itu buat apa
 * sih?", lalu section unduh.
 *
 * Section unduh sengaja tinggal di halaman ini, bukan di route `/unduh`
 * sendiri — website ini cuma pengenalan, dan satu halaman berisi satu tombol
 * unduh tidak cukup padat untuk berdiri sendiri.
 */
import {
  ArrowRight,
  Download,
  FolderTree,
  GitCommitHorizontal,
  Save,
  Sparkles,
  Terminal,
} from "lucide-react"

import { SiteFooter } from "@/components/site/SiteFooter"
import { SiteHeader } from "@/components/site/SiteHeader"
import { ButtonLink, buttonClass } from "@/components/ui/button"
import { PLANS, TRIAL_DAYS } from "@/content/plans"
import { DOWNLOAD_META, DOWNLOAD_URL } from "@/content/site"

const FEATURES = [
  {
    icon: Terminal,
    title: "Grid Terminal",
    body: "Beberapa terminal hidup berdampingan dalam satu grid yang bisa kamu atur. Tidak perlu lagi loncat antar-tab untuk melihat dev server, test runner, dan agen sekaligus.",
  },
  {
    icon: Save,
    title: "Saved Workspaces & One-Click Restore",
    body: "Sekali klik, terminalmu terbuka lengkap dengan direktori dan command bawaannya — npm run dev, docker-compose, apa pun yang biasa kamu ketik ulang tiap pagi.",
  },
  {
    icon: GitCommitHorizontal,
    title: "PurpCommit",
    body: "Commit ke GitHub tanpa memelototi diff dulu. Pesan commit-nya disusun AI dari perubahan yang benar-benar ada di stage.",
  },
  {
    icon: FolderTree,
    title: "PurpExplorer",
    body: "Penjelajah berkas yang duduk di aplikasi yang sama dengan terminalmu, jadi membuka file tidak berarti pindah jendela.",
  },
] as const

export default function LandingPage() {
  const basic = PLANS[0]

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ---------------------------------------------------------- HERO */}
        <section className="relative overflow-hidden border-b border-[var(--bm-border)]">
          <div className="absolute inset-0 grid-bg" aria-hidden />
          <div className="absolute inset-0 aurora-purple" aria-hidden />

          <div className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:py-32">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bm-border)] bg-white/[0.03] px-3 py-1 text-xs text-[var(--bm-text-secondary)]">
                <Sparkles className="size-3.5 text-[var(--color-purple-light)]" />
                Terminal AI untuk developer
              </span>

              <h1 className="mt-7 max-w-3xl text-4xl leading-[1.1] font-bold tracking-tight sm:text-6xl">
                <span className="text-[var(--color-purple-light)]">
                  Semua terminalmu
                </span>
                <br />
                dalam satu layar
              </h1>

              <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--bm-text-secondary)] sm:text-base">
                PurpSpace menyatukan grid terminal, workspace tersimpan,
                PurpCommit, dan PurpExplorer dalam satu aplikasi desktop. Buka
                proyekmu sekali klik — lengkap dengan command yang biasa kamu
                jalankan.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/mulai" size="lg">
                  Mulai Free Trial
                  <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/harga" variant="outline" size="lg">
                  Lihat Harga
                </ButtonLink>
              </div>

              <p className="mt-4 text-xs text-[var(--bm-text-dim)]">
                Gratis {TRIAL_DAYS} hari · Mulai {basic.price}
                {basic.period} · Batal kapan saja
              </p>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- FITUR */}
        <section id="fitur" className="scroll-mt-14">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                PurpSpace itu buat apa sih?
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
                Empat hal yang biasanya tersebar di empat jendela berbeda,
                dikumpulkan jadi satu tempat kerja.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="card-surface rounded-2xl p-6"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--bm-border)] bg-white/[0.03] text-[var(--color-purple-light)]">
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--bm-text-secondary)]">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- UNDUH */}
        <section
          id="unduh"
          className="scroll-mt-14 border-t border-[var(--bm-border)]"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
            <div className="relative overflow-hidden rounded-2xl border border-[var(--bm-border)] bg-[var(--bm-pane)] px-6 py-14 text-center sm:px-12">
              <div className="absolute inset-0 aurora-purple opacity-60" aria-hidden />

              <div className="relative flex flex-col items-center">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Unduh PurpSpace
                </h2>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
                  PurpSpace adalah aplikasi desktop. Pasang di komputermu, lalu
                  masuk dengan akun yang kamu buat di sini.
                </p>

                <a
                  href={DOWNLOAD_URL}
                  download
                  className={buttonClass({ size: "lg", className: "mt-8" })}
                >
                  <Download className="size-4" />
                  Unduh untuk {DOWNLOAD_META.platform}
                </a>

                <p className="mt-4 text-xs text-[var(--bm-text-dim)]">
                  {DOWNLOAD_META.arch} · {DOWNLOAD_META.version}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
