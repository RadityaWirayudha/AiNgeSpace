# Prompt Handoff #2 — Selesaikan Desktop App BridgeMind (.exe)

> Lanjutan dari `DESKTOP_HANDOFF.md`. **Jangan** ulangi audit yang ada di sana —
> semua fakta di dokumen ini sudah diverifikasi langsung di mesin, bukan asumsi.
> Copy seluruh isi file ini sebagai prompt untuk agent berikutnya.

---

## 0. BACA DULU

1. `AGENTS.md` — Next.js 16.2.11 di proyek ini punya breaking changes. Baca
   `node_modules/next/dist/docs/` sebelum menulis kode Next.
2. `referensi.md` — single source of truth desain. **Jangan sentuh UI sidebar/pane.**
3. `DESKTOP_HANDOFF.md` — tujuan & keputusan arsitektur asli (Electron, bukan Tauri;
   `next start`/standalone, bukan `output: "export"`).

---

## 1. STATUS SAAT INI (sudah dikerjakan agent sebelumnya)

### Temuan mesin yang menentukan arsitektur

| Fakta | Konsekuensi |
|---|---|
| **Tidak ada Visual Studio / MSVC** di mesin ini (`C:\Program Files\Microsoft Visual Studio` tidak ada) | Native module **tidak bisa** di-compile. `@electron/rebuild` / `node-gyp` akan gagal. |
| `node-pty@1.1.0` ternyata **ship prebuilt binaries** di `node_modules/node-pty/prebuilds/win32-x64/` | Install berhasil tanpa compile. |
| Prebuilt itu **N-API** (`napi_register_module_v1` terverifikasi di `pty.node` dan `conpty.node`) | ABI-stable → **jalan di Electron tanpa rebuild**. Karena itu `npmRebuild: false` di `electron-builder.yml`. **Jangan diubah.** |
| Test langsung di Node 20: `pty.spawn('powershell.exe', …)` → `EXIT 0`, output ConPTY normal | node-pty sehat di mesin ini. |
| `middleware.ts`: `/` adalah **public route** | UI utama tampil tanpa login. Bagus untuk uji tampilan desktop. |
| Electron `43.2.0`, electron-builder `26.15.3` terpasang | — |

### File yang sudah dibuat / diubah

```
next.config.ts              (diubah) + output: "standalone"
package.json                (diubah) + main, + script desktop
tsconfig.json               (diubah) exclude: electron, dist-electron, dist
tsconfig.electron.json      (baru)   build CommonJS -> dist-electron/
electron-builder.yml        (baru)   NSIS + portable, asarUnpack node-pty
src/types/desktop.d.ts      (baru)   kontrak window.bridgemind
electron/channels.ts        (baru)   nama channel IPC
electron/env.ts             (baru)   loader .env.local dari userData
electron/next-server.ts     (baru)   spawn .next/standalone/server.js
electron/pty-manager.ts     (baru)   map id -> IPty, guard & limit
electron/preload.ts         (baru)   contextBridge, API sempit
electron/main.ts            (baru)   window, IPC, lifecycle
scripts/dev-desktop.mjs     (baru)   next dev + tsc + electron
scripts/prepare-standalone.mjs (baru) copy public/ & .next/static
scripts/install-env.mjs     (baru)   copy .env.local -> %APPDATA%\BridgeMind
```

### Script npm yang tersedia

```
npm run dev:desktop      # next dev + electron (dev)
npm run build:next       # next build + prepare-standalone
npm run build:electron   # tsc -p tsconfig.electron.json
npm run build:desktop    # build:next + build:electron + electron-builder --win
npm run desktop:env      # salin .env.local ke %APPDATA%\BridgeMind
npm run typecheck        # tsc app + tsc electron
```

### Desain yang sudah diputuskan (ikuti, jangan diperdebatkan)

- **Kunci PTY = `terminalId`, bukan `paneId`.** Handoff #1 menulis "satu PTY per
  paneId", tapi `pane-terminal-store.tsx` mendukung **split** — satu pane bisa
  punya banyak leaf, masing-masing dengan `terminalId` unik, dan `TerminalPanel`
  memang di-mount per `terminalId`. Memakai `paneId` akan membuat terminal hasil
  split berbagi satu shell (salah).
- **Secret tidak ikut di-bundle.** `electron/env.ts` mencari `.env.local` di
  (1) `%APPDATA%\BridgeMind\.env.local`, (2) repo root (hanya saat dev),
  (3) `resources/.env.local`. `electron-builder.yml` mem-filter `!.env*`.
- **Produksi menjalankan `.next/standalone/server.js`** sebagai child process
  lewat `process.execPath` + `ELECTRON_RUN_AS_NODE=1` di port loopback acak.
- Security window: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `backgroundColor: "#0e0e10"`, navigasi keluar-host dibuang ke
  browser eksternal.

---

## 2. YANG BELUM SELESAI — INI TUGASMU

Diurutkan berdasarkan dampak. **Kerjakan berurutan.**

### TUGAS A — Sambungkan `TerminalPanel.tsx` ke PTY  ⚠️ BLOKER UTAMA

`src/features/terminal/TerminalPanel.tsx` **masih shell tiruan**. Fungsi `run()`
di dalamnya masih mencetak `"…: not connected to a shell yet"`. Seluruh lapisan
Electron sudah siap tapi belum ada satu pun pemanggilnya.

Yang harus dilakukan di `TerminalPanel.tsx`:

1. Deteksi mode: `const desktop = typeof window !== "undefined" ? window.bridgemind : undefined`.
2. **Jika `desktop` ada** (mode Electron):
   - Setelah `term.open(container)` dan `safeFit()` pertama, panggil
     `await desktop.terminal.create(terminalId, { cols: term.cols, rows: term.rows })`.
   - Jika `result.ok === false`, tulis pesan errornya ke `term` dengan warna
     `\x1b[38;2;224;129;60m` (oranye live) — jangan diam saja.
   - `term.onData((d) => desktop.terminal.write(terminalId, d))` —
     **hapus seluruh parser lokal** (history, backspace, `run()`, prompt manual).
     PTY yang mengurus semuanya, termasuk arrow key dan Ctrl+C.
   - `desktop.terminal.onData(terminalId, (d) => term.write(d))`.
   - `desktop.terminal.onExit(terminalId, ({ exitCode }) => …)` — tampilkan
     `[process exited with code N]` dengan warna dim.
   - Di dalam `safeFit()`, setelah `fitAddon.fit()`, panggil
     `desktop.terminal.resize(terminalId, term.cols, term.rows)`.
   - Cleanup effect: unsubscribe `onData`/`onExit` **dan** `desktop.terminal.kill(terminalId)`.
3. **Jika `desktop` tidak ada** (browser / `npm run dev`): **pertahankan shell
   tiruan yang sekarang apa adanya**, supaya versi web tetap tampil normal.
   Cara paling bersih: pisahkan menjadi dua fungsi, `attachPty(term)` dan
   `attachMockShell(term)`, dipilih di satu tempat.
4. BANNER ASCII di awal file tetap ditulis di kedua mode.
5. Jangan ubah `theme`, `fontFamily`, className, atau layout apa pun.

**Definition of done:** `npm run dev:desktop` → ketik `dir` dan `git status` di
sebuah pane → output asli mesin muncul. Split pane → dua shell independen.

---

### TUGAS B — Buat `build/icon.png`

`electron-builder.yml` menunjuk ke `build/icon.png` yang **belum ada**, jadi
`build:desktop` akan gagal.

- Syarat electron-builder: PNG **persegi**, minimal 256×256 (pakai 512×512).
- Aset yang tersedia: `public/favicon.png` dan
  `gambar/Gemini_Generated_Image_5tr7f25tr7f25tr7.png` — keduanya file yang sama,
  **1100×960 (tidak persegi)**, jadi tidak bisa dipakai langsung.
- Pilihan: (a) crop/pad jadi persegi lalu resize ke 512×512, atau (b) generate
  ikon baru bergaya brand — background `#0E0E10`, chevron `❯` oranye `#E0813C`,
  aksen hijau `#3ECF8E` (lihat `referensi.md` §2).
- Alternatif kalau mentok: sediakan `build/icon.ico` asli, lalu ubah
  `win.icon` di `electron-builder.yml`.

---

### TUGAS C — Verifikasi statis (WAJIB, belum pernah dijalankan sama sekali)

```bash
npx tsc --noEmit                              # app
npx tsc -p tsconfig.electron.json --noEmit    # electron
npx eslint electron scripts src/features/terminal/TerminalPanel.tsx
```

Hal yang **kemungkinan besar** akan muncul — sudah diprediksi, cek satu per satu:

1. `electron/pty-manager.ts` memakai `require("node-pty")` dengan komentar
   `// eslint-disable-next-line @typescript-eslint/no-require-imports`.
   Kalau rule itu tidak aktif di `eslint.config.mjs`, ESLint bisa protes
   *unused disable directive*. Hapus komentarnya kalau begitu.
   (Alasan pakai `require`: modul native tidak boleh ikut ter-hoist ke preload.)
2. `eslint.config.mjs` mungkin belum meng-cover folder `electron/` dan `scripts/`
   (file `.mjs` Node murni). Tambahkan override, jangan matikan lint-nya.
3. `src/types/desktop.d.ts` memakai `declare global` + `export` — pastikan
   `window.bridgemind` benar-benar terlihat dari `TerminalPanel.tsx`.

---

### TUGAS D — Uji dev

```bash
npm run dev:desktop
```

Cek: window sendiri, **tanpa address bar**, tanpa flash putih, UI BridgeMind
tampil identik dengan versi browser, sidebar tidak berubah.

Kalau window kosong: lihat stdout `[bridgemind]` di terminal, buka DevTools
dengan menambahkan `mainWindow.webContents.openDevTools()` sementara di
`electron/main.ts`.

---

### TUGAS E — Uji build produksi

```bash
npm run desktop:env      # sekali saja, taruh kredensial di %APPDATA%\BridgeMind
npm run build:desktop
```

Titik gagal yang **belum pernah diuji** dan harus dipastikan:

1. **`next build` + Turbopack + `output: "standalone"`** — pastikan folder
   `.next/standalone/` benar-benar terbentuk. Kalau Turbopack build tidak
   menghasilkan standalone, jalankan build tanpa Turbopack atau ganti strategi
   ke bundling `node_modules` penuh (lebih besar, tapi pasti jalan).
2. **`.next/standalone/server.js` dijalankan lewat `ELECTRON_RUN_AS_NODE=1`** —
   verifikasi manual dulu:
   `set ELECTRON_RUN_AS_NODE=1 && npx electron .next/standalone/server.js`
   dengan `PORT=3999`, lalu buka `http://127.0.0.1:3999`.
3. **node-pty di dalam asar** — pastikan `app.asar.unpacked/node_modules/node-pty/`
   ada di hasil build, dan `conpty.dll` + `OpenConsole.exe` ikut. Kalau PTY jalan
   di dev tapi mati di `.exe`, ini penyebabnya.
4. Output: `dist/BridgeMind-0.1.0-x64.exe` (NSIS) + portable.

**Definition of done:** installer terpasang, aplikasi terbuka, UI tampil, dan
`git status` di pane mengeluarkan output asli.

---

### TUGAS F — Auth Clerk via deep link (Langkah 3 handoff #1, belum dikerjakan)

Yang **sudah** ada: protokol `aingespace://` didaftarkan di `main.ts`,
`second-instance`/`open-url` ditangkap, URL diteruskan ke renderer lewat
channel `bm:deep-link`, dan `openExternal()` tersedia di bridge.

Yang **belum** ada: tidak ada satu pun consumer `bm:deep-link` di renderer, dan
pertukaran token Clerk sama sekali belum dibuat. Login di desktop saat ini
belum berfungsi — hanya halaman public `/` yang bisa dipakai.

Rancang: tombol sign-in → `openExternal` ke halaman Clerk → callback
`aingespace://callback?…` → main forward → renderer tukar jadi sesi.

---

## 3. RISIKO KEAMANAN YANG BELUM DISELESAIKAN (laporkan lagi ke user)

- **`SUPABASE_SERVICE_ROLE_KEY` menembus RLS.** Mitigasi yang sudah dipasang
  hanyalah: key tidak ikut ke dalam installer, harus ditaruh manual di
  `%APPDATA%\BridgeMind\.env.local`.
- Itu **belum menyelesaikan masalah sebenarnya**: siapa pun yang punya akses ke
  mesin tetap bisa membaca file itu sebagai teks biasa. Kalau `.exe` ini akan
  dibagikan ke orang lain, operasi service-role **wajib** dipindah ke server
  remote dan desktop cukup memakai anon key + RLS.
- `npm audit` melaporkan 16 vulnerability (4 moderate, 12 high) di dependency
  yang sudah ada sebelumnya — di luar cakupan pekerjaan ini, belum disentuh.

---

## 4. ATURAN KERJA

1. Jangan ubah desain sidebar/pane. Prioritas warna: **live (oranye) > selected
   (hijau `#3ECF8E`) > netral** — `referensi.md` §2.
2. Setelah tiap tugas: `npx tsc --noEmit` + `npx eslint <file>`. Harus bersih.
3. Jangan commit/push kecuali diminta.
4. Laporkan apa adanya. Kalau ada yang gagal atau dilewati, sebutkan eksplisit —
   jangan mengklaim sesuatu berhasil kalau belum benar-benar dijalankan.
5. Kesimpulan akhir dalam **Bahasa Indonesia**.
