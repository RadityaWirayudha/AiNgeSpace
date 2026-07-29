# Prompt Handoff #4 — Tuntaskan Auth Desktop & Rilis `.exe` BridgeMind

> Lanjutan dari `DESKTOP_HANDOFF.md`, `DESKTOP_HANDOFF_2.md`, dan
> `DESKTOP_HANDOFF_3.md`.
> **Jangan ulangi audit di ketiga dokumen itu.** Semua yang ada di sini
> dijalankan langsung di mesin ini — setiap klaim "berhasil" punya bukti perintah
> yang benar-benar dieksekusi. Copy seluruh file ini sebagai prompt untuk agent
> berikutnya.

---

## 0. BACA DULU

1. `AGENTS.md` — Next.js 16.2.11 punya breaking changes. Baca
   `node_modules/next/dist/docs/` sebelum menulis kode Next.
2. `referensi.md` — single source of truth desain. **Jangan sentuh UI sidebar/pane.**
3. `DESKTOP_HANDOFF_2.md` §1 dan `DESKTOP_HANDOFF_3.md` §1–2 — arsitektur dan
   keputusan yang sudah final. Khususnya: **jangan aktifkan `isolatedModules`**
   di `tsconfig.electron.json`, dan **jangan hapus `pty-session.ts`**.

---

## 1. YANG SUDAH SELESAI DI SESI INI

### TUGAS E1 — Standalone server balas 500 ✅ SELESAI, AKAR MASALAH KETEMU

**Hipotesis di handoff #3 keliru.** Handoff #3 menduga ini masalah runtime
Electron (edge worker mati di bawah `ELECTRON_RUN_AS_NODE`). Uji pertama sudah
mematahkannya: dijalankan dengan **`node server.js` biasa pun gagal identik**.

Akar masalah sebenarnya — rantai tiga lapis:

1. `node_modules/next/dist/server/next-server.js:1132` membangun URL yang
   diserahkan ke proxy/middleware sebagai
   `${initProtocol}://${this.fetchHostname || "localhost"}:${this.port}`.
   Di build standalone `fetchHostname` tidak terisi, jadi middleware **selalu**
   melihat `http://localhost:<port>/`, berapa pun `HOSTNAME` yang di-set.
2. `node_modules/@clerk/nextjs/dist/esm/server/utils.js:46` (`decorateRequest`)
   melakukan `rewriteURL = new URL(req.url)` dan mengembalikannya apa adanya
   sebagai header `x-middleware-rewrite`. Jadi Clerk memantulkan `localhost`.
3. `resolve-routes.js:117` membangun `initUrl` dari `HOSTNAME` yang **asli**
   (`127.0.0.1`), lalu `getRelativeURL()` membandingkan origin keduanya. Origin
   berbeda → rewrite dianggap **tujuan eksternal** → `finished: true` dengan
   `parsedUrl.protocol` terisi → `router-server.js:377` mem-proxy request ke
   `http://localhost:<port>/`, yaitu **dirinya sendiri**. Loop tanpa ujung,
   berakhir `socket hang up (ECONNRESET)` dan HTTP 500 di semua route.

Bukti langsung (`DEBUG=next:router-server*`), request yang sama berulang puluhan
kali dalam satu detik:

```
x-middleware-request-host : 127.0.0.1:3995      <- Clerk tahu host aslinya
x-middleware-rewrite      : http://localhost:3995/   <- tapi memantulkan localhost
```

**Perbaikan:** `electron/next-server.ts` sekarang punya satu konstanta `HOST =
"localhost"` yang dipakai untuk **tiga hal sekaligus** — probe port bebas,
`HOSTNAME` anak proses, dan URL yang di-`loadURL` window. Begitu ketiganya sama,
origin cocok dan Next tidak lagi menganggap rewrite-nya sendiri sebagai eksternal.

> ⚠️ **Jangan kembalikan ke `127.0.0.1`.** Bug-nya balik lagi tanpa pesan error
> apa pun selain 500. Alasannya sudah ditulis panjang sebagai komentar di atas
> `const HOST` — jangan dihapus.
> `localhost` tetap loopback-only (127.0.0.1 + ::1), jadi ini tidak memperluas
> paparan server ke jaringan.

Terverifikasi:

| Uji | Hasil |
|---|---|
| `node server.js`, HOSTNAME=localhost | `/` → **200** |
| `electron server.js` + `ELECTRON_RUN_AS_NODE=1` | `/` → **200** |
| `/favicon.png` (dari `public/`) | 200 |
| `/_next/static/chunks/*.css` | 200 |
| `/dashboard` dengan header browser | **307** ke handshake Clerk |

Baris terakhir penting: itu membuktikan proxy Clerk benar-benar **jalan**, bukan
sekadar tidak lagi crash.

### TUGAS E2 — Packaging `.exe` ✅ SELESAI, DUA BUG PACKAGING DIPERBAIKI

`npm run build:desktop` sekarang tuntas sampai installer. Tapi hasil build yang
pertama **rusak secara senyap**, dan dua-duanya perlu diperbaiki:

#### 2.1 `resources/app-next/` kehilangan `.next/` DAN `node_modules/` ⚠️ BLOKER SENYAP

`ls dist/win-unpacked/resources/app-next` hanya berisi `package.json`, `public`,
`server.js`. Aplikasi terpasang pasti mati dengan `Cannot find module 'next'` —
dan tidak ada satu pun pesan di log build yang menandakannya.

Dua sebab berbeda, dan keduanya harus ditangani:

- **`.next/` hilang** karena electron-builder menyusun Minimatch-nya **tanpa opsi
  `dot`**, jadi pola `**/*` tidak pernah cocok dengan entri berawalan titik.
  Harus disebut eksplisit: `".next/**/*"`.
- **`node_modules/` hilang** karena `createFilter` di
  `node_modules/app-builder-lib/out/util/filter.js` melakukan
  `if (relative === "node_modules") return false` **sebelum pola mana pun
  dibaca**. Tidak ada glob yang bisa menembusnya. Solusinya: entri
  `extraResources` **kedua** yang di-root langsung di dalam `node_modules`,
  supaya tidak pernah ada relative path yang persis `"node_modules"`.

Alasan lengkapnya sudah ditulis sebagai komentar di `electron-builder.yml`.

**Cara memverifikasi setelah menyentuh `extraResources`:**
```bash
ls -a dist/win-unpacked/resources/app-next   # WAJIB memuat .next dan node_modules
```

#### 2.2 Installer NSIS ditimpa oleh build portable

`win.artifactName` berlaku untuk kedua target, dan keduanya menghasilkan `.exe`,
jadi target `portable` menimpa installer NSIS. Hasil akhirnya satu file yang
terlihat seperti installer padahal isinya portable. Sekarang dipisah lewat
`nsis.artifactName` dan `portable.artifactName`.

#### Bukti hasil build

```
dist/BridgeMind-Setup-0.1.0-x64.exe       (NSIS)
dist/BridgeMind-Portable-0.1.0-x64.exe    (portable)
```

- Server Next dari **dalam paket**, dijalankan dengan **binary paket** itu
  sendiri (`BridgeMind.exe` + `ELECTRON_RUN_AS_NODE=1`) → `/` **200**,
  `/favicon.png` 200, CSS 200.
- node-pty dari `app.asar.unpacked`, di bawah Electron paket, benar-benar
  men-spawn PowerShell:
  ```
  {"status":"SPAWNED","exitCode":0,"sawMarker":true}
  ```
  `conpty.dll` + `OpenConsole.exe` ada di
  `app.asar.unpacked/node_modules/node-pty/prebuilds/win32-x64/conpty/`.
- Tidak ada satu pun file `.env*` yang ikut ter-package (`find dist/win-unpacked
  -name ".env*"` → kosong).

> 🗑️ **`dist/BridgeMind-0.1.0-x64.exe` adalah sampah dari build lama** (dibuat
> sebelum §2.1 dan §2.2 diperbaiki, jadi `app-next`-nya bolong). Sengaja tidak
> dihapus supaya kamu tahu asal-usulnya. **Hapus file itu** sebelum ada yang
> salah membagikannya.

### TUGAS F — Auth Clerk via deep link ⚠️ SUDAH DIKODE, **BELUM DIUJI RUNTIME**

Ini bagian yang harus kamu baca paling teliti, karena statusnya bukan "selesai".

**Rancangan.** Window Electron dan browser asli punya cookie jar terpisah, jadi
sesi yang dibuat di browser tidak bisa dibaca app. Karena itu yang dioper bukan
cookie, melainkan **sign-in ticket** sekali pakai:

```
tombol Sign in (di window)
  → openExternal(`${window.location.origin}/desktop-auth`)
  → browser kena proxy Clerk, user login di halaman hosted Clerk
  → /desktop-auth (server) mencetak sign-in token 60 detik untuk userId itu
  → browser diarahkan ke  aingespace://auth?ticket=<token>
  → main process menangkap, meneruskan lewat CH.deepLink
  → renderer: signIn.ticket({ticket}) lalu signIn.finalize()
  → sesi hidup di cookie jar window Electron
```

**File yang dibuat / diubah:**

| File | Isi |
|---|---|
| `src/app/desktop-auth/page.tsx` | **BARU.** Server component, `force-dynamic`. Mencetak sign-in token lewat `clerkClient().signInTokens.createSignInToken()`. |
| `src/app/desktop-auth/DesktopAuthHandoff.tsx` | **BARU.** Client. Melompat ke `aingespace://auth?ticket=…`, plus link manual sebagai cadangan. |
| `src/features/desktop/DesktopAuthBridge.tsx` | **BARU.** Consumer deep link + tombol sign-in. |
| `src/lib/clerk/provider.tsx` | Memasang `<DesktopAuthBridge/>` **di dalam** `BaseClerkProvider`. |
| `electron/preload.ts` | Menambah `onDeepLink()` + buffer untuk link yang datang sebelum ada subscriber. |
| `electron/main.ts` | Antrean deep link + flush di `did-finish-load`, dan menangkap deep link dari `process.argv` saat cold start. |
| `src/types/desktop.d.ts` | Kontrak `onDeepLink` di `DesktopBridge`. |

**Keputusan yang jangan dibongkar tanpa alasan:**

- `DesktopAuthBridge` di-render dari `provider.tsx`, **bukan** dari `layout.tsx`.
  `ClerkProvider` custom di repo ini baru memasang context Clerk setelah
  `useEffect`-nya sendiri; komponen anak layout akan memanggil `useSignIn()` satu
  render terlalu awal dan melempar error.
- Clerk versi terpasang (`@clerk/nextjs` 7.6) memakai **signals API**:
  `useSignIn()` mengembalikan `{ errors, fetchStatus, signIn }` dan alurnya
  `signIn.ticket({ticket})` → `signIn.finalize()`. API lama
  (`signIn.create({strategy:'ticket'})` + `setActive`) **tidak ada** di versi ini
  dan langsung gagal di `tsc`.
- Ticket yang tiba sebelum Clerk selesai loading **diparkir di state**, tidak
  dibuang. Preload juga menahan satu deep link kalau belum ada subscriber.
  Tanpa dua-duanya, tiket hilang diam-diam dan window tetap signed-out tanpa
  penjelasan apa pun.
- Tombolnya pill kecil `fixed bottom-3 right-3`, hanya muncul di Electron dan
  hanya saat signed-out. **Sidebar dan pane tidak disentuh sama sekali.**

**Yang SUDAH terbukti:**
```
npx tsc --noEmit                            → 0 error
npx tsc -p tsconfig.electron.json --noEmit  → 0 error
npx eslint electron scripts src/features/desktop src/app/desktop-auth src/types
                                            → 0 error, 0 warning
npm run build:next                          → sukses, route ƒ /desktop-auth muncul
```

**Yang BELUM terbukti — ini tugas pertamamu:**
- Alur ini **belum pernah diklik satu kali pun**. Belum ada login Clerk sungguhan
  yang dijalankan di sesi ini.
- `.exe` di `dist/` **dibuat sebelum kode TUGAS F ada**, jadi installer yang
  sekarang belum memuat auth ini.

---

## 2. INI TUGASMU

### TUGAS G — Uji alur auth desktop dari ujung ke ujung ⚠️ PRIORITAS UTAMA

```bash
npm run dev:desktop
```

1. Klik pill **Sign in** di kanan bawah. Browser harus terbuka ke
   `http://localhost:3000/desktop-auth`.
2. Selesaikan login Clerk di browser.
3. Browser harus memantul ke `aingespace://auth?ticket=…`. Windows akan
   menanyakan aplikasi mana yang membuka protokol itu pada percobaan pertama.
4. Window BridgeMind harus berubah jadi signed-in dan pill-nya hilang.

Kalau macet, urut dari yang paling murah:

- Lihat stdout `[bridgemind] deep link: …` di terminal. **Tidak muncul** →
  masalahnya pendaftaran protokol, bukan kode renderer. Di mode dev protokol
  didaftarkan lewat `process.execPath` + `process.argv[1]`; kalau `argv[1]`
  bukan path project, `setAsDefaultProtocolClient` mendaftarkan sesuatu yang
  salah.
- **Muncul tapi UI diam** → masalah di `DesktopAuthBridge`. Buka DevTools
  (`mainWindow.webContents.openDevTools()` sementara di `electron/main.ts`) dan
  lihat pesan error dari `signIn.ticket()`.
- **`Sign-in stopped at "…"`** → tiket diterima tapi instance Clerk minta faktor
  kedua. Tiket tidak bisa memenuhi 2FA; harus dipikirkan jalur lain.

**Risiko yang sudah diketahui dan belum terjawab:**

- **Port berubah tiap peluncuran** (`findFreePort`). Instance Clerk development
  (`new-bluegill-38.clerk.accounts.dev`) permisif terhadap localhost sembarang
  port, tapi **instance production hampir pasti tidak**. Kalau nanti pindah ke
  production key, redirect ke `http://localhost:<acak>` akan ditolak. Solusi yang
  perlu dipertimbangkan: kunci satu port tetap untuk desktop, atau daftarkan
  callback-nya sebagai deep link di dashboard Clerk.
- **Belum ada sign-out.** Sengaja di luar cakupan; tambahkan kalau diminta.

### TUGAS H — Build ulang installer setelah TUGAS G lulus

```bash
npm run build:desktop
```

Lalu **wajib** cek ulang tiga hal ini, karena tiga-tiganya pernah rusak diam-diam:

```bash
ls -a dist/win-unpacked/resources/app-next        # harus ada .next + node_modules
ls dist/*.exe                                     # harus ada Setup- DAN Portable-
find dist/win-unpacked -name ".env*"              # harus kosong
```

Lalu pasang installer-nya sungguhan, buka aplikasinya, dan ketik `git status` di
sebuah pane. Itu definition of done yang sebenarnya — belum pernah dilakukan
sampai sekarang.

### TUGAS I — Sisa kebersihan

1. **Hapus `dist/BridgeMind-0.1.0-x64.exe`** (lihat §1 TUGAS E2).
2. `src/lib/clerk/provider.tsx:11` masih melanggar `react-hooks/set-state-in-effect`.
   **Ini sudah ada sebelum sesi ini** dan bukan bagian dari perubahan mana pun di
   atas — `setMounted(true)` memang pola lama file itu. Diperbaiki berarti
   mengubah perilaku hydration provider, jadi sengaja tidak disentuh. Putuskan
   sendiri apakah mau dirapikan.
3. `npm audit`: 16 vulnerability (4 moderate, 12 high) di dependency lama. Masih
   belum disentuh.

---

## 3. JEBAKAN OPERASIONAL YANG BIKIN BUANG WAKTU

Dua-duanya sudah memakan waktu di sesi ini:

- **`next build` gagal `EBUSY: resource busy or locked, rmdir '.next\standalone'`.**
  Penyebabnya proses `node server.js` atau `BridgeMind.exe` sisa uji coba yang
  masih memegang direktori itu. Cari dan matikan yang spesifik, jangan sapu semua
  `node.exe`:
  ```bash
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='electron.exe'\" | Where-Object { \$_.CommandLine -like '*server.js*' } | Select-Object ProcessId, CommandLine"
  ```
- **`electron-builder` gagal `getaddrinfo ENOTFOUND github.com`.** NSIS dan
  winCodeSign diunduh dari GitHub saat pertama kali. Ini cuma cegukan DNS —
  `curl https://github.com` tetap 200 di saat yang sama. Jalankan ulang saja;
  tahap `next build` tidak perlu diulang, cukup `npx electron-builder --win`.
  Untuk iterasi cepat pada masalah packaging, pakai `npx electron-builder --win
  --dir` (hanya `win-unpacked`, tanpa bikin installer).

---

## 4. CATATAN LAMA YANG MASIH BERLAKU

Tidak berubah dari handoff #3, jangan diulang investigasinya:

- **Banner ASCII tidak tampil di mode desktop.** Keputusan sadar, bukan bug.
  Alasannya ada sebagai komentar di atas `writeBanner()`.
- **`node-pty` mencetak `Error: AttachConsole failed`** saat app quit. Race jinak
  dari `conpty_console_list_agent.js`, tidak memengaruhi fungsi.
- `pty-session.ts` menunda `kill()` 2,5 detik supaya split pane tidak membunuh
  shell yang sedang jalan. **Jangan dihapus.**

---

## 5. RISIKO KEAMANAN YANG MASIH TERBUKA (laporkan lagi ke user)

Tidak ada kemajuan di sini; statusnya sama persis seperti handoff #3.

- **`SUPABASE_SERVICE_ROLE_KEY` menembus RLS.** Mitigasi yang ada baru: key tidak
  ikut installer (sudah diverifikasi ulang di sesi ini — `find dist/win-unpacked
  -name ".env*"` kosong), harus ditaruh manual di
  `%APPDATA%\BridgeMind\.env.local` lewat `npm run desktop:env`.
- Itu **belum menyelesaikan masalah sebenarnya** — siapa pun yang punya akses ke
  mesin tetap bisa membaca file itu sebagai teks biasa. Kalau `.exe` ini akan
  dibagikan ke orang lain, operasi service-role **wajib** pindah ke server remote
  dan desktop cukup pakai anon key + RLS.
- Tambahan dari sesi ini: sign-in ticket lewat URL deep link. Umurnya 60 detik
  dan sekali pakai, dan ini memang pola resmi Clerk untuk desktop — tapi kalau
  nanti TTL-nya dinaikkan, itu menjadi kredensial yang tertinggal di riwayat
  browser. Jangan naikkan `TICKET_TTL_SECONDS` tanpa alasan kuat.

---

## 6. ATURAN KERJA

1. Jangan ubah desain sidebar/pane. Prioritas warna: **live (oranye `#E0813C`) >
   selected (hijau `#3ECF8E`) > netral** — `referensi.md` §2.
2. Setelah tiap tugas: `npx tsc --noEmit`, `npx tsc -p tsconfig.electron.json
   --noEmit`, dan `npx eslint <file>`. Harus bersih.
3. Jangan commit/push kecuali diminta. Sesi ini **tidak** melakukan commit —
   semua perubahan masih berupa working tree:
   ```
   M electron-builder.yml      M electron/main.ts
   M electron/next-server.ts   M electron/preload.ts
   M src/lib/clerk/provider.tsx  M src/types/desktop.d.ts
   ?? src/app/desktop-auth/    ?? src/features/desktop/
   ```
4. Laporkan apa adanya. Kalau ada yang gagal atau dilewati, sebutkan eksplisit —
   jangan mengklaim sesuatu berhasil kalau belum benar-benar dijalankan. Sesi ini
   membuktikan tiap klaim server dengan `curl` sungguhan dan tiap klaim PTY
   dengan spawn sungguhan; **dan menyebut terus terang bahwa TUGAS F belum diuji
   runtime.** Lanjutkan kebiasaan itu.
5. Kesimpulan akhir dalam **Bahasa Indonesia**.
