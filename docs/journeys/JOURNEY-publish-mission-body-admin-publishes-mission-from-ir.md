---
title: "Journey — Admin publiserer mission fra JourneyIR v2.1"
feature: publish-mission-body
journey: admin-publishes-mission-from-ir
status: verified
verified_at: 2026-04-27
e2e_test: apps/e2e/tests/journey-capability-publish-mission.spec.ts
created: 2026-04-23
updated: 2026-04-27
module: journey-engine
tags: [journey, publish-mission, engine-missions, adr-0194, happy-path]
---

# Journey: Admin publiserer mission fra JourneyIR v2.1

**Role:** admin (platform-admin surface per ADR-0173)

**Precondition:**
- En `journey_version`-rad eksisterer med `compiled_ir` som inneholder valid v2.1 IR (`system_prompt` non-empty, `mode ∈ {sequential, free, hybrid}`, ≥ 1 step med `title`/`action`/`assertion`)
- `journey_version.status = 'ready_publish'` (ADR-0172 lifecycle)
- Admin har `manage_journeys` authority (ADR-0173)
- `engine_authority_config` har rad for `journey.publish_mission` (ADR-0176 seed)

## Happy Path

1. Admin invoker `journey.publish_mission` via platform-admin UI (M4-scope, her simulert via `agentInvoke`)
   → Router resolver capability, henter `engine_authority_config` for `journey.publish_mission`
   → `callGateAction("journey.publish_mission", ctx)` returnerer `allowed=true` (ADR-0196 Invariant 13)
   → Body validerer `compiled_ir`: `system_prompt` non-empty ✓, `mode` in enum ✓, ≥ 1 step ✓
   → Body insert `engine_missions`-rad:
     - `id = generated UUID`
     - `workspace_id = ctx.workspaceId`
     - `journey_version_id = input.journey_version_id`
     - `system_prompt = ir.system_prompt`
     - `mode = ir.mode`
     - `is_active = false` (ADR-0194 Gate — author-enrich pending)
     - `created_by = ctx.profileId`
   → Body derive + insert `engine_stages`-rader per IR-step:
     - `mission_id = <new mission.id>`
     - `goal = step.title`
     - `instructions = step.action`
     - `success_criteria = step.assertion`
     - `creative_freedom = 0.3` (default)
     - `step_order = index`
   → Body emit `journey.run_started` til ADR-0175 4 destinasjoner (PostHog, Logger, activity_trail, engine_event):
     - `run_id`, `capability="journey.publish_mission"`, `surface="admin-ui"`, `actor_id`, `workspace_id`
   → Body return `{ok:true, mission_id, run_id}`

2. Admin ser suksess-bekreftelse i UI (M4-scope; her bekrefter test via `result.ok === true`)

3. **Artefakt-assertion (L-0125 spirit):**
   → `SELECT FROM engine_missions WHERE id = mission_id` returnerer 1 rad med `is_active = false`
   → `SELECT FROM engine_stages WHERE mission_id = mission_id ORDER BY step_order` returnerer N rader (én per IR-step), alle NOT NULL på goal/instructions/success_criteria
   → `SELECT FROM engine_event WHERE event_name = 'journey.run_started' AND run_id = run_id` returnerer 1 rad
   → `SELECT FROM activity_trail WHERE event_type = 'journey.run_started' AND run_id = run_id` returnerer 1 rad

**Postcondition:**
- `engine_missions` har ny rad med `is_active = false`
- `engine_stages` har N rader knyttet til mission
- `journey.run_started`-event registrert i alle 4 ADR-0175 destinasjoner
- Mission er synlig for runtime agent-selector men IKKE surfaced til end users (is_active=false gate)
- M3 author-enrich-flow kan nå flippe `is_active=true` etter at goal/instructions/success_criteria er fylt ut manuelt (out of scope for denne journey)

## Error Paths

- **Scenario:** `callGateAction` returnerer `allowed=false` (authority downgrade)
  → Body returnerer `{ok:false, error:"authority_denied"}`, ingen insert, ingen `run_started`-emit, `gate.denied`-emit til activity_trail

- **Scenario:** `journey_version_id` finnes ikke eller tilhører annen workspace
  → Body returnerer `{ok:false, error:"not_found"}`, ingen insert, ingen emit

- **Scenario:** DB-insert feiler (constraint violation — f.eks. duplicate mission_id)
  → Body returnerer `{ok:false, error:"insert_failed", detail}`, ingen `engine_stages`-insert (transaksjonell — hele publish rulles tilbake), ingen `run_started`-emit

## Verification

- [ ] Implementation matches the steps above (Phase B av PLAN)
- [ ] E2E test exists and passes (`apps/e2e/tests/journey-capability-publish-mission.spec.ts` — Phase A1)
- [ ] Manually tested end-to-end via `agentInvoke` fra repl eller test-runner

**Mark `status: verified` in frontmatter when all three boxes are checked.**
