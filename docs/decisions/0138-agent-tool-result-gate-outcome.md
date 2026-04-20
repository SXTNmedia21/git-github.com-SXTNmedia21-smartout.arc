---
title: "Agent Tool Result Contract with Gate Outcomes"
id: ADR_0138
status: draft
layer: decision
created: 2026-04-18
updated: 2026-04-18
module: ai
tags: [adr, agents, capabilities, tool-result, gate-outcome, llm-contract, botsson, emma, walkai, wave-2b]
---

# ADR-0138: Agent Tool Result Contract with Gate Outcomes

## Context and Problem Statement

Capability tools in `packages/ai/src/capabilities/*/tools.ts` today return arbitrary JSON strings that the LLM consumes as free-form text. This worked when every tool had binary outcomes ("wrote the row" / "threw an error"), but `cascade_gate_write` (ADR-0091) now produces a four-way outcome — `applied`, `applied_with_exception`, `proposed`, `blocked` — and the current tool-result shape cannot represent them.

Concretely: a capability tool that calls `gatedUpdate(schedule_shift, {...})` and receives `{ outcome: 'proposed', proposal_id: '…' }` from the RPC today has three unsatisfactory options:

1. **Lie to the LLM.** Return `{ success: true, message: "shift published" }` on a `proposed` outcome. The LLM tells the user "Vakten er publisert" — but the write never happened, a `change_proposal` is sitting in the queue, and the user has no idea approval is required.
2. **Throw on non-applied outcomes.** The tool raises, the LLM sees an error, and the user gets a generic "Noe gikk galt" — no signal that this is a pending-approval flow, not a failure.
3. **Return ad-hoc JSON.** Some tools return `{ proposal_id }`, others return `{ status: 'pending' }`, others return a stringified enum. The LLM has no consistent contract to pattern-match against, and prompt templates cannot reliably surface "venter på godkjenning" copy.

None of these is acceptable. Emma, Botsson, and WalkAi have no path to surface "pending approval" to the user today. This is an Agent Trust Gate violation (CLAUDE.md) — the agent is reporting truthfully to the LLM and the user is losing critical state. Wave 2B cannot ship until the tool-result contract handles all four outcomes explicitly.

## Decision Drivers

- **Truthful LLM signal:** the tool output must let the LLM distinguish "succeeded," "succeeded with caveat," "pending approval," and "denied" without guessing. No string-matching on free-form messages.
- **Authoritative user copy:** Norwegian end-user phrasing for gate outcomes is a governance surface, not an LLM creativity surface. The tool must provide the exact copy the LLM surfaces (or uses as a seed), so governance language stays consistent across Emma/Botsson/WalkAi.
- **Four-way outcome parity:** every tool-level result must cleanly represent `cascade_gate_write`'s four outcomes plus `gate_action`'s `deny` (collapsed into `blocked` per ADR-0137).
- **`allowed` boolean for fast branching:** LLM prompt templates and downstream UI both need a cheap yes/no on whether the intended change actually took effect, orthogonal to the four-way `outcome`.
- **Type discriminated unions:** TypeScript tool authors and their reviewers need exhaustive `switch` coverage for the four cases. A single `{ ok: boolean, data?: any }` shape silently allows new outcomes to slip through.

## Considered Options

1. **Discriminated union with mandatory `user_message` (chosen)** — a single `ToolGateResult<T>` type with four variants, each carrying an authoritative Norwegian `user_message` the LLM must surface verbatim or use as a seed.
2. **Flat result with optional fields** — keep the existing `{ success, data, error }` shape and add optional `proposal_id`, `user_message`, `outcome`. Rejected: the LLM cannot exhaustively match against optional fields, and reviewers cannot enforce completeness.
3. **Two-step protocol** — tool returns raw gate outcome; a separate LLM-adapter layer translates it to user-facing copy. Rejected: pushes governance language into prompt templates, where it drifts from tool to tool.
4. **Throw on non-applied** — use exceptions for `proposed` and `blocked`. Rejected: exceptions are control flow, not user-facing state; the LLM handles them as errors, not as governance outcomes.

## Decision Outcome

Chosen option: **"Discriminated union with mandatory `user_message`"**, because it is the only shape that gives the LLM deterministic pattern-matching over the four outcomes while keeping Norwegian governance copy authoritative and co-located with the tool. Option 2 leaks state through optional fields and defeats exhaustive type-checking. Option 3 fragments governance language across prompts. Option 4 conflates "failure" with "pending approval," the exact trap this ADR closes.

### Canonical result shape

```ts
// packages/ai/src/capabilities/_shared/tool-result.ts (new)

/**
 * Canonical result shape for capability tools that write to
 * governance-gated entities. Stacks gate_action (ADR-0137) + cascade_gate_write (ADR-0091).
 *
 * Every variant carries `user_message` — authoritative Norwegian copy the LLM
 * MUST surface verbatim or use as a seed when reporting to the user.
 */
export type ToolGateResult<T> =
  | {
      allowed: true;
      outcome: "applied";
      data: T;
      user_message: string;
    }
  | {
      allowed: true;
      outcome: "applied_with_exception";
      data: T;
      exception_reason: string;
      user_message: string;
    }
  | {
      allowed: false;
      outcome: "proposed";
      proposal_id: string;
      reason: string;
      user_message: string;
    }
  | {
      allowed: false;
      outcome: "blocked";
      reason: string;
      user_message: string;
    };
```

### Field semantics

- **`allowed: boolean`** — did the intended change actually take effect? `true` only when the data is now in the database as requested. `applied_with_exception` still counts (the write happened; an audit row records the exception). `proposed` and `blocked` are both `false` because no data change occurred.
- **`outcome: 'applied' | 'applied_with_exception' | 'proposed' | 'blocked'`** — the four-way gate outcome. `blocked` here covers BOTH `gate_action` deny (authority/channel/four-eyes) AND `cascade_gate_write` `blocked` (hard rule block). The LLM does not need to distinguish authority-block vs data-block; both mean "the user cannot do this right now." The `reason` field carries the axis-specific detail.
- **`data: T`** — the written row (or equivalent projection) on `applied`/`applied_with_exception`. Absent on `proposed`/`blocked` — there is no data to return.
- **`proposal_id: string`** — UUID of the `change_proposal` row. Only present on `proposed`. The LLM and the UI can use it to link to the proposal surface ("Se forslaget her").
- **`exception_reason: string`** — free-text reason logged in the audit row. Only present on `applied_with_exception`. The LLM may mention it to the user but should not dramatize it (the write succeeded).
- **`reason: string`** — machine-ish code or short human phrase (e.g. `"insufficient_authority"`, `"framework_rule:minimum_rest_hours"`, `"channel_voice_disallowed"`). Used for telemetry grouping and for prompt templates that conditionally elaborate.
- **`user_message: string`** — authoritative Norwegian copy the LLM MUST surface verbatim or use as a seed. This is the governance-controlled end-user string. Examples:
  - applied: `"Vakten er publisert."`
  - applied_with_exception: `"Vakten er publisert, med unntak logget: {exception_reason}."`
  - proposed: `"Endringen krever godkjenning. Forslaget ligger til gjennomgang."`
  - blocked (authority): `"Du har ikke tilgang til å gjøre denne endringen."`
  - blocked (rule): `"Endringen bryter med regelverket: {reason}. Ta kontakt med leder."`

### Prompt template contract

Prompt templates for Botsson, Emma, and WalkAi MUST handle all four variants explicitly. A capability tool that returns `ToolGateResult<T>` is accompanied by prompt-template guidance of the form:

```
When a tool returns ToolGateResult:
- outcome=applied: confirm the action in past tense. Use user_message verbatim or paraphrase faithfully.
- outcome=applied_with_exception: confirm the action, then acknowledge the exception. Use user_message.
- outcome=proposed: DO NOT say the action is done. Say it awaits approval. Surface proposal_id if UI supports linking. Use user_message.
- outcome=blocked: DO NOT retry with different phrasing. Acknowledge the block, explain reason if surface allows. Use user_message.
```

This guidance ships inline with each capability's prompt contribution (not as a separate doc) so it stays co-located with the tool.

### Migration rule

Every capability tool in `packages/ai/src/capabilities/*/tools.ts` that writes to a governance-gated entity MUST migrate its return type to `ToolGateResult<T>` before Wave 2B closes. Tools that return ad-hoc `{ success, data, error }` shapes are non-conforming. Tools that write to non-gated entities retain their existing shapes (no forced migration).

Prompt templates in `packages/ai/src/prompts/` and `packages/ai/src/agents/*/prompt.ts` that consume these tools MUST be updated in the same PR as the tool change — prompts and tool shapes ship atomically.

### Telemetry contract

Every `ToolGateResult` is emitted via `emit()` from `@smartout/telemetry` (ADR-0122). Event payload carries `outcome`, `reason`, `capability`, `entity_type`, and (for `proposed`) `proposal_id`. The four-way outcome becomes a first-class telemetry dimension, not an inferred field from message parsing.

## Rules & Consequences

- **Good, because** the LLM can exhaustively pattern-match on `outcome` via a TypeScript discriminated union — no more string-matching on free-form messages, no more `success: true` lies when a write produced only a proposal.
- **Good, because** authoritative Norwegian user copy is co-located with the tool, not scattered across prompt templates. Governance language stays consistent across surfaces.
- **Good, because** `allowed: boolean` gives prompt templates a cheap branch for "did the change happen?" without reading `outcome`.
- **Good, because** Wave 2B capability migration now has a concrete target shape — authors can refactor one tool at a time and verify against the type.
- **Bad, because** every capability tool writing to a gated entity must migrate (roughly 8–15 tools). Mitigated by doing the migration as part of Wave 2B's already-planned call-site conversion.
- **Bad, because** prompt templates must also be updated atomically. Mitigated by co-locating prompt guidance with the tool file.
- **Bad, because** `user_message` is a static-ish field that resists heavy runtime interpolation. Mitigated by allowing simple `{reason}` / `{exception_reason}` templating; complex copy lives in the prompt.
- **Agent Impact:**
  - Tool authors in `packages/ai/src/capabilities/` MUST return `ToolGateResult<T>` from any tool writing to a governance-gated entity.
  - Prompt authors for Botsson / Emma / WalkAi MUST handle all four `outcome` cases explicitly. A prompt that does not mention `proposed` is non-conforming.
  - `user_message` is governance-controlled copy — changes to it require the same review rigor as protocol language, not casual prompt tweaks.
  - The intent-classifier coverage invariant (ADR-0112) extends: every registered capability that writes to a gated entity must expose `ToolGateResult` metadata in its schema so the router can reason about outcomes before dispatch.
  - New tool-result variants MUST be added by amending this ADR, not by ad-hoc union extension. The four cases are the governance surface.

---

> Registered in `docs/decisions/0000-decision-log.md`.
> Status: draft — promote to accepted when Wave 2B capability migration closes and the result contract is adopted across all gated-entity tools.
