---
title: HANDOFF — SMA-308 GDPR §13 Retention Fix
status: closing
created: 2026-05-14
updated: 2026-05-14
module: contracts
scope: sortie
linear: SMA-308
council: 2026-05-14 V0 verification council (7 reviewers, REJECT → revised → APPROVE WITH CHANGES)
tags: [sma-308, gdpr, bokforingsloven-13, retention, anonymize, regnskapsar, lovsen]
---

# HANDOFF: SMA-308 GDPR §13 Retention Fix

## Summary

Closes 3-error compliance bug in `anonymize_contract_rpc` (`20260501120000:17`):
- Wrong column: `created_at` → end-of-life event date (`end_date` / `terminated_at` / `declined_at`)
- Wrong interval: 3 years → 5 years (Bokf.lov §13)
- Wrong anchor: rolling-from-event → regnskapsårets slutt (Dec-31 + 5 years)

Per ADR-0244:131-139 (lovsen amendment) + Regnskapsloven §5-1 (AS = calendar year). Council Phase 5 verdict: APPROVE WITH CHANGES — 6 specific revisions applied (pg_cron syntax, BEFORE UPDATE trigger, COALESCE order, dry_run safety gate, activity_trail backfill anchor, buffer_months future-flex).

Declined contracts use SEPARATE GDPR Art. 17 clock (3yr from `declined_at`) — NOT §13 (no bilag = no bokf.lov obligation). Personalmeldingsforskriften §6 reference flagged LAV-konfidans (lovsen Q1 unverified text) — krever advokat-bekreftelse.

## What changed

| File | Type | Purpose |
|---|---|---|
| `supabase/migrations/20260615100000_gdpr_§13_retention_fix.sql` | NEW | ADD COLUMN `declined_at` + `terminated_at` timestamptz. CREATE `compute_anonymize_cutoff(end_event_date, buffer_months DEFAULT 0)` IMMUTABLE STRICT. Backfill from `activity_trail` (event_type='status_changed', new_value IN declined/terminated/expired). CREATE OR REPLACE `anonymize_contract(workspace_id UUID DEFAULT NULL, dry_run BOOLEAN DEFAULT TRUE)` — supersedes 3-error RPC. Inline `activity_trail` INSERT for `contract.retention_anonymized_§13` event. pg_cron `'0 2 1 * *'` (1st of month 02:00 UTC) wrapped in `pg_extension` guard. |
| `supabase/migrations/20260615100100_contract_status_timestamp_trigger.sql` | NEW | `trg_contract_status_timestamps` BEFORE UPDATE on `employment_contract` FOR EACH ROW. Sets `declined_at`/`terminated_at = now()` on status transitions. Coexists with existing AFTER UPDATE audit trigger (`20260430182443`). |
| `packages/telemetry/src/registry.ts` | MODIFIED | 2 events added: `contract.retention_anonymized_§13` (posthog + activity_trail + logger) + `contract.retention_skipped_no_clock` (activity_trail + logger only, blocked-actions skip analytics funnel). |
| `packages/supabase/src/database.types.ts` | MODIFIED | Regenerated — new columns + new function signature. NO `op run` wrap (per L-0083-class memory). |
| `docs/decisions/0312-gdpr-§13-retention-clock-regnskapsårets-slutt.md` | NEW | ADR-0312. Documents 3-error bug + COALESCE rationale + constructive dismissal example + declined provisional status + pg_cron schedule + backcompat risk. |
| `docs/decisions/0000-decision-log.md` | MODIFIED | ADR-0312 row registered (newest-first). |
| `docs/journeys/JOURNEY-sma-308-gdpr-retention-admin-anonymizes-expired-contract.md` | NEW | Journey 1: cron + dry-run automation. status: verified. |
| `docs/journeys/JOURNEY-sma-308-gdpr-retention-audit-discovers-late-retention-residual.md` | NEW | Journey 2: operational-only audit path. status: verified. |
| `docs/journeys/JOURNEY-sma-308-gdpr-retention-declined-contract-gdpr-clock.md` | NEW | Journey 3: declined contracts separate GDPR clock. status: verified. |

## Decisions

- **§13 retention anchor: `COALESCE(end_date, terminated_at::date, created_at::date)`** for terminated/expired contracts. Lovsen verdict: bilag-anchored, not admin-act-anchored. Constructive dismissal example: `end_date = 2024-06-30, terminated_at = 2024-12-15` — last lønnsbilag falls in regnskapsår 2024. Using `terminated_at` as primary would extend retention by ~6 months incorrectly.

- **Declined contracts: SEPARATE GDPR Art. 17 clock**, NOT §13. 3yr from `declined_at`. Declined contracts produce no bilag, no A-melding, no lønn — §13 inapplicable. Personalmeldingsforskriften §6 reference UNVERIFIED — provisional per lovsen Q1; krever advokat-bekreftelse before workspace-onboarding declined-contracts-at-scale.

- **Dry-run safety gate on `anonymize_contract`.** Default `dry_run = TRUE`. Manual operator calls return count + sample, do NOT execute. Cron passes `dry_run := FALSE` explicitly. Prevents accidental mass-anonymization.

- **pg_cron `'0 2 1 * *'`** (1st of month 02:00 UTC). Aligns with Bokf.lov §13 calendar-year semantics. Wrapped in `pg_extension WHERE extname = 'pg_cron'` guard per `20260515120500_recorder_retention_cron.sql` pattern. Pontus approved Phase 6.

- **`buffer_months INT DEFAULT 0` parameter on `compute_anonymize_cutoff`.** v1 = 0 (strict 5yr per Bokf.lov §13). 3-mnd buffer (lovsen risk-management rationale: A-melding Jan + skatteoppgjør 31. mars + lønnsrevisjoner) is operational hedge, NOT law. Future-flex without schema change.

- **Backfill anchor: `activity_trail` lookup**, not `updated_at` proxy. `updated_at` bumps on any post-status-change edit → too-late retention clock. activity_trail WHERE event_type='status_changed' AND new_value IN ('declined'/'terminated'/'expired') gives authentic state-transition timestamp. Code-architect Phase 3 finding.

- **BEFORE UPDATE trigger (separate from AFTER audit trigger).** AFTER triggers cannot SET columns on the triggering row — modifying NEW is no-op at that timing. `trg_contract_status_timestamps` is a new BEFORE UPDATE trigger, NOT extension of `20260430182443`. Supervisor Phase 3 finding.

## Learnings

- **L-0042 occurrence #4 captured:** T1 + T2 + T3 plan-time migration timestamps (`20260514100000` + `20260602120000`) predated dev HEAD max (`20260611100000`) by 27+ days. Council Phase 2.5 fact-check pre-flight caught the Cloud-skip trap. 4th instance of pre-HEAD migration timestamp = promotion candidate for `/start-feature` script fail-fast gate.

- **Lovsen statutory-citation drift across multi-doc surfaces.** Original plan cited "§14-15 1.ledd" + 16-bokstav §14-6 — both wrong post-2024 lov-revisjon. Lovsen's own checklist.md + system prompt + agent-facing docs all carried outdated references. Pattern: statutory updates require parallel update in all three surfaces or audits reintroduce the gap. (Affects T1+T2 plans more than T3, but pattern surfaced here too in declined-contract Personalmeldingsforskriften §6 unverifiable reference.)

- **pg_cron timezone primitive trap.** Original plan said "Monthly, first Sunday 02:00 Oslo time" — NOT pg_cron primitive. pg_cron uses 5-field UTC cron. "First Sunday of month" not supported. DST drift on retention windows = compliance risk. Promotion candidate: smartout-database-guide cron section.

## Known issues / debt

- **`pg_cron` not installed in local Supabase** — extension guard works correctly (skipped registration). Production Cloud has pg_cron. Verify post-deploy: `SELECT * FROM cron.job WHERE jobname = 'contract-retention-anonymize';`.

- **Personalmeldingsforskriften §6 unverified.** Plan + ADR-0312 mark as LAV-konfidans, krever advokat-bekreftelse. Declined GDPR clock (3yr from `declined_at`) is conservative provisional. May need shortening (Datatilsynets tommelfingerregel 6 mnd for avviste søkere) — verify with legal counsel.

- **Workspace-configurable fiscal year deferred** to future ADR. KS + cooperatives with deviating fiscal year (~1% edge case in hospitality SMB target market) — `workspace.fiscal_year_end_month` reserved schema slot. v1 hard-codes Dec-31 per Regnskapsloven §5-1 AS default.

- **Wrongly-anonymized backfill: clean slate.** Council Q3 query returned 0 rows (no `framework_snapshot IS NULL AND decline_reason_text = '[anonymized]'`). RPC was dormant since 2026-05-01 creation (no cron registered until this sortie). No residual breach. If Bubble-migration imported legacy contracts with pre-2023 `created_at` that triggered manual service_role anonymization since 2026-05-01, those would be undetectable. Documented for HANDOFF audit-trail.

## Next steps

- Run `close-feature.sh 11` to merge `feat/sma-308-gdpr-retention-paragraf-13` → `development`.
- Subsequent T2 (SMA-328 trekk-consent) build dispatches after T3 merges.
- T1 (contracts compliance cluster) build dispatches last per merge order T4 → T3 → T2 → T1.
- Post-deploy verification: confirm `cron.job` entry exists on Supabase Cloud.

## Verification

- Migration apply: PASS (M1 + M2 clean on `npx supabase migration up`)
- Idempotency: PASS (re-apply clean)
- `compute_anonymize_cutoff('2021-06-15', 0)` → `2026-12-31 23:59:59+00` (correct Dec-31 year+5 anchor)
- `declined_at` + `terminated_at` columns: present (`database.types.ts` regenerated)
- `trg_contract_status_timestamps` trigger: present, BEFORE UPDATE
- pg_cron: skipped (local extension absent, guard worked correctly)
- Telemetry build: PASS — 0 errors
- `pnpm turbo typecheck`: PASS — 52/52 tasks, 0 errors
- Council Q3 breach surface: **0 rows** — clean slate
- 3 journeys: status: verified

Council 2026-05-14 V0 verification verdict honored. ADR-0312 registered. L-0042 occurrence #4 captured in separate learning file.
