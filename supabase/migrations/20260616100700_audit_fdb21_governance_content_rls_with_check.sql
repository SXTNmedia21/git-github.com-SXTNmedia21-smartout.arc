-- ─────────────────────────────────────────────────────────────────────────────
-- F-DB-21 — Governance content tables RLS WITH CHECK sweep
-- Audit refs: 2026-05-15-adr-contract-validation, slice 07
-- Mirror of: 20260608120000_sortie_a2_d6_rls_with_check.sql (D6 sweep)
--            20260616100600_audit_fdb20_fdb22_engine_rls_with_check.sql (engine_* sweep)
--
-- 19 governance content tables under public.* retained the FOR ALL USING(...)
-- no-WITH-CHECK shape that ADR-0299 classified as the cross-workspace forge
-- class. Same gap: admin/owner who holds profiles in two workspaces can flip
-- workspace_id on INSERT/UPDATE to a peer workspace.
--
-- All 19 are admin-only writes — narrower blast radius than the D6 sweep
-- (which had employee-tier read access), but the structural gap is identical.
--
-- Two policy shapes preserved per table:
--   Pattern A — direct workspace_id check: department, location, zone, asset,
--               position, team, season, policy, protocol (9 tables)
--   Pattern B — parent-table workspace check via EXISTS or IN: procedure,
--               procedure_step, control_list, routine, runbook, runbook_step,
--               knowledge_test, confirmation, protocol_assignment (9 tables)
--   Pattern C — team_member via team join (1 table)
--
-- SELECT policies LEFT UNTOUCHED — WITH CHECK does not apply on SELECT and
-- read-side visibility was not flagged. service_role + api_key policies
-- (where present) likewise UNTOUCHED.
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- Pattern A — direct workspace_id check (9 tables)
-- =============================================================================

-- ── department ──
DROP POLICY IF EXISTS "Write department" ON public.department;
CREATE POLICY "Insert department" ON public.department FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update department" ON public.department FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete department" ON public.department FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ── location ──
DROP POLICY IF EXISTS "Write location" ON public.location;
CREATE POLICY "Insert location" ON public.location FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update location" ON public.location FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete location" ON public.location FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ── zone ──
DROP POLICY IF EXISTS "Write zone" ON public.zone;
CREATE POLICY "Insert zone" ON public.zone FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update zone" ON public.zone FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete zone" ON public.zone FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ── asset ──
DROP POLICY IF EXISTS "Write asset" ON public.asset;
CREATE POLICY "Insert asset" ON public.asset FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update asset" ON public.asset FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete asset" ON public.asset FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ── position ──
DROP POLICY IF EXISTS "Write position" ON public.position;
CREATE POLICY "Insert position" ON public.position FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update position" ON public.position FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete position" ON public.position FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ── team ──
DROP POLICY IF EXISTS "Write team" ON public.team;
CREATE POLICY "Insert team" ON public.team FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update team" ON public.team FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete team" ON public.team FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ── season ──
DROP POLICY IF EXISTS "Write season" ON public.season;
CREATE POLICY "Insert season" ON public.season FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update season" ON public.season FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete season" ON public.season FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ── policy ──
DROP POLICY IF EXISTS "Write policy" ON public.policy;
CREATE POLICY "Insert policy" ON public.policy FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update policy" ON public.policy FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete policy" ON public.policy FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ── protocol ──
DROP POLICY IF EXISTS "Write protocol" ON public.protocol;
CREATE POLICY "Insert protocol" ON public.protocol FOR INSERT WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Update protocol" ON public.protocol FOR UPDATE USING (is_admin_in_workspace(auth.uid(), workspace_id)) WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Delete protocol" ON public.protocol FOR DELETE USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- =============================================================================
-- Pattern C — team_member via team join
-- =============================================================================

DROP POLICY IF EXISTS "Write team member" ON public.team_member;
CREATE POLICY "Insert team member" ON public.team_member FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.team
            WHERE team.team_id = team_member.team_id
              AND is_admin_in_workspace(auth.uid(), team.workspace_id))
  );
CREATE POLICY "Update team member" ON public.team_member FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.team
            WHERE team.team_id = team_member.team_id
              AND is_admin_in_workspace(auth.uid(), team.workspace_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.team
            WHERE team.team_id = team_member.team_id
              AND is_admin_in_workspace(auth.uid(), team.workspace_id))
  );
CREATE POLICY "Delete team member" ON public.team_member FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.team
            WHERE team.team_id = team_member.team_id
              AND is_admin_in_workspace(auth.uid(), team.workspace_id))
  );

-- =============================================================================
-- Pattern B — protocol-child tables via parent workspace
-- =============================================================================

-- ── procedure ──
DROP POLICY IF EXISTS "Write procedure" ON public.procedure;
CREATE POLICY "Insert procedure" ON public.procedure FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = procedure.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Update procedure" ON public.procedure FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = procedure.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = procedure.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Delete procedure" ON public.procedure FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = procedure.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));

-- ── procedure_step ──
DROP POLICY IF EXISTS "Write procedure_step" ON public.procedure_step;
CREATE POLICY "Insert procedure_step" ON public.procedure_step FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.procedure p
    JOIN public.protocol pr ON p.protocol_id = pr.protocol_id
    WHERE p.procedure_id = procedure_step.procedure_id
      AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  ));
CREATE POLICY "Update procedure_step" ON public.procedure_step FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.procedure p
    JOIN public.protocol pr ON p.protocol_id = pr.protocol_id
    WHERE p.procedure_id = procedure_step.procedure_id
      AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.procedure p
    JOIN public.protocol pr ON p.protocol_id = pr.protocol_id
    WHERE p.procedure_id = procedure_step.procedure_id
      AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  ));
CREATE POLICY "Delete procedure_step" ON public.procedure_step FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.procedure p
    JOIN public.protocol pr ON p.protocol_id = pr.protocol_id
    WHERE p.procedure_id = procedure_step.procedure_id
      AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  ));

-- ── control_list ──
DROP POLICY IF EXISTS "Write control_list" ON public.control_list;
CREATE POLICY "Insert control_list" ON public.control_list FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = control_list.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Update control_list" ON public.control_list FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = control_list.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = control_list.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Delete control_list" ON public.control_list FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = control_list.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));

-- ── routine ──
DROP POLICY IF EXISTS "Write routine" ON public.routine;
CREATE POLICY "Insert routine" ON public.routine FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = routine.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Update routine" ON public.routine FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = routine.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = routine.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Delete routine" ON public.routine FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = routine.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));

-- ── runbook ──
DROP POLICY IF EXISTS "Write runbook" ON public.runbook;
CREATE POLICY "Insert runbook" ON public.runbook FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = runbook.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Update runbook" ON public.runbook FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = runbook.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = runbook.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Delete runbook" ON public.runbook FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = runbook.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));

-- ── runbook_step ──
DROP POLICY IF EXISTS "Write runbook_step" ON public.runbook_step;
CREATE POLICY "Insert runbook_step" ON public.runbook_step FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.runbook r
    JOIN public.protocol pr ON r.protocol_id = pr.protocol_id
    WHERE r.runbook_id = runbook_step.runbook_id
      AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  ));
CREATE POLICY "Update runbook_step" ON public.runbook_step FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.runbook r
    JOIN public.protocol pr ON r.protocol_id = pr.protocol_id
    WHERE r.runbook_id = runbook_step.runbook_id
      AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.runbook r
    JOIN public.protocol pr ON r.protocol_id = pr.protocol_id
    WHERE r.runbook_id = runbook_step.runbook_id
      AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  ));
CREATE POLICY "Delete runbook_step" ON public.runbook_step FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.runbook r
    JOIN public.protocol pr ON r.protocol_id = pr.protocol_id
    WHERE r.runbook_id = runbook_step.runbook_id
      AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  ));

-- ── knowledge_test ──
DROP POLICY IF EXISTS "Write knowledge_test" ON public.knowledge_test;
CREATE POLICY "Insert knowledge_test" ON public.knowledge_test FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = knowledge_test.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Update knowledge_test" ON public.knowledge_test FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = knowledge_test.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = knowledge_test.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Delete knowledge_test" ON public.knowledge_test FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = knowledge_test.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));

-- ── confirmation ──
DROP POLICY IF EXISTS "Write confirmation" ON public.confirmation;
CREATE POLICY "Insert confirmation" ON public.confirmation FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = confirmation.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Update confirmation" ON public.confirmation FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = confirmation.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = confirmation.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Delete confirmation" ON public.confirmation FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = confirmation.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));

-- ── protocol_assignment ──
DROP POLICY IF EXISTS "Write protocol_assignment" ON public.protocol_assignment;
CREATE POLICY "Insert protocol_assignment" ON public.protocol_assignment FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = protocol_assignment.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Update protocol_assignment" ON public.protocol_assignment FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = protocol_assignment.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocol
                      WHERE protocol.protocol_id = protocol_assignment.protocol_id
                        AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
CREATE POLICY "Delete protocol_assignment" ON public.protocol_assignment FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocol
                 WHERE protocol.protocol_id = protocol_assignment.protocol_id
                   AND is_admin_in_workspace(auth.uid(), protocol.workspace_id)));
