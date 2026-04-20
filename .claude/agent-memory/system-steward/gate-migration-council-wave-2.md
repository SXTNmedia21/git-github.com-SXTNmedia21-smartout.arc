---
name: Gate-Client Migration Wave 2 Council
description: Council verdict and lessons from Wave 2 synthesis (2026-04-18). Scope rescoped to Season-only with blocked Waves 2B/2C.
type: project
---

# Gate-Client Migration Wave 2 Council — 2026-04-18

## Final Verdict

APPROVE WITH CHANGES — rescope to Wave 2A = Season wizard only. Waves 2B (capability) and 2C (schedule TanStack) blocked on named prerequisites. Wave 2D (ESLint warn→error) last.

**Why:** Phase 3 briefing mislabeled three call sites, missed a live ADR-0091 violation in `shift-lifecycle/tools.ts:177-181`, missed a season telemetry bug (`'button clicked'` instead of `'season created'`), missed a D2 orphan in `contract-intake/tools.ts`, and under-appreciated optimistic cache staleness on gated tables. Supervisor + Agent Coord code-trace caught all of it.

## Prerequisites Registered

**Wave 2B blockers (all three required):**
- P1 — ADR amendment on `gate_action` vs `cascade_gate_write` stacking
- P2 — Tool-result contract with `outcome: 'applied' | 'proposed' | 'denied'` + Botsson prompt update
- P3 — `agent-router.ts:207` verify `toolContext.profileId` against `auth.uid()` (forgeable-actor fix)

**Wave 2C blockers (all three required):**
- Q1 — `--color-proposed` design token (hue ~90 amber, outside brand chroma 40-60)
- Q2 — Client `Shift` type augmented with `pendingProposalId: string | null`
- Q3 — Realtime reconciliation contract for proposed mutations (written decision)

## Known Debt Logged in STATE.md (required)

- `contract-intake/tools.ts:221` — D2 employment_contract insert bypasses `cascade_gate_write`
- `packages/ai/src/tools/season/*` — D4 writes through SeasonToolContext, orphaned from AgentToolContext
- `agent-router.ts:207` — forgeable actor via `profile_id` from request body
- Telemetry destination honesty — verify `registry.ts` declared destinations match `emit.ts` implementation

## Key Learnings

1. **Audit-inflation pattern recurrence.** Second verified case (first: Web Performance Council 2026-04-16). Grep-based site inventory inflates scope while missing integrity breaches. Pair briefings with code-trace verification before plans. Promote to persistent memory.

2. **Pilot-establishing trap.** Bundling N untested patterns into one "pilot" makes the first unresolved pattern a precedent for the rest. Ship smallest verified scope first.

3. **Optimistic cache + proposed branch = silent staleness by default.** Any TanStack `useMutation` with optimistic updates on a gated table silently loses proposed rows on refetch unless the client type carries a pending-proposal reference AND realtime reconciliation preserves it. Audit ALL optimistic mutations before Wave 2D.

4. **`gatedUpdate` default `entityIdColumn` was a zero-row-match trap.** Silent zero-row updates + successful gate telemetry = provenance claiming mutations that didn't happen. Always require explicit column.

5. **Capability tool `profile_id` from request body is forgeable-actor.** Once gated, spoofed `profile_id` corrupts `change_proposal.proposed_by` and `activity_trail.actor_id`.

## ADRs Owed

1. Gate action stacking semantics (`gate_action` vs `cascade_gate_write`)
2. Agent tool result contract with gate outcomes (+ Botsson prompt taxonomy)
3. `--color-proposed` token + pending-state UX contract (token, client type, realtime reconciliation, accessibility)

## Chair's Reversals from Phase 3

- Phase 3 said "2a = capability first, 2b = web." Reversed to Supervisor's "2A = Season only." Capability needs prerequisites unwritten.
- Phase 3 passed Trust Gate conditionally. Reversed — REJECTED for original scope (live ADR-0091 violation + orphaned write paths + forgeable actor). Trust Gate passes for rescoped Wave 2A only.
- Phase 3 called shared-fn extraction non-negotiable. Scoped down — non-negotiable for shift-lifecycle migration (Wave 2B), not Wave 2A.
