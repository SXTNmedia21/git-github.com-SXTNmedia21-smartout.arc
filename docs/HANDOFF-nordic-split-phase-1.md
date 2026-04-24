---
title: "Handoff — nordic-split-phase-1"
feature: nordic-split-phase-1
branch: feat/helpdesk-nordic-split-phase-1
closed: 2026-04-23
module: Dashboard
tags: [handoff, design-system, nordic-split]
---

# Handoff — nordic-split-phase-1

## Summary

Phase 1 of a three-phase migration replacing hardcoded `zinc/gray/slate` Tailwind classes with Nordic Split semantic tokens in `apps/web/src/`. This phase targeted the architecturally-critical shell files: `DashboardShell.tsx` (67 refs) and `GlobalSearchPalette.tsx` (32 refs). 99 refs → 0. Net −125 lines from collapsing ~40 `isDark` ternaries where both branches mapped to the same semantic token (tokens handle dark mode via `.dark` scope).

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| admin-ser-konsistent-shell | verified | none (visual QA deferred to pre-merge gate) |

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Strategy: Option C Hybrid Collapse | Frontend-designer verdict — collapse `isDark ? X : Y` when both branches → same token; preserve when asymmetric (shadows, hardcoded oklch, brand-orange) | Reduced 99 refs + ~40 ternaries to clean token usage; kept ~15 asymmetric ternaries as Phase 2 backlog |
| `bg-card` for active-tab state inside `bg-muted` tray | Contrast 0.025 L-delta + `shadow-sm` + `text-foreground` bold carries state visibly | Light-mode contrast is sub-perceptual — logged as Phase 2 backlog for `--card-elevated` token or stronger shadow+ring |
| `data-[selected=true]:bg-accent + text-accent-foreground` | shadcn canonical for command-palette selected state | Replaces per-theme zinc ternaries for CommandItem selection |
| `shadow-zinc-300/50` → `shadow-border/50` | `--color-border` registered via `@theme inline`; Tailwind v4 resolves shadow-color utilities | Clean token-based shadow without inventing `shadow-*` token |

No new ADRs — strategy captured in commit bodies and plan document. Existing ADRs honored: ADR-0113 (DashboardContext decomposition — `isDark` retained for non-color logic; correct separation), ADR-0133 (mobile boundary untouched).

## Learnings

| Learning | Context |
|----------|---------|
| Post-implementation council catches design concerns that per-file code review misses | Frontend-designer flagged light-mode `--card`=`--background` weakness; 3 P1 code-review concerns all resolved in context. First of kind for a "pure visual" PR — promote on 3rd occurrence. |
| Hex surfaces collapse, oklch values don't | `bg-[#0c0c0e]` + `bg-[#0a0a0c]` safely collapsed to `bg-card`/`bg-muted`. Hardcoded `oklch()` values require design decisions (new token? collapse? new `--text-subtle`?) and MUST be deferred to a scoped Phase 2.5 session. |
| `isDark` prop is NOT always color-only | DashboardShell uses `isDark` for icon swap (Sun/Moon) + orange brand tint. Collapsing only color-ternaries while preserving semantic-ternaries is the correct split, not drift. |

## Known Issues / Debt

- **~15 asymmetric `isDark` ternaries preserved** in `DashboardShell.tsx` where light branch uses hardcoded `text-[oklch(0.60_0.018_45)]` etc. — deferred to Phase 2.5 (oklch audit).
- **Orange brand signals preserved** (`bg-orange-500`, `text-orange-400`, `ring-orange-500/30`) on Chat NavItem live-call + unread badges. Intentional — deferred to Phase 2.5 for `bg-signal-live` / `text-signal-live` semantic tokens.
- **Light-mode active-tab contrast weakness**: `--card` = `--background` = `oklch(0.99 0.004 60)` — 0.025 L-delta inside `bg-muted` tray. Legally compliant (text weight + shadow carry state) but visually weak. Phase 2 candidate: `--card-elevated` token OR `shadow-md + ring-1 ring-border/40` on active.
- **Visual QA deferred**: dev-server + screenshot diff reserved for pre-merge to `development`, not sub-sortie internal commit.

## Next Steps

1. **Merge to `campaign/helpdesk`** via `close-feature.sh` (this closure).
2. **Phase 2** (`feat/helpdesk-nordic-split-phase-2`, already executed on wt-2) — organization klynge, 442 refs, awaiting parallel closure.
3. **Phase 2.5** (future sub-sortie, needs council): design new semantic tokens for brand signals (`bg-signal-live`, `bg-signal-warning` etc.) + `--card-elevated` OR active-state recipe + resolve hardcoded oklch values.
4. **Phase 3** (future sub-sortie, mechanical): schedule + reports + my-schedule + handbook + scrape + `page.tsx` — ~957 refs across the remaining files.
5. **CI grep gate** (recommended): add to close-feature script — reject new `zinc-*` / `gray-*` / `slate-*` introductions in already-migrated files.

## Migration Stats

| File | Zinc refs | Line Δ |
|---|---|---|
| `DashboardShell.tsx` | 67 → 0 | −52 |
| `GlobalSearchPalette.tsx` | 32 → 0 | −73 |
| **Total** | **99 → 0** | **−125** |

## Commits

```
52c80a1d  docs(council): log Nordic Split Phase 2 execution
1321190e  docs(council): log Nordic Split Phase 1 post-implementation review
58c517cd  docs(nordic-split-phase-1): mark journey verified and plan done
8ff0eae4  refactor(design-tokens): migrate GlobalSearchPalette to Nordic Split tokens
44eb5188  refactor(design-tokens): migrate DashboardShell to Nordic Split tokens
3ff47fd0  docs(nordic-split-phase-1): declare plan + journey + spec
```

## Gates

- ✅ Journey `admin-ser-konsistent-shell` verified
- ✅ Grep: 0 zinc/gray/slate in both files (post-commit)
- ✅ Typecheck: 0 errors (`pnpm --filter web typecheck`)
- ✅ Lint: 0 errors, 8 pre-existing warnings (none introduced)
- ✅ Code review (independent): 3 P1s, all verified as false positives or intentional defers
- ✅ Design review (Nordic Split): PASS WITH NOTES (Phase 2 backlog)
- ✅ Council (post-implementation): APPROVE WITH NOTES (4/4 reviewers converged)
- ✅ Scope: only 2 .tsx files + 3 docs modified; 0 mobile files; 0 channel/chat logic
- ⏳ Visual QA: deferred to pre-merge gate (requires dev server)
