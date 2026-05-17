---
title: "Plan — i18n-cleanup"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [plan, ui-shell, i18n, sidebar, council-verified, campaign-ui-shell]
---

# Plan — i18n-cleanup

> Branch: `feat/ui-shell-i18n-cleanup` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-17

## Goal

Migrate 59 hardcoded Norwegian sidebar labels in `sidebar-config.ts` to i18n keys (nb + en) per **council verdict 2026-05-17**. Closes M8 campaign debt #7 (i18n hardcoded labels). Debt #5 (stale `PLAN-sidebar-reorg.md` duplicate) is a no-op — file doesn't exist (T0 verified).

## Council Decision (Phase 5 synthesis)

**Verdict:** APPROVE Option B (`dashboard.sidebar.*` sub-object in existing `dashboard.json`) with hard cutover.

Phase 3: Steward proposed Option A (standalone `sidebar.json`); Supervisor + Frontend-designer proposed Option B with different mechanics. Phase 5 steward synthesis: Phase 3 claim "20-of-20 standalone convention" was PARTIALLY FALSE — `dashboard.nav` already exists, so sidebar already has a dashboard-internal home. Hard cutover chosen over optional+fallback because L-0176 docstring-vs-body drift class shows optional fields rot.

## Scope

**In scope:**
- Migrate 59 hardcoded labels in `apps/web/src/components/dashboard/sidebar-config.ts` to `labelKey: string` references
- Add `dashboard.sidebar.*` sub-object to `packages/i18n/locales/nb/dashboard.json` + `packages/i18n/locales/en/dashboard.json` with 59 keys each (118 total)
- Update `SidebarItem` + `SidebarGroupDef` types: `label: string` → `labelKey: string` (REQUIRED, not optional)
- Update `apps/web/src/components/dashboard/SidebarGroup.tsx` to resolve via `t(labelKey)` ONCE per item/group
- Preserve proper nouns via 1:1 keys (`item_mr_botsson: "Mr. Botsson"` in both locales)

**Out of scope:**
- `apps/web/src/components/dashboard/NavItem.tsx` (must NOT be touched per council guard — receives resolved string)
- `packages/i18n/src/translate.ts` (must NOT be touched — using existing dashboard namespace)
- Standalone `sidebar.json` file (rejected by council)
- Optional `i18nKey?: string` pattern (rejected by council — hard cutover)
- Mobile sidebar i18n (separate concern per ADR-0133)
- Lint rule for nb/en key-set parity (council-noted follow-up sortie)
- Stale plan delete (file doesn't exist, no-op)

## Council Conditions (7 — MANDATORY)

1. All 59 keys in one commit, `label: string` → `labelKey: string` REQUIRED
2. Proper nouns get 1:1 keys (`item_mr_botsson`, `item_pos_lightspeed`, `item_mr_botsson` etc.) — Norwegian + English copy identical for proper nouns
3. Single resolution in `SidebarGroup`; `NavItem.tsx` untouched
4. Flat keys: `dashboard.sidebar.group_oversikt`, `dashboard.sidebar.item_ansatte` — no nesting
5. EN copy ≤ 22 characters per label (frontend-designer constraint for sidebar width)
6. NO edits to `translate.ts`
7. Pre-merge grep `label:` in `sidebar-config.ts` → zero matches (hard cutover proof)

## Tasks

- [ ] **T1** — Read `dashboard.json` (nb + en), find `nav` sub-object placement
- [ ] **T2** — Compile 59-key mapping (label NO → key → label EN), draft proper-noun list (Mr. Botsson, POS Lightspeed, Stripe, etc.)
- [ ] **T3** — Add `dashboard.sidebar.*` sub-object to BOTH `dashboard.json` files
- [ ] **T4** — Update `SidebarItem` + `SidebarGroupDef` types: rename `label` → `labelKey`
- [ ] **T5** — Update 59 entries in `sidebar-config.ts` to use `labelKey: "item_ansatte"` etc.
- [ ] **T6** — Update `SidebarGroup.tsx` to resolve via `t()` (single resolution site, pass resolved string to NavItem)
- [ ] **T7** — Sanity: grep `label:` in sidebar-config.ts → 0; typecheck → 0 errors; site-map:validate exit 0
- [ ] **T8** — G4 sonnet code-reviewer pass
- [ ] **T9** — HANDOFF + close-feature

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] `grep "label:" apps/web/src/components/dashboard/sidebar-config.ts` → 0 hits
- [ ] `grep "labelKey:" apps/web/src/components/dashboard/sidebar-config.ts` → 59+ hits
- [ ] `dashboard.json` (nb) has `sidebar` sub-object with 59 keys
- [ ] `dashboard.json` (en) has `sidebar` sub-object with 59 keys (length ≤ 22 chars each)
- [ ] `NavItem.tsx` unchanged (`git diff` shows no edits to this file)
- [ ] `translate.ts` unchanged
- [ ] Primary journey verified (feature: i18n-cleanup, status: verified)
- [ ] HANDOFF written
- [ ] G4 APPROVE

## Risks

- **L-0176 drift** if any agent adds optional fields anyway — council guard rejects optional, hard cutover only
- **EN length budget** — some labels like "HMS-oversikt" could exceed 22 chars in EN; agent must verify each
- **Test breakage** — `sidebar-config.test.ts` (claimed in HANDOFF-sidebar-reorg but verified non-existent by supervisor) — if it does exist as a phantom, label assertions will break
- **Proper noun list** — frontend-designer flagged "Mr. Botsson", "POS Lightspeed". Agent must scan all 59 labels for proper nouns + brand terms

## Next

Single sonnet build agent dispatched with 7 council conditions. No parallel — single file ownership, no track split needed.
