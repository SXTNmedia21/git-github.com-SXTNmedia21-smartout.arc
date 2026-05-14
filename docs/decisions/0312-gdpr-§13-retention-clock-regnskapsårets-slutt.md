---
title: "ADR-0312: GDPR §13 Retention Clock — Regnskapsårets slutt anchor"
id: ADR-0312
status: accepted
created: 2026-05-14
updated: 2026-05-14
module: contracts
tags: [gdpr, bokforingsloven, retention, anonymization, employment-contract, cron, §13]
---

# ADR-0312: GDPR §13 Retention Clock — Regnskapsårets slutt anchor

## Status

accepted

## Context

`supabase/migrations/20260501120000_anonymize_contract_rpc.sql:17` contained three simultaneous errors:

```sql
AND created_at < now() - interval '3 years';
```

**Error 1 — Wrong column:** `created_at` is the contract creation timestamp, not the end-of-life timestamp. A contract created 2020-01-01 that is still active would be eligible for anonymization — incorrectly.

**Error 2 — Wrong interval:** 3 years is the GDPR window often cited in consent contexts. Bokføringsloven §13 requires 5 years of retention for regnskapsmateriale (bilag).

**Error 3 — Wrong anchor:** Rolling from-event (e.g. `now() - 3 years`) does not satisfy §13's calendar-year semantics. Retention must run to `regnskapsårets slutt` (December 31) of the fiscal year, then 5 additional years. A contract terminated June 15, 2021 must be retained until December 31, 2026 — not until June 15, 2024.

**Additional pre-existing gap:** `employment_contract` had no `declined_at` or `terminated_at` columns. The original RPC had no way to reference an end-of-life timestamp other than `created_at` or `updated_at`.

**Blast radius (limited):** The RPC has never been scheduled via pg_cron. No Edge Function calls it. It is dormant except for manual `service_role` invocations. The Bubble migration (ADR-0266/ADR-0268) imported legacy contracts that may carry pre-2023 `created_at` values — Council Q3 documents whether any rows were incorrectly anonymized by the 3-year `created_at` clock.

## Decision

### Clock function: `compute_anonymize_cutoff`

```sql
CREATE OR REPLACE FUNCTION compute_anonymize_cutoff(
  p_end_event_date DATE,
  p_buffer_months  INT DEFAULT 0
) RETURNS TIMESTAMPTZ LANGUAGE sql IMMUTABLE STRICT
```

Returns `DATE_TRUNC('year', p_end_event_date) + INTERVAL '6 years' + (buffer) - INTERVAL '1 second'`.

Example: contract terminated 2021-06-15 → fiscal year 2021 → slutt 2021-12-31 → retention until 2026-12-31 23:59:59 → anonymize eligible from 2027-01-01.

**v1 uses `buffer_months := 0` (strict 5-year §13 clock per Bokf.lov).** The 3-month buffer (A-melding January + skatteoppgjør 31. mars + lønnsrevisjoner) is risk management, NOT law. `p_buffer_months` parameter enables future workspace-configurable buffer without schema changes. Workspace-configurable buffer = separate future ADR.

### Fiscal year assumption

Calendar year (January–December) for Norwegian AS per Regnskapsloven §5-1. KS (kommandittselskap) and cooperatives may deviate, but Smartout's hospitality SMB target is ~99% AS. Workspace-configurable `fiscal_year_end_month` deferred to future ADR.

### COALESCE order for terminated/expired

```sql
COALESCE(end_date, terminated_at::date, created_at::date)
```

**Rationale (lovsen verdict):** Bokf.lov §13 anchors to the *bilag* (last lønnsbilag), not to the administrative termination act.

**Constructive dismissal example:** `end_date = 2024-06-30`, `terminated_at = 2024-12-15` (admin processed termination 6 months later). The last lønnsbilag falls in regnskapsår 2024. Using `terminated_at` as primary anchor would extend retention by ~6 months incorrectly (`regnskapsår 2024` → same end anyway in this case, but the *reason* matters for auditability). `end_date` is the correct §13 anchor; `terminated_at` is the fallback only when no contractual `end_date` exists.

`created_at` as last resort: covers pre-trail historical rows with no `end_date` and no `terminated_at`. Results in a shorter retention window than §13 may require. Documented as residual risk class in HANDOFF.

### Declined contracts — separate GDPR Art. 17 clock

Declined contracts produced no salary, no A-melding, no bilag. **Bokføringsloven §13 does NOT apply.** Anonymization is governed by GDPR Art. 17 erasure obligation instead.

Clock: `declined_at + 3 years` (GDPR-driven). The 3-year window is the same as the previous (wrong) implementation, but now anchored to `declined_at` rather than `created_at`.

**Provisional status — requires advokat confirmation:** Personalmeldingsforskriften §6 retains A-meldinger + personnel records 5 years. Declined contracts are not A-melding-reportable. The §6 reference appears in the SMA-308 issue body but was flagged by lovsen council (Phase 5) as unverified text. ADR-0312 treats the 3-year GDPR clock as provisional until legal counsel confirms no competing retention obligation applies to declined applicant data.

### Schema — ADD COLUMN (L-0202)

Per learning L-0202 (5th-occurrence): ADD COLUMN over sibling table for 1:1 attributes without lifecycle independence.

Added columns:
- `declined_at TIMESTAMPTZ NULL` — GDPR Art. 17 clock anchor; set by trigger on `→ declined` transition; backfilled from `activity_trail`
- `terminated_at TIMESTAMPTZ NULL` — §13 fallback anchor; set by trigger on `→ terminated` transition; backfilled from `activity_trail`

Note: `expired` contracts do NOT get a `terminated_at` stamp — `end_date` is the §13 anchor for fixed-term expirations.

### BEFORE UPDATE trigger

`trg_contract_status_timestamps` fires `BEFORE UPDATE WHEN (NEW.status IS DISTINCT FROM OLD.status)`, setting `declined_at` / `terminated_at` on status transitions going forward. Coexists with existing AFTER UPDATE audit trigger (`20260430182443`) — BEFORE fires first, AFTER sees the already-stamped row.

### Dry-run safety gate

`anonymize_contract(workspace_id UUID DEFAULT NULL, dry_run BOOLEAN DEFAULT TRUE)`

- `dry_run = TRUE` (default): returns eligible rows, no writes. Safe for manual operator verification.
- `dry_run = FALSE`: executes anonymization. Must be passed explicitly — guards against accidental mass-anonymization.
- Cron calls `SELECT anonymize_contract(NULL, false)` explicitly.

### pg_cron schedule

`'0 2 1 * *'` — 1st of month, 02:00 UTC. Aligns with Bokf.lov §13 calendar-year semantics. Monthly frequency sufficient for §13 compliance (annual eligibility cycle). Cron registration wrapped in extension guard (same pattern as `20260515120500_recorder_retention_cron.sql`).

**Rationale for 1st of month vs. "first Sunday":** "First Sunday of month" is NOT a valid pg_cron primitive. pg_cron uses standard 5-field UTC cron only.

## Consequences

### Positive

- Bokf.lov §13 compliance: correct 5-year regnskapsårets slutt anchor
- Correct event timestamps: `declined_at` / `terminated_at` enable auditable GDPR clocks
- Dry-run gate prevents accidental production data wipe
- `compute_anonymize_cutoff` IMMUTABLE — safe for future index expressions
- pg_cron schedule ensures the fix actually runs (previously dormant)

### Negative / Residual risks

- **Wrongly-anonymized rows cannot be restored.** If any rows were incorrectly anonymized by the superseded 3-year `created_at` clock before this migration, those rows remain anonymized. Residual breach documented in HANDOFF per Council Q3 query result.
- **Backfill via `updated_at` fallback is provisional.** For pre-trail historical rows with no `activity_trail` events, `declined_at` / `terminated_at` are set from `updated_at`, which may reflect post-status edits. These rows' clock anchors are best-effort, not authoritative. Documented as provisional class.
- **Declined 3-year clock is provisional.** Requires advokat confirmation (Personalmeldingsforskriften §6).
- **Fiscal year hardcoded to calendar year.** 1% edge case (KS, cooperatives) deferred to future ADR.

## Backcompat

The superseded function `anonymize_contract(UUID)` (single-arg, dormant) is revoked in M1. The new function `anonymize_contract(UUID DEFAULT NULL, BOOLEAN DEFAULT TRUE)` is a breaking signature change, but no call sites reference the old signature (dormant). `database.types.ts` is regenerated post-migration.

## References

- ADR-0244:131-139 — lovsen §13 amendment (fiscal-year anchor rationale)
- ADR-0241 — contracts foundation
- Bokføringsloven §13 — regnskapsmateriale 5-year retention requirement
- Regnskapsloven §5-1 — regnskapsår = calendar year for Norwegian AS
- GDPR Art. 17 — right to erasure (declined contract GDPR clock)
- L-0202 — ADD COLUMN over sibling table (5th occurrence)
- SMA-308 — source issue with council review chain (T1-T5 agents + Phase 5 APPROVED)
