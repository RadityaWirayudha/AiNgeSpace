-- =============================================================================
-- PurpSpace — Supabase Setup
-- Jalankan sekali di: https://supabase.com/dashboard/project/ucneqextloynzymzxygi/editor
--
-- Mencakup:
--   1. RLS policies untuk 4 tabel desktop app
--   2. Kolom Midtrans untuk purpspace_subscriptions
-- =============================================================================


-- =============================================================================
-- BAGIAN 1: RLS Policies
-- =============================================================================

-- Aktifkan RLS di semua tabel (aman dijalankan ulang)
ALTER TABLE purpspace_workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purpspace_panes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE purpspace_env_vars          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purpspace_github_connections ENABLE ROW LEVEL SECURITY;

-- Hapus policies lama dulu supaya aman dijalankan ulang
DROP POLICY IF EXISTS "Users can read own workspaces"          ON purpspace_workspaces;
DROP POLICY IF EXISTS "Users can create own workspaces"        ON purpspace_workspaces;
DROP POLICY IF EXISTS "Users can update own workspaces"        ON purpspace_workspaces;
DROP POLICY IF EXISTS "Users can delete own workspaces"        ON purpspace_workspaces;

DROP POLICY IF EXISTS "Users can read panes in own workspaces"   ON purpspace_panes;
DROP POLICY IF EXISTS "Users can create panes in own workspaces" ON purpspace_panes;
DROP POLICY IF EXISTS "Users can update panes in own workspaces" ON purpspace_panes;
DROP POLICY IF EXISTS "Users can delete panes in own workspaces" ON purpspace_panes;

DROP POLICY IF EXISTS "Users can read env vars in own workspaces"   ON purpspace_env_vars;
DROP POLICY IF EXISTS "Users can create env vars in own workspaces" ON purpspace_env_vars;
DROP POLICY IF EXISTS "Users can update env vars in own workspaces" ON purpspace_env_vars;
DROP POLICY IF EXISTS "Users can delete env vars in own workspaces" ON purpspace_env_vars;

DROP POLICY IF EXISTS "Users can read own GitHub connection"   ON purpspace_github_connections;
DROP POLICY IF EXISTS "Users can create own GitHub connection" ON purpspace_github_connections;
DROP POLICY IF EXISTS "Users can update own GitHub connection" ON purpspace_github_connections;
DROP POLICY IF EXISTS "Users can delete own GitHub connection" ON purpspace_github_connections;

-- ----------------------------------------------------------------------------
-- purpspace_workspaces
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can read own workspaces"
  ON purpspace_workspaces FOR SELECT
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can create own workspaces"
  ON purpspace_workspaces FOR INSERT
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can update own workspaces"
  ON purpspace_workspaces FOR UPDATE
  USING ((select auth.jwt()->>'sub') = clerk_user_id)
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can delete own workspaces"
  ON purpspace_workspaces FOR DELETE
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

-- ----------------------------------------------------------------------------
-- purpspace_panes (kepemilikan lewat workspace_id)
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can read panes in own workspaces"
  ON purpspace_panes FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can create panes in own workspaces"
  ON purpspace_panes FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update panes in own workspaces"
  ON purpspace_panes FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can delete panes in own workspaces"
  ON purpspace_panes FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- ----------------------------------------------------------------------------
-- purpspace_env_vars (kepemilikan lewat workspace_id)
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can read env vars in own workspaces"
  ON purpspace_env_vars FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can create env vars in own workspaces"
  ON purpspace_env_vars FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update env vars in own workspaces"
  ON purpspace_env_vars FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can delete env vars in own workspaces"
  ON purpspace_env_vars FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- ----------------------------------------------------------------------------
-- purpspace_github_connections
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can read own GitHub connection"
  ON purpspace_github_connections FOR SELECT
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can create own GitHub connection"
  ON purpspace_github_connections FOR INSERT
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can update own GitHub connection"
  ON purpspace_github_connections FOR UPDATE
  USING ((select auth.jwt()->>'sub') = clerk_user_id)
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can delete own GitHub connection"
  ON purpspace_github_connections FOR DELETE
  USING ((select auth.jwt()->>'sub') = clerk_user_id);


-- =============================================================================
-- BAGIAN 2: Kolom Midtrans untuk purpspace_subscriptions
-- =============================================================================

ALTER TABLE public.purpspace_subscriptions
  ADD COLUMN IF NOT EXISTS midtrans_order_id  text,
  ADD COLUMN IF NOT EXISTS pending_order_id   text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS purpspace_subscriptions_pending_order_idx
  ON public.purpspace_subscriptions (pending_order_id)
  WHERE pending_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purpspace_subscriptions_midtrans_order_idx
  ON public.purpspace_subscriptions (midtrans_order_id)
  WHERE midtrans_order_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- VERIFIKASI — jalankan setelah semua selesai
-- =============================================================================

-- Cek 16 RLS policies:
-- SELECT tablename, count(*) as jumlah_policy
-- FROM pg_policies
-- WHERE tablename IN (
--   'purpspace_workspaces',
--   'purpspace_panes',
--   'purpspace_env_vars',
--   'purpspace_github_connections'
-- )
-- GROUP BY tablename
-- ORDER BY tablename;
-- Hasil yang benar: 4 baris, masing-masing jumlah_policy = 4

-- Cek kolom Midtrans:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'purpspace_subscriptions'
--   AND column_name IN ('midtrans_order_id', 'pending_order_id', 'current_period_end');
-- Hasil yang benar: 3 baris
