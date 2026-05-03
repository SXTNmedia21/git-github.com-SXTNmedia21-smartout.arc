---
title: "Handoff — publish-mission-body"
feature: publish-mission-body
branch: feat/journey-engine-publish-mission-body
closed: 2026-04-27
module: journey-engine
tags: [handoff, journey-engine, publish-mission, adr-0194, adr-0196, l-0125]
---

# Handoff — publish-mission-body

## Summary

Phase B body for `journey.publish_mission` capability. Validates JourneyIR v2.1
contract (`system_prompt`, `mode`, ≥1 step), gates via `callGateAction`, inserts
`engine_missions` + `engine_stages` rows transactionally, then emits
`journey run_started` to ADR-0175 4 destinations — only after both inserts
commit. Closes the phantom-body gap caught by Council 2026-04-23
(ADR-0196 Invariant 11).

## Journeys Delivered

| Journey                          | Status   | E2E test                                                       |
| -------------------------------- | -------- | -------------------------------------------------------------- |
| admin-publishes-mission-from-ir  | verified | apps/e2e/tests/journey-capability-publish-mission.spec.ts      |
| publish-rejects-incomplete-ir    | verified | apps/e2e/tests/journey-capability-publish-mission.spec.ts      |

## Decisions Made

| Decision                                                                 | Reason                                                                       | Impact                                            |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `validation_failed` returns BEFORE any emit                              | Honor ADR-0196 Invariant 11 — emit must follow artefact, never precede.      | Negative test asserts 0 rows in engine_event.     |
| Mission id derived as `journey_<slug>_v<version_number>`                 | ADR-0194 hybrid mapping; deterministic id enables idempotent re-publish.    | Test row uniqueness via slug + version_number.   |
| `is_active = false` on insert                                            | M4 author-enrich gate — runtime selector ignores until enriched.            | Prevents premature surface to end users.          |
| `engine_stages` insert failure rolls back `engine_missions`              | ADR-0099 — no half-published mission state.                                  | Consistency invariant for runtime mission store. |

No new ADRs introduced — this sub-sortie implements ADRs 0194-0197 already
accepted at campaign level (2026-04-23 Council post-implementation audit).

## Learnings

| Learning                                                                                | Context                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Negative E2E asserting 0 emits is the lock against phantom-body regression              | A future refactor moving emit before validation gets caught by 0-row assertion.      |
| L-0125 spirit (artefact SELECT, not return-shape) discriminates done from theatre       | `ok:true` means nothing without `engine_missions` SELECT confirming the row landed. |
| Validator v2.1 belongs in `packages/journey-ir`, not capability tool                    | Single source for IR shape; capability is consumer, not author.                      |

## Known Issues / Debt

- M4 author-enrich UI (flip `is_active=true` after manual goal/instructions/success_criteria) still pending.
- `engine_stages` defaults `creative_freedom = 0.3` — admin override surface not yet exposed.
- `journey.publish_guide` body still skeleton (next sub-sortie).

## Next Steps

- Sub-sortie for `journey.publish_guide` body (M2 closure).
- M3 generator unification — `protocolToJourneyIR()` adapter consumed by `apps/e2e/generators/`.
- M4 admin UI surface for publish + author-enrich (`apps/web/src/app/platform-admin/journeys`).
- M5 `journey.run_guided` runtime + stuck-detector cutover.
