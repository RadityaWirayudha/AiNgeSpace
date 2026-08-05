# Handoff 2 — backend `purpspace-webapp`

Frontend website sudah jadi dan sudah dites jalan. Yang dioper di file ini **cuma satu
pekerjaan: backend untuk `purpspace-webapp`.** Belum ada satu file backend pun yang ditulis.

Baca `handoff-web-app.md` lebih dulu — pembagian peran di bagian 1 dan aturan repo di bagian 5
file itu **masih berlaku seluruhnya** dan tidak diulang di sini.

Satu hal yang perlu digarisbawahi dari file itu, karena sekarang statusnya berubah: di pass
frontend, *"database untuk website"* masuk daftar **di luar cakupan**. Pass ini justru itu
isinya. Sisa daftar larangannya tidak berubah.

---

## 1. Permintaan user untuk pass ini (verbatim)

> "Oke sekarang lanjut ke backend. Ingat untuk database supabase jangan sampe ada tabel yang
> hanya pajangan, gua mau tabel yang bener-bener dipake untuk web app nya. Tolong kamu lakukan
> untuk saya respectively. @purpspace-webapp"

Dan sebelumnya, soal database:

> "ingat jangan terlalu boros atau apapun itu, aku mau database bener-bener terpakai, bukan
> hanya pajangan doang."

**Terjemahan operasionalnya:** setiap tabel yang kamu usulkan harus punya jalur baca **dan**
jalur tulis nyata dari `purpspace-webapp`. Tabel yang cuma ditulis sekali lalu tidak pernah
dibaca lagi = pajangan, dan itu yang dilarang. Kalau tidak bisa menunjuk endpoint yang
membacanya, jangan buat tabelnya.

---

## 2. Keputusan user — 2 sudah, 1 masih menggantung

Agent sebelumnya mengajukan tiga pertanyaan. Jawabannya:

**(a) Akun dibuat di mana? → CLERK. Sudah diputuskan.**

User menjawab *"pake clerk"*, lalu menempelkan potongan ini:

```sql
create policy "User can view their own tasks"
on "public"."tasks"
for select
to authenticated
using (((select auth.jwt()->>'sub') = (user_id)::text));
```

Bagian "pake clerk"-nya jelas dan sudah final. Tapi potongan SQL itu **belum jelas
maksudnya** dan **jangan ditebak** — itu pola RLS Supabase third-party auth (Clerk sebagai
penerbit JWT), sedangkan aturan repo yang berlaku sekarang justru RLS nyala dengan **nol
policy** dan semua akses lewat `SUPABASE_SERVICE_ROLE_KEY` dari sisi server. Dua hal itu
bertabrakan. Tambahan lagi, pengunjung website **tidak punya sesi Clerk** di browser
(`purpspace-webapp` tidak punya `ClerkProvider` maupun middleware), jadi policy semacam itu
tidak akan pernah kena di alur `/mulai`.

→ **Tanya user dulu** apa maksud potongan itu sebelum menulis policy apa pun. Jangan menulis
policy, jangan mematikan RLS.

**(b) Pembayaran diproses beneran? → MASIH MENGGANTUNG. Ini yang memblokir.**

Pilihannya: (1) belum diproses — data kartu tidak dikirim ke server sama sekali, tombol
"Mulai free trial" langsung mengaktifkan trial 12 hari; atau (2) pakai payment gateway
beneran. User tidak memilih, dia balik bertanya:

> "Kalau pake Stripe, gratis kan ya?"

Jawab dulu pertanyaan ini sebelum menulis kode langkah pembayaran. Dua hal yang perlu
disampaikan ke user, dan yang **kedua wajib diverifikasi dulu, jangan diklaim mentah**:

1. Stripe tidak menarik biaya bulanan, tapi memotong per transaksi. Jadi "gratis" hanya
   berlaku untuk biaya langganan platformnya, bukan untuk tiap pembayaran yang masuk.
2. Ketersediaan Stripe untuk **badan usaha/rekening Indonesia** perlu dicek ke dokumentasi
   Stripe yang berlaku sekarang — kalau ternyata belum didukung, alternatif yang lazim di
   Indonesia adalah Midtrans, Xendit, atau Doku. Cek dulu, lapor apa adanya, jangan menebak.

Apa pun gateway-nya, dia butuh kredensial merchant dari user dan endpoint webhook yang bisa
dijangkau dari internet — dua-duanya belum ada.

**(c) Isi paket (nama, harga, fitur) disimpan di mana? → TETAP DI KODE. Sudah diputuskan.**

Tetap di `purpspace-webapp/src/content/plans.ts`. Halaman `/harga` tetap statis dan tetap
hidup walau Supabase mati. Database hanya menyimpan **paket mana yang dipilih user**, bukan
katalog paketnya. **Jangan** membuat tabel `plans_purpspace`.

---

## 3. Fakta terverifikasi — jangan diriset ulang

**Alur login app desktop (ini yang membuat jawaban (a) masuk akal).**
`purpspace-electron/src/app/desktop-auth/page.tsx` memakai `clerkClient().signInTokens
.createSignInToken({ userId })`, lalu tiketnya dikirim ke app lewat deep link
`purpspace://auth?ticket=…` (`DesktopAuthHandoff.tsx`) dan ditukar jadi sesi di
`src/features/desktop/DesktopAuthBridge.tsx`. Artinya: **akun yang dibuat website harus akun
Clerk**, kalau tidak, email yang didaftarkan di website tidak akan bisa dipakai login di app
desktop — dan itu satu-satunya gunanya mendaftar.

**Pola akses Supabase yang wajib diikuti** — `purpspace-electron/src/lib/supabase/server.ts`:

```ts
createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
```

Server-side saja, `SUPABASE_SERVICE_ROLE_KEY`. Jangan bikin client anon-key.

**Pola route handler yang wajib diikuti** — `purpspace-electron/src/app/api/workspaces/route.ts`:
skema zod di scope modul → `getAuthUserId()` (`src/lib/clerk/auth.ts`, melempar
`new Error("Unauthorized")`) → `createServerClient()` → query di-scope `.eq("clerk_user_id", …)`
→ blok catch memetakan `z.ZodError` → 400 `{error:"Validation error", details}`,
`"Unauthorized"` → 401, sisanya → 500. Tiru bentuk ini, jangan bikin gaya baru.

**Empat tabel yang sudah ada di database** (semua dipakai app desktop, jangan disentuh):
`workspaces_purpspace`, `panes_purpspace`, `github_connections_purpspace`,
`env_vars_purpspace`. Bentuk kolomnya ada di `purpspace-electron/src/types/database.ts`.
Semua di-scope per user lewat kolom `clerk_user_id text`.

**Migrasi dijalankan manual**, bukan lewat CLI: buka Supabase → SQL Editor → tempel seluruh
file → Run. Lihat catatan di kepala `supabase/migrations/004_workspaces_working_dir.sql`.
File berikutnya bernomor **005**. Pola yang dipakai di repo ini: idempoten (dijaga pengecekan
katalog), tidak menghapus tabel berisi data, dan diakhiri `notify pgrst, 'reload schema';`
karena PostgREST men-cache skema.

**RLS**: menyala dengan nol policy, **disengaja** — kepala `003_rename_to_purpspace.sql`
menulisnya eksplisit: *"jangan 'memperbaikinya' dengan mematikan RLS."* `service_role`
melewati RLS, jadi route handler tetap jalan.

**Nama env var yang sudah ada** (nilainya jangan pernah ditampilkan; ada di
`purpspace-electron/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`,
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`, `ENCRYPTION_KEY`,
`OPENROUTER_API_KEY`.
**`purpspace-webapp` belum punya file `.env` sama sekali.** Yang dia butuhkan cuma
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `CLERK_SECRET_KEY` — proyek
Supabase dan instance Clerk yang **sama** dengan app desktop.

**Dependency `purpspace-webapp` saat ini**: `clsx`, `lucide-react`, `next@16.2.11`,
`react@19.2.4`, `react-dom@19.2.4`, `tailwind-merge`. **Belum ada** Supabase, Clerk, maupun
zod. Versi yang dipakai app desktop, untuk dicocokkan: `@supabase/supabase-js@^2.109.0`,
`@clerk/nextjs@^7.6.0`, `zod@^4.4.3`.

Catatan: website tidak butuh `@clerk/nextjs` lengkap kalau tidak ada sesi Clerk di browser —
`@clerk/backend` (`createClerkClient({ secretKey })`) cukup untuk membuat user dari sisi
server, dan itu menghindari menambahkan middleware auth ke website. Pertimbangkan, jangan
telan mentah.

**Website jalan di port 3001**, app desktop di 3000. Port 3000 sudah terdaftar di luar repo
(callback GitHub OAuth dan `/desktop-auth` di Clerk) — jangan dipindah.

**`AGENTS.md` berlaku**: *"This is NOT the Next.js you know"* — baca
`node_modules/next/dist/docs/` sebelum menulis kode Next 16. Yang sudah dipastikan dari doc
itu: `searchParams` sebuah Promise di Server Component, dan `PageProps<'/rute'>` helper
**global** hasil generate `next dev` / `next build` / `next typegen` — tidak perlu di-import.

---

## 4. Kondisi frontend yang akan disambungkan

Tiga route, semuanya sudah jadi, `tsc --noEmit` bersih, `next build` sukses, dan sudah dites
jalan di `http://localhost:3001`:

- **`/`** — landing page. Statis. Tidak butuh backend.
- **`/harga`** — halaman harga. Statis, baca `src/content/plans.ts`. Tidak butuh backend.
- **`/mulai`** — alur free trial. **Ini satu-satunya yang butuh backend.**

Yang perlu diketahui tentang `/mulai` sebelum menyentuhnya:

`src/components/mulai/TrialFlow.tsx` — `"use client"`, satu route tiga langkah,
`type Step = "akun" | "bayar" | "selesai"`, semuanya `useState`. **Nol request jaringan, nol
penyimpanan** — ini disengaja, user minta frontend dulu.

- `AccountStep.tsx` — Email / Password / Konfirmasi + checkbox S&K. `handleSubmit` cuma
  mencocokkan password lalu `onNext()`.
- `PaymentStep.tsx` — nomor kartu / masa berlaku / CVC / negara / kode pos, semuanya
  `autoComplete="off"`. `handleSubmit` cuma `onNext()`. Tanggal tagihan pertama dihitung di
  klien lewat `firstChargeDate()`.
- `DoneStep.tsx` — konfirmasi + tombol unduh. Teks "free trial 12 hari" dan nama paketnya
  datang dari props klien, **bukan dari database**.
- `src/app/mulai/page.tsx` — Server Component, membaca `?paket=` lewat
  `await props.searchParams` dan membersihkannya lewat `parsePlanId()`.

Konsekuensi yang perlu disadari: **refresh di tengah alur mengembalikan user ke langkah 1**,
karena semua state-nya cuma di memori.

---

## 5. Rancangan yang sudah dibahas — belum disetujui, dan masih memblokir di (b)

Ini hasil pembacaan agent sebelumnya, ditulis di sini supaya tidak diulang dari nol. **Bukan
perintah.** Bagian pembayarannya belum bisa dikerjakan sampai pertanyaan (b) dijawab.

Ide intinya: **satu tabel baru saja**, `subscriptions_purpspace`, dan tabel itu dipakai di
**tiga operasi nyata** — inilah yang membuatnya bukan pajangan:

1. **SELECT saat daftar** — cek apakah email itu sudah punya langganan / sudah pernah pakai
   trial 12 hari-nya. Kalau sudah: tolak dengan pesan yang jelas ("Email ini sudah punya
   langganan PurpSpace. Masuk lewat aplikasi desktopnya.").
2. **INSERT saat checkout** — buat barisnya: paket terpilih, status `trialing`,
   `trial_ends_at`.
3. **SELECT saat `/mulai` dirender** — lewat cookie httpOnly berisi id langganan, supaya
   layar "selesai" menampilkan **tanggal akhir trial yang beneran dari database** (bukan
   hasil hitungan klien seperti sekarang) dan supaya refresh tidak menendang user balik ke
   langkah 1.

Akun sendiri **tidak** disimpan di Supabase — akun tinggal di Clerk (keputusan (a)), dan
Supabase cuma memegang langganannya, di-scope `clerk_user_id` persis seperti empat tabel yang
sudah ada.

Kolom yang dibahas: `id`, `clerk_user_id` (unik), `plan_id` (`'basic' | 'pro'`, dijaga CHECK
— **bukan** foreign key ke tabel katalog, karena katalognya tetap di kode), `status`,
`trial_ends_at`, `current_period_end`, `created_at`, `updated_at` (pakai trigger
`set_updated_at_purpspace()` yang sudah ada).

Titik gelap yang belum dipecahkan dan harus dibereskan sebelum menulis kode: **bagaimana
langkah 2 tahu user mana yang dimaksud**, mengingat website tidak punya sesi Clerk. Dua arah
yang sempat dibahas — (i) buat user Clerk di langkah 1 lalu ikat langkah 1→2 pakai cookie,
atau (ii) jangan buat apa pun sampai langkah 2 lalu kirim semuanya sekali jalan (langkah 1
cuma mengecek ketersediaan email ke Clerk). Arah (ii) lebih sederhana dan tidak meninggalkan
user Clerk yatim kalau checkout ditinggal. **Belum diputuskan.**

---

## 6. Status repo saat handoff ini ditulis

HEAD = `c3e4866` ("feat: implement trial flow with account creation, payment, and plan
selection"). Frontend website sudah di-commit user sendiri.

Belum di-commit:

```
 M purpspace-webapp/src/components/ui/field.tsx
```

Itu perbaikan lint kecil (membuang prop `children?: never` yang memicu
`'children' is defined but never used`). Sudah diverifikasi: eslint 0 masalah, tsc bersih.
**Jangan commit / push kecuali user memintanya.**

Dua dev server kemungkinan **masih menyala** dari sesi sebelumnya: port 3000 (app desktop +
jendela Electron) dan port 3001 (website). Kalau `npm run dev` gagal dengan
`EADDRINUSE :::3001`, itu penyebabnya — cari PID-nya (`netstat -ano | grep :3001`), pastikan
identitasnya, lalu matikan. Jangan asal membunuh proses node.

---

## 7. Batas tegas — jangan ditambah

Selain daftar di `handoff-web-app.md` §7 yang masih berlaku (`/masuk`, FAQ, tabel
perbandingan paket, section "cara kerja", baris logo agen, mock preview di hero, halaman
`/unduh` terpisah), untuk pass ini:

- **Jangan** membuat tabel `plans_purpspace` — keputusan (c) sudah bilang katalog paket tetap
  di kode.
- **Jangan** membuat tabel yang tidak punya jalur baca. Kalau tidak bisa menunjuk endpoint
  yang membacanya, tabelnya tidak boleh ada.
- **Jangan** menulis RLS policy dan **jangan** mematikan RLS sebelum maksud potongan SQL di
  §2(a) dikonfirmasi user.
- **Jangan** menyentuh app desktop. Penegakan batas paket ("maks 3 Grid Terminal") di
  `purpspace-electron` **di luar cakupan** — jangan dikerjakan sambil lewat.
- **Jangan** menjalankan `supabase/migrations/002_rewrite_aingespace_schema.sql`. File itu
  destruktif (men-drop tabel token OAuth terenkripsi) dan tidak boleh dipakai untuk
  memperbaiki schema drift.
- **Jangan** menyimpan nomor kartu, CVC, atau apa pun dari `PaymentStep` ke database. Kalau
  nanti pakai gateway, yang boleh disimpan cuma token/referensi dari gateway-nya.
- **Jangan** menampilkan isi `.env.local`.
- User minta plan dulu sebelum eksekusi. Kata-katanya sendiri: *"Gue kira lu plan mod dulu
  untuk nge-exekusi gitu loh."* Jadi: **rancang, tunjukkan, minta persetujuan, baru tulis
  kode.**

Kalau ragu soal ruang lingkup: tanya user, jangan tebak.
