---
title: "Journey: Admin verifies §13 anonymization of expired contract after retention clock"
feature: sma-308-gdpr-retention-paragraf-13
status: verified
created: 2026-05-14
updated: 2026-05-14
module: contracts
tags: [gdpr, bokforingsloven, retention, anonymization, employment-contract, §13]
---

# Journey: Admin anonymizes expired contract after §13 clock

**Feature:** SMA-308 — GDPR §13 retention fix (T3)
**ADR:** ADR-0312
**Surfaces:** Platform admin (service_role) + pg_cron automation

---

## Journey 1 — Admin verifies §13 anonymization runs correctly

### Precondition

- `employment_contract` row exists:
  - `status = 'expired'`
  - `end_date = '2020-06-15'`
  - `workspace_id` = a valid workspace
  - `framework_snapshot IS NOT NULL` (not yet anonymized)
- Today is 2027-01-15 (post-cutoff)
- `compute_anonymize_cutoff('2020-06-15', 0)` = `2025-12-31 23:59:59 UTC`
- Cutoff has passed → row is eligible
- `anonymize_contract` RPC is deployed (M1 migration applied)
- pg_cron job `contract-retention-anonymize` is registered

### Happy path — automated cron run

1. pg_cron fires `'0 2 1 * *'` on 2027-02-01 02:00 UTC
   → Executes `SELECT anonymize_contract(NULL, false);`
2. RPC iterates over terminated/expired contracts:
   - Finds the row: `end_date = 2020-06-15`, `COALESCE(end_date, ...) = 2020-06-15`
   - `compute_anonymize_cutoff('2020-06-15', 0) = 2025-12-31 23:59:59`
   - `now() > cutoff` → eligible
3. `dry_run = false` → executes UPDATE:
   - `framework_snapshot = NULL`
   - `compliance_overrides = '[]'::jsonb`
   - `decline_reason_text = '[anonymized]'`
   - `updated_at = now()`
4. RPC inserts `activity_trail` row:
   - `event_type = 'contract.retention_anonymized_§13'`
   - `actor_kind = 'platform'`
   - `actor_id = NULL`
   - `data.paragraph_ref = 'Bokf.lov §13'`
   - `data.cutoff_applied = '2025-12-31 23:59:59'`
   - `data.status_at_anonymization = 'expired'`
5. Admin operator can verify:
   ```sql
   SELECT * FROM activity_trail
   WHERE event_type = 'contract.retention_anonymized_§13'
   ORDER BY created_at DESC LIMIT 10;
   ```
   → Sees the anonymization event with full audit payload

**Postcondition:**
- Contract row: `framework_snapshot IS NULL`, `compliance_overrides = '[]'`, `decline_reason_text = '[anonymized]'`
- `activity_trail` contains immutable `contract.retention_anonymized_§13` event
- No posthog event fired from SQL (TypeScript-side consumer handles posthog routing if needed)

### Happy path — manual dry-run verification (pre-cron operator check)

1. Admin (service_role) runs: `SELECT * FROM anonymize_contract(NULL, TRUE);`
2. RPC returns: `(contract_id, workspace_id, 'expired', '2020-06-15', '2025-12-31 23:59:59 UTC', true)`
3. No UPDATE executed. No activity_trail insert.
4. Admin confirms expected rows before authorizing cron run.

**Postcondition:** No data modified. Admin has verified count + sample of eligible rows.

### Error path — `end_date IS NULL`, fallback to COALESCE

1. Contract has `end_date IS NULL`, `terminated_at = '2020-08-01'`, `status = 'terminated'`
2. COALESCE → `terminated_at::date = '2020-08-01'`
3. `compute_anonymize_cutoff('2020-08-01', 0) = 2025-12-31 23:59:59`
4. Eligible — proceeds to anonymization

**Postcondition:** Row anonymized. `activity_trail` captures that `terminated_at` was the COALESCE fallback (visible via `data.terminated_at_or_end_date`).

### Error path — no end-event date at all (all COALESCE arms NULL)

1. Contract has `end_date IS NULL`, `terminated_at IS NULL`, `created_at = '2022-01-01'`
2. COALESCE → `created_at::date = '2022-01-01'`
3. `compute_anonymize_cutoff('2022-01-01', 0) = 2027-12-31 23:59:59`
4. `now() = 2027-01-15` → NOT YET eligible
5. Row skipped silently this cycle (re-evaluated next month)

Note: if `end_date IS NULL AND terminated_at IS NULL` produces a `created_at`-based cutoff that IS past, the row is anonymized. This is the last-resort fallback — documented as residual risk in ADR-0312.

### Error path — `contract.retention_skipped_no_clock` event

> This event fires in `anonymize_contract` only when `end_date IS NULL` AND `terminated_at IS NULL` simultaneously in non-dry-run mode (inner logic in the ELSE branch when no eligible cutoff can be computed). See migration for exact trigger condition.

1. RPC inserts `activity_trail` row with `event_type = 'contract.retention_skipped_no_clock'`
2. `data.reason = 'no_end_event_date'`
3. Operator investigates: is this a data quality gap (missing end_date)?
