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
 *
 * MIDTRANS_IS_PRODUCTION diset eksplisit — BUKAN dari NODE_ENV.
 * Alasannya: Cloudflare Workers selalu menaruh NODE_ENV="production", sehingga
 * pakai NODE_ENV berarti kode selalu menunjuk endpoint Production Midtrans,
 * bahkan ketika key-nya masih Sandbox (SB-Mid-server-...). Ini bug senyap:
 * transaksi gagal tanpa pesan error yang jelas.
 *
 * Cara set:
 *   Sandbox : MIDTRANS_IS_PRODUCTION=false  (wrangler secret put atau .env.local)
 *   Production: MIDTRANS_IS_PRODUCTION=true  (setelah akun Midtrans diverifikasi)
 */
import MidtransClient from "midtrans-client"

export const snap = new MidtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
})
