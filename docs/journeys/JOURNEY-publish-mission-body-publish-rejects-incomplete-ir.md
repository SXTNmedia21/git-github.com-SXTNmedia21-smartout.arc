---
title: "Journey — Publish avvises når IR mangler required v2.1-felt"
feature: publish-mission-body
journey: publish-rejects-incomplete-ir
status: verified
verified_at: 2026-04-27
e2e_test: apps/e2e/tests/journey-capability-publish-mission.spec.ts
created: 2026-04-23
updated: 2026-04-27
module: journey-engine
tags: [journey, publish-mission, validation, adr-0194, error-path, contract-enforcement]
---

# Journey: Publish avvises når IR mangler required v2.1-felt

**Role:** admin (platform-admin surface per ADR-0173)

**Precondition:**
- En `journey_version`-rad eksisterer med `compiled_ir` som **mangler** enten `system_prompt` (null/tom) eller `mode` (null/ikke i enum), eller har 0 steps
- Admin har `manage_journeys` authority (gate_action ville tillatt)
- `engine_authority_config` har rad for `journey.publish_mission`

## Happy Path

1. Admin invoker `journey.publish_mission` via platform-admin UI med en `journey_version_id` hvis `compiled_ir` mangler `system_prompt`
   → Router resolver capability
   → `callGateAction("journey.publish_mission", ctx)` returnerer `allowed=true` (authority er OK — det er IR-innholdet som er problemet)
   → Body validerer `compiled_ir`:
     - `system_prompt` non-empty? **NEI** — validering feiler
   → Body returnerer **FØR** insert og **FØR** emit:
     ```
     {
       ok: false,
       error: "validation_failed",
       detail: "journey_version.compiled_ir missing required v2.1 field: system_prompt",
       missing_fields: ["system_prompt"]
     }
     ```

2. Admin ser error-melding i UI (M4-scope; test asserter `result.ok === false` + `result.error === "validation_failed"`)

3. **Artefakt-assertion (L-0125 spirit — negative case):**
   → `SELECT FROM engine_missions WHERE journey_version_id = v.id` returnerer **0 rader**
   → `SELECT FROM engine_stages WHERE mission_id IN (SELECT id FROM engine_missions WHERE journey_version_id = v.id)` returnerer **0 rader**
   → `SELECT FROM engine_event WHERE event_name = 'journey.run_started' AND ...` returnerer **0 rader** (phantom-emit-forbud per ADR-0196 Invariant 11)
   → `SELECT FROM activity_trail WHERE event_type = 'journey.run_started' AND ...` returnerer **0 rader**

**Postcondition:**
- `engine_missions` uendret
- `engine_stages` uendret
- Ingen `journey.run_started`-emit (dette er KRITISK — Phase 0s fantom-body problem var nettopp at run_started ble emittet selv når body ikke gjorde noe)
- `journey_version.status` uendret (fortsatt `ready_publish`)
- Admin kan rette IR og prøve igjen

## Error Paths

Denne journeyen ER error-pathen. Variasjoner:

- **Scenario:** `mode` mangler eller er utenfor enum
  → Body returnerer `{ok:false, error:"validation_failed", missing_fields:["mode"]}` — samme assertion-regime: 0 nye rader, 0 emits

- **Scenario:** 0 steps i IR
  → Body returnerer `{ok:false, error:"validation_failed", detail:"IR must contain at least one step"}` — samme regime

- **Scenario:** Både `system_prompt` og `mode` mangler
  → Body returnerer `{ok:false, error:"validation_failed", missing_fields:["system_prompt", "mode"]}` — aggregerte felt, samme regime

- **Scenario:** `callGateAction` returnerer `allowed=false` (separat error-path, men samme negative assertion-shape)
  → Body returnerer `{ok:false, error:"authority_denied"}`, 0 nye rader, 0 emits, `gate.denied` emit til activity_trail

## Verification

- [ ] Implementation validerer v2.1-felt FØR insert og FØR emit (Phase B1-B2 av PLAN)
- [ ] E2E test asserter at `result.ok === false` AND 0 rader i engine_missions/engine_stages/engine_event (`apps/e2e/tests/journey-capability-publish-mission.spec.ts`, Phase A2)
- [ ] Manually tested: invoke med broken IR, bekreft ingen DB-endringer via SQL

**Mark `status: verified` in frontmatter when all three boxes are checked.**

## Notes

Denne journeyen eksisterer spesifikt for å **låse Invariant 11 fra ADR-0196 inn i runtime-kontrakten**. Phase 0 feilet fordi `publish_mission` emittet `run_started` uten insert — en phantom body. Denne testen gjør det umulig å gjeninnføre det mønsteret stille. Hvis noen fjerner validasjonen men beholder emit før insert, vil denne testen fange det via 0-rad-emit-assertion.
