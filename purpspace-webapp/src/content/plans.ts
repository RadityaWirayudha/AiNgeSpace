/**
 * Isi paket, ditulis sekali di sini.
 *
 * Tiga tempat memakainya — halaman `/harga`, overlay "Pilih paket" di
 * `/mulai`, dan kartu ringkasan di kolom kanan `/mulai` — jadi harganya
 * tidak mungkin berbeda antar-halaman gara-gara satu tempat lupa diubah.
 *
 * Teks fiturnya datang langsung dari user; jangan dikarang ulang.
 */

export type PlanId = "basic" | "pro"

export interface Plan {
  id: PlanId
  /** Nama yang tampil di kartu. */
  name: string
  /** Satu baris "paket ini cocok buat siapa". */
  tagline: string
  /**
   * Angka besar berwarna ungu di kartu — bukan harga, tapi hal yang paling
   * membedakan kedua paket ini: berapa banyak grid terminal yang boleh dibuka.
   */
  headline: string
  /** Baris kecil di bawah `headline`. */
  headlineNote: string
  /** Harga per bulan, sudah diformat. */
  price: string
  period: string
  /** Badge di sudut kartu, kalau ada. */
  badge?: string
  /** Kartu Pro dapat perlakuan "paling populer": border ungu + tombol isi. */
  featured?: boolean
  features: string[]
  /** Label tombol di dasar kartu. */
  cta: string
}

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Buat kamu yang baru mau coba PurpSpace.",
    headline: "3 Grid Terminal",
    headlineNote: "cukup untuk satu proyek berjalan",
    price: "Rp24.999",
    period: "/bulan",
    badge: "Gratis 12 hari",
    features: [
      "Maksimal 3 Grid Terminal",
      "Kalau app ditutup, susunan terminal & direktori ter-reset",
      "Gratis 12 hari, batal kapan saja",
    ],
    cta: "Mulai Free Trial",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Buat kamu yang pegang banyak proyek sekaligus.",
    headline: "Grid Terminal tanpa batas",
    headlineNote: "buka sebanyak yang layarmu sanggup",
    price: "Rp49.999",
    period: "/bulan",
    badge: "Paling Populer",
    featured: true,
    features: [
      "Grid Terminal tanpa batas",
      "Saved Workspaces tanpa batas & One-Click Restore",
      "Sekali klik, langsung auto-launch terminal lengkap dengan command bawaan (npm run dev, docker-compose, dll)",
      "PurpCommit — commit GitHub dengan pesan dari AI",
      "PurpExplorer, semuanya dalam satu aplikasi",
    ],
    cta: "Mulai sekarang",
  },
]

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id)
  if (!plan) throw new Error(`Paket tidak dikenal: ${id}`)
  return plan
}

/** Dipakai `/mulai` untuk membaca `?paket=` tanpa memercayai isinya. */
export function parsePlanId(value: string | undefined | null): PlanId {
  return value === "pro" ? "pro" : "basic"
}

/** Lama free trial, disebut di beberapa tempat. Satu sumber saja. */
export const TRIAL_DAYS = 12
