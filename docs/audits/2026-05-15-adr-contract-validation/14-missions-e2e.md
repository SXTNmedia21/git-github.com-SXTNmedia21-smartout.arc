---
title: "Audit Slice 14 — Missions / E2E Coverage"
status: done
created: 2026-05-15
updated: 2026-05-15
module: missions-e2e
tags: [audit, missions, e2e, adr]
---

# Audit Slice 14 — Missions / E2E Coverage

**Baseline date:** 2026-05-13
**Audit date:** 2026-05-15
**Auditor:** Protocol Verification Engine (slice 14 of 14)
**Scope:** `packages/ai/src/missions/` + `apps/e2e/`
**ADR in scope:** ADR-0038 (Journey Agent & Output Generators)

---

## Summary

State as of development HEAD 2026-05-15: 7 missions registered, protocol registry expanded from 2 to 5 entries (P-001 + S8 + S9 + S10 + S11), but mission persona coverage remains zero. The 4 new protocols (S8–S11) cover world-best-wfm campaign surfaces (POS, marketplace, scheduler) — none target any of the 7 registered mission persona definitions. F-ME-01 and F-ME-07 from the 2026-05-13 baseline are unchanged. ADR-0274 (`engine_session_step` + `agent_inquiry` tables) remains `proposed` with no migration shipped, now 11 days since creation.

Key state:
- 7 missions in `packages/ai/src/missions/registry.ts` — unchanged
- 5 protocols in `PROTOCOL_REGISTRY` — up from 2 (P-001 + P-LOGIN placeholder)
- P-001 (admin-onboarding) remains `test.skip(true)` — no resolution
- 0 of 7 missions have a Playwright spec exercising persona, voice, or system prompt
- ADR-0274 (`proposed`, 2026-05-04) — no migration in `supabase/migrations/`
- `e2e_test` field adoption: 148 of ~250 journey docs have the field — up from ~12 at 2026-05-13 baseline (bulk addition from world-best-wfm campaign)

---

## Mission Coverage Matrix

| Mission ID | Registered | Journey Doc (dedicated) | `e2e_test` field | Live Persona E2E | Verdict |
|---|---|---|---|---|---|
| `onboarding-interview` | yes | none | n/a | none | NO COVERAGE |
| `landing-demo` | yes | none | n/a | none | NO COVERAGE |
| `lise-interview` | yes | `JOURNEY-voice-plane-consolidation-lise-interview-livekit.md` (indirect) | `"deferred — Phase F sortie 4"` | none | NO COVERAGE |
| `mr-botsson` | yes | none | n/a | none | NO COVERAGE |
| `haccp-inspector` | yes | none | n/a | none | NO COVERAGE |
| `shift-assistant` | yes | none | n/a | none | NO COVERAGE |
| `botsson-session` | yes | none | n/a | none | NO COVERAGE |

Notes:
- `mission-harness-e2e.spec.ts` tests `get_active_missions` + `get_workspace_roadmap` tool routing through the BFF. This is capability pipe coverage, not persona coverage.
- `journey-mission-resolution.spec.ts` tests `engine_missions` DB artefact integrity (L-0125). Not persona coverage.
- `journey-capability-publish-mission.spec.ts` tests the publish flow from JourneyIR → `engine_missions`. Not persona coverage.
- No spec references any of the 7 mission IDs (`onboarding-interview`, `landing-demo`, `lise-interview`, `mr-botsson`, `haccp-inspector`, `shift-assistant`, `botsson-session`) directly.

---

## Protocol Registry State

| Slug | Protocol | Status | Notes |
|---|---|---|---|
| P-001 | Admin Onboarding | `test.skip(true)` — permanently blocked | Missing `data-testid` on onboarding components |
| S8 | POS Connect + Sync | Registered, runnable | Ships 2026-05-14; covers Lightspeed POS integration |
| S9 | Shift Marketplace Full Flow | Registered, runnable | Covers manager + employee marketplace UX |
| S10 | Scheduler Propose + Accept | Registered, runnable | Covers shift proposal flow |
| S11 | Scheduler Mobile Bundle | Registered, runnable | Covers mobile scheduler |

S8–S11 are substantial additions — 4 runnable protocols covering world-best-wfm surfaces. P-001 remains the only mission-adjacent protocol, and it has never run.

P-LOGIN remains not registered in `PROTOCOL_REGISTRY` (embedded in its spec file). No new protocols target any of the 7 mission IDs.

---

## ADR-0274 Implementation Status

ADR-0274 (Mission Run Contract — per-step durability, lease + idempotency, recovery-protokoll, frozen snapshot) was authored `2026-05-04` with status `proposed`. As of development HEAD 2026-05-15:

- `engine_session_step` table: absent from `supabase/migrations/`
- `agent_inquiry` table: absent from `supabase/migrations/`
- `engine_sessions.context.authority_snapshot`: no migration adding JSONB column constraint
- MissionPoolSlot lease-renewal loop: not found in `services/stage-engine/`

ADR-0274 is 11 days in `proposed` status. The Welcome Mission V0 spec (referenced in ADR-0274) depends on all four gaps being closed for durable operation. Without M3+M4 migrations, any multi-stage mission session cannot recover from a worker crash.

---

## Findings Table

| ID | Severity | Finding | Status vs 2026-05-13 |
|---|---|---|---|
| F-ME-01 | HIGH | Zero E2E coverage for all 7 registered mission persona definitions. A breaking change to system prompt, voice config, or tool wiring would not be caught by CI. | OPEN — unchanged |
| F-ME-02 | MEDIUM | 5 voice-plane-consolidation journey docs reference "Phase F sortie 4" which does not exist: no branch, no plan, no Linear ticket. The deferral pointer is dangling. | OPEN — Phase F sortie 4 still absent |
| F-ME-03 | MEDIUM | `e2e_test` frontmatter field is present in 148 journey docs (bulk adoption from wfm campaign) but absent from all 7 mission-adjacent journey docs. No cross-reference from a mission journey doc to any spec. | PARTIAL — field adoption improved broadly, mission gap persists |
| F-ME-04 | LOW | P-LOGIN is not in `PROTOCOL_REGISTRY` (embedded in spec). No mechanism enforces that every journey in `docs/journeys/` has a protocol entry. | OPEN — unchanged |
| F-ME-05 | MEDIUM | P-001 has never run. Missing `data-testid` attributes block it. No Linear ticket or DASHBOARD entry tracks the fix. The Protocol Verification Engine produces zero verified protocol outputs for mission flows. | OPEN — now 11+ days unblocked |
| F-ME-06 | LOW | `apps/e2e/coverage.md` declares "100% capability coverage" conflating BFF pipe coverage with mission persona coverage. Two dimensions not separated. | OPEN — unchanged |
| F-ME-07 | HIGH | `mr-botsson` (primary in-product voice surface, Jarvis-mode butler, `maxDurationSeconds: 1800`) has no journey doc, no `e2e_test` field, no Playwright spec. The most used mission has no test protection. | OPEN — unchanged |
| F-ME-08 (new) | HIGH | ADR-0274 (`proposed`, 2026-05-04) mandates `engine_session_step` + `agent_inquiry` tables for Welcome Mission V0 durability. Neither table exists in migrations 11 days later. Welcome Mission V0 cannot achieve durable multi-stage operation without M3+M4. | NEW — ADR stalled |

---

## Delta vs 2026-05-13

**Improvements:**
- Protocol registry grew from 2 entries (P-001 + P-LOGIN stub) to 5 (P-001 + S8 + S9 + S10 + S11)
- S8–S11 are runnable protocols targeting POS + marketplace + scheduler surfaces
- `e2e_test` field adoption in journey docs grew broadly (148 docs now have it)

**Regressions / New findings:**
- F-ME-08 (HIGH): ADR-0274 stalled — 11 days since `proposed`, no migration shipped. Welcome Mission V0 is blocked on durable infrastructure.
- F-ME-05 severity upgraded MEDIUM: P-001 has been unblocked by the protocol runner infrastructure for 11+ days with no tracking.

**Unchanged HIGH findings:** F-ME-01, F-ME-07 — 0 mission persona E2E specs after two audit cycles.

---

## Counts

- Missions registered: 7
- Missions with live E2E persona coverage: 0
- Protocols in registry: 5 (was 2)
- Runnable protocols: 4 (S8–S11); 1 permanently skipped (P-001)
- Findings: 8 total — 3 HIGH, 2 MEDIUM, 3 LOW
- New since 2026-05-13: 1 (F-ME-08)
- Closed since 2026-05-13: 0
