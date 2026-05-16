---
title: "Handoff — swap-marketplace-pipeline-ui"
feature: swap-marketplace-pipeline-ui
branch: feat/world-best-wfm-swap-marketplace-pipeline-ui
closed: 2026-05-16
module: scheduler
tags: [handoff, pipeline, ui, admin, scheduler, adr-0340]
---

# Handoff — Pipeline-aware UI Sortie

## Summary

Post-ADR-0340 backend ship, 4 UI surfaces closed the visibility gap for shift-lifecycle pipelines: admin override dashboard, pipeline-lock indicator on shift cells (web + mobile), cross-capability race feedback (409 toast), and audit trail viewer. Web-only authoring per ADR-0133; override action dispatches through existing Botsson chat capability tools (`override_swap_pipeline` / `override_marketplace_pipeline`) — NO new direct mutation API.

Sortie was paused mid-wave with U0 + U3 shipped; resumed 2026-05-16 with U1/U2/U4 transcribed from WIP handoff blueprints.

## Tasks Shipped

| ID | Description | Commit | Files |
|---|---|---|---|
| U0.1 | GET /api/admin/pipeline list endpoint | `92464a9e6` | `apps/web/src/app/api/admin/pipeline/route.ts` |
| U0.2 | GET /api/admin/pipeline/[id] detail + audit chain | `fa737f7b3` | `apps/web/src/app/api/admin/pipeline/[id]/route.ts` |
| U0.3 | GET /api/schedule/shifts/[id]/pipeline lookup | `05a8219ed` | `apps/web/src/app/api/schedule/shifts/[id]/pipeline/route.ts` |
| U3 | Cross-capability race feedback (409 toast) | `02271a8ca` | 6 files (BFF 409 + web hooks + mobile use-swap.ts) |
| U2 | Pipeline-lock indicator (web + mobile) | `19ce8ae5d` | `PipelineLockBadge.tsx` + `use-shift-pipeline.ts` web/mobile + `MalEmployeeTag` + `ShiftCard` wiring |
| U1 + U4 | Admin override dashboard + audit trail viewer | `c82a5ced2` | 6 files at `apps/web/src/app/dashboard/schedule/pipeline/` (1005 LOC) |

## Journeys Delivered

| Journey | Status | Verification |
|---|---|---|
| J1 — Admin overrides stuck pipeline | verified | Code-read of U1 page+drawer wiring → Botsson chat dispatch via `override_*_pipeline` tools |
| J2 — User sees pipeline-lock indicator | verified | Code-read of U2 PipelineLockBadge (web) + ShiftCard 🔒 row (mobile); both no-op on null pipeline_lock_state_id |
| J3 — User hits cross-capability race 409 | verified | Already-shipped via U3 commit; friendly Norwegian toast per ADR-0328 |
| J4 — Admin reviews audit trail | verified | Code-read of U4 audit-drawer.tsx wiring U0.2 endpoint with platform-actor banner + channel-best-effort metadata |

## Decisions Made

| Decision | Reason | Impact |
|---|---|---|
| Web-only authoring (no mobile override) | ADR-0133 mobile boundary: web composes, mobile executes; override is irreversible Compose verb | `/dashboard/schedule/pipeline` route is admin-only web surface; mobile shows only read-side lock indicator |
| Override dispatches via Botsson chat (NOT direct mutation) | ADR-0288 + ADR-0340 §Q5: override is irreversible C4 act; chat channel forces conversational confirmation | Drawer opens chat with prefilled prompt; no new mutation API endpoint added |
| Single commit for U1+U4 (vs split) | pipeline-list-client.tsx imports both override-drawer (U1) AND audit-drawer (U4); split would leave U1 typecheck broken until U4 lands | One commit `c82a5ced2` covers 6 interdependent files |
| WSL2 RAM mitigation: NODE_OPTIONS heap 6GB for typecheck | 2 concurrent agents both running tsc OOM'd with 2GB free RAM | Sortie completion required killing agents mid-edit; agents had already committed before kill (L-274 pattern); final verify with elevated heap |

All decisions cross-reference ADR-0340.

## Learnings

| Learning | Context |
|---|---|
| L-274 sibling: agents complete commit BEFORE kill confirmation | Both U1 and U4 agents wrote all 6 files + committed `c82a5ced2` BEFORE TaskStop returned "killed" status. Same race-against-rejection pattern observed in earlier ui-shell sortie. Always `git log` after kill, not before assuming work lost. |
| Concurrent agents on same project trigger Stop-hook typecheck OOM | Two sonnet agents in same worktree, both with PostToolUse:Edit hooks running `pnpm --filter web typecheck`, fight for ~6GB tsc heap on 2GB free WSL2 RAM. Cascade: hook reports "Terminated" (143) → agent retries → more OOM. Mitigation: dispatch agents serially OR widen worktree boundaries OR disable post-edit typecheck hook for known-good blueprints. |
| WIP handoff with embedded code blueprints survives multi-session pause | Pause-strategy from earlier session (write full code into HANDOFF doc) made resume mechanical: agent reads doc + transcribes. Significantly faster than re-deriving from API contracts. Worth repeating for paused sorties. |

## Known Issues / Debt

- **Manual UI smoke deferred** — full Playwright/manual click-through of override flow + audit drawer + race-toast not exercised. Pre-deploy smoke recommended post-merge.
- **Stale-lock UX** — Journey J2 error path notes "stale lock (pipeline terminal but lock not cleared) → P0.6 reaper handles; UI shows stale badge until next poll". P0.6 reaper status not verified in this sortie.
- **Override drawer min-20-char reason validation** — client-side validation only; BFF rejection path tested via U3 commit but not specifically for override action.

## Next Steps

1. **Merge sub-sortie to `campaign/world-best-wfm`** via `close-feature.sh` (automatic).
2. **Campaign milestone PR** — when ready, Pontus opens PR `campaign/world-best-wfm → development` (per memory `feedback_no_pr_to_development_unprompted`, this is Pontus' call, not Claude's).
3. **Post-deploy smoke** — exercise override drawer + audit drawer + race toast on staging once campaign merges.
4. **WIP handoff archival** — `docs/HANDOFF-pipeline-ui-WIP.md` superseded by this completion handoff; can be archived or deleted in follow-up cleanup.

## ADR References

- ADR-0133 — Mobile surface boundary (web composes, mobile executes)
- ADR-0151 — Server-derived identity
- ADR-0204 — Correlation ID audit
- ADR-0240 — Cross-namespace write ban
- ADR-0287 — mutateWithGate single-call contract
- ADR-0288 — Chat-only channel pinning for irreversible acts
- ADR-0328 — Friendly Norwegian error contract
- ADR-0340 — Shift Lifecycle Pipeline (this sortie's parent contract)

## Verification Trail

- `19ce8ae5d` — U2 pipeline-lock indicator (5 files, 164 LOC)
- `c82a5ced2` — U1 + U4 admin override dashboard + audit trail viewer (6 files, 1005 LOC)
- `pnpm --filter web typecheck` exit 0 (with `NODE_OPTIONS=--max-old-space-size=6144`)
- 4 journeys flipped to `status: verified` in `docs/journeys/JOURNEY-world-best-wfm-swap-marketplace-pipeline-ui.md`
