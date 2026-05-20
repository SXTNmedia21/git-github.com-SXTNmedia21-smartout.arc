---
title: "Tool naming convention — bare names, NOT dot-prefixed"
id: LEARNING_0307
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [capability, tool-name, convention, ai-sdk, spec-discipline]
---

# Learning-0307: Tool naming convention — bare names, NOT dot-prefixed

## Context

Council Phase 3 review of ADR-0367 + spec v1.1 (Day Line Area-Anchored Runtime, 2026-05-18). Supervisor C1 flagged that spec §5.1 declared `name: "day_line.create"` on the proposed `defineTool({...})` invocation. Code-trace verification against the canonical pattern showed every shipping capability uses BARE tool names without capability prefix.

## Discovery

The `defineTool({...})` shape at `packages/ai/src/types.ts:11-37` separates two concerns:
- `capability: string` — the namespace key (e.g. `"task"`, `"day-line"`, `"timeline-template"`)
- `name: string` — the bare action name (e.g. `"create_session"`, `"create"`, `"add_item"`)

Verified across 5 shipping capabilities:
- `packages/ai/src/capabilities/task/tools.ts:110,279,361,530,638,840` — bare names: `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal`
- `packages/ai/src/capabilities/schedule/tools.ts:34-386` — bare names
- `packages/ai/src/capabilities/shift-lifecycle/tools.ts:571` — `clockInCheck`
- `packages/ai/src/capabilities/timeline-template/tools.ts` — bare names

The dot-prefix appears ONLY in:
- Telemetry event payload (e.g. `"task.added_manual"` at `registry.ts:1178`)
- Capability registry key (e.g. capability name `"task"` in `registry.ts:144-146`)
- Engine authority config `(capability, action_type)` tuple

Spec authors writing dot-prefixed `name:` fields create a convention violation that lands in `tools.ts` as a quick-find-and-fix mechanical drift — but if it lands at all, it propagates through every reference (chat-tool-resolver, intent classifier, registry).

## Impact

Spec template addition: before declaring tool `name:` in any spec, grep the convention from at least 2 shipping capability `tools.ts` files. Bare names are canonical.

Future spec discipline (added to Phase 2.5 fact-check pre-flight per run-council skill):
- For any spec proposing new `defineTool({...})` invocations, fact-check verifies `name:` field uses bare convention by greping `packages/ai/src/capabilities/*/tools.ts` for the pattern.

ADR-0367 amended in v1.1 → v1.2: tool names rewritten from `day_line.create` → `create`, `day_line.add_item` → `add_item`, `day_line.instantiate_template` → `instantiate_template`. Capability namespace `day-line/` (folder) and `"day-line"` (capability key) remain dot-aware via hyphen folder + key form.

## References

- Council Phase 3 supervisor review (2026-05-18)
- ADR-0367 v1.2 amendment
- `packages/ai/src/types.ts:11-37` (defineTool shape)
- `packages/ai/src/capabilities/task/tools.ts:110,279,361,530,638,840` (bare-name precedent)
