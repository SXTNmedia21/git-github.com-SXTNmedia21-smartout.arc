---
title: "Audit Slice 14 — missions-e2e"
status: complete
created: 2026-05-10
updated: 2026-05-10
auditor: protocol-verification-engine
surfaces: ["packages/ai/src/missions/", "apps/e2e/"]
tags: [audit, missions, e2e, livekit, voice, typecheck]
---

# Audit Slice 14 — missions-e2e

**Surfaces:** `packages/ai/src/missions/` + `apps/e2e/`
**Branch:** `campaign/botsson-arena`
**Date:** 2026-05-10

---

## F-ME-01 — Zero E2E coverage for any registered mission ID

**Severity:** HIGH

**Files:**
- `packages/ai/src/missions/registry.ts` (defines 7 missions)
- `packages/ai/src/missions/types.ts:3` (`MissionIdSchema` enum)
- `apps/e2e/tests/` (144 spec files, none reference mission IDs)

**Finding:**

The mission registry defines 7 missions:

| Mission ID | Persona | Surface |
|---|---|---|
| `onboarding-interview` | Botsson | `/onboarding` wizard |
| `landing-demo` | Lise | Landing page |
| `lise-interview` | Lise | `InterviewSurface` |
| `mr-botsson` | Mr. Botsson | Dashboard Orb |
| `haccp-inspector` | HACCP Inspector | Food safety |
| `shift-assistant` | Vaktassistenten | Schedule |
| `botsson-session` | Emma | Free-form voice |

A grep for every mission ID string across all 144 `apps/e2e/tests/**/*.spec.ts` files returns zero matches. No spec exercises any mission by ID — not via BFF, not via DB seed, not via API mock.

The `journey-mission-resolution.spec.ts` covers the `engine_missions` table indirectly (seeds ephemeral rows with synthetic slugs like `journey_e2e-mres-happy-*_v1`), but explicitly avoids the registered mission IDs.

**Risk:** The resolution layer that reads `MISSIONS[id]` in `services/voice-agent/src/agent.ts` and `getMission()` in `packages/ai/src/missions/registry.ts` is exercised by zero tests. A rename, stub-out, or deletion of any mission entry (e.g. `mr-botsson` → renamed mid-Phase-F refactor) would not be caught by any E2E gate.

**Not a false positive:** This is not covered by unit tests in `packages/ai/` either — checked via grep; no test files exist under `packages/ai/src/missions/`.

---

## F-ME-02 — Phase E voice path (lise-interview + mr-botsson): zero E2E for LiveKit path

**Severity:** HIGH

**Files:**
- `docs/journeys/JOURNEY-voice-plane-consolidation-lise-interview-livekit.md:8` (`e2e_test: null`)
- `docs/journeys/JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit.md:8` (`e2e_test: null`)
- `docs/journeys/JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md:8` (`e2e_test: null`)
- `docs/journeys/JOURNEY-voice-plane-consolidation-pii-guard-uniform-web-mobile.md:8` (`e2e_test: null`)
- `docs/journeys/JOURNEY-voice-plane-consolidation-krisp-nc-kitchen-noise.md:6` (`e2e_test: null`)

**Finding:**

All 5 Phase E voice-plane consolidation journey docs carry `e2e_test: null` in their frontmatter, and all 5 reference spec files that do not exist:

| Journey | Expected spec (does not exist) |
|---|---|
| lise-interview-livekit | `apps/e2e/tests/journey-lise-interview-livekit.spec.ts` |
| wizard-onboarding-via-livekit | `apps/e2e/tests/journey-wizard-onboarding-livekit.spec.ts` |
| botsson-overlay-voice-livekit | `apps/e2e/tests/journey-botsson-overlay-voice-livekit.spec.ts` |
| pii-guard-uniform-web-mobile | `apps/e2e/tests/journey-pii-guard-uniform.spec.ts` |
| krisp-nc-kitchen-noise | `apps/e2e/tests/journey-krisp-nc-kitchen-noise.spec.ts` |

The Phase E HANDOFF (`docs/journeys/HANDOFF-phase-e-cutover.md`, Test Plan section) does not explicitly register these specs as deferred to Phase F — it lists only the operator smoke test (Op 0.10) and telemetry data review as pending. The Test Plan has no `[ ] voice E2E specs` checkbox at all, meaning the gap is not tracked.

`JOURNEY-phase-e-cutover.md:135` contains a one-line mention of "C1.c Detox E2E utestående (Phase F debt)" but this refers to mobile Detox (F-ME-03 below), not to the 5 Playwright specs that cover web voice paths.

The `JOURNEY-mr-botsson-dashboard-orb-voice.md` has `status: done` but contains no `e2e_test` field and no reference to a spec file — the journey is doc-only verified.

**Risk:** The entire LiveKit voice transport plane migrated in Phase E (ADR-0282) has no Playwright regression coverage. If the `/api/wizard/start` token-mint route or `BotssonProvider.provider="livekit"` breaks, no CI gate catches it. The voice sessions are the product's core differentiator.

**Note on feasibility:** WebRTC/LiveKit voice sessions require real audio devices and a LiveKit server — direct Playwright automation of audio capture is not feasible. The appropriate scope for Playwright specs is: (1) API layer — assert `POST /api/wizard/start` returns `{token, roomName, livekitUrl}` with correct shape; (2) UI layer — assert the `InterviewSurface` renders when voice is active (mock the LiveKit hook); (3) channel guard — assert voice-channel PII guard rejects at the BFF level (no real audio needed). These are all within the Playwright scope boundary.

---

## F-ME-03 — C1.c Detox E2E deferment: documented but not tracked

**Severity:** INFO (acknowledged debt, documented)

**Files:**
- `docs/plans/CAMPAIGN-botsson-arena.md:108` (C1 milestone entry)
- `docs/journeys/JOURNEY-phase-e-cutover.md:135` (one-line note)
- `docs/HANDOFF-c1-mobile-voice-wiring.md` (explicit deferment section)
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` (row status note)

**Finding:**

C1.c (Detox E2E for mobile voice session) is documented as deferred in multiple locations. The rationale is technically sound: iOS simulator is impossible on WSL2 dev environment, Android-only Detox setup would take 2-3 days for 1 test, and the load-bearing invariants are covered by BFF + tool-selector unit tests.

Deferment is documented in:
- `docs/plans/CAMPAIGN-botsson-arena.md:108` — explicit note "C1.c deferred 2026-05-10: Detox E2E requires bootstrap of mobile-test infra not present in repo..."
- `docs/HANDOFF-c1-mobile-voice-wiring.md` — "C1.c — Detox E2E" section with rationale
- `docs/HANDOFF-c1d-botsson-channel-bootstrap.md` — "C1.c or next cleanup" cross-reference

**Gap:** There is no Linear issue or ADR tracking this debt. The deferment is prose-documented but not ticketed. A future sortie author searching for mobile E2E gaps may not find this unless they read the campaign plan narrative.

**Recommendation:** Create a Linear ticket tagged `mobile-e2e-debt` referencing the campaign plan note. This is outside the protocol-verification-engine's scope to action.

---

## F-ME-04 — L-0224 typecheck exclusion: debt is stable, exclusion still required

**Severity:** INFO (known, tracked, exclusion correct)

**Files:**
- `apps/e2e/tsconfig.json:25-36` (exclude block)
- `docs/learnings/0224-e2e-typecheck-baseline-debt.md` (canonical debt doc)

**Finding:**

L-0224 (logged 2026-05-06) documented 42 typecheck errors across 9 files in `apps/e2e/`. The fix was to add all 9 files to `tsconfig.json` `exclude`. The current exclude block matches exactly:

```
reporters/journey-reporter.ts
tests/journey-doc-chunk-handbook-edit.spec.ts
tests/journey-doc-chunk-protocol-edit.spec.ts
tests/journey-page-takeover-allow-list.spec.ts
tests/journey-page-takeover-default-deny.spec.ts
tests/mobile/03-workspace-select-to-shift-hub.spec.ts
tests/mobile/04-tab-navigation.spec.ts
tests/mobile/05-training-page.spec.ts
tests/telemetry-smoke.spec.ts
```

All 9 files still exist on disk. Running `npx tsc --noEmit -p apps/e2e/tsconfig.json` returns exit code 0, confirming the exclusion is effective.

**No additional debt has been added since L-0224.** The current exclude count (9) matches the learning exactly.

**Verification:** `npx tsc --noEmit -p apps/e2e/tsconfig.json` — exit code 0 on `campaign/botsson-arena` as of 2026-05-10.

**Recommendation:** Restore the 9 files and fix the error classes per the L-0224 "Likely fix" table. Estimated 30-60 min (Sortie B candidate per the learning). Error classes: `uuid` missing dep, Playwright `expect.poll` 1-arg drift, mobile fixture `page: never` infer failure, `journey-reporter.ts` implicit-any annotations, null-check on `telemetry-smoke.ts`.

---

## F-ME-05 — Protocol registry: only P-001 defined, test is skipped

**Severity:** MEDIUM

**Files:**
- `apps/e2e/protocols/index.ts:9` (`PROTOCOL_REGISTRY = { "P-001": P001_ADMIN_ONBOARDING }`)
- `apps/e2e/tests/protocol.spec.ts:29` (`test.skip(true, "P-001 references data-testid attributes...")`)

**Finding:**

The Protocol Verification Engine's registry contains exactly one protocol (`P-001` for admin onboarding) and that protocol's test is `skip`-ped because the `data-testid` attributes it requires do not exist in the onboarding components:

```
test.skip(
  true,
  "P-001 references data-testid attributes (onboarding-hero, onboarding-manual-mode, ..."
```

No protocol definitions exist for:
- `onboarding-interview` voice path (lise-interview mission)
- `mr-botsson` dashboard orb session
- `haccp-inspector` food safety flow
- `shift-assistant` schedule planning

The protocol-verification-engine infrastructure (runner, gate-checker, generators) is fully built but has zero runnable protocols. The sole protocol is blocked on missing `data-testid` attributes in production code.

**Missing testids (reported, not fixed — this is web's scope):**

```
MISSING TESTIDS:
- [data-testid="onboarding-hero"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
- [data-testid="onboarding-manual-mode"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
- [data-testid="onboarding-step-business"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
```

**Risk:** The protocol engine exists as infrastructure but generates zero docs, mission drafts, or UX audits in practice. Its value proposition (automated guide generation from protocol runs) is unrealized until at least one protocol runs end-to-end.

---

## F-ME-06 — JOURNEY-onboarding-mission.md references Ultravox: stale post Phase E

**Severity:** LOW (documentation drift, no runtime impact)

**File:** `docs/journeys/JOURNEY-onboarding-mission.md:13-19`

**Finding:**

This journey doc predates Phase E (last updated 2026-03-19, status: `done`) and describes the onboarding mission using Ultravox:

> "Ultravox API key is configured."
> "Ultravox call is created with stage-specific system prompt"
> "Frontend connects WebSocket to `/ws/:sessionId` via `useJourneySocket` hook"

Post Phase E (ADR-0282), Ultravox is fully removed. The wizard now uses LiveKit (`/api/wizard/start` → LiveKit token, not Ultravox call creation). The `useJourneySocket` hook is also gone — LiveKit `useBotsson` hook replaced it.

This is part of the "840 prose-replace docs" backlog noted in `HANDOFF-phase-e-cutover.md` (§ Known Issues / Debt), which explicitly deferred doc-consolidation to a separate sortie (P5 scope).

**No action for this audit slice** — tracked in Phase E handoff as P5 debt.

---

## F-ME-07 — Mr. Botsson dashboard orb voice journey has no E2E + no e2e_test frontmatter field

**Severity:** MEDIUM

**File:** `docs/journeys/JOURNEY-mr-botsson-dashboard-orb-voice.md`

**Finding:**

`JOURNEY-mr-botsson-dashboard-orb-voice.md` has `status: done` (indicating the feature is shipped) but:
1. Contains no `e2e_test` frontmatter field (unlike the voice-plane-consolidation journeys which have `e2e_test: null`)
2. Contains no reference to a Playwright spec file
3. No spec exists in `apps/e2e/tests/` for the Orb voice call flow

The `mr-botsson` mission (voice, `firstSpeaker: "user"`, Jarvis-mode) is the primary in-dashboard AI assistant. Its voice path (`POST /api/botsson/voice/token` → LiveKit room `botsson-orb:<profileId>`) has zero Playwright coverage.

The missing `e2e_test` frontmatter field means this gap would not be found by the current audit pattern that greps for `e2e_test: null`. It is a silent gap.

---

## Summary Table

| Finding | Severity | Gap Type | Action Owner |
|---|---|---|---|
| F-ME-01 | HIGH | Zero mission ID coverage in E2E | Protocol agent (write specs for BFF layer) |
| F-ME-02 | HIGH | 5 Phase E voice journeys: 0 Playwright specs | Protocol agent (write API + UI layer specs) |
| F-ME-03 | INFO | C1.c Detox documented, not ticketed | Supervisor (create Linear ticket) |
| F-ME-04 | INFO | L-0224 exclusion stable, debt not fixed | Protocol agent (Sortie B: fix 9 files) |
| F-ME-05 | MEDIUM | P-001 skipped (missing testids), no other protocols | Protocol agent + frontend-designer (testids) |
| F-ME-06 | LOW | JOURNEY-onboarding-mission.md Ultravox refs | Docs sortie P5 (tracked in HANDOFF) |
| F-ME-07 | MEDIUM | Mr. Botsson orb voice: no E2E + missing frontmatter field | Protocol agent (write spec + add field) |

---

## Protocol Coverage Map

Mission ID → E2E coverage:

| Mission | Playwright | Protocol | Notes |
|---|---|---|---|
| `onboarding-interview` | None | None | `JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit.md` e2e_test: null |
| `landing-demo` | None | None | No journey doc with E2E checkpoint |
| `lise-interview` | None | None | `JOURNEY-voice-plane-consolidation-lise-interview-livekit.md` e2e_test: null |
| `mr-botsson` | None | None | `JOURNEY-mr-botsson-dashboard-orb-voice.md` status: done, no e2e_test field |
| `haccp-inspector` | None | None | No journey doc with E2E checkpoint |
| `shift-assistant` | None | None | No journey doc with E2E checkpoint |
| `botsson-session` | None | None | No journey doc with E2E checkpoint |

**Coverage ratio: 0/7 missions have any E2E test (0%).**

The `engine_missions` table (DB-side mission storage) is covered indirectly by `journey-mission-resolution.spec.ts` and `journey-capability-publish-mission.spec.ts`, but these use synthetic ephemeral mission slugs — they do not exercise any of the 7 registered `MISSIONS` entries in `registry.ts`.

---

*Generated by Protocol Verification Engine — Audit Slice 14 | 2026-05-10*
