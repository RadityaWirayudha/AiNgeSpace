-- PurpSpace — rename semua objek `*_aingespace` menjadi `*_purpspace`
-- ============================================================================
-- Proyek berganti nama dari AiNgeSpace menjadi PurpSpace. Kode aplikasi
-- (src/types/database.ts dan seluruh route handler) sudah memakai nama baru,
-- jadi migrasi ini WAJIB dijalankan sebelum build berikutnya menyentuh
-- database. Tanpa itu setiap query mengembalikan 500 "relation does not exist".
--
-- Sifat migrasi ini:
--
--   * NON-DESTRUKTIF. Tidak ada drop, tidak ada create table, tidak ada
--     insert/select. `alter … rename` hanya menyentuh katalog; setiap baris
--     data, setiap ciphertext token, tetap di tempatnya. Ini berbeda dari
--     002 yang memang menghapus tabel.
--   * IDEMPOTEN. Setiap rename dijaga pengecekan katalog, jadi menjalankannya
--     dua kali aman dan menjalankannya di database yang belum pernah dikenai
--     002 hanyalah no-op (tidak ada yang cocok untuk di-rename).
--
-- Yang ikut di-rename, dan alasannya harus disebut satu per satu: `alter table
-- … rename to` di Postgres TIDAK ikut mengganti nama index, constraint,
-- trigger, maupun sequence milik tabel itu. Kalau dibiarkan, tabel bernama
-- workspaces_purpspace akan menyimpan constraint bernama
-- workspaces_aingespace_pkey — dan nama itu muncul di pesan error yang dilihat
-- pengguna, serta di `foreignKeyName` pada src/types/database.ts.
--
-- RLS tidak disentuh: statusnya melekat pada tabel dan ikut berpindah bersama
-- nama. Sesuai 002, RLS tetap enabled tanpa satu pun policy — anon dan
-- authenticated ditolak seluruhnya, dan service_role melewatinya. Itu memang
-- disengaja; jangan "memperbaikinya" dengan mematikan RLS.
--
-- Cara menjalankan: buka Supabase → SQL Editor → tempel seluruh file → Run.

do $$
declare
  item text[];
begin
  ------------------------------------------------------------------ tabel --
  -- Dijalankan lebih dulu supaya blok-blok di bawah bisa menyebut nama baru.
  foreach item slice 1 in array array[
    array['workspaces_aingespace',         'workspaces_purpspace'],
    array['panes_aingespace',              'panes_purpspace'],
    array['github_connections_aingespace', 'github_connections_purpspace'],
    array['env_vars_aingespace',           'env_vars_purpspace']
  ] loop
    if to_regclass('public.' || quote_ident(item[1])) is not null
       and to_regclass('public.' || quote_ident(item[2])) is null then
      execute format('alter table public.%I rename to %I', item[1], item[2]);
      raise notice 'renamed table %  ->  %', item[1], item[2];
    end if;
  end loop;

  ------------------------------------------------------------- constraint --
  -- Termasuk nama yang dibuat Postgres sendiri (_pkey, _fkey, _key), karena
  -- itulah yang dirujuk src/types/database.ts dan yang muncul di pesan error.
  -- Rename constraint sekaligus me-rename index pendukungnya.
  foreach item slice 1 in array array[
    array['workspaces_purpspace', 'workspaces_aingespace_pkey',
                                  'workspaces_purpspace_pkey'],
    array['workspaces_purpspace', 'workspaces_aingespace_name_not_blank',
                                  'workspaces_purpspace_name_not_blank'],
    array['workspaces_purpspace', 'workspaces_aingespace_working_dir_not_blank',
                                  'workspaces_purpspace_working_dir_not_blank'],
    array['workspaces_purpspace', 'workspaces_aingespace_layout_known',
                                  'workspaces_purpspace_layout_known'],

    array['panes_purpspace',      'panes_aingespace_pkey',
                                  'panes_purpspace_pkey'],
    array['panes_purpspace',      'panes_aingespace_workspace_id_fkey',
                                  'panes_purpspace_workspace_id_fkey'],
    array['panes_purpspace',      'panes_aingespace_title_not_blank',
                                  'panes_purpspace_title_not_blank'],
    array['panes_purpspace',      'panes_aingespace_tree_is_node',
                                  'panes_purpspace_tree_is_node'],
    array['panes_purpspace',      'panes_aingespace_name_seq_positive',
                                  'panes_purpspace_name_seq_positive'],

    array['github_connections_purpspace', 'github_connections_aingespace_pkey',
                                          'github_connections_purpspace_pkey'],
    array['github_connections_purpspace',
          'github_connections_aingespace_clerk_user_id_key',
          'github_connections_purpspace_clerk_user_id_key'],
    array['github_connections_purpspace',
          'github_connections_aingespace_token_shape',
          'github_connections_purpspace_token_shape'],

    array['env_vars_purpspace',   'env_vars_aingespace_pkey',
                                  'env_vars_purpspace_pkey'],
    array['env_vars_purpspace',   'env_vars_aingespace_workspace_id_fkey',
                                  'env_vars_purpspace_workspace_id_fkey'],
    array['env_vars_purpspace',   'env_vars_aingespace_workspace_key_unique',
                                  'env_vars_purpspace_workspace_key_unique'],
    array['env_vars_purpspace',   'env_vars_aingespace_key_format',
                                  'env_vars_purpspace_key_format'],
    array['env_vars_purpspace',   'env_vars_aingespace_value_shape',
                                  'env_vars_purpspace_value_shape']
  ] loop
    if exists (
      select 1
        from pg_constraint c
        join pg_class     t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public'
         and t.relname = item[1]
         and c.conname = item[2]
    ) then
      execute format('alter table public.%I rename constraint %I to %I',
                     item[1], item[2], item[3]);
      raise notice 'renamed constraint %  ->  %', item[2], item[3];
    end if;
  end loop;

  ------------------------------------------------------------------ index --
  -- Index yang berdiri sendiri (bukan pendukung constraint), jadi tidak ikut
  -- terbawa blok di atas.
  foreach item slice 1 in array array[
    array['workspaces_aingespace_owner_idx',    'workspaces_purpspace_owner_idx'],
    array['panes_aingespace_workspace_idx',     'panes_purpspace_workspace_idx']
  ] loop
    if to_regclass('public.' || quote_ident(item[1])) is not null
       and to_regclass('public.' || quote_ident(item[2])) is null then
      execute format('alter index public.%I rename to %I', item[1], item[2]);
      raise notice 'renamed index %  ->  %', item[1], item[2];
    end if;
  end loop;

  ---------------------------------------------------------------- trigger --
  foreach item slice 1 in array array[
    array['workspaces_purpspace',         'workspaces_aingespace_set_updated_at',
                                          'workspaces_purpspace_set_updated_at'],
    array['panes_purpspace',              'panes_aingespace_set_updated_at',
                                          'panes_purpspace_set_updated_at'],
    array['github_connections_purpspace', 'github_connections_aingespace_set_updated_at',
                                          'github_connections_purpspace_set_updated_at'],
    array['env_vars_purpspace',           'env_vars_aingespace_set_updated_at',
                                          'env_vars_purpspace_set_updated_at']
  ] loop
    if exists (
      select 1
        from pg_trigger   g
        join pg_class     t on t.oid = g.tgrelid
        join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public'
         and t.relname = item[1]
         and g.tgname  = item[2]
    ) then
      execute format('alter trigger %I on public.%I rename to %I',
                     item[2], item[1], item[3]);
      raise notice 'renamed trigger %  ->  %', item[2], item[3];
    end if;
  end loop;

  ----------------------------------------------------------------- fungsi --
  -- Trigger merujuk fungsinya lewat OID, bukan nama, jadi rename ini tidak
  -- memutus satu pun trigger di atas.
  if exists (
    select 1
      from pg_proc      p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'set_updated_at_aingespace'
  ) then
    execute 'alter function public.set_updated_at_aingespace() '
            'rename to set_updated_at_purpspace';
    raise notice 'renamed function set_updated_at_aingespace  ->  set_updated_at_purpspace';
  end if;
end
$$;

-- ============================================================================
-- Verifikasi
-- ============================================================================
-- Harus mengembalikan tepat empat baris, semuanya berakhiran _purpspace, dan
-- rowsecurity = true untuk keempatnya.
--
--   select tablename, rowsecurity
--     from pg_tables
--    where schemaname = 'public'
--      and tablename like '%\_purpspace'
--    order by tablename;
--
-- Dan tidak boleh ada sisa nama lama di mana pun:
--
--   select conname from pg_constraint where conname like '%aingespace%'
--   union all
--   select relname  from pg_class      where relname  like '%aingespace%'
--   union all
--   select tgname   from pg_trigger    where tgname   like '%aingespace%'
--   union all
--   select proname  from pg_proc       where proname  like '%aingespace%';
