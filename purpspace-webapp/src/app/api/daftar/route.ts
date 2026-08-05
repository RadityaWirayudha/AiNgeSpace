/**
 * `POST /api/daftar` — satu-satunya endpoint website.
 *
 * Membuat akun Clerk lalu mencatat free trial-nya di Supabase. Dipanggil sekali,
 * dari langkah 2, dengan seluruh isi langkah 1 sekaligus.
 *
 * KENAPA SEKALI JALAN, BUKAN DUA ENDPOINT
 * Kalau akun dibuat di langkah 1 lalu user menutup tab, yang tertinggal adalah
 * akun Clerk tanpa langganan. Waktu dia kembali, emailnya ditolak "sudah
 * terdaftar" — dan dia tidak akan pernah bisa mendapatkan trial-nya. Menunda
 * seluruh penulisan sampai langkah 2 menghapus seluruh kelas bug itu.
 *
 * Endpoint terpisah untuk "cek email tersedia" sengaja TIDAK dibuat: itu oracle
 * yang membolehkan siapa pun menebak email mana yang punya akun PurpSpace.
 * Ketersediaan email cukup diketahui dari `createUser` yang gagal — dan itu
 * atomik, jadi dua pendaftaran berbarengan tidak bisa dua-duanya lolos.
 *
 * Bentuk penanganan errornya meniru
 * `purpspace-electron/src/app/api/workspaces/route.ts` — skema zod di scope
 * modul, lalu satu blok catch yang memetakan error ke status. Yang berbeda cuma
 * satu: di sini tidak ada `getAuthUserId()`, karena endpoint ini memang publik.
 */
import { isClerkAPIResponseError } from "@clerk/backend/errors"
import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"

import { clerk } from "@/lib/clerk/backend"
import {
  LANGGANAN_COOKIE,
  LANGGANAN_COOKIE_MAX_AGE,
  hitungTrialEndsAt,
  formatTanggal,
  type LanggananView,
} from "@/lib/langganan"
import { createServerClient } from "@/lib/supabase/server"

const daftarSchema = z.object({
  email: z.email().max(254),
  // Panjang minimumnya diperiksa dua kali dengan sengaja: di sini supaya
  // password yang jelas terlalu pendek tidak perlu memakan satu round trip ke
  // Clerk, dan di Clerk karena di sanalah aturan sebenarnya berada (termasuk
  // pengecekan terhadap daftar password bocor).
  password: z.string().min(8).max(256),
  // Checkbox Syarat & Ketentuan. Ditegakkan di server, bukan cuma lewat atribut
  // `required` di HTML yang bisa dilewati siapa pun.
  setuju: z.literal(true),
  planId: z.enum(["basic", "pro"]),
})

/** Pesan Clerk berbahasa Inggris; yang tampil ke user harus bahasa Indonesia. */
const PESAN_CLERK: Record<string, { pesan: string; field: "email" | "password"; status: number }> = {
  form_identifier_exists: {
    pesan:
      "Email ini sudah terdaftar. Masuk langsung lewat aplikasi desktop PurpSpace.",
    field: "email",
    status: 409,
  },
  form_password_pwned: {
    pesan:
      "Password ini pernah bocor di kebocoran data. Pakai password lain yang belum pernah kamu pakai di tempat lain.",
    field: "password",
    status: 400,
  },
  form_password_length_too_short: {
    pesan: "Password minimal 8 karakter.",
    field: "password",
    status: 400,
  },
  form_password_not_strong_enough: {
    pesan: "Password terlalu mudah ditebak. Coba yang lebih panjang atau lebih acak.",
    field: "password",
    status: 400,
  },
  form_param_format_invalid: {
    pesan: "Format email tidak dikenali.",
    field: "email",
    status: 400,
  },
}

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null

  try {
    const body = await request.json()
    const parsed = daftarSchema.parse(body)

    // 1. Akun. Harus akun Clerk: alur login aplikasi desktop menukar sign-in
    //    token Clerk lewat deep link `purpspace://auth?ticket=…`, jadi akun yang
    //    tidak ada di Clerk tidak akan pernah bisa masuk ke aplikasinya.
    const user = await clerk.users.createUser({
      emailAddress: [parsed.email],
      password: parsed.password,
      // Checkbox S&K di langkah 1. Disimpan di Clerk, bukan di kolom database
      // sendiri — Clerk memang punya tempatnya.
      legalAcceptedAt: new Date(),
    })
    createdUserId = user.id

    // 2. Langganannya. `trial_ends_at` dihitung dari TRIAL_DAYS di
    //    src/content/plans.ts, satu sumber dengan angka yang tampil di halaman.
    const trialEndsAt = hitungTrialEndsAt()
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("subscriptions_purpspace")
      .insert({
        clerk_user_id: user.id,
        plan_id: parsed.planId,
        status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select("id, plan_id, status, trial_ends_at")
      .single()

    if (error) throw error

    // 3. Cookie penanda, supaya refresh di layar "selesai" tidak menendang user
    //    balik ke langkah 1. Isinya uuid baris di atas, bukan id akun.
    const cookieStore = await cookies()
    cookieStore.set(LANGGANAN_COOKIE, data.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LANGGANAN_COOKIE_MAX_AGE,
    })

    const hasil: LanggananView = {
      planId: data.plan_id,
      status: data.status,
      trialEndsLabel: formatTanggal(data.trial_ends_at),
    }

    return NextResponse.json(hasil, { status: 201 })
  } catch (error) {
    // Akun sudah terlanjur dibuat tapi langganannya gagal ditulis. Dibatalkan di
    // sini, kalau tidak user itu terkunci selamanya: emailnya sudah dipakai,
    // tapi trial-nya tidak pernah jadi.
    if (createdUserId) {
      try {
        await clerk.users.deleteUser(createdUserId)
      } catch (rollbackError) {
        // Sengaja tidak menelan diam-diam: baris ini yang membedakan "ada satu
        // akun yatim di Clerk" dari "tidak ada jejak apa-apa".
        console.error(
          `[daftar] gagal membatalkan user Clerk ${createdUserId}:`,
          rollbackError
        )
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Data yang dikirim tidak valid.", details: error.issues },
        { status: 400 }
      )
    }

    if (isClerkAPIResponseError(error)) {
      const code = error.errors[0]?.code ?? ""
      const dikenal = PESAN_CLERK[code]
      if (dikenal) {
        return NextResponse.json(
          { error: dikenal.pesan, field: dikenal.field },
          { status: dikenal.status }
        )
      }
      // Kode yang belum dipetakan tetap dicatat, supaya yang sering muncul bisa
      // diberi pesan Indonesia yang benar nanti.
      console.error("[daftar] kode error Clerk belum dipetakan:", code, error.errors[0])
      return NextResponse.json(
        { error: "Pendaftaran ditolak. Periksa lagi email dan password kamu." },
        { status: 400 }
      )
    }

    // Pelanggaran UNIQUE(clerk_user_id). Praktisnya tidak akan kena — id-nya
    // baru saja dibuat beberapa milidetik sebelumnya — tapi kalau sampai kena,
    // 409 jauh lebih jujur daripada 500.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Akun ini sudah punya langganan PurpSpace." },
        { status: 409 }
      )
    }

    console.error("[daftar] gagal:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan di server. Coba lagi sebentar lagi." },
      { status: 500 }
    )
  }
}
