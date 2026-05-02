---
title: "engine_missions Schema vs MISSION.md Relationship"
id: ADR_0224
status: proposed
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0224: engine_missions Schema vs MISSION.md Relationship

## Context and Problem Statement

The 2026-04-28 doc consolidation introduced a `MISSION.md` schema with 7 fields not present as columns on the `engine_missions` table: `persona`, `opening_line` (en/no), `roadmap_id`, `voice` (object), `authority_required` (array), plus partial `stages[].success_criteria`. Code-trace (council 2026-04-28): stage-engine reads only `system_prompt + mode + is_active + journey_id` from `engine_missions`. MISSION.md additional fields would be silently dropped at runtime. ADR-0216 (`engine_state vs engine_sessions ontology`) is `proposed` — its outcome affects which runtime store reads what.

## Decision Drivers

- ADR-0173 capability count frozen at 4 (no new capabilities to read MISSION.md fields)
- ADR-0194 JourneyIR v2.1 → engine_missions hybrid mapping already accepted (mission_mode + system_prompt in IR root)
- ADR-0099 gate_action on every mutation: extending `engine_missions` columns requires migration + capability-side write path
- ADR-0216 `proposed` — engine_state vs engine_sessions ontology blocks any column extension that depends on stage-engine reading from a specific store
- L-0079 (this council): schema-touching specs must include grep evidence of what fields are actually read by code
- 2026-04-27 closure trust-gate: 2 of 4 capabilities kept end-to-end; adding write-only fields = phantom-consumer pattern (L-0146)

## Considered Options

1. **Option A — MISSION.md fields beyond `system_prompt + mode` are author-side documentation only.** Skill approve op generates them but runtime ignores. Document this explicitly. No DB migration. No new capability writes.
2. **Option B — Migrate `engine_missions` to add `persona`, `voice`, `authority_required`, `roadmap_id`, `opening_line` columns.** Extend `publishMissionTool` to write them. Extend stage-engine to read them. Forces ADR-0216 resolution first.
3. **Option C — Pack additional fields into existing `engine_missions.context_source` JSONB column.** No schema change. `publishMissionTool` writes JSON blob. Stage-engine reads from JSON.
4. **Option D — Drop the additional fields from MISSION.md spec.** Schema collapses to thin pointer to `engine_missions` row + `engine_stages` rows.

## Decision Outcome

Chosen option: **"Option A" — MISSION.md fields beyond `system_prompt + mode` are AUTHORING-ONLY DOCUMENTATION.**

**Amendment 2026-04-28** — ADR-0216 accepted Option B (stage-engine reads engine_state). Three-table boundary now canonical:

| Table | Role |
|---|---|
| `engine_missions` | Journey-mode mission registry. Static blueprint. 1 row per mission version. |
| `engine_state` + `engine_state_step` | Universal Event Engine runtime. 1 row per run instance. Used by 8 cascade domains. |
| `engine_sessions` | Voice/agent-session boundary. 1 row per chat/voice/telegram thread. |

Three tables, three roles, NO MERGE.

MISSION.md maps to `engine_missions` only — `journey_id`, `mode`, `system_prompt`, `is_active`. The other 7 fields (`persona`, `opening_line`, `voice`, `authority_required`, `roadmap_id`, plus stages) remain documentation-only. End-state Option D (drop fields from spec) deferred to future spec revision after MISSION.md authoring patterns prove out.

Original rationale held:
- ADR-0216 resolved (Option B) — engine_state stays canonical universal runtime, engine_missions stays journey-mode blueprint, engine_sessions stays voice/agent-session boundary
- MISSION.md additional fields guide the author / agent persona designer at write-time
- Runtime ignores them (stage-engine reads only existing engine_missions columns + engine_stages + journey + journey_step)
- Option C rejected — JSONB schema drift trap (ADR-0194)

This ADR explicitly **forbids** the approve op from writing these MISSION.md fields to DB. The op writes only the 4 columns the existing schema defines (id, name, description, mode, system_prompt, journey_id, workspace_id, is_active) via `publish_mission` capability — never directly.

## Rules & Consequences

- **Good, because** zero phantom consumer rows in `engine_missions` (every column has a reader today).
- **Good, because** ADR-0173 capability count + ADR-0194 hybrid mapping preserved.
- **Bad, because** authors writing rich MISSION.md (persona, opening_line) get no runtime feedback that those fields are decorative.
- **Bad, because** end-state decision (Option B vs Option D) is deferred to post-ADR-0216 — debt that must be revisited.
- **Agent Impact:** Skill `ops/04-approve.md` must call `publishMissionTool` (capability), not write `engine_missions` directly. Authors must read this ADR before adding fields to MISSION.md schema.

## References

- `packages/ai/src/capabilities/journey/tools.ts:461-509` (publishMissionTool — actual write path)
- `services/stage-engine/src/core/session-manager.ts:91,318` (actual read path)
- `supabase/migrations/20260301200000_engine_tables.sql:19-30` (engine_missions canonical schema)
- ADR-0173 (capability count frozen)
- ADR-0194 (JourneyIR v2.1 → engine_missions mapping)
- ADR-0216 (engine_state vs engine_sessions ontology — blocks column extension)
- ADR-0099 (gate_action on every mutation)
- L-0152 (engine_missions silent field-drop)
- L-0146 (phantom-consumer pattern)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
