# Handoff 5 — Recent + Presets di CreateWorkspaceDialog

Lanjutan dari `buat-workspace-handoff-4.md`. File ini hanya membahas satu permintaan
user dan tidak menambah cakupan apa pun di luar itu.

**Status singkat: pekerjaan berhenti di tengah. `npm run typecheck` GAGAL dengan 2
error.** Bagian §3 di bawah adalah hal pertama yang harus dikerjakan.

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

## 3. Yang BELUM dikerjakan — kerjakan ini lebih dulu

### 3.1 Dua simbol yang dipakai tapi belum didefinisikan (build merah)

```
$ npx tsc -p tsconfig.json --noEmit
src/components/CreateWorkspaceDialog.tsx(1484,33): error TS2304: Cannot find name 'activePresetId'.
src/components/CreateWorkspaceDialog.tsx(1485,32): error TS2304: Cannot find name 'applyPreset'.
```

Keduanya sudah dioper ke `LayoutStep` tapi belum dibuat di dalam
`CreateWorkspaceDialog`. Tempat yang wajar: dekat `pickRecent` (baris ~1236), setelah
`resolvedWorkingDir` (baris ~1151) karena `activePresetId` membacanya.

Bentuk yang dimaksud saat call site itu ditulis:

- **`applyPreset(preset)`** — `useCallback`, mengubah tepat tiga hal dan tidak lebih:
  `setPickedDir(preset.workingDir)` + `setDirCommand("")` (baris `cd` yang belum
  dijalankan harus dibuang, kalau tidak ia akan memindahkan folder lagi saat blur
  berikutnya — sama seperti `browseForFolder`), `setLayoutId(preset.layoutId)`,
  `setAgents(Object.fromEntries(preset.agentIds.map((id) => [id, true])))`, lalu
  `setShowErrors(false)`. Jangan tambahkan efek samping lain: komentar di atas `PRESETS`
  menjanjikan bahwa hanya field-field itu yang dibaca.
- **`activePresetId`** — `useMemo`, mengembalikan `p.id` bila `p.workingDir ===
  resolvedWorkingDir` **dan** `p.layoutId === layoutId` **dan** himpunan agen aktif
  (`AGENTS.filter((a) => agents[a.id]).map((a) => a.id)`) sama persis dengan
  `p.agentIds` — bukan sekadar superset, supaya tile tidak menyala saat user sudah
  menambah agen lain. Selain itu `null`. Deps: `resolvedWorkingDir`, `layoutId`, `agents`.

Setelah itu jalankan `npx tsc -p tsconfig.json --noEmit` (harus bersih) dan
`npx eslint src/components/CreateWorkspaceDialog.tsx src/lib/workspace/agents.ts`.
**Lint global bukan gate di repo ini** — ada ~320 pelanggaran
`react-hooks/set-state-in-effect` yang sudah ada sebelumnya, termasuk
`PurpSpaceLayout.tsx:296`, dan itu **tidak boleh** ikut "diperbaiki". Lint file yang
disentuh saja.

### 3.2 Command Opencode belum benar-benar dijalankan

Ini bagian (c) yang belum tuntas dan **keputusannya ada di user**, bukan di agent.

Keadaan sekarang: `agent_ids` (termasuk `"opencode"`) ditulis ke database, dibaca lagi
ke `WorkspaceData.agentIds`, dan dihitung untuk footer pane — **tapi tidak ada satu
jalur pun yang menjalankan command apa pun**, dan `cwd` tidak pernah sampai ke PTY.
Jadi hari ini preset PurpVoice mengisi form dengan benar dan tersimpan dengan benar,
tetapi terminalnya tetap membuka shell polos di folder default, bukan
`opencode --dangerously-skip-permissions` di `C:\Users\user\2026 3\PurpVoice`.

Bukti spesifik, jangan diriset ulang:

- `src/features/terminal/terminal-instances.ts:290` — `attachPty` memanggil
  `acquirePtySession(desktop, id, { cols, rows, onData, onExit })`, **tanpa `cwd`**.
- `src/features/terminal/pty-session.ts:77` — `AcquireOptions` **sudah** punya
  `cwd?: string` dan meneruskannya ke `bridge.terminal.create`.
- `electron/pty-manager.ts:103` — main process **sudah** menghormati `cwd`.
- `src/features/terminal/TerminalPanel.tsx:41` — satu-satunya pemanggil
  `attachInstance(terminalId, el)`; tidak membawa konteks workspace sama sekali.
- `src/features/workspace/PurpSpaceLayout.tsx:53` — `interface WorkspaceData` **tidak
  punya** `workingDir`; hidrasi di baris ~208 dan `handleWorkspaceCreated` di baris ~340
  keduanya tidak mengisinya.
- Rantai render: `PurpSpaceLayout:693` → `PaneTerminalManager({paneId})` →
  `TerminalNode` → `TerminalLeafView` → `TerminalPanel` — tidak ada satu pun yang
  mengetahui folder kerja workspace.

Rancangan yang sudah disiapkan (tinggal dieksekusi kalau user setuju): tambah
`workingDir` ke `WorkspaceData`, sediakan React **context** berisi
`{ cwd, startupCommands: startupCommandsFor(ws.agentIds) }` di sekitar grid pane,
konsumsi di `TerminalPanel` lewat ref, dan oper sebagai argumen ketiga
`attachInstance(terminalId, el, launch)` → `createInstance(id, launch)` → `attachPty`,
yang meneruskan `cwd` ke `acquirePtySession` dan menulis tiap command + `"\r"` setelah
`result.ok`. Karena `createInstance` hanya jalan sekali per `terminalId`, command jalan
sekali per terminal tanpa flag tambahan.

**Wajib pakai context, bukan variabel global "cwd saat ini" di level modul** — efek anak
mount sebelum efek induk, jadi global akan terbaca kosong pada terminal pertama.

Handoff 4 §4 menandai perubahan ini sebagai "harus tanya user dulu" karena menyentuh
inti terminal. Ada satu pertanyaan produk yang belum terjawab dan harus ditanyakan
sekalian: **kalau satu workspace punya beberapa terminal, apakah command agen jalan di
semua terminal atau hanya di terminal pertama?** Untuk preset PurpVoice sendiri hal ini
tidak terasa (layout `l1` = 1 terminal, 1 agen), jadi bagian (c) bisa dianggap selesai
untuk kasus user tanpa menjawabnya — tapi jangan diputuskan sendiri untuk kasus umum.

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
