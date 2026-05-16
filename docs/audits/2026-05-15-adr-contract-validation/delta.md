---
title: "Delta vs 2026-05-13 — Audit Run 2026-05-15"
status: complete
created: 2026-05-15
updated: 2026-05-15
module: audit
tags: [audit, delta, adr]
---

# Delta vs 2026-05-13 Baseline

> Full reconciliation lives in `00-SYNTHESIS.md` § Delta. This file is the machine-readable trail.

## Bucket counts

| Bucket | Count |
|---|---|
| New CRITICAL | 0 |
| New HIGH | 9 |
| New MEDIUM | 12 |
| New LOW | 15 |
| **Regressed** | 0 |
| **Closed** | 17 |
| Unchanged open | 15 |

## Closed findings (17)

All four 2026-05-13 CRITICALs + 11 HIGHs + 2 supporting:

| ID | Severity (baseline) | Closure mechanism |
|---|---|---|
| F-DB-09 | CRITICAL | Sortie A.2 migration `20260608120000` — WITH CHECK on department_session, session_hook, deviation |
| F-DB-10 | HIGH | Same migration — personal_task WITH CHECK |
| F-DB-11 | HIGH | ADR-0287 enforcement landed (scripts/gate-action-coverage.ts + workflow + _shared/mutate-with-gate.ts) |
| F-DB-12 | HIGH | Sortie A.3 — duplicate index purge |
| F-OB-10-01 | CRITICAL | `feat/audit-fob10-onboarding-cleanup` — 27 legacy onboarding files deleted, ADR-0041 supersession now accurate |
| F-OB-10-04 | MEDIUM | Same cleanup |
| F-CL-11 | CRITICAL | Commit `47bffe635` — legal/index.ts Layer 2 narrowed to ["chat","system"] |
| F-CL-13 | HIGH | `feat/audit-fcl13-feriepenger-basis` — computeFeriepengerBasis called at 3 payroll/tools.ts sites |
| F-EF-03 | CRITICAL (ops-impact) | `feat/audit-fef03-intelligence-ef-auth` — `verifyInternalAuth()` on 5 intelligence EFs |
| F-EF-04 | HIGH | Same — ADR-0123 violations purged with /onboarding cleanup |
| F-WH-04 | HIGH | Migration `20260611100000` + LiveKit handler upsert (commit cbd25c9b2) — UNIQUE on call_log.call_session_id |
| F-CT-01 | HIGH | publishDraftTool now uses gatedMutation with proper execute callback |
| SE-02-01 | HIGH | apps/web/src/app/api/botsson/chat/route.ts — primeContext.profileId now server-verified before LLM injection |
| F-SC-04-13 | HIGH | `feat/audit-fsc04-day-control-server-actions` — OversiktTab duty_leader routed through updateDepartmentSessionDutyLeaderAction (gate + emit) |
| F-SC-04-15 | HIGH | Same sortie — EventDetailPanel lifted to resolveDeviationAction + acknowledgeDeviationAction |
| F-MO-01/03/04 | HIGH (×3) | ESLint rule `smartout/no-empty-string-identifier-fallback` landed; mobile ShiftClockView + swap-requests + SwapRequestSheet all fail-fast |

## New HIGH findings (9)

| ID | File:Line | ADR | One-line |
|---|---|---|---|
| F-CT-02 | `packages/ai/src/capabilities/journey/tools.ts:196,239` | 0204 | publish_mission engine_missions/engine_stages writes OUTSIDE gatedMutation.execute() |
| F-CT-03 | `packages/ai/src/capabilities/journey/tools.ts:461-503` | 0204 | run_dev / run_guided engine_state + engine_state_step inserts OUTSIDE gatedMutation.execute() |
| F-CT-08 | `packages/ai/src/capabilities/journey/tools.ts:684-704,940,991` | 0204 | publish_guide journey_guide.upsert OUTSIDE gatedMutation.execute() |
| F-OB-10-06 / F-EF-02a | `apps/web/src/app/onboarding/wizard-definition.ts:292` | 0179 | Browser-side invokeEdgeFunction call to finalize-workspace + activate-workspace. Flagged by slices 03 + 10. |
| F-SC-04-17 | `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts:854-882` | 0091, 0204, 0287 | Voice tool addSessionTaskTool direct D6 insert no gate no emit |
| F-SC-04-18 | `apps/web/src/app/dashboard/schedule/_hooks/use-hours-overrides.ts:67,103` | 0204 | department_hours_override upsert/delete no gate + workspace_id null-safety gap (L-0177 class) |
| SE02-03 | `apps/web/src/app/api/emma/memory/route.ts:74` | 0099, 0134 | BFF writes engine_memory with no gate, no emit, body workspace_id |
| F-EF-05 | `supabase/functions/identify-company/index.ts` | 0029 | verify_jwt=false + zero auth check — unauthenticated brreg proxy |
| F-WH-05 | `apps/web/src/app/api/webhooks/docuseal/route.ts:96` | 0079 | DocuSeal webhook no idempotency key; UNIQUE missing on contract.docuseal_submission_id |
| F-ME-08 | (table absent) | 0274 | engine_session_step + agent_inquiry tables absent; Welcome Mission V0 cannot recover from worker crash |

## Unchanged open (selection)

| ID | Persisted | Severity |
|---|---|---|
| F-MO-05 (use-recon-wizard direct daily_reconciliation) | 2026-05-13 → 2026-05-15 | HIGH |
| F-MO-06 (submit_own_pii RPC client workspace_id) | 2026-05-13 → 2026-05-15 | HIGH |
| F-SC-04-09 (useAutoFillShifts bulk insert no gate) | 2026-05-13 → 2026-05-15 | HIGH |
| F-JR-NEW-02 (68-journey seed not in migration) | 2026-05-13 → 2026-05-15 | HIGH |
| F-ME-01 + F-ME-07 (zero E2E for 7 mission personas) | 2026-05-13 → 2026-05-15 | HIGH |
| F-01 / F-02 (apps/landing/ Sentry + optimizePackageImports drift) | 2026-05-13 → 2026-05-15 | HIGH |
| F-CL-12 (ADR-0293 Pattern B recalc skipped on capability path) | 2026-05-13 → 2026-05-15 | HIGH→MEDIUM |

## SLA check

- CRITICAL open >7d: **0** — none, no auto-Linear trigger
- HIGH open >30d: **0** — all persisted HIGHs first logged 2026-05-13 (2 days ago)
- MEDIUM open >90d: **0**

**No SLA breaches.** Best two-day delta since audit harness began: 17 closed vs 9 net-new HIGH, zero regressions.
