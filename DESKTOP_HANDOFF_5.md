# Prompt Handoff #5 — Tuntaskan Auth Desktop & Rilis `.exe` BridgeMind

> Lanjutan dari `DESKTOP_HANDOFF.md`, `_2.md`, `_3.md`, dan `_4.md`.
> **Jangan ulangi audit di keempat dokumen itu.** Copy seluruh file ini sebagai
> prompt untuk agent berikutnya.
>
> Sesi ini menghabiskan seluruh TUGAS G kecuali satu klik konfirmasi terakhir.
> Tiga bug nyata ditemukan dan diperbaiki, semuanya di jalur auth — dan tidak
> satu pun ada di daftar dugaan handoff #4.

---

## 0. BACA DULU

1. `AGENTS.md` — Next.js 16.2.11 punya breaking changes. Baca
   `node_modules/next/dist/docs/` sebelum menulis kode Next.
2. `referensi.md` — single source of truth desain. **Jangan sentuh UI sidebar/pane.**
3. `DESKTOP_HANDOFF_4.md` §1 — arsitektur auth desktop dan keputusan yang sudah
   final. Khususnya: **jangan aktifkan `isolatedModules`**, **jangan hapus
   `pty-session.ts`**, dan **jangan kembalikan `HOST` ke `127.0.0.1`**.

---

## 1. YANG SUDAH SELESAI DI SESI INI

### TUGAS G — Alur auth desktop ⚠️ HAMPIR SELESAI, TIGA BUG DIPERBAIKI

Handoff #4 menulis alur ini "sudah dikode, belum diuji runtime". Begitu diuji,
**tiga bug muncul berurutan**. Ketiganya sudah diperbaiki dan alurnya kini
berjalan sampai sesi Clerk hidup di window — tapi baca §2 sebelum menganggapnya
selesai.

#### 1.1 `/desktop-auth` balas 500 — `middleware.ts` salah lokasi ✅ commit `fb78c12`

```
Error: Clerk: clerkMiddleware() was not run, your middleware or proxy file
might be misplaced. Move your middleware or proxy file to ./src/middleware.ts.
Currently located at ./middleware.ts
    at async DesktopAuthPage (src/app/desktop-auth/page.tsx:27)
```

`app/` ada di `src/`, jadi file middleware harus sejajar dengannya
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`:
*"Create a `proxy.ts` file in the project root, or inside `src` if applicable, so
that it is located at the same level as `pages` or `app`"*). Sudah dipindah
dengan `git mv` ke `src/middleware.ts`.

> ⚠️ **Asimetri yang menipu, dan ini yang menyesatkan handoff #3 dan #4:**
> `next build` **memuat** `middleware.ts` dari root — `middleware-manifest.json`
> di paket lama berisi entri middleware — sementara `next dev` (Turbopack)
> **mengabaikannya tanpa suara**. Itu sebabnya handoff #3 melihat proxy Clerk
> jalan di build standalone padahal route dev balas 500. Jangan simpulkan apa pun
> soal middleware dari salah satu mode saja.

Bukti sudah jalan: tiap request di log dev sekarang memuat timing `proxy.ts:`
```
GET / 200 in 940ms (next.js: 174ms, proxy.ts: 169ms, application-code: 597ms)
```

#### 1.2 Loop redirect tak berujung → HTTP 431 ✅ commit `c3f950a`

Setelah 1.1, klik Sign in mendarat di sini:

```
HTTP ERROR 431 (Request Header Fields Too Large)
localhost:3000/sign-in?redirect_url=…%253Fredirect_url%25253D…  (berulang ~30 lapis)
```

`.env.local` menyetel `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, tapi **tidak ada
route `src/app/sign-in`** di repo ini dan `/sign-in` juga **tidak** ada di
`isPublicRoute`. Jadi `/desktop-auth` diproteksi → dilempar ke `/sign-in` →
`/sign-in` diproteksi → dilempar ke dirinya sendiri, tiap lompatan menempelkan
satu `redirect_url` terenkode ke dalam yang sebelumnya. URL menggelembung
eksponensial sampai header melewati batas server. Chrome hanya melaporkan gejala
terakhirnya.

Dua perbaikan, keduanya perlu:

- **`NEXT_PUBLIC_CLERK_SIGN_IN_URL` dan `_SIGN_UP_URL` dihapus** dari
  `.env.local` dan `.env.example`. Kalau kosong, Clerk jatuh ke hosted account
  portal-nya sendiri — `node_modules/@clerk/backend/dist/chunk-4PIZPQ6M.mjs:439-444`
  (`const accountsSignInUrl = ${accountsBaseUrl}/sign-in`). Itu justru yang
  diasumsikan rancangan handoff #4 §TUGAS F: login harus terjadi di browser asli.
- **`/sign-in(.*)` dan `/sign-up(.*)` masuk `isPublicRoute`** di
  `src/middleware.ts` sebagai guard struktural, supaya loop ini tidak bisa
  terulang walau env-nya diisi lagi nanti.

Bukti rantainya mati di akar — perhatikan `protect-rewrite` hilang:
```
sebelum: x-clerk-auth-reason: protect-rewrite, dev-browser-missing
sesudah: x-clerk-auth-reason: dev-browser-missing
         x-middleware-rewrite: /sign-in?redirect_url=x     <- passthrough, bukan lempar balik
```

> ⚠️ **Kalau nanti route `/sign-in` benar-benar dibuat**, dua hal itu harus
> dikembalikan **bersamaan**: set env-nya **dan** pastikan path-nya publik.
> Menyetel salah satu saja membangkitkan loop ini lagi. Alasannya sudah ditulis
> sebagai komentar di `.env.example` dan `src/middleware.ts`.

#### 1.3 Tiket ditukar dua kali → `"You're already signed in."` ⚠️ **BELUM DI-COMMIT**

Setelah 1.2, login Clerk di browser **berhasil**, deep link kembali, lalu window
menampilkan overlay merah:

```
[desktop-auth] ticket exchange failed: "You're already signed in."
    at DesktopAuthBridge.useEffect.fail
```

Log membuktikan penyebabnya, bukan menebak: deep link masuk **tepat satu kali**
dan baris error juga **tepat satu kali**. Kalau exchange sungguh hanya sekali
lalu gagal, window mustahil punya sesi — tapi Clerk justru bilang sesi sudah ada.
Artinya ada percobaan **pertama yang sukses tanpa jejak**, disusul percobaan
kedua yang gagal. Satu deep link, dua kali exchange → pemicunya React.

Akar masalah: efek penukar tiket ditulis seolah boleh dijalankan berulang,
padahal `signIn.ticket()` + `finalize()` adalah transaksi **sekali pakai**. Di
dev, StrictMode menjalankan efek dua kali per mount (pola ini sudah dikomentari
di `src/features/terminal/pty-session.ts:23` dan
`src/features/workspace/BridgeMindLayout.tsx:161`).

Lebih berbahaya lagi: flag `cancelled` yang lama `return` **di antara**
`ticket()` dan `finalize()`. Jalur pertama bisa menghanguskan tiket tanpa pernah
mengaktifkan sesi — kegagalan senyap yang jauh lebih buruk daripada overlay merah.

Perbaikan di `src/features/desktop/DesktopAuthBridge.tsx`:

- `startedRef` (`useRef<Set<string>>`) mencatat tiket yang exchange-nya sudah
  dimulai. **Harus ref, bukan state:** pemanggilan kedua terjadi sebelum
  re-render mana pun, jadi state tidak akan sempat menahannya.
- **Cleanup `cancelled` dibuang.** Transaksi tak-terbagi tidak boleh dibatalkan
  di tengah. Alasannya ada sebagai komentar — **jangan "dirapikan" kembali.**
- `isSignedInRef` — kalau exchange gagal padahal sesi sudah hidup, itu bukan
  kegagalan: diperlakukan sukses dan tidak ada yang dilaporkan. Menutup kasus
  deep link terkirim ulang / tab browser basi.

#### 1.4 Logging main process Electron ✅ commit `c3f950a`

`scripts/dev-desktop.mjs` sekarang menyetel `ELECTRON_ENABLE_LOGGING: "1"`.

Ini bukan kosmetik. `electron.exe` di Windows dibangun untuk GUI subsystem, jadi
**setiap `console.log` dari main process dibuang** — termasuk
`[bridgemind] deep link: …`, yang justru sinyal debug utama yang disuruh dicek
handoff #4 §2. Absennya baris itu terbaca sebagai "deep link tidak pernah
datang", padahal cuma logging-nya yang hilang. Diagnosa 1.3 tidak mungkin
dilakukan tanpa flag ini.

Efek sampingnya berguna: `console` **renderer** juga ikut muncul di terminal dev.
Karena itu cabang-cabang gagal di `DesktopAuthBridge` sekarang lewat satu
`fail()` yang `console.error`, dan deep link cacat / tanpa tiket di-`console.warn`
alih-alih ditelan.

### Yang terverifikasi di sesi ini

| Uji | Hasil |
|---|---|
| Protokol `aingespace://` di registry | ✅ `electron.exe` + path project + `%1` |
| Deep link sampai ke main process | ✅ `[bridgemind] deep link: aingespace://auth/?ticket=…` |
| Login Clerk di browser | ✅ berhasil (hosted account portal) |
| Tiket kembali & ditukar | ✅ sesi hidup di window (dibuktikan oleh error 1.3 itu sendiri) |
| `npx tsc --noEmit` | ✅ 0 error |
| `npx tsc -p tsconfig.electron.json --noEmit` | ✅ 0 error |
| `npx eslint electron scripts src/features/desktop src/app/desktop-auth src/middleware.ts` | ✅ 0 error, 0 warning |

### TUGAS I.1 — ✅ SELESAI

`dist/BridgeMind-0.1.0-x64.exe` (sampah build lama yang `app-next`-nya bolong)
sudah dihapus. Sisa isi `dist/`:
```
dist/BridgeMind-Setup-0.1.0-x64.exe
dist/BridgeMind-Portable-0.1.0-x64.exe
```
Keduanya **masih dibuat sebelum kode auth ada** — belum memuat apa pun dari
handoff #4 maupun sesi ini.

---

## 2. INI TUGASMU

### TUGAS G-sisa — Satu klik konfirmasi ⚠️ PRIORITAS UTAMA

Perbaikan 1.3 **belum dikonfirmasi user secara runtime.** Sesi berakhir sebelum
klik terakhir dilaporkan. Jangan mengklaim TUGAS G selesai sampai ini dilihat.

Kondisi yang sudah disiapkan sesi ini:
- Cookie jar window Electron **sudah dikosongkan** (`Network/Cookies`,
  `Local Storage`, `Session Storage` di `%APPDATA%\BridgeMind`), jadi window
  benar-benar signed-out. `.env.local` di folder itu **tidak** disentuh.
- Belum ada sign-out di UI (masih di luar cakupan, handoff #4 §TUGAS G). Untuk
  mengulang uji dari nol, kosongkan lagi tiga item di atas dengan Electron mati.

```bash
npm run dev:desktop
```
1. Klik pill **» Sign in** di kanan bawah.
2. Login di halaman Clerk (`new-bluegill-38.accounts.dev`).
3. **Definition of done:** window jadi signed-in, pill hilang, **tanpa overlay
   merah**. Kalau overlay `"You're already signed in."` masih muncul, dedupe di
   1.3 tidak bekerja — periksa apakah `startedRef` ikut ter-reset.

Lalu **commit** perubahan 1.3 (`src/features/desktop/DesktopAuthBridge.tsx`).

**Risiko yang masih terbuka, belum terjawab:** port berubah tiap peluncuran
(`findFreePort`). Instance Clerk development permisif terhadap localhost
sembarang port; **instance production hampir pasti tidak.** Kalau pindah ke
production key, redirect ke `http://localhost:<acak>` akan ditolak. Solusi yang
perlu dipertimbangkan: kunci satu port tetap untuk desktop, atau daftarkan
origin desktop di allowed origins Clerk. User memutuskan **tetap pakai instance
development** untuk sekarang.

### TUGAS H — Build ulang installer setelah G-sisa lulus

```bash
npm run build:desktop
```

Lalu **wajib** cek ulang tiga hal ini, karena tiga-tiganya pernah rusak diam-diam:

```bash
ls -a dist/win-unpacked/resources/app-next        # harus ada .next + node_modules
ls dist/*.exe                                     # harus ada Setup- DAN Portable-
find dist/win-unpacked -name ".env*"              # harus kosong
```

Tambahan wajib untuk build ini: pastikan `middleware-manifest.json` di hasil
build masih berisi entri middleware setelah pindah ke `src/` (§1.1) —
```bash
head -c 200 dist/win-unpacked/resources/app-next/.next/server/middleware-manifest.json
```

Lalu pasang installer-nya sungguhan, buka aplikasinya, dan ketik `git status` di
sebuah pane. Itu definition of done yang sebenarnya — **belum pernah dilakukan
sampai sekarang.**

### TUGAS I — Sisa kebersihan

1. ~~Hapus `dist/BridgeMind-0.1.0-x64.exe`~~ ✅ selesai (§1).
2. `src/lib/clerk/provider.tsx:11` masih melanggar `react-hooks/set-state-in-effect`.
   **Sudah ada sebelum handoff #4** dan bukan bagian dari perubahan mana pun —
   `setMounted(true)` memang pola lama file itu. Memperbaikinya berarti mengubah
   perilaku hydration provider, jadi sengaja tidak disentuh di dua sesi terakhir.
   Putuskan sendiri apakah mau dirapikan.
3. `npm audit`: 16 vulnerability (4 moderate, 12 high) di dependency lama. Masih
   belum disentuh.

---

## 3. JEBAKAN OPERASIONAL YANG BIKIN BUANG WAKTU

Empat pertama sudah memakan waktu nyata; jangan ulangi.

- **`console.log` main process Electron tidak muncul di Windows** tanpa
  `ELECTRON_ENABLE_LOGGING=1`. Sudah dipasang di `dev:desktop` (§1.4). Kalau
  kamu menjalankan `npx electron .` langsung, pasang sendiri — tanpa itu kamu
  akan menyimpulkan hal yang salah.
- **`curl` ke route terproteksi selalu 404 dengan
  `x-clerk-auth-reason: dev-browser-missing`.** Itu **bukan bug**: handshake
  dev-browser Clerk butuh browser sungguhan. Jangan mengejar 404 ini. Yang bisa
  dipercaya dari `curl` hanya perbandingan header (`protect-rewrite` ada/tidak).
- **`next dev` mengabaikan middleware yang salah lokasi, `next build` tidak.**
  Lihat peringatan di §1.1.
- **`next build` gagal `EBUSY: rmdir '.next\standalone'`** karena sisa proses
  `node server.js` / `BridgeMind.exe` masih memegang direktori. Cari yang
  spesifik, jangan sapu semua `node.exe`:
  ```bash
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='electron.exe'\" | Where-Object { \$_.CommandLine -like '*server.js*' } | Select-Object ProcessId, CommandLine"
  ```
- **`electron-builder` gagal `getaddrinfo ENOTFOUND github.com`.** NSIS dan
  winCodeSign diunduh dari GitHub saat pertama kali; ini cuma cegukan DNS.
  Jalankan ulang saja — `next build` tidak perlu diulang, cukup
  `npx electron-builder --win`. Untuk iterasi cepat masalah packaging pakai
  `npx electron-builder --win --dir` (hanya `win-unpacked`, tanpa installer).

---

## 4. STATUS FILE — BACA SEBELUM MENYENTUH ENV

Sudah masuk commit:
```
fb78c12  middleware.ts => src/middleware.ts
c3f950a  scripts/dev-desktop.mjs, src/middleware.ts,
         src/features/desktop/DesktopAuthBridge.tsx (logging)
```

Belum di-commit:
```
M src/features/desktop/DesktopAuthBridge.tsx    <- perbaikan §1.3
```

> ⚠️ **`.env.local` dan `.env.example` di-ignore git**, jadi penghapusan
> `NEXT_PUBLIC_CLERK_SIGN_IN_URL`/`_SIGN_UP_URL` (§1.2) **hanya ada di disk mesin
> ini** — tidak ikut clone dan tidak ikut commit. Kalau kamu bekerja dari clone
> baru atau ada yang menyalin `.env.example` lama, loop 431 di §1.2 **akan
> kembali**. Periksa dulu:
> ```bash
> grep -c "CLERK_SIGN_IN_URL" .env.local   # harus 0
> ```
>
> Salinan di `%APPDATA%\BridgeMind\.env.local` sudah disinkronkan lewat
> `npm run desktop:env`. Kalau `.env.local` diubah lagi, jalankan ulang perintah
> itu — kalau tidak, build paket memakai env yang basi.

---

## 5. CATATAN LAMA YANG MASIH BERLAKU

Tidak berubah dari handoff #3 dan #4, jangan diulang investigasinya:

- **Banner ASCII tidak tampil di mode desktop.** Keputusan sadar, bukan bug.
  Alasannya ada sebagai komentar di atas `writeBanner()`.
- **`node-pty` mencetak `Error: AttachConsole failed`** saat app quit. Race jinak
  dari `conpty_console_list_agent.js`, tidak memengaruhi fungsi.
- `pty-session.ts` menunda `kill()` 2,5 detik supaya split pane tidak membunuh
  shell yang sedang jalan. **Jangan dihapus.**
- `HOST = "localhost"` di `electron/next-server.ts` dipakai untuk tiga hal
  sekaligus. **Jangan kembalikan ke `127.0.0.1`** — bug 500 di semua route balik
  lagi tanpa pesan error apa pun. Alasan panjangnya ada sebagai komentar.

---

## 6. RISIKO KEAMANAN YANG MASIH TERBUKA (laporkan lagi ke user)

Statusnya sama seperti handoff #3 dan #4 — **tidak ada kemajuan, dan ini
disengaja**: user membatalkannya di sesi ini karena usage Claude sudah kritis.

- **`SUPABASE_SERVICE_ROLE_KEY` menembus RLS.** Mitigasi yang ada baru: key tidak
  ikut installer, harus ditaruh manual di `%APPDATA%\BridgeMind\.env.local` lewat
  `npm run desktop:env`.
- Itu **belum menyelesaikan masalah sebenarnya.** `.exe` yang dikirim ke orang
  lain akan terbuka tapi mati total tanpa file env — dan supaya hidup, pemiliknya
  harus menyerahkan file berisi `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`,
  `GITHUB_CLIENT_SECRET`, `ENCRYPTION_KEY`, dan `OPENROUTER_API_KEY` sebagai teks
  biasa. **User ingin membagikan `.exe` ini ke teman**, jadi ini bukan risiko
  teoretis.
- Sign-in ticket lewat URL deep link: umurnya 60 detik dan sekali pakai, dan ini
  pola resmi Clerk untuk desktop. **Jangan naikkan `TICKET_TTL_SECONDS`** tanpa
  alasan kuat — kalau TTL-nya naik, ia menjadi kredensial yang tertinggal di
  riwayat browser.

Sesi ini sempat memetakan jalan keluarnya sebelum dibatalkan. Tiga fakta ini
sudah terverifikasi dan **tidak perlu diaudit ulang** kalau pekerjaan itu
dilanjutkan nanti:

1. **RLS sudah lengkap dan sudah benar.** Semua policy di
   `supabase/migrations/001_initial_schema.sql` memakai
   `auth.jwt()->>'sub' = clerk_user_id` — tepat pola integrasi Clerk-Supabase.
   Tidak ada SQL baru yang perlu ditulis.
2. **UI nyaris tidak memakai server.** Satu-satunya panggilan API dari UI adalah
   `fetch("/api/workspaces")` di `src/components/CreateWorkspaceDialog.tsx:689`,
   dan itu pun best-effort dengan fallback lokal (`:702-707`). Route `env`,
   `github`, `ai/sessions`, `terminals` tidak pernah dipanggil UI.
   `src/lib/supabase/client.ts` tidak diimpor di mana pun.
3. **Hook `accessToken` tersedia** di `@supabase/supabase-js` 2.109
   (`dist/index.d.mts:279`) — jalur resmi menyuntik token Clerk supaya RLS jalan
   tanpa service role.

**Jangan mengerjakan ini kecuali user memintanya.** Rencana lengkapnya, termasuk
langkah dashboard Clerk/Supabase dan pemisahan env publik vs rahasia, ada di
`~/.claude/plans/cuddly-floating-castle.md`.

---

## 7. ATURAN KERJA

1. Jangan ubah desain sidebar/pane. Prioritas warna: **live (oranye `#E0813C`) >
   selected (hijau `#3ECF8E`) > netral** — `referensi.md` §2.
2. Setelah tiap tugas: `npx tsc --noEmit`, `npx tsc -p tsconfig.electron.json
   --noEmit`, dan `npx eslint <file>`. Harus bersih.
3. Jangan commit/push kecuali diminta — **kecuali** perbaikan §1.3 yang memang
   sudah diminta di TUGAS G-sisa.
4. Laporkan apa adanya. Kalau ada yang gagal atau dilewati, sebutkan eksplisit.
   Sesi ini membuktikan tiap klaim dengan header `curl` sungguhan dan log
   sungguhan, **dan menyebut terus terang bahwa perbaikan §1.3 belum
   dikonfirmasi runtime.** Lanjutkan kebiasaan itu.
5. Kesimpulan akhir dalam **Bahasa Indonesia**.
