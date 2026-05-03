---
title: "Plan — Dual-Gate Composition Orchestrator (Phase B1)"
status: ready
updated: 2026-04-23
created: 2026-04-23
module: authority
tags: [plan, authority, gate-action, cascade-gate-write, composition, adr-0203, adr-0204, campaign-b1, wave-2b]
---

# Plan — Dual-Gate Composition Orchestrator

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase B, item B1
> **Supersedes:** `docs/plans/archive/PLAN-dual-gate-reconciliation-2026-04-23-rejected.md` (rejected 2026-04-23)
> **Unblocks:** Wave 2B (capability dual-gate migration), Wave 2B lint-debt closure
> **Related ADRs:** 0091 (cascade_gate_write / data-rule plane), 0099 (gate_action / capability plane), 0138 (tool result discriminated union), 0196 (falsifiable claims + gate_action on every mutation), 0203 (two policies, not one — NEW), 0204 (TypeScript composition orchestrator — NEW)

## Goal

Build a **TypeScript composition orchestrator** — `gatedMutation()` — in `packages/ai/src/gate/` that sequences the two gate RPCs in the correct order for every mutation:

1. **First:** `gate_action` — capability authority (who can do this at all? ADR-0099).
2. **Then (only if allowed):** `cascade_gate_write` — data-rule plane (does this specific row obey the framework? ADR-0091 WP2).
3. **Finally:** execute the write, with both gate_evaluation rows chained via a single `correlation_id` so the audit trail can be reconstructed end-to-end.

Return a discriminated union per ADR-0138 (`{ok:true, …}` | `{ok:false, denied_by:'capability'|'data_rule', …}`). One orchestrator. One correlation chain per mutation. Two independent policy checks, never collapsed.

## Context

Council 2026-04-23 **rejected all three options** in the superseded plan. Code-trace evidence proved:

- The load-bearing premise — "the two RPCs share most logic" — was empirically false. `gate_action` evaluates capability × authority × four-eyes × channel. `cascade_gate_write` evaluates entity × framework trigger × rule × `change_proposal` lifecycle. They share the `workspace_id + actor` shape and nothing else.
- Forcing them into one shared SQL core (old Option 3) would merge two distinct policy planes at the wrong seam, re-introducing the exact default-allow class of CVEs ADR-0078 and L-0066/0097 were written to prevent.
- The real defect is architectural: **no code path runs both gates in order, with a correlated audit trail.** Callers today pick one gate or the other, leaving a silent policy gap.

Resolution: keep both RPCs separate at the SQL layer; compose them in TypeScript per ADR-0204. Every mutation goes through `gatedMutation()`. The orchestrator is the only place either RPC is called outside its own test fixtures.

## Scope

**In:**

1. **Orchestrator scaffold** — `packages/ai/src/gate/gatedMutation.ts` (+ index barrel, + types, + unit tests that hit a real Supabase local DB per L-0125).
2. **Correlation schema** — `gate_evaluation.correlation_id UUID` column + migration; set by orchestrator so capability-denial and data-rule-denial rows chain to the same mutation attempt.
3. **Per-capability migration** — route the 3 existing per-capability `gate.ts` files (`shift-lifecycle`, `contract-intake`, `journey.*`) through `gatedMutation()`. Shadow → flip → delete cutover pattern (L-0098) per surface.
4. **Wave 2B lint closure** — 33 `no-direct-supabase-write` warnings in `packages/ai/src/tools/{report,season}/*` migrate onto the orchestrator.
5. **Guardian grep-gates** — `close-feature-journey-guardian.sh` + Wave 2B CI step fail on any new mutation site that calls `supabase.rpc('gate_action')` or `supabase.rpc('cascade_gate_write')` directly outside `packages/ai/src/gate/` or per-cap `gate.ts`.
6. **Invariant 11 landmine** — fix `packages/ai/src/capabilities/memory/tools.ts:73` inline `gate_action` call that discards `four_eyes_required` / `approvers_needed` / `approvers_present` return fields (phantom capability class per ADR-0196).

**Out:**

- Any SQL consolidation of the two RPC bodies. They stay fully separate. ADR-0203 is explicit.
- Renaming either RPC.
- Changing `gate_action` or `cascade_gate_write` return shapes at the SQL layer — the orchestrator adapts.
- Server Action refactors beyond switching their gate calls to the orchestrator.
- ADR-0078 voice-channel PII guard: untouched. Capability gate runs first, so voice channel denials still short-circuit before any data-rule evaluation.

## Sub-sortie plan (5 sequential sub-sorties)

Order matters. Each one is a merge-blocker prereq for the next.

### SS-1 — Fix the inline `gate_action` landmine (merge-blocker prereq)

- Fix `packages/ai/src/capabilities/memory/tools.ts:73`: the current call invokes `gate_action` inline and ignores `four_eyes_required`, `approvers_needed`, `approvers_present`. That is Invariant 11 phantom-capability shape — approvals silently not enforced.
- Route through the shared gate-wrapper path that already handles those fields, **or** document a specific justified exception inline (why four-eyes is NA for this capability) and add a unit test proving the non-use is intentional.
- Guardian grep-gate goes live in the same commit: any `supabase.rpc('gate_action'`)  or `supabase.rpc('cascade_gate_write'` outside `packages/ai/src/gate/` + per-cap `gate.ts` + `supabase/tests/` = CI fail.

### SS-2 — Ontology foundation (no code)

- ADR-0203 (two policies, not one — capability plane vs data-rule plane) moves `proposed → accepted`.
- ADR-0204 (TypeScript composition orchestrator) moves `proposed → accepted`.
- ADR-0091 + ADR-0099 amended with cross-references pointing at ADR-0203/0204. "See also" sections added in both.
- L-0133 (grep-count audit inflated the dual-gate reconciliation scope), L-0134 (code-trace beats shared-premise reasoning — 5th occurrence pattern with L-0045/0096), L-0135 (two policies that share inputs are not one policy) logged.

### SS-3 — Orchestrator scaffold

- `packages/ai/src/gate/gatedMutation.ts` — core orchestrator. Signature (canonical): `gatedMutation<TArtefact>(input: { supabase, workspace_id, actor_profile_id, capability, channel, entity_type, entity_id?, action_type, approvers_present?, proposed_row, execute: () => Promise<TArtefact> }): Promise<GateOutcome<TArtefact>>`.
- `packages/ai/src/gate/types.ts` — discriminated union `GateOutcome<T>` per ADR-0138.
- Migration: `gate_evaluation` gains `correlation_id UUID NULL`; orchestrator mints one UUID per call and stamps both evaluation rows with it. RLS unchanged.
- Unit tests in `packages/ai/src/gate/__tests__/gatedMutation.test.ts` — hit Supabase local DB per L-0125. Assert the **artefact** (gate_evaluation rows written, mutation present/absent in target table), not the return shape alone.
- Feature-flagged behind `GATE_ORCHESTRATOR_ENABLED=true` env so SS-4 can flip per surface.

### SS-4 — Migrate per-capability `gate.ts` files

- Shadow: orchestrator runs in parallel, logs divergence, no behavioral change.
- Flip: surface switches its per-cap `gate.ts` to delegate to orchestrator.
- Delete: remove now-dead per-cap helpers once parity metrics are green for 48h.
- Surfaces in order: `shift-lifecycle/gate.ts` → `contract-intake/gate.ts` → `capabilities/journey/*/gate.ts` (4 journey capabilities).
- Per-surface handoff documents the shadow → flip → delete dates (L-0098 cutover ownership).

### SS-5 — Wave 2B lint closure

- Migrate the 33 `no-direct-supabase-write` warning sites in `packages/ai/src/tools/{report,season}/*` to `gatedMutation()`.
- Turn the lint rule from `warn` to `error` in `packages/ai/.eslintrc`.
- Guardian grep-gate from SS-1 is now load-bearing: any new mutation site bypassing the orchestrator = CI fail at PR open, not at merge.

## Acceptance Criteria (falsifiable per ADR-0196 / Invariant 12)

1. `grep -rn "supabase\.\(rpc\|from\).*['\"]gate_action['\"]\|rpc.*['\"]cascade_gate_write['\"]" packages/ai/src services/stage-engine apps/web/src` returns hits ONLY inside `packages/ai/src/gate/gatedMutation.ts`, per-cap `gate.ts` files listed in SS-4, and `supabase/tests/` fixtures. Any other match = CI fail.
2. `pnpm --filter @smartout/ai lint` returns 0 `no-direct-supabase-write` warnings (was 33 pre-SS-5). Rule level = `error`.
3. E2E: a mutation where capability passes but data-rule denies produces exactly two `gate_evaluation` rows, same `correlation_id`, first with `decision='allow'` on the capability plane, second with `decision='deny' denied_by='data_rule'` on the cascade plane. SQL: `SELECT count(*), count(DISTINCT correlation_id) FROM gate_evaluation WHERE correlation_id = $X` → `(2, 1)`.
4. E2E: a voice-channel PII-write attempt denies at the capability layer (`gate_action` returns `allow=false, reason LIKE '%channel%'`) and `cascade_gate_write` is never invoked. SQL: `SELECT count(*) FROM gate_evaluation WHERE correlation_id = $Y` → `1`. ADR-0078 guard preserved.
5. Invariant 11 audit on `packages/ai/src/capabilities/memory/tools.ts`: `git grep -n "supabase\.rpc('gate_action'" packages/ai/src/capabilities/memory/` returns 0 hits, OR the remaining call has an inline `// ADR-0203 exception: …` comment and a test asserting the exception shape.
6. `packages/ai/src/gate/__tests__/gatedMutation.test.ts` asserts real `gate_evaluation` rows against the local Supabase DB (L-0125 "assert artefact, not return shape").

## Risks

- **CVE regression — ADR-0078 voice-channel PII guard.** If orchestrator ordering ever flips (data-rule before capability), PII writes could be evaluated before the voice-channel deny fires. Mitigation: unit test pins ordering; ADR-0204 mandates `gate_action` first; guardian grep-gate forbids calling `cascade_gate_write` without a preceding `gate_action` on the same correlation_id.
- **Phantom capability shape (Invariant 11, ADR-0196).** Orchestrator must either actually enforce `four_eyes_required` / `approvers_present` or return `{ok:false, denied_by:'capability', reason:'four_eyes_required'}`. Skeleton `{ok:true, note:'…lands in M_'}` shape is banned.
- **L-0125 letter-vs-spirit.** Tests that assert `result.ok === true` without asserting the mutation landed in the target table pass mechanically but hide drift. All orchestrator tests assert the artefact.
- **`correlation_id` cardinality change.** Existing queries over `gate_evaluation` that assume one row per decision may need updating. Audit during SS-3; document in handoff.

## Dependencies

- SS-1 blocks SS-2 and everything after — the landmine must be fixed before we codify ADRs that claim a clean baseline.
- SS-2 ADRs (0203, 0204) must be `accepted` before SS-3 code lands. No coding against proposed ADRs.
- SS-3 orchestrator must ship feature-flagged before SS-4 flips any per-cap `gate.ts`. Shadow mode runs in production for at least one sibling mutation before any flip.
- Phase A6 (observability) helpful for monitoring correlation_id chain cardinality but not a hard blocker.

## Post-Implementation

- Move this plan to `docs/plans/completed/` at SS-5 merge.
- Update `CAMPAIGN-botsson-arena.md` Phase B1 row: status → complete, link to HANDOFF.
- Amend `STATE-SUMMARY.md` to remove the "Needs reconciliation ADR" line; point at ADR-0203/0204.
- Wave 2B council close-out note confirming all five integrity findings from 2026-04-18 are addressed.
