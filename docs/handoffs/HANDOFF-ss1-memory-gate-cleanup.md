---
title: HANDOFF — SS-1 Memory Gate Cleanup
status: done
updated: 2026-04-23
created: 2026-04-23
module: botsson-arena
tags: [campaign-botsson, memory, gate-action, adr-0099, adr-0196, adr-0203, adr-0204, phantom-capability, invariant-11, invariant-13]
---

# HANDOFF — SS-1 Memory Gate Cleanup

Sub-sortie of `campaign/botsson-arena`. Merge-blocker prerequisite to all other Phase B work per Council 2026-04-23 (ADR-0203 + ADR-0204).

Branch: `feat/botsson-arena-ss1-memory-gate-cleanup` (forked from `campaign/botsson-arena` at `78b4c322`).

## Summary

Replaced the inline `supabase.rpc("gate_action", ...)` call in `packages/ai/src/capabilities/memory/tools.ts` with the shared `callGateAction` wrapper pattern used by every other mutation-capable capability (shift-lifecycle, contract-intake, journey). The inline variant silently dropped four RPC return fields — `four_eyes_required`, `approvers_needed`, `approvers_present`, `gate_evaluation_id` — turning a legitimate four-eyes approval path into an opaque `"Minnelagring avslått: four_eyes_required"` prose deny with no UX path and no retry.

This is ADR-0196 Invariant 11 (phantom-capability ban) + Invariant 13 (`gate_action` on every mutation). It also closes the implicit ADR-0197 phantom against `save_memory`: before this change, a workspace with `memory.requires_four_eyes=true` would emit `recordTurn("memory_write")` zero times while producing a deny message the agent had no way to recover from.

## Before / After

### Before (`memory/tools.ts:73-91` on `campaign/botsson-arena` HEAD)

```ts
const { data: gateRaw, error: gateError } = await ctx.supabaseAdmin.rpc("gate_action", {
  p_workspace_id: ctx.workspaceId,
  p_capability: "memory",
  p_channel: ctx.channel ?? "chat",
  p_actor_profile_id: ctx.profileId,
  p_action_type: "save",
  p_approvers_present: [ctx.profileId],
});

if (gateError) {
  return `Kunne ikke evaluere tillatelse for minnelagring: ${gateError.message}`;
}

const gate = (gateRaw ?? {}) as Record<string, unknown>;
if (gate.allow !== true) {
  const reason = (gate.reason as string) ?? "ikke tillatt";
  return `Minnelagring avslått: ${reason}.`;
}
```

Fields dropped on the floor:
- `four_eyes_required` — ignored. Workspaces with four-eyes enabled got a raw string deny.
- `approvers_needed` / `approvers_present` — ignored. No way for the UI to surface the approver selector.
- `downgrade_to` — ignored. `suggest` level collapsed to "blocked".
- `gate_evaluation_id` — ignored. No audit correlation downstream.

### After (`memory/tools.ts:155-216`)

```ts
const channel = normaliseChannel(ctx.channel);
const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
  capability: CAPABILITY,
  channel,
  actionType: "save",
  entityId: ctx.profileId,  // ADR-0101 four-eyes per-profile scoping
});

// Four-eyes path (ADR-0101): surface approver-needed, do NOT mutate.
// L-0133: discriminate on the dedicated `requiresFourEyes` boolean — NOT
// on `reason === "four_eyes_required"` string-match.
if (!gate.allow && gate.requiresFourEyes === true) {
  return toJson({ allowed: false, outcome: "four_eyes_pending", reason: "four_eyes_required",
    approvers_needed: gate.approversNeeded, approvers_present: gate.approversPresent,
    user_message: FOUR_EYES_MESSAGE, gate_evaluation_id: gate.gateEvaluationId });
}

// Downgrade path (level='suggest'): user confirmation required.
if (gate.allow === false && gate.downgradeTo === "suggest") {
  return toJson({ allowed: false, outcome: "confirmation_required",
    reason: "downgraded_to_suggest", user_message: DOWNGRADE_MESSAGE,
    gate_evaluation_id: gate.gateEvaluationId });
}

// Any other deny — block without mutating.
if (!gate.allow) {
  const blockReason = gate.reason ?? "ikke tillatt";
  return toJson({ allowed: false, outcome: "blocked", reason: blockReason,
    user_message: BLOCK_MESSAGE(blockReason), gate_evaluation_id: gate.gateEvaluationId });
}
```

Now:
- Four-eyes rows surface `{ outcome: "four_eyes_pending", approvers_needed, approvers_present }` so the approver UI can render.
- Downgrade-to-suggest surfaces `{ outcome: "confirmation_required" }` so the LLM can prompt for explicit user confirmation.
- Block paths carry `gate_evaluation_id` for audit correlation.
- Legacy `"Minnelagring avslått: ${reason}"` wording is preserved inside `user_message`, so existing regex-based consumers (`/avslått|avslatt/i`) keep working.
- Happy-path JSON keeps all legacy fields (`success`, `memory_id`, `scope`, `memory_type`) plus additive ADR-0138-compatible `{ allowed: true, outcome: "applied", user_message, gate_evaluation_id }` fields.

## Files Changed

| File | Kind | LOC (net) |
|---|---|---|
| `packages/ai/src/capabilities/memory/gate.ts` | new | +104 |
| `packages/ai/src/capabilities/memory/tools.ts` | rewritten | +130 / -33 net |
| `packages/ai/src/capabilities/memory/__tests__/tools.test.ts` | expanded | +95 / -6 net |
| `docs/HANDOFF-ss1-memory-gate-cleanup.md` | new | this file |

## Acceptance Criteria

| # | Criterion | Result |
|---|---|---|
| 1 | `grep -n "supabase.*rpc.*gate_action" packages/ai/src/capabilities/memory/` hits ONLY in `memory/gate.ts` | ✅ Only `memory/gate.ts:64` contains an actual `rpc("gate_action", ...)` call. `tools.ts:10` and `__tests__/tools.test.ts:6` hits are docstring prose, not calls. |
| 2 | Across all capabilities, inline `rpc("gate_action", ...)` lives ONLY in each capability's own `gate.ts` | ✅ 4 actual call sites: `memory/gate.ts`, `contract-intake/gate.ts`, `shift-lifecycle/gate.ts`, `journey/gate.ts`. Zero inline calls in any `tools.ts`. |
| 3 | 4+ memory tool tests covering allow / deny / downgrade / four-eyes-required | ✅ 9 tests pass (up from 7). New: `downgrade_to=suggest` + `four_eyes_required` scenarios. Kept: allow, deny, voice, RPC-error, PII-block, recorder-hook. |
| 4 | `pnpm --filter @smartout/ai test -- memory` passes | ✅ 20/20 tests pass (11 memory-writer + 9 save_memory). |
| 5 | `pnpm --filter @smartout/ai typecheck` passes (no NEW errors vs baseline) | ✅ Zero non-journey errors on branch — matches baseline. Journey errors (6) are pre-existing on `campaign/botsson-arena` from cross-campaign drift; untouched by this change. |
| 6 | `pnpm --filter @smartout/ai lint` shows no INCREASE in warnings (baseline observed: 34, brief said 33) | ✅ 34 warnings → 34 warnings. Zero memory-related lint warnings. |
| 7 | Invariant 13 grep: every mutation preceded by `callGateAction(...)` within 40 lines | ✅ Zero direct `.insert()`/`.update()`/`.delete()` in `memory/tools.ts`. The single mutation path (`saveMemory()` helper) is invoked at line 219 after `callGateAction()` at line 159 — all four deny branches (four-eyes, downgrade, block, fail-closed) return before reaching `saveMemory()`. |
| 8 | Handoff cites file:line before/after | ✅ See "Before / After" section above. |

## Decisions

### D1 — Four-eyes discrimination via dedicated boolean (L-0133)

The new code checks `gate.requiresFourEyes === true`, NOT `gate.reason === "four_eyes_required"`. L-0133 from contract-intake's post-review established this precedent: the RPC may set the boolean `true` while `reason` carries a different machine code (the test fixture uses `"approval_required"`), in which case reason-string matching silently falls through to the "blocked" branch and the UI never surfaces the approver selector. The four-eyes test case explicitly uses a divergent reason string to lock this behaviour in.

### D2 — Preserve legacy happy-path fields additively

The `save_memory` tool's JSON output had a stable shape `{ success, memory_id, scope, memory_type }` that prompt templates and downstream consumers rely on. Rather than break those, the new happy-path returns a superset: legacy fields + additive `{ allowed, outcome, user_message, gate_evaluation_id }` fields. Existing consumers ignore the new fields; new consumers (stage-engine recorder, UI approver card) can opt into them.

### D3 — Preserve legacy `"Minnelagring avslått"` wording in `user_message`

The `BLOCK_MESSAGE` template keeps the Norwegian `"Minnelagring avslått: <reason>"` wording because (a) the original test suite keyed off `/avslått|avslatt/i`, (b) prompt templates may do the same, (c) the wording is idiomatic for the capability's domain. On the outer JSON surface, the `reason` field carries the gate-machine code (`capability_disabled`, etc.) so programmatic consumers can key off a stable identifier while humans see natural-language copy in `user_message`.

### D4 — entity_id = profileId for memory writes

Memories scope to the actor's profile today (the `personal` scope is the default, and even `workspace`-scoped memories carry a `profile_id` author). Setting `entityId: ctx.profileId` in the gate call enables ADR-0101 per-entity four-eyes: if a workspace enables four-eyes on memory writes, one approval covers ONE profile's writes, not the workspace's entire memory store. Mirrors contract-intake's `entityId: ctx.profileId` pattern.

### D5 — `gate_evaluation_id` propagated on every outcome

All four return paths (`applied`, `blocked`, `confirmation_required`, `four_eyes_pending`) carry `gate_evaluation_id`. This lets stage-engine, the future approver UI, and audit consumers correlate a specific memory-write attempt with its `gate_evaluation` row. Pre-SS-1, this field was dropped on the floor — no correlation possible.

## Learnings

### L-SS1.1 — `/avslått/i` regex carries a contract

The original memory test file asserted `out).toMatch(/avslått|avslatt/i)` — treating prose output as a stable API. When I refactored to structured JSON, I kept the Norwegian prose inside `user_message` rather than moving to machine-language-only output. This costs a handful of lines but preserves backwards compatibility with any non-test consumer that may be regex-matching the same string. General principle: when a test asserts on natural-language output, the natural language IS part of the contract and must be preserved even when the outer shape changes.

### L-SS1.2 — Baseline counts drift between sessions

The brief cited lint baseline 33; actual was 34. One warning added between brief-drafting and my execution. I worked to the observed baseline (no increase over 34) rather than the brief's number. Future briefs for lint-sensitive work should capture baseline freshly; relying on a stale number risks false failure OR masks a regression.

### L-SS1.3 — Per-capability `gate.ts` files are nearly identical — and that is the design

Comparing `memory/gate.ts`, `contract-intake/gate.ts`, `shift-lifecycle/gate.ts`, and `journey/gate.ts`, the four files are ~95% identical. Each carries its own capability-specific docstring and exports its own `GateActionArgs` / `GateActionResult` / `callGateAction`. The contract-intake gate.ts explicitly documents why: "Allows the capability to diverge later (e.g. tighter four-eyes posture for banking vs identity) without editing unrelated capabilities." This is intentional design, not duplication waiting to be DRY'd. Extracting a shared helper would be a premature abstraction that couples four capabilities to one contract.

## Known Issues / Debt

None introduced by SS-1. Note: the four-eyes branch returns `approvers_needed: gate.approversNeeded` — the downstream consumer (UI approver picker) doesn't yet exist anywhere for the memory capability. That's future work (likely Phase B), not a regression.

## Next Steps

1. Merge this sub-sortie via `/close-feature`. Orchestrator updates `docs/plans/CAMPAIGN-botsson-arena.md` to reflect SS-1 closure.
2. Per Council 2026-04-23 ADR-0203 + ADR-0204, SS-1 was a merge-blocker prerequisite; its closure unblocks the rest of Phase B.
3. Consider extracting a `packages/ai/src/capabilities/_shared/gate.ts` shared helper IF AND ONLY IF three or more capabilities genuinely converge on the same shape for six months. Today's four near-identical files are the intentional design per L-SS1.3.

## Git Discipline

- Branch: `feat/botsson-arena-ss1-memory-gate-cleanup` (from `campaign/botsson-arena`).
- DID NOT push. DID NOT merge. Orchestrator runs close-feature.
- Conventional commits, no `--no-verify`.
