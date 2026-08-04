# Handoff 6 — Preset PurpVoice: 4 terminal + buka langsung dari step 2

Lanjutan dari `buat-workspace-handoff-5.md`. File ini hanya membahas permintaan terakhir
user dan sisa pekerjaan dari handoff 5. **Tidak ada tugas baru di luar itu.**

**Status singkat: pekerjaan berhenti di tengah. `npx tsc -p tsconfig.json --noEmit` GAGAL
dengan 2 error, keduanya di satu tempat yang sama.** §3.1 adalah hal pertama yang harus
dikerjakan; §3.2 adalah bagian dari permintaan user yang belum dikerjakan sama sekali.

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

**Catatan penting yang belum tuntas** → lihat §3.2. Dengan 4 terminal dan 1 agen, aturan
pembagian command yang ada sekarang hanya menjalankan Opencode di **terminal pertama**.

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

## 3. Yang BELUM dikerjakan

### 3.1 Call site `LayoutStep` belum diperbarui (build merah)

```
$ npx tsc -p tsconfig.json --noEmit
src/components/CreateWorkspaceDialog.tsx(1580,17): error TS2322: Property 'activePresetId'
  does not exist on type 'IntrinsicAttributes & { ... }'.
src/components/CreateWorkspaceDialog.tsx(1580,33): error TS2304: Cannot find name
  'activePresetId'.
```

Props komponennya sudah diganti (§2.3) tapi pemanggilnya belum. Di baris ~1574:

```tsx
<LayoutStep
  layoutId={layoutId}
  setLayoutId={setLayoutId}
  recent={recent}
  recentStatus={recentStatus}
  onPickRecent={pickRecent}
  activePresetId={activePresetId}   // ← hapus
  onApplyPreset={applyPreset}       // ← hapus
/>
```

harus jadi:

```tsx
  pendingPresetId={pendingPresetId}
  onLaunchPreset={launchPreset}
```

Itu satu-satunya perubahan yang dibutuhkan untuk membuat build hijau lagi. `useMemo`
masih terpakai 2× di file ini setelah `activePresetId` dihapus, jadi import-nya **tidak**
perlu disentuh.

### 3.2 Aturan pembagian command untuk 4 terminal — belum diputuskan, belum diubah

Ini bagian (A) yang belum tuntas, dan menurut saya bagian yang paling perlu dikonfirmasi
ke user.

Keadaan sekarang di `src/features/terminal/shell-launch.tsx`, fungsi `claim()`: command
dibagikan **satu agen per terminal, urut mount** (untuk tree pane baru = kiri ke kanan).
Terminal yang lebih banyak dari agen tidak menjalankan apa pun. Jadi dengan preset
PurpVoice yang sekarang (`l4` = 4 terminal, 1 agen), hasilnya adalah **1 terminal
menjalankan Opencode dan 3 terminal sisanya shell polos.**

Kalimat user — "ngebuka 4 terminal, plus pake agent opencode" — paling masuk akal dibaca
sebagai **keempat terminal menjalankan Opencode**. Kalau itu yang dimaksud, ubah baris
pemilihan command di dalam `claim()` menjadi round-robin:

```js
const launch = { cwd, startupCommand: commands[taken % commands.length] ?? null }
```

(dengan `commands.length === 0` tetap menghasilkan `null` — jaga guard-nya.) Aturan
umumnya jadi: 1 agen + 4 terminal = 4× agen itu; 2 agen + 4 terminal = a, b, a, b;
4 agen + 2 terminal = a, b saja.

Konsekuensi yang harus disampaikan ke user sebelum diputuskan: itu berarti **4 sesi
opencode berjalan sekaligus** di folder yang sama, masing-masing memakai token sendiri.
`started` (§2.1) tetap menjamin tiap terminal hanya menjalankan command sekali, jadi tidak
ada duplikasi di dalam satu shell — tapi tetap 4 proses.

Jangan diputuskan sendiri; ini soal biaya, bukan soal teknis.

### 3.3 Lint dan verifikasi manual

Setelah §3.1 (dan §3.2 kalau user setuju):

```
npx tsc -p tsconfig.json --noEmit
npx eslint src/components/CreateWorkspaceDialog.tsx src/features/terminal/shell-launch.tsx
```

**Lint global bukan gate di repo ini** — ada ~320 pelanggaran
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
4. `opencode --dangerously-skip-permissions` terketik sendiri (di terminal mana saja,
   sesuai keputusan §3.2) dan opencode jalan tanpa menanyakan izin.
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
