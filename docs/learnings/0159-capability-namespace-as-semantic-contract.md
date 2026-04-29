---
title: "Capability Namespace as Semantic Contract"
id: LEARNING_0159
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [agent-architecture, capabilities, intent-classifier, namespace, phantom-contracts, l-0149, adr-0221]
---

# Learning-0159: Capability Namespace as Semantic Contract

## Context

Council 2026-04-28 — Botsson voice + tool performance review.

The council's Phase 3 reviewers (system-agent-coordinator + botsson-harness-builder) independently traced the kb_query phantom-registration claim and discovered a deeper problem than ADR-0221 anticipated:

- `searchKnowledge` already exists at `packages/ai/src/capabilities/communication/tools.ts:285-376`.
- It correctly uses `AgentToolContext`, calls `match_workspace_docs` RPC, scopes by `ctx.workspaceId`.
- It is registered under the `communication` capability.

But the LLM intent classifier never selects `communication` for "what's the policy for X" — that intent maps to `knowledge`, which has no registered capability. So `searchKnowledge` is **live dead-code today** despite being a fully-functional tool.

ADR-0221 was drafted assuming "no AgentToolContext-compatible KB tool exists, register a new one." Phase 5 chair self-reversal corrected this: the tool exists, but lives in the wrong namespace.

## Discovery

**Capability namespace is not a folder — it is a binding contract that the LLM intent classifier reads.**

The path from user message to tool execution is:

1. User says message.
2. Intent classifier (LLM) selects `intent.capability` from a fixed enum.
3. Tool selector (deterministic) maps `intent.capability` → registered capability → tools list.
4. LLM (with selected tools) calls a tool.

If a tool's namespace doesn't match an intent the classifier emits for the user's vocabulary, the tool is invisible. Dead code by design.

This is a fourth shape of phantom contract (after L-0094 phantom emit, L-0124 phantom body, L-0146 phantom consumer, L-0149 phantom registration): **mis-namespaced tool**. The tool is real, registered, callable — but routed through an intent the LLM will never assign to the user's question.

The trap is subtle because:
- Mis-namespaced tools pass code review (they exist, they have tests, they're imported).
- They pass type-check (the namespace is a string in a union; both old and new namespaces compile).
- They pass integration test if tests directly invoke `capability.tools[0].execute()` rather than going through the agent-router.
- They fail only at runtime, silently, by being NEVER selected by the classifier.

## Impact

### Future capability authoring

Every new capability registration MUST include a "namespace verification" step:

1. Read `intent-classifier.ts` enum + system prompt block for the proposed namespace.
2. Verify the LLM would reasonably select this namespace for the user vocabulary the tool is meant to serve.
3. If the namespace's classifier description doesn't include the user-facing language for the tool's purpose, EITHER pick a different namespace OR update the classifier description in the same PR.

### Capability migration policy

When a tool is found to be mis-namespaced (as `searchKnowledge` was), the canonical fix is **migration**, not addition. Adding a new namespace + duplicating the tool creates two paths the classifier might pick — drift. Migration is single-source-of-truth.

### Council Phase 2.5 fact-check addition

Any briefing claim of the form "X capability does not exist" or "X tool does not exist" MUST be expanded by the fact-checker to ALSO grep for the underlying behavior across all capability namespaces. The "tool does not exist" claim is half a question — the full question is "tool does not exist AND no equivalent functionality lives in another namespace."

### Code-tracer mandate addition

When tracing a capability claim, the trace MUST include:
- `intent-classifier.ts` enum values that route to the namespace.
- `tool-selector.ts` mapping for the relevant intent.
- All `packages/ai/src/capabilities/*/tools.ts` files (grep for the verb the tool implements — `search`, `create`, `update`, etc.) to detect duplicates or mis-placements.

## References

- Council 2026-04-28 — System Council Botsson voice + tool perf
- ADR-0221 (amended 2026-04-28) — Knowledge capability migration + registration merge gate
- L-0094 — Phantom emit anti-pattern (1st phantom-contract shape)
- L-0124 — Phantom body anti-pattern (2nd shape)
- L-0146 — Phantom consumer pattern (3rd shape)
- L-0149 — Phantom registration in Q&A specs (which led to this council)
- `packages/ai/src/capabilities/communication/tools.ts:285-376` — `searchKnowledge` (mis-namespaced)
- `packages/ai/src/router/intent-classifier.ts` — enum + system prompt that drive selection
- `packages/ai/src/router/tool-selector.ts:101-122` — namespace → tools mapping
- `packages/ai/src/capabilities/registry.ts` — capability registration site
