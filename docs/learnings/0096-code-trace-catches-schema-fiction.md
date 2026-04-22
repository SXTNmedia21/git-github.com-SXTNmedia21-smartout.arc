---
title: "Code-trace catches schema-fiction that concept-review approves"
id: LEARNING_0096
status: canonical
layer: learning
created: 2026-04-21
updated: 2026-04-21
tags: [review-gate, code-trace, schema, agent-coordinator]
---

# Learning-0096: Code-trace catches schema-fiction that concept-review approves

## Context

Spec v1.6.0 referenced `engine_missions.plan` column and a `journey_version_id` FK on `engine_missions`. Neither exists:

- `engine_missions` is the actual table name (plural, migration `20260301200000_engine_tables.sql:19-30`) — spec said "mission-tabell" which made it read as the correct reference, but the column `plan` is not on the table.
- `journey_version_id` FK is nowhere in any migration.

Concept-review (steward, supervisor, frontend-designer) approved these claims because they read as plausibly correct. Only agent-coordinator, assigned the "trace the actual code path" mandate, caught the fiction by migration grep.

Recurring pattern — same failure mode as:

- 2026-04-19 Kanaler council: `gate_action` default-allow caught only by code-trace.
- 2026-04-17 Mobile Strategy: 6 mutation sites with broken emit payload caught only by code-trace.
- 2026-04-16 Web Perf: 3 concurrent write paths with authority divergence caught only by code-trace.

## Discovery

Concept-review reads specs against mental models. Mental models are frictionless — they do not reject plausible-sounding schema claims. Code-trace reads specs against SQL files. SQL files are unforgiving — a grep hit either exists or does not.

The Code-Tracer Mandate in run-council SKILL.md is the operational response to this pattern: every council touching DB, agent capabilities, or cross-system payloads assigns exactly one reviewer the "trace implementation" question. Without that assignment, schema-fiction survives review.

## Impact

- Reinforces Code-Tracer Mandate; councils that skip it for DB-touching topics produce unsafe verdicts.
- Post-implementation mode should ALWAYS assign Layer 2 (column-level payload trace) to a reviewer; optional in early-stage is fine, but mandatory in post-impl.
- Briefings should include full migration file paths, not abbreviated references ("mission-tabell") — abbreviations invite hallucination.
- Consider adding a briefing rule: every schema reference in a spec must cite the exact migration path + line number. No abbreviations.

## References

- ADR-0172 (journey_version_status enum) — resolves the enum fiction.
- L-0059 (grep-count briefings undercount without code-trace) — same review-layer insight.
- L-0062 (SECURITY DEFINER RPCs change threat model) — also found only by code-trace.
- run-council SKILL.md §Code-Tracer Mandate.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
