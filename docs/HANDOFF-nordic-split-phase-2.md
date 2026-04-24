---
title: "Handoff — nordic-split-phase-2"
feature: nordic-split-phase-2
branch: feat/helpdesk-nordic-split-phase-2
closed: 2026-04-23
module: Dashboard
tags: [handoff, design-system, nordic-split]
---

# Handoff — nordic-split-phase-2

## Summary

Phase 2 of the three-phase Nordic Split token migration. Targeted the `/dashboard/organization/` klynge — 7 files, 442 refs → 0. Followed Phase 1 council verdict 2026-04-23 (Option C hybrid collapse); mapping table applied literally. ~149 `isDark` ternaries collapsed where both branches mapped to the same semantic token; 14 asymmetric ternaries preserved for amber/emerald brand signals + ring-offset hex fallbacks, all tagged `// Nordic Split: Phase 2.5 candidate.`

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| admin-ser-konsistent-organization | verified | none (visual QA deferred to pre-merge gate) |

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Strategy inherited from Phase 1 council (Option C) | Phase 1 verdict 2026-04-23 proved the hybrid-collapse approach works without regression; no new council needed for Phase 2 | Zero overhead; 7 files migrated mechanically with same rigor |
| Prefix unused `isDark` props with `_` (not remove) | StatCard/InfoRow/SkeletonBlock helpers had `isDark: boolean` signature; body no longer uses it after collapse, but 3+ caller sites still pass it | Type signature preserved for callers; 5 `isDark-unused` lint warnings resolved cleanly |
| Preserve amber/emerald brand ternaries | Phase 2.5 scope per Phase 1 council backlog — brand signals need semantic tokens (e.g. `bg-signal-live`), not mechanical zinc-swap | 14 preserved ternaries across 6 of 7 files; all tagged for Phase 2.5 |

No new ADRs — strategy and tokens are inherited.

## Learnings

| Learning | Context |
|----------|---------|
| Phase 1 council strategy scaled 1:1 to Phase 2 without new gaps | 442 refs, 7 files, zero deviations from mapping table. Validates Option C as the canonical approach for Phase 3 (schedule/reports cluster). |
| Lint fixup can happen inline with orchestrator (no agent spawn) | 5 `isDark-unused` warnings patched directly by Orchestrator after code review identified them — faster than dispatching a cleanup agent. |

## Known Issues / Debt

- **14 asymmetric ternaries preserved** across 6 of 7 files — amber/emerald brand tone pairs + ring-offset hex fallbacks (`#09090b` / `#ffffff`). All tagged; Phase 2.5 target.
- **4 `iconBg` brand tints** in `overview-tab.tsx` (blue/orange/violet/emerald stat cards) preserved — semantic tokens needed.
- **Pre-existing lint warnings** (24 total): direct-supabase-write ADR-0114 advisories (expected — gated-write migration is a separate workstream), set-state-in-effect, preserve-memoization. Not introduced by this PR.

## Next Steps

1. **Merge to `campaign/helpdesk`** via `close-feature.sh` (this closure).
2. **Phase 2.5** (recommended next): design new semantic tokens + `--card-elevated` + resolve hardcoded oklch. Requires council for token design.
3. **Phase 3** (alternative next): mechanical sweep of remaining files (schedule + reports + my-schedule + handbook + scrape + `page.tsx` root — ~957 refs).
4. **CI grep gate**: reject new zinc/gray/slate in already-migrated files.

## Migration Stats

| File | Zinc refs | Ternaries collapsed | Preserved | Line Δ |
|---|---|---|---|---|
| `locations-tab.tsx` | 74 → 0 | ~25 | 2 | −64 |
| `teams/[id]/page.tsx` | 72 → 0 | ~23 | 0 | −41 |
| `overview-tab.tsx` | 69 → 0 | ~22 | 5 | −20 |
| `locations/[id]/page.tsx` | 67 → 0 | ~22 | 1 | −43 |
| `departments/[id]/page.tsx` | 63 → 0 | ~22 | 1 | −35 |
| `departments-tab.tsx` | 57 → 0 | ~20 | 3 | −40 |
| `teams-tab.tsx` | 40 → 0 | ~15 | 2 | −24 |
| **Total** | **442 → 0** | **~149** | **14** | **−267** |

## Commits

```
24ffc11a  docs(nordic-split-phase-2): mark journey verified and plan done
8eb50238  refactor(design-tokens): migrate organization klynge to Nordic Split tokens
f3fb3c70  docs(nordic-split-phase-2): fill plan with full Phase 2 scope
2b5f8301  docs(nordic-split-phase-2): declare plan + journey + spec
```

## Gates

- ✅ Journey `admin-ser-konsistent-organization` verified
- ✅ Grep: 0 zinc/gray/slate across all 7 files
- ✅ Typecheck: 0 errors (`pnpm --filter web typecheck`)
- ✅ Lint: 0 errors, 24 pre-existing warnings
- ✅ Scope: only 7 org files + 3 docs; 0 mobile files; 0 channel/chat logic
- ⏳ Visual QA: deferred to pre-merge gate
