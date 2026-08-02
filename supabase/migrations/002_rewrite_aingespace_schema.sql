-- AiNgeSpace — Skema Supabase PostgreSQL (rewrite penuh atas 001)
--
-- Konvensi penamaan: <entitas>_aingespace.
-- Migration ini idempoten: seluruh objek di-drop dengan `if exists` lebih dulu,
-- baik nama lama (aingespace_*) maupun nama baru (*_aingespace), sehingga file
-- ini aman dijalankan ulang di project Supabase yang sudah pernah dipasangi 001.
--
-- ============================================================================
-- KEPUTUSAN DESAIN — kenapa tabelnya cuma empat
-- ============================================================================
--
-- 1. Tabel yang DIBUANG dari 001:
--
--    aingespace_users
--      Tidak ada satu baris kode pun yang menulis ke tabel ini. Tidak ada
--      webhook Clerk di `src/app/api/`, jadi tabel ini tidak akan pernah terisi.
--      Identitas sepenuhnya milik Clerk; relasi cukup lewat clerk_user_id TEXT
--      persis seperti yang ditetapkan v1.md.
--
--    aingespace_ai_sessions
--      Tidak ada kode AI sama sekali di project ini — OPENROUTER_API_KEY ada di
--      .env.example tapi tidak pernah dibaca. Selain itu bentuk satu-baris
--      (prompt + response) memang bukan bentuk yang benar untuk percakapan
--      multi-turn. Dibuang sekarang, dibuat ulang nanti sebagai
--      sessions + messages ketika fitur AI-nya betul-betul ada.
--
-- 2. Tabel aingespace_terminals DIGANTI panes_aingespace.
--
--    Kolom `layout jsonb` di 001 berbentuk {"direction","splitFrom"} dan tidak
--    mampu menyimpan struktur yang benar-benar dipakai aplikasi. Model asli di
--    src/features/terminal/pane-terminal-store.tsx adalah pohon rekursif:
--
--      leaf  = { type:"leaf",  id, terminalId, name }
--      split = { type:"split", id, direction, children[], sizes[] }
--
--    Reducer memperlakukan `trees[paneId]` sebagai SATU nilai immutable — setiap
--    split/close/resize menghasilkan pohon baru secara utuh. Jadi satu baris per
--    pane yang menyimpan pohon utuh adalah padanan yang tepat: satu UPDATE per
--    perubahan layout, bukan puluhan baris terminal yang harus disinkronkan.
--
-- 3. Row Level Security: AKTIF, TANPA POLICY.
--
--    Seluruh akses database berjalan lewat route handler memakai
--    SUPABASE_SERVICE_ROLE_KEY (lihat src/lib/supabase/server.ts), dan service
--    role SELALU bypass RLS. Artinya ~200 baris policy di 001 tidak pernah satu
--    kali pun dievaluasi — itu kode mati yang memberi rasa aman palsu.
--
--    Yang tetap dibutuhkan adalah RLS-nya sendiri: tanpa itu, siapa pun yang
--    memegang NEXT_PUBLIC_SUPABASE_ANON_KEY (yang memang terkirim ke browser)
--    bisa membaca seluruh isi tabel. RLS aktif tanpa policy = anon dan
--    authenticated ditolak untuk semua operasi, service role tetap lolos.
--    Otorisasi per-user tetap dikerjakan di route handler lewat
--    `.eq("clerk_user_id", userId)`.
--
--    Kalau suatu hari klien browser mengakses Supabase langsung memakai Clerk
--    JWT, barulah policy ditambahkan — dan hanya untuk tabel yang diakses.
--
-- 4. Index dibuat hanya untuk query yang benar-benar ada. UNIQUE constraint
--    sudah membuat index-nya sendiri, jadi tidak diduplikasi (di 001,
--    idx_..._environment_variables_workspace_id mubazir karena tertutup oleh
--    unique(workspace_id, key)).
--
-- gen_random_uuid() dipakai langsung — sudah tersedia bawaan di PostgreSQL 13+
-- yang dipakai Supabase, jadi extension uuid-ossp tidak perlu dipasang.
-- ============================================================================


-- ============================================================================
-- DROP — nama lama (001) dan nama baru, supaya file ini bisa dijalankan ulang
-- ============================================================================

drop table if exists public.aingespace_environment_variables cascade;
drop table if exists public.aingespace_ai_sessions           cascade;
drop table if exists public.aingespace_github_connections    cascade;
drop table if exists public.aingespace_terminals             cascade;
drop table if exists public.aingespace_workspaces            cascade;
drop table if exists public.aingespace_users                 cascade;

drop table if exists public.env_vars_aingespace           cascade;
drop table if exists public.github_connections_aingespace cascade;
drop table if exists public.panes_aingespace              cascade;
drop table if exists public.workspaces_aingespace         cascade;

-- Fungsi 001 memakai nama generik tanpa prefix — dibuang bersama triggernya
-- (sudah ikut terhapus lewat cascade di atas).
drop function if exists public.update_updated_at_column()  cascade;
drop function if exists public.set_updated_at_aingespace() cascade;


-- ============================================================================
-- FUNGSI BERSAMA
-- ============================================================================

create function public.set_updated_at_aingespace()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- workspaces_aingespace
-- ============================================================================
-- Satu baris per workspace milik satu user Clerk.
--
-- layout_preset + agent_ids menutup kebocoran nyata di CreateWorkspaceDialog:
-- dialog membuat user memilih layout dan sampai lima agen, lalu POST
-- /api/workspaces hanya mengirim name/repo/branch. Pilihan layout dititipkan
-- lewat localStorage("aingespace:pending-layout") dan pilihan agen dibuang
-- diam-diam. Dua kolom ini membuat pilihan itu ikut tersimpan.
--
-- sort_order menutup kebocoran kedua: sidebar sudah bisa drag-reorder workspace
-- (onReorderWorkspaces), tapi urutannya hilang setiap reload.

create table public.workspaces_aingespace (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text        not null,

  name          text        not null,

  -- Folder tempat terminal workspace ini mulai berjalan. Ini menggantikan
  -- github_repo/github_branch: dialog pembuatan workspace tidak lagi meminta
  -- repo GitHub, ia meminta folder lokal. Nilainya per-mesin — workspace yang
  -- sama dibuka dari laptop lain akan menunjuk path berbeda — tapi tetap not
  -- null karena tanpa folder, terminal tidak punya tempat untuk mulai.
  working_dir   text        not null,

  -- id layout dari LAYOUTS di CreateWorkspaceDialog ("l1","l2v","l4",…).
  layout_preset text        not null default 'l1',
  -- id agen dari AGENTS ("a1".."a5"). Array, bukan tabel join: himpunan agen
  -- bersifat tetap dan belum punya konfigurasi per-agen, jadi tabel join hanya
  -- akan jadi tabel berisi pasangan id tanpa kolom lain.
  agent_ids     text[]      not null default '{}',

  sort_order    integer     not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint workspaces_aingespace_name_not_blank
    check (length(btrim(name)) between 1 and 255),
  -- Tidak ada regex path di sini dengan sengaja: bentuk path sah berbeda antara
  -- Windows, macOS dan Linux, dan satu-satunya penentu yang sebenarnya adalah
  -- apakah folder itu ada di mesin yang menjalankannya — sesuatu yang hanya
  -- diketahui main process Electron (lihat isDirectory() di pty-manager.ts).
  constraint workspaces_aingespace_working_dir_not_blank
    check (length(btrim(working_dir)) between 1 and 4096),
  constraint workspaces_aingespace_layout_known
    check (layout_preset in ('l1', 'l2v', 'l2h', 'l4', 'l6', 'l8'))
);

alter table public.workspaces_aingespace enable row level security;

-- Satu-satunya pola query daftar: milik user X, urut tampilan.
create index workspaces_aingespace_owner_idx
  on public.workspaces_aingespace (clerk_user_id, sort_order, created_at);

create trigger workspaces_aingespace_set_updated_at
  before update on public.workspaces_aingespace
  for each row execute function public.set_updated_at_aingespace();


-- ============================================================================
-- panes_aingespace
-- ============================================================================
-- Satu baris per pane pada grid workspace. `tree` menyimpan pohon terminal
-- pane tersebut apa adanya, dalam bentuk yang sama persis dengan yang dipegang
-- reducer di memori — sehingga memuat ulang cukup dengan menaruh nilai jsonb
-- ini langsung ke state.trees[paneId], tanpa lapisan penerjemah.
--
-- Yang sengaja TIDAK disimpan:
--   maximized  — murni flag tampilan sesaat, tidak layak bertahan antar sesi.
--   activeTerminalId — fokus, bukan data.
--   terminalId → PTY — proses shell mati bersama aplikasi; yang dipulihkan
--                      adalah bentuk layout-nya, bukan proses yang berjalan.

create table public.panes_aingespace (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid        not null
                 references public.workspaces_aingespace (id) on delete cascade,

  title        text        not null,
  position     integer     not null default 0,
  pinned       boolean     not null default false,

  -- Pohon rekursif leaf/split. Divalidasi seperlunya di sini (harus objek dan
  -- punya kunci "type"); bentuk lengkapnya dijaga zod di route handler, tempat
  -- pesan errornya bisa berguna bagi pemanggil.
  tree         jsonb       not null,

  -- Penomoran "Terminal A/B/C…" yang dipakai pane ini. Ikut disimpan supaya
  -- terminal baru setelah reload tidak mengulang nama yang sudah terpakai.
  name_seq     integer     not null default 1,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint panes_aingespace_title_not_blank
    check (length(btrim(title)) between 1 and 255),
  constraint panes_aingespace_tree_is_node
    check (jsonb_typeof(tree) = 'object' and tree ? 'type'),
  constraint panes_aingespace_name_seq_positive
    check (name_seq >= 1)
);

alter table public.panes_aingespace enable row level security;

-- Pane selalu diambil per workspace dan dirender urut posisi grid.
create index panes_aingespace_workspace_idx
  on public.panes_aingespace (workspace_id, position);

create trigger panes_aingespace_set_updated_at
  before update on public.panes_aingespace
  for each row execute function public.set_updated_at_aingespace();


-- ============================================================================
-- github_connections_aingespace
-- ============================================================================
-- Satu koneksi GitHub per user Clerk.
--
-- UNIQUE pada clerk_user_id memperbaiki bug nyata di
-- src/app/api/github/callback/route.ts: route melakukan select-lalu-insert
-- manual, jadi dua callback yang datang berbarengan bisa menyisipkan dua baris
-- untuk user yang sama — dan setelah itu `.single()` di /api/github/repos akan
-- selalu gagal. Dengan constraint ini, callback bisa memakai satu upsert dan
-- database yang menjamin keunikannya.

create table public.github_connections_aingespace (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text        not null unique,

  github_user_id  text        not null,
  github_username text        not null,

  -- Ciphertext AES-256-GCM berformat "iv:tag:ciphertext" dari
  -- src/lib/supabase/encryption.ts. Namanya diberi akhiran _encrypted supaya
  -- tidak ada yang keliru menganggapnya token mentah dan menuliskannya ke log.
  access_token_encrypted text not null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint github_connections_aingespace_token_shape
    check (access_token_encrypted ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$')
);

alter table public.github_connections_aingespace enable row level security;

-- Tidak ada index tambahan: UNIQUE(clerk_user_id) sudah menjadi satu-satunya
-- jalur pencarian tabel ini.

create trigger github_connections_aingespace_set_updated_at
  before update on public.github_connections_aingespace
  for each row execute function public.set_updated_at_aingespace();


-- ============================================================================
-- env_vars_aingespace
-- ============================================================================
-- Environment Variables Manager (v1.md): nilai selalu terenkripsi, tidak pernah
-- ikut ter-commit, dan berlaku hanya untuk satu workspace.
--
-- Nama key dibatasi bentuk identifier shell yang sah. Tanpa ini, key seperti
-- "npm run dev" bisa tersimpan lalu meledak saat di-inject ke environment PTY.

create table public.env_vars_aingespace (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid        not null
                    references public.workspaces_aingespace (id) on delete cascade,

  key             text        not null,
  value_encrypted text        not null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint env_vars_aingespace_workspace_key_unique
    unique (workspace_id, key),
  constraint env_vars_aingespace_key_format
    check (key ~ '^[A-Za-z_][A-Za-z0-9_]{0,254}$'),
  constraint env_vars_aingespace_value_shape
    check (value_encrypted ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]*$')
);

alter table public.env_vars_aingespace enable row level security;

-- Tidak ada index tambahan: UNIQUE(workspace_id, key) sudah mencakup pencarian
-- per workspace maupun per key.

create trigger env_vars_aingespace_set_updated_at
  before update on public.env_vars_aingespace
  for each row execute function public.set_updated_at_aingespace();
