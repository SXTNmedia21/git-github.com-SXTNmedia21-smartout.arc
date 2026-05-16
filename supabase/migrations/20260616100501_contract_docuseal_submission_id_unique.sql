-- F-WH-05: Add UNIQUE constraint on contract.docuseal_submission_id
-- Ensures DocuSeal webhook retries cannot cause double-writes when the same
-- submission_id exists on multiple contract rows (legacy bug class). The
-- handler does maybeSingle()-lookup then UPDATE; without UNIQUE the row
-- chosen is non-deterministic when duplicates exist.
--
-- Same class as F-WH-04 (20260611100000_call_log_unique_session.sql).
-- ADR-0079.
--
-- Pre-migration safety: deduplicate any existing duplicates, keeping the most
-- recent row by signed_at then created_at. NULL values are allowed to repeat
-- (partial unique index excludes them).

-- Step 1: NULL-out duplicate docuseal_submission_id on older rows.
-- Keep the row with the highest signed_at (NULLs last) then created_at; the
-- chosen row retains its docuseal_submission_id, the rest are NULLed so the
-- partial unique index can be created without conflict.
UPDATE public.contract
   SET docuseal_submission_id = NULL
 WHERE contract_id IN (
   SELECT contract_id
     FROM (
       SELECT contract_id,
              ROW_NUMBER() OVER (
                PARTITION BY docuseal_submission_id
                ORDER BY signed_at DESC NULLS LAST, created_at DESC
              ) AS rn
         FROM public.contract
        WHERE docuseal_submission_id IS NOT NULL
     ) ranked
    WHERE ranked.rn > 1
 );

-- Step 2: drop the existing non-unique index, create partial UNIQUE index.
-- Partial because docuseal_submission_id is NULL on contract rows that were
-- never sent via DocuSeal (drafts, externally-signed contracts).
DROP INDEX IF EXISTS public.idx_contract_docuseal_sub;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_docuseal_sub_unique
  ON public.contract (docuseal_submission_id)
  WHERE docuseal_submission_id IS NOT NULL;
