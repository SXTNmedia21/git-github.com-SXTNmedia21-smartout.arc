-- ─────────────────────────────────────────────────────────────────────────────
-- strike-mcp: employment_contracts synthesis (manual, post-attest)
--
-- Purpose: synthesize one v3 public.employment_contract shell row per
--   migrated profile. Wrightegaarden has 0 Bubble employment_contracts
--   (the entity exists but is unused at the source), so this script
--   creates placeholders to satisfy v3's expectation that every active
--   profile has at least one contract.
--
-- Per smartout.ai ADR-0109: status='migration_incomplete' marks these
--   shells as needing post-migration enrichment (real position_title,
--   employment_category, salary, etc. via the standard contract editing
--   flow). The cutover communication must inform employees that their
--   contract page in v3 is "synthesized; ask HR to formalize."
--
-- Apply order: this SQL runs AFTER profile.SQL (which strike-mcp emits
--   from the auto_align attestation). Profiles must exist before contracts
--   reference them.
--
-- Idempotency: the WHERE NOT EXISTS clause ensures re-running is safe.
--   If an employment_contract already exists for a profile, no new shell
--   is inserted.
--
-- Audit: all shells carry source='bubble_migration'. Standard v3
--   reconciliation triggers (M8) skip rows with non-default source.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.employment_contract (
  workspace_id,
  profile_id,
  status,
  position_title,
  employment_category,
  start_date,
  source,
  created_at,
  updated_at
)
SELECT
  p.workspace_id,
  p.profile_id,
  'draft'::public.contract_status                  AS status,
  COALESCE(p.job_title, 'Migration placeholder')   AS position_title,
  'migration_incomplete'                            AS employment_category,
  COALESCE(p.created_at::date, CURRENT_DATE)       AS start_date,
  'bubble_migration'                                AS source,
  now()                                             AS created_at,
  now()                                             AS updated_at
FROM public.profile p
WHERE p.source = 'bubble_migration'
  AND NOT EXISTS (
    SELECT 1
    FROM public.employment_contract ec
    WHERE ec.profile_id = p.profile_id
  );

-- Verify count after run:
--   SELECT COUNT(*) FROM public.employment_contract WHERE source = 'bubble_migration';
-- Expected for Wrightegaarden: ~135 (one per migrated profile).
--
-- Post-migration handoff (HANDOFF-bubble-migration-tier1.md):
--   "Each migrated profile has a placeholder employment_contract with
--    employment_category='migration_incomplete'. HR must replace these
--    via the standard contract creation flow before payroll can run."
