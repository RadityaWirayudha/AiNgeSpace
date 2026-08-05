# Handoff — `purpspace-electron` + `purpspace-webapp`

File ini dioper dari agent sebelumnya. Pekerjaannya **belum dimulai sama sekali**: tidak ada
satu file pun yang dipindah atau dibuat. Yang ada di sini cuma permintaan user, hasil
pembacaan repo yang sudah terverifikasi, dan batas-batasnya.

Agent sebelumnya berulang kali salah menangkap maksud user. Karena itu **baca bagian 1
sampai selesai sebelum menyentuh apa pun**, dan jangan menambah tugas di luar yang tertulis
di bagian 2.

---

## 1. Pembagian peran — ini yang paling sering disalahpahami

Dua folder, dua peran yang benar-benar terpisah. Bukan satu app dengan dua mode, bukan dua
app yang menyala bersamaan.

**`purpspace-electron` — aplikasi desktop.**
Semua fungsionalitas ada di sini. Ini dashboardnya: grid terminal, agen, workspace,
PurpCommit, PurpExplorer. Tempat kerja beneran — tempat user menjalankan tugas dan
menyelesaikan masalah. Dijalankan dengan `npm run dev:desktop`.

**`purpspace-webapp` — website. Titik.**
Nol fungsionalitas produk. Isinya cuma pengenalan: "PurpSpace itu buat apa sih?",
"pricing-nya gimana sih?", form daftar, dan tempat **download aplikasi desktop PurpSpace**.
Dijalankan dengan `npm run dev`, dibuka di browser.

Kata-kata user sendiri:

> "Kalau yang buat desktop app, yang Electron, itu buat fungsionalitas. Jadi, kayak
> dashboard-nya gitu loh. Ketika menjalankan suatu tugas, suatu yang bisa menyelesaikan
> suatu masalah itu dari desktop app-nya. Kalau website app-nya itu cuman pengenalan, 'Wah,
> PurpSpace itu buat apa sih? Pricing-nya gimana sih?' Segala macem."

> "`npm run dev` itu untuk membuka aplikasi yang nanti berisi pricing, eh landing page
> terkait dengan PurpSpace. Itu ngapa-ngapain, dan slogan-slogan yang lu bisa atur sesuai
> referensi image yang gua kirim … Itu buat website aplikasinya. Tok, buat website."

Struktur foldernya:

folder `aingespace`, isinya:
1. folder `purpspace-electron`
2. folder `purpspace-webapp`

---

## 2. Permintaan user (verbatim)

Permintaan awal:

> "Oke ini core featurenya sudah mantep banget. Sekarang aku mau kamu ngerapihin folder dari
> aingespace ini (Namanya codebase ya? Idk). Jadi aku mau dalam folder "aingespace" ini, itu
> ada folder dengan nama, "purpspace-electron" dan "purpspace-web". Jadi "purpspace-electron"
> khusus buat npm run dev desktop itu, sedangkan yang "purpspace-web" itu untuk landing page
> berbasis website (npm run dev) (atau apapun itu) dengan referensi seperti gambar yang aku
> kirimin ke kamu (image #7 = ketika mengklik pricing) (image #3 - #6 = ketika klik start
> free trial) (itu hanya referensi, jangan full ketiplak dengan hal tersebut), warna on theme
> harus sama seperti yang ada di electron desktop app. Untuk "purpspace-web" tolong buatkan
> frontendnya terlebih dahulu agar cepat kamu buatnya dan aku bisa test dengan cepat juga.
> Oke tolong kamu tinjau secara complete in-depth untuk saya respectively."

Isi paket harga (dijawab langsung oleh user, jangan dikarang ulang):

> "Basic (Rp24.999) (Free 12 hari):
> - max 3 Grid Terminals.
> - kalau app ditutup, susunan terminal & directory ter-reset.
>
> Pro (Rp49.999):
> - unlimited Grid Terminals,
> - Unlimited Saved Workspaces & One-Click Restore. Sekali klik, langsung auto-launch
>   terminal lengkap dengan command bawaan (npm run dev, docker-compose, dll),
> - PurpCommit github with message with AI, PurpExplorer in one application
>
> Bahasa Indo."

Tiga koreksi yang user berikan ke agent sebelumnya — semuanya masih berlaku:

1. **Nama foldernya `purpspace-webapp`**, bukan `purpspace-web`.
   > "Pokoknya foldernya itu bentukannya kaya gini: aingespace ├── purpspace-electron
   > └── purpspace-webapp"
2. Jangan bilang satu repo dipakai dua peran **"sekaligus"** — itu terdengar seolah satu
   perintah membuka keduanya, padahal harus `cd` ke folder yang dituju dulu.
3. Jangan menyebut website itu "menyajikan aplikasi workspace" atau istilah berbelit
   sejenisnya. Website ya website: landing page, tempat orang kenalan dan bisa download
   desktop app-nya.

Jadi yang diminta hanya ini: **landing page, pricing, alur daftar → pilih paket → checkout,
dan bisa download desktop app.** Semua teks **bahasa Indonesia**. **Frontend dulu** supaya
cepat jadi dan cepat dites.

---

## 3. Referensi visual

- image **#7** = tampilan ketika mengklik **pricing**
- image **#3 – #6** = alur ketika mengklik **start free trial**

Gambar-gambarnya ada di user, **tidak ada di repo** — minta dulu ke user sebelum mulai
menggambar halamannya. User sudah menegaskan: *"itu hanya referensi, jangan full ketiplak
dengan hal tersebut"*. Slogannya boleh kamu susun sendiri mengikuti gaya di gambar itu.

Warnanya **wajib sama** dengan desktop app.

---

## 4. Fakta teknis yang sudah diverifikasi (jangan diriset ulang)

- Versi yang dipakai app desktop: `next@16.2.11`, `react@19.2.4`, `react-dom@19.2.4`,
  Tailwind v4 (`@theme inline` di `src/app/globals.css`), `lucide-react`.
- **Sumber kebenaran warna adalah `src/app/globals.css`**, bukan `referensi.md`. Tabel warna
  di `referensi.md` sudah basi — di sana aksen aktif masih oranye `#E0813C`, padahal
  implementasinya sudah ungu (`--color-purple #9333ea`, `--color-bm-bg #0e0e10`,
  `--color-bm-pane #161618`, `--color-bm-border #2a2a2e`, `--color-bm-text #e8e8ea`,
  `--radius 0.25rem`).
- Semua script build/dev menghitung root dari lokasi filenya sendiri
  (`resolve(dirname(fileURLToPath(import.meta.url)), "..")` di `scripts/dev-desktop.mjs:10`,
  `scripts/install-env.mjs:12`, `scripts/prepare-standalone.mjs:11`), jadi memindahkan
  seluruh isi proyek turun satu level **tidak butuh edit path**.
- `electron-builder.yml` menyaring `node_modules/node-pty/**` relatif terhadap package dir
  dan `asarUnpack` bergantung pada itu → **jangan pakai npm workspaces**; hoisting akan
  menerbitkan installer tanpa binari PTY, dan baru ketahuan setelah `build:desktop`.
- Port **3000 sudah terdaftar di luar repo**: callback GitHub OAuth
  (`src/app/api/github/route.ts:5` → `http://localhost:3000/api/github/callback`) dan alur
  sign-in desktop `http://localhost:3000/desktop-auth` di Clerk. Memindahkan desktop ke port
  lain berarti user harus mengubah setelan di dua layanan itu. Selain itu
  `scripts/dev-desktop.mjs:53` sengaja me-*reuse* server apa pun yang sudah menyala di 3000.
- Pola `.gitignore` sekarang di-anchor ke root (`/node_modules`, `/.next/`, `/dist`,
  `/build/*`, `!/build/icon.png`) sehingga berhenti bekerja begitu isinya turun satu level.
  Pengecualian `!build/icon.png` wajib ikut — tanpa itu clone baru gagal `build:desktop`.
- File yang ada di root sekarang dan bukan milik app desktop: `.git/`, `AGENTS.md`,
  `CLAUDE.md`, `README.md`, `referensi.md`, semua file `*handoff*.md`, `v1.md`,
  `Supabase_clerk_electron_knowledge.md`, `supabase/`, `logo/`, `gambar/`.
- `dist/` masih berisi installer lama bermerek **BridgeMind** (`BridgeMind-Setup-0.1.0-x64.exe`,
  `BridgeMind-Portable-0.1.0-x64.exe`). Jangan dihapus tanpa tanya user.

---

## 5. Aturan repo yang berlaku

- `AGENTS.md`: *"This is NOT the Next.js you know"* — baca `node_modules/next/dist/docs/`
  sebelum menulis kode Next.
- **Jangan commit / push kecuali user memintanya.**
- Supabase **hanya** dari sisi server lewat `SUPABASE_SERVICE_ROLE_KEY`.
  `src/lib/supabase/client.ts` sudah dihapus dan **tidak boleh dibuat ulang**.
- RLS menyala dengan **nol policy, disengaja**. Kalau query dari browser mengembalikan array
  kosong, **jangan matikan RLS** — pindahkan query-nya ke route handler.
- `.env.local` berisi `SUPABASE_SERVICE_ROLE_KEY` dan `CLERK_SECRET_KEY` — **jangan pernah
  menampilkan isinya**.
- `supabase/migrations/002_rewrite_aingespace_schema.sql` bersifat **destruktif** (men-drop
  tabel token OAuth terenkripsi). Jangan dijalankan tanpa konfirmasi user, dan jangan
  dipakai untuk memperbaiki schema drift — sudah ada 004 untuk itu.
- `POST /api/panes` wajib `.insert()`, bukan `.upsert()`.
- Error lint `PurpSpaceLayout.tsx:306` (`react-hooks/set-state-in-effect`) sudah ada sejak
  sebelumnya dan **tidak boleh** ikut "diperbaiki". Lint global bukan gate di repo ini
  (~320 pelanggaran lama).
- Jangan menghapus file di luar repo tanpa konfirmasi eksplisit.

---

## 6. Status repo saat handoff ini ditulis

HEAD = `5294342`. Belum ada file yang dipindah atau dibuat untuk pekerjaan ini.

Ada perubahan yang **belum di-commit** dari pekerjaan preset PurpVoice sebelumnya:

```
 M buat-workspace-handoff-6.md
 M src/components/CreateWorkspaceDialog.tsx
 M src/features/terminal/shell-launch.tsx
?? scripts/tmp/pty-four-startup-test.cjs
```

Semuanya sudah selesai dan build bersih (`npx tsc -p tsconfig.json --noEmit` tanpa output).
Detailnya di `buat-workspace-handoff-6.md`. Commit dulu akan membuat diff pemindahan folder
jauh lebih mudah dibaca — tapi **tanya user dulu**.

---

## 7. Batas tegas — jangan ditambah

Agent sebelumnya sempat memasukkan hal-hal berikut ke dalam rencana. **Semua ini karangannya
sendiri, tidak pernah diminta user**, dan boleh kamu buang:

- halaman `/masuk` (sign in)
- FAQ
- tabel perbandingan paket
- section "cara kerja"
- baris logo agen yang didukung
- mock preview aplikasi di hero
- halaman `/unduh` terpisah

Yang **di luar cakupan** pass ini: auth beneran, pembayaran beneran, database untuk website,
dan penegakan batas paket ("maks 3 Grid Terminal") di aplikasi desktop. Frontend dulu, sesuai
permintaan user.

Kalau ragu soal ruang lingkup: tanya user, jangan tebak.
