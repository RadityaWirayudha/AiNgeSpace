-- PurpSpace — `subscriptions_purpspace`, tabel pertama milik website
-- ============================================================================
-- KENAPA FILE INI ADA
--
-- Empat tabel yang sudah ada semuanya milik aplikasi desktop (purpspace-electron).
-- Website (purpspace-webapp) sampai sekarang tidak menyentuh database sama sekali:
-- alur /mulai hidup seluruhnya di useState, akunnya tidak pernah dibuat, dan
-- tanggal akhir trial dihitung di browser lalu hilang begitu halaman di-refresh.
--
-- File ini menambahkan SATU tabel supaya pendaftaran di website jadi nyata:
-- akun dibuat di Clerk, dan barisnya di sini mencatat paket mana yang dipilih
-- serta sampai kapan free trial-nya berlaku.
--
-- ============================================================================
-- KENAPA HANYA SATU TABEL, DAN KENAPA KOLOMNYA CUMA SEGINI
-- ============================================================================
--
-- Syarat dari user: tidak boleh ada tabel — dan, dengan semangat yang sama,
-- tidak boleh ada kolom — yang hanya jadi pajangan. Jadi setiap kolom di bawah
-- ini punya jalur baca yang benar-benar berjalan hari ini:
--
--   id            → isi cookie httpOnly `ps_langganan`; jadi kunci SELECT waktu
--                   /mulai dirender ulang, sehingga refresh tidak lagi menendang
--                   user balik ke langkah 1.
--   clerk_user_id → UNIQUE-nya yang menegakkan "satu langganan per akun".
--   plan_id       → layar selesai menyebut nama paket dari baris ini, bukan dari
--                   props klien seperti sebelumnya.
--   status        → /mulai bercabang di kolom ini untuk memilih kalimatnya.
--   trial_ends_at → tanggal yang tampil di layar selesai. Inilah inti perubahan
--                   ini: tanggalnya datang dari server, bukan dari jam browser.
--
-- Yang SENGAJA TIDAK dibuat sekarang:
--
--   stripe_customer_id / stripe_subscription_id / current_period_end
--     Belum ada satu baris kode pun yang membacanya, karena kredensial Stripe
--     belum ada dan integrasinya belum ditulis. Membuatnya sekarang persis
--     berarti membuat pajangan. Ketiganya masuk di migrasi 006, bareng kodenya.
--
--   tabel katalog paket (plans_purpspace)
--     Nama, harga, dan daftar fitur tetap tinggal di
--     purpspace-webapp/src/content/plans.ts. Halaman /harga harus tetap hidup
--     walaupun Supabase mati. Database cuma menyimpan PILIHAN user, bukan
--     katalognya — karena itu plan_id dijaga CHECK, bukan foreign key.
--
--   tabel akun
--     Identitas sepenuhnya milik Clerk, sama seperti empat tabel yang sudah ada.
--     Relasinya cukup lewat clerk_user_id TEXT.
--
-- ============================================================================
-- SIFAT MIGRASI INI
-- ============================================================================
--
--   * MENAMBAH SAJA. Tidak ada drop table, tidak ada alter pada tabel lain.
--     Empat tabel aplikasi desktop tidak tersentuh sedikit pun.
--   * IDEMPOTEN. Tabel, constraint, dan trigger semuanya dijaga pengecekan
--     katalog. Dijalankan dua kali, yang kedua cuma mencetak notice.
--   * RLS AKTIF, NOL POLICY. Sama seperti empat tabel lain, dan ini disengaja —
--     lihat penjelasan panjang di kepala 002. Seluruh akses berjalan lewat route
--     handler dengan SUPABASE_SERVICE_ROLE_KEY, dan service role selalu bypass
--     RLS. Kalau suatu saat query dari browser mengembalikan array kosong,
--     JANGAN mematikan RLS — pindahkan query-nya ke route handler.
--
-- Cara menjalankan: buka Supabase → SQL Editor → tempel seluruh file → Run.
-- Jalankan SETELAH 004.

create table if not exists public.subscriptions_purpspace (
  id            uuid        primary key default gen_random_uuid(),

  -- UNIQUE, bukan sekadar not null: satu akun hanya boleh punya satu langganan,
  -- dan constraint inilah yang menutup balapan dua request daftar bersamaan.
  -- Route handler mengandalkan pelanggarannya (SQLSTATE 23505) untuk membalas
  -- 409, jadi jangan dilonggarkan.
  clerk_user_id text        not null unique,

  -- 'basic' | 'pro' — id yang sama persis dengan PLANS di src/content/plans.ts.
  -- CHECK, bukan foreign key: katalog paketnya memang tidak ada di database.
  plan_id       text        not null,

  -- Hari ini hanya 'trialing' yang pernah ditulis. Nilai lainnya sudah ikut
  -- didaftarkan di CHECK supaya migrasi 006 (webhook Stripe) tinggal menulis,
  -- tanpa perlu mengubah constraint pada tabel yang sudah berisi data.
  status        text        not null default 'trialing',

  -- Dihitung di server dari TRIAL_DAYS (src/content/plans.ts), bukan dari jam
  -- browser. Not null karena setiap langganan di alur ini selalu lahir dari
  -- free trial — belum ada jalur berlangganan langsung tanpa trial.
  trial_ends_at timestamptz not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint subscriptions_purpspace_plan_known
    check (plan_id in ('basic', 'pro')),
  constraint subscriptions_purpspace_status_known
    check (status in ('trialing', 'active', 'past_due', 'canceled')),
  constraint subscriptions_purpspace_clerk_user_id_not_blank
    check (length(btrim(clerk_user_id)) between 1 and 255)
);

alter table public.subscriptions_purpspace enable row level security;

-- Tidak ada index tambahan dengan sengaja. Dua-duanya jalur pencarian tabel ini
-- sudah tertutup: pencarian lewat cookie memakai primary key, dan pencarian
-- lewat akun memakai index yang otomatis dibuat UNIQUE(clerk_user_id).

-- Trigger updated_at.
--
-- Fungsinya TIDAK dipanggil lewat nama yang ditebak, dan tidak ada fungsi baru
-- yang dibuat di sini. Alasannya: nama fungsi itu berbeda-beda tergantung dari
-- mana database ini naik. 001 membuatnya sebagai `update_updated_at_column()`,
-- 002 membuat `set_updated_at_aingespace()`, dan 003 merename yang kedua jadi
-- `set_updated_at_purpspace()` — tapi rename itu hanya jalan kalau nama lamanya
-- memang ada. Database yang lompat atau yang lahir dari 001 akan berakhir
-- dengan nama yang lain sama sekali.
--
-- Yang pasti sama di semua kasus itu bukan namanya, melainkan fungsi yang
-- benar-benar dipakai keempat tabel lain. Jadi itu yang dicari: lewat trigger
-- mereka, lalu dipakai apa adanya. Kalau keempat tabel itu belum ada triggernya,
-- migrasi ini berhenti — bukan diam-diam membuat fungsi kelima yang berbeda.
do $$
declare
  fn_oid    oid;
  fn_sig    text;
  fn_jumlah integer;
begin
  select count(distinct t.tgfoid)
    into fn_jumlah
    from pg_trigger   t
    join pg_class     c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and not t.tgisinternal
     and t.tgname like '%\_set\_updated\_at'
     and c.relname in ('workspaces_purpspace',
                       'panes_purpspace',
                       'github_connections_purpspace',
                       'env_vars_purpspace');

  if fn_jumlah = 0 then
    raise exception
      'tidak ada trigger *_set_updated_at di keempat tabel _purpspace, jadi '
      'tidak ketahuan fungsi mana yang harus dipakai. Jalankan 002 lalu 003 '
      'lebih dulu. Untuk melihat apa yang sebenarnya ada di database ini, '
      'lihat query diagnosa di bagian Verifikasi di bawah.';
  end if;

  if fn_jumlah > 1 then
    raise exception
      'keempat tabel _purpspace memakai % fungsi updated_at yang berbeda — '
      'itu harus dirapikan dulu, karena tabel ini harus ikut yang mana pun '
      'menjadi ambigu.', fn_jumlah;
  end if;

  select t.tgfoid
    into fn_oid
    from pg_trigger   t
    join pg_class     c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and not t.tgisinternal
     and t.tgname like '%\_set\_updated\_at'
     and c.relname in ('workspaces_purpspace',
                       'panes_purpspace',
                       'github_connections_purpspace',
                       'env_vars_purpspace')
   limit 1;

  -- regprocedure mencetak signature lengkapnya, mis. `set_updated_at_purpspace()`.
  fn_sig := fn_oid::regprocedure::text;
  raise notice 'memakai fungsi updated_at milik tabel lain: %', fn_sig;

  if not exists (
    select 1
      from pg_trigger t
      join pg_class   c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'subscriptions_purpspace'
       and t.tgname  = 'subscriptions_purpspace_set_updated_at'
  ) then
    -- `%s`, bukan `%I`: `fn_sig` sudah berbentuk signature lengkap dari
    -- regprocedure (mis. `set_updated_at_purpspace()`), jadi mengutipnya lagi
    -- justru membuatnya tidak sah.
    execute format(
      'create trigger subscriptions_purpspace_set_updated_at '
      'before update on public.subscriptions_purpspace '
      'for each row execute function %s', fn_sig);
    raise notice 'added trigger subscriptions_purpspace_set_updated_at';
  else
    raise notice 'trigger subscriptions_purpspace_set_updated_at sudah ada';
  end if;
end
$$;

-- PostgREST menyimpan skema di cache. Tanpa baris ini, INSERT pertama dari
-- website bisa gagal dengan PGRST205 "Could not find the table
-- 'public.subscriptions_purpspace' in the schema cache".
notify pgrst, 'reload schema';

-- ============================================================================
-- Verifikasi
-- ============================================================================
-- 1. Bentuk kolomnya — harus tujuh baris, dan trial_ends_at NOT NULL:
--
--      select column_name, data_type, is_nullable, column_default
--        from information_schema.columns
--       where table_schema = 'public' and table_name = 'subscriptions_purpspace'
--       order by ordinal_position;
--
-- 2. RLS menyala DAN tidak punya satu pun policy (dua-duanya harus benar):
--
--      select relrowsecurity from pg_class
--       where oid = 'public.subscriptions_purpspace'::regclass;   -- harus t
--
--      select count(*) from pg_policies
--       where schemaname = 'public' and tablename = 'subscriptions_purpspace';
--                                                                 -- harus 0
--
-- 3. Trigger updated_at terpasang, dan menunjuk ke fungsi yang SAMA dengan
--    keempat tabel lain:
--
--      select c.relname          as tabel,
--             t.tgname           as trigger,
--             t.tgfoid::regprocedure as fungsi
--        from pg_trigger   t
--        join pg_class     c on c.oid = t.tgrelid
--        join pg_namespace n on n.oid = c.relnamespace
--       where n.nspname = 'public'
--         and not t.tgisinternal
--         and t.tgname like '%\_set\_updated\_at'
--       order by 1;
--
--    Harus lima baris, dan kolom `fungsi` harus sama persis di kelimanya.
--
-- 4. Idempoten: jalankan ulang seluruh file — tidak boleh ada error, dan
--    noticenya harus berbunyi "trigger ... sudah ada".
--
-- ============================================================================
-- Diagnosa, kalau migrasi ini berhenti dengan "tidak ada trigger ..."
-- ============================================================================
-- Artinya keempat tabel lain belum punya trigger updated_at, jadi tidak ada
-- yang bisa dicontoh. Jalankan dua query ini untuk melihat apa yang sebenarnya
-- ada, lalu jalankan 002 dan 003 sesuai hasilnya.
--
--   -- tabel apa saja yang ada:
--   select tablename from pg_tables
--    where schemaname = 'public' order by 1;
--
--   -- fungsi updated_at apa saja yang ada, dengan nama apa pun:
--   select n.nspname || '.' || p.proname || '()' as fungsi
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname like '%updated%at%'
--    order by 1;
