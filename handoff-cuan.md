# Handoff: PurpSpace — Lanjutkan dari Sini

Dokumen ini ditulis untuk agent berikutnya. Baca sampai habis sebelum mengerjakan apa pun.

---

## Konteks Singkat

PurpSpace punya dua komponen:

| Komponen | Direktori | Deploy target |
|---|---|---|
| Website (landing page + pendaftaran) | `purpspace-webapp` | Cloudflare Workers |
| Desktop app | `purpspace-electron` | GitHub Releases (.exe installer) |

Auth stack: **Clerk + Supabase** dengan Third-Party Auth (bukan JWT template lama).
Payment: **Midtrans** (bukan Stripe — keputusan sudah final). Model per-periode,
ikutin ngodingpakeai.com.

Root project: `C:\Users\user\2026 3\AiNgeSpace\`

---

## Yang Sudah Selesai

- [x] Clerk ↔ Supabase Third-Party Auth dikonfigurasi (user konfirmasi selesai via
      dashboard.clerk.com/setup/supabase + Supabase third-party auth page)
- [x] `purpspace-electron/src/lib/supabase/server.ts` sudah pakai `accessToken: () => getToken()`
      (pendekatan modern, BUKAN JWT template deprecated)
- [x] Node.js di-upgrade ke v24.19.0 (wrangler butuh v22+)
- [x] Panduan Midtrans ditulis di `panduan-midtrans-purpspace.md`

---

## Yang Belum Selesai — Kerjakan Berurutan

### LANGKAH 1 — Jalankan RLS SQL di Supabase

Buka: https://supabase.com/dashboard/project/ucneqextloynzymzxygi/editor

Paste isi file ini lalu klik **Run**:
```
purpspace-electron/supabase/rls-policies.sql
```

Isinya: 16 policy (4 tabel × 4 operasi). Semuanya pakai pola:
`(select auth.jwt()->>'sub') = clerk_user_id`

Verifikasi setelah run — jalankan query ini di SQL Editor yang sama:
```sql
SELECT tablename, count(*) FROM pg_policies
WHERE tablename IN (
  'workspaces_purpspace','panes_purpspace',
  'env_vars_purpspace','github_connections_purpspace'
)
GROUP BY tablename;
```
Harus ada 4 baris, masing-masing count = 4.

---

### LANGKAH 2 — Test Lokal Desktop App

Buka terminal baru (penting: terminal yang sudah tahu Node v24).

```bash
cd "C:\Users\user\2026 3\AiNgeSpace\purpspace-electron"
npm run dev:desktop
```

Pastikan app bisa:
- Buka halaman login
- Login berhasil (Clerk)
- Data tersimpan ke Supabase (workspace/pane)

Kalau ada error RLS ("permission denied"), berarti Langkah 1 belum benar.

---

### LANGKAH 3 — Deploy Website ke Cloudflare Workers

**Buka terminal baru** (Node v24 harus aktif).

```bash
cd "C:\Users\user\2026 3\AiNgeSpace\purpspace-webapp"
```

**3a. Login Cloudflare:**
```bash
npx wrangler login
```
Akan buka browser — authorize.

**3b. Set secrets (BUKAN di .env, tapi via wrangler):**
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# paste nilainya, Enter

npx wrangler secret put CLERK_SECRET_KEY
# paste nilainya, Enter
```

Nilai-nilai ini ada di `purpspace-webapp/.env.local` — baca file itu untuk ambil
nilainya, tapi JANGAN echo isinya ke terminal/chat.

**3c. Deploy:**
```bash
npm run deploy
```

Perintah ini menjalankan build (`opennextjs-cloudflare build`) lalu upload ke
Cloudflare Workers dengan nama worker `purpspace-webapp` (dari `wrangler.jsonc`).

`NEXT_PUBLIC_*` vars di-bake saat build — mereka sudah ada di `.env.local` dan
akan terbaca otomatis saat `npm run deploy`.

**Verifikasi:** buka URL worker yang dicetak di output terminal, pastikan landing
page muncul dan form pendaftaran berfungsi.

---

### LANGKAH 4 — Build Desktop Installer

```bash
cd "C:\Users\user\2026 3\AiNgeSpace\purpspace-electron"
npm run build:desktop
```

Output: `dist/PurpSpace-Setup-0.1.0-x64.exe` (sekitar 180MB).

---

### LANGKAH 5 — GitHub Release v0.1.0

```bash
cd "C:\Users\user\2026 3\AiNgeSpace\purpspace-electron"
gh release create v0.1.0 \
  "dist/PurpSpace-Setup-0.1.0-x64.exe" \
  --title "PurpSpace v0.1.0" \
  --notes "Rilis perdana PurpSpace Desktop."
```

Kalau `gh` belum login: `gh auth login` dulu.

---

### LANGKAH 6 — Integrasi Midtrans (setelah deploy berjalan)

Panduan lengkap ada di: `panduan-midtrans-purpspace.md`

Urutan kerja dari panduan itu (ringkasan):
1. Daftar akun Midtrans → ambil Sandbox keys
2. Tambah ke `purpspace-webapp/.env.local`:
   ```
   MIDTRANS_SERVER_KEY=SB-Mid-server-...
   NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-...
   ```
3. Jalankan migrasi 006 di Supabase SQL Editor (ada di panduan, belum dibuat sebagai file — agent perlu buat file migrasinya)
4. `npm install midtrans-client` di purpspace-webapp
5. Tulis `src/lib/midtrans/server.ts`
6. Tulis webhook handler dulu: `src/app/api/midtrans/webhook/route.ts`
7. Tulis endpoint bayar: `src/app/api/bayar/route.ts`
8. Daftarkan URL webhook di Midtrans dashboard
9. Set `MIDTRANS_SERVER_KEY` production via `wrangler secret put`

---

## Constraint Penting — Jangan Dilanggar

| Constraint | Kenapa |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` TIDAK BOLEH ada di `purpspace-electron` | Kalau masuk ke installer, semua user bisa bypass RLS |
| `MIDTRANS_SERVER_KEY` TIDAK BOLEH pakai prefix `NEXT_PUBLIC_` | Kalau `NEXT_PUBLIC_`, nilainya ter-bundle ke browser |
| Secrets Cloudflare harus via `wrangler secret put` | `NEXT_PUBLIC_*` bisa di `.env.local`, tapi `SUPABASE_SERVICE_ROLE_KEY` dan `CLERK_SECRET_KEY` harus via wrangler — bukan di file |

---

## File Referensi

| File | Isi |
|---|---|
| `panduan-midtrans-purpspace.md` | Panduan Midtrans lengkap dengan contoh kode |
| `DEPLOY.md` | Panduan deploy Cloudflare lengkap |
| `purpspace-electron/supabase/rls-policies.sql` | SQL yang harus dijalankan di Langkah 1 |
| `purpspace-electron/src/lib/supabase/server.ts` | Server client (sudah benar, jangan diubah) |
| `purpspace-webapp/src/app/api/daftar/route.ts` | Satu-satunya API endpoint website saat ini |
| `purpspace-webapp/wrangler.jsonc` | Konfigurasi Cloudflare Workers |
| `purpspace-webapp/src/content/plans.ts` | Harga & fitur paket Basic/Pro (satu sumber kebenaran) |

---

## Status Singkat

```
Clerk↔Supabase auth  ✅ selesai
RLS policies SQL     ❌ belum dijalankan
Local test           ❌ belum
Cloudflare deploy    ❌ belum (wrangler login belum)
Desktop build        ❌ belum
GitHub Release       ❌ belum
Midtrans kode        ❌ belum (panduan sudah ada)
```
