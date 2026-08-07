-- PurpSpace — Database Setup Lengkap dari Nol
-- ============================================================================
-- File ini membuat semua 5 tabel, trigger, index, dan RLS sekaligus.
-- Naming convention: purpspace_* (prefix project, underscore, nama entitas)
-- Sifat: IDEMPOTEN — aman dijalankan berulang kali tanpa error.
-- Cara pakai: Supabase → SQL Editor → paste seluruh file → Run
-- ============================================================================


-- ============================================================================
-- FUNGSI TRIGGER updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at_purpspace()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================================
-- 1. purpspace_workspaces
-- Satu baris per workspace milik satu user Clerk.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purpspace_workspaces (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text        NOT NULL,
  name          text        NOT NULL,
  working_dir   text        NOT NULL,
  layout_preset text        NOT NULL DEFAULT 'l1',
  agent_ids     text[]      NOT NULL DEFAULT '{}',
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT purpspace_workspaces_name_not_blank
    CHECK (length(btrim(name)) BETWEEN 1 AND 255),
  CONSTRAINT purpspace_workspaces_working_dir_not_blank
    CHECK (length(btrim(working_dir)) BETWEEN 1 AND 4096),
  CONSTRAINT purpspace_workspaces_layout_known
    CHECK (layout_preset IN ('l1', 'l2v', 'l2h', 'l4', 'l6', 'l8'))
);

ALTER TABLE public.purpspace_workspaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS purpspace_workspaces_owner_idx
  ON public.purpspace_workspaces (clerk_user_id, sort_order, created_at);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'purpspace_workspaces'
      AND t.tgname  = 'purpspace_workspaces_set_updated_at'
  ) THEN
    CREATE TRIGGER purpspace_workspaces_set_updated_at
      BEFORE UPDATE ON public.purpspace_workspaces
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_purpspace();
  END IF;
END $$;


-- ============================================================================
-- 2. purpspace_panes
-- Satu baris per pane pada grid workspace.
-- FK ke purpspace_workspaces → cascade delete otomatis.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purpspace_panes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL
                 REFERENCES public.purpspace_workspaces (id) ON DELETE CASCADE,
  title        text        NOT NULL,
  position     integer     NOT NULL DEFAULT 0,
  pinned       boolean     NOT NULL DEFAULT false,
  tree         jsonb       NOT NULL,
  name_seq     integer     NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT purpspace_panes_title_not_blank
    CHECK (length(btrim(title)) BETWEEN 1 AND 255),
  CONSTRAINT purpspace_panes_tree_is_node
    CHECK (jsonb_typeof(tree) = 'object' AND tree ? 'type'),
  CONSTRAINT purpspace_panes_name_seq_positive
    CHECK (name_seq >= 1)
);

ALTER TABLE public.purpspace_panes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS purpspace_panes_workspace_idx
  ON public.purpspace_panes (workspace_id, position);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'purpspace_panes'
      AND t.tgname  = 'purpspace_panes_set_updated_at'
  ) THEN
    CREATE TRIGGER purpspace_panes_set_updated_at
      BEFORE UPDATE ON public.purpspace_panes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_purpspace();
  END IF;
END $$;


-- ============================================================================
-- 3. purpspace_github_connections
-- Satu koneksi GitHub per user Clerk (UNIQUE clerk_user_id).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purpspace_github_connections (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id          text        NOT NULL UNIQUE,
  github_user_id         text        NOT NULL,
  github_username        text        NOT NULL,
  access_token_encrypted text        NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT purpspace_github_connections_token_shape
    CHECK (access_token_encrypted ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$')
);

ALTER TABLE public.purpspace_github_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'purpspace_github_connections'
      AND t.tgname  = 'purpspace_github_connections_set_updated_at'
  ) THEN
    CREATE TRIGGER purpspace_github_connections_set_updated_at
      BEFORE UPDATE ON public.purpspace_github_connections
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_purpspace();
  END IF;
END $$;


-- ============================================================================
-- 4. purpspace_env_vars
-- Environment Variables per workspace, nilai selalu terenkripsi AES-256-GCM.
-- FK ke purpspace_workspaces → cascade delete otomatis.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purpspace_env_vars (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL
                    REFERENCES public.purpspace_workspaces (id) ON DELETE CASCADE,
  key             text        NOT NULL,
  value_encrypted text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT purpspace_env_vars_workspace_key_unique
    UNIQUE (workspace_id, key),
  CONSTRAINT purpspace_env_vars_key_format
    CHECK (key ~ '^[A-Za-z_][A-Za-z0-9_]{0,254}$'),
  CONSTRAINT purpspace_env_vars_value_shape
    CHECK (value_encrypted ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]*$')
);

ALTER TABLE public.purpspace_env_vars ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'purpspace_env_vars'
      AND t.tgname  = 'purpspace_env_vars_set_updated_at'
  ) THEN
    CREATE TRIGGER purpspace_env_vars_set_updated_at
      BEFORE UPDATE ON public.purpspace_env_vars
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_purpspace();
  END IF;
END $$;


-- ============================================================================
-- 5. purpspace_subscriptions
-- Satu baris per akun — status langganan + kolom Midtrans payment.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purpspace_subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- UNIQUE menolak dua request daftar bersamaan untuk akun yang sama (race condition).
  clerk_user_id       text        NOT NULL UNIQUE,

  -- 'basic' | 'pro' — cocok persis dengan PLANS di src/content/plans.ts.
  plan_id             text        NOT NULL,

  -- Status lifecycle langganan.
  status              text        NOT NULL DEFAULT 'trialing',

  -- Dihitung di server saat pertama daftar; tidak pernah dari jam browser.
  trial_ends_at       timestamptz NOT NULL,

  -- Midtrans: order_id yang sudah LUNAS (diisi webhook saat settlement).
  midtrans_order_id   text        NULL,
  -- Midtrans: order_id sedang menunggu pembayaran (diisi saat create transaction).
  pending_order_id    text        NULL,
  -- Kapan periode berbayar berakhir (diisi webhook saat settlement).
  current_period_end  timestamptz NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT purpspace_subscriptions_plan_known
    CHECK (plan_id IN ('basic', 'pro')),
  CONSTRAINT purpspace_subscriptions_status_known
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  CONSTRAINT purpspace_subscriptions_clerk_user_id_not_blank
    CHECK (length(btrim(clerk_user_id)) BETWEEN 1 AND 255)
);

ALTER TABLE public.purpspace_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'purpspace_subscriptions'
      AND t.tgname  = 'purpspace_subscriptions_set_updated_at'
  ) THEN
    CREATE TRIGGER purpspace_subscriptions_set_updated_at
      BEFORE UPDATE ON public.purpspace_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_purpspace();
  END IF;
END $$;


-- ============================================================================
-- REFRESH CACHE POSTGREST
-- Tanpa ini, INSERT pertama setelah run bisa gagal dengan PGRST205.
-- ============================================================================

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- VERIFIKASI — jalankan query ini satu per satu untuk konfirmasi
-- ============================================================================
--
-- 1. Lima tabel purpspace_* harus ada:
--
--    SELECT tablename FROM pg_tables
--     WHERE schemaname = 'public' AND tablename LIKE 'purpspace_%'
--     ORDER BY 1;
--
--    Hasil yang benar (5 baris):
--      purpspace_env_vars
--      purpspace_github_connections
--      purpspace_panes
--      purpspace_subscriptions
--      purpspace_workspaces
--
-- 2. RLS aktif di semua tabel (semua harus 't'):
--
--    SELECT relname, relrowsecurity FROM pg_class
--     WHERE relname LIKE 'purpspace_%' AND relkind = 'r'
--     ORDER BY 1;
--
-- 3. Lima trigger updated_at terpasang, semua pakai fungsi yang sama:
--
--    SELECT c.relname AS tabel, t.tgname AS trigger,
--           t.tgfoid::regprocedure AS fungsi
--      FROM pg_trigger t
--      JOIN pg_class c ON c.oid = t.tgrelid
--      JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public' AND NOT t.tgisinternal
--       AND c.relname LIKE 'purpspace_%'
--     ORDER BY 1;
--
--    Kolom `fungsi` harus set_updated_at_purpspace() di semua 5 baris.
--
-- 4. Kolom Midtrans ada di purpspace_subscriptions:
--
--    SELECT column_name, data_type, is_nullable
--      FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'purpspace_subscriptions'
--     ORDER BY ordinal_position;
--
--    Harus ada: midtrans_order_id, pending_order_id, current_period_end (semua YES/nullable)
