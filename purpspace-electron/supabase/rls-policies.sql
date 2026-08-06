-- RLS Policies for PurpSpace Desktop App (Clerk JWT Integration)
--
-- Run this SQL in the Supabase Dashboard → SQL Editor after configuring
-- Clerk as a third-party auth provider (see SETUP-INSTRUCTIONS.md).
--
-- These policies enforce per-user isolation using the Clerk user ID extracted
-- from the session JWT: `(select auth.jwt()->>'sub')` evaluates to the Clerk
-- user_id, which matches the `clerk_user_id` columns in our tables.

-- =============================================================================
-- workspaces_purpspace: direct ownership via clerk_user_id
-- =============================================================================

CREATE POLICY "Users can read own workspaces"
  ON workspaces_purpspace
  FOR SELECT
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can create own workspaces"
  ON workspaces_purpspace
  FOR INSERT
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can update own workspaces"
  ON workspaces_purpspace
  FOR UPDATE
  USING ((select auth.jwt()->>'sub') = clerk_user_id)
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can delete own workspaces"
  ON workspaces_purpspace
  FOR DELETE
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

-- =============================================================================
-- panes_purpspace: indirect ownership via workspace_id FK
-- =============================================================================

CREATE POLICY "Users can read panes in own workspaces"
  ON panes_purpspace
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can create panes in own workspaces"
  ON panes_purpspace
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update panes in own workspaces"
  ON panes_purpspace
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can delete panes in own workspaces"
  ON panes_purpspace
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- =============================================================================
-- env_vars_purpspace: indirect ownership via workspace_id FK
-- =============================================================================

CREATE POLICY "Users can read env vars in own workspaces"
  ON env_vars_purpspace
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can create env vars in own workspaces"
  ON env_vars_purpspace
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update env vars in own workspaces"
  ON env_vars_purpspace
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can delete env vars in own workspaces"
  ON env_vars_purpspace
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces_purpspace
      WHERE clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- =============================================================================
-- github_connections_purpspace: direct ownership via clerk_user_id
-- =============================================================================

CREATE POLICY "Users can read own GitHub connection"
  ON github_connections_purpspace
  FOR SELECT
  USING ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can create own GitHub connection"
  ON github_connections_purpspace
  FOR INSERT
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can update own GitHub connection"
  ON github_connections_purpspace
  FOR UPDATE
  USING ((select auth.jwt()->>'sub') = clerk_user_id)
  WITH CHECK ((select auth.jwt()->>'sub') = clerk_user_id);

CREATE POLICY "Users can delete own GitHub connection"
  ON github_connections_purpspace
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
--   'workspaces_purpspace',
--   'panes_purpspace',
--   'env_vars_purpspace',
--   'github_connections_purpspace'
-- )
-- ORDER BY tablename, cmd;

-- Expected: 16 policies total (4 per table: SELECT, INSERT, UPDATE, DELETE)
