# handoff-cuan-2.md
# PurpSpace — Lanjutan: Payment Midtrans Live

## Status Deploy
Website **sudah live** di:
```
https://purpspace-webapp.purpspace.workers.dev
```
Deploy terakhir berhasil tanpa error. Build: Next.js 16.2.11 via `@opennextjs/cloudflare`.

---

## Yang Sudah Selesai (Jangan Dikerjakan Ulang)

| # | Item | Status |
|---|------|--------|
| 1 | Deploy ke Cloudflare Workers | ✅ Live |
| 2 | Bug `isProduction` Midtrans (`NODE_ENV` → `MIDTRANS_IS_PRODUCTION`) | ✅ Fixed di `server.ts` + `SnapScript.tsx` |
| 3 | TypeScript type stubs `midtrans-client` | ✅ `src/types/midtrans-client.d.ts` |
| 4 | `public/_headers` komentar invalid dihapus | ✅ Fixed |
| 5 | Database 5 tabel `purpspace_*` | ✅ Sudah jalan via `supabase-setup.sql` |
| 6 | `.env.local` punya `MIDTRANS_IS_PRODUCTION=false` | ✅ |
| 7 | Cloudflare Workers secrets: `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | ✅ Di-set user |

---

## Tugas yang Masih Harus Dikerjakan (Berurutan)

### LANGKAH 1 — Set Wrangler Secret `MIDTRANS_IS_PRODUCTION`
Saat ini `MIDTRANS_IS_PRODUCTION=false` ada di `.env.local` (lokal) tapi **belum** jadi Cloudflare secret.
Tanpa ini, production deploy memakai endpoint Midtrans yang salah.

```bash
cd purpspace-webapp
npx wrangler secret put MIDTRANS_IS_PRODUCTION
# Ketik: false
# Enter
```

Verifikasi:
```bash
npx wrangler secret list
# Harus ada: MIDTRANS_IS_PRODUCTION, MIDTRANS_SERVER_KEY, NEXT_PUBLIC_MIDTRANS_CLIENT_KEY, CLERK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY
```

---

### LANGKAH 2 — Jalankan Migration 006 di Supabase
File sudah ada: `purpspace-webapp/supabase/migrations/006_midtrans_subscriptions_purpspace.sql`

Isinya menambah 2 index penting di tabel `purpspace_subscriptions`:
```sql
CREATE INDEX IF NOT EXISTS purpspace_subscriptions_pending_order_idx
  ON public.purpspace_subscriptions (pending_order_id)
  WHERE pending_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purpspace_subscriptions_midtrans_order_idx
  ON public.purpspace_subscriptions (midtrans_order_id)
  WHERE midtrans_order_id IS NOT NULL;
```

Cara jalankan: **Supabase Dashboard → SQL Editor → paste isi file → Run**

---

### LANGKAH 3 — Daftarkan Webhook Midtrans
URL webhook: `https://purpspace-webapp.purpspace.workers.dev/api/midtrans/webhook`

Cara daftar:
1. Login ke [Midtrans Dashboard Sandbox](https://dashboard.sandbox.midtrans.com)
2. Settings → Configuration
3. **Payment Notification URL** → isi URL di atas
4. Simpan

Webhook ini dipanggil Midtrans setelah pembayaran selesai (settlement). Tanpa ini, status langganan tidak pernah berubah dari `trialing` ke `active` meskipun user sudah bayar.

---

### LANGKAH 4 — Buat GitHub Release v0.1.0 (untuk tombol download)
`DOWNLOAD_URL` di `src/content/site.ts` mengarah ke:
```
https://github.com/RadityaWirayudha/AiNgeSpace/releases/download/v0.1.0/PurpSpace-Setup-0.1.0-x64.exe
```

Kalau release belum dibuat, tombol download di website akan 404.

Cara buat:
```bash
# 1. Build installer dulu (dari purpspace-electron)
cd purpspace-electron
npm run build:desktop
# Output: dist/PurpSpace-Setup-0.1.0-x64.exe (~180 MB)

# 2. Buat GitHub release dan upload
gh release create v0.1.0 \
  "dist/PurpSpace-Setup-0.1.0-x64.exe" \
  --title "PurpSpace v0.1.0" \
  --notes "Rilis perdana PurpSpace untuk Windows 10/11"
```

---

### LANGKAH 5 — Switch ke Production Midtrans (setelah verifikasi akun selesai)
**Jangan dikerjakan sekarang** — Midtrans butuh 2-3 hari verifikasi akun.

Setelah verifikasi selesai:
1. Login Midtrans Dashboard Production (bukan sandbox)
2. Ambil keys: `Mid-server-...` dan client key (tanpa prefix `SB-`)
3. Update Cloudflare secrets:
   ```bash
   npx wrangler secret put MIDTRANS_SERVER_KEY        # isi production server key
   npx wrangler secret put NEXT_PUBLIC_MIDTRANS_CLIENT_KEY  # isi production client key
   npx wrangler secret put MIDTRANS_IS_PRODUCTION     # isi: true
   ```
4. Update `.env.local` juga:
   ```
   MIDTRANS_SERVER_KEY=Mid-server-...
   NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=Mid-client-...
   MIDTRANS_IS_PRODUCTION=true
   ```
5. Deploy ulang: `npm run deploy`

---

## Konteks Teknis Penting

### Arsitektur Auth
- **Clerk** untuk auth user (JWT)
- **Supabase** untuk database dengan RLS
- Pattern RLS: `(select auth.jwt()->>'sub') = clerk_user_id`
- Ini **native Supabase Third-Party Auth** (post-April 2025), BUKAN JWT template lama

### Kenapa `MIDTRANS_IS_PRODUCTION` Bukan `NODE_ENV`
Cloudflare Workers **selalu** set `NODE_ENV="production"` di runtime.
Kalau pakai `NODE_ENV === "production"` → endpoint Production Midtrans + Sandbox keys → semua transaksi gagal diam-diam.
Solusi: env var dedicated `MIDTRANS_IS_PRODUCTION` yang dikontrol manual.

### File Kunci yang Sudah Dimodifikasi
```
purpspace-webapp/
├── src/lib/midtrans/server.ts          ← isProduction pakai MIDTRANS_IS_PRODUCTION
├── src/components/SnapScript.tsx       ← snapUrl pakai MIDTRANS_IS_PRODUCTION
├── src/types/midtrans-client.d.ts      ← type stubs manual (tidak ada @types)
└── public/_headers                     ← hanya 2 baris, tanpa komentar

supabase-setup.sql                      ← setup DB lengkap (sudah dijalankan)
```

### Flow Payment Midtrans Snap
1. User klik "Upgrade" → `/api/bayar` → `snap.createTransaction()` → dapat `token`
2. Browser load `snap.js` dari `SnapScript` → `window.snap.pay(token)`
3. User selesai bayar → Midtrans kirim POST ke `/api/midtrans/webhook`
4. Webhook update `purpspace_subscriptions`: `status='active'`, `midtrans_order_id`, `current_period_end`

### Urutan Environment Variables yang Dibutuhkan
```
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY   → browser (Snap.js data-client-key)
MIDTRANS_SERVER_KEY               → server only (JANGAN prefix NEXT_PUBLIC_!)
MIDTRANS_IS_PRODUCTION            → server (false=sandbox, true=production)
CLERK_SECRET_KEY                  → server
SUPABASE_SERVICE_ROLE_KEY         → server
NEXT_PUBLIC_SUPABASE_URL          → browser
NEXT_PUBLIC_SUPABASE_ANON_KEY     → browser
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY → browser
```

---

## Batas yang Tetap Berlaku
- RLS tetap nyala, tidak boleh dimatikan
- `SUPABASE_SERVICE_ROLE_KEY` hanya boleh di server, tidak boleh `NEXT_PUBLIC_`
- Tidak commit/push kecuali diminta
- Tidak jalankan `002_rewrite_aingespace_schema.sql`
- Tidak tampilkan isi `.env.local`
