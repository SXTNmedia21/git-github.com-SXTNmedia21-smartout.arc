---
title: "Knowledge Capability Migration + Registration Merge Gate"
id: ADR_0221
status: proposed
layer: decision
created: 2026-04-28
updated: 2026-04-28
amended: 2026-04-28
---

# ADR-0221: Knowledge Capability Migration + Registration Merge Gate

> **AMENDMENT 2026-04-28 (System Council voice + tool perf):** Original
> ADR proposed a NEW `kb_query` capability. Phase 5 chair self-reversal
> after Agent-Coord + Harness code-trace (per L-0147): the tool already
> exists at `packages/ai/src/capabilities/communication/tools.ts:285-376`
> as `searchKnowledge` with correct `AgentToolContext` + `match_workspace_docs`
> RPC. The bug is namespace + binding, not absence. Revised scope:
> migrate `searchKnowledge` → new `knowledge/` capability namespace
> + bind `intent='knowledge'` in `tool-selector.ts`. NO new `kb_query`
> capability. Merge-gate rule (4-item PR-description requirement)
> stands. See L-0159 for namespace-as-semantic-contract learning.

## Context and Problem Statement

`searchWorkspaceDocs` exists in code at `packages/ai/src/tools/workspace-docs.ts:71` but is unregistered to any capability. **CORRECTION (Council 2026-04-28):** an *AgentToolContext-compatible* equivalent already exists at `packages/ai/src/capabilities/communication/tools.ts:285-376` as `searchKnowledge`, calling `match_workspace_docs` RPC, scoped by `ctx.workspaceId`. It is registered under the `communication` capability — but the LLM never picks `communication` for "what's the policy" queries, so the tool is **live dead-code**. `tool-selector.ts:106-115` returns `[]` for `intent='knowledge'`, with an inline comment "answered from system prompt context" (per ADR-0073). This means any UI surface saying "ask Botsson about your handbook" silently falls through to a system-prompt-only response — no document retrieval happens.

The /dashboard/help v1 spec puts a Botsson chat hero as Tier 1, with implicit promise that the chat answers KB questions. Without a registered `kb_query` capability bound to `searchWorkspaceDocs`, this promise is a phantom contract (per ADR-0197).

This ADR establishes a general rule: **a capability tool's existence in code does not mean it is reachable.** Any UI claim that depends on a tool being callable must verify the tool is registered, bound, and reachable through the agent-router's intent classification before merge.

## Decision Drivers

- ADR-0197 phantom contract anti-pattern: making promises the data pipeline cannot keep.
- L-0094 (phantom emit), L-0124 (phantom body), L-0146 (phantom consumer): three prior phantom-contract shapes already documented. This is a fourth shape: phantom registration.
- Pontus's "100% trygghet" intent for /help cannot survive a chat hero that silently fails to retrieve documents.
- Future capability work (training, billing_query expansion, etc.) follows the same pattern: tool exists → must be wired → UI surfaces it. The pattern needs a named gate.

## Considered Options

1. **Trust developer discipline** — assume "tool exists in repo" implies "tool is reachable". Today's behavior. Has produced one phantom-registration instance and could produce more.
2. **Lint rule** — TypeScript-level check that every export from `packages/ai/src/tools/` is referenced from `packages/ai/src/capabilities/*/tools.ts`. Catches unregistered tools mechanically.
3. **Merge-gate ADR + manual verification** — require any UI claim depending on a tool to cite a verifying integration test in the PR description. Pre-merge code-trace verifies `tool-selector.ts` reaches the tool for the relevant intent.

## Decision Outcome

Chosen option: **Option 3 — merge-gate ADR with manual verification**, layered with eventual Option 2 (lint rule) as future hardening.

### Implementation scope (post-amendment)

**Knowledge capability migration (Week 1, ~1 day):**

1. Create `packages/ai/src/capabilities/knowledge/index.ts` — `knowledgeCapability` export with `allowedChannels: ["chat", "voice"]`, `defaultAuthority: "read_only"`, `toolAuthPattern: "direct_admin"`, `emitPrefix: "knowledge"`.
2. Move `searchKnowledge` from `packages/ai/src/capabilities/communication/tools.ts:285-376` → `packages/ai/src/capabilities/knowledge/tools.ts`. Drop from `communication`'s tool list.
3. Register in `packages/ai/src/capabilities/registry.ts` (alphabetical `k` slot). Update `CapabilityName` union in `types.ts` to add `"knowledge"`.
4. Update `intent-classifier.ts:140` system-prompt block to clarify `knowledge` vs `helpdesk_query` vs `training` routing.
5. Authority seed migration: `INSERT engine_authority_config (workspace_id, capability='knowledge', level='read_only')` `ON CONFLICT DO NOTHING` per workspace.
6. Integration test: `agent-router → intent='knowledge' → knowledge capability → searchKnowledge → result with citations`.

**No new `kb_query` capability.** The original ADR proposal was based on the false premise that no AgentToolContext-compatible tool existed. It does (`searchKnowledge`). Migration preserves the work; new-capability-creation would duplicate it.

Manual verification gate (immediate):

- Any PR touching `apps/web/src/app/dashboard/help/` (or any UI claiming "Botsson can answer X") MUST include in the PR description:
  1. The capability name expected to be invoked.
  2. The intent classifier label that routes to it (`packages/ai/src/router/intent-classifier.ts`).
  3. A `file:line` citation showing the capability is registered in `packages/ai/src/capabilities/registry.ts`.
  4. An integration test path that exercises `agent-router → tool-selector → capability tool → response`.
- Code-review (or a council fact-check pass) verifies the four items before approval.
- If any item is missing, PR is blocked.

Lint rule (future hardening, deferred to v2 if signal warrants):

- ESLint rule that fails on any export from `packages/ai/src/tools/*.ts` not imported by at least one `packages/ai/src/capabilities/*/tools.ts` file.
- Mechanical, no runtime cost, catches drift over time.

## Rules & Consequences

- **Good, because** prevents the phantom-registration shape of phantom contract before it ships.
- **Good, because** generalizes — applies to any capability tool, not just KB.
- **Good, because** the four-item PR-description requirement is cheap to write and rich in audit signal.
- **Bad, because** adds bureaucratic overhead to capability-touching PRs. Trade-off is acceptable given prior cost of phantom contracts (4 occurrences across L-0094 / L-0124 / L-0146 / this).
- **Bad, because** manual verification is not enforceable mechanically until the lint rule lands.
- **Agent Impact:**
  - `botsson-harness-builder` and `system-agent-coordinator` agents updated: when reviewing PRs touching capabilities, REQUIRE the four-item PR description.
  - `close-feature.sh` checklist gains "capability registration audit" item: list any newly-imported `packages/ai/src/tools/` exports + their capability binding citations.
  - `run-council` SKILL.md Phase 2.5 fact-check gains "capability reachability check" for any briefing claim like "Botsson can answer/do X".

## References

- Council 2026-04-28 (System Council, 5 reviewers)
- ADR-0073 — agent-router as orchestrator
- ADR-0197 — Phantom contracts class rule
- L-0094 — Phantom emit anti-pattern
- L-0124 — Phantom body anti-pattern
- L-0146 — Phantom consumer pattern
- L-0149 — Phantom contracts in Q&A specs (this council)
- system-agent-coordinator Phase 3 finding: `searchWorkspaceDocs` unregistered, `tool-selector.ts:106-115` empty fallthrough
