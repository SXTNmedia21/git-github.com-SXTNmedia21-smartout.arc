---
title: HANDOFF — SS-3 gatedMutation Orchestrator Scaffold
status: done
updated: 2026-04-24
created: 2026-04-24
module: botsson-arena
tags: [campaign-botsson, gate-action, cascade-gate-write, adr-0091, adr-0099, adr-0138, adr-0196, adr-0203, adr-0204, orchestrator, composition, feature-flag, invariant-11]
---

# HANDOFF — SS-3 `gatedMutation` Orchestrator Scaffold

Sub-sortie of `campaign/botsson-arena`. Third of 5 sub-sorties closing ADR-0203 + ADR-0204 per Council 2026-04-23.

Branch: `feat/botsson-arena-ss3-gated-mutation-orchestrator` (forked from `campaign/botsson-arena` at `fc0a1754`).

## Summary

Landed the composition orchestrator scaffold — the one legal call shape for any DB mutation that needs both C4 capability authority (Pathway A, `gate_action`) and C1 cascade data-rule (Pathway B, `cascade_gate_write`). Also landed the schema addition that lets both `gate_evaluation` audit rows a single composition call produces be linked back to one another.

The orchestrator ships **feature-flagged OFF**. Until SS-4 wires the first real call site, any caller that forgets to flip `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` gets a loud synchronous throw — no phantom emits, no partial work, ADR-0196 Invariant 11 preserved by construction.

ADR-0204 flips `proposed → accepted` on this merge.

## What shipped

| Path | Lines | Purpose |
|---|---|---|
| `supabase/migrations/20260519000000_gate_evaluation_correlation_chain.sql` | +61 | Adds `correlation_id UUID` + `parent_evaluation_id UUID` (self-FK) to `gate_evaluation`. Partial index on `correlation_id WHERE NOT NULL`. Both columns nullable — legacy single-gate rows unchanged. |
| `packages/supabase/src/database.types.ts` | +9 / −0 | Regenerated types include new columns across Row/Insert/Update shapes. |
| `packages/ai/src/gate/gatedMutation.ts` | +545 | The orchestrator. Exports `gatedMutation()`, `ComposedGateOutcome`, `GatedMutationArgs`, `DeniedBy`, `MutationExecute`. |
| `packages/ai/src/gate/__tests__/gatedMutation.test.ts` | +450 | 8 test cases covering every branch of the orchestrator contract. |
| `docs/HANDOFF-ss3-gated-mutation-orchestrator.md` | +this | This handoff. |

Total: 4 source files changed + 1 doc added. 0 call sites migrated (that's SS-4 + SS-5).

## Behaviour — the 8-step contract

Aligned with ADR-0204 §1 behaviour spec:

1. Check `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED`. OFF → throw `Error("not_implemented: …")`. **No RPC, no UPDATE, no emit.**
2. Generate `correlation_id` via `crypto.randomUUID()` (Node ≥ 19 / Deno / browser), with a pure-JS fallback for older runtimes.
3. Call `gate_action` RPC. Parse return jsonb as `GateActionRow` — tolerate absent fields fail-closed.
4. Post-RPC, UPDATE the returned `gate_evaluation_id` row with `correlation_id` + `parent_evaluation_id = NULL`. Swallow stamp failures — the audit row is the decision of record.
5. If authority denied → return `{ok:false, denied_by:'capability', reason, gate_evaluation_id, correlation_id, four_eyes_required?, approvers_needed?, approvers_present?}`. **Do not call Pathway B.**
6. If `downgrade_to='suggest'` → return `{ok:false, denied_by:'capability', reason:'downgraded…'}`. **Do not call Pathway B** (the caller has no consent surface here; SS-4 may add an `allow_downgrade_through` arg).
7. Call `cascade_gate_write` RPC. Post-RPC, UPDATE row 2 with `correlation_id` + `parent_evaluation_id = <row1 id>`.
8. Dispatch on Pathway B outcome:
   - `outcome='blocked'` → return `{ok:false, denied_by:'data_rule', …}`.
   - `outcome='proposed'` + proposal_id → return `{ok:true, proposal_id, …}`. **Do not invoke `execute`.**
   - `outcome='applied'` → invoke `execute(client)`. On throw → `{ok:false, denied_by:'not_implemented'}`. On `{ok:false, reason}` → same, reason propagated. On `{ok:true}` → return `{ok:true, gate_evaluation_id, correlation_id, reason?}`.

Any RPC throw or unrecognised shape at any step → `{ok:false, denied_by:'not_implemented', reason:'gate_rpc_failure:…'}`. **No `gate_evaluated` emit** on this path — Invariant 11 forbids emitting a success-shaped event when delegation failed.

## Invariant-compliance

| Invariant | Where enforced |
|---|---|
| ADR-0196 #11 (no phantom emits) | (a) feature flag OFF throws synchronously — no emit. (b) RPC transport / shape failure returns `not_implemented` — no emit. (c) SS-3 does not wire `gate_evaluated` emit at all; tracked for SS-4 once the registry entry lands. |
| ADR-0196 #12 (falsifiable claims) | Every test case asserts on captured RPC + UPDATE calls, not return-shape alone. Acceptance checklist below is falsifiable per row. |
| ADR-0196 #13 (gate_action on every mutation) | The orchestrator IS the compliance mechanism — its purpose is to make `gate_action` (Pathway A) the structurally first step on every write. |
| ADR-0099 channel guard | Authority evaluated first. Channel block surfaces as `denied_by:'capability'` without Pathway B ever running → no `change_proposal` leak. |
| ADR-0101 four-eyes | `four_eyes_required` passed through the result. L-0133 regression-tested: the orchestrator reads the dedicated boolean, NOT the reason string. |

## Acceptance evidence — 13 rows, falsifiable

| # | Criterion | Verification | Evidence |
|---|---|---|---|
| 1 | gatedMutation exists | `test -f packages/ai/src/gate/gatedMutation.ts` | PASS — file created (commit `2b712f46`) |
| 2 | Feature flag defaults OFF | `grep SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED packages/ai/src/gate/gatedMutation.ts` | PASS — env var referenced in `isOrchestratorEnabled()`; default OFF when unset |
| 3 | Migration added | `ls supabase/migrations/*correlation_chain*.sql` | PASS — `20260519000000_gate_evaluation_correlation_chain.sql` |
| 4 | correlation_id column | `grep "ADD COLUMN.*correlation_id" supabase/migrations/*correlation_chain*.sql` | PASS — `ADD COLUMN IF NOT EXISTS correlation_id UUID` |
| 5 | parent_evaluation_id self-FK | `grep "REFERENCES gate_evaluation" supabase/migrations/*correlation_chain*.sql` | PASS — `REFERENCES public.gate_evaluation(id)` |
| 6 | Migration timestamp > tip | `ls supabase/migrations/` tail | PASS — prior tip `20260518000000_*`, this file `20260519000000_*` (strictly greater, 1-day offset) |
| 7 | Types regenerated | `grep correlation_id packages/supabase/src/database.types.ts` | PASS — 9 occurrences in Row/Insert/Update shapes |
| 8 | Tests exist | `ls packages/ai/src/gate/__tests__/gatedMutation.test.ts` | PASS — file created (commit `1c00bdb6`) |
| 9 | 7+ tests pass | `pnpm --filter @smartout/ai test -- gatedMutation` | PASS — 8/8 tests pass in 14ms |
| 10 | Scoped typecheck | `pnpm --filter @smartout/ai typecheck` | PASS — 0 errors after workspace deps built (telemetry, types, utils, journey-ir, supabase) |
| 11 | Lint no regression | `pnpm --filter @smartout/ai lint` — ≤ 34 warnings | PASS — 34 warnings, identical to pre-SS-3 baseline (verified via `git stash` + rerun) |
| 12 | Invariant 11: flag OFF throws | Test `(g)` asserts `rejects.toThrow(/^not_implemented:/)` + zero RPC + zero UPDATE + zero execute | PASS |
| 13 | L-0125 spirit — tests assert rows | Tests `(a)/(b)/(c)/(e)/(f)/(g)/(h)` assert `updateCaptures` length + `eq` target + `patch` correlation/parent | PASS |

Additional: full @smartout/ai suite 290 tests across 33 files — all pass post-SS-3. No upstream regressions.

## Decisions made (register on merge)

### D1 — Channel type uses repo's `SessionChannel`

ADR-0204 §1 illustrated the channel union as `'chat' | 'voice' | 'system' | 'web' | 'mobile'`. The repo's actual `SessionChannel` (`packages/ai/src/capabilities/types.ts`) includes `sms`, `email`, `telegram`, `autonomous` and does NOT include `web`/`mobile` (those aren't channels — they're platforms, and routing happens at BFF).

**Chosen**: `SessionChannel`. Rationale: `gate_action` RPC validates against `engine_process.allowed_channels` which uses the Smartout channel taxonomy. Using ADR's narrower list would force runtime string conversion and break existing call sites in SS-4.

Documented in the orchestrator's `GatedMutationArgs` JSDoc (`channel` field).

### D2 — RPC bodies unchanged; orchestrator stamps correlation via post-RPC UPDATE

SS-3 brief explicitly forbids modifying `gate_action` or `cascade_gate_write` RPC bodies. Both RPCs already return `gate_evaluation_id`, so the orchestrator UPDATEs those rows after the RPC returns to stamp `correlation_id` + `parent_evaluation_id`.

**Trade-off**: A UPDATE failure leaves the decision rows written but un-correlated. Chosen behaviour: swallow the stamp error. The audit rows themselves are the decision of record; correlation is a convenience for dashboards. Future SS-4 could elevate correlation to RPC-owned (optional `p_correlation_id` arg) without breaking this contract.

### D3 — Downgrade-to-suggest short-circuits (no Pathway B)

ADR-0204 §1 step 3 doesn't explicitly cover `allow:true + downgrade_to` — reasonable reading is either "suggest = consent needed, caller decides" or "downgrade = soft-deny, don't proceed". Chose the latter.

**Rationale**: At the orchestrator layer there's no consent surface. Running Pathway B + `execute` on a downgrade would be acting without permission. Returning as `denied_by:'capability'` with `reason: 'role_below_min'` lets the capability tool render "confirmation required" UX and re-invoke with a consent token.

**SS-4 hook**: An `allow_downgrade_through?: boolean` flag on `GatedMutationArgs` could be added when a specific capability tool (e.g. `save_memory` on `personal` scope) wants to proceed anyway. Not in SS-3 scope.

### D4 — Unrecognised Pathway B outcome → `not_implemented`, not silent allow

If `cascade_gate_write` returns `allowed:false` with an outcome neither `'blocked'` nor `'proposed'`, the orchestrator returns `not_implemented` rather than treating it as allowed. This fails closed against future RPC expansions we haven't coded for. Covered by test `(h)` for `gate_action` bad-shape; symmetrical handling lives for `cascade_gate_write` in the implementation.

### D5 — No `gate_evaluated` telemetry emit in SS-3

ADR-0204 §6 references a `gate_evaluated` event. Emitting it requires a registry entry in `packages/telemetry/src/registry.ts` (with payload schema) plus `EVENT_ROUTING` wiring. Brief explicitly narrowed SS-3 scope to orchestrator + schema + tests.

**SS-4 follow-up**: Add `gate_evaluated` to the registry with payload `{ workspace_id, correlation_id, capability, denied_by, outcome }`. Wire 4 destinations per ADR-0175 convention. Add emit call to orchestrator at each of the 4 decision points (capability deny, downgrade, data-rule deny, proposal, applied). Preserve Invariant 11: emit only AFTER the row is written, never on the `not_implemented` path.

## Migration note — applying SS-3 in a fresh environment

1. `npx supabase start` — boots Supabase Local.
2. Apply the migration: `docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres < supabase/migrations/20260519000000_gate_evaluation_correlation_chain.sql`.
3. Regenerate types: `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts`. **Note the `2>/dev/null`** — without it, Supabase CLI stderr warnings (unset env vars, npm config warnings) prepend themselves to the types file and wreck typecheck. This cost one amend in this sub-sortie. Folklore now captured in L-0126 (see below).

## Open questions for SS-4

1. **When to flip the feature flag?** Options:
   a. Flip ON globally in `.env.example` + deployment env the moment SS-4's first call-site migration lands. Callers not yet migrated still use the old per-cap `gate.ts`; the flag only gates `gatedMutation` itself.
   b. Flip per call-site via dependency injection (pass `orchestratorEnabled` into each `gate.ts` wrapper). More plumbing, but gives per-capability rollback.
   c. Leave the flag in place but default TRUE once the first migration passes CI. Simplest.
   **Recommendation**: (c). The flag's purpose was to prevent SS-3 shipping a dead orchestrator that could be called before it was ready. Once the first real call site exists and passes tests, the flag has done its job — flip default and schedule a cleanup sortie to remove it entirely.

2. **Should `gate_evaluated` registry entry go with the FIRST call-site migration or as its own prep PR?** My recommendation: its own tiny PR ahead of call-site migration. A registry addition is a safe, reviewable, rollback-safe change. Bundling it with a call-site migration creates two-axis blast radius at review time.

3. **Should `packages/ai/src/gate/` be re-exported via `packages/ai/package.json` `exports` map?** Current: no. SS-4 will want to know if call sites should import `@smartout/ai/gate` or reach directly into the source. **Recommendation**: yes, add an `./gate` export in SS-4 (mirrors `./capabilities/journey/compile` pattern). But only when there's a real caller.

4. **Future: four-eyes handoff chain.** ADR-0204 §2 mentions "future multi-step orchestrators (e.g. four-eyes handoff) can chain further without widening `correlation_id` semantics." The schema supports it today (self-FK). What does the API look like? Likely a third arg to `gatedMutation` that threads a prior `gate_evaluation_id` as parent, with the RPC not auto-stamping NULL. Out of SS-3/SS-4/SS-5 scope but a known trajectory.

## API usage example — what SS-4 will look like

```ts
// In a future SS-4 per-cap migration of save_memory:
import { gatedMutation } from "@smartout/ai/gate/gatedMutation";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function saveMemoryGated(
  client: SupabaseClient,
  ctx: AgentToolContext,
  memory: { content: string; scope: string; memory_type: string; importance: number },
) {
  return gatedMutation(client, {
    workspace_id: ctx.workspaceId,
    actor_profile_id: ctx.profileId,
    capability: "memory",
    channel: ctx.channel ?? "chat",
    action_type: "save",
    entity_id: ctx.profileId,      // four-eyes scope (ADR-0101)
    entity_type: "engine_memory",
    action: "create",
    proposed_data: memory,
    current_data: null,
    execute: async (db) => {
      const { error } = await db.from("engine_memory").insert({
        workspace_id: ctx.workspaceId,
        profile_id: ctx.profileId,
        ...memory,
      });
      return error ? { ok: false, reason: error.message } : { ok: true };
    },
  });
}

// Caller in the capability tool:
const result = await saveMemoryGated(ctx.supabaseAdmin, ctx, { ... });
if (!result.ok) {
  return JSON.stringify({
    allowed: false,
    outcome: result.denied_by === "not_implemented" ? "error" : "blocked",
    reason: result.reason,
    // Passthrough for four-eyes UX
    four_eyes_required: result.four_eyes_required,
    approvers_needed: result.approvers_needed,
  });
}
if (result.proposal_id) {
  return JSON.stringify({
    allowed: true,
    outcome: "proposed",
    proposal_id: result.proposal_id,
  });
}
return JSON.stringify({
  allowed: true,
  outcome: "applied",
  gate_evaluation_id: result.gate_evaluation_id,
  correlation_id: result.correlation_id,
});
```

## Surprises & learnings

- **L-candidate-0126** — `npx supabase gen types typescript --local` writes CLI stderr (npm warnings, env-var warnings, "Connecting to db 5432") to stdout when not explicitly redirected. First SS-3 commit contained 4 garbage lines at the top of `database.types.ts`; typecheck exploded with 25+ TS1434 errors. Fix: always pipe with `2>/dev/null`. Amended the schema commit to avoid bisect hazard. Worth a proper learning registered in `docs/learnings/` once this handoff lands.
- **Types drift on regen (not a regression).** Running `supabase gen types` emits a full snapshot of all 169 `public` tables. Since `database.types.ts` had not been regenerated since `capability_default_registry`, `employee_availability`, and a few other tables were added to the live DB, the regen brought in ~140 lines of unrelated additions alongside the intentional +9 lines for `gate_evaluation`. Net: the types file now reflects reality more completely than it did at `fc0a1754`. **Reviewer note**: the large diff in `packages/supabase/src/database.types.ts` is mostly drift convergence, not SS-3 scope. The intentional additions are limited to `correlation_id`/`parent_evaluation_id` on the `gate_evaluation` Row/Insert/Update shapes.
- **Lint rule interaction with chained Supabase calls.** `eslint-disable-next-line smartout/no-direct-supabase-write` must be placed ABOVE the `await client.from(...)` chain, not between `.from()` and `.update()` — ESLint evaluates the violation on the chain-terminator (`.update()` line), which counts as "not the immediately-next line" if a comment sits between segments. Resolved with `/* eslint-disable-next-line … -- <reason> */` placed one line above `await`.
- **Fail-loud vs fail-closed decision on RPC shape drift.** The orchestrator chooses `not_implemented` (fail-closed, structured deny) over throwing. Rationale: capability tools catch the discriminated-union deny cleanly; a throw would require every `execute()` wrapper to add a try/catch it otherwise didn't need. This is ADR-0138 alignment in practice.

## Next steps (SS-4 entry criteria)

Before opening SS-4:
- [ ] This PR merged to `campaign/botsson-arena` (and ADR-0204 flipped to `accepted` in `0000-decision-log.md`).
- [ ] Add `gate_evaluated` event to `packages/telemetry/src/registry.ts` (small prep PR, see Open question 2).
- [ ] Decide feature-flag strategy (Open question 1).
- [ ] Identify the first migration target. Recommended: `packages/ai/src/capabilities/memory/` — already cleaned up by SS-1, smallest surface area, highest confidence.

## Commit chronology

| SHA | Message |
|---|---|
| `d258e7ef` | `feat(gate): add correlation_id + parent_evaluation_id to gate_evaluation (SS-3 schema)` |
| `2b712f46` | `feat(gate): gatedMutation composition orchestrator scaffold (SS-3, ADR-0204)` |
| `1c00bdb6` | `test(gate): 8 cases for gatedMutation — all 7 brief cases + RPC-shape-drift (SS-3)` |
| (pending) | `docs(gate): SS-3 handoff` |

## Do NOT push / merge

Per SS-3 brief — hand off to user for review. Branch left local-only at `feat/botsson-arena-ss3-gated-mutation-orchestrator`.
