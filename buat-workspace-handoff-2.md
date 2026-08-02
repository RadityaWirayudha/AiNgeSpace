# Handoff 2 — "Working Folder" menggantikan Repo GitHub di Create Workspace

> **Pendahulu:** `buat-workspace-handoff.md` (§1–§9). File itu masih berguna untuk
> konteks skema database dan riwayat keputusan, tapi **§3-nya sudah usang** dan
> bagian mana pun di sana yang menyebut `github_repo` / `githubRepo` /
> `RepoFieldsStep` sudah **dibatalkan oleh dokumen ini**. Kalau dua dokumen
> bertentangan, **dokumen ini yang berlaku.**

> ⚠️ **Repo saat ini TIDAK bisa di-typecheck.** Perubahan tipe & route sudah
> masuk, tapi tiga consumer UI belum diperbaiki. Lihat **§3** untuk daftar error
> yang memang diharapkan muncul, supaya kamu tidak mengira itu bug baru.

---

## §0 — Ringkasan sekali baca

Dialog "Buat workspace baru" berhenti meminta repo GitHub. Sekarang ia meminta
**satu folder lokal** (`working_dir`) — tempat semua terminal di workspace itu
mulai berjalan. Langkah 2 berganti nama dari "Repo & Layout" menjadi **"Layout"**.
Di langkah 2 juga ditambah bagian **Recent** (workspace terakhir dibuka) dan
bagian **Presets** yang hanya berlabel *Coming Soon*. Tombol footer berubah
menjadi **"Buka tanpa AI"** dan **"Berikutnya: …"**.

Lapisan data (migration, tipe, dua route handler) **sudah selesai**. Yang belum
adalah **seluruh lapisan UI** plus tiga baris IPC Electron. Perkiraan sisa kerja:
satu file besar (`CreateWorkspaceDialog.tsx`) + empat file kecil.

---

## §1 — Permintaan user (verbatim) dan keputusan turunannya

Permintaan terakhir user, dikirim bersama dua screenshot referensi:

> "Untuk proses ke dua yakni "Repo & Layout" diganti namanya menjadi "Layout"
> saja, kemudian kita saat ini tidak usah pake "repositori github", segala macam.
> Kita ganti hal tersebut menjadi working folder (pake folder lokal laptop).
> Image #2 akan menjadi referensi terkait dengan hal itu. Untuk teks, "cd
> ../other project" Jadi user bisa nulis "cd" ya di sana untuk ngarahin ke folder
> terkait.
>
> Untuk "prasetel" saya tidak mengerti. Itu mending diganti juga. Menjadi
> "Presests". Tapi ini nanti saja. Tulis saja coming soon. Di atas presets ada
> "recent". Terkait dengan AiNgeSpace yang baru dibuat berdasarkan waktu terakhir.
> Image #3 akan menjadi referensi untuk itu. Sama tolong samain tombol paling
> bawah sesuai referensi image #3 ya, kan kalau di project kita itu ada "lewati"
> dan "berikutnya .." itu diganti menjadi sesuai referensi image #3 yakni, "buka
> tanpa AI" dan "berikutnya .."

### Isi dua gambar referensi (kamu tidak akan melihat gambarnya — ini transkripnya)

**Image #2 — field working folder:**
- Label tebal `Working folder`, di bawahnya baris redup `Where your terminals will start`
- Satu baris input: ikon **folder** di kiri, ikon **cari/browse** di kanan
- Di bawah input, satu baris redup **monospace**: `> cd ../other-project`

**Image #3 — bagian Recent + footer:**
- Header bagian: `◻ RECENT 5` di kiri, `Last opened workspaces` redup di kanan
- Grid **dua kolom** berisi kartu. Tiap kartu: ikon folder, nama workspace,
  di bawahnya path redup gaya `~/desktop/…`, dan **satu angka kecil di kanan**
- Footer: tombol kiri `Open without AI`, tombol kanan `Next: A…`

### Keputusan turunan yang sudah dikunci

| # | Keputusan | Alasan |
|---|---|---|
| 1 | `working_dir` **satu kolom text**, bukan `repo`+`branch` | Folder lokal tidak punya cabang. |
| 2 | **Tidak ada validasi bentuk path** di zod maupun CHECK constraint — hanya "tidak kosong, ≤4096" | Bentuk path sah beda antar OS. Satu-satunya pemeriksaan yang berarti ("folder ini ada?") hanya bisa dijawab main process Electron (`isDirectory()` di `pty-manager.ts`). |
| 3 | Field working folder juga menerima perintah `cd` | Permintaan user eksplisit. Diselesaikan resolver murni di `src/lib/workspace/paths.ts` (sudah dibuat, lihat §2). |
| 4 | Ikon browse di kanan input **diberi fungsi nyata** (native folder picker lewat IPC baru), bukan ikon mati | Aturan user yang berlaku sejak awal sesi: *"aku mau database bener-bener terpakai, bukan hanya pajangan doang."* Ikon yang tidak melakukan apa-apa adalah pajangan. Di build web (tanpa Electron) tombolnya **disembunyikan**, bukan di-disable. |
| 5 | Presets: tile tetap dirender tapi **disabled + badge Coming Soon**; `presetId`/`applyPreset` **dihapus** | User: *"Tapi ini nanti saja. Tulis saja coming soon."* |
| 6 | Kartu **Recent** meng-**isi otomatis** (prefill) working folder + layout ke draft yang sedang dibuat — **bukan** langsung membuka workspace lama | Membuka workspace lama dari dialog "buat workspace baru" adalah kejutan. **Ini satu-satunya keputusan yang belum dikonfirmasi user** — lihat §8. |
| 7 | "Buka tanpa AI" = **langsung membuat workspace** dengan `agentIds: []` | Itu arti kalimatnya. Beda dari "Lewati" lama yang hanya melompat ke langkah 3. |

---

## §2 — Yang SUDAH selesai (jangan dikerjakan ulang)

### 2.1 `supabase/migrations/002_rewrite_aingespace_schema.sql` ✅

`github_repo` / `github_branch` / `local_path` **hilang**, diganti:

```sql
  name          text        not null,

  -- Folder tempat terminal workspace ini mulai berjalan. Ini menggantikan
  -- github_repo/github_branch: dialog pembuatan workspace tidak lagi meminta
  -- repo GitHub, ia meminta folder lokal. Nilainya per-mesin — workspace yang
  -- sama dibuka dari laptop lain akan menunjuk path berbeda — tapi tetap not
  -- null karena tanpa folder, terminal tidak punya tempat untuk mulai.
  working_dir   text        not null,
```

dan constraint repo-format diganti:

```sql
  -- Tidak ada regex path di sini dengan sengaja: bentuk path sah berbeda antara
  -- Windows, macOS dan Linux, dan satu-satunya penentu yang sebenarnya adalah
  -- apakah folder itu ada di mesin yang menjalankannya — sesuatu yang hanya
  -- diketahui main process Electron (lihat isDirectory() di pty-manager.ts).
  constraint workspaces_aingespace_working_dir_not_blank
    check (length(btrim(working_dir)) between 1 and 4096),
```

> **Kenapa diedit di tempat, bukan bikin `003_`:** migration 002 **belum pernah
> dijalankan** di Supabase. Menambah `003` yang meng-`alter` tabel yang belum ada
> hanya akan gagal.
> **Kalau ternyata user sudah menjalankan 002** (tanya dulu!), maka jangan pakai
> file ini — buat `003_workspaces_working_dir.sql` yang isinya
> `alter table … add column working_dir text`, isi nilainya, `set not null`,
> `drop column github_repo, github_branch, local_path`, tukar constraint-nya.

### 2.2 `src/types/database.ts` ✅

`workspaces_aingespace` Row/Insert punya `working_dir: string`, Update punya
`working_dir?: string`. Tiga kolom lama sudah dibuang dari ketiganya.

### 2.3 `src/app/api/workspaces/route.ts` ✅

- Skema POST: `workingDir: z.string().trim().min(1).max(4096)` (wajib),
  `name` jadi **opsional** (server yang menamai).
- `nextWorkspaceName(existing: string[])` — "Workspace 1", "Workspace 2", …
  menghitung dari **angka tertinggi + 1**, bukan mengisi celah, supaya nomor
  workspace yang sudah dihapus tidak dipakai ulang.
- Satu SELECT (`name, sort_order`) melayani **dua** kebutuhan: auto-name dan
  `sort_order` baris baru. Jangan pecah jadi dua query.
- INSERT menulis `working_dir: parsed.workingDir`.

### 2.4 `src/app/api/workspaces/[id]/route.ts` ✅

`updateWorkspaceSchema` sekarang: `name?`, `working_dir?`, `layout_preset?`,
`agent_ids?`. `github_branch`/`local_path` sudah hilang.

### 2.5 `src/lib/workspace/paths.ts` ✅ **(file baru)**

Helper **murni**, tanpa `node:path`, tanpa akses disk — karena ia jalan di
browser dan OS mesin tujuan tidak bisa diketahui dari sana. Yang diekspor:

| Fungsi | Guna |
|---|---|
| `isAbsolutePath(p)` | `~`, `/x`, `\\server`, `C:\x` |
| `normalizePath(p)` | rapikan `.` dan `..`, hormati root (`cd ..` di root tetap di root) |
| `applyWorkingDirInput(current, input)` | **inti fitur `cd`.** Kalau `input` cocok `/^cd\b/i`, argumennya diselesaikan **relatif terhadap `current`**, persis seperti shell. Kalau bukan `cd`, `input` dianggap path biasa. `cd` tanpa argumen = biarkan nilai lama (tidak ada "home" yang bisa ditebak dari browser). |
| `folderName(p)` | segmen terakhir — untuk judul pane |
| `compactPath(p, maxSegments=3)` | `…\proj\api` — untuk kartu Recent. Sengaja memotong **awal** path, karena `truncate` CSS memotong akhirnya dan membuat semua baris terbaca `C:\Users\…` |

`applyWorkingDirInput` **idempoten** untuk masukan non-`cd`. Sifat ini dipakai di
§4.2 — jangan dirusak.

### 2.6 `electron/channels.ts` ✅

Ditambah satu channel:

```ts
  openExternal = "bm:shell:open-external",
  chooseDirectory = "bm:dialog:choose-directory",
  deepLink = "bm:deep-link",
```

### 2.7 `electron/main.ts` — **BARU SETENGAH** ⚠️

Yang sudah masuk hanya import-nya:

```ts
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron"
```

Handler-nya **belum ada**, jadi saat ini `dialog` adalah import yang tidak
terpakai (ESLint akan mengeluh). Lanjutkan di §4.1 langkah 1.

---

## §3 — Kondisi repo sekarang: error yang MEMANG diharapkan

Sebelum kamu mulai, jalankan:

```bash
rm -f .next/dev/types/validator.ts   # WAJIB, lihat §5 jebakan 1
npm run typecheck
```

Error yang akan muncul dan **bukan** bug baru:

| Lokasi | Error |
|---|---|
| `src/app/dashboard/page.tsx:101` | `row.github_repo` tidak ada di `WorkspaceRow` |
| `src/app/dashboard/page.tsx:227` | `ws.github_repo` tidak ada |
| `src/app/dashboard/page.tsx:232` | `ws.github_branch` tidak ada |
| `electron/main.ts` (lint) | `dialog` di-import tapi belum dipakai |

`CreateWorkspaceDialog.tsx:791-792` masih mengirim `githubRepo`/`githubBranch` ke
POST. Itu **tidak** memicu error typecheck (body `fetch` tidak diketik), tapi
setiap pembuatan workspace akan **gagal 400** dari zod sampai §4.2 selesai.
`BridgeMindLayout.tsx:332` juga masih memakai `draft.repo` dan baru akan error
setelah `WorkspaceDraft` diubah.

---

## §4 — Sisa pekerjaan

Urutan di bawah dipilih supaya typecheck kembali hijau **secepat mungkin**:
selesaikan 4.1 (kecil, terisolasi), lalu 4.2 (besar), lalu 4.3–4.5 (consumer).

### §4.1 — Native folder picker (3 file kecil)

**Langkah 1 — `electron/main.ts`**, di dalam `registerIpc()`, setelah handler
`CH.openExternal`:

```ts
  ipcMain.handle(CH.chooseDirectory, async (_e, defaultPath?: string) => {
    // Dipasang ke window supaya dialognya modal terhadap aplikasi, bukan
    // jendela lepas yang bisa hilang di belakang.
    if (!mainWindow || mainWindow.isDestroyed()) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      // Path yang tidak ada diabaikan Electron dan dialognya jatuh ke default
      // OS — jadi nilai setengah-jadi dari field tidak perlu disaring dulu.
      defaultPath: defaultPath?.trim() || undefined,
    })
    return canceled ? null : (filePaths[0] ?? null)
  })
```

**Langkah 2 — `electron/preload.ts`**, di objek `bridge`, sesudah `openExternal`:

```ts
  chooseDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke(CH.chooseDirectory, defaultPath),
```

**Langkah 3 — `src/types/desktop.d.ts`**, di `interface DesktopBridge`:

```ts
  /**
   * Membuka dialog pilih-folder milik OS. Mengembalikan path absolut, atau
   * null kalau user membatalkan. `defaultPath` hanya saran posisi awal.
   */
  chooseDirectory(defaultPath?: string): Promise<string | null>
```

> Jangan menambah `import`/`export` baru di `electron/channels.ts`. Ia
> `const enum` supaya tsc meng-inline nilainya; preload berjalan `sandbox: true`
> di mana `require("./channels")` **melempar** dan `window.bridgemind` jadi
> `undefined` tanpa pesan error. Penjelasan lengkap ada di komentar file itu.

### §4.2 — `src/components/CreateWorkspaceDialog.tsx` (pekerjaan utama)

Peta baris file **saat ini** (994 baris):

| Baris | Isi | Tindakan |
|---|---|---|
| 4–25 | import lucide | +`FolderSearch`, +`History`; `GitBranch` **tetap** (dipakai PRODUCTS) |
| 38–51 | `interface WorkspaceDraft` | `repo`+`branch` → `workingDir` |
| 62–66 | `STEPS` | label ke-2 → `"Layout"` |
| 106–113 | `PRESETS` | buang field `layout` & `agents` (tidak ada lagi yang membacanya) |
| 370–429 | `RepoFieldsStep` | **hapus**, ganti `WorkingFolderStep` |
| 434–555 | `LayoutStep` | buang `presetId`/`applyPreset`; +`RecentSection`; Presets jadi disabled |
| 650–676 | state + `reset` | buang `repoUrl`/`branch`/`presetId`; +`workingDir`/`workingDirInput`/`recent` |
| 736–750 | `toggleAgent`/`applyPreset` | buang `setPresetId(null)`; hapus `applyPreset` |
| 752–772 | `heading` + `step2Valid` | teks langkah 2 + validasi baru |
| 774–840 | `handleLaunch` | kirim `workingDir`; terima override agen |
| 941–988 | footer | "Buka tanpa AI" + "Berikutnya: …" |

#### (a) State & resolusi `cd` — pola yang WAJIB dipakai

Masalahnya: field ini menyimpan path **dan** menerima perintah `cd`. Kalau
`cd ../x` diselesaikan pada setiap ketikan, mengetik `cd ` saja sudah mengubah
isi field. Kalau diselesaikan hanya saat blur, tombol "Berikutnya" bisa membaca
state basi karena setState React tidak sinkron.

Solusinya **dua state + satu nilai turunan**:

```ts
// Nilai yang sudah "diterima". Jadi basis untuk `cd ../x`.
const [workingDir, setWorkingDir] = useState("")
// Teks apa adanya di dalam input. Boleh berisi "cd ..".
const [workingDirInput, setWorkingDirInput] = useState("")

// Nilai yang berlaku pada render ini. Karena applyWorkingDirInput idempoten
// untuk masukan non-`cd`, ini aman dihitung ulang setiap render — dan itu yang
// menghilangkan jebakan "klik Berikutnya sebelum input ter-blur".
const resolvedWorkingDir = useMemo(
  () => applyWorkingDirInput(workingDir, workingDirInput),
  [workingDir, workingDirInput]
)

// Dipanggil saat Enter dan saat blur — semata supaya user MELIHAT "cd ../x"
// berubah menjadi path sungguhan. Validasi dan submit tidak bergantung padanya.
const commitWorkingDir = useCallback(() => {
  setWorkingDir(resolvedWorkingDir)
  setWorkingDirInput(resolvedWorkingDir)
}, [resolvedWorkingDir])
```

- `step2Valid` = `resolvedWorkingDir.length > 0`
- `handleLaunch` mengirim `resolvedWorkingDir`
- Tombol browse memanggil `setWorkingDir(path)` **dan** `setWorkingDirInput(path)`

#### (b) Deteksi Electron tanpa melanggar ESLint

`window.bridgemind` hanya ada di desktop, jadi tidak boleh dibaca saat render
server. **Jangan** pakai `useEffect` + `setState` — rule
`react-hooks/set-state-in-effect` di repo ini berstatus **error**. Pakai:

```ts
// Store yang tidak pernah berubah: keberadaan bridge ditentukan sebelum
// renderer jalan, jadi tidak ada yang perlu di-subscribe.
const NO_SUBSCRIBE = () => () => {}

const isDesktop = useSyncExternalStore(
  NO_SUBSCRIBE,
  () => !!window.bridgemind,
  () => false // snapshot server: tidak ada bridge saat SSR
)
```

Tombol browse **dirender hanya kalau `isDesktop`**. Di web ia tidak ada sama
sekali (bukan disabled) — tidak ada yang bisa dilakukannya di sana.

#### (c) `WorkingFolderStep`

Ganti `RepoFieldsStep` (baris 370–429) dengan komponen ini. Perhatikan: baris
hint `> cd ../other-project` harus berada **di dalam** `children` milik `Field`,
karena `Field` merender `hint` di **atas** input dan `error` di bawahnya.

```tsx
function WorkingFolderStep({
  value,
  onChange,
  onCommit,
  onBrowse,
  error,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  /** null di build web: tidak ada dialog OS untuk dibuka. */
  onBrowse: (() => void) | null
  error?: string
}) {
  return (
    <Field
      label="Working folder"
      hint="Tempat semua terminal di workspace ini mulai berjalan."
      error={error}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 h-9 px-3 rounded-lg bg-secondary border transition-colors focus-within:border-purple/50",
          error ? "border-destructive/60" : "border-border"
        )}
      >
        <Folder className="size-3.5 text-zinc-500 shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Enter menyelesaikan `cd ..` di tempat, bukan mengirim langkahnya —
          // field ini berperilaku seperti prompt.
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            onCommit()
          }}
          onBlur={onCommit}
          placeholder="C:\Users\nama\projects\app"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!!error}
          aria-label="Working folder"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-zinc-600 font-mono"
        />
        {onBrowse && (
          <button
            type="button"
            onClick={onBrowse}
            aria-label="Pilih folder"
            className="size-6 -mr-1 rounded-md shrink-0 flex items-center justify-center text-zinc-500 hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
          >
            <FolderSearch className="size-3.5" />
          </button>
        )}
      </div>

      {/* Mengumumkan bahwa field ini juga menerima `cd`. */}
      <p className="mt-2 text-[11px] font-mono text-zinc-600">
        <span className="text-zinc-700 select-none">&gt; </span>
        cd ../other-project
      </p>
    </Field>
  )
}
```

Pesan error yang dipakai saat `showErrors && !step2Valid`:
`"Pilih folder tempat terminal akan dijalankan."`

#### (d) `RecentSection` — diletakkan **di atas** Presets

Ambil data dengan `fetchWorkspaces()` dari `@/features/workspace/workspace-api`
(sudah ada, sudah lewat route handler — **jangan** query Supabase dari browser,
RLS aktif tanpa policy dan hasilnya akan array kosong).

Efek pengambilan data, ditulis mengikuti pola yang sudah dipakai
`src/app/dashboard/page.tsx:65-86` supaya lolos `set-state-in-effect`
(setState di dalam `.then`, bukan di badan efek):

```ts
const RECENT_LIMIT = 6

const [recent, setRecent] = useState<WorkspaceRow[]>([])

useEffect(() => {
  if (!open) return
  let cancelled = false
  fetchWorkspaces()
    .then((rows) => {
      if (cancelled) return
      // Route mengurut berdasarkan sort_order (urutan sidebar). "Recent" butuh
      // urutan waktu, jadi diurut ulang di sini.
      const byTime = [...rows].sort(
        (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
      )
      setRecent(byTime.slice(0, RECENT_LIMIT))
    })
    .catch(() => {
      // Recent hanya jalan pintas. Gagal memuatnya tidak boleh menghalangi
      // pembuatan workspace, jadi bagiannya sekadar tidak muncul.
      if (!cancelled) setRecent([])
    })
  return () => {
    cancelled = true
  }
}, [open])
```

`recent` **jangan** dikosongkan di `reset()` — efek di atas sudah mengambil ulang
setiap kali dialog dibuka, dan mengosongkannya hanya membuat bagiannya berkedip.

Render (grid **2 kolom** sesuai image #3, sembunyikan seluruh bagian kalau
kosong — kotak kosong tidak mengajarkan apa pun ke user baru):

```tsx
function RecentSection({
  items,
  onPick,
}: {
  items: WorkspaceRow[]
  onPick: (row: WorkspaceRow) => void
}) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <History className="size-3.5 text-zinc-500" />
          <span className="text-[13px] font-semibold text-foreground">Recent</span>
          <Badge variant="secondary" className="text-[11px] font-mono">
            {items.length}
          </Badge>
        </div>
        <span className="text-[11px] text-zinc-500">Workspace terakhir dibuka</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onPick(row)}
            title={row.working_dir}
            className="text-left flex items-center gap-2.5 p-3 rounded-lg cursor-pointer transition-colors border bg-secondary border-border hover:border-zinc-500"
          >
            <span className="size-6 rounded-md bg-zinc-800 shrink-0 flex items-center justify-center">
              <Folder className="size-3.5 text-zinc-400" strokeWidth={1.9} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold text-foreground truncate">
                {row.name}
              </span>
              <span className="block text-[11px] text-zinc-500 font-mono truncate">
                {compactPath(row.working_dir)}
              </span>
            </span>
            {/* Angka kecil di kanan pada image #3: jumlah panel terminal. */}
            <span className="text-[11px] font-mono text-zinc-500 shrink-0">
              {terminalCountFor(row.layout_preset)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

`onPick` (di komponen dialog) — **prefill, bukan buka**:

```ts
// Mengisi draft yang sedang dibuat, bukan membuka workspace lama: user sedang
// berada di dialog "buat workspace baru".
const pickRecent = useCallback((row: WorkspaceRow) => {
  setWorkingDir(row.working_dir)
  setWorkingDirInput(row.working_dir)
  setLayoutId(row.layout_preset)
  setShowErrors(false)
}, [])
```

#### (e) Presets → Coming Soon

Header jadi `Presets` (bukan "Prasetel") + `<Badge variant="outline">Coming
Soon</Badge>`, subteks `"Layout dan agen dalam satu klik. Segera."`. Tile tetap
dirender tapi:

```tsx
<button type="button" disabled className="... opacity-50 cursor-not-allowed" ...>
```

`disabled` juga mengeluarkannya dari focus trap dialog — trap-nya menyaring
`button:not([disabled])` (lihat baris 709 & 718). Hapus `presetId`,
`applyPreset`, `setPresetId`, dan wrapper `setLayoutId` di baris 907–910.

#### (f) `handleLaunch` + footer

```ts
// `agentOverride` melayani "Buka tanpa AI": tombol itu membuat workspace
// sekarang, dengan nol agen, tanpa lewat langkah 3.
const handleLaunch = async (agentOverride?: string[]) => {
  …
  const agentIds = agentOverride ?? AGENTS.filter((a) => agents[a.id]).map((a) => a.id)
  …
  body: JSON.stringify({
    workingDir: resolvedWorkingDir,
    layoutPreset: layoutId,
    agentIds,
  }),
  …
  onCreated?.({
    id: workspaceId,
    name: name ?? "Workspace",
    workingDir: resolvedWorkingDir,   // ganti repo/branch
    layoutId,
    terminalCount,
    agentIds,
    agentCount: agentIds.length,
    persisted,
  })
}
```

Footer (ganti blok baris 941–988). Tombol kiri-dalam **bukan lagi "Lewati"**:

```tsx
{step < 3 && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      // Tanpa working folder, POST akan ditolak zod dan user mendarat di
      // workspace lokal tanpa pernah diberi tahu sebabnya.
      if (!step2Valid) {
        setShowErrors(true)
        setStep(2)
        return
      }
      void handleLaunch([])
    }}
    disabled={submitting}
    className="text-zinc-400"
  >
    Buka tanpa AI
  </Button>
)}
```

Label tombol utama: langkah 1 → `"Berikutnya: Layout"`, langkah 2 →
`"Berikutnya: Agen"`, langkah 3 → `"Luncurkan workspace"` / `"Membuat…"`.

Heading langkah 2:

```ts
if (step === 2)
  return {
    title: "Layout",
    sub: "Pilih folder kerja lalu tentukan jumlah panel terminal.",
  }
```

### §4.3 — `src/features/workspace/BridgeMindLayout.tsx:332`

```ts
// sebelum
draft.repo ? `${draft.repo} · pane ${i + 1}` : `Pane ${i + 1}`
// sesudah — nama folder, bukan path penuh: judul pane cuma punya beberapa piksel
const folder = folderName(draft.workingDir)
…
folder ? `${folder} · pane ${i + 1}` : `Pane ${i + 1}`
```

Impor `folderName` dari `@/lib/workspace/paths`. Hitung `folder` **sekali** di
luar `Array.from`, jangan di dalam callback.

### §4.4 — `src/app/dashboard/page.tsx`

1. Baris 101 — stat card kedua. `github_repo` → `working_dir`, label
   `"Repositories"` → `"Working folders"`, ikon `Boxes` → `Folder`.
   Buang `working_dir` kosong dari `Set` kalau ada.
2. Baris 224–233 — pada tiap kartu, ganti dua ruas (repo + branch) menjadi
   **satu** ruas path: ikon `Folder`, isi `compactPath(ws.working_dir)`, dan
   `title={ws.working_dir}` supaya path penuh tetap bisa dibaca. Ruas
   `relativeTime(ws.updated_at)` **tetap**.
3. Bersihkan impor `GitBranch` (dan `Boxes` kalau sudah tak terpakai).
4. Baris 197 masih menulis *"Create one to pick a repository…"* → ubah ke
   *"Create one to pick a working folder, a pane layout and its agents."*

### §4.5 — `src/types/index.ts:15-21`

`interface Workspace` di sini **tidak diimpor siapa pun** (sudah diverifikasi
dengan grep `from "@/types"` — hanya `FileNode` dan `SplitDirection` yang
dipakai). Ia masih menyebut `githubRepo`/`githubBranch`. Pilihannya: **hapus**
interface-nya (kode mati) — itu yang direkomendasikan — atau kalau mau
dipertahankan, ganti dua field itu jadi `workingDir: string`. Jangan tinggalkan
apa adanya. `GitHubRepo` di bawahnya **jangan disentuh**: fitur GitHub connection
(`/api/github/repos`) masih hidup dan memang masih memakai GitHub.

---

## §5 — Jebakan (semuanya sudah pernah menggigit)

1. **`npm run typecheck` gagal di `.next/dev/types/validator.ts`.** File
   *generated* Next dev server yang sering terpotong di tengah tulis (`TS1005 /
   TS1002 / TS1128`). **Bukan** kode project. Jalankan
   `rm -f .next/dev/types/validator.ts` lalu ulangi; Next membuatnya lagi.
2. **`npm run lint` global bukan gerbang kelulusan.** Rule
   `react-hooks/set-state-in-effect` berstatus *error* di repo ini dan sudah
   dilanggar **ratusan kali** (sekitar 320+) oleh kode yang sudah ada. Lint
   **hanya file yang kamu sentuh**: `npx eslint <file> …`.
3. **lucide-react versi ini tidak mengekspor `Github`.** Nama yang sudah
   diverifikasi ada: `Braces`, `Code`, `Code2`, `CodeXml`, `SquareTerminal`,
   `PanelsTopLeft`, `GitCommitVertical`, `FolderTree`, `Compass`, `FolderSearch`,
   `FileSearch`, `Telescope`, `Binoculars`, `Radar`, `History`.
4. **Jangan membuat client Supabase di browser.** `src/lib/supabase/client.ts`
   sudah dihapus dan tidak boleh dibuat ulang. RLS aktif **tanpa policy** dengan
   sengaja: anon/authenticated ditolak, service_role bypass. Kalau sebuah query
   dari browser mengembalikan array kosong, **jangan matikan RLS** — pindahkan
   query-nya ke route handler.
5. **`electron/channels.ts` adalah `const enum`.** Jangan ubah bentuknya dan
   jangan nyalakan `isolatedModules` di `tsconfig.electron.json`; preload
   berjalan `sandbox: true` dan `require("./channels")` di sana melempar.
6. **Migration 002 bersifat destruktif.** Ia men-`drop` tabel koneksi GitHub
   (token OAuth terenkripsi) dan environment variables. **Wajib konfirmasi user
   sebelum dijalankan.** Kalau datanya harus selamat, butuh blok
   `insert … select` sebelum `drop`, dengan penyesuaian nama kolom
   (`access_token` → `access_token_encrypted`, `value` → `value_encrypted`).
7. **`POST /api/panes` harus `.insert()`, jangan `.upsert()`.** Id baris datang
   dari klien; upsert akan membuat pemanggil bisa menimpa baris pane orang lain
   dengan menebak id-nya.
8. **`isUuid()` guard** di route `[id]` jangan dihapus: `.eq("id", "local-ws-1")`
   terhadap kolom uuid ditolak Postgres → 500 padahal jawaban benarnya 404.
9. Nama tabel selalu `<entitas>_aingespace`.

---

## §6 — Verifikasi

Otomatis:

```bash
rm -f .next/dev/types/validator.ts
npm run typecheck
npx eslint src/components/CreateWorkspaceDialog.tsx \
           src/lib/workspace/paths.ts \
           src/app/dashboard/page.tsx \
           src/features/workspace/BridgeMindLayout.tsx \
           src/types/index.ts \
           electron/main.ts electron/preload.ts
```

Manual, di dialog "Buat workspace baru":

1. Stepper berbunyi **Start → Layout → Agen**. Tidak ada lagi kata "Repo".
2. Langkah 2 menampilkan **Working folder** dengan ikon folder, hint
   `> cd ../other-project`, dan (di desktop) ikon browse yang membuka dialog OS.
3. Isi `C:\Users\me\projects\app`, lalu ketik `cd ../lain` dan tekan **Enter** →
   field menjadi `C:\Users\me\projects\lain`.
4. `cd ..` berulang kali di root **tidak** menghasilkan path aneh (`C:\` tetap
   `C:\`).
5. Field dibiarkan kosong → tekan "Berikutnya" → muncul pesan error, langkah
   **tidak** maju.
6. Bagian **Recent** muncul di atas Presets kalau user punya ≥1 workspace, dua
   kolom, memperlihatkan nama + path terpotong + jumlah terminal. Klik satu →
   working folder & layout terisi. User baru (0 workspace): bagiannya **tidak
   ada** sama sekali.
7. **Presets** berlabel Coming Soon, tile-nya tidak bisa diklik, dan Tab
   melewatinya.
8. **"Buka tanpa AI"** langsung membuat workspace (tanpa mampir langkah 3) dan
   `agent_ids` di database berisi `{}`.
9. Buka Supabase: baris baru punya `working_dir` sesuai isian, `name` berupa
   `Workspace N` dengan N = tertinggi + 1, `layout_preset` dan `agent_ids` sesuai
   pilihan.
10. Dashboard: stat card berbunyi **Working folders**, dan tiap kartu
    memperlihatkan path — bukan `user/repo` + branch.

---

## §7 — Yang sengaja TIDAK dikerjakan (laporkan ke user, jangan diam-diam)

1. **`working_dir` belum benar-benar dipakai untuk menjalankan terminal.**
   `electron/pty-manager.ts` **sudah** menghormati `cwd`
   (`const cwd = isDirectory(opts.cwd) ? opts.cwd : this.fallbackCwd`), tapi
   `src/features/terminal/terminal-instances.ts:290` hanya mengirim
   `{ cols, rows }` — renderer **belum pernah** mengirim `cwd`. Jadi sampai
   wiring ini dibuat, folder yang dipilih user tersimpan rapi di database tapi
   terminal tetap mulai di `fallbackCwd`.
   Ini **pekerjaan terbesar yang tersisa** dan berdiri sendiri: `working_dir`
   harus dialirkan dari baris workspace → store pane → pembuatan sesi PTY.
   Selama ini belum ada, kolom `working_dir` masih setengah "pajangan" — hal yang
   secara eksplisit dilarang user. **Sebutkan ini terang-terangan.**
2. **Tidak ada pemeriksaan "folder ini ada".** Baik zod maupun CHECK constraint
   hanya memeriksa panjang. Pemeriksaan sebenarnya hanya mungkin di main process.
   Kandidat perbaikan: IPC `chooseDirectory` sudah membuka pintunya — tambahkan
   `CH.pathExists` dan tandai field-nya dengan peringatan lembut (bukan blokir,
   karena folder bisa dibuat belakangan).
3. **Bagian Presets memang belum berfungsi** — atas permintaan user.
4. **Migration 002 belum dijalankan** (Tahap A di handoff pertama) dan keputusan
   `user_prefs_aingespace` (Tahap G) masih menggantung. Keduanya menunggu user.

---

## §8 — Satu keputusan yang perlu ditanyakan ke user

Kartu **Recent** saat ini dirancang **meng-isi** working folder + layout ke draft
baru (§1 keputusan 6). Alternatifnya: klik = **langsung membuka** workspace lama
itu (`router.push('/workspace/<id>')`), yang lebih dekat ke arti "Last opened
workspaces" di image #3 tapi aneh dilakukan dari dalam dialog *buat baru*.

Kalau user memilih "langsung buka", perubahannya kecil: `onCreated` tidak
dipakai, cukup `onClose()` + navigasi, dan dialog perlu prop navigasi baru
(`onOpenWorkspace?: (id: string) => void`) karena `CreateWorkspaceDialog`
sekarang tidak tahu apa-apa soal routing.

---

## §9 — Git

Branch `master`, user git `RadityaWirayudha`. Commit terakhir:
`8a8414a feat: implement workspace creation dialog with product selection`.

Semua perubahan di §2 **belum di-commit**. Jangan commit/push tanpa diminta
user. Kalau diminta, jangan commit dalam keadaan typecheck merah — selesaikan §4
lebih dulu.
