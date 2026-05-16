-- ─────────────────────────────────────────────────────────────────────────────
-- F-DB-20 + F-DB-22 — engine_* RLS WITH CHECK sister-table sweep
-- Audit refs: 2026-05-15-adr-contract-validation, slice 07
-- Mirror of: 20260608120000_sortie_a2_d6_rls_with_check.sql (D6 sweep, F-DB-09 closure)
--
-- Pre-state — same gap class as pre-ADR-0299 shift_approval:
--   public.engine_sessions          — workspace_isolation_sessions FOR ALL USING(...) — no WITH CHECK
--   public.engine_inbox             — workspace_isolation_inbox    FOR ALL USING(...) — no WITH CHECK
--   public.engine_authority_config  — admin_manage_authority       FOR ALL USING(...) — no WITH CHECK
--
-- engine_authority_config also has service_manage_authority FOR ALL USING(auth.role()='service_role')
-- with no WITH CHECK. Service-role bypasses RLS anyway but defense-in-depth keeps the symmetric
-- shape for the rare future where someone strips BYPASSRLS off the service_role role.
--
-- Today no JWT writer hits engine_sessions or engine_inbox — both are written exclusively by
-- the stage-engine service_role client. But the structural gap means the moment a JWT-path
-- writer lands (mobile sync flush, BFF mutation route, agent-tool capability) without the
-- structural fix, a JWT caller in two workspaces could flip workspace_id on INSERT/UPDATE.
-- engine_authority_config has /platform-admin/governance UI today; admin/owner role check
-- is preserved but WITH CHECK closes the cross-workspace forge for admins-in-two-workspaces.
--
-- Fix: drop FOR ALL policies; recreate as per-verb SELECT/INSERT/UPDATE/DELETE with
-- symmetric USING + WITH CHECK. WITH CHECK rejects forgeable workspace_id flips with 42501.
-- api_key_read_authority (engine_authority_config) and api_key_read_sessions (if any) remain
-- untouched — they are FOR SELECT only, where WITH CHECK doesn't apply.
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- TABLE 1 — public.engine_sessions
-- =============================================================================

DROP POLICY IF EXISTS "workspace_isolation_sessions" ON public.engine_sessions;

CREATE POLICY "jwt_read_engine_sessions" ON public.engine_sessions
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

CREATE POLICY "jwt_insert_engine_sessions" ON public.engine_sessions
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

CREATE POLICY "jwt_update_engine_sessions" ON public.engine_sessions
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

CREATE POLICY "jwt_delete_engine_sessions" ON public.engine_sessions
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

-- =============================================================================
-- TABLE 2 — public.engine_inbox
-- =============================================================================

DROP POLICY IF EXISTS "workspace_isolation_inbox" ON public.engine_inbox;

CREATE POLICY "jwt_read_engine_inbox" ON public.engine_inbox
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

CREATE POLICY "jwt_insert_engine_inbox" ON public.engine_inbox
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

CREATE POLICY "jwt_update_engine_inbox" ON public.engine_inbox
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

CREATE POLICY "jwt_delete_engine_inbox" ON public.engine_inbox
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

-- =============================================================================
-- TABLE 3 — public.engine_authority_config
-- Pre-state: admin_manage_authority FOR ALL — admin/owner only, no WITH CHECK
-- service_manage_authority FOR ALL on service_role — no WITH CHECK
-- api_key_read_authority FOR SELECT — UNTOUCHED (WITH CHECK N/A on SELECT)
-- =============================================================================

DROP POLICY IF EXISTS "admin_manage_authority" ON public.engine_authority_config;

CREATE POLICY "admin_read_authority" ON public.engine_authority_config
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "admin_insert_authority" ON public.engine_authority_config
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "admin_update_authority" ON public.engine_authority_config
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "admin_delete_authority" ON public.engine_authority_config
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
    )
  );

-- service_role path — symmetric WITH CHECK for defense-in-depth.
DROP POLICY IF EXISTS "service_manage_authority" ON public.engine_authority_config;

CREATE POLICY "service_read_authority" ON public.engine_authority_config
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "service_insert_authority" ON public.engine_authority_config
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_update_authority" ON public.engine_authority_config
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_delete_authority" ON public.engine_authority_config
  FOR DELETE
  USING (auth.role() = 'service_role');
