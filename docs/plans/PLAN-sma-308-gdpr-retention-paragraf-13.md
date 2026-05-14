---
title: Plan — SMA-308 GDPR §13 Retention Fix (T3)
status: draft
created: 2026-05-14
updated: 2026-05-14
module: contracts
scope: sortie
tags: [sma-308, gdpr, bokforingsloven-13, retention, anonymize, regnskapsar]
---

# Plan: SMA-308 GDPR §13 Retention Fix (T3)

**Sortie branch:** `feat/sma-308-gdpr-retention-paragraf-13` (new sortie, wt-5)
**ADR slot:** 0312 (GDPR §13 retention clock — regnskapsårets slutt anchor)

---

## Context: What Is Broken

`supabase/migrations/20260501120000_anonymize_contract_rpc.sql:17`:
```sql
AND created_at < now() - interval '3 years';
```

Three simultaneous errors:
- Wrong column: `created_at` not end-of-life timestamp
- Wrong interval: 3 years not 5
- Wrong anchor: rolling-from-event not regnskapsårets slutt (Dec-31)

Targets `employment_contract` (verified `database.types.ts:7873-7927`). Has `end_date` (date, nullable) + `status` enum incl `declined/expired/terminated`. NO `terminated_at` timestamptz. `declined_at` exists on `contract` (DocuSeal table line 5298) but NOT on `employment_contract`.

**No cron** schedules the RPC. Only invocation surface is `database.types.ts` registration + `revoke_anon` hardening (`20260524000000:34`). Function dormant — manual service_role only. Blast radius limited, but volume of wrongly-anonymized rows uncertain.

---

## 1. Clock Definition (Council Q1)

**Regnskapsårets slutt for Norwegian AS:** Calendar year per Regnskapsloven §5-1. `regnskapsårets slutt` = Dec-31. KS (kommandittselskap) + cooperatives may deviate but Smartout's hospitality SMB target = ~99% AS. [MEDIUM confidence: workspace-configurable possible but adds schema for 1% edge case. **Recommend hard-code Dec-31 for v1**; add `workspace.fiscal_year_end_month` in follow-up ADR if needed.]

**Anchor function (updated — Revision 6, lovsen Q1a):**
```sql
CREATE OR REPLACE FUNCTION compute_anonymize_cutoff(
  p_end_event_date DATE,
  p_buffer_months INT DEFAULT 0
) RETURNS TIMESTAMPTZ
LANGUAGE sql IMMUTABLE STRICT
AS $$
  -- cutoff = (Dec-31 of year(end_event)) + 5 years + buffer = anonymize eligible from Jan-1 year+6
  SELECT (
    DATE_TRUNC('year', p_end_event_date)
    + INTERVAL '6 years'
    + (p_buffer_months || ' months')::INTERVAL
    - INTERVAL '1 second'
  )::TIMESTAMPTZ;
$$;
```

Example: contract terminated 2021-06-15 → regnskapsår 2021 → slutt 2021-12-31 → retention until 2026-12-31 → anonymize from 2027-01-01. **v1 uses `buffer_months := 0`** (strict 5yr Dec-31 per Bokf.lov §13, Pontus approved in Phase 6). The 3-mnd buffer (A-melding Jan + skatteoppgjør 31. mars + lønnsrevisjoner) is risk management, NOT law. `p_buffer_months` enables future workspace-configurable buffer without schema change. Workspace-configurable buffer = separate future ADR.

SMA-308 issue body cited `interval '5 years 3 months'` (lovsen rationale). Lovsen verdict (Q1a): strict 5yr anchor is law; 3-mnd buffer is risk management. v1: `p_buffer_months DEFAULT 0`.

**Schema check — missing columns:**

`employment_contract` lacks `terminated_at` and `declined_at`. End-of-life signal:
- `status = 'terminated'` + `end_date` (contractual)
- `status = 'expired'` + `end_date`
- `status = 'declined'` + `decline_reason_text` (never activated)

`end_date` correct §13 anchor for terminated/expired. For declined → see §2.

---

## 2. Declined Contracts — Council Q2

ADR-0244:131-139 anchors §13 retention to "5 years from end of fiscal year covering amendment's salary impact period". A declined contract produced no salary, no A-melding, no bilag. [HIGH confidence: Bokføringsloven §13 applies to bilag. Declined contracts are not bilag.]

GDPR Art. 17 erasure imposes competing obligation: no legal basis to keep declined applicant PII = remove. Current 3-year window may actually be too long for GDPR.

**Personalmeldingsforskriften §6:** Retains A-meldinger + personnel records 5 years. Declined contracts not A-melding-reportable. [LAV KONFIDANS — **uverifisert, krever advokat-bekreftelse**. Lovsen flagged this reference as unverifiable text in Phase 5 council. Mark as provisional in ADR-0312 + HANDOFF. Decision on `declined` GDPR clock is provisional until legal confirmation.]

**Recommendation for declined:** Separate GDPR-driven clock, NOT §13. Anonymize `declined` after `declined_at + 3 years`. Keep 3-yr window but fix the column (currently `created_at` is wrong for declined too — should be `declined_at`).

**UNCERTAINTY FLAG:** Requires Council Q2 ratification.

---

## 3. Schema — ADD COLUMN `declined_at` + `terminated_at` + RPC Safety Gate

Per L-0202: ADD COLUMN on existing table (no lifecycle independence).

**Columns to add:**
- `declined_at TIMESTAMPTZ NULL` — set by status-change trigger on transition to `declined`
- `terminated_at TIMESTAMPTZ NULL` — set on transition to `terminated`

Existing audit trigger `20260430182443_employment_contract_activity_trail_trigger.sql` fires AFTER UPDATE and only writes to `activity_trail`. AFTER triggers **cannot** SET columns on the triggering row — modifying NEW is a no-op at that timing. A **new** BEFORE UPDATE trigger is required.

New trigger spec:
- **Migration:** `20260615100100_contract_status_timestamp_trigger.sql` (separate from RPC migration)
- **Trigger name:** `trg_contract_status_timestamps`
- **Timing:** `BEFORE UPDATE ON public.employment_contract FOR EACH ROW`
- **Body:** `WHEN (NEW.status IS DISTINCT FROM OLD.status)`:
  - Transition to `declined` → `SET declined_at = now()`
  - Transition to `terminated` → `SET terminated_at = now()`
- Do NOT modify the existing AFTER UPDATE audit trigger (`20260430182443`).

**[UNCERTAINTY:** For `expired` contracts on fixed-term agreements, `end_date` is effectively the termination event. For `terminated` status, `terminated_at` captures actual admin action. Self-tag: verify which is more defensible §13 anchor — `end_date` (contractual) or `terminated_at` (admin act). Council Q3.]

**Decision:** Add both. Use `COALESCE(end_date, terminated_at::date, created_at::date)` for terminated/expired; `declined_at::date` for declined.

**COALESCE order rationale (Revision 3, lovsen finding):** Bokf.lov §13 anchors to the *bilag* (last lønnsbilag), not to the administrative termination act. Constructive dismissal example: `end_date = 2024-06-30`, `terminated_at = 2024-12-15` — the last lønnsbilag falls in regnskapsår 2024. Using `terminated_at` as primary key would extend retention by ~6 months incorrectly. `end_date` is the correct §13 anchor; `terminated_at` is the fallback when no contractual end date exists.

For declined contracts, a separate branch uses `declined_at::date` (GDPR-driven clock, Pontus approved) — independent from §13.

**`anonymize_contract` RPC signature (dry_run safety gate — Revision 4, code-arch finding):**

Anonymization is a one-way destructive operation. Updated signature:
```sql
anonymize_contract(workspace_id UUID DEFAULT NULL, dry_run BOOLEAN DEFAULT TRUE)
```
- `dry_run = TRUE` (default — safe for manual operator calls): returns count + sample of would-be-affected rows. Does NOT execute UPDATE.
- `dry_run = FALSE`: executes anonymization. Must be passed explicitly — no accidental mass-anonymization.
- Cron call passes `dry_run := FALSE` explicitly: `SELECT anonymize_contract(NULL, false);`

---

## 4. Retention Policy Table

`channel_retention_policy` exists (`20260422300000:407`) but channel-specific. No generic `retention_policy` table.

**Recommendation: inline in RPC.** §13 is single-rule with no per-workspace config (v1). Separate table = over-engineering. Document via `COMMENT ON FUNCTION` with §13 citation.

---

## 5. Call Site Review

- No cron schedules `anonymize_contract`
- No Edge Function calls it
- Only `database.types.ts:20785` (type registration) + `revoke_anon` hardening
- Dormant unless service_role manual invocation

**Action:** Create pg_cron job in this migration. Schedule: `'0 2 1 * *'` (1st of month, 02:00 UTC). "First Sunday of month" is NOT a valid pg_cron primitive — pg_cron uses 5-field UTC cron only. Monthly on the 1st aligns with Bokf.lov §13 calendar-year semantics (Pontus approved in Phase 6). Without cron, the fix never runs. Payroll cron pattern (`shift_pay_calculation_event`) confirms precedent.

Wrap cron registration in extension guard pattern per `supabase/migrations/20260515120500_recorder_retention_cron.sql:9-20`:
```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('contract-retention-anonymize', '0 2 1 * *', $cmd$SELECT anonymize_contract(NULL, false);$cmd$);
  END IF;
END $$;
```

---

## 6. Backfill / Historical Breach

RPC created 2026-05-01, no cron, only manual service_role invocations. Contract module foundation (`20260519100100`) added 2026-05-19 → no contracts old enough for 3-year clock match yet (codebase < 1 year).

**However:** Bubble migration (`campaign/bubble-migration`, ADR-0266-0268) imported legacy contracts. If any have historic `created_at` pre-2023, wrong clock may have already matched. [MEDIUM — Council Q3 query.]

**Recovery:** Cannot un-anonymize. Document residual breach in HANDOFF. If Council Q3 confirms zero rows: clean. Else log to `activity_trail` with `actor_kind='platform'`, file residual breach report.

---

## 7. Telemetry Deltas

Two new events in `packages/telemetry/src/registry.ts`:

| Event | Trigger | Payload |
|---|---|---|
| `contract.retention_anonymized_§13` | Successful anonymization | `contract_id`, `workspace_id`, `terminated_at`, `cutoff_applied`, `status_at_anonymization` |
| `contract.retention_skipped_no_clock` | Status matches but no end-event date | `contract_id`, `workspace_id`, `status`, `reason: "no_end_event_date"` |

Emit via inline `INSERT INTO activity_trail` in RPC body (SECURITY DEFINER pattern, mirror `20260430182443` audit trigger). Do NOT route through `@smartout/telemetry` from SQL.

---

## 8. Journey Specs (3)

**Journey 1 — Admin anonymizes expired contract after §13 clock:**
- Pre: `status='expired'`, `end_date='2020-06-15'`, today=2027-01-15, cutoff=2025-12-31 (passed)
- Cron → `anonymize_contract(id)` → WHERE matches → PII fields cleared → `contract.retention_anonymized_§13` emitted
- Post: audit trail shows event with cutoff timestamp
- Error: `end_date IS NULL` → COALESCE fallback to `created_at::date` → `contract.retention_skipped_no_clock` event

**Journey 2 — Audit discovers late retention flagged as residual:**
- Pre: Council Q3 query finds 1 contract anonymized 2026-05-10 with `created_at=2023-01-01` (eligible under wrong 3yr, not yet under correct 5yr)
- HANDOFF documents residual breach with `contract_id`
- No code path — operational only

**Journey 3 — Declined contract anonymization:**
- Pre: `status='declined'`, `declined_at='2023-03-01'`, GDPR clock cutoff 2026-03-01 (passed)
- Cron → matches `declined` sub-clause → `decline_reason_text='[anonymized]'` SET → audit INSERT
- Post: PII cleared within GDPR window. §13 does NOT apply (no bookkeeping obligation). SQL comment explains.

---

## 9. ADR-0312 Skeleton

File: `docs/decisions/0312-gdpr-§13-retention-clock-regnskapsårets-slutt.md`

Key sections:
- Context: 3-error bug in `20260501120000` (wrong column + interval + anchor)
- Decision: `compute_anonymize_cutoff(end_event_date DATE, buffer_months INT DEFAULT 0)` returns Dec-31 year+5 as cutoff; v1 `buffer_months=0`; `p_buffer_months` param enables future workspace-configurable buffer without schema change
- Rationale: Bokføringsloven §13 + Finansdepartementets veiledning; Dec-31 = regnskapsårets slutt for AS per Regnskapsloven §5-1
- Declined: separate GDPR Art. 17 clock (3yr from `declined_at`), NOT §13
- Workspace-configurable fiscal year: deferred to future ADR
- Backcompat: wrongly-anonymized rows cannot be restored — residual breach in HANDOFF
- Refs: ADR-0244:131-139 (lovsen §13 clarification), ADR-0241, Bokføringsloven §13, GDPR Art. 17

---

## 10. Conflict Surface

| Artifact | Slot | Risk |
|---|---|---|
| Migration `20260615100000_gdpr_§13_retention_fix.sql` | **Re-timestamped from `20260602120000`** — dev HEAD max is `20260611100000`; must be strictly greater. `20260615100000` chosen (confirmed free). | RPC + cutoff function + columns |
| Migration `20260615100100_contract_status_timestamp_trigger.sql` | **Re-timestamped from `20260602120100`** — `20260615100100` chosen (confirms AFTER `20260615100000`). | BEFORE UPDATE trigger `trg_contract_status_timestamps` |
| `decision-log.md` | Append ADR-0312 row | Standard merge conflict |
| `database.types.ts` | Add `declined_at`, `terminated_at` to `employment_contract` Row/Insert/Update | Regen, never hand-edit |

**Migration timestamp verification (L-0042 4th occurrence — fact-check):**
Dev HEAD max as of plan revision: `20260611100000_call_log_unique_session.sql`. Both T3 migration slots (`20260615100000`, `20260615100100`) are strictly greater. Timestamps confirmed free.

**ADR-0312 slot:** Verify with `grep -r "0308\|0309\|0310\|0311" docs/decisions/0000-decision-log.md` pre-commit. Confirmed free at plan time.

---

## 11. Build Sequence

- [ ] **T1 — Migration `20260615100000_gdpr_§13_retention_fix.sql`**
  - [ ] T1.1 ADD COLUMN `declined_at TIMESTAMPTZ NULL`
  - [ ] T1.2 ADD COLUMN `terminated_at TIMESTAMPTZ NULL`
  - [ ] T1.3 CREATE FUNCTION `compute_anonymize_cutoff(p_end_event_date DATE, p_buffer_months INT DEFAULT 0) RETURNS TIMESTAMPTZ IMMUTABLE STRICT` — v1 call sites pass `p_buffer_months := 0`
  - [ ] T1.4 Backfill `declined_at` from `activity_trail` (Revision 5 — `updated_at` is wrong, bumps on any post-status edit):
    ```sql
    UPDATE public.employment_contract ec
    SET declined_at = (
      SELECT MIN(at.created_at)
      FROM public.activity_trail at
      WHERE at.entity_type = 'employment_contract'
        AND at.entity_id::uuid = ec.contract_id
        AND at.event_type = 'status_changed'
        AND at.data->>'new_value' = 'declined'
    )
    WHERE ec.status = 'declined' AND ec.declined_at IS NULL;
    -- Rows with no activity_trail match (pre-trail historical): fell back to updated_at.
    -- Document as residual breach in HANDOFF if any rows match fallback.
    UPDATE public.employment_contract
    SET declined_at = updated_at
    WHERE status = 'declined' AND declined_at IS NULL;
    ```
  - [ ] T1.5 Backfill `terminated_at` from `activity_trail` — same pattern, `new_value IN ('terminated','expired')`:
    ```sql
    UPDATE public.employment_contract ec
    SET terminated_at = (
      SELECT MIN(at.created_at)
      FROM public.activity_trail at
      WHERE at.entity_type = 'employment_contract'
        AND at.entity_id::uuid = ec.contract_id
        AND at.event_type = 'status_changed'
        AND at.data->>'new_value' IN ('terminated', 'expired')
    )
    WHERE ec.status IN ('terminated', 'expired') AND ec.terminated_at IS NULL;
    -- Fallback for pre-trail historical rows:
    UPDATE public.employment_contract
    SET terminated_at = updated_at
    WHERE status IN ('terminated', 'expired') AND terminated_at IS NULL;
    ```
  - [ ] T1.6 CREATE OR REPLACE FUNCTION `anonymize_contract(workspace_id UUID DEFAULT NULL, dry_run BOOLEAN DEFAULT TRUE)` — new WHERE clause using `COALESCE(end_date, terminated_at::date, created_at::date)` for terminated/expired; `declined_at::date` for declined; two-branch logic; returns count + sample when `dry_run = TRUE`
  - [ ] T1.7 Inline `activity_trail` INSERT for events
  - [ ] T1.8 pg_cron job `contract-retention-anonymize` — `'0 2 1 * *'` (1st of month 02:00 UTC) — wrapped in pg_cron extension guard; cron call passes `dry_run := FALSE` explicitly: `SELECT anonymize_contract(NULL, false);`
  - [ ] T1.9 `COMMENT ON FUNCTION` with §13 citation, declined GDPR rationale, cutoff logic

- [ ] **T2 — New BEFORE UPDATE trigger** `20260615100100_contract_status_timestamp_trigger.sql`
  - Trigger name: `trg_contract_status_timestamps`
  - Timing: `BEFORE UPDATE ON public.employment_contract FOR EACH ROW WHEN (NEW.status IS DISTINCT FROM OLD.status)`
  - SET `declined_at = now()` on transition to `declined`
  - SET `terminated_at = now()` on transition to `terminated`
  - Do NOT touch existing AFTER UPDATE audit trigger (`20260430182443`)

- [ ] **T3 — Telemetry registry** add 2 events to `packages/telemetry/src/registry.ts`

- [ ] **T4 — ADR-0312** write `docs/decisions/0312-gdpr-§13-retention-clock-regnskapsårets-slutt.md`

- [ ] **T5 — Register in `0000-decision-log.md`**

- [ ] **T6 — Council Q3 query:** `SELECT COUNT(*), MIN(created_at) FROM employment_contract WHERE framework_snapshot IS NULL AND compliance_overrides = '[]' AND decline_reason_text = '[anonymized]'`

- [ ] **T7 — Regen types** (NO `op run` wrap) + `pnpm turbo typecheck`

- [ ] **T8 — Journey stubs** `docs/journeys/JOURNEY-sma-308-gdpr-retention-paragraf-13.md`

- [ ] **T9 — HANDOFF** residual breach summary + next steps

---

## 12. Council Questions (3)

**Q1 — Lovsen: Personalmeldingsforskriften §6 minimum retention on declined contracts?** If yes, GDPR erasure clock constrained. Changes `declined` branch of WHERE. Confidence MEDIUM without answer.

**Q1a — Lovsen: 3-mnd buffer for skatteoppgjør cycle, or strict §13 5yr clock?** SMA-308 body cites `interval '5 years 3 months'` rationale (A-melding Jan + skatteoppgjør 31. mars + lønnsrevisjoner). Plan-agent recommends strict 5yr Dec-31 anchor; issue author recommended +3mnd buffer.

**Q2 — Lovsen: `terminated` clock anchor — `end_date` (contractual) or `terminated_at` (admin act)?** Self-tag: HIGH confidence either is defensible; need lovsen verdict on NHO Reiseliv standard.

**Q3 — Data: how many `employment_contract` rows currently have `framework_snapshot IS NULL AND decline_reason_text = '[anonymized]'`?** Breach surface estimate. Run locally pre-merge.
