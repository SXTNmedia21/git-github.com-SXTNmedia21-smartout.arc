---
title: "TanStack useMutation + optimistic updates silently drops 'proposed' outcomes on refetch"
id: LEARNING_0056
status: canonical
layer: learning
created: 2026-04-18
updated: 2026-04-18
tags: [tanstack, gate-client, optimistic, cascade, ux, gate-stacking]
---

# Learning-0056: TanStack useMutation + optimistic updates silently drops "proposed" outcomes on refetch

## Context

Gate-Client Wave 2 council discovered a categorical pattern failure in
TanStack `useMutation` + optimistic update + `cascade_gate_write` interaction,
while tracing the 9 schedule-shift `useMutation` sites that would have been
migrated to the gate-client helper in the original Wave 2 scope.

When `cascade_gate_write` evaluates authority and returns
`outcome: "proposed"`, the underlying DB write does NOT happen — instead a
`change_proposal` row is inserted for review. But the TanStack hook sees
the mutation return successfully (no throw, no error) and completes its
optimistic update lifecycle as if the row were written.

## Discovery

The failure sequence:

1. User clicks "Create shift" → `useMutation.mutate()` fires.
2. `onMutate` optimistically injects the row into the TanStack cache. UI
   renders the new shift immediately.
3. `mutationFn` calls `cascade_gate_write` → returns
   `{ outcome: "proposed", proposalId: "..." }`. No throw.
4. `onSuccess` fires (mutation didn't throw).
5. `onSettled` runs `queryClient.invalidateQueries`, refetches from DB.
6. DB returns 0 rows for the proposed entity (no write happened).
7. The optimistic row **disappears** from the UI.
8. Toast fires: "Needs approval" — but the visual anchor (the row the user
   just created) is already gone.

**User-visible result:** shift appears instantly → disappears a moment later
→ toast with no visual anchor. Users reasonably conclude the action failed.

This is NOT a one-off bug in a specific hook. It is a structural consequence
of the TanStack optimistic pattern meeting a gate that may return "proposed"
instead of "written". Every gated TanStack mutation has this bug by default.

## Impact

**For every TanStack mutation on a gated table:** without a client-type
augmentation + realtime reconciliation contract + visual pending-state token,
the optimistic pattern ships with the staleness bug. Wave 2C (schedule
TanStack) is blocked on 3 prereqs:

1. **Client type field:** `pendingProposalId: string | null` on the row
   model, so cached rows can be marked as "proposed" without being removed
   on refetch.
2. **Realtime reconciliation contract:** either (a) Supabase Realtime
   subscription that flips `pendingProposalId → null` when the
   `change_proposal` is accepted and the real row appears, or (b) polling
   strategy with documented SLAs.
3. **Design token + visual language:** `--color-proposed` token (ADR-owned,
   not inline hex) applied to the pending row. Accessibility pattern:
   text badge "Venter godkjenning" mandatory — color-only signal fails WCAG.

**For future gated TanStack plans:** All four prereqs present in plan, or
the plan is not approvable. No exceptions.

**For the gate-client helper:** the return-type already carries
`outcome: "proposed" | "written" | "refused"`. Hooks MUST branch on outcome,
not assume the row was written just because the call didn't throw.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-04-18 (Gate-Client Wave 2)
- ADR draft: `docs/decisions/` color-proposed-pending-state-ux (pending)
- Related: Learning 0031 (clickable row action propagation contract — similar "visual state must match cascade state" class)
- Related: Learning 0038 (registry destinations claim routes providers silently drop — same shape: declaration ≠ behavior)
- Pattern reference: `packages/supabase/src/gate-client.ts` (returns outcome discriminated union)
