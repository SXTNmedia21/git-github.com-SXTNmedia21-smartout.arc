---
title: "Handoff — scheduler-web (Task 4)"
status: done
updated: 2026-05-14
created: 2026-05-14
module: scheduler
feature: scheduler-web
tags: [handoff, scheduler, proposed-plan, web-ui, adr-0021, adr-0309]
---

# Handoff: scheduler-web — Task 4 Web UI

## Summary

Shipped `/dashboard/schedule/proposed-plan` web UI for the C3 scheduler-web
sub-sortie. This is Task 4 from `docs/plans/PLAN-scheduler-greedy.md`.

The C3 sortie (in worktree `smartout.ai-world-best-wfm-wt-3`) already delivered:
- Greedy constraint-solver (`packages/ai/src/scheduler/solver/greedy.ts`)
- `scheduler` capability with 3 tools (`propose_plan`, `accept_proposal`, `reject_proposal`)
- 4 BFF routes (`/api/scheduler/propose-plan`, `/api/scheduler/accept-bundle`, `/api/scheduler/reject-bundle`, `/api/scheduler/proposals`)

This sortie (Task 4 only) delivers the web review surface.

## What Was Built

### Files created (4)

| File | Role |
|------|------|
| `apps/web/src/app/dashboard/schedule/proposed-plan/page.tsx` | Server Component shell — auth gate, Suspense wrapper |
| `apps/web/src/app/dashboard/schedule/proposed-plan/loading.tsx` | Route-level skeleton (glass card + button placeholders) |
| `apps/web/src/app/dashboard/schedule/proposed-plan/_components/ProposedPlanClient.tsx` | Client island — all UI + motion |
| `apps/web/src/app/dashboard/schedule/proposed-plan/_hooks/use-proposed-plan.ts` | TanStack Query data layer |

### UI features delivered

- Glass header card (`bg-background/80 backdrop-blur-xl`) with:
  - `font-heading` "Foreslått plan" title
  - `created_at` formatted in Norwegian locale
  - Objective score badge (success tone)
  - Stats grid: N foreslåtte vakter, N udekkede behov, solver version
- Read-only shifts summary (no checkboxes — atomic accept V1 per ADR-0309)
- Gaps warning section (warning tone, shown only when gap_count > 0)
- Two action buttons: "Godta hele planen" (success) + "Avvis" (destructive outline)
- Single-sweep gradient animation on accept (linear-gradient translate x: -100% → +200%)
  — ONE CSS animation, not 50 per-row Framer Motion springs
- `AnimatePresence` state swap: proposal → accepted/empty (uses `motionTokens.spring`)
- Reject dialog with optional reason textarea
- Empty state when no pending proposals
- Error state on BFF failure
- Full skeleton in `loading.tsx` and inline in client loading state

### Motion contract

Uses `motionTokens.spring` / `motionTokens.springSnappy` from `@smartout/design-tokens`.
NO inline magic numbers. The accept-sweep is a CSS `linear-gradient` translation
on one `<motion.div>` — zero per-row animation overhead per Frontend Phase 3 spec
and ADR-0309 animation budget note.

## Decisions

### D1 — Summary-only proposal display (V1)

The `GET /api/scheduler/proposals` BFF strips the full `proposed_shifts[]` array
from the JSONB and returns only counts/scores. This keeps the list response small
and avoids sending 200-shift JSONB to the browser.

The V1 UI therefore shows "N vakter klar til opprettelse" rather than rendering
individual shift rows. This is intentional for V1. When a detail endpoint is added
(V2), the `ProposedPlanClient` can be extended to call it and render
`ReadOnlyShiftList` (the V2 component name matching mobile's `ReadOnlyShiftList`).

**Consequence:** V2 work = add `GET /api/scheduler/proposals/[id]` returning full JSONB,
extend `ProposedPlanClient` to fetch + render per-shift rows.

### D2 — Auth pattern follows ADR-0115 (no double query)

Server Component calls `auth.getUser()` only. Role enforcement is delegated to
BFF (403 for non-managers). No extra profile/role DB query in the server shell.

### D3 — Type regen skipped (Docker unavailable in worktree)

`npx supabase gen types` requires Docker Desktop running. Docker was not available
in this worktree environment. The existing `packages/supabase/src/database.types.ts`
from the C3 sortie is current — no new tables were added in Task 4.

## Known Issues / Debt

| ID | Description | Severity |
|----|-------------|----------|
| V2-1 | Full proposed_shifts list not rendered (summary only) | Low — V1 design decision |
| V2-2 | No link from schedule view to proposed-plan page | Low — navigation pending |
| V2-3 | Type regen skipped (Docker unavailable in sortie env) | Informational |

## ADR References

| ADR | Relevance |
|-----|-----------|
| ADR-0021 | Server + client split pattern |
| ADR-0099 | gate_action enforced in capability tool (BFF delegates) |
| ADR-0115 | No double DB query in RSC shell |
| ADR-0134 | emit() delegated to BFF — comment markers in onSuccess |
| ADR-0151 | workspace_id + profile_id server-derived in BFF |
| ADR-0287 | Single BFF call per mutation (no loops) |
| ADR-0309 | Atomic accept V1, single change_proposal row, no per-row toggle |

## Next Steps (V2)

1. Add `GET /api/scheduler/proposals/[id]` route returning full JSONB with `proposed_shifts[]`.
2. Extend `ProposedPlanClient` to fetch detail and render per-shift `ReadOnlyShiftList` rows.
3. Add navigation link from `/dashboard/schedule` planner command bar to `/dashboard/schedule/proposed-plan` (badge on pending count).
4. Mobile bundle UI (Task 5 — deferred to Task 5 sub-sortie or follow-on).
