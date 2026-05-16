---
title: Slice 14 — Missions + E2E Coverage Audit
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, missions-e2e, coverage]
---

# Slice 14: Missions × E2E Coverage Audit

**Scope:** `packages/ai/src/missions/` + `apps/e2e/` (protocols, specs, generators, runners)
**Baseline:** 2026-05-06 slice 14 (6 missions in registry, zero CI Playwright gate, P-001 permanently skipped)
**Delta trigger:** `lise-interview` restored to `MissionIdSchema` enum + registry in commit `47e2e4bd3` (today)

---

## Summary

| Finding ID | Severity | One-line description |
|---|---|---|
| MEDIUM-14-01 | MEDIUM | `lise-interview` restored to enum + registry today but still has zero dedicated E2E spec |
| MEDIUM-14-02 | MEDIUM | `SEASON_LIFECYCLE_MISSION_ID` constant is co-located in missions registry but is a DB-managed ID, not an Ultravox `AgentMission` — the `MISSIONS` object has no `season-lifecycle` entry, creating lookup-failure risk |
| MEDIUM-14-03 | MEDIUM | `discovery-call` exists in DB (`engine_missions` via migration `20260301200100`) with 3 stages but has no registry entry and is not exported — DB-only orphan |
| LOW-14-04 | LOW | `kb_query` and `operations-intelligence` capabilities (2 tools total) remain uncovered in capability harness matrix; no other active uncovered capabilities |
| LOW-14-05 | LOW | P-001 still permanently skipped; missing testids not yet routed to frontend-designer via formal ticket |

**Carried from 2026-05-06 (not re-flagged as new):** HIGH-14-02 (6 missions zero behavioral E2E), HIGH-14-03 (no CI Playwright gate). Status unchanged — still open.

---

## Findings Table

| ID | Severity | File:line | Description |
|---|---|---|---|
| MEDIUM-14-01 | MEDIUM | `packages/ai/src/missions/types.ts:6` + `registry.ts:199` | `lise-interview` restored to enum and registry (commit `47e2e4bd3`, 2026-05-12). No dedicated E2E spec verifies mission is reachable via BFF, produces correct `agent_session_recording`, or matches voice config (`coral` voice, `firstSpeaker: "agent"`). Risk: voice-config regression invisible until production. |
| MEDIUM-14-02 | MEDIUM | `packages/ai/src/missions/registry.ts:5` | `SEASON_LIFECYCLE_MISSION_ID = "season-lifecycle"` is exported from `registry.ts` alongside the `MISSIONS` object, but `MISSIONS` has no `season-lifecycle` entry. Any code calling `getMission("season-lifecycle")` receives `undefined`. `use-active-season.ts`, `session-manager.ts`, `calendar-guardian.ts`, and `stage-manager.ts` all use the constant as a DB `mission_id` string key — not via `getMission()` — so no runtime failure today. The colocation implies structural parity that does not exist. ADR-0272 notes the DB-only design as intentional but proposed, not accepted. |
| MEDIUM-14-03 | MEDIUM | `supabase/migrations/20260301200100_engine_seed.sql:5` | `discovery-call` mission seeded in DB with 3 stages (`discovery-call` mission_id, stages: 3 rows). No `MissionId` enum entry, no `MISSIONS` object entry, no `SEASON_LIFECYCLE_MISSION_ID`-style constant. Not referenced anywhere in `packages/` or `services/`. Effectively a dead DB fixture. Per G12 (botsson-harness-builder agent, 2026-05-10): "DB-only, no registry entries." No E2E test covers it. |
| LOW-14-04 | LOW | `apps/e2e/coverage.md:44,50` | `kb_query` (1 tool) and `operations-intelligence` (1 tool) are the only two capabilities with no harness spec. Coverage is 22/24 capabilities (91%). Both are 0-tool stubs in the capability matrix — impact is low but they are the last two 🔴 rows. |
| LOW-14-05 | LOW | `apps/e2e/protocols/P-001-admin-onboarding.ts` | P-001 remains permanently skipped (same root cause as 2026-05-06: missing `data-testid` attributes). No Linear ticket or formal routing to `frontend-designer` has been created since the finding was first documented 2026-04-13. |

---

## Mission Registry Coverage Table

| Mission ID | `MissionIdSchema` enum | `MISSIONS` object entry | DB seed migration | Dedicated E2E spec | Capability harness | Status |
|---|---|---|---|---|---|---|
| `onboarding-interview` | Yes | Yes | `20260314300000` | Partial — `journey-full-wizard-flow.spec.ts` (UI only) | `onboarding-harness-e2e.spec.ts` (capability tools) | PARTIAL |
| `landing-demo` | Yes | Yes | No dedicated migration | `landing.spec.ts` (smoke only) | None | LOW |
| `lise-interview` | Yes (restored `47e2e4bd3`) | Yes (restored `47e2e4bd3`) | No dedicated migration found | None | None | NONE — **NEW** |
| `mr-botsson` | Yes | Yes | `20260301200100` | None for mission behavior | `botsson-harness-e2e.spec.ts` (memory capability) | LOW |
| `haccp-inspector` | Yes | Yes | `20260319120300` | None | None | NONE |
| `shift-assistant` | Yes | Yes | `20260406110001` | None | None (schedule capability tested separately) | NONE |
| `botsson-session` | Yes | Yes | `20260311023524` | None | None | NONE |
| `season-lifecycle` | No (constant only) | No | `20260319120400` (8 stages) | `season-activation.spec.ts`, `season-planning.spec.ts` | None (season capability has 0 tools) | LOW (DB-only design — intentional per ADR-0272 proposed) |
| `discovery-call` | No | No | `20260301200100` (3 stages) | None | None | DEAD FIXTURE |

**Summary:** 7 `MissionId` enum values. 7 `MISSIONS` object entries (parity restored today). 2 DB-only mission IDs with no enum/registry counterpart (`season-lifecycle`, `discovery-call`). 5 of 7 registered missions have zero behavioral E2E coverage.

---

## Delta vs 2026-05-06 Baseline

| Claim (2026-05-06) | 2026-05-12 status |
|---|---|
| 6 missions in registry | 7 — `lise-interview` restored today (commit `47e2e4bd3`) |
| `lise-interview` absent from enum | FIXED — now present in `MissionIdSchema` and `MISSIONS` |
| `season-lifecycle` constant-only, no registry entry | UNCHANGED — by design (ADR-0272 proposed) |
| `discovery-call` DB-only orphan | UNCHANGED |
| `mission` capability has E2E harness (`mission-harness-e2e.spec.ts`) | CONFIRMED — covers `get_active_missions` + `get_workspace_roadmap` (capability tools, not mission voice behavior) |
| 22/24 capabilities covered in harness matrix | CONFIRMED — `kb_query` + `operations-intelligence` still uncovered |
| P-001 permanently skipped | UNCHANGED |
| No CI Playwright gate | UNCHANGED |

**Net delta:** `lise-interview` restoration is the only structural change. The restore correctly adds it to both the Zod enum (type safety) and the `MISSIONS` object (runtime lookup). Voice config is `coral` voice (PO-locked 2026-05-08 per comment in registry.ts). No E2E spec accompanies the restoration.

---

## Protocol Verification Engine Status (unchanged)

- P-001: PERMANENTLY SKIPPED. Missing testids unresolved. No new artifacts since 2026-04-13.
- P-LOGIN: ACTIVE locally. Last artifact: 2026-04-14. No CI job.
- Zero generated artifacts in last 28 days.

---

## Verified Intentional (not re-flagged)

| Pattern | Why intentional |
|---|---|
| `season-lifecycle` absent from `MISSIONS` object | DB-managed multi-stage mission, not an Ultravox voice persona. Consumed via `SEASON_LIFECYCLE_MISSION_ID` string constant in `session-manager.ts`, `calendar-guardian.ts`, `stage-manager.ts`. ADR-0272 (proposed) documents the DB-only design. |
| `botsson-session` has empty `systemPrompt: ""` | Intentional — persona engine on client injects `context.persona_prompt` at runtime. Not a prompt regression. |
| Mission capability harness tests `engine_state`/`engine_missions` rows, not `AgentMission.systemPrompt` content | Capability tools (`get_active_missions`, `get_workspace_roadmap`) are read tools over DB, not Ultravox voice session launchers. Harness correctly verifies capability pipe, not voice session behavior. |

---

## In-Progress (mid-campaign)

| Item | Campaign | Status |
|---|---|---|
| `feat/e2e-nyheter-stabilize` — komm-nyheter spec stabilization | Active | In-progress. `komm-nyheter/*.spec.ts` failures not counted as violations in this slice. |
| `lise-interview` E2E spec | Not yet started | No campaign or sortie active for this. MEDIUM-14-01 is a gap, not a campaign item. |

---

## MISSING TESTIDS

P-001 root cause is unchanged. Required testids for unblocking P-001:

```
MISSING TESTIDS:
- [data-testid="onboarding-hero"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
- [data-testid="onboarding-manual-mode"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
- [data-testid="onboarding-step-business"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
- See full list in apps/e2e/protocols/P-001-admin-onboarding.ts
```

Route to: `frontend-designer`. This agent does not write `apps/web/src/`.

---

*Slice 14 of 14. Scope: missions-e2e. Auditor: protocol-verification-engine agent. 2026-05-12.*
