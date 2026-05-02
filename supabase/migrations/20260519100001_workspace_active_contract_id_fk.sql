-- Migration: workspace.active_contract_id FK
-- Closes ADR-0124 amendment deferral + L-0061 P0 #3.
--
-- Column origin: 20260228140000_contract_system_foundation.sql:181 (added without FK).
-- Earlier deferral: 20260511100000_orphan_fk_fixes_and_polymorphic_comments.sql:8-11
-- (target ambiguity between public.contract and public.employment_contract).
--
-- Target disambiguation:
--   Sole writer is apps/web/src/app/api/webhooks/docuseal/route.ts:237. Branch
--   condition `if (contract.contract_type === "employee")` routes employee
--   contracts to public.employment_contract; the ELSE (SaaS) path writes
--   contract.contract_id (from public.contract) into workspace.active_contract_id.
--   No path writes employment_contract ids here. Target is public.contract.
--
-- Timestamp floor: tip at write time was 20260519000000. Picked 20260519100000.

BEGIN;

-- Defensive backfill: NULL out any orphans before enforcing the FK so the
-- ALTER does not fail on stale workspace rows pointing at deleted contracts.
UPDATE public.workspace w
SET active_contract_id = NULL
WHERE active_contract_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.contract c
    WHERE c.contract_id = w.active_contract_id
  );

ALTER TABLE public.workspace
  ADD CONSTRAINT workspace_active_contract_id_fkey
  FOREIGN KEY (active_contract_id)
  REFERENCES public.contract(contract_id)
  ON DELETE SET NULL;

COMMIT;
