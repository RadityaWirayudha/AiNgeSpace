# Handoff 3 — backend `purpspace-webapp` sudah jalan, unduhan belum ada

Pass sebelumnya (`handoff-web-app-2.md`) mengoper *"backend untuk `purpspace-webapp`"*.
**Backend itu sudah selesai dan sudah diverifikasi hidup** — akun beneran terbuat di Clerk,
langganan beneran tersimpan di Supabase, refresh tidak lagi membuang progres.

Yang dioper di file ini **satu pekerjaan yang tersisa**: tombol unduh di layar terakhir
masih 404. Tidak ada tugas baru di luar itu.

Baca `handoff-web-app.md` (pembagian peran §1, aturan repo §5) dan `handoff-web-app-2.md`
(fakta terverifikasi §3) lebih dulu — keduanya **masih berlaku seluruhnya** dan tidak
diulang di sini kecuali yang statusnya berubah.

---

## 1. Yang berubah statusnya dari handoff 2

| Di handoff 2 | Sekarang |
|---|---|
| (a) potongan SQL RLS Clerk — *"tanya user dulu"* | **Tidak jadi masalah.** Tidak ada policy yang ditulis, RLS tetap nyala nol policy, semua akses lewat service role dari server. Sudah dibuktikan fungsional (§4). |
| (b) gateway pembayaran — **memblokir** | **Tidak lagi memblokir.** User memilih Stripe, lalu memilih mengerjakan bagian non-Stripe dulu karena kredensialnya belum ada. Alur trial jalan penuh tanpa satu pun kredensial Stripe. |
| (c) katalog paket di kode | Tidak berubah. Tetap di `src/content/plans.ts`. Tabel `plans_purpspace` **tidak** dibuat. |
| *"database untuk website"* di luar cakupan | Sudah dikerjakan. Satu tabel: `subscriptions_purpspace`. |

Temuan yang membentuk keputusan (b), sudah diriset dan jangan diriset ulang: **akun Stripe
Indonesia tidak bisa auto-debit.** Hanya Indonesia Bank Transfer (Virtual Account), hanya
IDR, tanpa kartu, tanpa transaksi lintas negara. Checkout Session dengan bank transfer
**tidak mendukung** item recurring sama sekali. Satu-satunya pola langganan yang didukung
adalah invoice: `collection_method: 'send_invoice'` + `payment_settings.payment_method_types:
['customer_balance']` + `funding_type: 'bank_transfer'`, di mana pelanggan transfer manual
tiap siklus. Konsekuensinya form kartu tidak akan pernah dipakai — itu sebabnya
`PaymentStep.tsx` dihapus.

---

## 2. Yang sudah selesai — sudah di-commit

HEAD = `444459d` ("feat: implement subscription management and trial flow"), didahului
`609f796` (hapus `PaymentStep.tsx`).

**Migrasi `supabase/migrations/005_subscriptions_purpspace.sql`** — satu tabel
`subscriptions_purpspace`: `id` (uuid pk), `clerk_user_id` (text unique), `plan_id`
(CHECK `basic|pro`), `status` (CHECK `trialing|active|past_due|canceled`), `trial_ends_at`,
`created_at`, `updated_at`. RLS nyala, nol policy. Tiap kolom punya jalur baca nyata — tidak
ada pajangan. Kolom Stripe (`stripe_customer_id`, dll.) **sengaja belum dibuat**, baru masuk
di migrasi 006 bareng kodenya.

**Sudah dijalankan user di Supabase SQL Editor dan berhasil.** Catatan: file ini masih
`M` (belum di-commit) karena perbaikan di §3 — versi yang jalan adalah versi di working tree,
bukan versi yang ter-commit.

**Backend baru** (semua di `purpspace-webapp/src/`):

- `lib/supabase/server.ts` — service role, `{ auth: { autoRefreshToken: false, persistSession: false } }`. Tidak ada client anon-key.
- `lib/clerk/backend.ts` — `createClerkClient({ secretKey })`. Pakai `@clerk/backend`, **bukan** `@clerk/nextjs`: website tidak punya sesi Clerk di browser, jadi tidak butuh `ClerkProvider` maupun middleware.
- `types/database.ts` — **hanya** `subscriptions_purpspace`. Empat tabel app desktop sengaja tidak disalin; website tidak menyentuhnya.
- `lib/langganan.ts` — `LanggananView`, nama & umur cookie, `hitungTrialEndsAt()`, `formatTanggal()`.
- `app/api/daftar/route.ts` — satu-satunya endpoint.
- `.env.local` (tidak ter-commit) — `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`.

**Kenapa satu endpoint, bukan dua.** Kalau akun dibuat di langkah 1 lalu user kabur,
tertinggal user Clerk yatim tanpa langganan — dan waktu dia balik, emailnya ditolak "sudah
terdaftar" sehingga dia **tidak akan pernah bisa** dapat trial. Endpoint terpisah untuk "cek
email tersedia" juga sengaja tidak dibuat: itu oracle enumerasi email. Kalau nanti ada yang
mau memecahnya jadi dua, baca dulu alasan ini di komentar kepala `route.ts`.

Urutannya: `createUser` → insert langganan → set cookie httpOnly `ps_langganan` (berisi UUID
langganan) → `201`. Kalau insert gagal, `deleteUser` dipanggil sebagai kompensasi. Error
Clerk dipetakan jadi pesan Indonesia + `field: 'email' | 'password'` supaya form bisa
menaruh pesannya di tempat yang benar.

**Frontend disambungkan:**

- `app/mulai/page.tsx` — baca cookie, SELECT satu baris, kirim `LanggananView` ke `TrialFlow`. Ini yang memperbaiki bug refresh dari handoff 2 §4.
- `TrialFlow.tsx` — `Step` jadi `"akun" | "konfirmasi" | "selesai"`; menahan email/password di state; memanggil `/api/daftar` dari langkah 2.
- `AccountStep.tsx` — mengoper `{ email, password, setuju }`; menerima `serverError`. Teks *"Kartu kredit diperlukan"* diganti jadi **"Free trial 12 hari. Tanpa kartu kredit."** karena hari ini memang tidak ada kartu yang diminta.
- `PaymentStep.tsx` → **`KonfirmasiStep.tsx`** — seluruh field kartu/CVC/negara/kode pos dibuang, `firstChargeDate()` dihapus. Nol data instrumen pembayaran menyentuh server.
- `DoneStep.tsx` — nama paket, status, dan tanggal datang dari database. Bercabang di `status`, itu yang memberi kolom `status` jalur baca nyata.
- `ui/field.tsx` — `SelectField` dihapus; satu-satunya pemakainya adalah dropdown negara di form kartu yang sudah tidak ada.

`trial_ends_at` diformat **di server** (`timeZone: 'Asia/Jakarta'`) lalu dikirim sebagai
string jadi — menghindari mismatch hidrasi dan ketergantungan pada zona waktu browser.

---

## 3. Bug migrasi yang sempat muncul — supaya tidak terulang

Versi pertama 005 gagal di SQL Editor user:

```
ERROR: P0001: fungsi public.set_updated_at_purpspace() tidak ada — jalankan 002 lalu 003 lebih dulu.
```

Databasenya baik-baik saja; guard-nya yang salah. **`to_regproc()` menerima *nama* fungsi;
yang menerima *signature* berkurung adalah `to_regprocedure()`.** Jadi
`to_regproc('public.set_updated_at_purpspace()')` selalu NULL apa pun isi databasenya.

Perbaikannya tidak menebak nama fungsi sama sekali — ia **menemukannya** dari trigger
`*_set_updated_at` yang sudah menempel di empat tabel `_purpspace`, dengan guard kalau
ketemu 0 (raise) atau kalau keempatnya ternyata memakai fungsi berbeda-beda (raise juga),
lalu `execute format(..., fn_oid::regprocedure::text)`. `min(oid)` sengaja dihindari
(ketersediaannya sebagai agregat tidak dipastikan) — diganti dua query terpisah.

---

## 4. Hasil verifikasi — semuanya dijalankan, bukan diasumsikan

`npm run typecheck`, `npm run lint`, `npm run build` di `purpspace-webapp`: **bersih**.
Build output: `/` dan `/harga` statis (○), `/api/daftar` dan `/mulai` dinamis (ƒ).
`npm run typecheck` di `purpspace-electron`: bersih juga.

Alur end-to-end di `localhost:3001`:

| Uji | Hasil |
|---|---|
| Daftar paket Pro | `201`, body `{"planId":"pro","status":"trialing","trialEndsLabel":"18 Agustus 2026"}`, header `set-cookie: ps_langganan=…; HttpOnly; SameSite=lax` |
| Baris Supabase | ada — `plan_id: pro`, `status: trialing`, `trial_ends_at: 2026-08-18T00:03:59+00` |
| Refresh halaman | tetap di langkah 3 dengan tanggal yang sama (**bug handoff 2 §4 beres**) |
| Tanpa cookie | balik ke langkah 1 |
| Email ganda | `409 {"error":"Email ini sudah terdaftar…","field":"email"}`, tidak ada baris kedua |
| Password lemah | `400 {"error":"Password terlalu mudah ditebak…","field":"password"}`, tidak ada user maupun baris terbuat |
| `setuju: false` | `400` — checkbox S&K ditegakkan di server, bukan cuma di HTML |
| `SUPABASE_SERVICE_ROLE_KEY` sengaja dirusak | `500` **dan nol user Clerk tertinggal** — kompensasi `deleteUser` terbukti jalan |
| Trigger `updated_at` | terbukti (`00:03:59` → `00:05:03` setelah UPDATE) |
| RLS | anon key → `[]`; service role → barisnya. Nyala tanpa policy, berfungsi persis seperti maksudnya |

Satu pertanyaan lama ikut tertutup: **user hasil `createUser` langsung berstatus `verified`
di Clerk.** Jadi email yang didaftarkan dari website tidak akan terhalang dinding verifikasi
saat login di app desktop.

**Sisa data uji yang belum dibersihkan** (silakan hapus kapan saja):
user Clerk `uji.purpspace.1785974633@example.com` (password `KopiSusuGula2026!`) + satu baris
`subscriptions_purpspace` miliknya. Instance test, bukan produksi.

---

## 5. Yang BELUM — dan ini satu-satunya tugas yang dioper

User mencoba alurnya sebagai pengguna sungguhan. Sampai langkah 3 semuanya benar, lalu
tombol **"Unduh untuk Windows 10/11"** mengarah ke
`localhost:3001/unduhan/PurpSpace-Setup-x64.exe` → **404, "This page could not be found."**

Kata user:

> "Gua maunya bener-bener nyoba kalau semisal user nantinya itu bisa rasain fungsionalitas
> dari purpspace. Ini ketika gua berhasil buat akun, dan start free trial, file exe
> purpspacenya belum ada/pagenya itu belum ada/pagenya not found."

Penyebabnya sederhana: `src/content/site.ts` menaruh `DOWNLOAD_URL =
"/unduhan/PurpSpace-Setup-x64.exe"` sebagai placeholder, dan belum ada installer yang
diterbitkan ke mana pun. Komentar di kepala file itu sudah menyebutnya.

Fakta yang sudah dikumpulkan supaya penerus tidak menelusuri ulang:

- **Perintah build:** `npm run build:desktop` di `purpspace-electron` = `build:next` (`next build` + `scripts/prepare-standalone.mjs`) → `build:electron` (`tsc -p tsconfig.electron.json`) → `electron-builder --win`.
- **Nama keluarannya sudah benar.** `electron-builder.yml`: `appId: com.purpspace.app`, `productName: PurpSpace`, nsis `artifactName: PurpSpace-Setup-${version}-${arch}.${ext}`. Versi di `package.json` = `0.1.0`, jadi hasilnya `PurpSpace-Setup-0.1.0-x64.exe` — **beda dari `DOWNLOAD_URL` yang sekarang** (`PurpSpace-Setup-x64.exe`, tanpa versi). Salah satunya harus menyesuaikan; jangan asal ganti tanpa memutuskan mana yang jadi konvensi.
- **`.next/standalone` belum ada**, jadi build penuh memang perlu dijalankan. Sisa disk 35 GB — cukup.
- **`purpspace-webapp/public/`** cuma berisi `favicon.png` dan `favicon.svg`. Belum ada folder `unduhan/`.
- **`purpspace-webapp` belum punya `.gitignore` sendiri.** Konvensi repo: ignore per-project ditaruh di project itu (`purpspace-electron/.gitignore` mengurus `/dist`, `/dist-electron`). Installer ~173 MB **tidak boleh** ikut ter-commit.
- **`purpspace-electron/dist/` masih berisi artefak lama bermerek BridgeMind** (29–31 Juli): `BridgeMind-Portable-0.1.0-x64.exe` (173 MB), `BridgeMind-Setup-0.1.0-x64.exe` (**cuma 196 KB — build yang tidak selesai, jangan dikira installer utuh**), `aingespace-0.1.0-x64.nsis.7z`, `win-unpacked/`. User pernah melarang menghapusnya tanpa izin. **Tanya dulu.**

Cara membuktikan tugas ini beres: `curl -I http://localhost:3001/unduhan/<nama-file>` →
`200` dengan `Content-Length` ratusan MB (bukan HTML 404), installernya benar-benar bisa
dipasang, dan setelah dipasang aplikasinya terbuka.

---

## 6. Temuan yang wajib dibaca sebelum menyentuh tugas §5

Ini ditemukan saat menelusuri 404-nya, dan ia mengubah arti "selesai" untuk tugas itu.

`purpspace-electron/electron/env.ts` → `resolveRuntimeEnv()` mencari `.env.local` berurutan
di: `%APPDATA%/PurpSpace/` → `%APPDATA%/BridgeMind/` (warisan) → `.env.local` di repo (hanya
kalau `!app.isPackaged`) → `resources/.env.local`. **Installer sengaja tidak membawa satu pun
rahasia.** Yang mengisi slot pertama adalah `npm run desktop:env`
(`scripts/install-env.mjs`), yang **menyalin `.env.local` repo** — dan file itu berisi
`SUPABASE_SERVICE_ROLE_KEY` serta `CLERK_SECRET_KEY`.

Artinya:

- Di mesin developer, installer hasil build akan jalan — asal `npm run desktop:env` sudah
  pernah dijalankan sekali di mesin itu.
- Untuk **pengguna sungguhan yang mengunduh dari website**, aplikasinya akan terpasang dan
  terbuka, tapi setiap panggilan Supabase/Clerk gagal karena tidak ada kredensial.
- Ini **tidak boleh** "diperbaiki" dengan ikut mengemas service role key ke dalam installer.
  Key itu melewati RLS; membagikannya ke setiap pengunduh sama dengan memberi mereka akses
  baca-tulis penuh ke seluruh database semua user.

Perbaikan yang benar (app desktop memanggil API server dengan sesi Clerk, bukan memegang
service role lokal) adalah pekerjaan tersendiri yang besar. **Disebut di sini sebagai fakta,
bukan sebagai tugas yang ditambahkan.** Kalau §5 dikerjakan apa adanya, laporkan batas ini
ke user apa adanya juga — jangan bilang "unduhan sudah berfungsi" tanpa menyebut bahwa yang
berfungsi baru pemasangannya.

---

## 7. Dokumen Stripe — sudah ada, kodenya belum

`panduan-stripe-purpspace.md` di root (belum di-commit). Sepuluh bagian bahasa Indonesia:
realita akun Indonesia, pendaftaran & aktivasi, test mode & env var, Product/Price, bentuk
kode invoice-based, menampilkan nomor VA, webhook + `stripe listen`, sketsa migrasi 006,
jebakan yang sudah terverifikasi (rekonsiliasi cash balance, `past_due` → `unpaid`, dana
tak terekonsiliasi dikembalikan setelah 75 hari, provisioning harus digerakkan webhook),
dan urutan kerja yang disarankan (webhook duluan, baru endpoint langganan).

**Nol baris kode Stripe ada di repo.** Beberapa hal di panduan itu ditandai eksplisit sebagai
*"buktikan sendiri"* — terutama satuan minor IDR (Rp24.999 → `2499900`?) dan nama tipe
`id_bank_transfer`. Jangan telan mentah.

---

## 8. Batas tegas — jangan ditambah

Selain daftar di `handoff-web-app.md` §7 dan `handoff-web-app-2.md` §7 yang masih berlaku:

- **Jangan menambah tugas.** Kata user, dua kali di pesan yang sama: *"Tolong jangan
  nambah-nambahin tugas."* Yang dioper cuma §5.
- **Plan dulu, baru eksekusi.** *"Gue kira lu plan mod dulu untuk nge-exekusi gitu loh."*
- **Jangan** mematikan RLS dan jangan menulis policy. Kalau query dari browser mengembalikan
  array kosong, pindahkan query-nya ke route handler.
- **Jangan** membuat client Supabase anon-key di website. `src/lib/supabase/client.ts`
  sudah pernah dihapus dan tidak boleh dibuat ulang.
- **Jangan** membuat tabel/kolom tanpa jalur baca. *"jangan sampe ada tabel yang hanya
  pajangan."*
- **Jangan** menyimpan nomor kartu, CVC, atau data instrumen pembayaran apa pun. Hanya
  token/referensi dari gateway.
- **Jangan** menjalankan `002_rewrite_aingespace_schema.sql` — destruktif (men-drop tabel
  token OAuth terenkripsi), dan bukan alat untuk memperbaiki schema drift (itu gunanya 004).
- **Jangan** menampilkan isi `.env.local` mana pun.
- **Jangan** menyentuh app desktop di luar keperluan build §5. Penegakan batas paket
  ("maks 3 Grid Terminal") **di luar cakupan**.
- **Jangan** menghapus isi `purpspace-electron/dist/` tanpa bertanya.
- **Jangan** commit / push kecuali user memintanya.
- **Harga dan isi paket datang dari user, jangan dikarang:**
  Basic Rp24.999 (free 12 hari) — maks 3 Grid Terminal, susunan ter-reset saat app ditutup.
  Pro Rp49.999 — Grid Terminal unlimited, Saved Workspaces & One-Click Restore unlimited,
  PurpCommit + PurpExplorer dalam satu aplikasi.
- **Cara menyebut kedua project** (user mengoreksi ini berkali-kali): foldernya
  `purpspace-webapp`, bukan `purpspace-web`. Jangan bilang satu repo melayani dua peran
  **"sekaligus"** — harus `cd` dulu. Website itu **landing page tempat orang mengunduh app
  desktop PurpSpace**, bukan *"menyajikan aplikasi workspace"* — user menyebut frasa itu
  *"ambigu dan terrible"*.

Kalau ragu soal ruang lingkup: tanya user, jangan tebak.
