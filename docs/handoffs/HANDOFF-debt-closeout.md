---
title: "Handoff — ui-shell debt closeout"
status: ready-for-close
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [handoff, sidebar, page-polish, harness, ui-shell, campaign-ui-shell]
---

# Handoff — ui-shell-debt-closeout

> Sub-sortie of `campaign/ui-shell`. Branch: `feat/ui-shell-debt-closeout`. Worktree: `~/dev/smartout.ai-ui-shell-wt-1`. 4 commits.

## Summary

Closes 2 inherited debt items from prior ui-shell sub-sorties in a single sub-sortie:

1. **Sidebar testids + S12 ui_state gates** — HANDOFF-sidebar-reorg debt #1+#2 (commit `2134653cf` mission-draft)
2. **SectionEditor real `isVisible` + `websiteIsLive`** — HANDOFF-website-polish MEDIUM debt #1 (introduced commit `1943551ac`)

## What shipped

| SHA | Subject |
|---|---|
| `0c3eb9617` | docs: plan + 2 journeys |
| `7bfb65444` | feat(sidebar): testids on nav, groups, items, disabled |
| `d14f5461f` | test(s12): upgrade gates to ui_state |
| `31a615454` | fix(website): SectionEditor sources real visibility + live state |

### Track 1+2 — Sidebar testids + S12 ui_state

- 4 testid injection points in sidebar tree (DashboardShell, SidebarGroup, NavItem) yield ≥11 rendered testids in DOM
- `data-disabled="true"` declarative attr on DisabledNavItem
- 8 `ui_state` gates added to `docs/missions/MISSION-DRAFT-S12.json` (group-header presence + disabled-route DOM assertion)
- S12 stays at 23 steps, no count drift

### Track 3 — SectionEditor real values

- `usePages(websiteId)` invocation inside SectionEditor → `currentPage.is_visible` for `isVisible`
- `useWebsite()` inside SectionEditor → `website?.visibility === "live"` for `websiteIsLive`
- Loading-state fallbacks document inline: `?? true` for visibility, `=== "live"` falsy-on-null for live
- 0 HACK comments remain. 0 literal-default lines remain.
- Pattern reuses existing hooks; no new hook files

## Decisions

1. **Combined 2 debt items in one sub-sortie** — both small (<150 LoC total), related class ("tighten previous work"), shared verification surface (website + sidebar trees independent so no merge conflict between tracks)
2. **No new ADR needed** — both fixes follow existing patterns (testid convention from prior pages, hook reuse for Track 3)
3. **Parallel agent dispatch** — Tracks 1+2 and Track 3 on different file trees (sidebar vs website/_components/SectionEditor). No conflict. SIGTERM cascade rode out via package builds mid-flight

## Learnings

1. **Fresh sub-sortie worktree missing builds, again** — same trap as website-polish (L-worktree-missing-pnpm-symlinks + L-stale-telemetry-dist). New wt-1 created after previous close needed both `pnpm install` AND `pnpm --filter '@smartout/*' build`. Worth promoting to memory as recurring trap with concrete recipe.
2. **SIGTERM cascade is steady noise** — every Edit triggers Stop-hook typecheck; while pre-existing breakage exists in worktree, Stop-hook reports failure on every write. Per L-2026-05-04, exit 143 = concurrent typechecks, not real failure. Agents wrote successfully despite cascade.
3. **Real-data threading via existing hooks > new hooks** — Track 3 reused `usePages` + `useWebsite` already mounted in WebsiteOverview ancestors. No new fetch layer. Visibility + live state come from existing query cache. Pattern: when adding "thread real value" follow-up, first check whether parent hook already returns the field — usually does.
4. **S12 protocol upgrade in place is cheap** — 8 url_match → ui_state replacements in a single JSON file. Test-protocol grammar handles it natively. Pattern for future polish work: write DOM testids first, then upgrade S12 in same commit set.

## Known issues / debt

None remaining from ui-shell campaign top-segment polish. Sub-route depth polish (komm/desks, komm/oversikt, hms/training etc.) still pending — doc-only run.yml gaps, not gated. Defer to dedicated sortie.

## Next steps

1. Pontus runs `close-feature.sh` from `~/dev/smartout.ai-ui-shell-wt-1` — merges `feat/ui-shell-debt-closeout` → `campaign/ui-shell` + syncs `development` into campaign.
2. Optional next sortie: `admin-pos-accounts-polish` — last unpolished orphan top-segment per ui-shell inventory.
3. Campaign:ui-shell now decision-point — once admin-pos-accounts shipped, campaign milestone-ready.

## Verification (close-feature gate evidence)

- 11+ testids rendered: confirmed by 4 distinct injection points × variable group/item counts per render
- `[data-disabled="true"]` declarative attr present on DisabledNavItem
- S12 JSON valid, 23 steps preserved
- HACK comments removed from SectionEditor.tsx
- 0 literal `isVisible: true,` / `websiteIsLive: false,` lines
- `pnpm --filter web site-map:validate` → 51 routes, 74 useRegisterTools, exit 0
- 2 journeys with `feature: debt-closeout` + `status: verified` — Journey Guardian gate ready

## Mobile parity check (ADR-0133)

Sidebar testids = test-infra only (no UI behavior change). SectionEditor real-value threading is web-only page editor (D1–D5 compose). Mobile owns D6 Approve/Execute. `mobile_parity: web_only` for both tracks.
