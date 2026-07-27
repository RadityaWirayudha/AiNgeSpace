# Prompt Handoff — Jadikan AiNgeSpace Aplikasi Desktop (.exe)

> Copy seluruh isi di bawah ini sebagai prompt untuk agent berikutnya.

---

## KONTEKS PROYEK

Proyek: **AiNgeSpace / BridgeMind** di `C:\Users\user\2026 3\AiNgeSpace` (git, branch `master`).
Ini adalah *multi-pane AI agent workspace* bergaya terminal-native (lihat `referensi.md`
sebagai single source of truth untuk desain — WAJIB dibaca sebelum menyentuh UI).

**PENTING:** Baca `AGENTS.md` lebih dulu. Versi Next.js di proyek ini punya breaking
changes dari pengetahuan umum — baca dokumen di `node_modules/next/dist/docs/` sebelum
menulis kode Next.

### Stack saat ini (sudah diverifikasi, bukan asumsi)

- **Next.js 16.2.11** (App Router + Turbopack), React 19.2.4, TypeScript, Tailwind v4.
- **Clerk** untuk auth — `middleware.ts`, hanya `/` yang public, sisanya `auth.protect()`.
- **Supabase** untuk data (tabel `aingespace_terminals`, `aingespace_workspaces`, dll).
- **xterm.js** (`@xterm/xterm`) untuk tampilan terminal di tiap pane.
- API routes: `/api/ai`, `/api/env`, `/api/github`, `/api/terminals`, `/api/workspaces`.
- Entry UI: `src/app/page.tsx` → `src/features/workspace/BridgeMindLayout.tsx`.
- Terminal state: `src/features/terminal/pane-terminal-store.tsx` +
  `src/features/terminal/PaneTerminalManager.tsx` (satu manager per `paneId`).

### Fakta kritis hasil audit (jangan diulang, sudah dicek dengan grep)

1. **Belum ada proses shell asli.** Tidak ada `node-pty`, tidak ada `child_process`/`spawn`,
   tidak ada WebSocket di seluruh `src/`. `src/app/api/terminals/route.ts` isinya hanya
   CRUD metadata ke Supabase. Jadi terminal sekarang masih "kulit" saja.
2. Ini alasan utama proyek harus jadi desktop app: browser tidak boleh spawn proses,
   akses filesystem bebas, atau PTY.
3. `.env.local` berisi `SUPABASE_SERVICE_ROLE_KEY` dan `CLERK_SECRET_KEY`.

---

## TUJUAN

Ubah proyek ini menjadi **aplikasi desktop Windows dengan installer `.exe`**, dan buat
terminal di tiap pane **benar-benar hidup** (shell asli, bukan mock).

---

## KEPUTUSAN ARSITEKTUR YANG SUDAH DIAMBIL (ikuti, jangan diperdebatkan ulang)

- **Pakai Electron**, bukan Tauri. Alasan: `node-pty` + `@xterm/*` adalah kombinasi
  standar (VS Code memakai ini persis), Node.js penuh di main process, paling matang
  di Windows.
- **Renderer memuat `next start` di localhost port acak**, BUKAN `output: "export"`.
  Static export akan mematikan seluruh `/api/*`, padahal Clerk + Supabase server-side
  ada di situ.
- **Satu PTY per `paneId`**, disambungkan ke `pane-terminal-store.tsx` yang sudah ada.

---

## URUTAN KERJA

### Langkah 1 — Shell Electron minimal
- Tambah `electron/main.ts` + `electron/preload.ts`.
- Main process menjalankan `next start` di port acak, tunggu sampai siap, lalu
  `loadURL` ke port itu. Saat dev, boleh `loadURL('http://localhost:3000')`.
- Window: frameless/native sesuai selera, background `#0E0E10` (token `--bg-app`)
  supaya tidak ada flash putih saat start.
- Security wajib: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true` bila memungkinkan.
- Script npm baru: `dev:desktop`, `build:desktop`.
- **Definition of done:** app terbuka di window sendiri, UI BridgeMind tampil normal,
  tidak ada address bar.

### Langkah 2 — PTY asli (langkah paling berdampak)
- Tambah `node-pty`. Di Windows gunakan ConPTY (default `node-pty` modern).
- Main process: map `paneId -> IPty`. Spawn PowerShell (`powershell.exe`) sebagai default
  shell di Windows, dengan `cwd` = folder repo workspace bila ada.
- IPC lewat `contextBridge` di preload — **jangan** ekspor `spawn` mentah ke renderer.
  Ekspor API sempit saja:
  `terminal.create(paneId, opts)`, `terminal.write(paneId, data)`,
  `terminal.resize(paneId, cols, rows)`, `terminal.onData(paneId, cb)`,
  `terminal.kill(paneId)`.
- Sambungkan ke `PaneTerminalManager.tsx`: `xterm.onData` → `terminal.write`,
  `terminal.onData` → `xterm.write`, `FitAddon` → `terminal.resize`.
- Pane ditutup / app quit → PTY wajib di-kill (jangan sampai proses yatim).
- **Definition of done:** user bisa mengetik `dir`/`git status` di pane dan melihat
  output asli dari mesinnya.

### Langkah 3 — Keamanan secret & auth desktop
- ⚠️ **Isu nyata:** `SUPABASE_SERVICE_ROLE_KEY` menembus RLS. File `.asar` bisa dibongkar
  siapa saja. Kalau `.exe` ini akan dibagikan ke orang lain, service-role key TIDAK BOLEH
  ikut ter-bundle — pindahkan operasi service-role ke server remote, dan desktop cukup
  pakai anon key + RLS. Kalau hanya dipakai sendiri di mesin pemilik, boleh ditunda,
  tapi laporkan risikonya secara eksplisit.
- Clerk di desktop: login lewat **browser eksternal + deep link** (`aingespace://callback`),
  bukan iframe di dalam app.

### Langkah 4 — Packaging `.exe`
- `electron-builder`, target **NSIS** (installer) + `portable` bila perlu.
- `asarUnpack` untuk native module `node-pty` (kalau tidak, PTY gagal di build produksi —
  ini kesalahan paling umum).
- Sertakan app icon, product name "BridgeMind", dan versi.
- **Definition of done:** `npm run build:desktop` menghasilkan `.exe` installer di `dist/`,
  diinstal di Windows, dibuka, terminal jalan.

---

## ATURAN KERJA

1. Jangan mengubah desain sidebar/pane yang sudah ada kecuali diminta. Sidebar baru saja
   selesai di-redesign (tile identitas workspace, count pill, selection hijau `#3ECF8E`,
   tombol × persisten di baris aktif). Aturan warnanya ada di `referensi.md` §2 —
   prioritas: **live (oranye) > selected (hijau) > netral**.
2. Setelah tiap langkah: jalankan `npx tsc --noEmit` dan `npx eslint <file>`. Harus bersih.
3. Jangan commit/push kecuali diminta.
4. Laporkan apa adanya. Kalau ada langkah yang gagal atau dilewati, sebutkan dengan jelas.
5. Beri kesimpulan akhir dalam **Bahasa Indonesia**.
