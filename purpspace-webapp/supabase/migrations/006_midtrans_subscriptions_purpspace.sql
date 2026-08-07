-- Migrasi 006: Kolom Midtrans untuk purpspace_subscriptions
--
-- Jalankan di: https://supabase.com/dashboard/project/ucneqextloynzymzxygi/editor
--
-- Kolom yang ditambahkan:
--   midtrans_order_id  — order_id yang sudah LUNAS (idempotency key webhook)
--   pending_order_id   — order_id yang sedang menunggu pembayaran
--   current_period_end — kapan periode langganan berakhir setelah bayar
--
-- Catatan desain:
--   • midtrans_order_id nullable → user yang masih trial belum punya pembayaran
--   • pending_order_id di-clear ke NULL setelah webhook berhasil diproses
--   • Index partial (WHERE … IS NOT NULL) supaya banyak baris NULL tidak
--     saling bertabrakan di constraint UNIQUE

alter table public.purpspace_subscriptions
  add column if not exists midtrans_order_id  text,
  add column if not exists pending_order_id   text,
  add column if not exists current_period_end timestamptz;

-- Lookup cepat dari webhook: cari langganan berdasarkan pending_order_id
create index if not exists purpspace_subscriptions_pending_order_idx
  on public.purpspace_subscriptions (pending_order_id)
  where pending_order_id is not null;

-- Idempotency: order yang sama tidak boleh diproses dua kali
create unique index if not exists purpspace_subscriptions_midtrans_order_idx
  on public.purpspace_subscriptions (midtrans_order_id)
  where midtrans_order_id is not null;

notify pgrst, 'reload schema';

-- Verifikasi — jalankan setelah migration di atas selesai:
--
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_name = 'purpspace_subscriptions'
--   and column_name in ('midtrans_order_id','pending_order_id','current_period_end');
--
-- Harus ada 3 baris.
