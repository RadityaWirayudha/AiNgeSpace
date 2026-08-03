# Handoff #4 — Dialog "Buat Workspace" (lanjutan dari `buat-workspace-handoff-3.md`)

> **Berkas ini menggantikan `buat-workspace-handoff-3.md` sebagai titik masuk.**
> Handoff #3 masih berguna sebagai arsip alasan-alasan detail (terutama §13 dan §15 di sana), tapi **semua yang perlu kamu kerjakan ada di sini**. Handoff #1 dan #2 sudah dibatalkan/selesai — abaikan.
>
> **Jangan menambah tugas.** Yang tertulis di §4 adalah satu-satunya sisa pekerjaan teknis, dan itu pun **harus ditanyakan dulu ke user** (§4.4).

---

## §0 — Ringkasan sekali baca

Fitur "Buat Workspace" yang diminta user **sudah selesai seluruhnya di lapisan UI + IPC + API + skema database**, termasuk dua koreksi susulan dari user:

| | Isi | Status |
|---|---|---|
| Permintaan awal | Step 2 → "Layout", buang GitHub repo/branch, ganti **working folder**, section **Recent** di atas **Presets** (Coming Soon), label footer "Buka tanpa AI" / "Berikutnya .." | ✅ selesai |
| **Koreksi #1** | Kotak path **tidak bisa diketik** (seluruh kotaknya tombol → file explorer). Yang bisa diketik justru baris `> cd ../other-project` | ✅ selesai |
| **Koreksi #2** | Working folder **otomatis ke home directory asli**, ejaannya **persis seperti file explorer**, dan `cd` **dicek ke disk sungguhan** — kalau tidak ada, user diberi informasi yang mengarahkan | ✅ selesai |

**Sisa satu-satunya:** `working_dir` tersimpan di database tapi **belum dipakai untuk benar-benar menjalankan terminal di folder itu**. Rantainya putus di `terminal-instances.ts:290`. Detail lengkap di **§4**. **Tanyakan ke user dulu** sebelum mengerjakannya.

**Verifikasi terakhir:** `npm run typecheck` **hijau** (dua tsconfig). `npx eslint` pada semua berkas yang disentuh → **bersih, nol temuan**.
**Belum diverifikasi manual:** koreksi #2 belum pernah dilihat berjalan di aplikasi Electron yang hidup (§7).

---

## §1 — Perintah user (masih berlaku penuh, jangan ditafsir ulang)

1. Step 2 namanya **"Layout"**, bukan "Repo & Layout".
2. **Buang GitHub repo & branch sepenuhnya.** Ganti dengan **working folder** — path folder lokal di laptop user.
   - **Kotak path TIDAK BISA DIKETIK.** Kotak itu murni pemilih folder: **seluruh kotaknya** adalah tombol yang membuka file explorer OS, bukan cuma ikon cari di ujung kanannya. Ikon carinya sendiri sudah benar, biarkan. *(koreksi #1)*
   - **Yang bisa diketik justru baris `> cd ../other-project`.** *(koreksi #1)*
   - **Otomatis mulai di home directory asli** (`C:\Users\<nama>`), ejaan kotak **harus persis seperti di file explorer**. *(koreksi #2)*
   - **`cd` harus cocok dengan yang benar-benar ada di file explorer.** Kalau tidak ada, **beri informasi yang mengarahkan** — bukan sekadar ditolak. *(koreksi #2)*
3. **"Prasetel" → "Presets"**, dan **belum diimplementasikan — cukup render "Coming Soon".**
4. Tambah section **"Recent"** **di atas Presets**, isinya workspace terakhir dibuat/dibuka, diurutkan berdasarkan **waktu**. Grid dua kolom; tiap kartu: ikon folder, nama workspace, path redup, angka kecil di kanan.
5. Footer: "Lewati" → **"Buka tanpa AI"**, tombol utama → **"Berikutnya .."**.

### Aturan yang berdiri sejak awal

- **"jangan terlalu boros atau apapun itu, aku mau database bener-bener terpakai, bukan hanya pajangan doang."**
  → Setiap kolom yang ditambah harus ada yang membaca. **Ini alasan §4 penting** — dan alasan kenapa §4 harus disebut terang-terangan ke user, bukan disembunyikan.
- Penamaan tabel: `<entity>_aingespace`. Migrasi pakai `if exists`.
- **Jangan commit atau push kecuali user memintanya.**

---

## §2 — Peta kode: apa ada di mana

### 2.1 Lapisan data *(sudah ter-commit `a5d3c48`)*

| Berkas | Isi |
|---|---|
| `supabase/migrations/002_rewrite_aingespace_schema.sql` | `working_dir text not null` + CHECK `workspaces_aingespace_working_dir_not_blank`. `github_repo`/`branch` hilang. **Belum dijalankan — lihat §5.1.** |
| `src/types/database.ts` | Row/Insert/Update sudah `working_dir`. |
| `src/app/api/workspaces/route.ts` | zod `workingDir: z.string().trim().min(1).max(4096)`; nama workspace dihitung **server** (`nextWorkspaceName()`, tertinggi+1). |
| `src/app/api/workspaces/[id]/route.ts` | `working_dir` optional di PATCH; `isUuid()` guard tetap ada. |

### 2.2 `src/lib/workspace/paths.ts` — helper path murni browser

Tanpa `node:path`, tanpa filesystem. Separator dibaca dari string, bukan ditanyakan ke platform (workspace yang sama bisa dibuat di web dan dibuka di desktop).

- `isAbsolutePath(p)` — `~`, `/`, `\`, `C:\`, `\\server\share`.
- `normalizePath(p)` — kolaps `.` dan `..`, aman terhadap root.
- `joinPath(base, segment)` — turun satu langkah bernama. Dipakai chip panel panduan.
- `applyWorkingDirInput(current, input)` — **inti fitur `cd`.**
  **⚠️ Dua sifat yang dijadikan sandaran:** (a) **idempoten** untuk input non-`cd`; (b) `applyWorkingDirInput(dir, "")` mengembalikan **string kosong**, bukan `dir`. Baca §3.1 sebelum menyentuhnya.
- `folderName(p)` — segmen terakhir. Dipakai judul pane.
- `compactPath(p, maxSegments = 3)` — `…\proj\api`.

### 2.3 Lapisan Electron

| Berkas | Isi |
|---|---|
| `electron/channels.ts` | `chooseDirectory = "bm:dialog:choose-directory"`, `probeDirectory = "bm:fs:probe-directory"`. |
| `electron/main.ts` | Handler `dialog.showOpenDialog` (`openDirectory` + `createDirectory`, di-parent ke `mainWindow`). Handler `probeDirectory`. `process.env.BM_HOME_DIR = app.getPath("home")` di `boot()` **sebelum** `createWindow()`. |
| `electron/fs-probe.ts` | **Berkas baru, belum ter-commit.** `probeDirectory(input)` → `DirectoryProbe`. Ekspansi `~`; path relatif di-resolve ke `homedir()` (bukan cwd main process — cwd itu tergantung dari mana app diluncurkan dan tidak berarti apa-apa bagi user); `stat`; kalau gagal, **jalan naik** lewat `dirname` sampai ketemu folder yang ada (`nearestExisting`) lalu baca isinya (`childFolders`: maks 8, hanya folder, tanpa dotfolder, urut `localeCompare`). `EACCES`/`EPERM` → `"denied"`, sisanya `"missing"`. **Read-only**: tidak membuat, memindah, atau membaca isi berkas. |
| `electron/preload.ts` | `chooseDirectory(defaultPath?)`, `probeDirectory(path)`, `homeDir: process.env.BM_HOME_DIR ?? ""`. |
| `src/types/desktop.d.ts` | `DirectoryProblem` (`"missing" \| "not-directory" \| "denied"`), `DirectoryProbe` (`path`, `ok`, `reason`, `nearest`, `children`, `more`), `readonly homeDir: string`, `probeDirectory(path)`. |

**Kenapa `homeDir` lewat env var, bukan IPC?** Supaya kotaknya sudah terisi di **render pertama**. Lewat IPC asinkron, hasilnya harus masuk via `useEffect` + `setState` — persis pola yang jadi **error** di repo ini (`react-hooks/set-state-in-effect`). Rutenya sama dengan `BM_APP_VERSION` dan `BM_OS_BUILD` yang sudah ada, alasannya juga sama: preload jalan dengan `sandbox: true`, jadi `os` tidak bisa di-`require` dari sana.

### 2.4 `src/components/CreateWorkspaceDialog.tsx`

Nomor baris per akhir sesi ini:

| Baris | Hal |
|---|---|
| `52–65` | `WorkspaceDraft` — `repo`/`branch` hilang, diganti `workingDir: string`. |
| `76–80` | `STEPS[1].label = "Layout"`. |
| `84` | `RECENT_LIMIT = 6` (genap, grid 2 kolom). |
| `130–137` | `PRESETS` tinggal `{id, name, icon, desc}`. |
| `397` | `WORKING_DIR_EXAMPLE` — **hanya dilihat build web.** Di desktop kotaknya sudah terisi home sejak render pertama. |
| `404–414` | `FOLDER_PROBLEM` — kalimat untuk `missing` / `not-directory` / `denied`. |
| `419–493` | `FolderGuidance` — panel amber: alasan, `nearest`, chip `children` yang bisa diklik, indikator `more`, tautan buka file explorer. |
| `495–619` | `WorkingFolderStep` — **kotak = tombol pemilih folder, baris `>` = satu-satunya input.** |
| `621–674` | `RecentSection` — return `null` kalau kosong. `title={row.working_dir}` menjaga path penuh tetap terjangkau. |
| `746` | `<RecentSection>` dirender **di atas** blok Presets. ✔ |
| `748–783` | Presets: badge `Coming Soon`, enam kartu sebagai `<div aria-hidden="true">` (lihat §3.4). |
| `876–890` | `NEVER_CHANGES` / `readDesktop` / `NOT_DESKTOP` / `readHomeDir` / `NO_HOME` / `PROBE_DELAY_MS = 250`. |
| `907–932` | `pickedDir`, `dirCommand`, `probe`, lalu `workingDir = pickedDir \|\| homeDir` (**turunan**, bukan state). Baca §3.1. |
| `1011–1034` | Effect ambil Recent. `setState` di dalam `.then`, meniru `dashboard/page.tsx:65–86`. Gagal fetch = section hilang, **tidak pernah** memblokir pembuatan workspace. |
| `1049–1070` | `resolvedWorkingDir` (useMemo) + `runDirCommand` (Enter/blur). |
| `1093–1126` | **Effect probe** — debounce 250 ms, skip di web/step lain, adopsi ejaan kanonis. Baca §3.2. |
| `1128–1130` | `currentProbe` — hanya berlaku kalau `probe.path === resolvedWorkingDir`. `null` = "belum tahu", **tidak pernah** "aman". |
| `1174` | `step2Valid = resolvedWorkingDir.length > 0` — sekarang hanya cek "sudah diisi". |
| `1180–1218` | `folderProblem` + **`ensureFolderExists()`** — gerbang asinkron kedua tombol footer. |
| `1222–1287` | `handleLaunch(agentOverride?)`. Body POST: `{ workingDir, layoutPreset, agentIds }`. |
| `1289–1307` | `goNext()` dan `launchWithoutAgents()` — keduanya `async`, keduanya lewat `ensureFolderExists()`. |
| `1406–1424` | **"Buka tanpa AI"** — bukan "lewati". Ini **langsung membuat** workspace dengan nol agen, setelah foldernya diverifikasi. |
| `1433–1440` | Label tombol utama: `Berikutnya: Layout` / `Berikutnya: Agen` / `Membuat…` / `Luncurkan workspace`. |

**Perilaku prompt:** Enter **dan** blur menjalankan baris lalu mengosongkannya, seperti shell. Enter **tidak** memajukan wizard — orang yang terbiasa shell akan menekan Enter terus-menerus, dan wizard yang melompat karenanya adalah jebakan.

**Build web:** kotaknya jadi `<div>` biasa (bukan `<button>`) dan ikon carinya **tidak dirender sama sekali** — tidak ada picker OS di sana, jadi tidak ada kontrol yang berpura-pura bisa diklik. Probe juga di-skip. Prompt `>` tetap berfungsi.

### 2.5 Konsumen hilir

- `src/features/workspace/BridgeMindLayout.tsx:332` — judul pane pakai `folderName(draft.workingDir)` → `"api · pane 1"`.
- `src/app/dashboard/page.tsx` — kartu statistik **"Working folders"** = jumlah **folder unik** (`new Set(...)`), bukan jumlah workspace. Baris repo+branch diganti satu `compactPath(ws.working_dir)` dengan `title` path penuh.
- `src/types/index.ts` — `interface Workspace` (yang punya `githubRepo`/`githubBranch`) **dihapus** setelah dipastikan lewat grep tidak ada yang meng-import. `GitHubRepo` **sengaja dibiarkan** — fitur koneksi GitHub masih hidup.

---

## §3 — Jebakan. Baca sebelum mengubah apa pun di dialog

### 3.1 ⚠️ Dua state, dan `workingDir` yang BUKAN state

```ts
const [pickedDir, setPickedDir] = useState("")     // folder yang user PILIH — kosong = masih default
const [dirCommand, setDirCommand] = useState("")   // baris yang sedang diketik di PROMPT

const workingDir = pickedDir || homeDir            // isi KOTAK — TURUNAN, bukan state
const resolvedWorkingDir = useMemo(
  () => (dirCommand.trim() ? applyWorkingDirInput(workingDir, dirCommand) : workingDir),
  [workingDir, dirCommand]
)
```

- **Jangan gabung `pickedDir` dan `dirCommand` jadi satu state.** Keduanya dua benda berbeda di layar (kotak vs prompt).
- **Kenapa `resolvedWorkingDir` diturunkan?** Supaya user bisa mengetik `cd ../x` lalu **langsung klik "Berikutnya"** tanpa Enter. Klik itu tidak perlu balapan dengan blur yang harus lewat state React dulu. Validasi dan submit membaca `resolvedWorkingDir`, **tidak pernah** `workingDir`.
- **⚠️ Jangan hapus penjaga `dirCommand.trim() ? … : workingDir`.** `applyWorkingDirInput(dir, "")` mengembalikan **string kosong** (regex `cd` tidak cocok → `normalizePath("")` = `""`). Tanpa penjaga ini, folder yang sudah dipilih terhapus setiap kali prompt kosong — yaitu **hampir selalu**. Ini **lolos typecheck dan lolos lint**.
- **⚠️ Jangan ubah `workingDir` jadi `useState(homeDir)`.** `homeDir` datang dari `useSyncExternalStore` dan bernilai `""` di server/web; `useState` akan membekukan nilai server dan bikin hydration beda. Sebagai turunan, `reset()` cukup `setPickedDir("")` dan kotaknya balik ke home dengan sendirinya.

State ketiga, `probe`, sengaja tidak digabung: dia jawaban dari disk, bukan niat user, dan disimpan **bersama path yang ditanyakan** supaya jawaban basi tidak pernah dianggap berlaku.

### 3.2 ⚠️ Adopsi ejaan kanonis hanya saat prompt kosong

Kalau probe balik `ok` tapi `result.path !== target` (mis. `~/projects`, atau `C:/Users/user` dengan garis miring), `pickedDir` di-set ke `result.path` supaya kotak sama persis dengan file explorer. Konvergen setelah satu probe tambahan.

**Penjaganya `settled` (prompt kosong) tidak boleh dihapus.** Kalau di-adopsi sementara masih ada `cd` menggantung, `cd` itu diterapkan **dua kali** pada render berikutnya — `C:\Users\user\Documents\Documents`, lalu terus menggeser. Ini jebakan nyata, bukan teoritis.

### 3.3 Aturan lain di sekitar probe

- `setProbe` harus tetap di dalam `.then`, bukan di badan effect — `react-hooks/set-state-in-effect` adalah **error** di repo ini.
- Panel panduan menunggu `settled` (atau `showErrors`) supaya tidak berkedip di tiap huruf saat user mengetik `cd Doc`.
- `ensureFolderExists()` di **web** (`!bridge`) selalu `true`: tidak ada filesystem untuk dinilai di sana, dan menolak path yang tidak bisa dilihat sisi ini sama saja memblokir pembuatan workspace. Kalau probe-nya sendiri **melempar**, hasilnya juga `true` — menghukum user karena checker kita rusak itu salah.
- `checking` terpisah dari `submitting`: belum ada yang dibuat, dia hanya mencegah klik kedua memulai workspace kedua di belakang pemeriksaan pertama.

### 3.4 Jebakan repo yang masih berlaku

1. **`npm run typecheck` gagal karena artefak Next dev server.** `.next/dev/types/validator.ts` kadang terpotong dan melempar `TS1005`/`TS1002`/`TS1128`. **Hapus dulu**, baru jalankan. Bukan bug di kode.
2. **ESLint global bukan gate.** `react-hooks/set-state-in-effect` adalah *error* di repo ini dengan ±320 pelanggaran lama. Lint **hanya berkas yang kamu sentuh**.
3. **Ada 1 error ESLint pre-existing di `BridgeMindLayout.tsx:296`** (`react-hooks/set-state-in-effect`). Sudah dibuktikan pre-existing lewat `git stash` → `npx eslint` → error yang sama di tree bersih → `git stash pop`. **Jangan "perbaiki" ini** sebagai bagian dari pekerjaan working folder.
4. **`electron/channels.ts` adalah `const enum` dengan sengaja.** tsc meng-inline-nya dan menghapus import-nya, karena `require("./channels")` relatif akan melempar di preload ber-sandbox dan membuat `window.bridgemind` diam-diam `undefined`. **Biarkan `isolatedModules` tetap OFF di `tsconfig.electron.json`.**
5. **RLS aktif dengan nol policy — disengaja** (deny-all untuk anon/authenticated, service_role menembus). Otorisasi di route handler lewat `.eq("clerk_user_id", userId)`. Kalau query dari browser mengembalikan array kosong, **jangan matikan RLS** — pindahkan query-nya ke route handler.
6. **Supabase hanya diakses server-side** lewat `SUPABASE_SERVICE_ROLE_KEY`. `src/lib/supabase/client.ts` (klien anon-key) sudah dihapus dan **tidak boleh dibuat lagi**.
7. **`POST /api/panes` harus `.insert()`, jangan `.upsert()`** — id baris datang dari klien; upsert membuka jalan menimpa baris pane milik orang lain dengan menebak id-nya.
8. **Kolom terenkripsi bersufiks `_encrypted`** supaya tidak ada yang mengiranya token mentah lalu mencatatnya di log. CHECK constraint mengunci format `iv:tag:ciphertext` all-hex dari `src/lib/supabase/encryption.ts`; mengubah format enkripsi berarti harus mengubah constraint itu juga.
9. **lucide-react versi ini tidak mengekspor `Github`.** Yang sudah diverifikasi ada: `Braces`, `Code`, `Code2`, `CodeXml`, `SquareTerminal`, `PanelsTopLeft`, `GitCommitVertical`, `FolderTree`, `Compass`, `FolderSearch`, `FileSearch`, `Telescope`, `Binoculars`, `Radar`, `History`.
10. **`isUuid()` guard di route `[id]`.** `.eq("id", "local-ws-1")` terhadap kolom uuid membuat Postgres menolak perbandingannya → 500, padahal yang benar 404.
11. **Kartu Presets `<div aria-hidden="true">`, bukan `<button disabled>`.** Pembaca layar yang mengumumkan enam "tombol nonaktif" itu bising, sementara header section-nya sudah bilang *Coming Soon*; ini juga menjaga kartu-kartu itu keluar dari focus trap tanpa bergantung pada filter `button:not([disabled])`.
12. **`AGENTS.md` mewajibkan** membaca `node_modules/next/dist/docs/` sebelum menulis kode Next. Versi Next di repo ini bukan yang ada di ingatanmu.

---

## §4 — SISA PEKERJAAN TEKNIS (satu-satunya)

### `working_dir` belum benar-benar menjalankan terminal di folder itu

**Ini yang bikin kolomnya masih setengah "pajangan" — hal yang user larang secara eksplisit. Sebutkan terang-terangan ke user, jangan disembunyikan.**

**4.1 Yang sudah siap:**

- `electron/pty-manager.ts:103` — **sudah** menghormati `cwd`: `const cwd = isDirectory(opts.cwd) ? opts.cwd : this.fallbackCwd`. Path yang tidak ada diabaikan dengan aman.
- `src/types/desktop.d.ts` — `TerminalCreateOptions.cwd?: string` sudah ada.
- `src/features/terminal/pty-session.ts:77` — `AcquireOptions.cwd?: string` sudah ada, dan diteruskan ke `bridge.terminal.create` di baris `130–134`.

**4.2 Yang putus — tepat satu titik:**

- `src/features/terminal/terminal-instances.ts:290` — `acquirePtySession(desktop, id, { cols, rows, onData, onExit })` **tidak pernah mengirim `cwd`**.

**4.3 Rantai yang harus disambung, beserta apa yang sudah dipastikan:**

1. `attachInstance(terminalId, el)` — `terminal-instances.ts:542`. **Pemanggilnya persis satu**: `src/features/terminal/TerminalPanel.tsx:41`.
2. `ensureInstance` (`terminal-instances.ts:536`) **tidak punya pemanggil sama sekali**.
3. `createInstance` (`terminal-instances.ts:448`) adalah tempat `attachPty` dipanggil — di titik inilah `cwd` harus sudah diketahui, karena PTY dibuat sekali di sini dan **tidak** dibuat ulang saat re-attach.
4. **⚠️ Jangan pakai variabel global "cwd saat ini" di level modul.** Effect mount komponen anak berjalan **sebelum** effect induknya, jadi global itu akan terbaca kosong pada terminal pertama. `cwd` harus dialirkan sebagai **prop eksplisit** turun ke `TerminalPanel`.
5. **`WorkspaceData` di `BridgeMindLayout.tsx:52–61` belum punya field `workingDir`.** Yang tersedia hanya `draft.workingDir` di `handleWorkspaceCreated` (baris 332) — itu jalur *workspace baru dibuat*. Untuk workspace yang **dibuka kembali**, `working_dir` harus dibaca dari baris database (`fetchWorkspaces()` sudah mengembalikannya sebagai `WorkspaceRow.working_dir`) dan disimpan ke `WorkspaceData`.

Perkiraan berkas tersentuh: `BridgeMindLayout.tsx` → `PaneTerminalManager.tsx` → `TerminalPanel.tsx` → `terminal-instances.ts`. Ini **refactor lintas berkas yang nyata**, bukan satu baris.

**4.4 ⚠️ Tanyakan dulu ke user sebelum mengerjakannya** — ini di luar permintaan UI yang literal, meskipun jelas sejalan dengan aturan "database harus benar-benar terpakai".

---

## §5 — Menunggu keputusan user (bukan menunggu kode)

**5.1 — Menjalankan migrasi `002_rewrite_aingespace_schema.sql`.**
Migrasi ini **destruktif**: dia men-drop `aingespace_github_connections` (berisi token OAuth terenkripsi) dan `aingespace_environment_variables`.
**User harus mengonfirmasi sebelum dijalankan.** Kalau datanya harus selamat, perlu blok `insert … select` sebelum drop, dan perhatikan kolom yang berganti nama: `access_token` → `access_token_encrypted`, `value` → `value_encrypted`.

**5.2 — Keputusan `user_prefs_aingespace`.** Belum dijawab user.

**5.3 — Perilaku kartu Recent.** Saat ini kartu Recent **mengisi (prefill)** working folder + layout ke draft baru yang sedang dibuat — dia **tidak** membuka workspace lama itu. Alasannya: ini dialog "buat workspace baru"; mengklik kartu lalu tiba-tiba pindah ke workspace lama akan mengejutkan. **User belum mengonfirmasi** apakah ini yang dia mau.

---

## §6 — Yang SENGAJA tidak dikerjakan (jangan "perbaiki")

- `database_handoff.md` dan `v1.md` masih menyebut `github_repo`. **Biarkan** — itu dokumen spesifikasi/riwayat, bukan kode.
- `GitHubRepo` di `src/types/index.ts` **tidak** disentuh — fitur koneksi GitHub masih ada dan terpisah dari dialog ini.
- Presets **tidak** diimplementasikan. Perintah user memang cuma "render Coming Soon".
- **Tidak ada validasi "path harus absolut" di klien.** Di desktop, probe filesystem sudah menutup celah ini sepenuhnya. Di **web** celahnya masih ada: `cd ../x` dari kotak kosong menghasilkan path relatif yang tersimpan apa adanya, lalu `pty-manager` menolaknya lewat `isDirectory()` dan jatuh ke folder default. Ini **catatan jujur, bukan tugas** — kalau user mau dijaga, tempatnya `step2Valid` pakai `isAbsolutePath` dari `paths.ts:20`.
- **Tidak ada autocomplete di prompt.** Chip di panel panduan menjawab kebutuhan yang sama tanpa menambah state.
- **Tidak ada pembuatan folder dari dialog.** `dialog.showOpenDialog` sudah punya `createDirectory` di picker OS-nya.
- Probe **tidak** dijalankan di step 1 atau step 3 — tidak ada yang bisa berubah di sana.

---

## §7 — Verifikasi

### 7.1 Otomatis — sudah dijalankan, hijau

```bash
rm -f .next/dev/types/validator.ts   # WAJIB dulu — lihat §3.4 poin 1
npm run typecheck                    # HIJAU: tsc --noEmit + tsc -p tsconfig.electron.json --noEmit
npx eslint src/components/CreateWorkspaceDialog.tsx src/lib/workspace/paths.ts \
           electron/preload.ts electron/main.ts electron/fs-probe.ts electron/channels.ts \
           src/types/desktop.d.ts    # BERSIH, nol temuan
```

### 7.2 Manual — **BELUM dijalankan.** Koreksi #2 belum pernah dilihat hidup di Electron.

1. `npm run electron:dev` (build desktop — tombol browse & probe hanya ada di sini).
2. Dashboard → **New Workspace** → step 1 tekan Berikutnya.
3. Step 2 harus tampil: judul **"Layout"**, kotak **Working folder** (ikon folder + ikon cari), baris prompt `> cd ../other-project`, lalu **Recent**, lalu **Presets** dengan badge **Coming Soon** dan kartu redup yang tidak bisa diklik.
4. **Kotaknya harus sudah terisi `C:\Users\<nama>` sejak awal** — persis seperti di file explorer, tanpa berkedip dari kosong. *(koreksi #2)*
5. **Klik di tengah kotak path, jauh dari ikon cari** → file explorer OS harus terbuka. Mengetik di kotak itu harus **tidak terjadi apa-apa**. *(koreksi #1)*
6. Di baris `>`: ketik `cd C:\Windows` lalu Enter → kotak berubah, baris `>` kosong lagi.
7. Ketik `cd ..` lalu Enter → kotak jadi `C:\`. Ketik `cd ..` sekali lagi → **tetap** `C:\`, tidak jatuh ke luar root.
8. Ketik `cd ../x` lalu **langsung klik "Berikutnya"** tanpa Enter → harus tetap terpakai.
9. **Ketik `cd folder-yang-tidak-ada` lalu Enter** → panel amber muncul: alasan, "Yang benar-benar ada sampai sini: …", lalu chip nama folder yang bisa diklik. Klik salah satu chip → kotak pindah ke sana dan panelnya hilang. **"Berikutnya" harus menolak** selama panel itu masih ada. *(koreksi #2)*
10. **Ketik `cd DOCUMENTS` (huruf besar) atau `cd C:/Users`** → setelah kotak menerima, ejaannya berubah jadi ejaan asli OS. Pastikan **berhenti** di situ, tidak menggeser terus-menerus. *(koreksi #2, §3.2)*
11. Klik kartu Recent → working folder + layout terisi, dialog **tetap terbuka**.
12. Footer: tombol kiri **"Buka tanpa AI"**, tombol kanan **"Berikutnya: …"**.
13. Cek baris di Supabase: `working_dir` terisi persis seperti yang di kotak.
14. **Buka terminal di workspace itu** → cwd-nya **masih akan salah**. Itu §4, bukan bug baru.

---

## §8 — Status Git

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
?? buat-workspace-handoff-4.md
```

Dua commit yang relevan, keduanya dibuat **user**, bukan agent:

- `a5d3c48` — lapisan data (§2.1) + `electron/channels.ts` + `src/lib/workspace/paths.ts`.
- `e3f9727` — dialog, dashboard, `BridgeMindLayout`, IPC picker (`electron/main.ts`, `preload.ts`, `desktop.d.ts`), `src/types/index.ts`.

Yang belum ter-commit adalah **koreksi #1 + koreksi #2**. `electron/fs-probe.ts` berkas **baru** — jangan lupa `git add` kalau user minta di-commit.

**Jangan commit/push tanpa diminta user.**

---

## §9 — Aturan kerja

- **Jangan commit atau push kecuali user memintanya.**
- **Jangan tambah tugas** di luar yang tertulis di sini. §4 pun harus ditanyakan dulu.
- Kalau menemukan sesuatu yang salah dengan permintaan user, **katakan sekali dalam satu-dua kalimat, lalu tetap kerjakan** permintaan lengkapnya.
- Laporkan apa adanya. Kalau ada yang gagal atau dilewati, sebutkan.
- Bahasa UI: **Indonesia**. Komentar kode: **Inggris**, menjelaskan *kenapa*, bukan *apa*.
