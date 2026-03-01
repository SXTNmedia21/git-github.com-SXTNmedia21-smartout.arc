---
title: "Worklog — landing-optimization"
status: in_progress
updated: 2026-03-01
created: 2026-03-01
module: landing
tags: []
---
# Worklog — landing-optimization
> Branch: `feat/landing-optimization` | Worktree: wt-5 | Started: 2026-03-01
## Status: 🟡 In Progress
## Done
- [x] Explored landing app codebase (7 variants, ~4500 lines, no CMS)
- [x] Brainstorming session — chose block-based page builder approach
- [x] Design approved (5 sections: perf, schema, rendering, admin UI, caching)
- [x] Design doc written: `docs/plans/2026-03-01-landing-page-builder-design.md`

## Remaining
- [ ] Write implementation plan
- [ ] Phase 1: Performance optimization
- [ ] Phase 2: DB schema + migrations
- [ ] Phase 3: Block components (15)
- [ ] Phase 4: Landing app routing
- [ ] Phase 5: Admin UI
- [ ] Phase 6: Seed existing variants
- [ ] Phase 7: Remove old code

## Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-01 | Block-based page builder (not free canvas or template override) | Balances WYSIWYG flexibility with structural safety. Prevents broken layouts. |
| 2026-03-01 | Admin UI in dashboard (not config files or raw DB) | Full WYSIWYG editing experience for non-technical admins |
| 2026-03-01 | URL parameter routing (?v=slug) | Simple, works for campaigns, no DNS config needed |
| 2026-03-01 | Platform-level tables (no workspace_id) | Landing page is one site for all of Smartout, not per-workspace |

## Log
| Date | Time | Event |
|------|------|-------|
| 2026-03-01 | 22:27 | Feature started |
| 2026-03-01 | 22:50 | Codebase exploration complete — 7 variants, 66.5 KB page.tsx, all hardcoded |
| 2026-03-01 | 23:00 | Design approved — block-based page builder with admin UI |
| 2026-03-01 | 23:05 | Design doc saved to docs/plans/ |
| 2026-03-01 | 23:30 | Implementation plan written — 27 tasks across 7 phases |
