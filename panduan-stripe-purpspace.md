# Panduan Stripe untuk PurpSpace

Ditulis khusus untuk project ini — `purpspace-webapp`, Next.js 16, Clerk, Supabase —
dan khusus untuk **akun Stripe Indonesia**. Bukan panduan Stripe umum, karena
panduan Stripe umum akan menyesatkanmu di sini.

Statusnya: **belum ada satu baris kode Stripe pun di repo ini.** Itu disengaja.
Yang sudah jalan adalah pendaftaran + free trial 12 hari (`POST /api/daftar`
→ Clerk + `subscriptions_purpspace`). Stripe baru masuk setelah kamu punya
kredensialnya, karena kode pembayaran yang tidak pernah dites bukan fitur.

---

## 0. Baca ini dulu, sebelum apa pun

Empat kenyataan tentang Stripe di Indonesia. Semuanya mengubah desain, bukan cuma
detail teknis:

1. **Indonesia masih preview / undangan.** Kamu mungkin perlu mengajukan akses
   dan menunggu, bukan langsung bisa aktif seperti akun US.
2. **Satu-satunya metode bayar: Indonesia Bank Transfer (Virtual Account).**
   Tidak ada kartu kredit. Tidak ada kartu debit. Tidak ada e-wallet.
3. **Hanya IDR, dan hanya dalam negeri.** Tidak ada transaksi lintas negara.
4. **TIDAK ADA AUTO-DEBIT.** Ini yang paling penting. Transfer bank itu
   *push payment* — pelangganmu yang mengirim uang, bukan kamu yang menarik.
   Tiap bulan, mereka harus transfer lagi. Sendiri.

**Konsekuensinya untuk PurpSpace:** langganan bulanan Rp24.999 / Rp49.999 tidak
bisa "tinggal jalan". Tiap siklus, sistemmu mengirim invoice, pelanggan transfer
ke Virtual Account, lalu webhook memberitahumu bahwa uangnya masuk. Kalau mereka
lupa transfer, langganannya jatuh ke `past_due` lalu `unpaid` — dan aplikasinya
harus bisa merespons itu.

Itu sebabnya form kartu di langkah 2 sudah dihapus dari `/mulai`. Meminta nomor
kartu ke gateway yang tidak menerima kartu bukan cuma kode mati, itu bohong ke
pengunjung.

**Kalau auto-debit itu wajib buatmu**, Stripe bukan jawabannya untuk pasar
Indonesia. Yang punya auto-debit di sini itu Midtrans (recurring/subscription
lewat kartu & GoPay autopay) atau Xendit (Direct Debit / kartu). Ini bukan
ajakan pindah — kamu sudah memilih Stripe dan itu keputusanmu — tapi kamu berhak
tahu apa yang kamu dapat dan apa yang tidak.

---

## 1. Bikin akun dan aktifkan

1. Daftar di `dashboard.stripe.com/register`, pilih negara **Indonesia**.
2. Lengkapi aktivasi bisnis. Entitas yang diterima Stripe Indonesia:
   **PT**, **PT Perorangan**, **UD / usaha dagang**, dan **perorangan**.
   Yayasan / NGO / non-profit **tidak** diterima.
3. Siapkan: NPWP, KTP direktur/pemilik, akta pendirian (kalau PT), dan rekening
   bank atas nama entitas yang sama.
4. Biaya: tidak ada biaya bulanan. Yang dipotong biaya per transaksi.

Kalau Indonesia masih preview waktu kamu daftar, kamu akan diminta mengisi form
akses lebih dulu. Tidak ada jalan pintas untuk ini.

---

## 2. Test mode — kerjakan semuanya di sini dulu

Di pojok kanan atas dashboard ada toggle **Test mode**. Nyalakan.

Ambil kuncinya di **Developers → API keys**:

- `pk_test_…` — publishable. Kita **tidak memakainya** di project ini (tidak ada
  Stripe.js di browser; semua panggilan dari server).
- `sk_test_…` — secret. Ini yang dipakai.

Taruh di `purpspace-webapp/.env.local`:

```
# Stripe — test mode
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...     # diisi di langkah 6
STRIPE_PRICE_BASIC=price_...        # diisi di langkah 3
STRIPE_PRICE_PRO=price_...          # diisi di langkah 3
```

`.env.local` sudah ter-gitignore lewat pola `.env*` di `.gitignore` root — sudah
saya cek dengan `git check-ignore -v`. **Jangan pernah** menaruh `sk_…` di kode,
di `NEXT_PUBLIC_*` apa pun, atau di komponen klien. Prefix `NEXT_PUBLIC_`
membuat nilainya ikut ter-bundle ke browser; satu kesalahan di situ berarti siapa
pun bisa memakai akun Stripe-mu.

Kalau kunci pernah bocor, **roll** dari Developers → API keys. Menghapus commit
saja tidak cukup.

---

## 3. Bikin Product + Price di dashboard, bukan di kode

**Product catalog → Add product.** Dua kali:

| Product | Price | Billing |
|---|---|---|
| PurpSpace Basic | Rp24.999 | Recurring, monthly |
| PurpSpace Pro | Rp49.999 | Recurring, monthly |

Salin `price_…` masing-masing ke `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PRO`.

**Kenapa env var, bukan hard-code di `src/content/plans.ts`:** Price ID di test
mode berbeda dengan yang di live mode. Kalau di-hard-code, kamu harus mengubah
kode untuk naik ke produksi — dan itu persis momen di mana orang lupa.

**Satu hal yang wajib kamu buktikan sendiri, jangan percaya saya:** satuan
terkecil IDR di Stripe. Setahu saya IDR bukan *zero-decimal currency* di Stripe,
jadi Rp24.999 ditulis `2499900`. Tapi salah faktor 100 di sini artinya kamu
menagih Rp2,5 juta atau Rp250. Bikin satu Price di test mode, lalu **lihat angka
yang ditampilkan dashboard**. Yang dashboard tampilkan itu yang benar.

Katalog di `src/content/plans.ts` tetap jadi sumber kebenaran untuk **teks yang
tampil di website**. Stripe cuma tahu angka. Dua-duanya harus kamu jaga tetap
sama — dan itu memang cara kerja hampir semua produk SaaS.

---

## 4. Bentuk kodenya di project ini

Pasang SDK-nya:

```bash
cd purpspace-webapp
npm install stripe
```

Klien-nya, `src/lib/stripe/server.ts` — pola yang sama dengan
`src/lib/clerk/backend.ts` dan `src/lib/supabase/server.ts` yang sudah ada:

```ts
import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
```

### Kenapa BUKAN Stripe Checkout

Ini jebakan paling mahal di seluruh panduan ini, jadi disebut terpisah:

> **Checkout Session dengan bank transfer hanya mendukung item sekali bayar
> (`mode: 'payment'`), BUKAN item langganan (`mode: 'subscription'`).**

Kalau kamu ikut tutorial Stripe mana pun di internet, kamu akan diarahkan ke
`stripe.checkout.sessions.create({ mode: 'subscription', line_items: [...] })`.
Di akun Indonesia itu akan gagal, atau berhasil tapi tidak menawarkan satu pun
metode pembayaran. Jangan buang waktu di situ.

### Yang benar: langganan berbasis invoice

Alurnya tiga panggilan, dipasang di endpoint baru
`src/app/api/langganan/route.ts` (dipanggil dari layar "selesai" atau dari
halaman akun, **setelah** trial 12 hari berjalan):

```ts
// 1. Customer. Email WAJIB valid — ke sinilah invoice dan nomor VA dikirim.
const customer = await stripe.customers.create({
  email,
  metadata: { clerk_user_id: clerkUserId },   // jembatan balik ke datamu
})

// 2. Kasih dia cash balance khusus bank transfer Indonesia.
//    Ini yang memunculkan nomor Virtual Account.
const funding = await stripe.customers.createFundingInstructions(customer.id, {
  funding_type: "bank_transfer",
  bank_transfer: { type: "id_bank_transfer" },
  currency: "idr",
})

// 3. Subscription — TANPA auto-charge.
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: process.env.STRIPE_PRICE_PRO! }],
  collection_method: "send_invoice",   // BUKAN 'charge_automatically'
  days_until_due: 7,                   // tenggat transfer tiap invoice
  trial_end: Math.floor(trialEndsAt.getTime() / 1000),  // hormati trial 12 hari
  payment_settings: {
    payment_method_types: ["customer_balance"],
  },
})
```

Catatan jujur soal potongan di atas: **`bank_transfer.type` untuk Indonesia
(`id_bank_transfer`) adalah bagian yang paling perlu kamu konfirmasi ulang** di
dokumentasi Stripe saat akunmu sudah aktif. Nilai untuk tiap negara berbeda dan
Indonesia baru. Kalau salah, Stripe akan menolaknya dengan pesan yang jelas —
jadi ini ketahuan di percobaan pertama, bukan diam-diam salah.

`collection_method: 'send_invoice'` itu inti seluruh desain ini. Artinya:
Stripe **tidak akan** mencoba menarik dana. Ia mengirim invoice, lalu menunggu.

---

## 5. Menampilkan nomor Virtual Account

`createFundingInstructions` mengembalikan detail rekening: nama bank, nomor VA,
dan nama penerima. Itu yang harus tampil ke pelanggan — jelas, bisa di-copy, dan
disertai tenggat waktunya.

Tempat yang masuk akal di UI sekarang: layar setelah trial berakhir, atau satu
halaman `/akun` baru. **Jangan** ditaruh di `KonfirmasiStep.tsx` yang sekarang —
langkah itu terjadi sebelum akun jadi, dan trialnya belum mulai.

Nomor VA itu **milik customer, bukan milik invoice**. Nomornya tetap sama tiap
bulan. Itu kabar baik: pelanggan bisa menyimpannya sebagai daftar transfer
tersimpan di m-banking mereka.

---

## 6. Webhook — di sinilah semuanya benar-benar terjadi

**Aturan yang tidak boleh dilanggar:** jangan pernah memberi akses berdasarkan
respons dari `subscriptions.create`. Panggilan itu cuma berarti "invoice sudah
dibuat". Uangnya belum ada. Yang menentukan uang sudah masuk cuma webhook.

`src/app/api/stripe/webhook/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server"
import { stripe } from "@/lib/stripe/server"

export async function POST(request: NextRequest) {
  // Body MENTAH, bukan JSON — tanda tangannya dihitung dari byte aslinya.
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")!

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    // Tanda tangan salah = bukan dari Stripe. Endpoint ini publik; tanpa
    // pengecekan ini siapa pun bisa mengirim "invoice.paid" palsu.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  switch (event.type) {
    case "invoice.paid":
      // Uang masuk. BARU di sini status di Supabase jadi 'active'.
      break
    case "invoice.payment_failed":
      break
    case "customer.subscription.updated":
      // past_due / unpaid / active — sumber kebenaran status.
      break
    case "customer.subscription.deleted":
      break
  }

  // Selalu 200 secepatnya. Kerja berat ditaruh di belakang, kalau tidak
  // Stripe menganggap gagal dan mengirim ulang.
  return NextResponse.json({ received: true })
}
```

Empat event yang wajib ditangani:

| Event | Artinya | Yang kamu lakukan |
|---|---|---|
| `invoice.paid` | transfer masuk & terekonsiliasi | `status = 'active'`, perpanjang periode |
| `invoice.payment_failed` | lewat tenggat / kurang bayar | ingatkan pelanggan |
| `customer.subscription.updated` | status berubah | sinkronkan ke Supabase |
| `customer.subscription.deleted` | berakhir | `status = 'canceled'` |

**Webhook harus idempoten.** Stripe bisa mengirim event yang sama dua kali. Jadi
tulisannya `update ... set status = 'active'`, bukan `insert` baru atau
`period_end = period_end + 1 month`.

### Tes lokal

```bash
stripe login
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Perintah itu mencetak `whsec_…` — itu yang masuk ke `STRIPE_WEBHOOK_SECRET`
untuk **lokal saja**. Secret produksi berbeda, diambil dari
Developers → Webhooks setelah kamu mendaftarkan URL aslinya.

Port 3001, bukan 3000. Port 3000 milik aplikasi desktop.

Memicu event tanpa menunggu transfer sungguhan:

```bash
stripe trigger invoice.paid
```

---

## 7. Migrasi 006 — kolom Stripe

Baru dibuat **di langkah ini**, bukan sekarang. Aturan yang kamu tetapkan sendiri:
tidak ada kolom pajangan. Kolom di bawah ini tidak punya satu pun jalur baca
sampai kode di atas ada.

`supabase/migrations/006_stripe_subscriptions_purpspace.sql`:

```sql
alter table public.subscriptions_purpspace
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end     timestamptz;

create unique index if not exists subscriptions_purpspace_stripe_customer_idx
  on public.subscriptions_purpspace (stripe_customer_id)
  where stripe_customer_id is not null;

notify pgrst, 'reload schema';
```

`stripe_customer_id` **nullable**, dan itu penting: user yang masih di trial 12
hari belum punya customer Stripe sama sekali. Index-nya partial (`where … is not
null`) supaya banyak baris NULL tidak saling bentrok di UNIQUE.

RLS tetap nyala tanpa policy, seperti lima tabel lainnya. Webhook membacanya
lewat service role dari server — tidak ada query dari browser.

Jangan lupa perbarui `src/types/database.ts` di webapp mengikuti kolom baru ini.

---

## 8. Jebakan yang sudah terverifikasi

Semuanya dari dokumentasi Stripe, bukan tebakan. Ini yang akan menggigitmu:

**Kurang bayar / lebih bayar.** Pelanggan transfer Rp49.000 padahal invoice
Rp49.999. Uangnya masuk ke *cash balance*, tapi invoicenya **tidak lunas** dan
statusnya tetap `open`. Nyalakan **Settings → Billing → Invoices → Adjustments
and reconciliation → "Automatically write-off invoices"** supaya selisih receh
tidak membuat langganan macet.

**Urutan pembayaran.** Stripe memakai cash balance untuk melunasi invoice yang
`open` **berurutan dari yang paling lama**. Kalau ada invoice lama yang belum
lunas, transfer bulan ini akan dipakai untuk itu dulu.

**Dana yang tidak terekonsiliasi dikembalikan setelah 75 hari.** Kalau ada uang
masuk yang tidak cocok dengan invoice mana pun dan didiamkan, Stripe
mengembalikannya otomatis. Pantau saldo yang mengambang.

**`past_due` lalu `unpaid`.** Langganan `send_invoice` yang lewat tenggat masuk
`past_due`, dan setelah semua percobaan habis jadi `unpaid` — **bukan**
`canceled`. Kalau kodemu cuma mengecek `=== 'canceled'`, pelanggan yang berhenti
bayar akan tetap dapat akses selamanya.

**Trial berakhir ≠ langganan aktif.** Saat `trial_end` lewat, Stripe menerbitkan
invoice pertama. Uangnya belum masuk. Ada jeda beberapa hari di mana pelanggan
belum bayar tapi juga belum boleh diblokir. Putuskan sikapmu soal jeda ini
sebelum menulis kodenya, bukan sesudah ada keluhan.

**Provisioning digerakkan webhook.** Sudah disebut di atas, diulang karena ini
sumber bug paling umum di integrasi pembayaran.

---

## 9. Checklist sebelum live

- [ ] Aktivasi bisnis Stripe selesai, rekening bank terverifikasi.
- [ ] Semua alur sudah dites di **test mode** sampai tuntas, termasuk kurang
      bayar dan lewat tenggat.
- [ ] Product + Price dibuat ulang di **live mode** (ID-nya berbeda dari test).
- [ ] Env var produksi diisi dengan `sk_live_…` dan `whsec_…` produksi.
- [ ] URL webhook produksi didaftarkan di Developers → Webhooks, HTTPS.
- [ ] Kunci test **tidak** ikut ter-deploy.
- [ ] Webhook sudah idempoten dan sudah dites dikirim dua kali.
- [ ] Halaman Syarat & Ketentuan + Kebijakan Privasi sudah ada isinya — sekarang
      di `AccountStep.tsx` keduanya masih `<span>` tanpa link.
- [ ] Alur pembatalan & refund sudah kamu putuskan dan tertulis.
- [ ] Rate limit di `POST /api/daftar`. Sekarang belum ada, dan endpoint itu
      publik — siapa pun bisa memakainya untuk membuat akun Clerk massal.

**Empat hal yang wajib kamu tanyakan ke Stripe Support** sebelum bergantung
padanya, karena Indonesia fitur-setnya lebih sempit dan dokumentasinya belum
selengkap pasar lain:

1. Apakah `customer_balance` + `id_bank_transfer` benar-benar aktif di akunmu?
2. Bank mana saja yang didukung untuk Virtual Account-nya?
3. Berapa lama dana masuk terekonsiliasi (real-time atau ada jeda)?
4. Berapa biaya per transaksinya untuk IDR?

---

## 10. Urutan kerja yang saya sarankan

1. Daftar akun Stripe, ajukan akses Indonesia kalau diminta. **Menunggu.**
2. Sementara menunggu: jalankan migrasi 005, tes alur trial yang sudah jadi.
3. Begitu akun aktif → test mode → bikin Product & Price → simpan Price ID.
4. `npm install stripe`, tulis `src/lib/stripe/server.ts`.
5. Tulis webhook **duluan**, sebelum endpoint langganan. Pakai `stripe trigger`
   untuk mengetesnya tanpa perlu satu pun pelanggan.
6. Migrasi 006.
7. Endpoint `POST /api/langganan` + tampilan nomor VA.
8. Tes ujung ke ujung di test mode, termasuk semua kasus gagal di bagian 8.
9. Live.

Langkah 5 sengaja mendahului langkah 7. Menulis pengirim sebelum penerima
membuatmu punya kode yang tidak bisa diverifikasi selama berhari-hari.
