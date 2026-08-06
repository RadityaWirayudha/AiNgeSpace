# Handoff: Siap-Siap Deploy PurpSpace

> **Untuk agent berikutnya:** Lanjutkan dari sini. Semua kode sudah selesai. Satu blocker teknis perlu diselesaikan sebelum deploy bisa jalan.

---

## Konteks Singkat

PurpSpace = aplikasi desktop (Electron + Next.js internal server) + landing page/registration (Next.js, deploy ke Cloudflare Workers).

**Masalah awal yang sudah diselesaikan:** Desktop app hanya jalan di mesin dev karena menggunakan `SUPABASE_SERVICE_ROLE_KEY` yang ada di `.env.local` lokal. Solusinya: migrasi ke JWT-based auth (Clerk JWT → Supabase dengan RLS). Semua kode migrasi sudah selesai dan typecheck passed.

---

## Repo Structure

```
AiNgeSpace/
├── purpspace-electron/          # Desktop app
│   ├── src/lib/supabase/server.ts   ← kode auth utama (sudah diubah)
│   ├── src/app/api/             ← 8 route files (sudah diubah)
│   ├── supabase/rls-policies.sql    ← SQL yang perlu dijalankan di Supabase
│   └── SETUP-INSTRUCTIONS.md        ← instruksi konfigurasi dashboard
├── purpspace-webapp/            # Landing page + registration
│   ├── wrangler.jsonc           ← Cloudflare Workers config (sudah ada)
│   ├── open-next.config.ts      ← OpenNext adapter config (sudah ada)
│   ├── src/content/site.ts      ← DOWNLOAD_URL sudah GitHub Releases
│   └── scripts/sync-unduhan.mjs ← helper untuk local testing
├── DEPLOY.md                    ← panduan deploy lengkap (baru dibuat)
└── handoff-siap-siap-deploy.md  ← file ini
```

---

## Yang Sudah Selesai (Kode, Tidak Perlu Disentuh)

### purpspace-electron
- `src/lib/supabase/server.ts` — `createAuthedClient()` berbasis JWT, bukan service-role key
- 8 API route files — semua pakai `createAuthedClient()` 
- `supabase/rls-policies.sql` — 16 RLS policies untuk 4 tabel
- `SETUP-INSTRUCTIONS.md` — ada, tapi perlu dicek ulang (lihat blocker di bawah)

### purpspace-webapp
- `wrangler.jsonc`, `open-next.config.ts`, `public/_headers` — Cloudflare Workers setup
- `next.config.ts` — `initOpenNextCloudflareForDev()` sudah ada
- `src/content/site.ts` — `DOWNLOAD_URL` sudah `https://github.com/RadityaWirayudha/AiNgeSpace/releases/download/v0.1.0/PurpSpace-Setup-0.1.0-x64.exe`
- `.gitignore` — `/.open-next/` dan `/public/unduhan/` sudah di-ignore
- Tombol download di `page.tsx` dan `DoneStep.tsx` sudah punya atribut `download`

---

## ⚠️ BLOCKER: Konfigurasi Supabase ↔ Clerk

### Masalah

`createAuthedClient()` mengirim Clerk JWT ke Supabase via header `Authorization: Bearer <token>`. Supabase perlu bisa **memverifikasi** JWT ini agar RLS policies (`auth.jwt()->>'sub'`) bisa berjalan.

Kode saat ini menggunakan `getToken()` tanpa template — ini mengasumsikan Supabase dikonfigurasi dengan "Native Third-party Auth" yang memverifikasi via Clerk JWKS endpoint.

**Tapi fitur "Third-party Auth" tidak ditemukan di sidebar Supabase Dashboard** (sudah dicek di `supabase.com/dashboard/project/ucneqextloynzymzxygi/auth/`).

### Solusi A — JWT Template (DIREKOMENDASIKAN, tidak butuh fitur UI yang hilang)

**Step 1: Dapatkan Supabase JWT Secret**
```
Supabase Dashboard → Project Settings → Data API → JWT Secret → Copy
```
(Project ID: `ucneqextloynzymzxygi`)

**Step 2: Buat JWT Template di Clerk**
```
Clerk Dashboard → Configure → JWT Templates → + New template
  Name: supabase
  Signing algorithm: HS256
  Signing key: (paste JWT Secret dari Step 1)
  Claims:
    {
      "role": "authenticated"
    }
  (claim "sub" otomatis diisi Clerk user ID — tidak perlu ditambah)
→ Save
```

**Step 3: Update satu baris kode**

File: `purpspace-electron/src/lib/supabase/server.ts`, baris 37:
```ts
// SEKARANG:
const token = await getToken()

// GANTI JADI:
const token = await getToken({ template: 'supabase' })
```
Update juga komentar di atas baris itu agar sesuai (opsional tapi bagus).

**Step 4: Jalankan RLS SQL**
```
Supabase Dashboard → SQL Editor → New query
→ Copy-paste isi file: purpspace-electron/supabase/rls-policies.sql
→ Run
```

**Step 5: Hapus service role key dari .env.local desktop**

File: `%APPDATA%\PurpSpace\.env.local`  
Hapus atau comment-out baris:
```
SUPABASE_SERVICE_ROLE_KEY=...
```

---

### Solusi B — Native OIDC (jika Third-party Auth UI tersedia)

Coba buka URL ini langsung:
```
https://supabase.com/dashboard/project/ucneqextloynzymzxygi/auth/third-party-auth
```

Jika halaman terbuka (bukan 404):
1. Add provider → Clerk
2. Domain: domain Clerk project ini
3. Save
4. **Tidak perlu ubah kode apapun** — `getToken()` tanpa template sudah benar
5. Tetap jalankan RLS SQL (Step 4 di Solusi A)

Jika URL 404, pakai Solusi A.

---

## Langkah Deploy (Setelah Blocker Resolved)

### 1. Test Lokal Dulu
```bash
cd purpspace-electron
npm run dev
# Buka app → sign in → buat workspace → restart → pastikan workspace masih ada
# Test dengan akun kedua → pastikan tidak bisa lihat workspace akun pertama
```

### 2. Build Installer
```bash
cd purpspace-electron
npm run build:desktop
# Output: dist/PurpSpace-Setup-0.1.0-x64.exe (~180 MB)
# Kalau hasilnya < 50 MB, build terputus — ulangi
```

### 3. Buat GitHub Release
```
https://github.com/RadityaWirayudha/AiNgeSpace/releases/new
  Tag: v0.1.0
  Title: PurpSpace v0.1.0 — First Public Release
  Upload: dist/PurpSpace-Setup-0.1.0-x64.exe
→ Publish release
```

Verifikasi URL unduhan bekerja:
```
https://github.com/RadityaWirayudha/AiNgeSpace/releases/download/v0.1.0/PurpSpace-Setup-0.1.0-x64.exe
```

### 4. Deploy Website ke Cloudflare Workers
```bash
cd purpspace-webapp

# Login Cloudflare (buka browser sekali)
npx wrangler login

# Set secrets (paste value dari .env.local)
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL

# PENTING: NEXT_PUBLIC_ vars harus ada di .env.local SEBELUM build
# karena Next.js bake-in nilai mereka saat next build
# Pastikan .env.local purpspace-webapp punya:
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
#   NEXT_PUBLIC_SUPABASE_URL=https://ucneqextloynzymzxygi.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Deploy
npm run deploy
```

### 5. Smoke Test Setelah Deploy
- [ ] Website loading di URL Cloudflare Workers
- [ ] Tombol "Unduh" → GitHub Releases (bukan 404)
- [ ] Daftar akun baru → wizard `/mulai` selesai → tombol download muncul
- [ ] Install dari installer → launch app → sign in berhasil
- [ ] Buat workspace → restart app → workspace masih ada

---

## Catatan Penting

**`NEXT_PUBLIC_` vars dan Cloudflare Workers:**  
Next.js mengganti `process.env.NEXT_PUBLIC_*` saat `next build`, bukan saat runtime. Jadi nilai-nilai ini **harus ada di `.env.local` (atau `.env.production`) sebelum `npm run deploy` dijalankan**. Menetapkan mereka via `wrangler secret put` setelah build tidak akan berpengaruh untuk vars ini.

**Supabase project:**  
- Dashboard: `https://supabase.com/dashboard/project/ucneqextloynzymzxygi`
- Project ID: `ucneqextloynzymzxygi`

**Clerk project:**  
- Cari di Clerk Dashboard sesuai akun `RadityaWirayudha`

**Panduan lengkap deploy ada di:** `AiNgeSpace/DEPLOY.md`

---

## Urutan Prioritas

```
[BLOCKER] Pilih Solusi A atau B → update kode (jika A) → jalankan RLS SQL
    ↓
Test lokal (buat workspace, restart, cek masih ada)
    ↓
Build installer
    ↓
Buat GitHub Release + upload
    ↓
Deploy website ke Cloudflare
    ↓
Smoke test E2E
    ↓
DONE ✅
```
