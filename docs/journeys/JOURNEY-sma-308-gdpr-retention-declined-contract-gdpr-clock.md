---
title: "Journey: Declined contract anonymization via GDPR Art. 17 clock"
feature: sma-308-gdpr-retention-paragraf-13
status: verified
created: 2026-05-14
updated: 2026-05-14
module: contracts
tags: [gdpr, retention, anonymization, declined-contract, employment-contract, art-17]
---

# Journey: Declined contract — GDPR Art. 17 clock (NOT §13)

**Feature:** SMA-308 — GDPR §13 retention fix (T3)
**ADR:** ADR-0312
**Surfaces:** pg_cron automation / platform admin verification

---

## Journey 3 — Declined contract GDPR erasure path

### Context

Declined contracts produced no salary, no A-melding, no bilag. **Bokføringsloven §13 does NOT apply.** The retention clock is GDPR Art. 17 (erasure obligation), not §13's 5-year regnskapsårets slutt anchor.

Clock: `declined_at + 3 years`. This is the same 3-year window as the superseded implementation, but now anchored to `declined_at` (correct) rather than `created_at` (was wrong).

**Provisional:** The `declined_at + 3yr` GDPR clock is provisional pending advokat confirmation of Personalmeldingsforskriften §6 applicability. See ADR-0312 § Consequences.

### Precondition

- `employment_contract` row exists:
  - `status = 'declined'`
  - `declined_at = '2023-03-01'` (set by backfill or trigger)
  - `decline_reason_text IS NOT NULL` (contains original decline reason, not yet `'[anonymized]'`)
  - `framework_snapshot IS NOT NULL`
- Today is 2026-05-14 (GDPR cutoff = 2026-03-01, already passed)
- `anonymize_contract` RPC is deployed

### Happy path — automated cron run

1. pg_cron fires `'0 2 1 * *'` on 2026-06-01 02:00 UTC
   → Executes `SELECT anonymize_contract(NULL, false);`
2. RPC iterates over declined contracts (Branch B):
   - Finds row: `declined_at = '2023-03-01'`
   - Checks: `declined_at < now() - INTERVAL '3 years'` → `2023-03-01 < 2023-06-01` → TRUE (cutoff passed)
   - `decline_reason_text IS DISTINCT FROM '[anonymized]'` → not yet anonymized
3. `dry_run = false` → executes UPDATE:
   - `framework_snapshot = NULL`
   - `compliance_overrides = '[]'::jsonb`
   - `decline_reason_text = '[anonymized]'`
   - `updated_at = now()`
4. RPC inserts `activity_trail` row:
   - `event_type = 'contract.retention_anonymized_§13'` (shared event name)
   - `data.paragraph_ref = 'GDPR Art. 17'` (distinguishes from §13 branch)
   - `data.status_at_anonymization = 'declined'`
   - `data.cutoff_applied = '2026-03-01 00:00:00 UTC'`
5. Admin can verify:
   ```sql
   SELECT data->>'paragraph_ref', count(*)
   FROM activity_trail
   WHERE event_type = 'contract.retention_anonymized_§13'
   GROUP BY 1;
   ```
   → See distribution of §13 vs GDPR Art. 17 anonymizations

**Postcondition:**
- Contract: `decline_reason_text = '[anonymized]'`, `framework_snapshot = NULL`
- `activity_trail` audit: `paragraph_ref = 'GDPR Art. 17'`
- PII removed within GDPR obligation window
- §13 bilag retention NOT affected (no bilag existed for this contract)

### Happy path — GDPR trigger: trigger sets `declined_at` on new decline

1. Admin or system changes contract status to `'declined'`
2. `trg_contract_status_timestamps` BEFORE UPDATE trigger fires
3. `NEW.declined_at := now()` set on the row before write
4. Existing AFTER UPDATE audit trigger (`20260430182443`) logs the status change to `activity_trail`
5. At next monthly cron: if `now() > declined_at + 3yr` → row becomes eligible for anonymization

**Postcondition:** `declined_at` is set precisely at the moment of status transition, not at `updated_at` (which could drift on subsequent edits).

### Error path — `declined_at IS NULL` (pre-trigger historical row with no activity_trail)

1. Contract `status = 'declined'`, `declined_at IS NULL` after backfill
   - This means: no `activity_trail` record for the `status_changed` event AND `updated_at` was NULL (should not happen)
2. Backfill fallback in M1 sets `declined_at = updated_at` for these rows
3. If `updated_at` reflects a post-status edit, `declined_at` anchor is slightly wrong (too recent)
4. Result: GDPR 3yr clock runs slightly longer than strictly necessary — conservative, not harmful
5. Documented in ADR-0312 as "provisional class" — not a compliance gap under GDPR erasure (later erasure is safe, earlier erasure would be the concern)

### Error path — `declined_at` still NULL after backfill (truly orphaned row)

1. Row has `status = 'declined'`, `declined_at IS NULL` even after backfill + trigger deployment
2. `anonymize_contract` Branch B: WHERE clause `ec.declined_at IS NOT NULL` — row excluded
3. Row is NOT anonymized by cron — operator must investigate
4. Investigation: check if `updated_at` can be used manually, or if contract predates tracking
5. Manual service_role UPDATE to set `declined_at` from available signals, then re-run

### Error path — `decline_reason_text` already `'[anonymized]'` (idempotency)

1. Row has already been anonymized (e.g., manual operator run pre-cron)
2. `anonymize_contract` WHERE: `decline_reason_text IS DISTINCT FROM '[anonymized]'` → excluded
3. Row is skipped silently — no double-processing, no duplicate `activity_trail` event

**Postcondition:** Idempotent — multiple cron runs on same row produce single anonymization event.

### Legal note (provisional)

The 3-year GDPR Art. 17 clock for declined contracts is provisional until legal counsel (advokat) confirms:
- No competing retention obligation under Personalmeldingsforskriften §6 (unverified reference in SMA-308 issue body; flagged by lovsen council Phase 5)
- GDPR Art. 17 erasure obligation applies to declined job applicant PII in Norwegian employment context

If §6 imposes a retention obligation on declined-applicant records (e.g. 5 years), the `declined` branch clock must be extended. ADR-0312 will be updated when legal confirmation is received.
