---
title: "Briefing granularity mismatch — per-tool vs per-capability authority"
id: LEARNING_0102
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [councils, briefings, schema-verification, authority, engine_authority_config, phase-2-5]
---

# Learning-0102: Briefing granularity mismatch — per-tool vs per-capability authority

## Context

Council Gate 1 for the contract-hub-redesign feature (2026-04-22) verified the `engine_authority_config` seed for the new contract capability. The synthesis briefing — generated from Council Phase 5 notes — instructed Phase 1's build agent to "seed 3 rows for 3 tools" on `engine_authority_config`.

When the build agent went to write the INSERT statements it discovered the schema's unique constraint is `UNIQUE(workspace_id, capability)` — not `UNIQUE(workspace_id, capability, tool)`. Per-tool rows are architecturally impossible without a schema change. The agent correctly deviated from the briefing and seeded one row per workspace covering all 8 contract-capability tools via a single `capability='contract'` row.

The briefing's "3 rows for 3 tools" phrasing carried an implicit granularity assumption — that authority could be differentiated per tool inside a capability. That assumption didn't match the row shape in `database.types.ts`.

## Discovery

Briefings generated from synthesis conversations inherit the linguistic granularity of the discussion, not the schema's row shape. When a council debates "which tools get confirm-level vs which get autonomous," the synthesis naturally produces per-tool language. But if the underlying table keys on `(workspace_id, capability)`, that per-tool language becomes phantom specificity the schema cannot honor.

Three failure modes when the build agent blindly follows a briefing with mismatched granularity:

1. **Stall** — agent hits the `UNIQUE` violation on row 2 of the INSERT and halts waiting for clarification, blocking the phase.
2. **Silent workaround** — agent invents an upsert key that sidesteps the constraint (e.g. `(workspace_id, capability, tool_name)` bodged together), silently changing the authorization semantics in a way no reviewer authorized.
3. **Skip and ship** — agent seeds only the first tool and moves on, leaving the other two tools unauthorized; `gate_action` then defaults (either deny-all or allow-all depending on ADR-0091 branch), poisoning C4.

All three are detectable by running the generated SQL against `database.types.ts` BEFORE the build agent reads the briefing.

## Impact

**Phase 2.5 fact-check additions:**

- For every capability-authority claim in a briefing, verify the granularity against the Row/Insert shape in `database.types.ts`. If the briefing says "seed N rows for N tools" but `UNIQUE` is `(workspace_id, capability)`, flag as a granularity mismatch before briefing approval.
- For every "3 rows" / "N rows" / "per-tool" / "per-action" phrase in a synthesis briefing, grep the target table's unique constraints in `supabase/migrations/**` and cross-check against the Row type.

**Build-agent briefing discipline:**

- When a build agent deviates from a briefing because schema reality contradicts it, treat the deviation as CORRECT BEHAVIOR — not rework. Flag the deviation back to the council chair so the briefing is corrected before the next build phase uses it.
- Build agents should log deviations inline in the PR commit message: `BRIEFING DEVIATION: briefing said X; schema requires Y; shipped Y.` This makes the deviation auditable without requiring the next reviewer to re-derive why.

**Pattern generalization beyond authority config:**

This applies to any table where briefings describe logical granularity finer than schema granularity. Candidates:

- `engine_authority_config` — per-tool briefing vs per-capability schema (this occurrence).
- `channel_ai_policy` — per-message briefing vs per-channel schema (watch for this).
- `workspace_kpi_target` — per-site briefing vs per-workspace schema.
- Any Zod schema where the briefing hints at richer typed variants than the union encodes.

## References

- ADR-0099 — `gate_action` unified authority evaluation (central check per capability).
- ADR-0091 — `gate_action` dual-gate mechanism (informs default-allow/deny branch behavior).
- ADR-0183 — `industry_intelligence` capability (proposed; same granularity question applies).
- L-0066 — `gate_action` default-allow CVE-class side-finding (permissive default when capability unseeded).
- L-0097 — C4 authority defaults are not free (2nd occurrence of the general authority-defaults trap).
- L-0103 — per-capability vs inline `gate_action` (companion learning — when inline checks are needed).
- Council Gate 1 (2026-04-22) — contract-hub-redesign, Phase 5 briefing review.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
