---
title: "Phantom-tool pattern — spec references tools by name without verifying existence"
id: LEARNING_0207
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [council, capability, tool-registry, fact-check, phantom-contract]
---

# Learning-0207: Phantom-tool pattern — capability/tool reviewers must grep registry as Phase 0

## Context

Welcome Mission V0 spec (`IMPLEMENTATION_SPEC_welcome_mission_v0.md` 2026-05-04) referenced 4 tools in `engine_stages.tool_allowlist` per stage:

- `note_inquiry` (claimed new in `inquiry` capability — capability did not exist)
- `transition_to_other_mission` (claimed in `mission` capability — capability exists, tool missing)
- `point_at_setting` (claimed in `ui` capability — capability exists, tool missing)
- `show_demo` (claimed in `ui` capability — capability exists, tool missing)

`navigate_to` was the only tool in the spec's allowlists that actually existed.

Botsson-harness-builder self-reported the gap correctly in OQ-9 + OQ-10 ("tools missing"). But the implementation order in §4 placed tool creation AFTER the seed migration that references them. Stage 1 of the welcome mission would seed `tool_allowlist=['transition_to_other_mission', 'note_inquiry']` before either tool was implemented. Tool-selector would silently filter to empty allowlist → mission would have zero tools → degrade to LLM-without-capabilities.

## Discovery

**The pattern:**

- Spec author imagines tool semantics via design-doc text ("agenten kan switche mission")
- Spec lists tool by name in JSON/SQL/TypeScript reference
- Spec author defers verification ("OQ — does this tool exist?")
- Implementation order treats the OQ as a footnote, not a prerequisite
- Seed migration refers to non-existent tools by name string
- At runtime, tool-selector filters by name match → empty result → silent zero-tools state

**Why it confuses reviewers:**

- Per-tool ADR-0078/0204 compliance table (per L-0175 / L-0176 hard rule) catches "did you verify the body has gate_action" — but does NOT catch "does this tool exist at all"
- Phase 3 review focuses on tool-body verification, not tool-existence verification
- "Tool" is a string — easy to spell, hard to verify without grep against capability registry

## Impact

**Promote to Council Phase 0 hard rule (in addition to L-0175 + L-0176):**

1. **Phase 0 fact-check addendum:** for ANY spec referencing tools by name (capability tool, page tool, harness tool, voice tool), grep the capability registry first:
   ```bash
   grep -rn "name: ['\"]<tool-name>['\"]" packages/ai/src/capabilities/
   grep -rn "<tool_name>:" packages/ai/src/capabilities/<capability>/tools.ts
   ```

2. **Tool-existence assertion in spec format:** every tool reference in spec must include either (a) file:line citation to existing tool body, OR (b) explicit "TO BE IMPLEMENTED — Phase 0 prerequisite" tag with deliverable plan.

3. **Implementation order prerequisite:** any seed migration that references tool name strings MUST come AFTER the tool's implementation step in the order list. Reviewer must verify dependency arrows, not just numbered steps.

4. **Promote to ADR-0173 / ADR-0228 (capability classification) addendum:** tool-allowlist columns referencing tool names need either FK constraint to a tool registry table, OR build-time check that all referenced names exist in the capability registry TypeScript definitions.

## Recovery action for Welcome Mission V0

The 4 phantom tools become Phase 0 prerequisites:

| Tool | Capability | Phase 0 deliverable |
|---|---|---|
| `note_inquiry` | NEW `inquiry` capability | Build capability + tool body + authority seed BEFORE M6 seed |
| `transition_to_other_mission` | Existing `mission` | Add tool to existing `mission/tools.ts` BEFORE M6 seed |
| `point_at_setting` | Existing `ui` | Add tool to existing `ui/tools.ts` BEFORE M6 seed |
| `show_demo` | Existing `ui` | Add tool to existing `ui/tools.ts` BEFORE M6 seed |

Each tool gets per-tool compliance row (gate_action / gatedMutation / emit() / channel) before registration.

## References

- L-0175: Per-tool compliance table mandatory for capabilities with ≥2 tools
- L-0176: Docstring claims about ADR compliance are CLAIMS, not evidence
- L-0177: Silent fallback patterns (forgeable IDs, missing config)
- ADR-0173: Capability classification framework
- ADR-0228: Frozen-4-namespace boundary
- Council session 2026-05-04 Welcome Mission V0 — Phase 5 §3 Trust Gate FAIL
