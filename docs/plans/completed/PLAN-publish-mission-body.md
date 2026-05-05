---
title: "Plan — publish-mission-body"
feature: publish-mission-body
spec: docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md
status: done
updated: 2026-04-27
created: 2026-04-23
module: journey-engine
tags: [plan, phase-2, publish-mission, engine-missions, adr-0194, l-0125]
---

# Plan — publish-mission-body

> Branch: `feat/journey-engine-publish-mission-body` | Worktree: `~/dev/smartout.ai-journey-engine-wt-1` | Module: journey-engine
> Parent campaign: `campaign/journey-engine` (Phase 2 of 6 milestones)

**Spec:** [Journey Runner Suite — Mental Model v1.7.1](../superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md)

## Journeys (the contract)

- [JOURNEY-publish-mission-body-admin-publishes-mission-from-ir](../journeys/JOURNEY-publish-mission-body-admin-publishes-mission-from-ir.md) — Admin invoker `journey.publish_mission` med valid v2.1 IR → `engine_missions`-rad (is_active=false) + `engine_stages`-rader derivert per IR-step
- [JOURNEY-publish-mission-body-publish-rejects-incomplete-ir](../journeys/JOURNEY-publish-mission-body-publish-rejects-incomplete-ir.md) — IR mangler `system_prompt` eller `mode` → `{ok:false, error:"validation_failed"}`, ingen insert, ingen `run_started`-emit

## Goal

Implementer `journey.publish_mission` body i `packages/ai/src/capabilities/journey/tools.ts` (linje 299-344) slik at kapabiliteten faktisk skriver til `engine_missions` per ADR-0194 hybrid-mapping — og erstatt den neutered `{ok:false, error:"not_implemented"}`-stubben fra Phase 0.

## Binding ADRs and learnings

- **ADR-0194** (accepted) — JourneyIR v2.1 → engine_missions mapping, hybrid: `system_prompt` + `mode` required på IR-root, per-stage `goal`/`instructions`/`success_criteria` derivert fra per-step `title`/`action`/`assertion`, `is_active=false` default gated på author-enrich (M3-scope).
- **ADR-0196** (accepted) — Invariant 11 (no phantom capabilities), Invariant 13 (gate_action på hver mutation).
- **ADR-0197** (accepted) — Phantom contracts class rule, Mode 2 (phantom body).
- **ADR-0099** — `callGateAction` mandatory før alle mutations.
- **ADR-0175** — Journey telemetry contract — `journey.run_started` emit etter vellykket insert, med ADR-0134 actor_id + workspace_id.
- **L-0125** (accepted) — Test spirit vs letter: test asserter ARTEFAKTET (SELECT engine_missions), ikke bare return shape.

## Tasks (TDD-ordre)

### Phase A — Test først (red)

- [ ] A1. Skriv L-0125-scaffold E2E-test: `apps/e2e/tests/journey-capability-publish-mission.spec.ts`
  - Seed `journey_version` med valid v2.1 IR (system_prompt + mode + 2 steps)
  - Invoke via `agentInvoke("journey.publish_mission", { journey_version_id })`
  - Assert `result.ok === true`
  - **Assert artefakt:** `SELECT FROM engine_missions WHERE id = expectedMissionId(v)` returnerer 1 rad med `is_active=false`
  - **Assert cascade:** `SELECT FROM engine_stages WHERE mission_id = ...` returnerer N rader (én per IR-step)
  - **Assert emit:** `SELECT FROM engine_event WHERE event_name='journey.run_started' AND run_id=...`
- [ ] A2. Skriv rejection-test (Journey 2): IR uten `system_prompt` → `{ok:false, error:"validation_failed"}`, 0 rader i `engine_missions`, ingen `run_started`-emit
- [ ] A3. Kjør test — forventet RØD (body er fortsatt neutered)

### Phase B — Implementer body (green)

- [ ] B1. Valider v2.1 IR-felt: `system_prompt` non-empty, `mode ∈ {sequential, free, hybrid}` (ny validator-helper i `packages/journey-ir/src/validate.ts`)
- [ ] B2. `callGateAction("journey.publish_mission", ctx)` FØR insert (ADR-0196 Invariant 13)
- [ ] B3. Insert `engine_missions` (is_active=false, system_prompt, mode, workspace_id, created_by)
- [ ] B4. Derive + insert `engine_stages` per IR-step:
  - `goal := step.title`
  - `instructions := step.action`
  - `success_criteria := step.assertion`
  - `creative_freedom := 0.3` (default, author override i M3)
- [ ] B5. `emit("journey.run_started", { run_id, actor_id, workspace_id, capability:"journey.publish_mission", surface:"admin-ui" })` ETTER vellykket insert
- [ ] B6. Return `{ok:true, mission_id, run_id}`
- [ ] B7. Kjør A1-test — forventet GRØNN
- [ ] B8. Kjør A2-test — forventet GRØNN

### Phase C — Code-trace review (targeted, ikke full council)

- [ ] C1. Dispatch `system-agent-coordinator` med spesifikt spørsmål: "Verifiser ADR-0194 hybrid kontrakt i tools.ts publish_mission body — system_prompt+mode required validation, per-stage derive fra step.title/action/assertion, is_active=false, gate_action called FØR insert, emit AFTER insert. Flag avvik."
- [ ] C2. Juster per findings (hvis noen)

### Phase D — Close

- [ ] D1. Kjør `pnpm turbo typecheck` — 0 errors
- [ ] D2. Kjør `scripts/close-feature-journey-guardian.sh` — verifiser Invariant 11/12/13 greps passerer
- [ ] D3. Slett eller `.skip` den gamle rubber-stamp-testen `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts:118-147` (L-0125 fix-forward)
- [ ] D4. Flip begge journeys til `status: verified`
- [ ] D5. Skriv HANDOFF-publish-mission-body.md
- [ ] D6. `/close-feature`

## Acceptance Criteria

- [ ] Begge journeys `status: verified`
- [ ] `pnpm turbo typecheck` 0 errors
- [ ] L-0125 artefakt-asserting test grønn (SELECT engine_missions + engine_stages + engine_event)
- [ ] Rejection-test grønn (validation_failed uten insert/emit)
- [ ] Journey Guardian merge-gate green
- [ ] ADR-0194 hybrid-kontrakt implementert (verifisert via code-trace)
- [ ] Rubber-stamp-test fra Phase 0 slettet/skipped med FIXME-L-0125

## Token budget

Target: **~25-35k tokens** (vs Phase 0s ~120k).

Kutt:
- Skip full council (~30k spart) — ADR-0194 allerede accepted, kun targeted code-trace nødvendig
- 1 build-agent (code-trace C1), ikke 3 parallelle (~40k spart)
- TDD eliminerer phantom-risiko ved konstruksjon (~15k spart rework)
- Minimal plan/journey-stubs, ikke 10-sider (~10k spart)

Ikke-forhandlingsbart (behold):
- Sub-sortie isolasjon (kode-mutasjon på campaign-root er CLAUDE.md-brudd)
- Close-feature Journey Guardian gate
- L-0125 artefakt-asserting test (spirit > letter)
- `/end-session` ved close

## Out of scope

- `journey.publish_guide` body — separat sub-sortie, trenger storage-ADR først (Supabase Storage vs journey_guide DB table)
- `is_active=true` activation flow — M3-scope per ADR-0194 Gate
- Admin UI for publish_mission trigger — M4-scope
- `protocolToJourneyIR()` adapter — M3-scope (ADR-0174)

## Next after close

Phase 3 candidate: `journey.publish_guide` body (requires storage-ADR decision first) OR M3 generator unification (ADR-0174 `protocolToJourneyIR()` adapter + retarget `apps/e2e/generators/`).
