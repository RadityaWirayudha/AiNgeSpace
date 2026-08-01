# Handoff — Database Supabase AiNgeSpace

**Sesi sebelumnya:** review menyeluruh project + rewrite skema database.
**Status:** skema dan seluruh route handler sudah selesai dan `npm run typecheck`
lulus bersih. Migration **belum dijalankan** ke Supabase, dan UI **belum**
membaca/menulis tabel baru. Itu pekerjaanmu.

---

## 0. Instruksi untuk agent penerus

1. Baca `AGENTS.md` dulu. Next.js di project ini versi 16 dengan breaking change
   — baca `node_modules/next/dist/docs/` sebelum menulis kode, jangan
   mengandalkan ingatan.
2. Baca file ini **sampai habis** sebelum menyentuh kode. Bagian §5 berisi
   jebakan yang sudah terbukti memakan waktu.
3. Jangan mengulang pekerjaan di §3. Semuanya sudah selesai dan terverifikasi.
4. Bahasa komentar kode: Inggris (ikut gaya codebase). Bahasa string UI:
   Indonesia.
5. Verifikasi dengan `npm run typecheck` setiap selesai satu tahap, bukan di
   akhir.

---

## 1. Konteks — bentuk aplikasi ini

Next.js 16 (App Router) + Electron. Terminal asli lewat `node-pty` di main
process, IPC ke renderer, xterm.js di UI. Auth **Clerk** (bukan Supabase Auth).
Supabase diakses **hanya** dari route handler memakai `SUPABASE_SERVICE_ROLE_KEY`.

Yang penting dipahami: aplikasi ini punya **dua layout berbeda** yang sama-sama
hidup di codebase.

| Route | Komponen | Terminal store |
|---|---|---|
| `/bridgemind` | `BridgeMindLayout` | `pane-terminal-store.tsx` (pohon split, fitur utama) |
| `/workspace/[id]` | `WorkspaceView` | `terminal-store.tsx` (versi lama, lebih sederhana) |

Skema baru dirancang untuk model `BridgeMindLayout` — workspace → panes → pohon
terminal. Kalau kamu menyambungkan persistensi, kerjakan dari sisi
`BridgeMindLayout`.

---

## 2. Skema baru — WAJIB DIPAHAMI SEBELUM MENULIS KODE

File: `supabase/migrations/002_rewrite_aingespace_schema.sql`

Konvensi penamaan (permintaan eksplisit user): **`<entitas>_aingespace`**, bukan
`aingespace_<entitas>` seperti di migration 001. Seluruh objek di-drop dengan
`if exists` lebih dulu sehingga file aman dijalankan ulang.

### Empat tabel

```
workspaces_aingespace
  id uuid pk, clerk_user_id text, name, github_repo, github_branch,
  local_path, layout_preset, agent_ids text[], sort_order int,
  created_at, updated_at

panes_aingespace
  id uuid pk, workspace_id -> workspaces (cascade), title, position int,
  pinned bool, tree jsonb, name_seq int, created_at, updated_at

github_connections_aingespace
  id uuid pk, clerk_user_id text UNIQUE, github_user_id, github_username,
  access_token_encrypted, created_at, updated_at

env_vars_aingespace
  id uuid pk, workspace_id -> workspaces (cascade), key, value_encrypted,
  created_at, updated_at, unique(workspace_id, key)
```

### Kenapa hanya empat — jangan ditambah tanpa alasan

User meminta database yang **benar-benar terpakai, bukan pajangan**. Tiga tabel
dari 001 dibuang dengan alasan konkret:

- **`aingespace_users`** — tidak ada satu baris kode pun yang menulisnya. Tidak
  ada webhook Clerk di `src/app/api/`. Identitas milik Clerk; relasi cukup lewat
  `clerk_user_id TEXT` persis seperti ketetapan `v1.md`.
- **`aingespace_ai_sessions`** — **tidak ada kode AI sama sekali** di project
  ini. `OPENROUTER_API_KEY` ada di `.env.example` tapi tidak pernah dibaca.
  Bentuk satu-baris (prompt + response) juga salah untuk percakapan multi-turn.
  Kalau nanti fitur AI dibangun, buat ulang sebagai `sessions` + `messages`.
- **`aingespace_terminals`** — diganti `panes_aingespace` (lihat di bawah).

### Kenapa pohon terminal jadi satu kolom `jsonb`, bukan tabel

Kolom `layout` di 001 berbentuk `{"direction","splitFrom"}` dan **tidak mampu**
menyimpan struktur yang benar-benar dipakai aplikasi. Model asli di
`src/features/terminal/pane-terminal-store.tsx` adalah pohon rekursif:

```ts
leaf  = { type:"leaf",  id, terminalId, name }
split = { type:"split", id, direction, children[], sizes[] }
```

Reducer memperlakukan `trees[paneId]` sebagai **satu nilai immutable** — setiap
SPLIT/CLOSE/RESIZE menghasilkan pohon baru secara utuh. Jadi satu baris per pane
yang menyimpan pohon utuh adalah padanan yang tepat: satu `UPDATE` per perubahan
layout, bukan puluhan baris terminal yang harus disinkronkan.

Bentuknya divalidasi zod di `src/lib/panes/tree-schema.ts` (baru), yang sengaja
mencerminkan `PaneTerminalNode` **persis** — supaya baris database bisa langsung
ditaruh ke `state.trees[paneId]` tanpa lapisan penerjemah. **Kalau kamu menambah
field di node reducer, tambahkan juga di sana.**

### RLS: aktif, tanpa satu pun policy — ini disengaja

Seluruh akses berjalan lewat service role key, dan **service role selalu bypass
RLS**. Artinya ~200 baris policy di migration 001 tidak pernah satu kali pun
dievaluasi — kode mati yang memberi rasa aman palsu.

Yang tetap dibutuhkan adalah RLS-nya sendiri: tanpa itu, siapa pun yang memegang
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (yang memang terkirim ke browser) bisa membaca
seluruh isi tabel. **RLS aktif tanpa policy = anon dan authenticated ditolak
untuk semua operasi, service role tetap lolos.** Otorisasi per-user tetap
dikerjakan di route handler lewat `.eq("clerk_user_id", userId)`.

> ⚠️ Kalau nanti ada query dari browser yang mengembalikan array kosong, **jangan
> matikan RLS**. Itu berarti query-nya lewat jalur yang salah — pindahkan ke
> route handler.

### CHECK constraint yang akan menolak data

Ini bukan hiasan, akan benar-benar menolak `INSERT`:

| Kolom | Aturan |
|---|---|
| `workspaces.github_repo` | `^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$` |
| `workspaces.layout_preset` | salah satu dari `l1 l2v l2h l4 l6 l8` |
| `panes.tree` | objek jsonb dan punya kunci `type` |
| `env_vars.key` | `^[A-Za-z_][A-Za-z0-9_]{0,254}$` |
| `env_vars.value_encrypted` | `^[0-9a-f]+:[0-9a-f]+:[0-9a-f]*$` |
| `github_connections.access_token_encrypted` | `^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$` |

Dua yang terakhir mengunci format keluaran `src/lib/supabase/encryption.ts`
(`iv:tag:ciphertext`, semua hex). **Kalau format enkripsi diubah, dua constraint
ini harus ikut diubah** atau semua insert akan gagal.

---

## 3. Yang SUDAH selesai — jangan dikerjakan ulang

### 3.1 Migration
- ✅ `supabase/migrations/002_rewrite_aingespace_schema.sql` — tabel, index,
  trigger `updated_at`, RLS, seluruh CHECK constraint. Idempoten.
- Index dibuat **hanya** untuk query yang benar-benar ada. `UNIQUE` sudah
  membuat index sendiri jadi tidak diduplikasi (di 001,
  `idx_..._environment_variables_workspace_id` mubazir).

### 3.2 Tipe
- ✅ `src/types/database.ts` ditulis ulang penuh mengikuti empat tabel baru.

### 3.3 Route handler — semua sudah pakai nama tabel & kolom baru

| File | Perubahan |
|---|---|
| `api/workspaces/route.ts` | tabel baru; `layoutPreset` + `agentIds` diterima; `sort_order` otomatis di akhir daftar; **`PATCH` baru** untuk simpan urutan sidebar |
| `api/workspaces/[id]/route.ts` | tabel baru; `single()` → `maybeSingle()` (dulu 404 jadi 500); tolak body kosong |
| `api/panes/route.ts` | **baru**, menggantikan `api/terminals` |
| `api/panes/[id]/route.ts` | **baru**; cek kepemilikan lewat satu query join, bukan dua round trip |
| `api/env/[workspaceId]/route.ts` | tabel + kolom baru; `insert` → `upsert` (dulu ubah nilai dibalas 409) |
| `api/env/[workspaceId]/decrypt/route.ts` | tabel + kolom baru; satu baris gagal decrypt tidak lagi menjatuhkan seluruh response |
| `api/github/callback/route.ts` | tabel + kolom baru; select-then-insert → satu `upsert` |
| `api/github/repos/route.ts` | tabel + kolom baru; `maybeSingle()` |
| `api/github/route.ts` | buang import `createServerClient` yang tidak terpakai |

### 3.4 Bug nyata yang ikut diperbaiki
- **Pilihan agen dibuang diam-diam.** `CreateWorkspaceDialog` membuat user
  memilih sampai lima agen dan sebuah preset layout, lalu `POST /api/workspaces`
  hanya mengirim name/repo/branch. Sekarang `layoutPreset` + `agentIds` ikut
  terkirim dan tersimpan.
- **Kebocoran otorisasi.** `GET /api/terminals?workspaceId=` lama tidak pernah
  memeriksa siapa pemilik workspace — user mana pun yang sudah login bisa
  membaca daftar terminal orang lain dengan menebak id. `GET /api/panes`
  memverifikasi kepemilikan lebih dulu.
- **Balapan OAuth GitHub.** Tidak ada `UNIQUE(clerk_user_id)`, dan callback
  melakukan select-lalu-insert manual — dua callback berbarengan menyisipkan dua
  baris, setelah itu `.single()` di `/api/github/repos` gagal selamanya.

### 3.5 File yang DIHAPUS — jangan dibuat lagi
- `src/app/api/ai/sessions/route.ts` — tabelnya sudah tidak ada.
- `src/app/api/terminals/route.ts` + `[id]/route.ts` — digantikan `api/panes`.
  Tidak ada satu pun pemanggil di UI, jadi penghapusan ini tidak memutus apa pun.
- `src/lib/supabase/client.ts` — klien anon key yang tidak dipakai siapa pun.
  Dengan RLS tanpa policy, klien ini hanya akan mengembalikan array kosong.

### 3.6 Verifikasi yang sudah dijalankan
- `npm run typecheck` → **lulus bersih** (Next + Electron).
- `npx eslint` pada seluruh file yang disentuh → **bersih**.
- ⚠️ `npm run lint` global melaporkan 323 error / 11218 warning. **Semuanya sudah
  ada sebelum sesi ini** (mis. `react-hooks/set-state-in-effect` di
  `src/lib/clerk/provider.tsx`, dan folder `dist/` ikut ter-lint). Jangan
  menghabiskan waktu mengejar itu kecuali memang diminta.

---

## 4. SISA PEKERJAAN

### Tahap A — Jalankan migration ⚠️ PRIORITAS UTAMA, BELUM DILAKUKAN

Saya tidak punya akses ke project Supabase, jadi SQL-nya belum pernah dieksekusi.

> 🔴 **MIGRATION INI DESTRUKTIF.** Ia men-`drop` tabel `aingespace_*` dari
> migration 001 beserta isinya. Yang berpotensi berisi data sungguhan:
> `aingespace_github_connections` (token OAuth terenkripsi) dan
> `aingespace_environment_variables`. **Konfirmasi ke user dulu.** Kalau isinya
> perlu diselamatkan, tulis blok `insert … select` dari tabel lama ke tabel baru
> **sebelum** bagian `drop`, dan ingat kolomnya berganti nama
> (`access_token` → `access_token_encrypted`, `value` → `value_encrypted`).

Cara menjalankan: tempel isi file ke **Supabase Dashboard → SQL Editor**, atau
`supabase db push` kalau CLI-nya sudah tersambung.

Setelah jalan, verifikasi:
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like '%_aingespace';
-- harus mengembalikan tepat 4 baris

select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename like '%_aingespace';
-- rowsecurity harus true untuk keempatnya

select count(*) from pg_policies where schemaname = 'public';
-- harus 0 — ini disengaja, baca §2
```

### Tahap B — Sambungkan `BridgeMindLayout` ke database

Sekarang `src/features/workspace/BridgeMindLayout.tsx` masih memakai konstanta
`initialWorkspaces` (workspace "Swarm" dan "GPT 5.5" yang di-hardcode). Semua
pane dan pohon terminal hidup di memori dan hilang saat reload.

Yang perlu dikerjakan:

1. **Muat** `GET /api/workspaces`, lalu `GET /api/panes?workspaceId=` untuk
   workspace aktif. Ganti `initialWorkspaces` dengan hasilnya.
2. **Hidrasi pohon** ke `pane-terminal-store`. Butuh action baru, mis.
   `HYDRATE_PANE { paneId, tree, nameSeq }`, karena `INIT_PANE` yang ada hanya
   membuat satu leaf kosong.
3. **Simpan pohon** dengan `PATCH /api/panes/[id]` setiap `state.trees[paneId]`
   berubah. **Wajib di-debounce** (~400 ms) — `RESIZE_SPLIT` menembak di setiap
   frame drag; tanpa debounce satu tarikan splitter jadi puluhan request.
4. **Buat baris pane** lewat `POST /api/panes` di `addPaneTo`, dan
   `DELETE /api/panes/[id]` di `closePane`.
5. `togglePin` → `PATCH /api/panes/[id] { pinned }`.

### Tahap C — Persistensi urutan sidebar
`onReorderWorkspaces` di `BridgeMindLayout` sudah bekerja di memori tapi
urutannya hilang saat reload. Endpoint-nya sudah siap:
`PATCH /api/workspaces { orderedIds: [...] }`.

### Tahap D — Dashboard masih mock
`src/app/dashboard/page.tsx` merender `mockWorkspaces` (3 workspace hardcode) dan
tiga kartu statistik dengan angka hardcode (`"3"`, `"1"`, `"2.4 GB"`). Ganti
daftarnya dengan `GET /api/workspaces`. Untuk kartu statistik: `Workspaces` bisa
dari jumlah baris, tapi `Active` dan `Storage` **tidak punya sumber data** —
diskusikan dengan user apakah dihapus atau dihitung dari sesuatu yang nyata.

### Tahap E — Buang hack `localStorage`
Setelah `layout_preset` benar-benar dibaca dari database, dua tempat ini bisa
disederhanakan:
- `src/app/dashboard/page.tsx` menulis `"aingespace:pending-layout"`.
- `src/app/workspace/[id]/page.tsx` membacanya lewat `useSyncExternalStore`
  dengan `Map` memoisasi supaya `getSnapshot` stabil.

Baca komentarnya dulu sebelum menghapus — ada alasan hidrasi yang halus di sana
(localStorage tidak boleh disentuh saat render).

### Tahap F — Environment Variables Manager belum punya UI
Route-nya lengkap (`GET`/`POST`/`DELETE` + `/decrypt`) tapi **tidak ada satu
komponen pun yang memanggilnya**. `v1.md` mendeskripsikan alurnya:
baca `.env.example` hasil clone → user isi nilainya → simpan terenkripsi →
inject ke environment PTY saat `npm run dev`.

Perhatikan: `/decrypt` sekarang bisa mengembalikan `{ value: null, error:
"decrypt_failed" }` untuk baris yang ditulis dengan `ENCRYPTION_KEY` lama. UI
harus menandai baris itu, bukan menampilkannya sebagai string kosong.

### Tahap G — Keputusan yang menunggu user: preferensi per-user
Ini **sengaja tidak** dibuatkan tabel, dan user perlu memutuskan.

Yang sekarang hanya ada di `localStorage`, jadi tidak ikut berpindah antara versi
web dan aplikasi `.exe`:
- keymap override — `bm.keybindings.v1` (`src/features/terminal/keybindings.ts`)
- lebar sidebar + mode rail — `aingespace:sidebar-width`, `aingespace:sidebar-rail`

Kalau user mau tersinkron, tambahkan **satu** tabel:
```sql
create table public.user_prefs_aingespace (
  clerk_user_id text primary key,
  keybindings   jsonb not null default '{}'::jsonb,
  ui            jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);
```
Satu baris per user, dua kolom jsonb — jangan dipecah jadi satu baris per
binding. Tabel ini tidak dimasukkan sekarang justru karena belum ada yang
menulisnya, dan itu bertentangan dengan permintaan "jangan pajangan".

---

## 5. Jebakan yang sudah terbukti — baca sebelum Tahap B

### 5.1 🔴 Counter id terminal akan bertabrakan setelah hidrasi
`pane-terminal-store.tsx` memakai counter tingkat modul yang mulai dari nol:

```ts
let termCounter = 0
function nextTermId() { return `bm-term-${++termCounter}` }
let nodeCounter = 0
function nextNodeId() { return `node-${++nodeCounter}` }
```

Kalau kamu memuat pohon tersimpan yang sudah berisi `bm-term-5`, lalu user
melakukan split, terminal baru akan bernama `bm-term-1` — **menabrak id yang
sudah ada**. Dua leaf berbagi satu PTY, dan menutup salah satunya mencabut shell
milik yang lain.

Solusi: setelah hidrasi, telusuri pohon dan naikkan kedua counter melewati nilai
tertinggi yang ditemukan. Skema zod sudah menolak `terminalId` duplikat di dalam
satu pane, tapi **tidak bisa** melihat tabrakan antar pane — itu tanggung
jawabmu.

### 5.2 🔴 Garbage collector akan membunuh terminal saat hidrasi
`PaneTerminalProvider` punya efek yang memanggil
`registry.disposeInstancesExcept(alive)` setiap `state.trees` berubah, dengan
penjaga `gcArmed` supaya render pertama (saat `trees` masih kosong) tidak
menghapus apa pun.

Muat pohon **sebelum** slot terminal mulai membuat instance, atau pastikan
hidrasi terjadi dalam satu dispatch. Hidrasi bertahap (satu pane per response
yang datang) akan membuat GC menyapu pane yang belum sempat termuat.

### 5.3 🔴 Fallback id workspace bukan UUID
`CreateWorkspaceDialog.handleLaunch` punya fallback offline:

```ts
if (!workspaceId) workspaceId = `ws-${Date.now()}`
```

Id itu **bukan UUID**, sehingga `POST /api/panes` akan menolaknya lewat
`z.string().uuid()`. Sebelum Tahap B, putuskan: workspace lokal-saja tidak boleh
mencoba menyimpan pane, atau fallback-nya diganti `crypto.randomUUID()`.
Perhatikan konsekuensinya — uuid acak dari klien tidak ada di database, jadi
`POST /api/panes` tetap 404. Jalur "offline" ini butuh keputusan desain, bukan
tambalan.

### 5.4 `sizes` dan `children` harus sama panjang
Skema zod menolak yang tidak sama panjang, karena desync itulah yang dulu
membuat setiap pane memakai lebar milik tetangganya setelah sebuah split
dihapus. Kalau `PATCH /api/panes/[id]` membalas 400 dengan pesan
`"children dan sizes harus sama panjang"`, bug-nya ada di reducer, bukan di
validasi.

### 5.5 `single()` versus `maybeSingle()`
`supabase-js` menganggap "nol baris" sebagai **error** pada `.single()`. Itu
sebabnya beberapa handler dulu membalas 500 untuk kasus "tidak ditemukan" yang
sepenuhnya normal. Pakai `.maybeSingle()` untuk apa pun yang boleh tidak ada.

### 5.6 `position` adalah keyword SQL
Kolom `panes_aingespace.position` sah di PostgreSQL, tapi `POSITION` juga nama
fungsi standar SQL. Aman lewat PostgREST/supabase-js, tapi kalau kamu menulis
SQL mentah, kutip dengan `"position"`.

---

## 6. Verifikasi

Wajib lulus sebelum menyatakan selesai:

```bash
npm run typecheck                 # Next + Electron, harus bersih
npx eslint "src/**/*.{ts,tsx}"    # jangan pakai `npm run lint` — lihat §3.6
```

Uji manual setelah Tahap B:
1. `npm run dev:desktop`
2. Buat workspace baru lewat dialog — pilih layout 4 terminal dan dua agen.
3. Cek di Supabase: baris `workspaces_aingespace` harus punya
   `layout_preset = 'l4'` dan `agent_ids` berisi dua id.
4. Split sebuah terminal, tarik splitter, ganti nama terminal.
5. Reload aplikasi. Jumlah pane, bentuk split, proporsi lebar, dan nama terminal
   harus kembali persis. Shell-nya sendiri memang mati — yang dipulihkan bentuk
   layout, bukan proses.
6. Split lagi setelah reload dan pastikan tidak ada terminal yang "membajak"
   isi terminal lain (itu gejala §5.1).

---

## 7. Status git saat handoff

Branch `master`, belum ada commit untuk pekerjaan ini.

```
 M src/app/api/env/[workspaceId]/decrypt/route.ts
 M src/app/api/env/[workspaceId]/route.ts
 M src/app/api/github/callback/route.ts
 M src/app/api/github/repos/route.ts
 M src/app/api/github/route.ts
 M src/app/api/workspaces/[id]/route.ts
 M src/app/api/workspaces/route.ts
 M src/components/CreateWorkspaceDialog.tsx
 M src/types/database.ts
 D src/app/api/ai/sessions/route.ts
 D src/app/api/terminals/[id]/route.ts
 D src/app/api/terminals/route.ts
 D src/lib/supabase/client.ts
?? src/app/api/panes/
?? src/lib/panes/
?? supabase/migrations/002_rewrite_aingespace_schema.sql
```

`supabase/migrations/001_initial_schema.sql` sengaja **dibiarkan** sebagai riwayat
— 002 sudah men-`drop` seluruh isinya.
