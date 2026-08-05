/**
 * Hal-hal kecil yang dipakai bersama oleh route handler `/api/daftar` dan
 * Server Component `/mulai`. Ditaruh di satu tempat supaya keduanya tidak bisa
 * berbeda pendapat soal nama cookie atau format tanggal.
 */
import { TRIAL_DAYS, type PlanId } from "@/content/plans"
import type { SubscriptionStatus } from "@/types/database"

/**
 * Potongan langganan yang boleh sampai ke browser.
 *
 * Bentuk yang sama persis dipakai dua jalur: respons `POST /api/daftar` dan
 * hasil SELECT di Server Component `/mulai`. Disamakan supaya layar "selesai"
 * tidak perlu tahu dari mana datanya — dan supaya keduanya tidak bisa diam-diam
 * berbeda bentuk.
 *
 * `id` langganan sengaja TIDAK ikut: nilainya cuma dibutuhkan server, dan
 * satu-satunya tempat ia tinggal adalah cookie httpOnly.
 */
export interface LanggananView {
  planId: PlanId
  status: SubscriptionStatus
  /** Sudah diformat di server, mis. "18 Agustus 2026". */
  trialEndsLabel: string
}

/**
 * Cookie httpOnly berisi `id` (uuid) baris langganan.
 *
 * Sengaja tidak ditandatangani: `gen_random_uuid()` tidak bisa ditebak, nilainya
 * tidak pernah muncul di URL, dan yang bisa dibaca dengannya cuma nama paket
 * plus tanggal akhir trial. HMAC di sini hanya akan menambah satu env var
 * rahasia tanpa menutup apa pun.
 */
export const LANGGANAN_COOKIE = "ps_langganan"

/**
 * Tujuh hari. Cookie ini bukan sesi login — ia cuma menjaga layar "selesai"
 * tetap muncul kalau user me-refresh atau kembali sebentar kemudian. Sesi yang
 * sebenarnya dibuat di aplikasi desktop.
 */
export const LANGGANAN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

/** Akhir free trial, dihitung dari jam server — bukan dari jam browser. */
export function hitungTrialEndsAt(from: Date = new Date()): Date {
  const end = new Date(from)
  end.setUTCDate(end.getUTCDate() + TRIAL_DAYS)
  return end
}

/**
 * "18 Agustus 2026".
 *
 * Selalu dipanggil di server, dan selalu dengan zona waktu yang dipatok, supaya
 * tanggal yang dirender saat submit sama persis dengan yang dirender setelah
 * refresh — dan supaya tidak ada mismatch hidrasi.
 */
export function formatTanggal(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  })
}
