/**
 * Klien Supabase — SISI SERVER SAJA.
 *
 * Bentuknya sama persis dengan `purpspace-electron/src/lib/supabase/server.ts`,
 * dan itu disengaja: dua proyek, satu database, satu cara mengaksesnya.
 *
 * Tidak ada padanan `client.ts` berbasis anon key di project ini, dan jangan
 * dibuat. Keempat tabel yang sudah ada plus `subscriptions_purpspace` semuanya
 * menyalakan RLS tanpa satu pun policy — anon dan authenticated ditolak
 * seluruhnya, service role melewatinya. Kalau suatu query mengembalikan array
 * kosong dari browser, jawabannya memindahkan query itu ke route handler, bukan
 * mematikan RLS.
 *
 * Sesi sengaja dimatikan: tidak ada user Supabase Auth di sini, jadi tidak ada
 * token yang perlu di-refresh maupun disimpan.
 */
import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createServerClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
