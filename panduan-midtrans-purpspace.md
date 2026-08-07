# Panduan Midtrans untuk PurpSpace

Ditulis khusus untuk project ini — `purpspace-webapp`, Next.js, Clerk, Supabase —
dan khusus untuk pasar Indonesia. Referensi: model pembayaran ngodingpakeai.com
(popup Snap dengan GoPay QRIS + Virtual Account + QRIS).

**Stripe dihapus dari rencana.** Panduan ini menggantikannya sepenuhnya.

---

## 0. Kenapa Midtrans, bukan Stripe

| | Stripe Indonesia | Midtrans |
|---|---|---|
| GoPay | ❌ | ✅ |
| QRIS | ❌ | ✅ |
| Virtual Account (Mandiri, BNI, BRI) | ✅ tapi terbatas | ✅ lengkap |
| Auto-recurring | ❌ tidak ada di Indonesia | ✅ ada (GoPay Recurring) |
| Akun langsung aktif | ❌ butuh pengajuan | ✅ |
| Integrasi komunitas Indonesia | rendah | tinggi — banyak tutorial |

---

## 1. Model pembayaran: per-periode, bukan auto-recurring

Mengikuti model ngodingpakeai.com:

- Pelanggan memilih plan + durasi (misal: Pro 1 bulan atau Pro 3 bulan)
- Bayar sekali via popup Snap (GoPay / VA / QRIS)
- Midtrans kirim webhook → server aktifkan langganan sampai `period_end`
- Saat `period_end` lewat → user perlu bayar lagi (tidak ada tarik otomatis)

Ini menghapus seluruh kompleksitas recurring subscription. Tidak ada invoice,
tidak ada customer Midtrans yang perlu dijaga. Cukup satu transaksi per periode.

Kalau nantinya mau auto-recurring lewat GoPay Recurring — Midtrans punya API-nya,
tapi itu fitur terpisah yang bisa ditambah belakangan. Mulai dari yang simpel dulu.

---

## 2. Daftar akun dan ambil kunci

1. Daftar di **dashboard.midtrans.com** — pilih entitas bisnis kamu.
2. Di pojok kiri atas ada toggle **Sandbox** ↔ **Production**. Pastikan **Sandbox** dulu.
3. Masuk ke **Settings → Access keys**:
   - `Server Key` → rahasia, hanya di server
   - `Client Key` → boleh ada di browser

Taruh di `purpspace-webapp/.env.local`:

```
# Midtrans — sandbox
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
# Untuk production nanti: Mid-server-... dan Mid-client-...
```

`MIDTRANS_SERVER_KEY` **tidak boleh punya prefix `NEXT_PUBLIC_`**. Kalau dikasih
prefix itu, nilainya ikut ter-bundle ke browser.

`MIDTRANS_CLIENT_KEY` boleh `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` — memang dipakai
di browser untuk memuat Snap.js.

---

## 3. Pasang SDK

```bash
cd purpspace-webapp
npm install midtrans-client
npm install --save-dev @types/midtrans-client
```

Buat `src/lib/midtrans/server.ts`:

```ts
import MidtransClient from "midtrans-client"

// Satu instance, reused di semua endpoint — sama polanya dengan
// src/lib/clerk/backend.ts dan src/lib/supabase/server.ts.
export const snap = new MidtransClient.Snap({
  isProduction: process.env.NODE_ENV === "production",
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
})
```

---

## 4. Endpoint: buat transaksi

`src/app/api/bayar/route.ts` — dipanggil saat user klik tombol bayar di halaman
akun / setelah trial:

```ts
import { auth } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { snap } from "@/lib/midtrans/server"
import { createAuthedClient } from "@/lib/supabase/server"
import { PLANS } from "@/content/plans"

const bayarSchema = z.object({
  planId: z.enum(["basic", "pro"]),
  durasi: z.union([z.literal(1), z.literal(3)]),  // bulan
})

// Harga dalam Rupiah — satu sumber kebenaran, jangan duplikasi di plans.ts
const HARGA: Record<string, number> = {
  basic: 24999,
  pro:   49999,
}

export async function POST(request: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { planId, durasi } = bayarSchema.parse(body)

  const plan = PLANS.find(p => p.id === planId)!
  const hargaTotal = HARGA[planId] * durasi

  // Order ID unik — Midtrans menolak duplikat.
  // Format: PURPSPACE-PRO-1MO-<timestamp>
  const orderId = `PURPSPACE-${planId.toUpperCase()}-${durasi}MO-${Date.now()}`

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: hargaTotal,
    },
    item_details: [{
      id: planId,
      price: HARGA[planId],
      quantity: durasi,
      name: `PurpSpace ${plan.name} – ${durasi} Bulan`,
    }],
    // Email pelanggan penting: Midtrans mengirim notifikasi pembayaran ke sini.
    // Ambil dari Clerk kalau perlu — sekarang cukup kosongkan atau isi dari
    // field yang sudah kamu punya.
  }

  const { token } = await snap.createTransaction(parameter)

  // Simpan orderId ke Supabase sebelum redirect — biar webhook bisa
  // mencocokkannya ke user ini.
  const { supabase } = await createAuthedClient()
  await supabase
    .from("subscriptions_purpspace")
    .update({ pending_order_id: orderId })
    .eq("clerk_user_id", userId)

  return NextResponse.json({ snapToken: token })
}
```

---

## 5. Sisi klien: buka popup Snap

Muat Snap.js sekali di layout atau di komponen halaman akun. Untuk Next.js App Router:

```tsx
// src/components/SnapScript.tsx
"use client"
import Script from "next/script"

export function SnapScript() {
  const env = process.env.NODE_ENV === "production" ? "app" : "app.sandbox"
  return (
    <Script
      src={`https://${env}.midtrans.com/snap/snap.js`}
      data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
      strategy="lazyOnload"
    />
  )
}
```

Tombol bayar di halaman akun / upgrade:

```tsx
"use client"

async function handleBayar(planId: string, durasi: 1 | 3) {
  const res = await fetch("/api/bayar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, durasi }),
  })
  const { snapToken } = await res.json()

  // @ts-expect-error — snap dimuat lewat Script tag, ada di window
  window.snap.pay(snapToken, {
    onSuccess(result: unknown) {
      // Jangan langsung aktifkan akses di sini!
      // Webhook yang jadi sumber kebenaran. Di sini cukup tampilkan
      // "Pembayaran berhasil, menunggu konfirmasi..."
      console.log("snap success", result)
    },
    onPending(result: unknown) {
      // VA / QRIS: user sudah memilih metode tapi belum transfer.
      // Tampilkan instruksi pembayaran.
      console.log("snap pending", result)
    },
    onError(result: unknown) {
      console.error("snap error", result)
    },
    onClose() {
      // User tutup popup tanpa bayar.
    },
  })
}
```

---

## 6. Webhook — sumber kebenaran

`src/app/api/midtrans/webhook/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Verifikasi tanda tangan. Tanpa ini siapa pun bisa kirim notifikasi palsu.
  // Formula: SHA512(order_id + status_code + gross_amount + server_key)
  const expectedSig = crypto
    .createHash("sha512")
    .update(
      body.order_id +
      body.status_code +
      body.gross_amount +
      process.env.MIDTRANS_SERVER_KEY!
    )
    .digest("hex")

  if (expectedSig !== body.signature_key) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // Hanya proses yang benar-benar dibayar.
  const lunas =
    body.transaction_status === "capture" ||
    body.transaction_status === "settlement"

  if (!lunas) {
    // pending / expire / cancel — tidak perlu diproses, tapi tetap 200
    // supaya Midtrans tidak mengirim ulang.
    return NextResponse.json({ received: true })
  }

  // Parse order_id: PURPSPACE-PRO-1MO-<timestamp>
  // Ambil planId dan durasi dari sana, atau dari metadata di Supabase.
  const orderId: string = body.order_id
  const supabase = createServerClient()  // service role — boleh baca/tulis semua

  // Cari langganan dengan pending_order_id ini.
  const { data: sub } = await supabase
    .from("subscriptions_purpspace")
    .select("id, trial_ends_at, current_period_end")
    .eq("pending_order_id", orderId)
    .single()

  if (!sub) {
    // Tidak ketemu — mungkin order_id dari sistem lain / sudah diproses.
    console.error("[midtrans/webhook] order tidak ditemukan:", orderId)
    return NextResponse.json({ received: true })
  }

  // Hitung period_end: dari sekarang + durasi bulan.
  // Ambil durasi dari order_id (angka sebelum "MO").
  const durasiMatch = orderId.match(/(\d+)MO/)
  const durasi = durasiMatch ? parseInt(durasiMatch[1]) : 1

  const mulai = new Date()
  const periodEnd = new Date(mulai)
  periodEnd.setMonth(periodEnd.getMonth() + durasi)

  // Idempoten: update dengan status + tanggal. Kalau event dikirim dua kali,
  // hasilnya sama saja.
  await supabase
    .from("subscriptions_purpspace")
    .update({
      status: "active",
      current_period_end: periodEnd.toISOString(),
      midtrans_order_id: orderId,
      pending_order_id: null,  // bersihkan setelah lunas
    })
    .eq("id", sub.id)

  return NextResponse.json({ received: true })
}
```

**Daftarkan URL webhook di dashboard Midtrans:**
Settings → Configuration → Payment Notification URL:
- Sandbox: `https://purpspace-webapp.workers.dev/api/midtrans/webhook`
- Production: URL production kamu

---

## 7. Migrasi database

`supabase/migrations/006_midtrans_subscriptions_purpspace.sql`:

```sql
alter table public.subscriptions_purpspace
  add column if not exists midtrans_order_id  text,
  add column if not exists pending_order_id   text,
  add column if not exists current_period_end timestamptz;

-- Index untuk webhook lookup dari order_id.
create index if not exists subscriptions_purpspace_pending_order_idx
  on public.subscriptions_purpspace (pending_order_id)
  where pending_order_id is not null;

create unique index if not exists subscriptions_purpspace_midtrans_order_idx
  on public.subscriptions_purpspace (midtrans_order_id)
  where midtrans_order_id is not null;

notify pgrst, 'reload schema';
```

Jalankan di: https://supabase.com/dashboard/project/ucneqextloynzymzxygi/editor

Jangan lupa update `src/types/database.ts` mengikuti kolom baru ini.

---

## 8. Env var untuk production di Cloudflare Workers

Sama seperti secrets lain — jangan masuk ke kode, masuk via wrangler:

```bash
cd purpspace-webapp
npx wrangler secret put MIDTRANS_SERVER_KEY
# paste: Mid-server-... (bukan SB-)
```

`NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` di-bake saat build. Taruh di `.env.production`
atau `.env.local` sebelum `npm run build`, sama seperti Supabase URL.

---

## 9. Tes lokal

1. Buka **Midtrans Sandbox dashboard** → Settings → Configuration →
   Payment Notification URL → isi dengan URL webhook sementara dari
   [webhook.site](https://webhook.site) atau `stripe listen` equivalent:
   pakai **ngrok** atau **localtunnel**.

2. Atau: test tanpa server webhook dulu — di Midtrans Sandbox bisa simulasi
   pembayaran berhasil dari dashboard → **Transactions → pilih transaksi →
   Accept Payment**.

3. Kartu test Midtrans Sandbox:
   - Nomor: `4811 1111 1111 1114`
   - CVV: `123`, Expired: bulan/tahun mana pun di masa depan
   - Untuk simulasi VA/GoPay: tersedia di simulator Sandbox

---

## 10. Jebakan yang perlu diwaspadai

**Order ID duplikat.** Midtrans menolak order_id yang sama dua kali. Pastikan
formatnya mengandung timestamp atau UUID — jangan pakai user ID yang statis.

**`settlement` vs `capture`.** Kartu kredit bisa `capture` dulu, baru `settlement`
nanti. VA dan GoPay langsung `settlement`. Handle keduanya sebagai "lunas".

**`gross_amount` harus bilangan bulat IDR.** Rp24.999 → `24999`, bukan `24999.00`.
Kalau dikirim sebagai float, verifikasi signature akan gagal karena representasi
string-nya berbeda.

**Webhook bisa datang beberapa detik setelah popup `onSuccess`.** Jangan beri akses
dari `onSuccess` — tunggu webhook. Tampilkan "menunggu konfirmasi" dan polling
status dari Supabase tiap 2 detik selama 30 detik jika perlu.

**Trial 12 hari.** User yang masih trial belum perlu bayar. Tunjukkan tombol bayar
hanya ketika `status === 'trialing' && trial_ends_at < now + 3 hari` (pengingat
sebelum habis) atau setelah trial berakhir.

---

## 11. Urutan kerja yang disarankan

1. **Daftar akun Midtrans** — aktif langsung, tidak perlu menunggu.
2. Ambil Sandbox keys → simpan di `.env.local`.
3. Jalankan **migrasi 006** di Supabase SQL Editor.
4. `npm install midtrans-client` → tulis `src/lib/midtrans/server.ts`.
5. Tulis **webhook handler dulu** (`/api/midtrans/webhook`) → test dengan
   Midtrans Sandbox simulator.
6. Tulis endpoint `/api/bayar` + tombol di UI.
7. Tes ujung ke ujung di Sandbox: buka popup → bayar → cek status di Supabase.
8. Daftarkan URL webhook production di Midtrans dashboard.
9. Set `MIDTRANS_SERVER_KEY` di wrangler secrets.
10. Deploy → tes sekali lagi dengan transaksi nyata bernilai kecil.

---

## 12. Checklist sebelum live

- [ ] Akun Midtrans sudah diverifikasi bisnis.
- [ ] Semua alur dites di Sandbox sampai tuntas.
- [ ] URL webhook production sudah didaftarkan di Midtrans dashboard.
- [ ] Verifikasi signature webhook berjalan benar.
- [ ] Webhook sudah idempoten (test kirim dua kali, hasilnya sama).
- [ ] `MIDTRANS_SERVER_KEY` production sudah di-set via `wrangler secret put`.
- [ ] `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` production sudah di-set sebelum build.
- [ ] Tidak ada kunci Sandbox (`SB-`) yang ikut ke production.
- [ ] Halaman "menunggu konfirmasi" setelah bayar — tidak langsung buka akses.
- [ ] Handling trial: tombol bayar tidak muncul saat masih trial aktif.
