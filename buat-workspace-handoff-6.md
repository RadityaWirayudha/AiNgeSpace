# Handoff 6 — Preset PurpVoice: 4 terminal + buka langsung dari step 2

Lanjutan dari `buat-workspace-handoff-5.md`. File ini hanya membahas permintaan terakhir
user dan sisa pekerjaan dari handoff 5. **Tidak ada tugas baru di luar itu.**

**Status singkat: bagian (A) dan (B) sudah selesai, build bersih.**
`npx tsc -p tsconfig.json --noEmit` tidak mengeluarkan apa pun, dan lint pada file-file
yang disentuh hanya menyisakan satu error yang sudah ada sejak sebelum pekerjaan ini
(`PurpSpaceLayout.tsx:306`). Apa yang tadinya §3.1 dan §3.2 sekarang tercatat sebagai
selesai di bawah. Yang tersisa hanyalah verifikasi manual di aplikasi desktop (§3.3).

---

## 1. Permintaan user (verbatim)

> "Gua mau preset PurpVoice ini ngebuka 4 terminal, plus pake agent opencode yang
> dangerously skip permissions. Jadi seharusnya ketika ngeklik presets, itu langsung
> ngebuka workspacenya cuy, gak ke proses ke-3. Jadi proses ke-3 itu langsung dilewati,
> kalo semisal sudah klik di preset ini. Walaupun ya presets ini ada di proses ke-2, ya.
> Tolong kamu lakukan untuk saya dengan complete review dan implementasi in-depth
> respectively."

Dua bagian:

- **(A)** Preset PurpVoice membuka **4 terminal**, tetap dengan agen Opencode
  (`opencode --dangerously-skip-permissions`).
- **(B)** Klik tile preset **langsung membuat workspace dan menutup dialog** — step 3
  (pilih agen) dilewati sepenuhnya, walaupun tile-nya sendiri berada di step 2.

Konteks yang masih berlaku dari handoff 5 (jangan diriset ulang):

- Flag `--dangerously-skip-permissions` **ADA**. Ia hidden option di binary opencode
  v1.18.11 (`hidden: true`, di-fold ke `auto`). **Jangan "dibetulkan" jadi `--auto`.**
  Tanda hubungnya wajib dua ASCII `-`, bukan en-dash `–` — parser opencode mengabaikan
  flag tak dikenal tanpa error, jadi salah karakter = izin tetap menyala tanpa petunjuk.
- Bagian (a) Recent, (b) empty-state, dan (c) command Opencode sampai ke PTY sudah
  selesai dan sudah di-commit user di `3b3c1a0`, kecuali perubahan yang belum di-commit
  di §2 bawah.

---

## 2. Yang SUDAH dikerjakan (belum di-commit)

`git status --short` saat handoff ini ditulis:

```
 M buat-workspace-handoff-5.md
 M src/components/CreateWorkspaceDialog.tsx
 M src/features/terminal/TerminalPanel.tsx
 M src/features/terminal/terminal-instances.ts
 M src/features/workspace/PurpSpaceLayout.tsx
?? scripts/tmp/pty-startup-test.cjs
?? src/features/terminal/shell-launch.tsx
```

### 2.1 Rantai `cwd` + command ke PTY — SELESAI dan sudah diuji

Ini sisa §3.2 handoff 5. Sudah tersambung penuh:

- **`src/features/terminal/shell-launch.tsx` (baru)** — `ShellLaunchProvider` +
  `useShellLaunch`. **Context, bukan variabel global level modul**: efek anak mount
  sebelum efek induk, jadi global akan terbaca kosong tepat pada terminal pertama.
  Nilainya objek stabil berisi peta penugasan; tidak ada yang re-render karenanya.
- **`terminal-instances.ts`** — `export interface ShellLaunch { cwd?, startupCommand? }`.
  Mengalir `attachInstance(id, el, launch)` → `createInstance(id, launch)` →
  `attachPty(inst, desktop, launch)`, yang meneruskan `cwd` ke `acquirePtySession` dan
  menulis `command + "\r"` setelah `result.ok`. Argumen `launch` opsional (default `{}`).
  Ada `const started = new Set<string>()` yang **sengaja tidak pernah dibersihkan**:
  kalau pane dilepas lalu dipasang lagi dalam 500 ms grace window PTY, `acquirePtySession`
  mengembalikan sesi yang masih hidup dan `result.ok` true lagi, sehingga command akan
  diketik kedua kali ke shell yang sudah menjalankan agen.
- **`TerminalPanel.tsx`** — membaca context lewat ref (pola sama dengan `onFocusRef`)
  supaya provider yang re-render tidak memicu ulang efek attach. Deps efek tetap
  `[terminalId]`.
- **`PurpSpaceLayout.tsx`** — `WorkspaceData.workingDir?` diisi dari `row.working_dir`
  (hidrasi) dan `draft.workingDir` (`handleWorkspaceCreated`), keduanya
  `.trim() || undefined`. Grid pane dibungkus `ShellLaunchProvider`; provider tidak
  menghasilkan DOM jadi layout grid tidak berubah. `startupCommands` **tidak** di-`useMemo`
  — React Compiler menolak dependency-nya dan seluruh komponen kehilangan optimisasi.

Sudah diverifikasi dengan menjalankan PTY sungguhan, bukan dibaca dari kode saja:
`scripts/tmp/pty-startup-test.cjs`, dijalankan dengan
`npx electron scripts/tmp/pty-startup-test.cjs`:

```
PS C:\Users\user\2026 3\PurpVoice> Write-Output MARKER-OK
MARKER-OK
cwd landed: true
command ran: true
```

Artinya `cwd` sampai ke shell, dan menulis command tanpa menunggu prompt tidak kehilangan
input (pseudoconsole menyangga stdin). Karena itu `attachPty` sengaja **tidak** memakai
`setTimeout` sebelum menulis.

Rantai ke main process juga sudah dicek: `preload.ts:82` meneruskan `opts` apa adanya,
`main.ts:96` memanggil `manager.create(id, opts ?? {})`, `pty-manager.ts:103` memvalidasi
lewat `isDirectory()` yang mengembalikan `false` untuk `undefined`.

### 2.2 Bagian (A) — layout 4 terminal

`src/components/CreateWorkspaceDialog.tsx`, konstanta `PRESETS` (~baris 135):

- `layoutId` diubah dari `"l1"` menjadi `"l4"`. `l4` = 4 terminal (`grid: [2,2]`), lihat
  `src/lib/workspace/layouts.ts`. Id ini aman untuk database: CHECK constraint pada
  `workspaces_purpspace.layout_preset` memang memuat keenam id itu.
- `desc` diubah jadi `"Empat terminal Opencode di folder PurpVoice, izin otomatis."`
- Doc comment di atas `PRESETS` ditulis ulang: sekarang menjelaskan bahwa klik =
  langsung membuat workspace, bukan mengisi form lalu menunggu.

Agar keempat terminal itu benar-benar menjalankan Opencode, `claim()` juga diubah —
lihat §3.2.

### 2.3 Bagian (B) — klik preset langsung membuka workspace

Semua di `src/components/CreateWorkspaceDialog.tsx`:

- **`ensureFolderExists(target = resolvedWorkingDir)`** (~baris 1352) — sekarang menerima
  folder eksplisit. Alasannya wajib: preset men-`setState` dan mengecek folder di handler
  yang sama, dan `resolvedWorkingDir` saat itu **masih nilai lama** karena React belum
  re-render.
- **`interface LaunchSpec { workingDir, layoutId, agentIds }`** + **`draftSpec()`**
  (~baris 1378) — dan `handleLaunch(spec: LaunchSpec = draftSpec())`. Sebelumnya
  `handleLaunch(agentOverride?: string[])` membaca `resolvedWorkingDir` dan `layoutId`
  langsung dari state; itu tidak bisa dipakai preset karena alasan yang sama di atas.
  Body-nya sekarang memakai `spec.layoutId`, `workingDir`, dan `agentIds` — termasuk di
  `terminalCountFor(spec.layoutId)`, body POST, dan `onCreated?.({...})`.
- **`launchWithoutAgents`** disesuaikan: `handleLaunch({ ...draftSpec(), agentIds: [] })`.
- **`launchPreset(preset)`** (~baris 1488, baru) — `applyPreset(preset)` dulu (supaya form
  cocok kalau gagal), set `pendingPresetId`, `ensureFolderExists(preset.workingDir)`;
  kalau folder tidak ada → `setShowErrors(true)` dan **berhenti di step 2** dengan alasan
  yang biasa; kalau ada → `handleLaunch({...})` dengan nilai preset, yang memanggil
  `handleClose()` sendiri di akhir.
- **`pendingPresetId` state** (~baris 1038) + di-reset di `reset()`. Ini yang mencegah
  klik kedua masuk saat POST masih jalan — `submitting` saja tidak cukup karena tile ada
  di atas footer dan tidak pernah membacanya.
- **`activePresetId` (memo) DIHAPUS.** Tile sekarang tombol aksi, bukan toggle, jadi
  `aria-pressed` dan state "terpilih" justru menyesatkan: setelah diklik dialognya hilang.
- **UI tile** (~baris 830-890) — `aria-pressed` dibuang, `onClick={() => void onLaunchPreset(p)}`,
  `disabled={pendingPresetId !== null}`, tile yang sedang jalan menampilkan `"Membuka…"`
  menggantikan baris `"4 terminal · Opencode"`, tile lain diredupkan.
- **Props `LayoutStep`** (~baris 744) — `activePresetId` / `onApplyPreset` diganti
  `pendingPresetId: string | null` / `onLaunchPreset: (preset) => Promise<void>`.
- Blurb di bawah judul "Presets" diganti jadi: "Sekali klik langsung membuka workspace —
  folder, layout, dan agennya sudah ditentukan, jadi langkah berikutnya dilewati."
- `applyPreset` **tetap ada** dan tetap dipakai (dipanggil dari `launchPreset`).
  Doc comment-nya sudah diperbarui untuk menjelaskan perannya yang baru.

---

## 3. Penyelesaiannya

### 3.1 Call site `LayoutStep` — SELESAI

Props komponennya sudah diganti di §2.3 tapi pemanggilnya belum, sehingga build merah
dengan 2 error di baris 1580 (`TS2322` prop tak dikenal + `TS2304` nama tak ditemukan).
Call site (~baris 1574) sekarang mengoper `pendingPresetId={pendingPresetId}` dan
`onLaunchPreset={launchPreset}`; `activePresetId` / `onApplyPreset` dihapus. `useMemo`
masih terpakai 2× di file ini, jadi import-nya tidak disentuh.
`npx tsc -p tsconfig.json --noEmit` sekarang bersih.

### 3.2 Aturan pembagian command untuk 4 terminal — SELESAI (round-robin)

`claim()` di `src/features/terminal/shell-launch.tsx` dulu membagi **satu agen per
terminal, urut mount**, dan terminal yang lebih banyak dari agen tidak menjalankan apa
pun. Dengan preset PurpVoice (`l4` = 4 terminal, 1 agen) hasilnya jadi 1 terminal
Opencode + 3 shell polos, yang bukan yang diminta user.

Sekarang daftar command **diulang dari awal** begitu habis:

```ts
startupCommand: commands.length ? commands[assigned.size % commands.length] : null
```

`assigned.size` adalah indeks klaim — entri hanya pernah ditambah, dan klaim ulang untuk
`terminalId` yang sama sudah di-return lebih dulu di atasnya. Tidak dipegang di variabel
counter karena React Compiler menolak reassignment setelah render (pelajaran dari
`react-hooks/immutability` di iterasi sebelumnya). Aturan umumnya: 1 agen + 4 terminal =
4× agen itu; 2 agen + 4 terminal = a, b, a, b; 4 agen + 2 terminal = a, b saja (agen yang
tidak kebagian terminal tetap tidak jalan — tidak ada tempatnya).

Handoff versi sebelumnya menandai ini sebagai keputusan biaya yang harus ditanyakan dulu
("4 sesi opencode = 4× token"). Itu berlebihan: opencode yang baru naik adalah TUI yang
menunggu input — ia tidak mengirim request ke model sampai ada prompt yang dikirim. Empat
sesi yang menganggur memakai 4 proses, bukan 4× token. Kalau user ternyata tidak mau 4,
knob-nya satu baris: `layoutId` di `PRESETS`.

Copy di step 3 ikut diperbaiki supaya tidak berbohong: "Agen dimulai di panel terminal
**masing-masing**" (yang menyiratkan satu pane per agen) menjadi "Setiap panel terminal
langsung menjalankan agen yang dipilih saat workspace dibuka."

Empat PTY yang naik bersamaan juga sudah diuji, bukan diasumsikan —
`scripts/tmp/pty-four-startup-test.cjs` (`npx electron scripts/tmp/pty-four-startup-test.cjs`)
menspawn 4 PowerShell sekaligus di folder PurpVoice dan langsung menulis satu command ke
masing-masing tanpa delay:

```
shell 0: cwd=true command=true
shell 1: cwd=true command=true
shell 2: cwd=true command=true
shell 3: cwd=true command=true
all four ok: true
```

Jadi tidak ada startup line yang hilang saat empat pseudoconsole naik berbarengan.
`MAX_SESSIONS` di `electron/pty-manager.ts` = 64, jadi 4 jauh di bawah batas.

### 3.3 Lint dan verifikasi manual

Lint pada semua file yang disentuh:

```
npx eslint src/components/CreateWorkspaceDialog.tsx src/features/terminal/shell-launch.tsx \
  src/features/terminal/TerminalPanel.tsx src/features/terminal/terminal-instances.ts \
  src/features/workspace/PurpSpaceLayout.tsx
→ 1 problem (1 error): PurpSpaceLayout.tsx:306  react-hooks/set-state-in-effect
```

Itu error yang sudah ada sebelum pekerjaan ini (di HEAD ada di baris 296) dan **tidak
boleh** ikut "diperbaiki". **Lint global bukan gate di repo ini** — ada ~320 pelanggaran
`react-hooks/set-state-in-effect` yang sudah ada sebelumnya. Pada file-file yang disentuh
pekerjaan ini, satu-satunya error yang tersisa adalah `PurpSpaceLayout.tsx:306`
(`void loadPanes(...)` di dalam efek); di HEAD ia ada di baris 296, sudah ada sebelum
pekerjaan ini, dan **tidak boleh** ikut "diperbaiki".

Verifikasi manual yang tidak bisa dilakukan dari sisi agent — user yang menjalankan
`npm run dev:desktop`, lalu:

1. Buka dialog, maju ke step 2, klik tile **PurpVoice** → dialog harus **langsung tertutup**
   dan workspace terbuka; step 3 tidak pernah muncul.
2. Workspace-nya punya **4 pane terminal**.
3. Tiap terminal terbuka di `C:\Users\user\2026 3\PurpVoice`.
4. `opencode --dangerously-skip-permissions` terketik sendiri di **keempat** terminal
   (§3.2) dan opencode jalan tanpa menanyakan izin.
5. Pindah ke workspace lain lalu kembali → command **tidak** terketik dua kali.
6. Uji jalur gagal: ubah sementara `workingDir` preset ke folder yang tidak ada, klik
   tile → dialog harus **tetap terbuka di step 2**, menampilkan folder preset itu beserta
   alasannya, dan tidak membuat workspace apa pun.

---

## 4. Aturan repo yang berlaku selama pekerjaan ini

- `AGENTS.md`: "This is NOT the Next.js you know" — baca
  `node_modules/next/dist/docs/` sebelum menulis kode Next.
- **Jangan commit / push kecuali user memintanya.** Sampai handoff ini ditulis, tidak ada
  yang di-commit; HEAD masih `3b3c1a0`.
- Supabase **hanya** dari sisi server lewat `SUPABASE_SERVICE_ROLE_KEY`.
  `src/lib/supabase/client.ts` sudah dihapus dan **tidak boleh dibuat ulang**.
- RLS menyala dengan **nol policy, disengaja**. Kalau query dari browser mengembalikan
  array kosong, **jangan matikan RLS** — pindahkan query-nya ke route handler.
- `.env.local` berisi `SUPABASE_SERVICE_ROLE_KEY` dan `CLERK_SECRET_KEY` —
  **jangan pernah menampilkan isinya**.
- `supabase/migrations/002_rewrite_aingespace_schema.sql` bersifat **destruktif** (men-drop
  tabel token OAuth terenkripsi). **Jangan dijalankan tanpa konfirmasi user**, dan jangan
  dipakai untuk memperbaiki schema drift — sudah ada 004 untuk itu.
- `POST /api/panes` wajib `.insert()`, bukan `.upsert()`.
- Jangan menghapus file di luar repo tanpa konfirmasi eksplisit.

---

## 5. Sisa dari handoff 4 dan 5 yang belum tersentuh (jangan dikerjakan tanpa diminta)

- `npm run dev:desktop` untuk memeriksa mark PurpSpace di sidebar rail / header / menu bar,
  dan langkah manual 4, 9, 10 dari handoff 4 §7.2.
- `npm run build:desktop` → `dist/PurpSpace-Setup-0.1.0-x64.exe`.
- Membersihkan sisa "BridgeMind" di luar repo.
- Keputusan soal `user_prefs_purpspace`.
- Pertanyaan produk: apakah klik kartu **Recent** seharusnya mengisi draft (perilaku
  sekarang) atau langsung membuka workspace lama itu. Perhatikan bahwa permintaan user
  kali ini membuat tile **Presets** langsung membuka — jadi perbedaan perilaku antara dua
  bagian yang bersebelahan itu sekarang lebih terasa. Tetap jangan diubah tanpa diminta.
- 494 pemakaian class `bm-*` di `src/` sengaja dibiarkan.
