---
title: "Authority + policy — Platform admin authors a new journey"
journey_id: platform-admin-authors-journey
capabilities: [journey_authoring, journey.publish_mission, journey.publish_guide]
allowed_channels: [chat]
created: 2026-04-29
updated: 2026-04-29
---

# License — Platform admin authors a new journey via the wizard

## Capabilities required

| Capability | Frozen-4? | Tools used | When |
|---|---|---|---|
| `journey_authoring` | No (new — ADR-0226) | save_draft, check_duplicates, lookup_journeys, publish_draft | All 6 phases |
| `journey.publish_mission` | Yes (ADR-0173) | publish_mission | Phase 6 chain after publish_draft |
| `journey.publish_guide` | Yes (ADR-0173) | publish_guide | Optional follow-up, not in this journey's main path |

## Authority levels (engine_authority_config)

| Role | journey_authoring | journey.publish_mission | journey.publish_guide |
|---|---|---|---|
| owner | `autonomous` | `autonomous` (frozen-4 default) | `autonomous` (frozen-4 default) |
| admin | `autonomous` | `autonomous` | `autonomous` |
| manager | `disabled` | `disabled` | `disabled` |
| employee | `disabled` | `disabled` | `disabled` |
| trainee | `disabled` | `disabled` | `disabled` |
| all | n/a | n/a | n/a |

Seeded by:
- `supabase/migrations/20260519100002_seed_journey_authoring_authority.sql` — journey_authoring
- `supabase/migrations/20260516000400_journey_authority_seed.sql` — journey.publish_mission, journey.publish_guide (ADR-0173)

## Channel restrictions

| Capability | Allowed channels | Source |
|---|---|---|
| journey_authoring | chat | ADR-0078 + capability `allowedChannels` |
| journey.publish_mission | chat | ADR-0078 + capability `allowedChannels` |
| journey.publish_guide | chat | ADR-0078 |

Voice is forbidden for spec authoring + mission publishing. The wizard
is web-only per ADR-0133 ("web composes, mobile executes"); mobile
clients cannot reach this surface.

## Gate enforcement

Every mutation in this journey routes through `gatedMutation()` (ADR-0204):

1. **Pathway A — `gate_action` RPC** evaluates `engine_authority_config`
   per (workspace, capability, role). Result: `allow=true|false`.
2. **Pathway B — `cascade_gate_write`** evaluates framework-rule policy
   diffs (currently a no-op for journey_authoring; reserved for future
   data-rule guards).
3. Audit row written to `gate_evaluation` per call. ADR-0099.

## What's NOT in this license

- `engine_authority_config` mutations are out of scope here (ADR-0176 —
  authority is migration-only at the platform level; runtime never
  inserts).
- Activation (`engine_missions.is_active=true`) is out of scope — handled
  by the separate enrichment + activate flow per ADR-0194.

## Failure modes

| Code | Meaning | User-facing |
|---|---|---|
| `authority_denied` | gate_action returned allow=false | Wizard surfaces "Du har ikke tilgang til journey-authoring" |
| `validation_failed` | Draft missing required fields at publish_draft | Wizard reports missing keys, asks user to revisit phase |
| `insert_failed` | journey or journey_version insert failed | Wizard surfaces DB error; rolls back partial inserts |
| `not_found` | wizard_session not found / wrong workspace | Wizard surfaces 404, asks user to start a new session |
| `missing_context` | wizardSessionId not threaded by BFF | Indicates pipe regression; surface as bug |
