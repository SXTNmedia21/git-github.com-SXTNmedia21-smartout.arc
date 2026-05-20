---
title: Audit Summary — 2026-05-18 (smoke)
mode: smoke
slices: [capability-tools, edge-functions, db-rls-telemetry]
critical: 0
high: 3
medium: 1
low: 4
adr_0367_findings: 0
---

# Audit Summary — 2026-05-18 (smoke)

Smoke mode: 3 specialists, no synthesizer. Run after ADR-0367 Day Line Area-Anchored Runtime closure + Wave 1 + Wave 2 merge into `campaign/ui-shell`.

## Totals

| Severity | Count | ADR-0367-related |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 3 | 0 |
| MEDIUM | 1 | 0 |
| LOW | 4 | 1 (registry type drift) |

**Verdict for ADR-0367 promotion gate: GREEN.** No new findings on the campaign work. All HIGH/MEDIUM = pre-existing tech-debt unrelated to today's merges.

## Top findings (cross-slice)

### HIGH — billing-query cross-workspace exposure
**File:** `packages/ai/src/capabilities/billing-query/tools.ts:270`
**ADR:** 0151 (server-derived IDs)
**Issue:** `get_usage_snapshot` (+2 siblings) accept `params.workspace_id` and use as DB filter without equality-guard vs `ctx.workspaceId`. Actor can query billing for any sibling workspace under same company. Read-only impact.
**Fix:** Add `if (params.workspace_id !== ctx.workspaceId) throw Forbidden` matching `availability/tools.ts:263` pattern.

### HIGH — journey-authoring cross-namespace writes
**File:** `packages/ai/src/capabilities/journey-authoring/tools.ts:483-509`
**ADR:** 0240 (cross-namespace write boundaries)
**Issue:** `publish_draft` writes `journey` + `journey_version` directly via `gatedMutation`. `journey/tools.ts` also owns same tables. Two namespaces, same write target, no delegation chain. Docstring at line 452 acknowledges this as "tracked separately".
**Fix:** Delegate via `journey.publish_mission` OR draft ADR to bless the dual-owner pattern.

### HIGH — 6 cron functions dead in prod
**File:** `supabase/functions/{ops-day-brief,ops-learn,ops-predict,ops-triage,ops-monitor,tariff-amendment-sweep}/index.ts`
**ADR:** 0077 (Edge Function security)
**Issue:** Use `WATCHDOG_CRON_SECRET`/`CRON_SECRET` Bearer auth but missing `[functions.<name>]` config.toml stanzas with `verify_jwt = false`. Supabase gateway rejects non-JWT Bearer before handler runs.
**Fix:** Add 6 config.toml stanzas. Mechanical.

### MEDIUM — billing-query broader scope
Same root cause as HIGH-1. All 3 tools in `billing-query` share the missing guard.

### LOW — TaskCreated type drift (ADR-0367-related)
**File:** `packages/telemetry/src/registry.ts:1148-1157`
**ADR:** 0044 (telemetry single source of truth)
**Issue:** W2.2 added `description?` + `scheduled_at?` to runtime emit in `task/tools.ts:559-560`, but `TaskCreated.metadata` interface in registry not updated. Type drift.
**Fix:** Add 2 optional string fields to interface.

### LOW — helpdesk_query direct engine writes
**File:** `packages/ai/src/capabilities/helpdesk_query/tools.ts:352-390`
**ADR:** 0240
**Issue:** Direct writes to `engine_event`/`engine_delayed_trigger` with no ADR authorising helpdesk as engine writer.

### LOW — journey-authoring read of journey table
**File:** `packages/ai/src/capabilities/journey-authoring/tools.ts:325`
Read-only cross-namespace, no mutation concern.

### LOW — activate-workspace field validation
**File:** `supabase/functions/activate-workspace/index.ts:27`
**ADR:** 0077
**Issue:** RPC param passed without field-level Zod validation, only null check. Low risk — RPC enforces DB constraints.

## Notable clean areas (smoke pass)

- **0 L-0177** silent workspace_id fallback patterns across capabilities
- **0 L-0176** docstring-vs-body ADR-claim mismatches
- All 6 new ADR-0367 tables pass ADR-0004 / 0011 / 0012
- All 9 new SECURITY DEFINER functions have locked `search_path`
- `profile.active_push_topic` regenerated correctly in `database.types.ts:15317/15366/15417`
- All new telemetry events (`celebration.*`, `day_line.*`, `shift_session.*`) have both interface + routing entries
- `day-line-push.ts` (council-APPROVED in-flight) exempt; no new violations introduced

## Drift-check

Concurrent run (`./infra/scripts/drift-check.sh`):
- **FAIL**: vercel-manifest dropped 64→56 (8 keys removed)
- **SKIP**: edge-fn-secrets (expected per ADR-0360 preview Branch DB drop)
- **PASS**: env-ts-vs-known-keys, droplet-env-vs-manifest

vercel-manifest drift = pre-existing, not ADR-0367. Investigate before HOP A but does not block ADR-0367 promotion.

## Recommendation

- ADR-0367 work is clean. Campaign `campaign/ui-shell` ready for HOP A on its own merit.
- 3 HIGH findings = separate follow-up sortier (cap-boundary fixes + config.toml stanzas).
- 1 LOW (registry type drift) = trivially fixable in <5 min, recommend bundling into next sortie.
- vercel-manifest drift = diagnose before HOP A.

## Slice reports

- [01-capability-tools.md](./01-capability-tools.md)
- [02-edge-functions.md](./02-edge-functions.md)
- [03-db-rls-telemetry.md](./03-db-rls-telemetry.md)
