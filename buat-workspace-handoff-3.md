# Handoff #3 — Dialog "Buat Workspace" (lanjutan dari `buat-workspace-handoff-2.md`)

> 🔴 **SUDAH DIGANTIKAN OLEH `buat-workspace-handoff-4.md`. Baca yang itu dulu.**
> Berkas ini disimpan sebagai arsip alasan detail (terutama §13 dan §15). Nomor baris di sini masih akurat, tapi daftar sisa pekerjaan sudah dirapikan ulang di handoff #4.

> **Baca ini dulu, baru `buat-workspace-handoff-2.md`.**
> Handoff #2 masih valid untuk *konteks, keputusan, dan jebakan*. Tapi **§4 "Sisa pekerjaan" di handoff #2 SUDAH DIKERJAKAN SEMUA** — jangan dikerjakan ulang. §10 di bawah adalah catatan eksekusinya.
> `buat-workspace-handoff.md` (yang pertama) sudah dibatalkan lewat banner merah di atasnya. Abaikan.

---

## §0 — Ringkasan sekali baca

Fitur yang diminta user (rename step 2 → "Layout", buang GitHub repo/branch, ganti dengan **working folder** — kotak pemilih folder + baris prompt `cd` di bawahnya, tambah section **Recent** di atas **Presets** yang statusnya cuma "Coming Soon", ganti label footer) **sudah selesai di lapisan UI + IPC + API + skema database**, termasuk **koreksi #1** (§13) dan **koreksi #2** (§15).

Yang **belum**: `working_dir` yang tersimpan itu **belum dipakai untuk benar-benar menjalankan terminal di folder tersebut**. Ini satu-satunya sisa pekerjaan teknis yang nyata. Detailnya §11.

Sisanya adalah dua hal yang **menunggu keputusan user**, bukan menunggu kode (§12).

**Status verifikasi:** `npm run typecheck` **hijau** (dua tsconfig). ESLint pada berkas yang disentuh: **bersih**, kecuali 1 error di `BridgeMindLayout.tsx:296` yang **pre-existing** (dibuktikan lewat `git stash`, §4). Keadaan git di §3.

---

## §1 — Perintah user (masih berlaku penuh)

Ulangi apa adanya, jangan ditafsir ulang:

1. Step 2 namanya **"Layout"**, bukan "Repo & Layout".
2. **Buang GitHub repo & branch sepenuhnya.** Ganti dengan **working folder** — path folder lokal di laptop user.
   Referensi gambar #2: label tebal "Working folder", hint redup "Where your terminals will start", satu baris kotak dengan **ikon folder di kiri** dan **ikon cari/browse di kanan**, lalu baris monospace redup: `> cd ../other-project`.

   **⚠️ Dikoreksi user (koreksi #1, lihat §13) — ini yang berlaku sekarang:**
   - **Kotak path (`C:\Users\nama\projects\app`) TIDAK BISA DIKETIK.** Kotak itu murni pemilih folder: **seluruh kotaknya** adalah tombol yang membuka file explorer OS, bukan cuma ikon cari di ujung kanannya. Ikon carinya sendiri sudah benar, biarkan.
   - **Yang bisa diketik justru baris `> cd ../other-project`.** Di situlah user mengetik `cd ...`.

   **⚠️ Dikoreksi user lagi (koreksi #2, lihat §15) — juga berlaku sekarang:**
   - Working folder **otomatis mulai di home directory asli** user (`C:\Users\<nama>`), dan isi kotaknya **harus persis seperti di file explorer**.
   - **`cd` harus cocok dengan yang benar-benar ada di file explorer.** Kalau foldernya tidak ada, **user harus diberi informasi yang mengarahkan** — bukan sekadar ditolak.
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
- `joinPath(base, segment)` — turun satu langkah bernama. Dipakai chip di panel panduan (§15.2), dan `applyWorkingDirInput` memakainya di ekor.
- `applyWorkingDirInput(current, input)` — **inti fitur `cd`.** Kalau `input` diawali `cd`, argumennya di-resolve relatif terhadap `current`. Kalau bukan `cd`, dia hanya `normalizePath(input)`.
  **⚠️ Dua sifat yang dijadikan sandaran:** (a) idempoten untuk input non-`cd`, dan (b) `applyWorkingDirInput(dir, "")` mengembalikan **string kosong**, bukan `dir`. Dialog memanggilnya di setiap render lewat `useMemo`, dengan penjaga untuk (b). Baca §5 sebelum menyentuh fungsi ini.
- `folderName(p)` — segmen terakhir.
- `compactPath(p, maxSegments = 3)` — `…\proj\api`.

### 2.2 IPC folder picker (channel enum juga sudah ter-commit di `a5d3c48`)

Tombol browse di gambar #2 **bukan hiasan** — ada IPC beneran di belakangnya. Sejak koreksi §13, **seluruh kotak** working folder yang memicunya, bukan cuma ikonnya:

- `electron/channels.ts` → `chooseDirectory = "bm:dialog:choose-directory"` *(sudah di HEAD, tidak muncul di `git status`)*
- `electron/main.ts` → handler `dialog.showOpenDialog` dengan `properties: ["openDirectory", "createDirectory"]`, di-parent ke `mainWindow` supaya modal ke aplikasi. Return `null` kalau dibatalkan.
- `electron/preload.ts` → `chooseDirectory(defaultPath?)`
- `src/types/desktop.d.ts` → deklarasi di `DesktopBridge`

Di build web kotaknya turun jadi `<div>` biasa dan ikon carinya **tidak dirender sama sekali** (`onBrowse={null}`), bukan di-disable — tidak ada dialog OS untuk dibuka di sana. Prompt `>` tetap jalan, jadi web tetap bisa dipakai.

### 2.3 Dialog (`src/components/CreateWorkspaceDialog.tsx`)

Semua sesuai §1. Titik-titik yang perlu diketahui agent berikutnya (nomor baris per akhir sesi koreksi #2):

| Baris | Hal |
|---|---|
| `52–65` | `WorkspaceDraft` — `repo`/`branch` **hilang**, diganti `workingDir: string`. |
| `76–80` | `STEPS[1].label = "Layout"`. |
| `84` | `RECENT_LIMIT = 6` (genap, karena grid 2 kolom). |
| `130–137` | `PRESETS` tinggal `{id, name, icon, desc}`. Field layout/agen dibuang karena tidak ada yang membacanya. |
| `397` | `WORKING_DIR_EXAMPLE` — **hanya dilihat build web.** Di desktop kotaknya sudah terisi home directory sejak render pertama. |
| `404–414` | `FOLDER_PROBLEM` — tiga kalimat untuk `missing` / `not-directory` / `denied`. |
| `419–493` | `FolderGuidance` — panel amber: alasan, `nearest`, daftar `children` sebagai chip yang bisa diklik, plus tautan buka file explorer. |
| `495–619` | `WorkingFolderStep` — **kotak = tombol pemilih folder (tidak bisa diketik), baris `>` = input.** Baca §13. |
| `621–674` | `RecentSection` — return `null` kalau kosong. `title={row.working_dir}` menjaga path penuh tetap terjangkau. |
| `746` | `<RecentSection>` dirender **di atas** blok Presets. ✔ sesuai perintah. |
| `748–783` | Presets: header + badge `Coming Soon`, enam kartu sebagai `<div aria-hidden="true">` (bukan `<button disabled>` — lihat §10.2). |
| `876–890` | `NEVER_CHANGES` / `readDesktop` / `NOT_DESKTOP` / **`readHomeDir`** / `NO_HOME` / `PROBE_DELAY_MS` — `useSyncExternalStore` baca `window.bridgemind` hydration-safe **tanpa** `useEffect`+`setState`. |
| `907–932` | `pickedDir` + `dirCommand` + `probe`, lalu `workingDir = pickedDir \|\| homeDir` (turunan, bukan state). Baca §5 dan §15. |
| `1011–1034` | Effect ambil Recent. `setState` ada di dalam `.then`, meniru `dashboard/page.tsx:65–86`. Gagal fetch = section hilang, **tidak pernah** memblokir pembuatan workspace. |
| `1049–1070` | `resolvedWorkingDir` (useMemo) + `runDirCommand` (Enter/blur). |
| `1093–1126` | **Effect probe** — debounce 250 ms, skip di web, adopsi ejaan kanonis dari OS. Baca §15.2. |
| `1128–1130` | `currentProbe` — probe hanya dipakai kalau `probe.path === resolvedWorkingDir`. `null` berarti "belum tahu", **tidak pernah** berarti "aman". |
| `1174` | `step2Valid = resolvedWorkingDir.length > 0` — sekarang hanya cek "sudah diisi", bukan lagi satu-satunya gerbang. |
| `1180–1218` | `folderProblem` + **`ensureFolderExists()`** — gerbang asinkron yang dilewati kedua tombol footer. |
| `1222–1287` | `handleLaunch(agentOverride?)`. Body POST: `{ workingDir, layoutPreset, agentIds }`. |
| `1289–1307` | `goNext()` dan `launchWithoutAgents()` — keduanya `async`, keduanya lewat `ensureFolderExists()`. |
| `1406–1424` | **"Buka tanpa AI"** — bukan "lewati". Ini **langsung membuat** workspace dengan nol agen, setelah foldernya diverifikasi. |
| `1433–1440` | Label tombol utama: `Berikutnya: Layout` / `Berikutnya: Agen` / `Membuat…` / `Luncurkan workspace`. |

### 2.4 Konsumen hilir

- `src/features/workspace/BridgeMindLayout.tsx:332` — judul pane pakai `folderName(draft.workingDir)` → `"api · pane 1"`. Path penuh terlalu panjang untuk lebar judul pane.
- `src/app/dashboard/page.tsx` — kartu statistik `GitBranch`/`Boxes` diganti **"Working folders"** = jumlah **folder unik** (`new Set(...)`), bukan jumlah workspace; dua workspace di satu folder itu wajar dan menghitungnya dua kali tidak bermakna. Baris repo+branch di kartu diganti satu `compactPath(ws.working_dir)` dengan `title` path penuh.
- `src/types/index.ts` — `interface Workspace` (yang mendeskripsikan `githubRepo`/`githubBranch`) **dihapus**; sudah dipastikan lewat grep bahwa tidak ada yang meng-import-nya. Diganti komentar penjelas. `GitHubRepo` **sengaja dibiarkan** — fitur koneksi GitHub masih hidup.

---

## §3 — Status Git (per akhir sesi ini)

```
HEAD  e3f9727  refactor: replace GitHub repo/branch with working directory in workspace creation flow
branch master

 M buat-workspace-handoff-3.md
 M electron/channels.ts
 M electron/main.ts
 M electron/preload.ts
 M src/components/CreateWorkspaceDialog.tsx
 M src/lib/workspace/paths.ts
 M src/types/desktop.d.ts
?? electron/fs-probe.ts
```

Dua commit yang relevan, keduanya dibuat **user**, bukan agent:

- `a5d3c48` — lapisan data (§2.1) + `electron/channels.ts` + `src/lib/workspace/paths.ts`.
- `e3f9727` — dialog, dashboard, `BridgeMindLayout`, IPC picker (`electron/main.ts`, `preload.ts`, `desktop.d.ts`), `src/types/index.ts`.

Yang belum ter-commit di atas adalah **koreksi #1 (§13)** dan **koreksi #2 (§15)**. `electron/fs-probe.ts` berkas **baru** — jangan lupa `git add` kalau user minta di-commit.

**Jangan commit/push tanpa diminta user.**

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

## §5 — Jebakan #1: kenapa ada DUA state (dan kenapa `workingDir` BUKAN state)

Ini bagian paling mudah dirusak. Jangan disederhanakan jadi satu state.

```ts
const [pickedDir, setPickedDir] = useState("")     // folder yang user PILIH — kosong = masih default
const [dirCommand, setDirCommand] = useState("")   // baris yang sedang diketik di PROMPT

const workingDir = pickedDir || homeDir            // isi KOTAK — TURUNAN, bukan state
const resolvedWorkingDir = useMemo(
  () => (dirCommand.trim() ? applyWorkingDirInput(workingDir, dirCommand) : workingDir),
  [workingDir, dirCommand]
)
```

Dua state itu memang dua benda berbeda di layar (kotak vs prompt), jadi ini bukan duplikasi.

- **Kenapa `resolvedWorkingDir` diturunkan, bukan cuma dibaca dari `workingDir`?**
  Supaya user bisa mengetik `cd ../x` lalu **langsung klik "Berikutnya"** tanpa menekan Enter. Klik itu tidak perlu balapan dengan blur yang harus lewat state React dulu.
- **⚠️ Kenapa ada `dirCommand.trim() ? … : workingDir`?**
  `applyWorkingDirInput(dir, "")` mengembalikan **string kosong** — regex `cd` tidak cocok, lalu `normalizePath("")` = `""`. Kalau penjaga ini dihapus, folder yang sudah dipilih akan terhapus setiap kali prompt kosong, yaitu **hampir selalu**. Ini akan lolos typecheck dan lolos lint.
- **⚠️ Kenapa `workingDir` turunan, bukan `useState(homeDir)`?** *(koreksi #2, §15.2)*
  Karena `homeDir` datang dari `useSyncExternalStore` dan bernilai `""` di server/web — `useState(homeDir)` akan membekukan nilai server dan bikin hydration beda. Sebagai turunan, `reset()` cukup `setPickedDir("")` dan kotaknya balik ke home dengan sendirinya.
- `runDirCommand` (Enter + blur) menjalankan baris lalu **mengosongkannya**, seperti shell sungguhan: kotak di atas adalah outputnya. Validasi dan submit tidak pernah bergantung pada dia sudah dijalankan.

Kebenarannya bersandar pada `applyWorkingDirInput` yang **idempoten untuk input non-`cd`**.

State ketiga, `probe`, sengaja **tidak** digabung ke sini: dia jawaban dari disk, bukan niat user, dan dia disimpan bersama path yang ditanyakan supaya jawaban basi tidak pernah dianggap berlaku. Baca §15.2.

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
3. Step 2 harus tampil: judul **"Layout"**, kotak **Working folder** dengan ikon folder + ikon cari, baris prompt `> cd ../other-project`, lalu **Recent** (kalau sudah ada workspace), lalu **Presets** dengan badge **Coming Soon** dan kartu redup yang tidak bisa diklik.
4. **Kotaknya harus sudah terisi `C:\Users\<nama>` sejak awal** — persis seperti yang di file explorer, tanpa berkedip dari kosong. *(koreksi #2)*
5. **Klik di tengah kotak path, jauh dari ikon cari** → file explorer OS harus terbuka. Mengetik di kotak itu harus **tidak terjadi apa-apa**.
6. Di baris `>`: ketik `cd C:\Windows` lalu Enter → kotak berubah, baris `>` kosong lagi.
7. Lanjut ketik `cd ..` lalu Enter → kotak jadi `C:\`. Ketik `cd ..` sekali lagi → tetap `C:\`, tidak jatuh ke luar root.
8. Ketik `cd ../x` lalu **langsung klik "Berikutnya"** tanpa Enter → harus tetap terpakai.
9. **Ketik `cd folder-yang-tidak-ada` lalu Enter** → panel amber muncul: alasan, "Yang benar-benar ada sampai sini: …", lalu chip nama folder yang bisa diklik. Klik salah satu chip → kotak pindah ke sana dan panelnya hilang. **"Berikutnya" harus menolak** selama panel itu masih ada. *(koreksi #2)*
10. **Ketik `cd DOCUMENTS` (huruf besar) atau `cd C:/Users`** → setelah kotak menerima, ejaannya harus berubah jadi ejaan asli OS. Pastikan **berhenti** di situ, tidak menggeser terus-menerus. *(koreksi #2)*
11. Klik kartu Recent → working folder + layout terisi, dialog **tetap terbuka**.
12. Footer: tombol kiri **"Buka tanpa AI"**, tombol kanan **"Berikutnya: …"**.
13. Cek baris di Supabase: `working_dir` terisi persis seperti yang di kotak.

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

## §13 — Koreksi #1: kotak jadi pemilih, prompt jadi input (SUDAH DIKERJAKAN)

User mengoreksi rancangan step 2. Sebelumnya kotak path bisa diketik dan baris `> cd ../other-project` cuma teks mati. **Itu terbalik.** Yang benar:

| | Sebelum (salah) | Sesudah (benar) |
|---|---|---|
| Kotak `C:\Users\nama\projects\app` | `<input>` bisa diketik, tombol browse hanya di ikon ujung kanan | **`<button>` selebar kotak.** Tidak bisa diketik sama sekali. **Klik di mana pun dalam kotak** membuka file explorer OS, bukan cuma ikonnya. |
| Baris `> cd ../other-project` | `<p>` teks mati | **`<input>`.** Satu-satunya bagian yang bisa diketik di step ini. Perilakunya seperti prompt shell. |

Ikon `FolderSearch` di ujung kanan **dipertahankan** — user bilang itu sudah benar. Sekarang dia jadi penanda fungsi kotak, bukan target klik satu-satunya (`group-hover:text-foreground` supaya jelas dia ikut hidup saat kotak di-hover).

**Perilaku prompt:** Enter **dan** blur menjalankan baris lalu mengosongkannya. Enter **tidak** memajukan wizard — orang yang terbiasa dengan shell akan menekan Enter terus-menerus, dan wizard yang melompat karenanya adalah jebakan.

**Build web:** kotaknya jadi `<div>` biasa, bukan `<button>`, dan ikon carinya **tidak dirender**. Tidak ada picker OS di web, jadi tidak ada kontrol yang berpura-pura bisa diklik. Prompt `>` tetap berfungsi, dan `applyWorkingDirInput` menerima path telanjang (bukan hanya `cd`), jadi web tetap bisa dipakai.

**Berkas yang berubah:** `src/components/CreateWorkspaceDialog.tsx` (`WORKING_DIR_EXAMPLE`, `WorkingFolderStep`, state `dirCommand`, `resolvedWorkingDir`, `runDirCommand`, `browseForFolder`, `pickRecent`, `reset`) dan komentar doc `applyWorkingDirInput` di `src/lib/workspace/paths.ts`. **Logika `paths.ts` tidak diubah** — kontraknya masih pas.

**Verifikasi:** `npm run typecheck` hijau (dua tsconfig), `npx eslint` pada kedua berkas bersih.

**Satu catatan jujur, bukan tugas:** kalau kotak masih kosong lalu user mengetik `cd ../x` di prompt, hasilnya path relatif (`../x`) dan itu akan tersimpan apa adanya. `electron/pty-manager.ts` akan menolaknya lewat `isDirectory()` dan jatuh ke folder default. Tidak ditambahkan validasi "harus absolut" karena user tidak memintanya, dan §2.3 sudah memutuskan bentuk path tidak divalidasi di klien. Kalau user mau ini dijaga, tempatnya `step2Valid` — pakai `isAbsolutePath` yang sudah ada di `paths.ts:20`.
> **Catatan ini sudah kedaluwarsa untuk build desktop.** Koreksi #2 (§15) memasang probe filesystem sungguhan, jadi path relatif/tidak-ada **ditolak sebelum workspace dibuat**, lengkap dengan panduan. Di build web catatan ini masih berlaku apa adanya — tidak ada filesystem untuk ditanya di sana.

---

## §15 — Koreksi #2: home directory asli + `cd` yang dicek ke disk (SUDAH DIKERJAKAN)

Perintah user, apa adanya:

> "Gua nyoba tadi working foldernya. Itu seharusnya direktori otomatis ke, `users/user` harus bener-bener sesuai sama file explorer. Dan untuk `cd` pun harus sesuai yang emang sudah ada di file explorer, kalau memang tidak ada, tolong berikan informasi kepada pengguna yang bisa mengarahkan sesuatu agar pengguna mengerti."

Tiga hal: **(a)** default ke home directory asli, **(b)** ejaan kotak harus sama persis dengan file explorer, **(c)** `cd` ke folder yang tidak ada harus **menjelaskan dan mengarahkan**, bukan sekadar gagal.

### 15.1 Lapisan Electron (baru)

| Berkas | Isi |
|---|---|
| `electron/channels.ts` | `probeDirectory = "bm:fs:probe-directory"`. |
| `electron/fs-probe.ts` | **Berkas baru.** `probeDirectory(input)` → `DirectoryProbe`. Ekspansi `~`, path relatif di-resolve ke `homedir()` (bukan cwd main process — cwd itu tergantung dari mana app diluncurkan dan tidak berarti apa-apa bagi user), `stat`, lalu kalau gagal: **jalan naik** lewat `dirname` sampai ketemu folder yang ada (`nearestExisting`) dan baca isinya (`childFolders`, maks 8, hanya folder, tanpa dotfolder, urut `localeCompare`). `EACCES`/`EPERM` → `"denied"`, sisanya `"missing"`. **Read-only**: tidak membuat, memindah, atau membaca isi berkas. |
| `electron/main.ts` | `process.env.BM_HOME_DIR = app.getPath("home")` di dalam `boot()` **sebelum** `createWindow()` — renderer mewarisi environment saat di-spawn dan tidak pernah melihat perubahan sesudahnya. Plus `ipcMain.handle(CH.probeDirectory, …)`. |
| `electron/preload.ts` | `homeDir: process.env.BM_HOME_DIR ?? ""` dan `probeDirectory(path)`. |
| `src/types/desktop.d.ts` | `DirectoryProblem` (`"missing" \| "not-directory" \| "denied"`), `DirectoryProbe` (`path`, `ok`, `reason`, `nearest`, `children`, `more`), `readonly homeDir: string`, `probeDirectory(path)`. |

**Kenapa env var, bukan IPC?** Supaya kotaknya sudah terisi di **render pertama**. Kalau lewat IPC asinkron, hasilnya harus masuk lewat `useEffect` + `setState` — persis pola yang jadi *error* di repo ini (`react-hooks/set-state-in-effect`). Rutenya sama dengan `BM_APP_VERSION` dan `BM_OS_BUILD` yang sudah ada, dan alasannya sama: preload jalan dengan `sandbox: true`, jadi `os` tidak bisa di-`require` dari sana.

### 15.2 Lapisan renderer

- **Default home.** `homeDir` dibaca lewat `useSyncExternalStore(NEVER_CHANGES, readHomeDir, NO_HOME)`. State-nya sekarang `pickedDir` (kosong = "masih default"), dan yang dirender adalah **turunan**: `const workingDir = pickedDir || homeDir`.
  **Ini penting:** karena turunan, `reset()` cukup `setPickedDir("")` dan kotaknya balik ke home dengan sendirinya. Jangan diubah jadi `useState(homeDir)` — di web `homeDir` itu `""` dan hydration akan berbeda dari server.
- **Ejaan kanonis.** Kalau probe balik `ok` tapi `result.path !== target` (mis. `~/projects`, atau `C:/Users/user` dengan garis miring), `pickedDir` di-set ke `result.path`. Kotak jadi sama persis dengan file explorer. Konvergen setelah satu probe tambahan karena probe berikutnya `result.path === target`.
  **⚠️ Adopsi ini hanya dilakukan saat `settled` (prompt kosong).** Kalau di-adopsi sementara masih ada `cd` menggantung, `cd` itu akan diterapkan **dua kali** pada render berikutnya (`C:\Users\user\Documents\Documents`, dan seterusnya — menggeser terus). Ini jebakan nyata; jangan hapus penjaganya.
- **Probe debounce.** Effect `PROBE_DELAY_MS = 250` pada `resolvedWorkingDir`, dilewati kalau bukan step 2 / bukan desktop. `setProbe` ada **di dalam `.then`**, bukan di badan effect — sama alasannya dengan effect Recent.
- **`currentProbe`** hanya dipakai kalau `probe.path === resolvedWorkingDir`. `null` = "belum tahu", **bukan** "aman". Tidak ada yang lolos karena `null`.
- **Panel panduan (`FolderGuidance`).** Muncul kalau probe bilang tidak ok **dan** prompt sudah `settled` (atau user sudah tertahan tombol). Isinya: kalimat alasan (`FOLDER_PROBLEM`), `nearest` ("Yang benar-benar ada sampai sini: …"), lalu isi folder itu sebagai **chip yang bisa diklik** — klik = `cd` ke sana lewat `joinPath`. Kalau `more`, ditulis "…dan lainnya" supaya delapan nama tidak terbaca sebagai "cuma segitu". Ada juga tautan buka file explorer.
  Alasan menunggu `settled`: kalau tidak, panel berkedip di tiap huruf saat user mengetik `cd Doc`.
- **Gerbang `ensureFolderExists()`.** Dilewati **kedua** tombol footer (`goNext` dan `launchWithoutAgents`, keduanya kini `async`). Pakai probe yang sudah ada kalau path-nya persis sama, kalau tidak dia bertanya langsung — klik tidak boleh bergantung pada timer debounce sudah menyala atau belum. Di **web** (`!bridge`) selalu `true`: tidak ada filesystem untuk dinilai di sana, dan menolak path yang tidak bisa dilihat sisi ini sama saja memblokir pembuatan workspace. Kalau probe-nya sendiri **melempar**, hasilnya juga `true` — menghukum user karena checker kita rusak itu salah.
- **`checking`** state terpisah dari `submitting`: belum ada yang dibuat, dia hanya mencegah klik kedua memulai workspace kedua di belakang pemeriksaan yang pertama.
- `src/lib/workspace/paths.ts` dapat ekspor baru **`joinPath(base, segment)`**; `applyWorkingDirInput` sekarang memakainya di ekor (perilakunya tidak berubah, termasuk dua sifat di §2.1/§5).

### 15.3 Yang **tidak** dikerjakan di koreksi #2

- Tidak ada autocomplete di prompt. Chip di panel panduan sudah menjawab kebutuhan yang sama tanpa menambah state.
- Tidak ada pembuatan folder dari dialog. `dialog.showOpenDialog` sudah punya `createDirectory` di picker OS-nya.
- Probe tidak dijalankan di step 1 atau step 3 — tidak ada yang bisa berubah di sana.

**Verifikasi:** `rm -f .next/dev/types/validator.ts && npm run typecheck` → **hijau** (dua tsconfig). `npx eslint` pada `CreateWorkspaceDialog.tsx`, `paths.ts`, `electron/{preload,main,fs-probe,channels}.ts`, `src/types/desktop.d.ts` → **bersih, nol temuan**.

**Belum diverifikasi manual:** panel panduan belum pernah dilihat berjalan di aplikasi Electron yang hidup — perlu `npm run dev:desktop`, buka dialog, ketik `cd folder-yang-tidak-ada`, tekan Enter. Langkah manual lengkapnya di §9.

---

## §14 — Aturan kerja

- **Jangan commit atau push kecuali user memintanya.**
- Jangan tambah tugas di luar yang tertulis di sini.
- Kalau menemukan sesuatu yang salah dengan permintaan user, **katakan sekali dalam satu-dua kalimat, lalu tetap kerjakan** permintaan lengkapnya.
- Laporkan apa adanya. Kalau ada yang gagal atau dilewati, sebutkan.
