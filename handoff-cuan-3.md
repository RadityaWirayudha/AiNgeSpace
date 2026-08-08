# handoff-cuan-3.md
# PurpSpace — Lanjutan: Midtrans Production + Domain Rename

## Status Deploy
Website **sudah live** di:
```
https://purpspace-webapp.purpspace.workers.dev
```
Deploy terakhir berhasil (Version ID: `8b1e9fc6-5e3b-4785-ae2c-b569d6d5148e`).

---

## Semua yang Sudah Selesai (Jangan Dikerjakan Ulang)

| # | Item | Status |
|---|------|--------|
| 1 | Deploy ke Cloudflare Workers | ✅ Live |
| 2 | Bug `isProduction` Midtrans (`NODE_ENV` → `MIDTRANS_IS_PRODUCTION`) | ✅ Fixed |
| 3 | TypeScript type stubs `midtrans-client` | ✅ |
| 4 | `public/_headers` komentar invalid dihapus | ✅ |
| 5 | Database 5 tabel `purpspace_*` + Migration 006 | ✅ |
| 6 | Halaman `/syarat-ketentuan` (T&C + Refund Policy) | ✅ |
| 7 | Footer: link Syarat & Ketentuan + Kontak | ✅ |
| 8 | `CONTACT_EMAIL = "purpspaceai@gmail.com"` di `site.ts` | ✅ |
| 9 | `WEBSITE_URL = "https://app.purpspace.workers.dev"` di `site.ts` | ✅ |
| 10 | Cloudflare secret `MIDTRANS_IS_PRODUCTION=false` | ✅ |
| 11 | Cloudflare secrets: `MIDTRANS_SERVER_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY` | ✅ |
| 12 | GitHub Release v0.1.0 + installer `.exe` | ✅ https://github.com/RadityaWirayudha/AiNgeSpace/releases/tag/v0.1.0 |
| 13 | Webhook Midtrans Sandbox terdaftar | ✅ `…/api/midtrans/webhook` |
| 14 | Registrasi akun Midtrans Production | ✅ Submit — menunggu verifikasi 2-3 hari |
| 15 | 5 kriteria website Midtrans | ✅ Semua terpenuhi |
| 16 | `wrangler.jsonc`: `"name": "app"`, `"service": "app"` | ✅ Sudah diubah |
| 17 | `syarat-ketentuan/page.tsx`: import + URL pakai `WEBSITE_URL` | ✅ Sudah diubah |

---

## Tugas yang Masih Harus Dikerjakan (Berurutan)

### LANGKAH 1 — Buat Redirect Worker (Jangan Skip)

Buat dua file baru di `purpspace-webapp/redirect-worker/`:

**`purpspace-webapp/redirect-worker/worker.js`**
```js
export default {
  async fetch(request) {
    const url = new URL(request.url)
    url.hostname = "app.purpspace.workers.dev"
    return Response.redirect(url.toString(), 301)
  },
}
```

**`purpspace-webapp/redirect-worker/wrangler.jsonc`**
```jsonc
{
  "$schema": "../node_modules/wrangler/config-schema.json",
  "name": "purpspace-webapp",
  "main": "worker.js",
  "compatibility_date": "2025-01-01"
}
```

---

### LANGKAH 2 — Deploy Main App (Nama Baru: `app`)

```bash
cd purpspace-webapp
npm run deploy
```

Setelah berhasil, worker baru bernama `app` akan live di:
```
https://app.purpspace.workers.dev
```

> ⚠️ Kalau timeout: retry sampai berhasil. Koneksi kadang putus saat upload assets besar.

---

### LANGKAH 3 — Deploy Redirect Worker

```bash
cd purpspace-webapp
npx wrangler deploy --config redirect-worker/wrangler.jsonc
```

Setelah ini, siapa pun yang buka `purpspace-webapp.purpspace.workers.dev` otomatis di-redirect ke `app.purpspace.workers.dev`.

---

### LANGKAH 4 — Update Webhook Midtrans Sandbox

- Buka https://dashboard.sandbox.midtrans.com/settings/config_info
- **Payment Notification URL:**
  ```
  https://app.purpspace.workers.dev/api/midtrans/webhook
  ```
- **Finish URL:**
  ```
  https://app.purpspace.workers.dev/mulai
  ```
- Simpan

---

### LANGKAH 5 — Switch ke Production Midtrans (Setelah Email Verifikasi Masuk)

**Tunggu 2-3 hari kerja.** Midtrans akan kirim email konfirmasi ke email akun.

Setelah email masuk:

**5a. Ambil Production Keys:**
- Login ke https://dashboard.midtrans.com (Production, bukan sandbox)
- Settings → Access Keys
- Salin **Server Key** (`Mid-server-XXXX`) dan **Client Key** (`Mid-client-XXXX`)

**5b. Update Cloudflare secrets (jalankan satu per satu):**
```bash
cd purpspace-webapp
echo "Mid-server-XXXX" | npx wrangler secret put MIDTRANS_SERVER_KEY
echo "Mid-client-XXXX" | npx wrangler secret put NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
echo "true" | npx wrangler secret put MIDTRANS_IS_PRODUCTION
```

**5c. Update `.env.local`:**
```
MIDTRANS_SERVER_KEY=Mid-server-XXXX
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=Mid-client-XXXX
MIDTRANS_IS_PRODUCTION=true
```

**5d. Deploy ulang:**
```bash
npm run deploy
```

**5e. Daftarkan webhook di Production:**
- Login https://dashboard.midtrans.com
- Buka https://dashboard.midtrans.com/settings/config_info
- **Payment Notification URL:**
  ```
  https://app.purpspace.workers.dev/api/midtrans/webhook
  ```
- **Finish URL:**
  ```
  https://app.purpspace.workers.dev/mulai
  ```
- Simpan

Setelah ini, **user bisa bayar dengan uang nyata** dan settlement masuk ke rekening bank.

---

### LANGKAH 6 — Custom Domain (Opsional tapi Direkomendasikan)
URL saat ini: `app.purpspace.workers.dev` — sudah lebih bersih, tapi masih pakai subdomain workers.dev.

Untuk URL yang lebih clean, beli custom domain:
- `purpspace.id` — ~Rp200k/tahun di Niagahoster atau Domainesia
- `purpspace.app` — ~$14/tahun di Cloudflare Registrar

Cara setup setelah beli domain:
1. Tambahkan domain ke Cloudflare (Dashboard → Add a Site)
2. Di Cloudflare dashboard: Workers & Pages → `app` → Custom Domains → Add
3. Masukkan domain baru
4. Update Midtrans webhook URL ke domain baru
5. Update `WEBSITE_URL` di `purpspace-webapp/src/content/site.ts`

---

## Konfigurasi Cloudflare Secrets (Lengkap)

```
CLERK_SECRET_KEY                ✅ di-set
MIDTRANS_IS_PRODUCTION          ✅ false (ubah ke true setelah Production — Langkah 5)
MIDTRANS_SERVER_KEY             ✅ Sandbox key (ubah ke Production key — Langkah 5)
SUPABASE_SERVICE_ROLE_KEY       ✅ di-set
```

`NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` — TIDAK perlu jadi Cloudflare secret karena `NEXT_PUBLIC_` di-bake ke bundle saat `npm run build`. Cukup di `.env.local`.

---

## Konteks Teknis Penting

### Arsitektur Auth
- **Clerk** untuk auth user (JWT)
- **Supabase** untuk database dengan RLS
- Pattern RLS: `(select auth.jwt()->>'sub') = clerk_user_id`
- Native Supabase Third-Party Auth (post-April 2025), BUKAN JWT template lama

### Kenapa `MIDTRANS_IS_PRODUCTION` bukan `NODE_ENV`
Cloudflare Workers **selalu** set `NODE_ENV="production"` di runtime.
`process.env.NODE_ENV === "production"` → selalu true → Sandbox keys + Production endpoint → semua transaksi gagal diam-diam.
Solusi: `process.env.MIDTRANS_IS_PRODUCTION === "true"` di `server.ts` dan `SnapScript.tsx`.

### Kenapa worker tidak bisa bernama `purpspace`
`purpspace.workers.dev` adalah account subdomain root Cloudflare, bukan slot worker. Worker selalu di `<nama>.<account>.workers.dev`. Makanya di-rename ke `app` → `app.purpspace.workers.dev`.

### File Kunci
```
purpspace-webapp/
├── wrangler.jsonc                          ← name: "app" (sudah diubah)
├── redirect-worker/                        ← BELUM DIBUAT (Langkah 1)
│   ├── worker.js
│   └── wrangler.jsonc
├── src/lib/midtrans/server.ts             ← isProduction pakai MIDTRANS_IS_PRODUCTION
├── src/components/SnapScript.tsx          ← snapUrl pakai MIDTRANS_IS_PRODUCTION
├── src/types/midtrans-client.d.ts         ← type stubs manual (tidak ada @types)
├── src/app/syarat-ketentuan/page.tsx      ← T&C + Refund Policy (pakai WEBSITE_URL)
├── src/components/site/SiteFooter.tsx     ← link T&C + email kontak
└── src/content/site.ts                    ← WEBSITE_URL + CONTACT_EMAIL (sudah benar)

supabase-setup.sql                         ← setup DB lengkap (sudah dijalankan)
purpspace-webapp/supabase/migrations/006_midtrans_subscriptions_purpspace.sql  ← sudah dijalankan
```

### Flow Payment Midtrans Snap
1. User klik "Upgrade" → `/api/bayar` → `snap.createTransaction()` → dapat `token`
2. Browser load `snap.js` dari `SnapScript` → `window.snap.pay(token)`
3. User selesai bayar → Midtrans kirim POST ke `/api/midtrans/webhook`
4. Webhook update `purpspace_subscriptions`: `status='active'`, `midtrans_order_id`, `current_period_end`

### Database Columns Midtrans (sudah ada via Migration 006)
```sql
-- tabel: public.purpspace_subscriptions
midtrans_order_id  TEXT  -- order_id yang LUNAS (idempotency key webhook)
pending_order_id   TEXT  -- order_id yang sedang menunggu pembayaran
current_period_end TIMESTAMPTZ  -- kapan periode berakhir
```

---

## Batas yang Tetap Berlaku
- RLS tetap nyala, tidak boleh dimatikan
- `SUPABASE_SERVICE_ROLE_KEY` hanya boleh di server, tidak boleh `NEXT_PUBLIC_`
- Tidak commit/push kecuali diminta
- Tidak jalankan `002_rewrite_aingespace_schema.sql`
- Tidak tampilkan isi `.env.local`
