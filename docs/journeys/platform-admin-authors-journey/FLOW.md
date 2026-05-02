---
title: "FLOW — closed-loop spine for platform-admin-authors-journey"
journey_id: platform-admin-authors-journey
mission_id: journey_platform_admin_authors_journey_v1
created: 2026-04-29
updated: 2026-04-29
---

# FLOW.md — closed-loop spine

Chronological function list. Each row binds a phase to a registered
telemetry event and a deterministic assertion. The closed-loop dashboard
reads this. `e2e.spec.ts` is generated from it.

| # | phase | trigger_event | function | assertion | telemetry_event | next_phase |
|---|---|---|---|---|---|---|
| 1 | discovery | wizard_session created | `save_draft({phase: discovery, draft})` | `wizard_session.draft_journey` contains `title` AND `trigger_description` | `journey_authoring phase_advanced` | classification |
| 2 | classification | save_draft(discovery) returned ok | `check_duplicates({title, module, actor})` + `lookup_journeys({...})` + `save_draft({phase: classification, ...})` | draft contains `module` AND `actor` AND `platform` AND `priority` AND `tags` | `journey_authoring phase_advanced` | steps |
| 3 | steps | save_draft(classification) returned ok | `save_draft({phase: steps, draft.steps: []})` | `draft.steps` is array AND `length ≥ 1` | `journey_authoring phase_advanced` | testing |
| 4 | testing | save_draft(steps) returned ok | `save_draft({phase: testing, ...})` | draft contains `test_assertion` AND `preconditions is array` | `journey_authoring phase_advanced` | documentation |
| 5 | documentation | save_draft(testing) returned ok | `save_draft({phase: documentation, ...})` | draft contains `doc_title` AND 3 outcomes blocks | `journey_authoring phase_advanced` | review |
| 6 | review | save_draft(documentation) returned ok | (none — agent shows summary, awaits "godkjent") | user response matches /^(godkjent|publish|kjør)/i | (no telemetry) | publish |
| 7 | publish | review approved | `publish_draft({confirm: true})` | `journey[slug].status='ready_test'` AND `journey_version[journey_id].ir_json IS NOT NULL` AND `wizard_session.status='completed'` | `journey_authoring journey_published` | publish_mission |
| 8 | publish_mission | publish_draft returned journey_version_id | `journey.publish_mission({journey_version_id})` | `engine_missions[id='journey_<slug>_v1']` exists AND `count(engine_stages WHERE mission_id) ≥ 1` | `journey run_started` | (terminal) |

## Trigger event details

| trigger_event | Source | Filter |
|---|---|---|
| `wizard_session created` | `/platform-admin/journeys/wizard` POST | created_by = ctx.profile_id |
| `save_draft(discovery) returned ok` | tool execute return | session.id = ctx.wizardSessionId AND result.ok = true |
| (similar pattern for phases 2–5) | | |
| `review approved` | LLM-detected user message | matches "godkjent" / "publish" / "kjør" |
| `publish_draft returned journey_version_id` | tool execute return | result.ok = true AND journey_version_id is uuid |

## Telemetry events emitted

| event | properties | when |
|---|---|---|
| `journey_authoring phase_advanced` | `phase`, `wizard_session_id` | save_draft with `next_phase` set |
| `journey_authoring journey_published` | `journey_id`, `journey_version_id`, `mission_id?` | publish_draft success |
| `journey run_started` | `journey_version_id`, `run_id`, `surface=admin` | publish_mission success (existing event from ADR-0173) |

## Closed-loop verification

The dashboard joins:
- `journey_authoring phase_advanced` events grouped by `wizard_session_id` → progress %
- `journey_authoring journey_published` → completion count
- `journey run_started` (capability='journey.publish_mission') → mission count

If any phase advance fires without a paired save_draft, the closed loop
detects desync (phase counter advances in DB but no corresponding event).
