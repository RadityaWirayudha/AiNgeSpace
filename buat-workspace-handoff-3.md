# Handoff #3 — Dialog "Buat Workspace" (lanjutan dari `buat-workspace-handoff-2.md`)

> **Baca ini dulu, baru `buat-workspace-handoff-2.md`.**
> Handoff #2 masih valid untuk *konteks, keputusan, dan jebakan*. Tapi **§4 "Sisa pekerjaan" di handoff #2 SUDAH DIKERJAKAN SEMUA** — jangan dikerjakan ulang. §10 di bawah adalah catatan eksekusinya.
> `buat-workspace-handoff.md` (yang pertama) sudah dibatalkan lewat banner merah di atasnya. Abaikan.

---

## §0 — Ringkasan sekali baca

Fitur yang diminta user (rename step 2 → "Layout", buang GitHub repo/branch, ganti dengan **working folder** yang bisa diketik `cd <path>`, tambah section **Recent** di atas **Presets** yang statusnya cuma "Coming Soon", ganti label footer) **sudah selesai di lapisan UI + IPC + API + skema database.**

Yang **belum**: `working_dir` yang tersimpan itu **belum dipakai untuk benar-benar menjalankan terminal di folder tersebut**. Ini satu-satunya sisa pekerjaan teknis yang nyata. Detailnya §11.

Sisanya adalah dua hal yang **menunggu keputusan user**, bukan menunggu kode (§12).

**Status verifikasi:** `npm run typecheck` **hijau** (dua tsconfig). ESLint pada 9 file yang disentuh: **1 error, dan itu pre-existing** (dibuktikan lewat `git stash`). Belum ada commit dari sesi ini.

---

## §1 — Perintah user (masih berlaku penuh)

Ulangi apa adanya, jangan ditafsir ulang:

1. Step 2 namanya **"Layout"**, bukan "Repo & Layout".
2. **Buang GitHub repo & branch sepenuhnya.** Ganti dengan **working folder** — path folder lokal di laptop user.
   Referensi gambar #2: label tebal "Working folder", hint redup "Where your terminals will start", satu baris input dengan **ikon folder di kiri** dan **ikon cari/browse di kanan**, lalu baris hint monospace redup: `> cd ../other-project`.
   **User harus bisa mengetik `cd <path>` di field itu.**
3. **"Prasetel" → "Presets"**, dan **belum diimplementasikan — cukup render "Coming Soon".**
4. Tambah section **"Recent"** **di atas Presets**, isinya workspace AiNgeSpace yang terakhir dibuat/dibuka, diurutkan berdasarkan waktu.
   Referensi gambar #3: grid dua kolom, tiap kartu: ikon folder, nama workspace, path redup `~/desktop/...` di bawahnya, angka kecil di kanan. Header `◻ RECENT 5`, kanan "Last opened workspaces".
5. Footer: "Lewati" → **"Buka tanpa AI"**, tombol utama → **"Berikutnya .."**.

### Aturan yang berdiri sejak awal (jangan dilanggar)

- **"jangan terlalu boros atau apapun itu, aku mau database bener-bener terpakai, bukan hanya pajangan doang."**
  → Setiap kolom yang ditambah harus ada yang membaca. Ini alasan §11 penting.
- Penamaan tabel: `<entity>_aingespace`. Migrasi pakai `if exists` supaya tabel lama ditimpa.

---

## §2 — Yang SUDAH selesai

### 2.1 Lapisan data (sudah ter-commit di `a5d3c48`)

| Berkas | Isi |
|---|---|
| `supabase/migrations/002_rewrite_aingespace_schema.sql` | `working_dir text not null` + CHECK `workspaces_aingespace_working_dir_not_blank`. Kolom `github_repo`/`branch` hilang. |
| `src/types/database.ts` | Row/Insert/Update sudah `working_dir`. |
| `src/app/api/workspaces/route.ts` | zod `workingDir: z.string().trim().min(1).max(4096)`; nama workspace dihitung server (`nextWorkspaceName()`, tertinggi+1); satu SELECT untuk nama + sort_order. |
| `src/app/api/workspaces/[id]/route.ts` | `working_dir` optional di PATCH; `isUuid()` guard tetap ada. |
| `src/lib/workspace/paths.ts` | **Baru.** Helper path murni untuk browser (tanpa `node:path`, tanpa filesystem). |

**`src/lib/workspace/paths.ts` — API-nya:**

- `isAbsolutePath(p)` — `~`, `/`, `\`, `C:\`, `\\server\share`.
- `normalizePath(p)` — kolaps `.` dan `..`, aman terhadap root.
- `applyWorkingDirInput(current, input)` — **inti fitur `cd`.** Kalau `input` diawali `cd`, argumennya di-resolve relatif terhadap `current`. Kalau bukan `cd`, dia hanya `normalizePath(input)`.
  **⚠️ Sifat yang dijadikan sandaran: idempoten untuk input non-`cd`.** Dialog memanggilnya di setiap render lewat `useMemo`. Kalau sifat ini dirusak, field working folder akan menulis ulang dirinya sendiri saat user mengetik.
- `folderName(p)` — segmen terakhir.
- `compactPath(p, maxSegments = 3)` — `…\proj\api`.

### 2.2 IPC folder picker (channel enum juga sudah ter-commit di `a5d3c48`)

Tombol browse di gambar #2 **bukan hiasan** — ada IPC beneran di belakangnya:

- `electron/channels.ts` → `chooseDirectory = "bm:dialog:choose-directory"` *(sudah di HEAD, tidak muncul di `git status`)*
- `electron/main.ts` → handler `dialog.showOpenDialog` dengan `properties: ["openDirectory", "createDirectory"]`, di-parent ke `mainWindow` supaya modal ke aplikasi. Return `null` kalau dibatalkan.
- `electron/preload.ts` → `chooseDirectory(defaultPath?)`
- `src/types/desktop.d.ts` → deklarasi di `DesktopBridge`

Di build web tombolnya **tidak dirender sama sekali** (`onBrowse={null}`), bukan di-disable — tidak ada dialog OS untuk dibuka di sana.

### 2.3 Dialog (`src/components/CreateWorkspaceDialog.tsx`)

Semua sesuai §1. Titik-titik yang perlu diketahui agent berikutnya:

| Baris | Hal |
|---|---|
| `52–65` | `WorkspaceDraft` — `repo`/`branch` **hilang**, diganti `workingDir: string`. |
| `76–80` | `STEPS[1].label = "Layout"`. |
| `83` | `RECENT_LIMIT = 6` (genap, karena grid 2 kolom). |
| `129–136` | `PRESETS` tinggal `{id, name, icon, desc}`. Field layout/agen dibuang karena tidak ada yang membacanya. |
| `393–457` | `WorkingFolderStep` — ikon `Folder` kiri, `FolderSearch` kanan, hint `> cd ../other-project`. Enter **tidak** submit step; Enter me-resolve `cd` di tempat. |
| `462–515` | `RecentSection` — return `null` kalau kosong. `title={row.working_dir}` menjaga path penuh tetap terjangkau. |
| `587` | `<RecentSection>` dirender **di atas** blok Presets. ✔ sesuai perintah. |
| `589–624` | Presets: header + badge `Coming Soon`, enam kartu sebagai `<div aria-hidden="true">` (bukan `<button disabled>` — lihat §10.2). |
| `717–722` | `NEVER_CHANGES` / `readDesktop` / `NOT_DESKTOP` — dipakai `useSyncExternalStore` untuk baca `window.bridgemind` secara hydration-safe **tanpa** `useEffect`+`setState`. |
| `734–739` | **Dua state untuk satu field** — baca §5. |
| `825–848` | Effect ambil Recent. `setState` ada di dalam `.then`, meniru `dashboard/page.tsx:65–86`. Gagal fetch = section hilang, **tidak pernah** memblokir pembuatan workspace. |
| `860–870` | `resolvedWorkingDir` (useMemo) + `commitWorkingDir` (Enter/blur saja). |
| `914` | `step2Valid = resolvedWorkingDir.length > 0`. Bentuk path **tidak** divalidasi — hanya mesin yang menjalankan shell yang tahu path itu nyata atau tidak. |
| `918–983` | `handleLaunch(agentOverride?)`. Body POST: `{ workingDir, layoutPreset, agentIds }`. |
| `1089–1109` | **"Buka tanpa AI"** — bukan "lewati". Ini **langsung membuat** workspace dengan nol agen. Kalau working folder kosong, dia lempar balik ke step 2 dengan error, bukan diam-diam gagal. |
| `1119–1125` | Label tombol utama: `Berikutnya: Layout` / `Berikutnya: Agen` / `Membuat…` / `Luncurkan workspace`. |

### 2.4 Konsumen hilir

- `src/features/workspace/BridgeMindLayout.tsx:332` — judul pane pakai `folderName(draft.workingDir)` → `"api · pane 1"`. Path penuh terlalu panjang untuk lebar judul pane.
- `src/app/dashboard/page.tsx` — kartu statistik `GitBranch`/`Boxes` diganti **"Working folders"** = jumlah **folder unik** (`new Set(...)`), bukan jumlah workspace; dua workspace di satu folder itu wajar dan menghitungnya dua kali tidak bermakna. Baris repo+branch di kartu diganti satu `compactPath(ws.working_dir)` dengan `title` path penuh.
- `src/types/index.ts` — `interface Workspace` (yang mendeskripsikan `githubRepo`/`githubBranch`) **dihapus**; sudah dipastikan lewat grep bahwa tidak ada yang meng-import-nya. Diganti komentar penjelas. `GitHubRepo` **sengaja dibiarkan** — fitur koneksi GitHub masih hidup.

---

## §3 — Status Git (per akhir sesi ini)

```
HEAD  a5d3c48  refactor: replace GitHub repo fields with working directory in database schema and types
branch master

 M electron/main.ts
 M electron/preload.ts
 M src/app/dashboard/page.tsx
 M src/components/CreateWorkspaceDialog.tsx
 M src/features/workspace/BridgeMindLayout.tsx
 M src/types/desktop.d.ts
 M src/types/index.ts
```

Sudah ter-commit di `a5d3c48` dan **tidak** muncul sebagai perubahan: `electron/channels.ts`, `src/lib/workspace/paths.ts`, `buat-workspace-handoff-2.md`, seluruh berkas §2.1.

**Belum ada commit dari sesi ini. Jangan commit/push tanpa diminta user.**

---

## §4 — Hasil verifikasi (sudah dijalankan, tinggal dipercaya)

```bash
rm -f .next/dev/types/validator.ts   # WAJIB dulu — lihat §6
npm run typecheck                    # HIJAU: tsc --noEmit + tsc -p tsconfig.electron.json --noEmit
```

ESLint pada 9 berkas yang disentuh → **1 error saja**:

```
src/features/workspace/BridgeMindLayout.tsx
  296:10  error  Calling setState synchronously within an effect can trigger cascading renders
                 react-hooks/set-state-in-effect
```

Sudah dibuktikan **pre-existing** dengan `git stash` → `npx eslint` → error yang sama muncul di tree bersih → `git stash pop`.
**Jangan** "perbaiki" ini sebagai bagian dari pekerjaan working folder. Itu bug lama yang terpisah.

---

## §5 — Jebakan #1: kenapa ada DUA state untuk satu field

Ini bagian paling mudah dirusak. Jangan disederhanakan.

```ts
const [workingDir, setWorkingDir] = useState("")        // path yang sudah diterima
const [workingDirInput, setWorkingDirInput] = useState("") // teks mentah di kotak
const resolvedWorkingDir = useMemo(
  () => applyWorkingDirInput(workingDir, workingDirInput),
  [workingDir, workingDirInput]
)
```

- **Kalau di-resolve tiap ketukan tombol** → begitu user mengetik `"cd "`, field langsung ditulis ulang jadi path saat ini. Tidak bisa dipakai.
- **Kalau di-resolve hanya saat blur** → user mengetik path lalu langsung klik "Berikutnya" (tanpa keluar dari field) akan membaca state basi.
- **Solusinya:** validasi (`step2Valid`) dan submit (`handleLaunch`) membaca `resolvedWorkingDir` — nilai turunan, selalu segar. `commitWorkingDir` (Enter/blur) ada **murni supaya user melihat** `cd ../x` berubah jadi path betulan.

Kebenarannya bersandar pada `applyWorkingDirInput` yang **idempoten untuk input non-`cd`**.

---

## §6 — Jebakan lain yang masih berlaku

1. **`npm run typecheck` gagal karena artefak Next dev server.** `.next/dev/types/validator.ts` kadang terpotong dan melempar `TS1005`/`TS1002`/`TS1128`. Hapus dulu, lalu jalankan. Bukan bug di kode.
2. **ESLint global bukan gate.** `react-hooks/set-state-in-effect` adalah *error* di repo ini dengan ±320 pelanggaran lama. Lint **hanya berkas yang kamu sentuh**.
3. **`electron/channels.ts` adalah `const enum` dengan sengaja.** tsc meng-inline-nya dan menghapus import-nya, karena `require("./channels")` relatif akan melempar di preload ber-sandbox dan membuat `window.bridgemind` diam-diam `undefined`. **Biarkan `isolatedModules` tetap OFF di `tsconfig.electron.json`.**
4. **RLS aktif dengan nol policy — itu disengaja** (deny-all untuk anon/authenticated, service_role menembus). Otorisasi ada di route handler lewat `.eq("clerk_user_id", userId)`. Kalau query dari browser mengembalikan array kosong, **jangan matikan RLS** — pindahkan query-nya ke route handler.
5. **Supabase hanya diakses server-side** lewat `SUPABASE_SERVICE_ROLE_KEY`. `src/lib/supabase/client.ts` (klien anon-key) sudah dihapus dan **tidak boleh dibuat lagi**.
6. **`POST /api/panes` harus `.insert()`, jangan `.upsert()`** — id baris datang dari klien; upsert membuka jalan menimpa baris pane milik orang lain dengan menebak id-nya.
7. **Kolom terenkripsi bersufiks `_encrypted`** supaya tidak ada yang mengiranya token mentah lalu mencatatnya di log. CHECK constraint mengunci format `iv:tag:ciphertext` all-hex dari `src/lib/supabase/encryption.ts`; mengubah format enkripsi berarti harus mengubah constraint itu juga, kalau tidak semua insert gagal.
8. **lucide-react versi ini tidak mengekspor `Github`.** Nama yang sudah diverifikasi ada: `Braces`, `Code`, `Code2`, `CodeXml`, `SquareTerminal`, `PanelsTopLeft`, `GitCommitVertical`, `FolderTree`, `Compass`, `FolderSearch`, `FileSearch`, `Telescope`, `Binoculars`, `Radar`, `History`.
9. **`isUuid()` guard di route `[id]`.** `.eq("id", "local-ws-1")` terhadap kolom uuid membuat Postgres menolak perbandingannya → 500, padahal yang benar 404.
10. **`AGENTS.md` mewajibkan** membaca `node_modules/next/dist/docs/` sebelum menulis kode Next. Versi Next di repo ini bukan yang ada di ingatanmu.

---

## §7 — Yang SENGAJA tidak dikerjakan

- `database_handoff.md` dan `v1.md` masih menyebut `github_repo`. **Biarkan** — itu dokumen spesifikasi/riwayat, bukan kode.
- `GitHubRepo` di `src/types/index.ts` **tidak** disentuh — fitur koneksi GitHub masih ada dan terpisah dari dialog ini.
- Presets **tidak** diimplementasikan. Perintah user memang cuma "render Coming Soon".

---

## §8 — Pertanyaan terbuka untuk user (belum dijawab)

Kartu **Recent** saat ini **mengisi (prefill)** working folder + layout ke draft baru yang sedang dibuat — dia **tidak** membuka workspace lama itu. Alasannya: ini dialog "buat workspace baru"; mengklik kartu lalu tiba-tiba pindah ke workspace lama akan mengejutkan.

Alternatifnya: klik = **langsung membuka** workspace lama tersebut.

**Tanyakan ke user, jangan diputuskan sendiri.** Kalau jawabannya "langsung buka", perubahannya kecil: `pickRecent` di `CreateWorkspaceDialog.tsx:886` diganti jadi memanggil callback yang menutup dialog lalu `router.push(/workspace/${row.id})`.

---

## §9 — Kalau kamu perlu memverifikasi ulang secara manual

1. `npm run electron:dev` (build desktop — tombol browse hanya ada di sini).
2. Dashboard → **New Workspace** → step 1 tekan Berikutnya.
3. Step 2 harus tampil: judul **"Layout"**, field **Working folder** dengan ikon folder + ikon cari, hint `> cd ../other-project`, lalu **Recent** (kalau sudah ada workspace), lalu **Presets** dengan badge **Coming Soon** dan kartu redup yang tidak bisa diklik.
4. Ketik path absolut → Berikutnya harus jalan **tanpa** perlu keluar dari field dulu.
5. Ketik `cd ..` lalu Enter → field harus berubah jadi path induknya.
6. Klik ikon cari → dialog folder OS muncul, pilih folder → field terisi.
7. Klik kartu Recent → working folder + layout terisi, dialog **tetap terbuka**.
8. Footer: tombol kiri **"Buka tanpa AI"**, tombol kanan **"Berikutnya: …"**.
9. Cek baris di Supabase: `working_dir` terisi persis seperti yang di field.

---

## §10 — Catatan eksekusi §4 handoff #2

**§4 handoff #2 dieksekusi seluruhnya.** Dua penyimpangan yang perlu diketahui:

**10.1** Handoff #2 menulis "belum di-commit" untuk beberapa berkas. Kenyataannya `electron/channels.ts`, `src/lib/workspace/paths.ts`, dan seluruh berkas lapisan data **sudah masuk commit `a5d3c48`**. §3 di atas adalah keadaan git yang sebenarnya.

**10.2** Kartu Presets dirender sebagai `<div aria-hidden="true">`, **bukan** `<button disabled>` seperti yang ditulis handoff #2.
Alasannya: pembaca layar yang mengumumkan enam "tombol nonaktif" itu bising, sementara header section-nya sudah mengatakan *Coming Soon*; dan ini menjaga kartu-kartu itu keluar dari focus trap tanpa bergantung pada filter `button:not([disabled])` di `CreateWorkspaceDialog.tsx:795`.

---

## §11 — SISA PEKERJAAN TEKNIS (satu-satunya)

### `working_dir` belum benar-benar menjalankan terminal di folder itu

**Ini yang bikin kolomnya masih setengah "pajangan" — hal yang user larang secara eksplisit. Sebutkan terang-terangan ke user, jangan disembunyikan.**

Yang **sudah** siap:

- `electron/pty-manager.ts` — **sudah** menghormati `cwd`: `const cwd = isDirectory(opts.cwd) ? opts.cwd : this.fallbackCwd`. Path yang tidak ada diabaikan dengan aman.
- `src/types/desktop.d.ts:13` — `TerminalCreateOptions.cwd?: string` sudah ada.
- `src/features/terminal/pty-session.ts:77` — `AcquireOptions.cwd?: string` sudah ada, dan diteruskan ke `bridge.terminal.create` di baris `130–134`.

Yang **putus**:

- `src/features/terminal/terminal-instances.ts:290` — `acquirePtySession(desktop, id, { cols, rows, … })` **tidak pernah mengirim `cwd`**. Rantainya putus tepat di sini.

Rantai yang harus disambung, beserta apa yang sudah dipastikan:

1. `attachInstance(terminalId, el)` — `src/features/terminal/terminal-instances.ts:542`. **Pemanggilnya persis satu**: `src/features/terminal/TerminalPanel.tsx:41`.
2. `ensureInstance` (`terminal-instances.ts:536`) **tidak punya pemanggil sama sekali**.
3. `createInstance` (`terminal-instances.ts:448`) adalah tempat `attachPty` dipanggil — ini titik di mana `cwd` harus sudah diketahui, karena PTY dibuat sekali di sini dan tidak dibuat ulang saat re-attach.
4. **Jangan pakai variabel global "cwd saat ini" di level modul.** Effect mount komponen anak berjalan **sebelum** effect induknya, jadi global itu akan terbaca kosong pada terminal pertama. `cwd` harus dialirkan sebagai **prop eksplisit** turun ke `TerminalPanel`.
5. **`WorkspaceData` di `BridgeMindLayout.tsx:52–61` belum punya field `workingDir`.** Yang tersedia hanya `draft.workingDir` di `handleWorkspaceCreated` (baris 332) — itu jalur *workspace baru dibuat*. Untuk workspace yang **dibuka kembali**, `working_dir` harus dibaca dari baris database (`fetchWorkspaces()` sudah mengembalikannya sebagai `WorkspaceRow.working_dir`) dan disimpan ke `WorkspaceData`.

Jadi ini **refactor lintas berkas yang nyata**, bukan satu baris. Perkiraan berkas yang tersentuh: `BridgeMindLayout.tsx` → `PaneTerminalManager.tsx` → `TerminalPanel.tsx` → `terminal-instances.ts`.

**Tanyakan dulu ke user sebelum mengerjakannya** — ini di luar permintaan UI yang literal, meskipun jelas sejalan dengan aturan "database harus benar-benar terpakai".

---

## §12 — Menunggu keputusan user (bukan menunggu kode)

**12.1 — Tahap A: menjalankan migrasi `002`.**
Migrasi ini **destruktif**: dia men-drop `aingespace_github_connections` (berisi token OAuth terenkripsi) dan `aingespace_environment_variables`.
**User harus mengonfirmasi sebelum dijalankan.** Kalau datanya harus selamat, perlu blok `insert … select` sebelum drop, dan perhatikan kolom yang berganti nama: `access_token` → `access_token_encrypted`, `value` → `value_encrypted`.

**12.2 — Tahap G: keputusan `user_prefs_aingespace`.** Belum dijawab user.

---

## §13 — Aturan kerja

- **Jangan commit atau push kecuali user memintanya.**
- Jangan tambah tugas di luar yang tertulis di sini.
- Kalau menemukan sesuatu yang salah dengan permintaan user, **katakan sekali dalam satu-dua kalimat, lalu tetap kerjakan** permintaan lengkapnya.
- Laporkan apa adanya. Kalau ada yang gagal atau dilewati, sebutkan.
