---
title: "Plan — ui-shell debt closeout"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [plan, sidebar, page-polish, ui-shell, debt]
---

# Plan — ui-shell debt closeout

> Branch: `feat/ui-shell-debt-closeout` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-16

## Goal

Close 2 inherited debt items from earlier ui-shell sub-sorties:
1. Sidebar testids + S12 protocol gate upgrade (HANDOFF-sidebar-reorg debt #1+#2)
2. SectionEditor thread real `isVisible` + `websiteIsLive` from parent (HANDOFF-website-polish MEDIUM debt #1)

Both small + related class ("tighten previous work"). Sequential gates, single sub-sortie.

## Scope

In scope:
- Add 11 `data-testid` attributes to sidebar elements (DashboardShell + SidebarGroup + DisabledNavItem per commit `2134653cf` mission-draft)
- Upgrade S12 protocol gates from `url_match` → `ui_state` per protocol-writer missing-testid list
- Thread `isVisible` + `websiteIsLive` from WebsiteOverview/parent through to SectionEditor → bridge tools
- Remove HACK comments added in commit `1943551ac`

Out of scope:
- Per-orphan-route polish (next sub-sortie `admin-pos-accounts-polish`)
- i18n migration
- Mobile parity (ADR-0133: sidebar + page editor are web-only authoring)

## Tasks

### Track 1 — Sidebar testids

- [ ] Read commit `2134653cf` mission-draft for canonical testid list (11 attrs)
- [ ] Add `data-testid="sidebar-nav"` to `<nav>` wrapper in DashboardShell.tsx
- [ ] Add `data-testid="sidebar-group-{slug}"` to SidebarGroup.tsx header per group
- [ ] Add `data-testid="sidebar-disabled-{route}"` to DisabledNavItem instances
- [ ] Add `data-testid="sidebar-item-{slug}"` to NavItem instances for active links
- [ ] Verify `data-disabled="true"` attribute present on disabled placeholders

### Track 2 — S12 protocol gate upgrade

- [ ] Read existing S12 spec (apps/e2e/spec or .protocol_test for sidebar)
- [ ] Replace `url_match` assertions with `ui_state` selectors using new testids
- [ ] Specifically: assert `[data-testid="sidebar-disabled-rutiner"][data-disabled="true"]` for direct verification of disabled-state
- [ ] Run S12 protocol — 23/23 must still pass

### Track 3 — SectionEditor defaults thread-through

- [ ] Identify parent component(s) that own `website` + `is_visible` state (WebsiteOverview owns website; PageList may own per-page visibility)
- [ ] Pass real `websiteIsLive` from WebsiteOverview down to SectionEditor (or through router-fetched page data)
- [ ] Pass real `isVisible` per page from PageList → SectionEditor
- [ ] Remove HACK comments in `apps/web/src/app/dashboard/website/_components/SectionEditor.tsx:52,61`
- [ ] Verify Botsson `getPageState`/`getSaveActionState` returns accurate values via manual probe

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors (website + sidebar trees)
- [ ] `pnpm --filter web site-map:validate` exits 0
- [ ] S12 sidebar protocol 23/23 green
- [ ] All 11 testids present in DOM (grep test or manual check)
- [ ] HACK comments removed from SectionEditor.tsx
- [ ] 2 user journeys written + verified
- [ ] HANDOFF written

## Risks

- Threading `websiteIsLive` requires fetching website row at page-editor level OR passing via context — pick lighter option
- S12 upgrade may surface other testid gaps (already-passing url_match could fail ui_state stricter check)
- Sidebar testid placement may collide with existing aria-* / role attrs — verify accessibility unchanged

## Next

Execute sequentially: Track 1 → Track 2 → Track 3. Each track verifiable independently.
