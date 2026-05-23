---
title: "Botsson — E2E Coverage"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: botsson
tags: [domain, botsson, e2e, testing, playwright, coverage]
---

# Botsson — E2E Coverage

> Test matrix = proof of what is actually built and tested. **Code wins.** All test file existence verified by `find apps/e2e -name "*botsson*"` 2026-05-23.

## Summary

| Area | Playwright specs | Unit/Vitest | Status |
|---|---|---|---|
| Harness E2E (chat + tool dispatch) | ✅ 1 spec | ✅ extensive | 🟡 partial |
| Recorder (whisper, flag, force-stop, failure) | ✅ 3 specs | ✅ Phase 2a/2b | 🟡 partial (Phase 2c 🔴) |
| Orb polish (sm-8) | ✅ 1 spec | — | 🟡 partial |
| Domain-chat-ownership (Orb suppress) | ✅ 1 spec | — | 🟡 partial |
| Mission E2E (mr-botsson, lise, onboarding) | 🔴 none | 🟡 partial | 🔴 gap (G11) |
| Proposal pipeline (fase-4) | 🔴 none | — | 🔴 gap |
| Voice (LiveKit end-to-end) | 🔴 none | — | 🔴 gap (LiveKit not Playwright-able) |

---

## Playwright specs (`apps/e2e/`)

### `apps/e2e/tests/botsson-harness-e2e.spec.ts`

End-to-end harness test: chat input → intent classify → tool dispatch → response. Confirmed present 2026-05-23.

**Covers:**
- Chat input sends to `/api/botsson/chat` → stage-engine
- Intent classified, tool dispatched, response returned
- Partial: not all capabilities covered; voice not testable via Playwright

### `apps/e2e/tests/sm-8-botsson-orb.spec.ts`

Orb polish test (SM-8 sortie). Confirmed present 2026-05-23.

**Covers:**
- Orb render + state transitions (visual)
- Basic orb interaction

### `apps/e2e/tests/domain-chat-ownership/botsson-provider-scope.spec.ts`

ADR-0238 surface disambiguation. Confirmed present 2026-05-23.

**Covers:**
- Orb suppresses to passive mode when `DomainChatOwnership` declared
- Provider scope boundary (single BotssonProvider per dashboard)

### `apps/e2e/tests/botsson-recorder/` (3 specs)

Confirmed present 2026-05-23 by `ls`:

| Spec | Phase | Status |
|---|---|---|
| `recorder-failure-resilience.spec.ts` | Phase 2a | 🟡 built, Phase 2c assertions pending |
| `whisper-never-user-facing.spec.ts` | Phase D1 | 🟢 |
| `schedule-wrong-day-replay.spec.ts` | Phase D2 | 🟡 depends on Phase D2 fix (G10) |

**NOT YET covered (Phase 2c gaps — G11):**
- E2E: drawer click → whisper round-trip (AdminActionDrawer → stage-engine)
- E2E: force-stop hold flow
- E2E: recorder failure injection (Q8b assertion surface)

### `apps/e2e/helpers/botsson-harness.ts`

Helper utilities for botsson E2E tests. Confirmed present 2026-05-23.

---

## Unit / Vitest coverage

### Mission framework (`packages/ai/src/missions/`)

No dedicated mission unit tests found at `packages/ai/__evals__/`. Mission registry is tested indirectly via capability tests + harness E2E.

### Harness invariants (CI-enforced)

Per `CAMPAIGN-botsson-arena.md` and `BOTSSON-SYSTEM-MAP.md`:

| Invariant | What it checks | Status |
|---|---|---|
| I4 `invariants:server-actor` | No `profile_id: z.string()` in POST body schemas | 🟢 |
| I10 `invariants:intent-coverage` | Intent classifier enum covers all capability names | 🟢 |
| I13 `invariants:no-phantom-gate` | Zero inline `rpc("gate_action")` outside per-cap `gate.ts` | 🟢 |

### Capability unit tests

Individual capability tests exist at `packages/ai/src/capabilities/*/`. Key botsson-adjacent:

| Capability | Test file | Coverage |
|---|---|---|
| `memory` | `capabilities/memory/__tests__/` | 🟢 `save-memory-tool-visibility.test.ts` (G1 closure) |
| `onboarding` | `capabilities/onboarding/__tests__/` | 🟢 42 test files |
| `communication` (publishAnnouncement) | `capabilities/communication/__tests__/publishAnnouncement.test.ts` | 🟢 5 test cases |

### BFF route tests

`apps/web/src/app/api/botsson/` — no dedicated unit tests found. Coverage via E2E and harness integration tests.

### Voice agent

`services/voice-agent/` — 4 telemetry events wired with runtime hooks (`services/voice-agent/src/agent.ts:138-261`). No Playwright E2E (LiveKit transport not Playwright-testable). Detox E2E for mobile deferred (C1.c — iOS sim impossible on WSL2 dev env).

---

## Mission coverage gap (G11)

Per `BOTSSON-KNOWN-LIMITATIONS.md` G11 and `BOTSSON-STAGE-MISSION-MODEL.md` §validation:

| Mission | Journey `e2e_test` | Playwright spec | Coverage |
|---|---|---|---|
| `onboarding-interview` | — | — | 🔴 no E2E |
| `mr-botsson` | — | — | 🔴 no E2E |
| `lise-interview` | — | — | 🔴 no E2E |
| `landing-demo` | — | — | 🔴 no E2E (text-only post-F0) |
| `haccp-inspector` | — | — | 🔴 no E2E |
| `shift-assistant` | — | — | 🔴 no E2E |
| `botsson-session` | — | — | 🔴 no E2E |

**Root cause:** Mission E2E requires: LiveKit transport stub OR mock BFF; intent classification mock; capability tool stubs. Infrastructure not yet bootstrapped.

**Plan:** ROADMAP.md §Mission E2E foundation. Priority: `mr-botsson` BFF + UI layers first (highest production traffic), then `lise-interview`.

---

## What "tested" means for voice

LiveKit voice transport cannot be Playwright-tested. "Tested" for voice missions means:

1. **BFF tested:** `/api/botsson/voice/token/route.ts` — unit test or harness E2E confirms token issuance
2. **Agent tested:** `services/voice-agent/src/agent.ts` — 4 telemetry events wired as runtime probes
3. **E2E substitute:** mission journey `e2e_test` frontmatter + manual test case document

None of these exist for any mission today (G11).
