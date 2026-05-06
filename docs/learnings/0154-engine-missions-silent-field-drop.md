---
title: "engine_missions Silent Field-Drop (schema-vs-DB drift)"
id: LEARNING_0154
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [phantom-consumer, silent-drop, engine-missions, mission-md, council]
---

# Learning-0154: engine_missions Silent Field-Drop

## Context

2026-04-28 council on journey-engine doc consolidation — Agent-Coordinator + Harness Builder both code-traced the proposed `MISSION.md` schema (`docs/engines/system-intelligence/05-protocol-pipeline.md` §3.2) against the actual `engine_missions` table.

`MISSION.md` schema declared 9 fields:
- `mission_id`, `journey_id`, `mode` (✓ match DB columns)
- `roadmap_id`, `persona`, `opening_line.en`, `opening_line.no`, `voice.enabled`, `authority_required[]` (✗ NO DB column)
- `stages[]` with `goal` + `success_criteria` (lives in `engine_stages` table, not `engine_missions`)

Stage-engine reads (verified: `services/stage-engine/src/core/session-manager.ts:91,318`): only `system_prompt + mode + is_active + journey_id` from `engine_missions` row. Persona resolved from `context.persona_prompt` set by Ultravox adapter (not from `engine_missions`). Voice flag, authority_required, opening_line — never read.

`publishMissionTool` (`packages/ai/src/capabilities/journey/tools.ts:461-509`) writes ONLY DB-existing columns (`id`, `name`, `description`, `mode`, `system_prompt`, `workspace_id`, `journey_id`, `is_active`). Spec's other fields would be silently dropped at publish time.

Net effect: an author writing rich `MISSION.md` (`persona: lise`, `opening_line: "Hei!"`, `voice.enabled: false`) would see ZERO runtime effect from those fields. The mission would behave identically to a minimal MISSION.md with only `system_prompt + mode`.

## Discovery

Schema drift between docs and DB has a specific failure mode beyond classic drift: **silent field-drop**. Author writes spec, runtime ignores extra fields. No error, no warning, no log line. The author reasonably assumes the spec defines reality. Reality defined by the columns that exist + the code paths that read them.

Pattern signature:
- Spec defines schema with N fields
- DB schema has subset M < N of those fields as columns
- Capability/runtime reads subset K ≤ M of those columns
- Author has not greped capability code for which columns are read
- Spec ships with N-K silent-drop fields

Distinct from "phantom emit" (writer without reader) and "phantom consumer" (reader without writer): this is **phantom column** — spec writes, DB stores nothing, runtime reads nothing.

The author's mental model is "fill the spec, runtime executes the spec." Reality is "spec is documentation; runtime reads the columns that exist."

## Impact

**Process change:** schema-touching specs MUST include grep evidence of what fields are actually read by code. Specifically, when proposing a schema for an existing table:

```bash
git grep "<table_name>\." packages/ services/ apps/ | grep -v test | grep -v "\.md"
```

Author lists every field reference found. Spec marks each new schema field as one of:
- **(reads)** field maps to existing column AND existing reader
- **(writes)** field maps to existing column, new reader needed
- **(documentation-only)** field has no DB column, no runtime effect (banner required)
- **(future)** field requires new migration AND new capability write path AND new reader

**Author guidance:** before adding a field to a schema for an existing table, run the grep above. If field is "documentation-only", the spec must say so explicitly with a banner — NOT bury the discovery in §"Open questions" or footnote.

**Council reviewer guidance:** when reviewing a spec proposing schema for an existing table, ask "for each field, where in code is the reader?" If a reviewer can't enumerate readers, the spec needs an L4 capability-consumer trace before approval.

**Existing technical debt:** The 7 silent-drop fields in current MISSION.md spec are now marked as authoring-only documentation per ADR-0224 (Option A). End-state decision (Option B migrate columns vs Option D drop fields) deferred to post-ADR-0216.

## References

- ADR-0224 (engine_missions Schema vs MISSION.md Relationship)
- ADR-0194 (JourneyIR v2.1 → engine_missions hybrid mapping)
- ADR-0173 (capability count frozen at 4)
- ADR-0099 (gate_action on every mutation)
- ADR-0216 (engine_state vs engine_sessions ontology — proposed)
- L-0146 (phantom-consumer pattern, symmetric to this)
- L-0094 (phantom-emit pattern)
- Council 2026-04-28 (`docs/council/COUNCIL-LOG.md`)

---
