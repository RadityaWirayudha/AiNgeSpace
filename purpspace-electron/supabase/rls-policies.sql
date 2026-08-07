-- RLS Policies for PurpSpace Desktop App (Clerk JWT Integration)
--
-- Run this SQL in the Supabase Dashboard → SQL Editor after configuring
-- Clerk as a third-party auth provider (see SETUP-INSTRUCTIONS.md).
--
-- These policies enforce per-user isolation using the Clerk user ID extracted
-- from the session JWT: `(select auth.jwt()->>'sub')` evaluates to the Clerk
-- user_id, which matches the `clerk_user_id` columns in our tables.

-- =============================================================================
-- purpspace_workspaces: direct ownership via clerk_user_id
-- =============================================================================

CREATE POLICY "Users can read own workspaces"
  ON purpspace_workspaces
  FOR SELECT
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can create own workspaces"
  ON purpspace_workspaces
  FOR INSERT
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can update own workspaces"
  ON purpspace_workspaces
  FOR UPDATE
  USING ((select auth.jwt()->>'sub') = clerk_user_id)
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can delete own workspaces"
  ON purpspace_workspaces
  FOR DELETE
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

-- =============================================================================
-- purpspace_panes: indirect ownership via workspace_id FK
-- =============================================================================

CREATE POLICY "Users can read panes in own workspaces"
  ON purpspace_panes
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can create panes in own workspaces"
  ON purpspace_panes
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update panes in own workspaces"
  ON purpspace_panes
  FOR UPDATE
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
  ON purpspace_panes
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- =============================================================================
-- purpspace_env_vars: indirect ownership via workspace_id FK
-- =============================================================================

CREATE POLICY "Users can read env vars in own workspaces"
  ON purpspace_env_vars
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can create env vars in own workspaces"
  ON purpspace_env_vars
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update env vars in own workspaces"
  ON purpspace_env_vars
  FOR UPDATE
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
  ON purpspace_env_vars
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM purpspace_workspaces
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- =============================================================================
-- purpspace_github_connections: direct ownership via clerk_user_id
-- =============================================================================

CREATE POLICY "Users can read own GitHub connection"
  ON purpspace_github_connections
  FOR SELECT
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can create own GitHub connection"
  ON purpspace_github_connections
  FOR INSERT
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can update own GitHub connection"
  ON purpspace_github_connections
  FOR UPDATE
  USING ((select auth.jwt()->>'sub') = clerk_user_id)
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can delete own GitHub connection"
  ON purpspace_github_connections
  FOR DELETE
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- After running these policies, verify they were created:
--
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN (
--   'purpspace_workspaces',
--   'purpspace_panes',
--   'purpspace_env_vars',
--   'purpspace_github_connections'
-- )
-- ORDER BY tablename, cmd;

-- Expected: 16 policies total (4 per table: SELECT, INSERT, UPDATE, DELETE)
