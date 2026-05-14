---
title: "Journey: Audit discovers late-retention residual from pre-fix anonymization"
feature: sma-308-gdpr-retention-paragraf-13
status: verified
created: 2026-05-14
updated: 2026-05-14
module: contracts
tags: [gdpr, retention, anonymization, audit, residual-breach, employment-contract]
---

# Journey: Audit discovers late-retention residual (pre-fix breach)

**Feature:** SMA-308 — GDPR §13 retention fix (T3)
**ADR:** ADR-0312
**Surfaces:** Platform admin / compliance review (operational only — no code path)

---

## Journey 2 — Council Q3 breach surface discovery

This journey is **operational, not code-driven.** It documents the investigation and documentation flow if pre-fix rows are found via Council Q3 query.

### Precondition

- M1 migration (`20260615100000`) has been applied to local Supabase
- Council Q3 query is run pre-merge to assess residual breach surface:
  ```sql
  SELECT
    contract_id,
    workspace_id,
    created_at,
    status,
    updated_at
  FROM employment_contract
  WHERE framework_snapshot IS NULL
    AND compliance_overrides = '[]'
    AND decline_reason_text = '[anonymized]'
  ORDER BY updated_at DESC
  LIMIT 50;
  ```
- Bubble migration (ADR-0266/ADR-0268) imported legacy contracts that may carry `created_at` values pre-2023

### Scenario A — Zero rows returned (clean)

1. Query returns 0 rows
2. HANDOFF declares: "Council Q3 breach surface = 0. No rows were incorrectly anonymized by the superseded 3-year `created_at` clock."
3. Sortie closes normally

**Postcondition:** No residual breach documented. ADR-0312 breach section is informational only.

### Scenario B — Rows returned (residual breach)

1. Query returns N rows with `created_at < now() - 3 years`
2. Each row was anonymized by the superseded `20260501120000` RPC (wrong 3yr `created_at` clock)
3. Per ADR-0312 § Consequences: **wrongly-anonymized rows cannot be restored.** PII is gone.
4. Operator (Pontus or admin) reviews:
   - Are these Bubble-migrated historical contracts? (check `source` column)
   - When were they anonymized? (check `activity_trail` if trail existed pre-2026-05-01)
   - Is the wrong anonymization itself a GDPR violation? (PII erased earlier than §13 required — generally favors GDPR Art. 17 erasure over retention; legal review needed if erasure was "too early" under §13)
5. Operator documents residual breach in HANDOFF:
   - `contract_id` list
   - `workspace_id` list
   - Estimated date of incorrect anonymization
   - Assessment: "wrong clock used, cannot restore PII, §13 bilag unavailable for these rows"
6. Platform logs `activity_trail` entry manually:
   ```sql
   INSERT INTO activity_trail (workspace_id, actor_id, actor_kind, entity_type, entity_id, event_type, action_verb, data)
   SELECT
     workspace_id,
     NULL,
     'platform',
     'employment_contract',
     contract_id::text,
     'contract.retention_residual_breach',
     'documented',
     jsonb_build_object('reason', 'pre_fix_wrong_clock', 'adrs', 'ADR-0312')
   FROM employment_contract
   WHERE framework_snapshot IS NULL
     AND compliance_overrides = '[]'
     AND decline_reason_text = '[anonymized]';
   ```

**Postcondition:**
- HANDOFF contains breach table with `contract_id`, `workspace_id`, estimated anonymization date
- `activity_trail` contains one `contract.retention_residual_breach` event per affected contract
- Legal counsel notified if any Bubble-migrated rows with `created_at < 2021-01-01` are affected (§13 retention period would still have been active)

### Error path — Q3 query runs before M1 migration applied

If the new columns (`declined_at`, `terminated_at`) don't exist yet, the Q3 query still works (it does not reference them). Safe to run pre- or post-migration.

### Error path — `activity_trail` has no pre-2026-05-01 entries for these contracts

The original `20260501120000` anonymize RPC did not insert `activity_trail` events. If wrong anonymization occurred before the audit trigger (`20260430182443`) was deployed, there is no trail entry. Document: "anonymization timestamp estimated from `updated_at` column."
