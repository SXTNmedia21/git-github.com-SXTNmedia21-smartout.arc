---
title: "Campaign — botsson-arena"
status: active
updated: 2026-04-22
created: 2026-04-20
module: MODULE_BOTSSON
tags: [campaign, roadmap, ai-harness, botsson, stage-engine]
---

# Campaign — botsson-arena

> Branch: `campaign/botsson-arena` | Worktree: `/home/sxtnl/dev/smartout.ai-botsson-arena`
> Module: MODULE_BOTSSON | Started: 2026-04-20 | Last reconciled: 2026-04-22

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

- [ ] **A1** — Fix contract-intake D2 orphan (`submitFieldGroup` bypasses `gate_action`)
      → `docs/plans/PLAN-contract-intake-gate-fix.md`
- [ ] **A2** — Ship ADR-0151 (server-derive `profile_id` in stage-engine)
      → `docs/plans/PLAN-stage-engine-profile-id-derivation.md`
- [x] **A3** — Wire `engine_memory` writer (producer path) — landed 2026-04-22
      → `docs/plans/PLAN-engine-memory-writer.md` · new `memory` capability + `save_memory` tool (chat-only, gated) · shared writer at `packages/ai/src/context/memory-writer.ts`
- [ ] **A4** — Ship ADR-0112 intent coverage CI check
      → Small PR, no separate plan doc. Script at `packages/ai/scripts/check-intent-coverage.ts` + pnpm lint hook.
- [ ] **A5** — Wire intent-classifier context input (currently `""` at `agent-router.ts:83`)
      → Small PR, passes role/department/relationship into `classifyIntent()`.
- [ ] **A6** — Land Botsson Observability Foundation P0
      → `docs/plans/PLAN-botsson-observability-foundation.md` + `docs/superpowers/plans/2026-04-16-botsson-observability-foundation.md`

### Phase B — Unblock Wave 2B + fix dual-emission (3–4 weeks)
Reconciles the two write-path universes (agent-tool vs Server-Action) so Wave 2B capability migration can resume.

- [ ] **B1** — Reconcile dual-gate (`gate_action` vs `cascade_gate_write`)
      → `docs/plans/PLAN-dual-gate-reconciliation.md`
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

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

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
| 0127–0135 | Mobile Surface ADRs (thin client, web-composes-mobile-executes, LiveKit) | accepted | Phase C (C1) |
| 0138 | Agent Tool Result Gate Outcome (discriminated union)          | proposed | Phase B (B1 blocker) |
| 0151 | Stage-Engine Profile ID Server Derivation                     | proposed | Phase A (A2) |
| 0160–0163 | Helpdesk Foundations                                     | accepted | Phase B (B3/B4) |

## Blockers + Risks

Ranked. See `docs/plans/ROADMAP-ai-harness.md` for the evidence trail.

| # | Blocker | Impact | Resolved by |
|---|---------|--------|-------------|
| 1 | contract-intake `submitFieldGroup` skips `gate_action` | Live ADR-0099 violation, PII writes ungated | A1 |
| 2 | Dual-gate divergence (agent-tool vs Server-Action) | Same mutation, two authz outcomes | B1 |
| 3 | Stage-engine `profile_id` from request body | API-key callers can forge actor | A2 |
| 4 | Season dual-emission | Duplicate downstream workflows on season activation | B2 |
| 5 | `engine_memory` no writer | Agent never learns, only recalls | A3 |
| 6 | Mobile voice not routed | Tokens issue, transcripts never reach engine | C1 |
| 7 | 3 missing action handlers | HACCP Phase 2c blocked | B5 |
| 8 | ADR-0112 CI check not wired | Silent intent/capability drift possible | A4 |
| 9 | Intent-classifier context is `""` | Discards role/department signal | A5 |

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date       | Development HEAD | Merge commit |
|------------|------------------|--------------|
| 2026-04-20 | (campaign start) | — |

## Related Campaign Docs

| Doc | Purpose |
|-----|---------|
| `docs/plans/ROADMAP-ai-harness.md` | Full state snapshot + layer-by-layer inventory (source of truth for this campaign) |
| `docs/plans/PLAN-botsson-observability-foundation.md` | Campaign entry for observability P0 (A6) |
| `docs/plans/PLAN-contract-intake-gate-fix.md` | A1 |
| `docs/plans/PLAN-stage-engine-profile-id-derivation.md` | A2 |
| `docs/plans/PLAN-engine-memory-writer.md` | A3 |
| `docs/plans/PLAN-dual-gate-reconciliation.md` | B1 |
| `docs/plans/PLAN-gatedwrite-wave-2a.md` | B2 (existing) |
| `docs/plans/PLAN-helpdesk-phase-0.md` | Phase 0 done (reference only) |
| `docs/plans/PLAN-mobile-voice-wiring.md` | C1 |
| `docs/architecture/modules/MODULE_BOTSSON.md` | Module ground truth |
| `docs/superpowers/specs/2026-04-09-agent-harness-foundation-design.md` | Source spec (partially superseded by observability P0) |
