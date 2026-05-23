---
title: "Botsson — Roadmap"
status: in_progress
mirror: aspirational
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: botsson
tags: [domain, botsson, roadmap, aspirational, forward-plan]
---

# Botsson — Roadmap

> Forward plan + design intent. **mirror: aspirational** — claims here are intended but not verified against code. Verified work lives in ARCHITECTURE.md and DATA-MODEL.md.
>
> Sources: `docs/plans/CAMPAIGN-botsson-arena.md` (campaign status as of 2026-05-10), 7 plan files, 9 governing ADRs, `docs/design/BOTSSON-OVERLAY-BRIEF.md`, audit `docs/audits/2026-05-08-botsson-harness-audit.md`.

## Campaign status (botsson-arena)

The botsson-arena campaign (`docs/plans/CAMPAIGN-botsson-arena.md`) tracks the live sprint. As of last sync (2026-05-10), Phase E (voice consolidation) shipped completely. Active gaps:

| Phase | Status | Key remaining work |
|---|---|---|
| Phase A | ✅ All items closed | — |
| Phase B | 🟡 Partial | B1 SS-4 (migrate 4 per-cap gates through orchestrator) + B1 SS-5 (33 lint warnings) + B3 (Helpdesk Phase 1 migrations) open |
| Phase C | 🟡 Partial | C2 (generator API routes) open; C3 (Nordic Split audit) open |
| Phase D | 🟡 Partial | D2 (schedule wrong-day diagnose) + D3 (overlay pixel-parity) open |
| Phase E | ✅ Complete (PR #354, 2026-05-10) | — |

## Near-term (next sorties)

### P0 — Chat-path persona wire

**Gap:** Identity tuning (persona/rank/blend/customPrompt) affects only voice. Chat drops `persona_prompt` at `apps/web/src/app/api/emma/chat/route.ts`.

**Fix:** Forward `persona_prompt` + `custom_prompt` in the BFF proxy payload. Est: 30 min.

**Governing ADR:** ADR-0329 (soul server-compilation), ADR-0107/ADR-0276 (provider-channel derivation).

### P1 — Settings persistence (server-side)

**Gap:** Soul settings stored in `localStorage` per-browser. No sync between devices.

**Fix:** Persist to DB — either `engine_authority_config` or a new `agent_user_preferences` table. Est: 1 sortie.

### P1 — Phase 2c (session recorder E2E)

**Gap:** E2E browser tests for drawer-click → whisper, force-stop hold, TurnTimeline flag round-trip, recorder-failure injection missing.

**Ref:** `docs/superpowers/plans/2026-04-22-session-recorder-platform-admin.md`.

### P2 — D3 Botsson Overlay pixel-parity

**Gap:** Arena/Orb/Sticky not validated against `docs/design/botsson/project/` handoff bundle (Claude Design). Emma signature illustration + Immersive backdrop not implemented.

**Ref:** `docs/plans/PLAN-botsson-overlay-implementation.md` · `docs/design/BOTSSON-OVERLAY-BRIEF.md`.

**Owner:** frontend-designer.

### P2 — D2 Schedule wrong-day diagnose

**Gap:** G10 — user-reported schedule tool returns wrong day. Likely TZ-aware fixtures missing.

**Fix:** TZ-aware test fixture (Europe/Oslo, DST boundary, week-start variations) → trace schedule capability → fix + regression test.

**Ref:** `docs/plans/CAMPAIGN-botsson-arena.md` Phase D2.

## Medium-term

### Mission E2E foundation (G11)

All 7 missions have 0 Playwright E2E coverage. Plan:
1. Add `e2e_test` frontmatter to 7 mission journey files
2. Playwright suites: `mr-botsson` + `lise-interview` BFF + UI layers
3. `wizard-onboarding-via-livekit` E2E
4. 5 missing Phase E voice spec files

**Ref:** `BOTSSON-KNOWN-LIMITATIONS.md` G11. **Governing:** ADR-0073 (AI Eval Harness).

### B1 SS-4 (dual-gate orchestrator migration)

Migrate 4 per-cap `gate.ts` (shift-lifecycle, contract-intake, journey, memory) through `gatedMutation` composition orchestrator. Flips ADR-0204 `proposed → accepted`.

**Ref:** `docs/plans/PLAN-dual-gate-composition.md`. **Governing:** ADR-0204.

### C2 — Generator API routes

4 pure generator functions (`journey-botsson`, `journey-doc`, `journey-e2e`, `journey-linear` in `packages/ai/src/generators/`) have no HTTP surface. Ship `/api/.../generate` route wrappers.

**Ref:** `docs/plans/PLAN-botsson-observability-foundation.md` (C2 entry).

### G6 — VoiceId type cleanup

`UltravoxVoice` type retained post-Phase-E as compat bridge. Rename to `VoiceId`, add named union for 6 voices, drop compat map.

**Ref:** `BOTSSON-KNOWN-LIMITATIONS.md` G6. Est: 30 min.

### G9 — profile_id leak in BFF (ADR-0151 gap)

`/api/emma/chat` + `/api/botsson/chat` routes may accept `body.profile_id` without rejecting forgeable values. Same fix as Phase B1 PR #350.

**Ref:** `BOTSSON-KNOWN-LIMITATIONS.md` G9.

## Long-term / aspirational

### Soul on Platform Admin

ADR-0329 (soul server-compilation) + ADR-0330 (soul snapshot audit) accepted. Platform admin UI for soul snapshot management not yet built.

**Ref:** `docs/superpowers/plans/2026-04-29-botsson-on-platform-admin.md`.

### Fase-4 Proposal Pipeline (full build)

The proposal pipeline architecture is designed (ADR-0209 arena extraction, 5 journeys defined) but the feature is not built.

**Ref:** `docs/plans/PLAN-botsson-fase-4-proposal-pipeline.md` · `docs/superpowers/plans/2026-05-06-botsson-fase-4-proposal-pipeline.md` · `docs/superpowers/specs/2026-03-28-telemetry-orchestration-botsson-reactive-design.md`.

### Botsson Observability Foundation (full Phase C3)

Nordic Split compliance audit on Botsson orb + onboarding UI. Frontend-designer pass.

**Ref:** `docs/superpowers/plans/2026-04-16-botsson-observability-foundation.md`.

### v2 harness scope split (ADR-0206)

The v2 architecture splits harness responsibilities across v2-a/v2-b/v2-c sub-campaigns. B1–B5 in botsson-arena are P0-prereqs. When those close, v2 resumes.

**Ref:** `docs/decisions/0206-botsson-harness-v2-scope-split.md`.

### arena extraction (ADR-0209)

Arena as a standalone embeddable component. ADR-0209 defines the extraction contract.

**Ref:** `docs/decisions/0209-botsson-arena-extraction-contract.md`.

## Governing ADRs (persona-relevant)

| ADR | Title | Status | Phase binding |
|---|---|---|---|
| ADR-0107 | Botsson provider-channel derivation | accepted | Host mount |
| ADR-0206 | Botsson harness v2 scope split | accepted | Long-term |
| ADR-0209 | Botsson Arena extraction contract | accepted | Long-term |
| ADR-0220 | Botsson conversational front-door (not orchestrator) | accepted | Core invariant |
| ADR-0238 | Botsson surface disambiguation | accepted | Host mount |
| ADR-0276 | ADR-0107 amendment (provider independence) | accepted | Phase E amend |
| ADR-0282 | Voice plane consolidation — LiveKit only | accepted | Phase E |
| ADR-0329 | Botsson soul server-compilation | accepted | Soul — soul-on-platform-admin |
| ADR-0330 | Botsson soul snapshot audit | accepted | Soul — soul-on-platform-admin |
| ADR-0337 | ADR-0238 enforcement (DomainChatOwnership component) | accepted | Surface ownership |
| ADR-0362 | Botsson host mount pattern (amends ADR-0113 R51) | accepted | Host mount |
| ADR-0378 | LiveKit data-channel protocol (Botsson) | accepted | Voice protocol |

## Design references (working docs — stay in place)

These are raw/working assets, not compiled docs. Do not move.

- `docs/design/BOTSSON-OVERLAY-BRIEF.md` — overlay design brief
- `docs/design/botsson/project/` — Claude Design handoff bundle (Arena/Orb/Sticky mockups + emma.jsx + immersive.jsx)
- `docs/audits/2026-05-08-botsson-harness-audit.md` — 2026-05-08 harness audit (read as evidence; not compiled truth)

## Spec/Plan reconciliation log

See GAPS-AND-DEBT.md §Spec/Plan Reconciliation for the confirm/deviation/gap table.
