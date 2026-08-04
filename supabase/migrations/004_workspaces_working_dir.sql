-- PurpSpace — selaraskan `workspaces_purpspace` dengan bentuk yang dipakai kode
-- ============================================================================
-- KENAPA FILE INI ADA
--
-- 002 pernah dijalankan di database ini, tapi versi 002 yang SAAT ITU berlaku —
-- versi sebelum commit a5d3c48 — masih membuat kolom github_repo / github_branch
-- / local_path. Setelah itu 002 diedit di repo menjadi memakai `working_dir`,
-- tapi file yang sudah pernah dijalankan tidak pernah dijalankan ulang (dan
-- memang tidak boleh: 002 diawali `drop table … cascade`).
--
-- Akibatnya sekarang: 003 sukses me-rename tabelnya, tapi bentuk kolomnya masih
-- bentuk lama. Kode aplikasi menulis dan membaca `working_dir`, sehingga setiap
-- create/list workspace gagal dengan
--   PGRST204 "Could not find the 'working_dir' column of 'workspaces_purpspace'"
-- Tiga tabel lain (panes_, github_connections_, env_vars_) sudah cocok persis;
-- hanya workspaces_ yang perlu diperbaiki, jadi hanya itu yang disentuh di sini.
--
-- SIFAT MIGRASI INI
--
--   * TIDAK MENGHAPUS TABEL. Tidak ada drop table, tidak ada create table, jadi
--     panes/env_vars yang mereferensikannya lewat foreign key tetap utuh —
--     berbeda dari 002 yang memang menghapus dan membuat ulang.
--   * MEMPERTAHANKAN DATA. local_path di-RENAME menjadi working_dir, bukan
--     dibuat baru lalu yang lama dibuang, sehingga isi kolomnya ikut terbawa.
--   * MENGHAPUS DUA KOLOM: github_repo dan github_branch. Ini satu-satunya
--     bagian yang merusak, dan itu memang tujuannya — a5d3c48/e3f9727/a393ca6
--     mengeluarkan repo GitHub dari alur pembuatan workspace, dan tidak ada satu
--     baris kode pun di src/ yang masih menyebut kedua kolom itu.
--   * BERJAGA-JAGA. Kalau tabel ternyata sudah berisi baris, migrasi ini BERHENTI
--     dengan exception alih-alih membuang isinya diam-diam. Saat ditulis,
--     workspaces_purpspace berisi 0 baris (dicek lewat count PostgREST), jadi
--     jalur itu tidak akan tersentuh — ia ada untuk melindungi database lain.
--   * IDEMPOTEN. Semua langkah dijaga pengecekan katalog; dijalankan dua kali,
--     yang kedua tidak melakukan apa-apa.
--
-- Cara menjalankan: buka Supabase → SQL Editor → tempel seluruh file → Run.
-- Jalankan SETELAH 003.

do $$
declare
  has_working_dir boolean;
  has_local_path  boolean;
  has_repo        boolean;
  -- Sengaja BUKAN bernama row_count: `get diagnostics x = ROW_COUNT` di bawah
  -- memakai ROW_COUNT sebagai nama item diagnostik, dan variabel bernama sama
  -- hanya membuat baris itu sulit dibaca.
  n_rows          bigint;
begin
  if to_regclass('public.workspaces_purpspace') is null then
    raise notice 'workspaces_purpspace tidak ada — jalankan 002 lalu 003 lebih dulu';
    return;
  end if;

  select
    count(*) filter (where column_name = 'working_dir')   > 0,
    count(*) filter (where column_name = 'local_path')    > 0,
    count(*) filter (where column_name = 'github_repo')   > 0
    into has_working_dir, has_local_path, has_repo
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'workspaces_purpspace';

  if has_working_dir and not has_local_path and not has_repo then
    raise notice 'workspaces_purpspace sudah berbentuk benar — tidak ada yang dikerjakan';
    return;
  end if;

  -- Pengaman: jangan pernah membuang kolom dari tabel yang sudah berisi data.
  if has_repo then
    select count(*) into n_rows from public.workspaces_purpspace;
    if n_rows > 0 then
      raise exception
        'workspaces_purpspace berisi % baris; github_repo/github_branch tidak '
        'dibuang otomatis. Isi working_dir untuk setiap baris lebih dulu, lalu '
        'jalankan ulang file ini.', n_rows;
    end if;
  end if;

  ------------------------------------------------------------------- kolom --
  -- Rename, bukan add+drop, supaya isi local_path ikut pindah.
  if not has_working_dir and has_local_path then
    alter table public.workspaces_purpspace rename column local_path to working_dir;
    raise notice 'renamed column local_path -> working_dir';
  elsif not has_working_dir then
    -- local_path pun tidak ada (bentuk tak terduga). Tambahkan kosong; NOT NULL
    -- dipasang di bawah setelah backfill.
    alter table public.workspaces_purpspace add column working_dir text;
    raise notice 'added column working_dir';
  end if;

  -- local_path nullable, working_dir tidak. Pada database ini hasilnya 0 baris;
  -- notice-nya sengaja dicetak supaya kalau ternyata bukan 0, itu terlihat.
  update public.workspaces_purpspace
     set working_dir = '.'
   where working_dir is null or length(btrim(working_dir)) = 0;
  get diagnostics n_rows = row_count;
  if n_rows > 0 then
    raise notice 'backfilled % baris working_dir kosong dengan ''.''', n_rows;
  end if;

  alter table public.workspaces_purpspace alter column working_dir set not null;

  --------------------------------------------------------------- constraint --
  -- Dua CHECK milik kolom lama. 003 tidak me-rename keduanya (nama barunya tidak
  -- ada dalam daftar 003, karena 002 versi repo memang tidak lagi memilikinya),
  -- jadi di database keduanya masih bernama *_aingespace_*. Dibuang dengan kedua
  -- kemungkinan nama supaya file ini tidak bergantung pada urutan itu.
  alter table public.workspaces_purpspace
    drop constraint if exists workspaces_aingespace_repo_format,
    drop constraint if exists workspaces_purpspace_repo_format,
    drop constraint if exists workspaces_aingespace_branch_not_blank,
    drop constraint if exists workspaces_purpspace_branch_not_blank;

  alter table public.workspaces_purpspace
    drop column if exists github_repo,
    drop column if exists github_branch;

  -- Sama persis dengan definisi di 002 versi repo. Tidak ada regex path dengan
  -- sengaja: bentuk path sah berbeda antar OS, dan satu-satunya penentu nyata
  -- adalah apakah folder itu ada di mesin yang menjalankannya — hanya diketahui
  -- main process Electron (isDirectory() di electron/pty-manager.ts).
  if not exists (
    select 1
      from pg_constraint c
      join pg_class     t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'workspaces_purpspace'
       and c.conname = 'workspaces_purpspace_working_dir_not_blank'
  ) then
    alter table public.workspaces_purpspace
      add constraint workspaces_purpspace_working_dir_not_blank
      check (length(btrim(working_dir)) between 1 and 4096);
    raise notice 'added constraint workspaces_purpspace_working_dir_not_blank';
  end if;

  raise notice 'workspaces_purpspace selesai diselaraskan';
end
$$;

-- PostgREST menyimpan skema di cache dan tidak selalu langsung tahu kolomnya
-- berubah. Tanpa ini, query pertama masih bisa mengembalikan PGRST204 yang sama.
notify pgrst, 'reload schema';

-- ============================================================================
-- Verifikasi
-- ============================================================================
-- Harus mengembalikan working_dir (NO = not null) dan TIDAK mengembalikan
-- github_repo / github_branch / local_path:
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workspaces_purpspace'
--    order by ordinal_position;
--
-- Dan tidak boleh ada sisa nama constraint lama pada tabel ini:
--
--   select conname from pg_constraint
--    where conrelid = 'public.workspaces_purpspace'::regclass
--    order by conname;
