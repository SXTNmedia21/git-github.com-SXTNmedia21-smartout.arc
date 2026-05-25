---
id: L-0351
title: Naming collision risk — timeline_template.apply_template vs schedule.apply_week_template
status: published
date: 2026-05-25
related: [L-0147 (chair self-reversal), ADR-0173, ADR-0240, ADR-0417]
tags: [naming, capability, schedule, timeline_template, intent-classifier, collision]
---

# L-0351 — Same verb, different table family

## What happened

Council 2026-05-25 gap analysis. Harness specialist flagged: gaps 3+4 (`schedule.list_templates` + `schedule.apply_template`) "already exist in `timeline_template` capability". Supervisor counter-flagged: `timeline_template.apply_template` writes day-level tables (`department_session`, `session_hook`, `session_task`, `session_note`, `deviation`) NOT week-level shift skeleton (`schedule_template`, `schedule_template_shift`).

Both right in their scope. Same verb (`apply_template`), different table family:

| Capability | Tool | Writes to | Domain | Purpose |
|---|---|---|---|---|
| `timeline_template` | `apply_template` (`tools.ts:748`) | `department_session`, `session_hook`, `session_task`, `session_note`, `deviation` | day-session (D6 dagskanvas) | apply a day-template to a specific date |
| `schedule` (PROPOSED) | `apply_week_template` (gap 4) | `schedule_template`, `schedule_template_shift`, `schedule_shift` (via change_proposal) | scheduling (D6 ukeplan) | apply a week-shift-skeleton template to a date range |

If the proposed tool ships as `schedule.apply_template`, intent classifier routes ambiguously: user says "bruk mal" and LLM cannot disambiguate which capability. Tool-name collision is structurally undetectable until runtime misroute.

## Why it matters

L-0147 protocol caught this collision via 3-reviewer disagreement (harness vs supervisor). Without code-trace verification of BOTH capabilities' actual table writes, council would have approved gap 4 as "already exists" (wrong) or as "schedule.apply_template" (collision).

Per ADR-0173 capability ownership: each tool name should be unique enough to route deterministically. ADR-0240 frozen-4 doesn't help here — both capabilities are non-frozen.

## Class

**Same-verb-different-target** — pattern shows up whenever multiple capabilities operate on conceptually-similar but tablely-distinct entities. Sibling: ANY two capabilities with `create_*`, `update_*`, `apply_*`, `publish_*` against different table families.

## Fix

**MANDATORY renames before implementation:**
- `schedule.list_templates` → `schedule.list_week_templates`
- `schedule.apply_template` → `schedule.apply_week_template`

Disambiguating prefix (`week_`) forces intent classifier to pick correct capability via prose. Update `packages/ai/src/router/intent-classifier.ts:166,186,195` with explicit prose: "Ukeplan-mal (week shift skeleton): `schedule.apply_week_template`. Dagskanvas-mal (day session canvas): `timeline_template.apply_template`."

## Prevention rule

Phase 2.5 briefing fact-check (enforces ADR-prose-vs-code per L-0297, schema-vs-code per L-0348): add **capability-tool-naming-collision** check. For every PROPOSED tool name in a brief, grep all existing capabilities for the same verb (`apply_*`, `create_*`, etc.). If hit found in different capability with different table targets → require disambiguating prefix in council Phase 3 before approval.

Verification command:
```bash
# For proposed tool name X
grep -rn "name: \"$X\"" packages/ai/src/capabilities/ | head
# If hits across multiple capabilities targeting different tables → rename
```

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- `packages/ai/src/capabilities/timeline-template/tools.ts:277,326,333,371,404,438,748` (day-level writes)
- `packages/ai/src/capabilities/schedule/_hooks/use-templates.ts:34,52,177,244` (week-level UI consumer)
- `supabase/migrations/20260301600003_schedule_persistence_tables.sql:97` (schedule_template definition)
- ADR-0417 (template_apply as change_proposal kind)
- ADR-0173 (capability ownership)
