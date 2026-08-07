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
 *
 * Halaman ini juga membaca cookie `ps_langganan`. Kalau ada dan barisnya ketemu,
 * alurnya dibuka langsung di layar "selesai" — itu yang membuat refresh di
 * tengah jalan tidak lagi menendang user balik ke langkah 1. `cookies()`
 * membuat halaman ini dirender dinamis, dan itu memang yang diinginkan: isinya
 * berbeda per pengunjung, jadi tidak boleh di-cache.
 */
import type { Metadata } from "next"
import { cookies } from "next/headers"

import { TrialFlow } from "@/components/mulai/TrialFlow"
import { parsePlanId } from "@/content/plans"
import {
  LANGGANAN_COOKIE,
  formatTanggal,
  type LanggananView,
} from "@/lib/langganan"
import { createServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Mulai Free Trial — PurpSpace",
  description:
    "Buat akun PurpSpace, pilih paket, lalu unduh aplikasi desktopnya.",
}

/**
 * Query-nya lewat service role dari server. RLS di `purpspace_subscriptions`
 * nyala tanpa satu pun policy, jadi tidak ada jalan lain — dan memang tidak
 * perlu ada: browser tidak boleh menanyakan tabel ini sendiri.
 */
async function bacaLangganan(): Promise<LanggananView | null> {
  const id = (await cookies()).get(LANGGANAN_COOKIE)?.value
  if (!id) return null

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("purpspace_subscriptions")
    .select("plan_id, status, trial_ends_at")
    .eq("id", id)
    .maybeSingle()

  // Cookie basi atau isinya bukan uuid yang sah (Postgres menolaknya dengan
  // 22P02). Dua-duanya bukan alasan untuk menggagalkan halaman — alurnya cukup
  // dimulai dari awal. Cookie-nya tidak bisa dihapus dari sini: `.set()` hanya
  // sah di Server Function atau Route Handler.
  if (error || !data) return null

  return {
    planId: data.plan_id,
    status: data.status,
    trialEndsLabel: formatTanggal(data.trial_ends_at),
  }
}

export default async function MulaiPage(props: PageProps<"/mulai">) {
  const [{ paket }, langganan] = await Promise.all([
    props.searchParams,
    bacaLangganan(),
  ])

  return (
    <TrialFlow
      initialPlan={parsePlanId(typeof paket === "string" ? paket : null)}
      langganan={langganan}
    />
  )
}
