/**
 * `/mulai` — alur free trial.
 *
 * `?paket=pro` datang dari tombol di kartu Pro halaman `/harga`, jadi paket yang
 * diklik di sana sudah terpilih begitu halaman ini terbuka. Nilainya dibersihkan
 * lewat `parsePlanId()` — apa pun selain "pro" jatuh ke Basic.
 *
 * Di Next 16 `searchParams` sebuah Promise di Server Component, dan
 * `PageProps<'/mulai'>` itu helper global (di-generate `next dev` / `next build`
 * / `next typegen`), jadi tidak perlu di-import.
 */
import type { Metadata } from "next"

import { TrialFlow } from "@/components/mulai/TrialFlow"
import { parsePlanId } from "@/content/plans"

export const metadata: Metadata = {
  title: "Mulai Free Trial — PurpSpace",
  description:
    "Buat akun PurpSpace, pilih paket, lalu unduh aplikasi desktopnya.",
}

export default async function MulaiPage(props: PageProps<"/mulai">) {
  const { paket } = await props.searchParams
  return <TrialFlow initialPlan={parsePlanId(typeof paket === "string" ? paket : null)} />
}
