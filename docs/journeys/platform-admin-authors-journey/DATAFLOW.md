---
title: "Dataflow — platform-admin-authors-journey"
journey_id: platform-admin-authors-journey
created: 2026-04-29
updated: 2026-04-29
---

# DATAFLOW.md — tables + side-effects

## Read

| Table | Column subset | When | Purpose |
|---|---|---|---|
| `journey` | `code, title, slug, status, module, actor` | check_duplicates, lookup_journeys | Duplicate scan + sibling discovery |
| `journey_version` | `journey_version_id, ir_json, version_number, journey_id` | publish_mission | Source of IR for materialization |
| `wizard_session` | `draft_journey, current_phase, status, workspace_id` | publish_draft | Read fresh draft before transform |
| `engine_authority_config` | `level, min_role, capability` | gate_action RPC | Authority decision per mutation |
| `profile` | `profile_id, role, status` | actor resolution at BFF | Identity for ctx.profileId |

## Write

| Table | Operation | When | Field map |
|---|---|---|---|
| `wizard_session` | UPDATE | `save_draft` per phase | `draft_journey` (JSONB), `current_phase` (text) |
| `wizard_session` | UPDATE | `publish_draft` success | `status='completed'`, `completed_at=now()` |
| `journey` | INSERT | `publish_draft` | `workspace_id`, `slug`, `title`, `description`, `module`, `actor`, `platform`, `priority`, `status='ready_test'` |
| `journey_version` | INSERT | `publish_draft` | `workspace_id`, `journey_id`, `version_number=1`, `ir_json` (v2.1 IR), `status='ready_test'`, `created_by` |
| `engine_missions` | INSERT | `publish_mission` chained | `id=journey_<slug>_v1`, `name`, `description`, `mode`, `system_prompt`, `workspace_id`, `journey_id`, `is_active=false` |
| `engine_stages` | INSERT (N rows) | `publish_mission` chained | one row per IR step: `mission_id`, `stage_id`, `stage_order`, `goal`, `instructions`, `success_criteria`, `creative_freedom`, `is_required=true` |

## Audit

| Table | When | Why |
|---|---|---|
| `gate_evaluation` | per gatedMutation call | Audit chain per ADR-0099 |
| `activity_trail` | per emit() call | Cross-cut audit per ADR-0193 |
| `engine_event` | per emit() call (workflow events) | Workflow automation surface |

## Data shapes

### wizard_session.draft_journey (JSONB)

```json
{
  "title": "string",
  "trigger_description": "string",
  "module": "string (one of 18 modules)",
  "actor": "string (one of 6 actor enum)",
  "platform": "string (mobile|desktop|both)",
  "priority": "string (P0|P1|P2|P3)",
  "tags": ["string", ...],
  "steps": [
    {
      "title": "string",
      "action": "string",
      "expects": "string",
      "screen": "string",
      "component": "string"
    }
  ],
  "test_assertion": "string",
  "preconditions": ["string", ...],
  "doc_title": "string (Norwegian)",
  "outcomes_success": ["string", ...],
  "outcomes_empty": ["string", ...],
  "outcomes_error": ["string", ...]
}
```

### v2.1 JourneyIR (after publish_draft transform)

See `docs/engines/system-intelligence/06-ir-template.md` — canonical
template. publish_draft maps draft_journey → v2.1 IR with synthetic
step keys (`step.<slug>.<title-kebab>`) and bounded weights
(`1.0 / steps.length`).

## RLS posture

- `wizard_session` — workspace_id scoped; godmode-only writes (per
  authority config).
- `journey` + `journey_version` — workspace_id scoped; capability
  authority checked at publish_mission gate.
- `engine_missions` + `engine_stages` — workspace_id on missions, FK
  cascade on stages.
- `engine_authority_config` — read by gate_action RPC only; never
  written at runtime (ADR-0176).

## Side-effects outside this journey

- New `engine_missions` row available to stage-engine MISSION mode for
  runtime execution.
- Closed-loop dashboard surfaces the new journey in catalogue at
  `status=ready_test`.
- No emails, notifications, or external API calls are made by this
  journey. Pure in-system authoring.
