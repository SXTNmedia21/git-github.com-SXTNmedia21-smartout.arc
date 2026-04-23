---
title: "Campaign — botsson-arena"
status: active
updated: 2026-04-23
created: 2026-04-20
module: MODULE_BOTSSON
tags: [campaign, roadmap, ai-harness, botsson, stage-engine, session-recorder]
---

# Campaign — botsson-arena

> Branch: `campaign/botsson-arena` | Worktree: `/home/sxtnl/dev/smartout.ai-botsson-arena`
> Module: MODULE_BOTSSON | Started: 2026-04-20 | Last reconciled: 2026-04-23

> **Status-kart:** [`docs/architecture/BOTSSON-SYSTEM-MAP.md`](../architecture/BOTSSON-SYSTEM-MAP.md) — end-to-end pipe diagram med 🟢/🟡/🔴 per komponent. Sjekk det før du planlegger en sub-sortie.

## Vision

Forbedre og synkronisere den eksisterende Smartout AI-harnessen (Botsson Arena + Stage Engine). **Ingen ny arkitektur.** Vi bruker dagens komponenter — stage-engine, agent router, 14 capabilities, unified `gate_action`, `emit()` telemetry, `engine_memory`, `engine_process`/`engine_event`, missions + journeys — og lukker gap, fjerner drift, og kobler sammen delene som i dag står uforbundet. Harnessen fungerer end-to-end for happy path; denne kampanjen bringer den til produksjonsgrade gjennom målrettet reparasjon, ikke nybygg.

## Scope

Kun **utvikling, forbedring, synkronisering** av eksisterende elementer. Ingen nye systemer, ingen ny arkitektur, ingen parallell runtime.

**In scope — forbedre det som finnes**
- Lukk eksisterende ADR-0099-brudd i `contract_intake` (wrap eksisterende tool i eksisterende `gate_action`).
- Ship ADR-0151 ved å flytte `profile_id`-derivasjon fra body → server i eksisterende stage-engine routes.
- Koble produsent-siden på eksisterende `engine_memory`-tabell (reader finnes allerede).
- Konsolidér de to eksisterende gate-RPC-ene (`gate_action` + `cascade_gate_write`) bak én delt SQL-kjerne — begge RPC-navn består.
- Reparer Season dual-emission i eksisterende `emit()` + DB-trigger (velg én, ikke begge).
- Koble de 3 eksisterende `EngineActionType`-enumverdiene til dispatcher som mangler case.
- Koble ADR-0112 coverage-invariant til CI (skriptet finnes ikke, men checken er allerede definert).
- Koble mobil LiveKit (finnes allerede) til eksisterende BFF `/api/botsson/chat` → stage-engine.
- Eksponér de 4 eksisterende generatorene via API-route (de er pure functions i dag).
- Land Botsson Observability Foundation P0 — erstatt eksisterende `console.*` med `pino`, bruk eksisterende `@smartout/telemetry`, erstatt eksisterende in-process guardian-bus med eksisterende pg_notify-mønster fra Telegram-bro.
- Apply helpdesk Phase 1 schema-drafts som allerede er skrevet som `.sql.draft`; registrér `helpdesk_query` capability i eksisterende `capabilities/registry.ts`.

**Out of scope — ingen nybygg**
- Ingen nye agent-modi, personas, missions utover de 6 registrerte.
- Ingen ny runtime eller framework.
- Ingen Ultravox → LiveKit migrering på web (web beholder Ultravox per ADR-0135).
- Ingen voice-for-PII capabilities (permanent forbud per ADR-0077/0078).
- Ingen mobile authoring UIs — "web composes, mobile executes" (ADR-0133).
- Ingen Linear sync, ingen ADR-0038 Phase 3+ features.
- Ingen nye K1a industripakker.

## Non-Goals (explicit)

- ❌ Ingen re-arkitektur av capability-router — beholder intent-classifier → tool-selector → LLM.
- ❌ Ingen ny agent-ramme — beholder Vercel AI SDK + OpenRouter.
- ❌ Ingen ny tabell, ny service, ny edge function, ny package uten at en eksisterende mangler et konkret hakk.
- ❌ Ingen "greenfield" subagent-design — dagens capability + tool-mønster ER subagent-overflaten.

## Milestones

Delivered in three phases. Each phase gates the next.

### Phase A — Close open gates (2–3 weeks)
Security + correctness floor. No new capabilities until these land.

- [x] **A1** — Fix contract-intake D2 orphan (`submitFieldGroup` bypasses `gate_action`) — landed 2026-04-23
      → `docs/plans/PLAN-contract-intake-gate-fix.md` · merged via PR #243 (`3ea7fcbb`)
      → New `packages/ai/src/capabilities/contract-intake/gate.ts` (cloned from `shift-lifecycle/gate.ts` template) wraps both `submitFieldGroup` + `declineIntake`. Four-eyes discriminator uses dedicated `gate.requiresFourEyes` boolean (not fragile `reason` string-match). 4 targeted tests (allow/deny/downgrade/four-eyes). Invariant 13 verified: every mutation preceded by `callGateAction`. Handoff: `docs/HANDOFF-contract-intake-gate-fix.md`. `BOTSSON-SYSTEM-MAP.md` flipped 🔴 → 🟢.
- [x] **A2** — Ship ADR-0151 (server-derive `profile_id` in stage-engine) — landed 2026-04-23
      → `docs/plans/PLAN-stage-engine-profile-id-derivation.md`
      → Landed via `feat/botsson-arena-harness-hardening` (sortie): `deriveProfileId` helper, `/agent/chat` + `/sessions` server-derive, `AgentToolContext.profileId/workspaceId` widened to `NonEmptyString` (ADR-0193 amendment), I4 `invariants:server-actor` CI check, golden-transcript eval wired via `ai-eval.yml` (ADR-0073 Phase 6). Items 3 + 5 of the bundle deferred until `feat/contract-hub-fix-forward` merges (L-0119). Handoff: `docs/HANDOFF-harness-hardening.md`.
- [x] **A3** — Wire `engine_memory` writer (producer path) — landed 2026-04-22
      → `docs/plans/PLAN-engine-memory-writer.md` · new `memory` capability + `save_memory` tool (chat-only, gated) · shared writer at `packages/ai/src/context/memory-writer.ts`
- [x] **A4** — Ship ADR-0112 intent coverage CI check — landed 2026-04-23
      → Merged via PR #244 (`a51553ea`). Script at `packages/ai/scripts/check-intent-coverage.ts` + pnpm lint hook + `harness-invariants` CI job step I10.
      → Textual parser (CI-fast ~300ms), exit codes 0/1/2 = clean/drift/parser-broken. 13 unit tests + 6 fixtures + simulated-drift capture. Allow-list trimmed from ADR draft: `memory` became real cap in A3, `training` never was tool-less — dropped both. ADR-0112 follow-ups ticked. Handoff: `docs/HANDOFF-intent-coverage-ci.md`.
- [x] **A5** — Wire intent-classifier context input — initial 2026-04-22, refactor 2026-04-23
      → **Phase 1 (string helper):** Commit `41a2972b`, merged via PR #240. `buildClassifierContext()` returned compact `"Rolle: X. Avdeling: Y."` string.
      → **Phase 2 (typed-object refactor):** Merged via PR #245 (`e104c7d9`). `classifyIntent()` signature widened from `string` to typed `ClassifierContext = { role, departmentName, workspaceId, channel, hint? }`. Removes invented `"employee"` default — honest `null` when DB returns null. Catches last `classifyIntent("")` in `golden-transcripts.eval.ts`. Propagation test uses `vi.hoisted()` spies with full mock-clear in beforeEach+afterEach per L-0125. Handoff: `docs/HANDOFF-intent-classifier-context.md`.
- [x] **A6** — Land Botsson Observability Foundation P0 — landed 2026-04-22
      → `docs/plans/PLAN-botsson-observability-foundation.md` + `docs/superpowers/plans/2026-04-16-botsson-observability-foundation.md`
      → Landed: pino logger, Sentry init, request-id middleware, typed errors, auto-emit via `toVercelTools` (ADR-0116), **pg_notify guardian bus** (ADR-0186 — migration `20260422120000`, new `pg-notify-bus.ts`, guardian-bus façade), index.ts console.* sweep. Scoped console.* sweep in remaining core/ modules deferred to follow-up.

### Phase B — Unblock Wave 2B + fix dual-emission (3–4 weeks)
Reconciles the two write-path universes (agent-tool vs Server-Action) so Wave 2B capability migration can resume.

- [ ] **B1** — Compose dual-gate via orchestrator (Council 2026-04-23 rejected unification premise → chose composition per ADR-0203 + ADR-0204)
      → `docs/plans/PLAN-dual-gate-composition.md` (supersedes archived `PLAN-dual-gate-reconciliation.md`)
      → 5 sub-sorties progress:
      → [x] **SS-1** phantom cleanup memory/tools.ts:73 — landed via PR #252 (`fc0a1754`) · new `memory/gate.ts` + 4 per-cap gate.ts surfaces, zero inline `rpc("gate_action")` outside wrapper, 20/20 tests, L-0134 Mode 3 closed.
      → [x] **SS-2** ADRs accepted + amendments — landed via PR #241 (doc batch `131649f1`) · ADR-0203 accepted, ADR-0204 proposed (flips at SS-3 merge), ADR-0091/0099 amended, L-0133/0134/0135 logged.
      → [x] **SS-3** orchestrator scaffold + correlation_id schema — landed via PR #254 (`23842e52`) · `packages/ai/src/gate/gatedMutation.ts` (545 lines) + migration `20260519000000_gate_evaluation_correlation_chain.sql` + 8 unit tests + type regen. Feature-flagged (`SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=false` default). L-0134 Mode 3 hardened: zero inline `rpc("gate_action")` outside per-cap `gate.ts`.
      → [ ] **SS-4** migrate 4 per-cap gate.ts (shift-lifecycle, contract-intake, journey, memory) through orchestrator — will flip ADR-0204 `proposed → accepted`
      → [ ] **SS-5** close 33 Wave 2B lint warnings
- [ ] **B2** — Fix Season dual-emission (pick: DB trigger OR `emit()`, not both)
      → `docs/plans/PLAN-gatedwrite-wave-2a.md` (existing)
- [ ] **B3** — Apply Helpdesk Phase 1 migrations (schema drafts → live)
      → `docs/plans/PLAN-helpdesk-phase-1.md` (to be spun out from Phase 0 plan)
- [ ] **B4** — Register `helpdesk_query` capability + authority seed
      → Part of B3 plan.
- [ ] **B5** — Land 3 missing `EngineActionType` handlers (`create_deviation`, `validate_settlement`, `lock_checkout`)
      → `docs/plans/PLAN-engine-action-handlers.md` (to write when B3 kicks off — HACCP needs this).

### Phase C — Voice + generators + polish (4–6 weeks)
Closes the mobile voice theatre and ships the journey generator API surface.

- [ ] **C1** — Wire LiveKit transcripts to BFF + enforce `voice_participation` policy
      → `docs/plans/PLAN-mobile-voice-wiring.md`
- [ ] **C2** — Ship generator API routes (`/api/.../generate`) for all 4 generators
      → `docs/plans/PLAN-generator-api-integration.md` (to write when C1 lands — lower priority)
- [ ] **C3** — Nordic Split compliance audit on Botsson orb + onboarding UI
      → Frontend-designer agent pass, no separate plan doc.

### Phase D — Observability + diagnostics (1–2 weeks per sub-phase)
Adds session-level replay + admin intervention + schedule diagnostics.

- [x] **D1** — Session Recorder + Platform Admin Intervention — landed 2026-04-22
      → `docs/superpowers/plans/2026-04-22-session-recorder-platform-admin.md` · ADR-0184 + ADR-0185
      → Landed: 3 tabeller (`agent_session_recording`, `agent_session_envelope`, `agent_session_whisper`), pgcrypto envelope + cron TTL, hooks i 5 core-moduler (prompt-builder, agent-router, authority, guardian-evaluator, memory-manager), 4 BFF endpoints (flag, whisper, sessions-dump, break-glass), Realtime-hook (`useRecorderSessions`), 5 Platform Admin UI-komponenter (SessionList-overlay + TurnTimeline + TurnCard + RedactedPill + AdminActionDrawer), Arena LogView hover-flag affordance, 3 TDD-pending-infra E2E acceptance-tester (replay, whisper-isolation, resilience).
      → Phase 2 follow-ups (not blocking D1 acceptance): (a) komponér TurnTimeline + AdminActionDrawer inn i GuardianDashboard, (b) build `/flag-session` + `/force-stop` + `/_metrics` endpoints, (c) recorder failure-injection for E2E, (d) document NULL workspace_id authority-seed reality (per-workspace `disabled` seed, platform-admin access via RLS godmode not NULL rows).
- [ ] **D2** — Schedule capability diagnostics (wrong day bug)
      → Replay recent sessions via Session Recorder to isolate tz-handling root-cause in `schedule/tools.ts`.
- [ ] **D3** — Botsson Overlay pixel-parity implementation (Claude Design handoff)
      → `docs/plans/PLAN-botsson-overlay-implementation.md` · `docs/design/BOTSSON-OVERLAY-BRIEF.md` · frontend-designer owns.

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

| Date | Sortie | Summary |
|------|--------|---------|
| 2026-04-23 | harness-hardening | Items 1/2/4/6 — profile_id derive (ADR-0151), typed CapabilityDefinition (ADR-0198), INVARIANTS.md (ADR-0199), golden-transcript eval wired (ADR-0073 Phase 6). Items 3+5 deferred until fix-forward merges. |
| 2026-04-23 | **A1 contract-intake-gate-fix** | Wrapped `submitFieldGroup` + `declineIntake` in `gate_action` (ADR-0099, blocker #1). Per-capability `gate.ts` clone from shift-lifecycle template. Four-eyes uses dedicated `requiresFourEyes` boolean. 4 tests. Merged via PR #243 (`3ea7fcbb`). |
| 2026-04-23 | **A4 intent-coverage-ci** | ADR-0112 intent-coverage CI check (blocker #8). Script + 13 tests + CI job step I10. Allow-list cleanup. Merged via PR #244 (`a51553ea`). |
| 2026-04-23 | **A5 classifier-context (v2)** | Widened `classifyIntent()` signature from string → typed `ClassifierContext` object (blocker #9 v2). Catches last `classifyIntent("")` call site. L-0125-compliant propagation test. Merged via PR #245 (`e104c7d9`). |
| 2026-04-23 | **B1 SS-1 memory-gate-cleanup** | Phantom-capability Mode 3 (L-0134) closure at memory/tools.ts:73 — new memory/gate.ts wrapper, zero inline `rpc("gate_action")` outside per-cap gate.ts. Merge-blocker prereq for SS-3+. 20/20 tests. Merged via PR #252 (`fc0a1754`). |
| 2026-04-24 | **B1 SS-3 orchestrator-scaffold** | `gatedMutation()` TS composition orchestrator per ADR-0204 — authority FIRST, data-rule SECOND, short-circuit on deny, one `gate_evaluation` correlation_id chain per mutation. Feature-flagged off. Schema migration `20260519000000_gate_evaluation_correlation_chain.sql` adds `correlation_id` + `parent_evaluation_id` self-FK. 8/8 orchestrator tests + 290/290 @smartout/ai full suite. Merged via PR #254 (`23842e52`). |

## Decisions (campaign-scoped)

New ADRs registered during this campaign will be listed here and in `docs/decisions/0000-decision-log.md`. Pre-campaign ADRs that bound scope:

| ADR  | Title                                                         | Status   | Phase binding |
|------|---------------------------------------------------------------|----------|---------------|
| 0042 | Agent Architecture (Stage Engine Agent Mode)                  | accepted | Substrate |
| 0073 | AI Eval Harness                                               | accepted | Phase A (A4 CI) |
| 0078 | Engine Process Channel Restriction                            | accepted | Phase B (helpdesk) |
| 0091 | Capability Gate-Client                                        | accepted | Phase B (B1) |
| 0095 | Shift Lifecycle Five-Layer                                    | accepted | Substrate |
| 0099 | Unified Authority Gate                                        | accepted | Phase A (A1) |
| 0101 | Four-Eyes Gate Approvers                                      | accepted | Substrate |
| 0112 | Intent Classifier Coverage Invariant                          | accepted | Phase A (A4) |
| 0114 | Server Actions as Canonical Mutation Primitive                | accepted | Phase B (B1) |
| 0116 | Auto-Emit Telemetry from Tool Adapter                         | accepted | Phase A (A6) |
| 0186 | Guardian Bus via pg LISTEN/NOTIFY                             | accepted | Phase A (A6) |
| 0127–0135 | Mobile Surface ADRs (thin client, web-composes-mobile-executes, LiveKit) | accepted | Phase C (C1) |
| 0138 | Agent Tool Result Gate Outcome (discriminated union)          | proposed | Phase B (B1 blocker) |
| 0151 | Stage-Engine Profile ID Server Derivation                     | proposed | Phase A (A2) |
| 0160–0163 | Helpdesk Foundations                                     | accepted | Phase B (B3/B4) |
| 0184 | Session Recorder Architecture                                 | accepted | Phase D (D1) — landed 2026-04-22 |
| 0185 | Platform Admin Session Intervention (whisper/flag/force-stop/break-glass) | accepted | Phase D (D1) — landed 2026-04-22 |

## Blockers + Risks

Ranked. See `docs/plans/ROADMAP-ai-harness.md` for the evidence trail.

| # | Blocker | Impact | Resolved by |
|---|---------|--------|-------------|
| ~~1~~ | ~~contract-intake `submitFieldGroup` skips `gate_action`~~ | ~~Live ADR-0099 violation~~ | **A1 — PR #243 (2026-04-23)** |
| 2 | Dual-gate divergence (agent-tool vs Server-Action) | Same mutation, two authz outcomes | B1 |
| ~~3~~ | ~~Stage-engine `profile_id` from request body~~ | ~~API-key callers can forge actor~~ | **A2 — PR #240 (2026-04-23)** |
| 4 | Season dual-emission | Duplicate downstream workflows on season activation | B2 |
| ~~5~~ | ~~`engine_memory` no writer~~ | ~~Agent never learns, only recalls~~ | **A3 — 2026-04-22** |
| 6 | Mobile voice not routed | Tokens issue, transcripts never reach engine | C1 |
| 7 | 3 missing action handlers | HACCP Phase 2c blocked | B5 |
| ~~8~~ | ~~ADR-0112 CI check not wired~~ | ~~Silent intent/capability drift possible~~ | **A4 — PR #244 (2026-04-23)** |
| ~~9~~ | ~~Intent-classifier context is `""`~~ | ~~Discards role/department signal~~ | **A5 — PR #240 (v1) + PR #245 (v2 typed-object)** |

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date       | Development HEAD | Merge commit |
|------------|------------------|--------------|
| 2026-04-20 | (campaign start) | — |
| 2026-04-23 | `3e2ee327` (daily-ops M2/M4/0c) | auto-synced via PR #243 + #244 + #245 closures |

## Related Campaign Docs

| Doc | Purpose |
|-----|---------|
| `docs/plans/ROADMAP-ai-harness.md` | Full state snapshot + layer-by-layer inventory (source of truth for this campaign) |
| `docs/plans/PLAN-botsson-observability-foundation.md` | Campaign entry for observability P0 (A6) |
| `docs/plans/PLAN-contract-intake-gate-fix.md` | A1 |
| `docs/plans/PLAN-stage-engine-profile-id-derivation.md` | A2 |
| `docs/plans/PLAN-engine-memory-writer.md` | A3 |
| `docs/plans/PLAN-dual-gate-composition.md` | B1 (superseded `PLAN-dual-gate-reconciliation.md` 2026-04-23) |
| `docs/plans/PLAN-gatedwrite-wave-2a.md` | B2 (existing) |
| `docs/plans/PLAN-helpdesk-phase-0.md` | Phase 0 done (reference only) |
| `docs/plans/PLAN-mobile-voice-wiring.md` | C1 |
| `docs/architecture/modules/MODULE_BOTSSON.md` | Module ground truth |
| `docs/superpowers/specs/2026-04-09-agent-harness-foundation-design.md` | Source spec (partially superseded by observability P0) |
