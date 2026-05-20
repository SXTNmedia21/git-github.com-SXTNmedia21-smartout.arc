---
title: Audit Delta — 2026-05-20 run 02 vs baseline 2026-05-20 run 01
status: complete
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, delta, post-pr-432]
---

# Delta — run 02 (post-PR-#432) vs run 01 (pre-PR-#432)

Same-day baseline. PR #432 merged at `b1c43f5903` between runs.

## Summary

| Bucket | Count | Notes |
|---|---|---|
| **New CRITICAL** | 0 | All baseline + 2026-05-13 CRITs remain closed |
| **New HIGH (genuine new code)** | 0 | No HIGH from new commits |
| **New HIGH (baseline-upgrades on deeper inspection)** | 2 | CT-01 + CT-02 (slice 01 upgrade MED→HIGH); WH-01 (slice 13 upgrade MED→HIGH) |
| **Regressed** | 1 | F-04-03 AGGRAVATED — `useDayTimelineScope` Next-hook spread to 3 more day widgets via commit `ea8292772`, ADR-0156 portability discipline regressing |
| **Closed (HIGH)** | 6 | MOB-01, EF-01, SE-01, OW-01, OW-02, OW-03 |
| **Closed (MEDIUM-or-lower)** | ~29 | Most via F-01 corpus drop 376→90 + F-04 OKLCH 9-file cluster + various 2026-05-13 carry-overs |
| **Unchanged open** | 5 | F-09-01 (ADR-0322 gap), F-06-03/04 (intentional stubs), F-07-03/04 (RLS + updated_at), F-09-05 (ADR-0135/0378 status drift) |

## Closed HIGHs (per PR #432 commit map)

| ID | Baseline location | Closure commit | Verified by slice |
|---|---|---|---|
| MOB-01 | `apps/mobile/src/lib/botsson-tools.ts:121-138` | `0d14334d4` — leader_phone removed; factory `buildCallLeader(phoneResolver)`; PII test 5/5 | 05 |
| EF-01 | `supabase/config.toml` missing `[functions.tariff-amendment-sweep]` | `8640358fb` — block added lines 649-656 with `verify_jwt = false` + CRON_SECRET body auth | 03 |
| SE-01 | `services/stage-engine/src/workers/mission-pool-slot.ts` 4 emit sites | `127dc9057` + ADR-0248 Amendment 2026-05-20 — 5 amendment constraints satisfied; header comment cites amendment | 02 |
| OW-01 | `ConfirmPositions.tsx` zero `t()` | `72a355733` — 7 strings migrated | 10 |
| OW-02 | `ConfirmDepartments.tsx` 5 hardcoded labels | `72a355733` — migrated | 10 |
| OW-03 | `ConfirmProcedures.tsx` 9 hardcoded strings | `72a355733` — migrated | 10 |

## F-01 corpus delta (independent of PR #432)

PR #431 (`campaign/ui-shell-followup` H3/H4 i18n sortier) landed independently and drove the i18n corpus from 376 → 90 (-286). Largest single-audit closure of any tracked finding to date. Validates: ESLint-rule-as-gate works where convention-as-gate fails. Remaining 90 are the stubborn tail; 30 have ≥6 rendered Norwegian strings.

## New findings in run 02

### HIGH (upgrades on deeper inspection — not genuine-new)
- **WH-01** (slice 13) — `docuseal/route.ts:320` engine_event insert with 4 wrong columns + `as never` + silent `.catch()`. Every contract signing silently fails to fire `contract.signed`. Was baseline MEDIUM noted as "fire-and-forget acceptable"; deeper inspection finds it's not fire-and-forget but silent failure
- **CT-01** (slice 01) — `shift-lifecycle/tools.ts` publishShift/approveShift gate-then-update Pathway A only; no `gatedMutation()` orchestrator
- **CT-02** (slice 01) — `payroll/tools.ts` same pattern with docstring claiming "established convention" (L-0176 trap)

### MEDIUM new
- **SE-02** — `services/stage-engine/src/routes/agent/dispatch.ts` HTTP `/agent/dispatch` zero `emit()` (264 lines)
- **SE-03** — 29 `engine_sessions` reads pre-Phase A0 (expected; ADR-0246/0247/0248 still `proposed`)
- **F-04-01/02** — `NoteEditDialog.tsx:89` + `pin-day-control-context.ts:35` direct writes no emit
- **F-06-05** — `cite_law` returns bare `"LAV"` not `Confidence` object (ADR-0257)
- **F-08-01** — `status: verified` schema drift in 304/501 JOURNEY files
- **F-09-01** persists (was HIGH, still HIGH)
- **F-09-02/03** — enforcement-less ADRs 0366 + 0377
- **F-09-05** — code-first ADR drift (0135 + 0378 status `proposed` despite production deploy)
- **F-11-01** — `no-oklch-literal` ESLint rule missing (dup of F-09-02; different slice angle)
- **F-11-02** — 6 OKLCH literals in `apps/landing` (4 globals.css + 2 free-forever/page.tsx)
- **OW-04/05** — `ConfirmLocations.tsx` 14 strings + `ConfirmSummary.tsx` 9 strings (new MEDIUMs)
- **MOB-02** — `ContentCreator.tsx:154-162` emit without `nonEmpty()` re-wrap (defence-in-depth gap)
- **EF-02** — 3 browser-callable EFs use inline wildcard CORS not shared module (ADR-0171 backlog)
- **WH-02** — `livekit-webhook` race silent close of retry window
- **M-14-02** — `announcement-atomic-rpc.spec.ts:17` literal service-role key as `??` fallback

### LOW new
- F-04-03 AGGRAVATED
- F-07-05/06 — orphan telemetry events (`celebration.skipped_*` + `shift_session.bound`)
- F-08-02/03 — 15 missing module + 11 missing tags + 10 ad-hoc statuses
- OW-06/07/08 — `transition-all` + `bg-white/50` Nordic Split residue
- FIND-11-03 — perf-budgets CI never activated
- L-14-01 — S12 protocol naming collision

## Closed in run 02 vs baseline (full list ~29 items)

- F-01: 376 → 90 (.tsx files with æøå and zero `t()`) — PR #431
- 6 HIGHs above
- 2026-05-13 carry-overs: F-DB-09, F-OB-10-01, F-CL-11, F-EF-03 remain closed
- F-04 OKLCH 9-file day-component cluster closed (commit `7728c81d9`)
- F-04 duty_leader emit closed
- F-07 search_path on 2 SECURITY DEFINER fns closed
- F-06-02 cite_law docstring fixed
- F-10 baseline ConfirmBusiness/TariffSection/ConfirmRoles closed

## Unchanged open (5)

| ID | What | Why still open |
|---|---|---|
| F-09-01 | ADR-0322 slot undocumented | Trivial <15min fix not yet executed |
| F-06-03 | `cite_law` Phase 0c stub | Intentional pending Lovdata MCP wiring |
| F-06-04 | `classify_amendment` tool stub | Intentional; underlying pure function complete |
| F-07-04 | `shift_session` no JWT INSERT/UPDATE | Intentional + documented |
| F-09-05 | ADR-0135 + ADR-0378 status `proposed` | Code-first drift; ADRs registered after production deploy |

## Verdict

YELLOW — SAFE TO PROMOTE. Zero CRITICAL. Zero genuine-new HIGH from new code. 6 baseline HIGHs cleanly closed; the 4 active HIGHs are 2 upgrades-on-deeper-inspection + 1 trivial registry hygiene + 0 newly-introduced. F-01 corpus −286 is the standout closure. F-04-03 regression watch: ADR-0156 portability needs ESLint enforcement or it accumulates.
