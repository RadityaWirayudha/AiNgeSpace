/**
 * Bentuk tabel Supabase yang disentuh WEBSITE — hanya satu.
 *
 * Empat tabel milik aplikasi desktop (purpspace_workspaces, purpspace_panes,
 * purpspace_github_connections, purpspace_env_vars) sengaja tidak ikut disalin
 * ke sini. Website tidak pernah menanyakannya, jadi tipenya cuma akan jadi kode
 * mati yang lama-lama menyimpang dari skema sebenarnya. Bentuk lengkapnya ada di
 * `purpspace-electron/src/types/database.ts`.
 *
 * Sumber kebenaran kolom di bawah ini: `supabase/migrations/005_purpspace_subscriptions.sql`.
 */

/**
 * `plan_id` dijaga CHECK di database, bukan foreign key — katalog paketnya
 * memang tinggal di kode. Tipenya diambil dari katalog itu supaya nama paket
 * baru yang ditambahkan di sana tidak diam-diam berbeda dengan yang ditulis ke
 * database; kalau menambah paket, CHECK di migrasi harus ikut diperbarui.
 */
import type { PlanId } from "@/content/plans"

/**
 * Semua nilai yang diizinkan CHECK `purpspace_subscriptions_status_known`.
 * `trialing` ditulis saat pendaftaran. `active` ditulis oleh webhook Midtrans
 * setelah pembayaran lunas. `past_due` saat invoice lewat tenggat. `canceled`
 * saat langganan diakhiri.
 */
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled"

export interface Database {
  public: {
    Tables: {
      purpspace_subscriptions: {
        Row: {
          id: string
          clerk_user_id: string
          plan_id: PlanId
          status: SubscriptionStatus
          trial_ends_at: string
          created_at: string
          updated_at: string
          // Ditambahkan migrasi 006 — Midtrans
          /** order_id Midtrans yang sudah LUNAS. Null selama masih trial. */
          midtrans_order_id: string | null
          /** order_id yang sedang menunggu pembayaran. Di-clear setelah webhook berhasil. */
          pending_order_id: string | null
          /** Kapan periode berbayar berakhir, diisi webhook setelah bayar. */
          current_period_end: string | null
        }
        Insert: {
          id?: string
          clerk_user_id: string
          plan_id: PlanId
          status?: SubscriptionStatus
          trial_ends_at: string
          created_at?: string
          updated_at?: string
          midtrans_order_id?: string | null
          pending_order_id?: string | null
          current_period_end?: string | null
        }
        Update: {
          id?: string
          clerk_user_id?: string
          plan_id?: PlanId
          status?: SubscriptionStatus
          trial_ends_at?: string
          created_at?: string
          updated_at?: string
          midtrans_order_id?: string | null
          pending_order_id?: string | null
          current_period_end?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
