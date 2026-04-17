-- Migration: governance table provenance
-- ADR: 0101 (Governance table provenance convention via `provenance JSONB`)
-- Council: 2026-04-17 (source-tagging decision)
--
-- Adds `provenance JSONB NOT NULL DEFAULT '{}'` to 5 governance tables that
-- external importers (strike-mcp Tier 2, future DocuSeal / AI drafting / API
-- clients) write to. Extends the cascade convention established in
-- 20260421100200_cascade_a1_domain_tables.sql (department_operating_hours,
-- public_holiday, tariff_rate_table) and 20260421100350_cascade_a1_alter_existing.sql
-- (schedule_template, schedule_template_shift).
--
-- Rejected alternatives (from council):
-- - `source text + source_id text` — the `channel_event.source` pattern is a
--   domain classifier (event-origin type), not a provenance receipt. Using it
--   here would create semantic drift.
-- - Sidecar JSONL at filesystem layer — violates Cascade Invariant 8
--   ("must store" = in-row, in-transaction, in-RLS-scope).
-- - All 10 governance tables — YAGNI. Widen when a writer materializes for
--   control_list / routine / runbook / runbook_step / knowledge_test.
--
-- Convention (enforced by ADR, not DB): when non-empty, `provenance` SHOULD
-- have key `origin` with values:
--   - 'bubble-import'   (strike-mcp migration)
--   - 'platform-seed'   (20260412200200_seed_training_protocol.sql)
--   - 'admin-ui'        (TanStack mutations in dashboard/governance)
--   - 'api'             (programmatic Edge Function / Server Action)
--   - 'ai'              (future AI drafting feature)

BEGIN;

-- ─── 1. Add provenance columns ────────────────────────────────────────────

ALTER TABLE public.policy          ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.protocol        ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.procedure       ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.procedure_step  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.confirmation    ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';

-- ─── 2. Integrity guard (prevent scalar/array drift) ──────────────────────

ALTER TABLE public.policy
  ADD CONSTRAINT policy_provenance_is_object
  CHECK (jsonb_typeof(provenance) = 'object');

ALTER TABLE public.protocol
  ADD CONSTRAINT protocol_provenance_is_object
  CHECK (jsonb_typeof(provenance) = 'object');

ALTER TABLE public.procedure
  ADD CONSTRAINT procedure_provenance_is_object
  CHECK (jsonb_typeof(provenance) = 'object');

ALTER TABLE public.procedure_step
  ADD CONSTRAINT procedure_step_provenance_is_object
  CHECK (jsonb_typeof(provenance) = 'object');

ALTER TABLE public.confirmation
  ADD CONSTRAINT confirmation_provenance_is_object
  CHECK (jsonb_typeof(provenance) = 'object');

-- ─── 3. Partial indexes on origin — for "show me all migrated rows" queries ─

CREATE INDEX IF NOT EXISTS idx_policy_prov_origin
  ON public.policy ((provenance->>'origin'))
  WHERE provenance ? 'origin';

CREATE INDEX IF NOT EXISTS idx_protocol_prov_origin
  ON public.protocol ((provenance->>'origin'))
  WHERE provenance ? 'origin';

CREATE INDEX IF NOT EXISTS idx_procedure_prov_origin
  ON public.procedure ((provenance->>'origin'))
  WHERE provenance ? 'origin';

CREATE INDEX IF NOT EXISTS idx_procedure_step_prov_origin
  ON public.procedure_step ((provenance->>'origin'))
  WHERE provenance ? 'origin';

CREATE INDEX IF NOT EXISTS idx_confirmation_prov_origin
  ON public.confirmation ((provenance->>'origin'))
  WHERE provenance ? 'origin';

-- ─── 4. Column comments (document the convention at the column) ───────────

COMMENT ON COLUMN public.policy.provenance IS
  'Origin receipt. When non-empty, SHOULD include origin ∈ {bubble-import, platform-seed, admin-ui, api, ai}. Strike-mcp migrations: { origin, bubble_id, migrated_at, tenant, batch }. See ADR-0101.';
COMMENT ON COLUMN public.protocol.provenance IS
  'Origin receipt. See ADR-0101.';
COMMENT ON COLUMN public.procedure.provenance IS
  'Origin receipt. See ADR-0101.';
COMMENT ON COLUMN public.procedure_step.provenance IS
  'Origin receipt. See ADR-0101.';
COMMENT ON COLUMN public.confirmation.provenance IS
  'Origin receipt. See ADR-0101.';

COMMIT;
