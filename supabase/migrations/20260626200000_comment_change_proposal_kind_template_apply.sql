-- supabase/migrations/20260626200000_comment_change_proposal_kind_template_apply.sql
--
-- Adds 'template_apply' to the change_proposal.kind COMMENT taxonomy.
-- ADR-0417: week-template application writes one change_proposal per bundle.
--
-- NO DDL change — kind is TEXT column (added in 20260604000002).
-- NO ALTER TYPE, NO new column, NO trigger, NO RLS change.
-- COMMENT-only update per ADR-0417 §Track-A instruction.
--
-- Timestamp chosen > current tip (20260626100000_bootstrap_capability_authority_seed_and_service_role.sql).

COMMENT ON COLUMN public.change_proposal.kind IS
  'Application-domain classifier for the proposal type. '
  'Accepted values: '
  '  ''wage_line_override'' — payroll line override (Phase 2, ADR-0292). '
  '     Payload shape (in changes JSONB): '
  '       { calculation_id, original_amount_cents, proposed_amount_cents, '
  '         reason (≥10 chars), category, period_id }. '
  '  ''scheduler_bundle'' — greedy solver proposal (ADR-0307 amended, ADR-0309). '
  '     Payload shape (in changes JSONB): '
  '       { solver_version, solver_run_id, solver_inputs_hash, objective_score, '
  '         gap_count, proposed_shifts[], gaps[] }. '
  '     Accepts: all-or-nothing V1 (status pending→applied). '
  '     No partial-accept V1 — re-run solver with adjusted constraints. '
  '  ''template_apply'' — week-template apply (ADR-0417). '
  '     Derives proposed_shifts[] from a past archived planning_cycle. '
  '     Payload shape (in changes JSONB): '
  '       { kind: ''template_apply'', template_id: uuid (source planning_cycle_id), '
  '         applied_date_range: { from: DATE, to: DATE }, '
  '         department_id: uuid, '
  '         proposed_shifts[]: [{ shift_date: DATE, role: TEXT, '
  '                               start_time: TIME, end_time: TIME, '
  '                               position_id: uuid|null, department_id: uuid }], '
  '         gap_count: int, '
  '         applied_template_provenance: { applied_at: iso8601, applied_by: uuid } }. '
  '     Accepts via scheduler.accept_proposal — bulk INSERT schedule_shift with '
  '     employee_id=NULL (unassigned; manager assigns post-accept). '
  '  NULL — pre-Phase-2 cascade proposals created before this column existed. '
  'DO NOT add new values here without a migration comment + Zod schema in capability tool. '
  'DO NOT convert to enum without coordinating helpdesk, billing, and daily-operation campaigns.';
