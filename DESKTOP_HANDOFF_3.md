# Prompt Handoff #3 — Selesaikan Packaging `.exe` BridgeMind

> Lanjutan dari `DESKTOP_HANDOFF.md` dan `DESKTOP_HANDOFF_2.md`.
> **Jangan ulangi audit di kedua dokumen itu.** Semua yang ada di sini sudah
> dijalankan langsung di mesin ini, bukan asumsi. Copy seluruh file ini sebagai
> prompt untuk agent berikutnya.

---

## 0. BACA DULU

1. `AGENTS.md` — Next.js 16.2.11 punya breaking changes. Baca
   `node_modules/next/dist/docs/` sebelum menulis kode Next.
2. `referensi.md` — single source of truth desain. **Jangan sentuh UI sidebar/pane.**
3. `DESKTOP_HANDOFF_2.md` §1 — arsitektur & keputusan yang sudah final.

---

## 1. YANG SUDAH SELESAI DI SESI INI (terverifikasi, bukan klaim)

### TUGAS A — TerminalPanel ↔ PTY ✅ SELESAI & TERBUKTI JALAN

Bukti: `git status --short --branch` diketik di dalam pane aplikasi desktop dan
mengeluarkan output asli berwarna dari repo ini. Split pane → dua shell
PowerShell independen, masing-masing dengan prompt sendiri.

File yang berubah:

- `src/features/terminal/TerminalPanel.tsx` — dipecah jadi `attachPty()` dan
  `attachMockShell()`, dipilih dari satu tempat lewat `window.bridgemind`.
  Parser lokal (history, backspace, `run()`, prompt manual) **hanya** dipakai di
  mode browser. Mode desktop meneruskan byte mentah dua arah.
- `src/features/terminal/pty-session.ts` — **BARU.** Cache sesi PTY per
  `terminalId`.

**Kenapa `pty-session.ts` ada — jangan dihapus.** `PaneTerminalManager` menyusun
ulang pohon node setiap kali pane di-split / maximize / restore. Tipe elemen di
posisi itu berubah, jadi React meng-unmount leaf lama. Kalau `kill()` dipanggil
langsung di cleanup (seperti tertulis di handoff #2 TUGAS A poin 2), **setiap
klik "split right" membunuh shell yang sedang jalan.** Karena itu kill-nya
ditunda 2,5 detik; remount di dalam jendela itu menyambung lagi ke shell yang
sama dan me-replay output yang tercetak saat tidak ada xterm yang mendengarkan.

### TUGAS B — `build/icon.png` ✅ SELESAI

- `scripts/make-icon.mjs` — **BARU.** Meng-generate ikon 512×512 tanpa dependency
  (tanpa sharp/canvas/ImageMagick — semuanya butuh MSVC yang tidak ada di mesin
  ini). Pakai signed distance field + encoder PNG manual.
- Hasil: chevron `❯` oranye `#E0813C` + underscore hijau `#3ECF8E` di atas
  `#0E0E10`, sesuai `referensi.md` §2.
- Regenerate: `node scripts/make-icon.mjs [ukuran]`

### TUGAS C — Verifikasi statis ✅ BERSIH

```
npx tsc --noEmit                            → 0 error
npx tsc -p tsconfig.electron.json --noEmit  → 0 error
npx eslint electron scripts src/features/terminal → 17 file, 0 error, 0 warning
```

Diperbaiki di jalan:
- `electron/next-server.ts` — TS2339 `Property 'code' does not exist on type 'never'`.
  Control-flow analysis tidak melihat assignment di dalam listener `exit`.
  Dibaca lewat fungsi `lastExit()`.

### TUGAS D — Uji dev ✅ SELESAI

`npm run dev:desktop` → window sendiri, tanpa address bar, tanpa flash putih,
sidebar identik dengan versi browser, terminal hidup.

---

## 2. BUG SERIUS YANG DITEMUKAN & DIPERBAIKI (jangan di-revert)

### 2.1 Preload sandbox tidak bisa `require("./channels")` ⚠️ INI BLOKER SENYAP

Preload jalan dengan `sandbox: true`. Di mode itu `require` cuma polyfill yang
bisa me-resolve `electron` + beberapa built-in Node. `require("./channels")`
melempar `module not found: ./channels`, `contextBridge.exposeInMainWorld` tidak
pernah jalan, dan **`window.bridgemind` jadi `undefined` tanpa error apa pun di
UI** — TerminalPanel diam-diam jatuh ke mock shell. Kelihatan "berhasil" padahal
terminalnya palsu.

Dibuktikan dengan probe Electron minimal:
```
{"status":"REQUIRE_FAILED: module not found: ./channels","ch":null}
```

**Perbaikan:** `electron/channels.ts` diubah dari `export const CH = {...} as const`
menjadi `export const enum CH`. tsc meng-inline nilainya dan menghapus import-nya,
jadi `preload.js` hasil compile cuma `require("electron")` dan tetap satu sumber
kebenaran untuk main + preload.

> ⚠️ **Jangan aktifkan `isolatedModules` di `tsconfig.electron.json`** — itu
> mematikan inlining const enum dan bug ini balik lagi secara senyap.

Verifikasi ulang kalau menyentuh preload:
```bash
npm run build:electron
grep -n 'require(' dist-electron/electron/preload.js   # harus HANYA "electron"
```

### 2.2 `dev:desktop` bisa nempel ke server orang lain

`scripts/dev-desktop.mjs` menunggu `http://localhost:3000` tapi tidak pernah
mengunci Next ke port itu. Kalau 3000 sudah dipakai, Next diam-diam pindah ke
3001 dan Electron memuat aplikasi milik proses lain.

**Perbaikan:** sekarang pakai `next dev -p <port>` eksplisit, dan kalau server
di port itu sudah hidup, script **memakai ulang** server tersebut (tidak
menjalankan `next dev` kedua yang akan rebutan cache `.next`).
Override: `BM_DEV_PORT` atau `BM_DEV_URL`.

### 2.3 `build/icon.png` tidak akan pernah ke-commit

`.gitignore` punya `/build`, jadi ikon yang baru dibuat tidak masuk git dan
clone baru pasti gagal `build:desktop`.

**Perbaikan:** diubah jadi `/build/*` + `!/build/icon.png` — git tidak masuk ke
direktori yang di-exclude, jadi `!` di dalam `/build` tidak pernah kebaca.
Sekalian ditambah `/dist` dan `/dist-electron`.

---

## 3. YANG BELUM SELESAI — INI TUGASMU

### TUGAS E — Build produksi `.exe` ⚠️ PRIORITAS UTAMA, ADA BLOKER NYATA

Yang **sudah terbukti jalan**:

1. ✅ **Turbopack + `output: "standalone"` menghasilkan `.next/standalone/`.**
   Ini keraguan terbesar di handoff #2 dan sudah terjawab.
   `npm run build:next` sukses, `prepare-standalone.mjs` menyalin
   `.next/static` + `public/`.
2. ✅ **`server.js` mau boot lewat `ELECTRON_RUN_AS_NODE=1`** — Next mencetak
   `▲ Next.js 16.2.11 / ✓ Ready`.

Yang **masih gagal** — inilah pekerjaanmu:

3. ❌ **Standalone server balas HTTP 500 di semua request.**

   Tanpa env sama sekali:
   ```
   Error: @clerk/nextjs: Missing secretKey.
   ```
   Setelah `.env.local` di-inject (dari `%APPDATA%\BridgeMind\.env.local`),
   errornya **berubah**, jadi keys-nya terbaca, tapi muncul:
   ```
   Failed to proxy http://localhost:3998/ Error: socket hang up { code: 'ECONNRESET' }
   ```
   Ini datang dari lapisan **proxy middleware Next 16** (`ƒ Proxy (Middleware)`
   muncul di output `next build`). Dugaan kuat: middleware Clerk di-compile ke
   **edge runtime chunk** dan standalone server mencoba mem-proxy ke worker yang
   mati / tidak pernah hidup saat dijalankan di bawah `ELECTRON_RUN_AS_NODE`.

   **Cara mereproduksi persis:**
   ```bash
   cd .next/standalone
   set -a; . "$APPDATA/BridgeMind/.env.local"; set +a
   ELECTRON_RUN_AS_NODE=1 NODE_ENV=production PORT=3998 HOSTNAME=127.0.0.1 \
     ../../node_modules/.bin/electron server.js
   curl -i http://127.0.0.1:3998/
   ```

   **Arah investigasi, urut dari yang paling murah:**
   - Bandingkan dengan `node server.js` (Node asli, bukan Electron). Kalau
     dengan `node` jalan tapi dengan `ELECTRON_RUN_AS_NODE` gagal → masalahnya
     runtime Electron (kemungkinan worker threads / child process spawn pakai
     `process.execPath` tanpa mewarisi `ELECTRON_RUN_AS_NODE`). Mitigasi:
     set `ELECTRON_RUN_AS_NODE=1` juga di env anak, atau bundel Node terpisah.
   - Cek apakah `middleware.ts` bisa dipaksa ke Node runtime, bukan edge.
     Baca `node_modules/next/dist/docs/` soal middleware runtime di 16.2.
   - Kalau mentok: pertimbangkan mematikan middleware di build desktop dan
     memindahkan `auth.protect()` ke layout/route handler.

4. ❓ **`electron-builder --win` belum pernah dijalankan sama sekali.** Setelah
   (3) beres, jalankan `npm run build:desktop` dan pastikan:
   - `dist/BridgeMind-0.1.0-x64.exe` (NSIS) + portable terbentuk;
   - `app.asar.unpacked/node_modules/node-pty/` ada di hasil build, lengkap
     dengan `conpty.dll` + `OpenConsole.exe`. Kalau PTY jalan di dev tapi mati di
     `.exe`, **ini** penyebabnya (`asarUnpack` sudah diatur, tapi belum diuji).
   - `npmRebuild: false` **jangan diubah** — mesin ini tidak punya MSVC.

### TUGAS F — Auth Clerk via deep link ❌ BELUM DISENTUH

Status sama persis seperti handoff #2 §TUGAS F. Protokol `aingespace://`
terdaftar, `second-instance`/`open-url` ditangkap, diteruskan ke renderer lewat
channel `CH.deepLink` (`"bm:deep-link"`), `openExternal()` tersedia di bridge.
**Belum ada satu pun consumer di renderer** dan pertukaran token Clerk belum
dibuat. Login desktop belum berfungsi; hanya halaman public `/` yang jalan.

---

## 4. CATATAN KECIL YANG PERLU DIKETAHUI

- **Banner ASCII tidak kelihatan di mode desktop.** Ini bukan bug yang belum
  diperbaiki, ini keputusan sadar. ConPTY memiliki seluruh screen buffer dan
  me-repaint dengan absolute cursor positioning setiap attach dan setiap resize,
  jadi apa pun yang digambar di luar model PTY terhapus dalam satu-dua frame.
  Menghapus `ESC[2J`/`ESC[H` pembuka **sudah dicoba dan tidak bertahan** melewati
  repaint resize pertama. Satu-satunya cara benar: shell-nya sendiri yang
  mencetak banner (`powershell -NoLogo -NoExit -Command <banner>`) — ditolak
  karena menukar kemenangan kosmetik dengan risiko quoting di satu-satunya jalur
  kode yang tidak boleh rusak. Alasannya sudah ditulis sebagai komentar di atas
  `writeBanner()`.
- **`node-pty` mencetak `Error: AttachConsole failed`** dari
  `conpty_console_list_agent.js` saat app quit. Ini race jinak: agent mencoba
  attach ke console ConPTY yang sudah mati. Tidak memengaruhi fungsi, tapi bisa
  bikin noise di log produksi.
- `npm audit`: 16 vulnerability (4 moderate, 12 high) di dependency lama. Di luar
  cakupan, belum disentuh.

---

## 5. RISIKO KEAMANAN YANG MASIH TERBUKA (laporkan lagi ke user)

- **`SUPABASE_SERVICE_ROLE_KEY` menembus RLS.** Mitigasi yang ada baru: key tidak
  ikut installer, harus ditaruh manual di `%APPDATA%\BridgeMind\.env.local`
  (`npm run desktop:env`).
- Itu **belum menyelesaikan masalah sebenarnya** — siapa pun yang punya akses ke
  mesin tetap bisa membaca file itu sebagai teks biasa. Kalau `.exe` ini akan
  dibagikan ke orang lain, operasi service-role **wajib** pindah ke server remote
  dan desktop cukup pakai anon key + RLS.

---

## 6. ATURAN KERJA

1. Jangan ubah desain sidebar/pane. Prioritas warna: **live (oranye) > selected
   (hijau `#3ECF8E`) > netral** — `referensi.md` §2.
2. Setelah tiap tugas: `npx tsc --noEmit`, `npx tsc -p tsconfig.electron.json
   --noEmit`, dan `npx eslint <file>`. Harus bersih.
3. Jangan commit/push kecuali diminta.
4. Laporkan apa adanya. Kalau ada yang gagal atau dilewati, sebutkan eksplisit —
   jangan mengklaim sesuatu berhasil kalau belum benar-benar dijalankan.
   Sesi ini memilih untuk membuktikan tiap klaim dengan probe Electron nyata;
   lanjutkan kebiasaan itu.
5. Kesimpulan akhir dalam **Bahasa Indonesia**.
