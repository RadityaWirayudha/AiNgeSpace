/**
 * `POST /api/bayar` — membuat transaksi Midtrans Snap dan mengembalikan token.
 *
 * Dipanggil dari halaman akun / upgrade saat user siap membayar. Endpoint ini
 * TIDAK memberi akses — akses diberikan oleh webhook setelah uang benar-benar
 * masuk. Yang endpoint ini lakukan hanya: bikin token Snap lalu simpan
 * pending_order_id supaya webhook bisa mencocokkan pembayaran ke user yang benar.
 *
 * Identifikasi user: cookie `ps_langganan` (uuid baris di purpspace_subscriptions),
 * sama dengan pola yang dipakai halaman `/mulai`. Website tidak punya sesi Clerk
 * di browser — sesi Clerk ada di aplikasi desktop.
 *
 * Kalau cookie tidak ada atau sudah expired, endpoint mengembalikan 401.
 * User perlu login ulang dari aplikasi desktop atau menghubungi support.
 */
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { snap } from "@/lib/midtrans/server"
import { createServerClient } from "@/lib/supabase/server"
import { LANGGANAN_COOKIE } from "@/lib/langganan"
import { PLANS } from "@/content/plans"

const bayarSchema = z.object({
  planId: z.enum(["basic", "pro"]),
  durasi: z.union([z.literal(1), z.literal(3)]),
})

// Harga per bulan dalam Rupiah (IDR) — bilangan BULAT.
// Midtrans menolak gross_amount yang bukan integer, dan verifikasi signature
// gagal kalau representasi string-nya berbeda (misal "24999.0" vs "24999").
// Kalau harga di plans.ts berubah, angka ini harus ikut diperbarui.
const HARGA_PER_BULAN: Record<string, number> = {
  basic: 24999,
  pro:   49999,
}

export async function POST(request: NextRequest) {
  // 1. Identifikasi langganan dari cookie.
  const cookieStore = await cookies()
  const langgananId = cookieStore.get(LANGGANAN_COOKIE)?.value

  if (!langgananId) {
    return NextResponse.json(
      { error: "Sesi tidak ditemukan. Silakan daftar atau masuk dari aplikasi PurpSpace." },
      { status: 401 }
    )
  }

  // 2. Parse body.
  let parsed: z.infer<typeof bayarSchema>
  try {
    const body = await request.json()
    parsed = bayarSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Data tidak valid.", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 })
  }

  const { planId, durasi } = parsed

  // 3. Ambil langganan dari Supabase.
  const supabase = createServerClient()
  const { data: sub, error: findError } = await supabase
    .from("purpspace_subscriptions")
    .select("id, clerk_user_id, status")
    .eq("id", langgananId)
    .single()

  if (findError || !sub) {
    return NextResponse.json(
      { error: "Langganan tidak ditemukan." },
      { status: 404 }
    )
  }

  // 4. Buat order_id unik.
  //    Format yang bisa di-parse oleh webhook:
  //    PURPSPACE-{PLAN}-{N}MO-{timestamp}
  //    Contoh: PURPSPACE-PRO-3MO-1754567890123
  //    Midtrans MENOLAK order_id duplikat — timestamp memastikan keunikannya.
  const orderId = `PURPSPACE-${planId.toUpperCase()}-${durasi}MO-${Date.now()}`

  const plan = PLANS.find((p) => p.id === planId)!
  const hargaPerBulan = HARGA_PER_BULAN[planId]
  const hargaTotal = hargaPerBulan * durasi

  // 5. Simpan pending_order_id SEBELUM memanggil Midtrans.
  //    Kalau disimpan sesudah, ada window di mana webhook datang sebelum
  //    pending_order_id ada di database — dan webhook-nya akan di-ignore.
  const { error: updateError } = await supabase
    .from("purpspace_subscriptions")
    .update({ pending_order_id: orderId })
    .eq("id", sub.id)

  if (updateError) {
    console.error("[bayar] gagal menyimpan pending_order_id:", updateError)
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mempersiapkan pembayaran." },
      { status: 500 }
    )
  }

  // 6. Buat transaksi Midtrans Snap.
  let token: string
  try {
    const { token: snapToken } = await snap.createTransaction({
      transaction_details: {
        order_id:     orderId,
        gross_amount: hargaTotal,
      },
      item_details: [
        {
          id:       planId,
          price:    hargaPerBulan,
          quantity: durasi,
          name:     `PurpSpace ${plan.name} – ${durasi} Bulan`,
        },
      ],
      // Email diambil dari clerk_user_id kalau suatu saat mau ditambahkan.
      // Untuk sekarang tidak wajib; Midtrans tetap bisa memproses tanpa email.
    })
    token = snapToken
  } catch (midtransError) {
    // Midtrans gagal → rollback pending_order_id supaya user bisa coba lagi.
    await supabase
      .from("purpspace_subscriptions")
      .update({ pending_order_id: null })
      .eq("id", sub.id)

    console.error("[bayar] gagal membuat transaksi Midtrans:", midtransError)
    return NextResponse.json(
      { error: "Gagal membuka halaman pembayaran. Coba lagi sebentar lagi." },
      { status: 502 }
    )
  }

  return NextResponse.json({ snapToken: token })
}
