# Handoff 5 — Recent + Presets di CreateWorkspaceDialog

Lanjutan dari `buat-workspace-handoff-4.md`. File ini hanya membahas satu permintaan
user dan tidak menambah cakupan apa pun di luar itu.

**Status singkat: bagian (a), (b), dan (c) sudah selesai dan build bersih.**
`npx tsc -p tsconfig.json --noEmit` tidak mengeluarkan apa pun, dan lint pada file-file
yang disentuh hanya menyisakan satu error yang memang sudah ada sejak sebelum pekerjaan
ini (lihat §3). Yang tersisa hanyalah verifikasi manual di aplikasi desktop.

---

## 1. Permintaan user (verbatim, diterjemahkan ke tugas)

> "Gua mau untuk bagian **"Recent"** itu seperti ini ya (sesuai gambar), jadi dia itu
> di atasnya bagian "Presets" … kamu lihat coba di sistem recent workspace aku itu apa
> di bagian PurpSpace ini, kalo gak ada ya, tolong kamu berikan informasi ke user, yang
> membikin user paham/tidak bingung, boleh kaya, "Kamu belum membikin workspace
> sebelumnya…". Tapi kamu cari teks informasi yang lebih jelas, kamu bisa cek internet
> untuk best practice terkait dengan ini.
>
> Dan juga sekalian untuk bagian **"Presets"** Aku mau presets dengan nama,
> **"PurpVoice"** Direktori dalam presets tersebut itu "C /Users /User /2026 3/PurpVoice"
> Folder PurpVoice sudah aku buat. Sehabis itu agent yang aku pake di presets tersebut,
> aku mau, **"Opencode"** dengan commandnya di terminal itu
> "opencode –dangerously-skip-permissions" agar agent tersebut tidak banyak nanya.
>
> Tolong kamu lakukan untuk saya, respectively."

Tiga bagian:

- **(a)** Tampilan Recent sesuai screenshot, tetap **di atas** Presets.
- **(b)** Empty state Recent dengan teks yang jelas (bukan section-nya disembunyikan).
- **(c)** Preset **PurpVoice** → folder `C:\Users\user\2026 3\PurpVoice`, agen
  **Opencode**, dengan command terminal yang membuat agen tidak banyak bertanya.

---

## 2. Yang SUDAH dikerjakan

### 2.1 Riset (selesai, hasilnya sudah dipakai)

**Empty state.** Pola bakunya: *context* (sebutkan kenapa kosong) + *guidance*
(langkah berikutnya) + satu visual kecil; jangan pakai nada perayaan yang khusus untuk
"user cleared"; dan bedakan "sedang memuat" dari "memang kosong". Ini yang dipakai di
§2.3. Sumber: [Mobbin — Empty State UI Design](https://mobbin.com/glossary/empty-state),
[Bird — UX Writing Best Practices for Microcopy](https://bird.marketing/blog/digital-marketing/guide/ux-design-principles/ux-writing-best-practices/),
[GitLab issue #396716 — improve empty states for first-time users](https://gitlab.com/gitlab-org/gitlab/-/issues/396716),
[Userpilot — Empty states in SaaS](https://userpilot.medium.com/empty-state-in-saas-applications-how-to-design-better-user-experiences-e5a6302a43b5).

**Flag opencode — `--dangerously-skip-permissions` ITU ADA. Jangan "dibetulkan"
jadi `--auto`.**

Flag ini tidak muncul di `opencode --help` dan tidak ada di dokumentasi web, jadi mudah
disangka tidak ada — dan itu memang kesimpulan pertama saya, yang keliru. User yang
benar: dia memang memakainya sehari-hari. Buktinya ada di dalam binari v1.18.11 di mesin
ini (`~/.opencode/bin/opencode.exe`), flag-nya didaftarkan sebagai opsi **hidden**:

```js
.option("yolo",                         {type:"boolean", hidden:true, default:false})
.option("dangerously-skip-permissions", {type:"boolean", hidden:true, default:false})
…
auto: args.auto || args.yolo || args["dangerously-skip-permissions"]
```

Jadi ia alias tersembunyi yang bermuara ke `auto` yang sama persis dengan `--auto`.
Command yang dipakai di kode: **`opencode --dangerously-skip-permissions`**, ejaan yang
memang diketik user.

Satu jebakan yang perlu dijaga: **tanda hubungnya harus dua ASCII `-`, bukan en-dash
`–`** yang sering muncul kalau disalin dari chat. Parser opencode **mengabaikan** flag
yang tidak dikenal alih-alih error — sudah diuji, `opencode --benar-benar-flag-palsu
--version` keluar `exit=0` seperti biasa. Artinya en-dash tidak akan memunculkan pesan
kesalahan apa pun; opencode hanya jalan dengan izin masih menyala tanpa petunjuk kenapa.

Catatan yang tetap berlaku: rule yang di-set eksplisit `"deny"` di `opencode.json` tidak
ditembus oleh flag ini. Config user saat ini (`~/.config/opencode/opencode.json`) tidak
punya blok `permission` sama sekali.
Sumber sekunder (dokumentasinya sendiri memang belum menyebut flag ini):
[OpenCode Permissions](https://opencode.ai/docs/permissions/),
[OpenCode CLI](https://opencode.ai/docs/cli/).

### 2.2 File baru: `src/lib/workspace/agents.ts`

Katalog agen dipindah keluar dari dialog, alasannya sama dengan `layouts.ts`: dua
tempat butuh daftar yang sama. Isinya:

- `interface AgentOption` — field lama (`id/name/provider/model/icon/desc/tokens`)
  ditambah `command: string | null`.
- `AGENT_OPTIONS` — entri baru **`opencode`**
  (`command: "opencode --dangerously-skip-permissions"`) di posisi pertama, lalu
  `a1`–`a5` lama dengan `command: null`.
- `startupCommandsFor(agentIds)` — mengembalikan command dari agen terpilih, urut
  katalog; id yang tidak dikenal dibuang, tidak ditebak.

`id` ditulis ke kolom `workspaces_purpspace.agent_ids`, jadi id lama tidak boleh
dipakai ulang untuk arti lain.

### 2.3 `src/components/CreateWorkspaceDialog.tsx`

Semua perubahan di bawah sudah masuk ke file:

- **Import** — `Layers, Server, Boxes, Brain, BookOpen, Settings2, Bot, Cpu, Sparkles,
  Zap` dihapus (tidak terpakai lagi), `Mic` ditambah, `AGENT_OPTIONS` diimpor.
- **`type RecentStatus = "loading" | "ready" | "offline"`** (baris ~84). "Sedang
  memuat" dan "memang kosong" adalah dua kalimat berbeda; menampilkan yang kedua saat
  yang pertama benar akan terbaca "kamu belum pernah bikin workspace" oleh orang yang
  sudah punya dua puluh.
- **`PRESETS`** (baris ~135) — dulu enam tile mati di balik badge "Coming Soon"
  (`aria-hidden`, `opacity-50`). Sekarang satu preset nyata:
  `{ id: "purpvoice", name: "PurpVoice", icon: Mic, workingDir: "C:\\Users\\user\\2026 3\\PurpVoice", layoutId: "l1", agentIds: ["opencode"] }`.
  Enam tile lama dihapus karena tidak membawa data apa pun.
- **`const AGENTS = AGENT_OPTIONS`** (baris ~147) — sisa file memakai nama lama, jadi
  `AgentsStep` dan `handleLaunch` tidak perlu disentuh.
- **`RecentSection`** (baris ~623) — sekarang menerima prop `status`. `if (items.length
  === 0) return null` **dihapus**. Tiga keadaan: `loading` → dua placeholder pulse
  setinggi kartu; `offline` → "Riwayat workspace tidak bisa dimuat" + penjelasan bahwa
  pembuatan workspace tetap jalan; `ready` + kosong → "Kamu belum pernah membuat
  workspace" + apa yang akan mengisinya + "Lanjutkan saja di bawah — yang ini akan jadi
  yang pertama." Badge angka disembunyikan saat kosong. Grid kartu (folder icon, nama
  tebal, path mono redup, jumlah terminal di kanan) **tidak diubah** — bagian itu sudah
  cocok dengan screenshot sejak awal.
- **`LayoutStep`** (baris ~738) — tanda tangan bertambah `recentStatus`,
  `activePresetId`, `onApplyPreset`. Blok Presets sekarang tombol beneran: badge
  "Coming Soon" diganti badge jumlah, tiap tile menampilkan `compactPath(workingDir)`,
  jumlah terminal, dan nama agen, serta menyala ungu saat cocok dengan draft.
  `<RecentSection>` tetap dirender **sebelum** blok Presets (urutan sesuai permintaan
  user, dan memang sudah begitu sebelumnya).
- **`recentStatus` state** (baris ~1014) dan efek fetch Recent — `setRecentStatus("ready")`
  di `.then`, `setRecentStatus("offline")` di `.catch`. Keduanya di dalam callback
  promise, **bukan** di badan efek, karena `react-hooks/set-state-in-effect` adalah
  *error* di repo ini. `reset()` sengaja tidak menyentuhnya, sama seperti `recent`.
- **Call site `<LayoutStep …>`** (baris ~1480) — sudah dioper `recentStatus`,
  `activePresetId`, `onApplyPreset`.

---

## 3. Yang sudah diselesaikan setelah handoff ini ditulis

### 3.1 Dua simbol yang hilang — SELESAI

`applyPreset` dan `activePresetId` sekarang ada di `CreateWorkspaceDialog`, tepat sebelum
`enterChildFolder`, persis sebentuk yang dijelaskan di versi sebelumnya file ini:
`applyPreset` mengubah tepat tiga hal (`setPickedDir` + `setDirCommand("")`,
`setLayoutId`, `setAgents` yang **mengganti** peta agen, bukan menggabungnya) lalu
`setShowErrors(false)`; `activePresetId` membandingkan folder, layout, dan himpunan agen
**persis sama**, bukan superset. `npx tsc -p tsconfig.json --noEmit` bersih.

### 3.2 Command Opencode benar-benar dijalankan — SELESAI

Rantai `cwd` + command sekarang tersambung dari workspace sampai ke PTY. Perubahannya:

- **`src/features/terminal/shell-launch.tsx` (baru).** `ShellLaunchProvider` +
  `useShellLaunch`. Context, bukan variabel global — alasannya ditulis ulang di kepala
  file: efek anak jalan sebelum efek induk, jadi global akan kosong tepat pada terminal
  pertama. Nilai context memegang peta penugasan yang bisa berubah; tidak ada yang
  re-render karenanya.
- **`src/features/terminal/terminal-instances.ts`.** `ShellLaunch { cwd?, startupCommand? }`
  diekspor; `attachInstance(id, el, launch)` → `createInstance(id, launch)` →
  `attachPty(inst, desktop, launch)`, yang meneruskan `cwd` ke `acquirePtySession` dan
  menulis `command + "\r"` setelah `result.ok`. Argumen `launch` opsional (default `{}`),
  jadi pemanggil lama tidak berubah perilakunya.
  **Ada satu penjaga tambahan yang tidak ada di rancangan awal**: `const started =
  new Set<string>()`. "Sekali per `createInstance`" ternyata belum cukup — kalau sebuah
  pane dilepas lalu dipasang lagi dalam 500 ms grace window PTY, `acquirePtySession`
  mengembalikan sesi yang **masih hidup** dan `result.ok` bernilai true lagi, sehingga
  command akan diketikkan kedua kali ke shell yang sudah menjalankan agen. Set ini
  sengaja tidak pernah dibersihkan, termasuk di `disposeInstance`.
- **`src/features/terminal/TerminalPanel.tsx`.** Membaca context dan menyimpannya di ref
  (pola yang sama dengan `onFocusRef`) supaya provider yang re-render tidak memicu ulang
  efek attach. Deps efek tetap `[terminalId]`.
- **`src/features/workspace/PurpSpaceLayout.tsx`.** `WorkspaceData.workingDir?` diisi dari
  `row.working_dir` saat hidrasi dan dari `draft.workingDir` di `handleWorkspaceCreated`
  (keduanya `.trim() || undefined`, karena string kosong bukan berarti "tidak ada
  preferensi"). Grid pane dibungkus `ShellLaunchProvider`; providernya tidak menghasilkan
  DOM sehingga layout grid tidak berubah.

Rantai ke main process sudah diverifikasi ulang, bukan diasumsikan: `preload.ts:82`
meneruskan `opts` apa adanya, `main.ts:96` memanggil `manager.create(id, opts ?? {})`, dan
`pty-manager.ts:103` memvalidasi lewat `isDirectory()` yang mengembalikan `false` untuk
`undefined` — jadi path workspace yang sudah dihapus akan turun ke folder default, bukan
gagal spawn.

Dua asumsi yang paling gampang salah juga sudah **dibuktikan dengan menjalankan PTY-nya**,
bukan dibaca dari kode saja. `scripts/tmp/pty-startup-test.cjs` (jalankan dengan
`npx electron scripts/tmp/pty-startup-test.cjs`) menspawn PowerShell dengan
`cwd: "C:/Users/user/2026 3/PurpVoice"` lalu langsung menulis satu command tanpa delay
sama sekali. Hasilnya:

```
PS C:\Users\user\2026 3\PurpVoice> Write-Output MARKER-OK
MARKER-OK
cwd landed: true
command ran: true
```

Jadi `cwd` benar sampai, dan menulis tanpa menunggu prompt **tidak** kehilangan input —
pseudoconsole-nya menyangga stdin. Di stream mentahnya terlihat ConPTY sempat menggambar
ulang baris input ("Write-Output MWrite-Output MARKE…"); itu repaint biasa saat shell baru
naik, dan baris akhirnya utuh. Karena itu `attachPty` sengaja **tidak** memakai `setTimeout`
sebelum menulis: timer hanya akan jadi terkaan soal berapa lama shell menyala.

**Pertanyaan produk yang tadinya terbuka, dan aturan yang dipilih.** Kalau satu workspace
punya beberapa terminal, command dibagikan **satu agen per terminal, urut mount** (untuk
tree pane yang baru, itu sama dengan urutan kiri-ke-kanan), dan tiap terminal mengingat
jatahnya lewat `terminalId`. Terminal yang lebih banyak dari agen tidak menjalankan apa
pun; agen yang lebih banyak dari terminal tidak jalan sama sekali. Aturan ini dipilih
karena teks di `AgentsStep` sudah menjanjikannya ("Agen dimulai di panel terminal
masing-masing saat workspace dibuka"), dan untuk preset PurpVoice sendiri (`l1` = 1
terminal, 1 agen) hasilnya tidak ambigu. Kalau user mau aturan lain, satu-satunya tempat
yang perlu diubah adalah `claim()` di `shell-launch.tsx`.

### 3.3 Yang masih perlu dilakukan user (manual, tidak bisa diverifikasi dari sini)

Jalankan `npm run dev:desktop`, buat workspace dari preset **PurpVoice**, lalu pastikan:

1. Kotak folder terisi `C:\Users\user\2026 3\PurpVoice` dan tile presetnya menyala.
2. Terminalnya terbuka **di folder itu** (`pwd` / prompt-nya).
3. Baris `opencode --dangerously-skip-permissions` terketik sendiri dan opencode jalan
   tanpa menanyakan izin.
4. Tutup pane lalu buka workspace lain dan kembali — command **tidak** boleh terketik
   dua kali.

Catatan lint yang masih berlaku: **lint global bukan gate di repo ini** — ada ~320
pelanggaran `react-hooks/set-state-in-effect` yang sudah ada sebelumnya. Satu-satunya
error yang tersisa pada file-file di atas adalah `PurpSpaceLayout.tsx:306` (`void
loadPanes(...)` di dalam efek), yang di HEAD ada di baris 296 dan **tidak boleh**
"diperbaiki" sebagai bagian dari pekerjaan ini.

---

## 4. Aturan repo yang berlaku selama pekerjaan ini

- `AGENTS.md`: "This is NOT the Next.js you know" — baca
  `node_modules/next/dist/docs/` sebelum menulis kode Next (Next 16.2.11).
- **Jangan commit atau push kecuali user meminta.** Belum ada yang di-commit dari
  pekerjaan ini. `git status`: `M src/components/CreateWorkspaceDialog.tsx`,
  `?? src/lib/workspace/agents.ts`. HEAD saat handoff ini ditulis: `601cbb3` (commit
  buatan user).
- `react-hooks/set-state-in-effect` = **error**; setiap `setState` hasil fetch harus
  berada di dalam `.then`/`.catch`, tidak pernah di badan efek.
- Supabase hanya dari sisi server lewat `SUPABASE_SERVICE_ROLE_KEY`. RLS aktif tanpa
  policy — **sengaja**. Kalau query dari browser mengembalikan array kosong, **jangan**
  matikan RLS; pindahkan query ke route handler.
- `src/lib/supabase/client.ts` (anon key) sudah dihapus dan **tidak boleh dibuat lagi**.
- Jangan pernah mencetak isi `.env.local`.
- `supabase/migrations/002_*.sql` bersifat **destruktif** dan tidak boleh dijalankan
  ulang. Skema sudah benar setelah 003 + 004; `scripts/tmp/roundtrip.mjs` lulus 7/7.
- Permintaan berdiri user: "jangan terlalu boros atau apapun itu, aku mau database
  bener-bener terpakai, bukan hanya pajangan doang."

## 5. Sisa dari handoff 4 yang belum tersentuh (jangan dikerjakan tanpa diminta)

Didaftar supaya tidak hilang, bukan sebagai tugas:

- `npm run dev:desktop` belum pernah dijalankan untuk melihat mark PurpSpace di sidebar
  rail, header, dan menu bar; langkah manual §7.2 nomor 4, 9, 10 juga belum.
- `npm run build:desktop` (bukan `dev:desktop`) adalah yang menghasilkan installer
  `dist/PurpSpace-Setup-0.1.0-x64.exe`.
- Sisa BridgeMind di luar repo: `%LOCALAPPDATA%\Programs\BridgeMind\`,
  `Start Menu\Programs\BridgeMind.lnk`, `%APPDATA%\BridgeMind\`. **Jangan hapus file di
  luar repo tanpa konfirmasi user.**
- Keputusan `user_prefs_purpspace` masih menggantung.
- Pertanyaan lama yang sekarang relevan: kartu Recent mengisi draft (perilaku sekarang)
  atau membuka workspace lama? Belum dijawab user.
