/**
 * Klien Midtrans Snap — SISI SERVER SAJA.
 *
 * Polanya sama dengan src/lib/clerk/backend.ts dan src/lib/supabase/server.ts:
 * satu instance, dipakai ulang di semua route handler.
 *
 * JANGAN beri MIDTRANS_SERVER_KEY prefix NEXT_PUBLIC_ — kalau prefix itu ada,
 * nilainya ikut ter-bundle ke browser dan siapa pun bisa memakai akun Midtrans-mu.
 *
 * NEXT_PUBLIC_MIDTRANS_CLIENT_KEY memang sengaja NEXT_PUBLIC_ karena ia dipakai
 * di browser untuk memuat Snap.js via data-client-key.
 */
import MidtransClient from "midtrans-client"

export const snap = new MidtransClient.Snap({
  isProduction: process.env.NODE_ENV === "production",
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
})
