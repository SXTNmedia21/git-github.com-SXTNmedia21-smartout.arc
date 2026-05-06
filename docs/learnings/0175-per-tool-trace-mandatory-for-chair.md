---
title: "Chair Phase 3 Must Trace Each Tool Independently in Multi-Tool Capabilities"
id: LEARNING_0175
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [council, chair-self-reversal, capability, code-trace, adr-0204]
---

# Learning-0175: Chair Phase 3 Must Trace Each Tool Independently in Multi-Tool Capabilities

## Context

Council R1 (2026-04-29) on Botsson on Platform Admin reviewed the journey_authoring capability (4 tools: save_draft, check_duplicates, lookup_journeys, publish_draft). Chair Phase 3 wrote "ADR-0099 chain present" and Trust Gate PASS, generalizing from save_draft compliance to all four tools. Phase 3 reviewers agent-coord + botsson-harness-builder both code-traced publish_draft independently and found `tools.ts:443-481` executes three direct Supabase writes outside `gatedMutation` — ADR-0204 violation, ADR-0099 audit gap, ADR-0134 emit gap. Two reviewers, opposite verdict, file:line evidence. Chair self-reversal triggered per L-0147 hard rule.

## Discovery

When a capability bundles N tools, "ADR-X compliance" is N independent claims, not one. Chair Phase 3 produced ONE paragraph for the whole capability when N=4 tools required N rows in a tool-by-tool table. The single-paragraph format silently averaged compliant + non-compliant tools into a misleading PASS verdict.

The shape of the bug:
- Tool 1 (save_draft): PASS — uses gatedMutation
- Tool 2 (check_duplicates): PASS — read-only
- Tool 3 (lookup_journeys): PASS — read-only
- Tool 4 (publish_draft): FAIL — direct writes outside gatedMutation

Chair generalized "uses gatedMutation" from Tool 1 → all four. False generalization. Code-tracers caught it because they walked each tool's body, not each tool's docstring.

## Impact

1. **Run-Council SKILL.md Phase 3 addition (proposed):** when a capability has ≥2 tools, Chair Phase 3 MUST produce a per-tool gate/emit/mutation table, not a paragraph. Each tool gets its own row with explicit gatedMutation status, emit status, and mutation pathway.
2. **Trust Gate refinement:** Trust Gate verdicts on capabilities-with-multiple-tools must be expressed per-tool. "Trust Gate PASS for save_draft, FAIL for publish_draft" is the canonical form. "Trust Gate PASS for journey_authoring" is wrong shape — silently averages.
3. **Pattern signature:** any time a Phase 3 review writes "the capability X complies with ADR-Y" without enumerating tools, that is a false-generalization smell. Two code-tracers vs one Chair Phase 3 sentence is the asymmetry that caught it here.

## References

- ADR-0099 — gate_action audit chain
- ADR-0173 — journey capability frozen-4
- ADR-0204 — gatedMutation canonical mutation primitive
- ADR-0240 — journey-authoring tool boundary (this council outcome, was ADR-0237 pre-merge)
- L-0147 — Chair Self-Reversal Protocol (hard rule)
- L-0166 — journey/tools.ts has 7 direct writes bypassing both gates (sibling pattern)
- L-0176 — docstring claims ≠ evidence (this council)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
