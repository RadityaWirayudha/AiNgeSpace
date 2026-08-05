/**
 * Bentuk tabel Supabase yang disentuh WEBSITE — hanya satu.
 *
 * Empat tabel milik aplikasi desktop (workspaces_purpspace, panes_purpspace,
 * github_connections_purpspace, env_vars_purpspace) sengaja tidak ikut disalin
 * ke sini. Website tidak pernah menanyakannya, jadi tipenya cuma akan jadi kode
 * mati yang lama-lama menyimpang dari skema sebenarnya. Bentuk lengkapnya ada di
 * `purpspace-electron/src/types/database.ts`.
 *
 * Sumber kebenaran kolom di bawah ini: `supabase/migrations/005_subscriptions_purpspace.sql`.
 */

/**
 * `plan_id` dijaga CHECK di database, bukan foreign key — katalog paketnya
 * memang tinggal di kode. Tipenya diambil dari katalog itu supaya nama paket
 * baru yang ditambahkan di sana tidak diam-diam berbeda dengan yang ditulis ke
 * database; kalau menambah paket, CHECK di migrasi harus ikut diperbarui.
 */
import type { PlanId } from "@/content/plans"

/**
 * Semua nilai yang diizinkan CHECK `subscriptions_purpspace_status_known`.
 * Hari ini hanya `trialing` yang pernah ditulis; sisanya baru terpakai begitu
 * webhook Stripe masuk di migrasi 006.
 */
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled"

export interface Database {
  public: {
    Tables: {
      subscriptions_purpspace: {
        Row: {
          id: string
          clerk_user_id: string
          plan_id: PlanId
          status: SubscriptionStatus
          trial_ends_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          plan_id: PlanId
          status?: SubscriptionStatus
          trial_ends_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          plan_id?: PlanId
          status?: SubscriptionStatus
          trial_ends_at?: string
          created_at?: string
          updated_at?: string
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
