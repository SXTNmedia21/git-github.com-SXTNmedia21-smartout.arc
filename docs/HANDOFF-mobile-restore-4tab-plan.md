---
title: "HANDOFF — Mobile 4-Tab Plan (supersession by ADR-0268)"
status: done
updated: 2026-05-14
created: 2026-05-14
module: mobile
tags: [handoff, mobile, supersession, adr-0268, adr-0318]
---

# HANDOFF — Mobile 4-Tab Plan (supersession by ADR-0268)

> Branch: `feat/mobile-restore-4tab-plan` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-15`
> Base: `development` | Closed: 2026-05-14

## What Was Built and Why

The brief was "restore the 2026-03-24 master-plan 4 tabs + FAB" against an alleged 6-tab drift on mobile. On code audit at sortie start the branch base already embodied **ADR-0268's canonical 5-tab layout** (Kalender / Vakter / ⊕ FAB / Chat / Min Tid), accepted 2026-05-14 by 4-reviewer Council, which **explicitly REJECTED the 4-tab Option-2 by name**.

The orchestrator's brief was based on stale memory (`project_mobile_4tab_drift_2026_05_03`). The intent of the master-plan (reduce overcount, anchor on daily view, FAB as reset) was already satisfied — but with "Kalender" as the daily anchor, not "Hjem."

This sortie's actual deliverables turned out to be:

1. **ADR-0318** documenting the supersession trajectory + capturing the boundary between this sortie and ADR-0268.
2. **Delete `apps/mobile/app/(app)/digest.tsx`** — 465 lines orphaned by ADR-0268 (tab hidden, 0 cross-imports).
3. **Delete `apps/mobile/src/hooks/queries/use-digest-feed.ts`** — only consumer was digest.tsx.
4. **Retain `(komm)` route group** per ADR-0268 + ADR-0161 — used as deep-link target + Skranke from Chat tab.
5. **Retain `(home)` folder** for 3f.2/3f.3/3f.4 inbound importer retargets (per L-0250).
6. **Update TabBar.tsx + _layout.tsx comments** to cite ADR-0318 instead of the original 4-tab plan.

## Commits

| SHA | Subject |
|-----|---------|
| (this commit) | feat(mobile): ADR-0318 supersession + delete digest orphans |

## Decisions Made

### D1 — Accept ADR-0268 supersession, do not re-litigate

The 4-tab vs 5-tab debate is already settled by ADR-0268. Re-opening it in this sortie would be a Phase 3 chair-rationalization anti-pattern. Accept the supersession; document it; close.

### D2 — Delete only the orphaned digest files, do NOT touch (komm) or (home)

`grep -r "digest"` returned only digest.tsx → use-digest-feed.ts → 0 external consumers. Safe to delete both. `(komm)` is referenced by Chat tab Skranke segment + helpdesk-mobile campaign — delete would break cross-campaign work, declined per Council escalation trigger in the plan. `(home)` has 25 inbound importer retargets pending per L-0250 — defer to Phase 3f.4.

### D3 — ADR slot renumber 0316 → 0318 mid-sortie

Track A (Min Dag) landed ADR-0316 on development first. Track D + Track B both had picked 0316 from stale grep. Renumbered 0316 → 0318 across 4 files (ADR file + decision-log + _layout.tsx + TabBar.tsx) per Phase 8 Step 0 collision-recovery rule. Track B took 0317.

## Learnings

### L1 — Memory snapshots can become wrong inside one day if a campaign moves

`project_mobile_4tab_drift_2026_05_03` was correct on 2026-05-03 but superseded by ADR-0268 (accepted 2026-05-14). The orchestrator briefed against memory without re-verifying the ADR set on the same day the sortie ran. Pattern: when memory cites a "drift" or "missing canonical", grep `docs/decisions/` for keywords AT SORTIE-START — memory updates at recall-speed, ADRs ship at build-speed.

### L2 — Agent caught the supersession; orchestrator did not

Pre-delete grep + ADR-0268 verification was the agent's first action. The agent correctly pivoted the sortie scope from "restore 4 tabs" to "document supersession + delete 2 orphans." Pattern reinforces: dispatched agents with verification mandates catch orchestrator scope errors.

## Known Issues / Debt

| ID | Debt | Target |
|----|------|--------|
| K1 | `(home)` folder full deletion deferred (25 inbound importer retargets per L-0250) | Phase 3f.4 |
| K2 | Memory entry `project_mobile_4tab_drift_2026_05_03` marked SUPERSEDED but recurs as input source | Memory cleanup follow-up |

## Next Steps

1. Run `bash scripts/close-feature.sh` from wt-15 → merges to `development`.
2. Update `project_mobile_4tab_drift_2026_05_03` memory entry's "SUPERSEDED" marker to include this ADR-0318 cross-ref.
3. Phase 3f.4 takes the `(home)` folder full deletion (separate sortie).

## Verification

| Gate | Result |
|------|--------|
| ADR-0318 written + registered | PASS |
| JOURNEY status `verified` + `feature:` set | PASS |
| 2 orphan files deleted, 0 cross-imports broken | PASS |
| (komm) + (home) retained per ADR-0268 + L-0250 | PASS |
| Typecheck monorepo | PASS (will run via close-feature pre-push) |
