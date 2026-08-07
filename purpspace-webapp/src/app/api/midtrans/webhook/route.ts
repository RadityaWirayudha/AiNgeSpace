/**
 * `POST /api/midtrans/webhook` — menerima notifikasi pembayaran dari Midtrans.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR:
 * 1. Verifikasi tanda tangan SEBELUM memproses apa pun — tanpa ini siapa pun
 *    bisa mengirim notifikasi "invoice.paid" palsu.
 * 2. Handler ini harus IDEMPOTEN — Midtrans bisa mengirim event yang sama dua
 *    kali. Update yang sama dua kali harus menghasilkan state yang sama.
 * 3. Selalu kembalikan 200 secepatnya — kalau timeout, Midtrans menganggap gagal
 *    dan mengirim ulang. Kerja berat (kalau ada) ditaruh di background.
 *
 * Daftarkan URL ini di Midtrans dashboard:
 *   Sandbox : Settings → Configuration → Payment Notification URL
 *   Production: URL production + /api/midtrans/webhook
 */
import { createHash } from "crypto"
import { NextResponse, type NextRequest } from "next/server"

import { createServerClient } from "@/lib/supabase/server"
import { formatTanggal } from "@/lib/langganan"

// Status transaksi Midtrans yang dianggap LUNAS.
// 'capture' = kartu kredit diotorisasi (perlu di-settle nanti).
// 'settlement' = dana sudah pindah — VA, GoPay, QRIS selalu langsung settlement.
const STATUS_LUNAS = new Set(["capture", "settlement"])

export async function POST(request: NextRequest) {
  const body = await request.json()

  // 1. Verifikasi tanda tangan Midtrans.
  //    Formula: SHA512(order_id + status_code + gross_amount + server_key)
  //    Sumber: https://docs.midtrans.com/docs/verifying-data-authenticity
  const expectedSignature = createHash("sha512")
    .update(
      String(body.order_id) +
        String(body.status_code) +
        String(body.gross_amount) +
        process.env.MIDTRANS_SERVER_KEY!
    )
    .digest("hex")

  if (expectedSignature !== body.signature_key) {
    // Tanda tangan salah = bukan dari Midtrans. Log untuk audit, tapi
    // jangan beri detail ke pengirim.
    console.warn("[midtrans/webhook] tanda tangan tidak valid:", body.order_id)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // 2. Hanya proses yang benar-benar lunas.
  const lunas = STATUS_LUNAS.has(body.transaction_status)
  if (!lunas) {
    // pending / expire / cancel — tidak perlu diproses; tetap 200 supaya
    // Midtrans tidak mengirim ulang terus-menerus.
    return NextResponse.json({ received: true })
  }

  // 3. Cari langganan berdasarkan pending_order_id.
  const orderId: string = body.order_id
  const supabase = createServerClient() // service role — bisa baca/tulis semua

  const { data: sub, error: findError } = await supabase
    .from("subscriptions_purpspace")
    .select("id, plan_id, current_period_end")
    .eq("pending_order_id", orderId)
    .single()

  if (findError || !sub) {
    // Tidak ketemu — mungkin order_id dari sistem lain, atau sudah diproses
    // sebelumnya dan pending_order_id sudah di-clear.
    console.error("[midtrans/webhook] langganan tidak ditemukan untuk order:", orderId)
    // Tetap 200 supaya Midtrans tidak retry selamanya.
    return NextResponse.json({ received: true })
  }

  // 4. Hitung period_end. Ambil durasi dari order_id:
  //    Format: PURPSPACE-{PLAN}-{N}MO-{timestamp}
  //    Contoh: PURPSPACE-PRO-3MO-1754567890123 → durasi = 3 bulan
  const durasiMatch = orderId.match(/-(\d+)MO-/)
  const durasi = durasiMatch ? parseInt(durasiMatch[1], 10) : 1

  // Mulai dari sekarang, bukan dari tanggal mana pun di database.
  // Kalau webhook datang telat beberapa menit, ini yang benar.
  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + durasi)

  // 5. Update langganan — idempoten.
  //    midtrans_order_id unik (UNIQUE INDEX) → kalau event dikirim dua kali,
  //    update kedua akan conflict di index tapi tidak mengubah data apa pun.
  const { error: updateError } = await supabase
    .from("subscriptions_purpspace")
    .update({
      status: "active",
      current_period_end: periodEnd.toISOString(),
      midtrans_order_id: orderId,
      pending_order_id: null, // bersihkan setelah lunas
    })
    .eq("id", sub.id)

  if (updateError) {
    // Kalau error-nya tentang unique constraint midtrans_order_id, berarti
    // event yang sama sudah diproses sebelumnya — aman diabaikan.
    const isIdempotentCollision =
      typeof updateError === "object" &&
      "code" in updateError &&
      (updateError as { code?: string }).code === "23505"

    if (!isIdempotentCollision) {
      console.error("[midtrans/webhook] gagal update:", updateError)
      // Return 500 supaya Midtrans retry — error ini unexpected.
      return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
  }

  console.info(
    `[midtrans/webhook] langganan ${sub.id} aktif sampai ${formatTanggal(periodEnd.toISOString())}`
  )

  return NextResponse.json({ received: true })
}
