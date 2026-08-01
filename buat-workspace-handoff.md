# Handoff — Rombak Dialog "Buat Workspace"

**Status pekerjaan ini: BELUM DIMULAI. Nol baris kode ditulis.**
Yang sudah ada di dokumen ini adalah hasil pembacaan file, dua keputusan user
yang sudah final, dan rencana yang tinggal dieksekusi.

File yang disentuh: **`src/components/CreateWorkspaceDialog.tsx` saja** (891 baris).
Tidak ada perubahan skema database, tidak ada perubahan route handler.

> Dokumen pendamping: `database_handoff.md`. Baca §4 di sana — ada dua hal lain
> yang masih menunggu keputusan user (Tahap A: migration belum dijalankan;
> Tahap G: tabel preferensi). Keduanya **di luar** lingkup handoff ini, tapi
> Tahap A membuat seluruh UI tersimpan gagal sampai dijalankan.

---

## 0. Instruksi untuk agent penerus

1. Baca `AGENTS.md` dulu. Next.js di project ini versi 16 dengan breaking change
   — baca `node_modules/next/dist/docs/` sebelum menulis kode, jangan
   mengandalkan ingatan.
2. Baca dokumen ini sampai habis sebelum menyentuh kode. §5 berisi jebakan yang
   akan memakan waktu kalau ditemukan sendiri.
3. Bahasa komentar kode: **Inggris** (ikut gaya codebase). Bahasa string UI:
   **Indonesia**.
4. Jangan melebarkan lingkup. User sudah menjawab dua pertanyaan justru untuk
   mempersempitnya — lihat §1.2.

---

## 1. Permintaan user

### 1.1 Permintaan asli (verbatim)

> "Ketika buat workspace, saya mau prosedur pertama dari tiga, yakni repositori
> itu diganti dengan fitur yang ada aingespace nantinya. Untuk sekarang baru ada
> AiNgeSpace. Di bawah dari pilihan AiNgeSpace, itu ada AiNgeCommit dan AiNgIDE,
> tulis keterangan saja dalam tampilan kalau, "Comming Soon.""

Terjemahan ke pekerjaan konkret: **langkah 1 dari 3 yang sekarang bernama
"Repositori" berubah jadi pemilih produk.** Isinya tiga produk:

| Produk | Status |
|---|---|
| **AiNgeSpace** | satu-satunya yang bisa dipilih, jadi pilihan default |
| **AiNgeCommit** | tampil di bawahnya, ditandai *Coming Soon*, tidak bisa dipilih |
| **AiNgIDE** | sama |

Catatan ejaan: user menulis "Comming Soon". Yang ditulis ke UI adalah ejaan yang
benar, **"Coming Soon"**.

### 1.2 Dua keputusan user — sudah final, jangan ditanyakan ulang

Kedua pertanyaan ini sudah diajukan dan sudah dijawab lewat dialog pilihan:

**A. Field "Repositori GitHub" dan "Cabang" mau diapakan?**
→ Jawaban user: **"Pindah ke langkah 2."**
Jadi susunan langkah menjadi:

```
1 Produk   →   2 Repo & Layout   →   3 Agen
```

Alasan pilihan ini penting: `workspaces_aingespace.github_repo` adalah kolom
**NOT NULL** dengan CHECK `^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`. Menghapus input
repo sama saja memaksa perubahan skema. Memindahkannya tidak mengubah apa pun di
database.

**B. Pilihan produk mau disimpan ke database?**
→ Jawaban user: **"Tampilan saja dulu."**
**Tidak ada kolom baru. Tidak ada perubahan `WorkspaceDraft`. Tidak ada
perubahan body POST.** Konsisten dengan permintaan berdiri user soal database:
*"aku mau database bener-bener terpakai, bukan hanya pajangan doang"* — kolom
yang hanya pernah berisi satu nilai belum membawa informasi apa pun.

> ⚠️ Godaan yang harus ditolak: menambahkan `productId` ke `WorkspaceDraft` "biar
> rapi". Tidak ada satu pun konsumen `WorkspaceDraft` yang membacanya
> (`src/app/dashboard/page.tsx` dan `src/features/workspace/BridgeMindLayout.tsx`).
> Field tanpa pembaca adalah pajangan yang sama persis, cuma pindah lapisan.

---

## 2. Anatomi file saat ini

`src/components/CreateWorkspaceDialog.tsx` — nomor baris per keadaan sekarang
(commit terakhir, working tree bersih).

| Baris | Isi |
|---|---|
| 4–24 | import ikon lucide: `X, Check, ChevronRight, ChevronLeft, Folder, GitBranch, Terminal, Layers, Server, Boxes, Brain, BookOpen, Settings2, Bot, Cpu, Sparkles, Zap, Play, AlertCircle` |
| 37–50 | `interface WorkspaceDraft` — **jangan diubah** (lihat §1.2 B) |
| 61–65 | `const STEPS` — label langkah, dipakai `Stepper` |
| 71 | `const LAYOUTS = LAYOUT_PRESETS` (dari `@/lib/workspace/layouts`) |
| 73–80 | `const PRESETS` — 6 prasetel layout+agen |
| 82–88 | `const AGENTS` — 5 agen |
| 93–144 | `GridPreview` |
| 149–178 | `Toggle` |
| 183–228 | `Stepper` — merender `STEPS` apa adanya |
| 233–259 | `Field` (label + hint + error) |
| 261–262 | `inputCls` |
| **267–346** | **`RepositoryStep`** — berisi *Nama workspace* + *Repositori GitHub* + *Cabang*. Inilah yang dibongkar. |
| 351–472 | `LayoutStep` — radiogroup layout + grid prasetel |
| 477–552 | `AgentsStep` |
| 560 | `let localWorkspaceSeq = 0` |
| 567–576 | state dialog: `step, showErrors, workspaceName, repoUrl, branch, layoutId, presetId, agents, submitting, submitError` |
| 580–591 | `reset()` |
| 600–615 | efek Escape + scroll lock |
| 619–649 | efek focus trap (dep: `[open, step]`) |
| 651–665 | `toggleAgent`, `applyPreset` |
| **667–682** | **`heading`** useMemo — judul per langkah |
| **684–686** | **`step1Valid`** — nama **dan** regex repo |
| 688–744 | `handleLaunch` — POST `/api/workspaces` |
| **746–754** | **`goNext`** — hanya memvalidasi langkah 1 |
| **796–818** | render bercabang `step === 1 / 2 / 3` |
| **828–887** | footer: "Kembali", "Lewati", tombol utama |

---

## 3. Rencana eksekusi

Delapan perubahan, semuanya di satu file. Urutannya sengaja dari data ke render.

### 3.1 `STEPS` (baris 61)

```ts
const STEPS = [
  { id: 1, label: "Produk" },
  { id: 2, label: "Repo & Layout" },
  { id: 3, label: "Agen" },
] as const
```

Label langkah 2 sengaja disingkat. `Stepper` menaruh ketiganya dalam satu baris
di dialog selebar 640px; "Repositori & Layout" bikin mepet.

### 3.2 `PRODUCTS` — konstanta baru, taruh tepat di atas `LAYOUTS`

```ts
// UI only, deliberately: two of the three do not exist yet, and the workspace
// row has no column for this. A field that can only ever hold one value carries
// no information — see buat-workspace-handoff.md §1.2.
const PRODUCTS = [
  {
    id: "aingespace",
    name: "AiNgeSpace",
    icon: Terminal,
    desc: "Terminal paralel dengan agen di tiap panel.",
    available: true,
  },
  {
    id: "aingecommit",
    name: "AiNgeCommit",
    icon: GitBranch,
    desc: "Alur commit dan review yang dibantu agen.",
    available: false,
  },
  {
    id: "aingeide",
    name: "AiNgIDE",
    icon: Braces,
    desc: "Editor penuh di dalam workspace yang sama.",
    available: false,
  },
] as const
```

Ejaan nama produk: **AiNgeSpace**, **AiNgeCommit**, **AiNgIDE** — persis seperti
yang user tulis. Perhatikan yang ketiga **tanpa "e"** setelah "AiNg".

`Terminal` dan `GitBranch` sudah diimpor di baris 10–11. **`Braces` belum** —
tambahkan ke daftar import. Sudah diverifikasi ada di
`node_modules/lucide-react/dist/lucide-react.d.ts` versi ini (begitu juga
`Code`, `Code2`, `CodeXml`, `SquareTerminal`, `PanelsTopLeft`,
`GitCommitVertical` kalau mau alternatif). Lihat §5.1 — jangan menebak nama
ikon.

### 3.3 `ProductStep` — komponen baru, gantikan tempat `RepositoryStep` sebagai langkah 1

Isinya: field **Nama workspace** (dipindah dari `RepositoryStep`) + radiogroup
produk.

```tsx
function ProductStep({
  workspaceName,
  setWorkspaceName,
  productId,
  setProductId,
  showErrors,
}: {
  workspaceName: string
  setWorkspaceName: (v: string) => void
  productId: string
  setProductId: (v: string) => void
  showErrors: boolean
}) {
  const nameError =
    showErrors && !workspaceName.trim() ? "Nama workspace wajib diisi." : undefined
  ...
}
```

Aturan render tiap produk:

- Tombol `role="radio"` dengan `aria-checked={productId === p.id}`.
- Yang `available: false` → `disabled` **dan** `aria-disabled="true"`,
  `cursor-not-allowed`, opasitas diturunkan, `onClick` tidak dipasang.
- Badge "Coming Soon" di sisi kanan baris produk. Pakai
  `<Badge variant="secondary">` yang sudah diimpor di baris 27, atau `<span>`
  bergaya seperti badge token di `AgentsStep` baris 534.
- Ikon centang `<Check className="size-3.5 text-purple" strokeWidth={2.5} />`
  pada produk yang terpilih, mengikuti pola `PRESETS` di baris 457.

Gaya kartu yang konsisten dengan sisa dialog:

```
terpilih   : "bg-purple/10 border-purple"
tersedia   : "bg-secondary border-border hover:border-zinc-500"
coming soon: "bg-secondary/50 border-border opacity-60 cursor-not-allowed"
```

Tombol `disabled` juga otomatis terlewat oleh focus trap (baris 633 memfilter
`button:not([disabled])`), jadi Tab tidak akan mendarat di produk yang belum ada.
Itu perilaku yang diinginkan.

### 3.4 `RepositoryStep` → hanya repo + cabang

Buang `Field` "Nama workspace" (baris 295–307) beserta prop `workspaceName` /
`setWorkspaceName` dan `nameError`. Sisakan "Repositori GitHub" dan "Cabang".
Regex validasi tetap `/^[\w.-]+\/[\w.-]+$/`.

Pertimbangkan mengganti nama komponen jadi `RepoFieldsStep` supaya tidak
menyesatkan setelah langkah 1 bukan lagi repositori. Kalau diganti, ganti juga
komentar header `LANGKAH 1 — REPOSITORI` di baris 264–266.

### 3.5 Langkah 2 = repo + layout dalam satu badan

Di blok render, `step === 2` merender keduanya berurutan:

```tsx
{step === 2 && (
  <div className="space-y-7">
    <RepoFieldsStep
      repoUrl={repoUrl}
      setRepoUrl={setRepoUrl}
      branch={branch}
      setBranch={setBranch}
      showErrors={showErrors}
    />
    <LayoutStep ... />
  </div>
)}
```

Langkah 2 jadi padat — user sudah tahu dan menerima itu ("langkah 2 jadi padat"
tertulis di opsi yang mereka pilih). Badan dialog sudah `overflow-y-auto` sejak
baris 783, jadi tidak ada yang terpotong di layar laptop.

### 3.6 State + `reset()`

Tambah satu state saja:

```ts
const [productId, setProductId] = useState("aingespace")
```

dan di `reset()` (baris 580): `setProductId("aingespace")`.

Default-nya bukan `null` karena hanya ada satu produk yang bisa dipilih —
memaksa user mengklik satu-satunya pilihan yang hidup itu birokrasi kosong.

### 3.7 Validasi terbelah

```ts
const step1Valid = workspaceName.trim().length > 0
const step2Valid = /^[\w.-]+\/[\w.-]+$/.test(repoUrl.trim())
```

Tiga tempat yang harus ikut berubah:

1. **`goNext`** (baris 746) — sekarang hanya memeriksa langkah 1:
   ```ts
   const goNext = () => {
     const valid = step === 1 ? step1Valid : step2Valid
     if (!valid) {
       setShowErrors(true)
       return
     }
     setShowErrors(false)
     setStep((s) => Math.min(3, s + 1))
   }
   ```
2. **Tombol "Lewati"** (baris 846–863) — melompat ke langkah 3, jadi ia harus
   memvalidasi **kedua** langkah dan mendarat di yang pertama gagal:
   ```ts
   if (!step1Valid) { setShowErrors(true); setStep(1); return }
   if (!step2Valid) { setShowErrors(true); setStep(2); return }
   setStep(3)
   ```
   Kalau ini dilewat, "Lewati" akan mengirim `githubRepo: ""` ke POST, ditolak
   CHECK constraint, dan user mendarat di fallback `local-ws-N` tanpa tahu
   kenapa. Ini jebakan paling mudah kelewat di seluruh pekerjaan ini.
3. **`productId` tidak ikut validasi** — selalu terisi.

### 3.8 Teks: `heading` dan label tombol

`heading` (baris 667):

```ts
step 1 → { title: "Pilih produk", sub: "Fitur AiNgeSpace mana yang dijalankan workspace ini." }
step 2 → { title: "Repo dan layout", sub: "Hubungkan repo GitHub lalu tentukan jumlah panel terminal." }
step 3 → { title: "Tambah agen AI", sub: "Pilih agen yang otomatis dijalankan saat workspace dibuka." }
```

Tombol utama (baris 873–879):

```
step 1 → "Berikut: repo & layout"
step 2 → "Berikut: agen"
step 3 → submitting ? "Membuat…" : "Luncurkan workspace"
```

### 3.9 Yang TIDAK berubah

- `handleLaunch` (688–744) — utuh. Tetap mengirim `name`, `githubRepo`,
  `githubBranch`, `layoutPreset`, `agentIds`.
- `WorkspaceDraft` (37–50).
- `POST /api/workspaces`, `src/types/database.ts`, migration.
- `AgentsStep`, `LayoutStep`, `GridPreview`, `Toggle`, `Field`, `Stepper`.

---

## 4. Jebakan

### 4.1 Nama ikon lucide di versi ini tidak seperti ingatanmu

`lucide-react` versi project ini **tidak mengekspor `Github`** — ikon brand sudah
dibuang. Ini sudah pernah menghantam sesi sebelumnya, muncul sebagai
`TS2305: Module '"lucide-react"' has no exported member 'Github'` di
`src/app/dashboard/page.tsx`.

Sebelum memakai nama ikon yang belum ada di daftar import file ini, verifikasi:

```bash
grep -oE "\bNamaIkon\b" node_modules/lucide-react/dist/lucide-react.d.ts | head -1
```

`Braces` sudah diverifikasi ada.

### 4.2 ESLint `react-hooks/set-state-in-effect`

`setState` sinkron di dalam badan `useEffect` adalah **error** (bukan warning) di
konfigurasi repo ini. Pekerjaan ini seharusnya tidak menambah efek baru sama
sekali — kalau kamu merasa butuh satu (misal "reset produk saat dialog dibuka"),
jangan. `reset()` sudah dipanggil dari `handleClose`, dan itu event handler.

Repo sudah punya **ratusan error** dari aturan ini sebelum pekerjaan ini dimulai
(`npm run lint` global melaporkan sekitar 320+ error, termasuk
`src/lib/clerk/provider.tsx` dan folder `dist/` yang ikut ter-lint). Jadi jangan
pakai `npm run lint` global sebagai penentu — lihat §5.

### 4.3 Focus trap membaca DOM, bukan state

Efek di baris 619–649 punya dep `[open, step]` dan memanggil
`node.querySelector("input, button:not([disabled])")` untuk memfokuskan elemen
pertama. Setelah langkah 1 berubah dari "punya input di paling atas" menjadi
"punya input nama lalu tombol produk", elemen pertama tetap input nama —
selama field nama diletakkan **di atas** radiogroup produk. Kalau kamu membalik
urutannya, fokus awal pindah ke tombol produk. Taruh nama di atas.

### 4.4 Tombol produk yang disabled dan `aria`

Tombol dengan `role="radio"` yang `disabled` tetap perlu `aria-checked={false}`
supaya pembaca layar tidak menganggapnya rusak. Jangan memberi `aria-disabled`
saja tanpa `disabled`, atau sebaliknya tanpa alasan — di sini keduanya benar:
`disabled` mengeluarkannya dari focus trap, `aria-disabled` menjelaskan alasannya.

### 4.5 Ini dialog, bukan halaman

Semua string UI Indonesia. Semua komentar kode Inggris. Dialog dipakai dari dua
tempat — `src/app/dashboard/page.tsx` (baris 248) dan
`src/features/workspace/BridgeMindLayout.tsx` — keduanya hanya membaca
`onCreated(draft)`. Selama `WorkspaceDraft` tidak berubah, tidak ada pemanggil
yang perlu disentuh.

---

## 5. Verifikasi

Wajib lulus sebelum menyatakan selesai:

```bash
npm run typecheck                              # tsc Next + tsc Electron, harus bersih
npx eslint src/components/CreateWorkspaceDialog.tsx
```

**Jangan** pakai `npm run lint` global sebagai gerbang — ratusan error di
dalamnya sudah ada sebelum pekerjaan ini (lihat §4.2). Lint hanya file yang kamu
sentuh.

Uji manual (`npm run dev:desktop`):

1. Buka dialog. Langkah 1 menampilkan "Produk" di stepper, field nama, dan tiga
   produk. AiNgeSpace terpilih.
2. Klik AiNgeCommit dan AiNgIDE — **tidak terjadi apa-apa**, keduanya bertuliskan
   "Coming Soon".
3. Tab dari field nama: fokus harus melewati kedua produk yang mati.
4. Kosongkan nama → "Berikut: repo & layout" menampilkan error, tidak berpindah.
5. Isi nama, lanjut. Langkah 2 menampilkan repo + cabang **dan** pilihan layout.
6. Kosongkan repo → tombol lanjut menampilkan error dan bertahan di langkah 2.
7. Kembali ke langkah 1, tekan **"Lewati"** dengan repo masih kosong → harus
   mendarat di **langkah 2** dengan error tampil, bukan lompat ke langkah 3.
8. Isi repo `user/repo`, pilih layout 4 terminal, lanjut, aktifkan dua agen,
   "Luncurkan workspace".
9. Cek di Supabase: baris `workspaces_aingespace` punya `layout_preset = 'l4'`
   dan `agent_ids` berisi dua id. **Ini hanya berhasil kalau Tahap A sudah
   dijalankan** — lihat §6.

---

## 6. Konteks di luar lingkup, tapi perlu diketahui

Dari `database_handoff.md` §4, dua hal masih menunggu **user**, bukan agent:

- **Tahap A — migration `supabase/migrations/002_rewrite_aingespace_schema.sql`
  belum pernah dijalankan.** 🔴 Destruktif: men-`drop` tabel `aingespace_*` dari
  migration 001, termasuk `aingespace_github_connections` (token OAuth
  terenkripsi) dan `aingespace_environment_variables`. **Konfirmasi ke user
  sebelum menjalankan.** Selama belum jalan, POST workspace akan gagal dan
  dialog jatuh ke fallback `local-ws-N` — itu bukan bug dari pekerjaan ini.
- **Tahap G — keputusan soal tabel `user_prefs_aingespace`** untuk keybinding dan
  preferensi sidebar yang sekarang hanya ada di `localStorage`.

Sudah selesai dan **jangan dikerjakan ulang**: Tahap B–F (persistensi
`BridgeMindLayout`, urutan sidebar, dashboard tanpa mock, pembuangan
`"aingespace:pending-layout"`, dan `EnvVarsDialog`). Rinciannya di
`database_handoff.md` §3 dan §4.

---

## 7. Status git

Branch `master`, **working tree bersih** saat handoff ini ditulis. Seluruh
pekerjaan Tahap B–F sudah masuk commit. Tidak ada perubahan yang belum
tersimpan, jadi kamu mulai dari keadaan yang persis sama dengan yang dijelaskan
di §2.
