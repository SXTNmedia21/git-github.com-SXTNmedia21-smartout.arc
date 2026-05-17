---
title: "Journey — Sidebar labels resolve through i18n (nb + en parity)"
status: verified
feature: i18n-cleanup
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, i18n, sidebar, council-verified, campaign-ui-shell]
---

# Journey — Sidebar labels resolve through i18n

> Sub-sortie: `ui-shell-i18n-cleanup`. M8 of campaign/ui-shell. Council-verified verdict 2026-05-17 (Option B + hard cutover).

## Journey: Admin sees Norwegian sidebar today, English-locale admin sees translated labels post-migration

**Precondition:** Admin signed in. Sidebar M1 (sidebar-reorg) shipped 9-group navigation. Pre-this-sortie, all 59 labels are hardcoded Norwegian strings in `sidebar-config.ts`. EN locale switching produces NO change in sidebar (labels stay Norwegian).

1. Admin loads `/dashboard` on Norwegian locale → DashboardShell mounts → SidebarGroup renders → for each group + item, resolves `t(group.labelKey)` + `t(item.labelKey)` once → displays "Drift", "Vaktplan", "HMS & Compliance", etc.
2. Admin switches locale to English → same SidebarGroup re-renders → `t()` now resolves from `dashboard.json` (en) → displays "Operations", "Schedule", "Health, Safety & Compliance", etc.
3. Proper nouns ("Mr. Botsson", "POS Lightspeed") render identically in both locales — their keys map to identical strings in nb + en JSON
4. NavItem receives the resolved string via prop — no `t()` call inside NavItem (single resolution site at SidebarGroup level)
5. Collapsed sidebar tooltip shows resolved string (same prop)
6. aria-label uses same resolved string (parity preserved)
7. Disabled placeholder items ("Rutiner", "Manualer") still resolve through `t()` — visual treatment unchanged, labels honor locale

**Postcondition:** Sidebar fully bilingual. 0 hardcoded `label:` entries in `sidebar-config.ts`. NavItem and translate.ts unchanged per council constraints. 22-char EN budget honored for collapsed-sidebar layout.

**Error paths:**
- Missing key in dashboard.json → `t()` returns the key string literal (e.g. `"dashboard.sidebar.item_ansatte"`) → visually broken AND aria-broken. Mitigation: typecheck cannot catch this; pre-merge grep for all `labelKey` values verifies key presence in JSON.
- nb/en key-set drift over time → translator parity gap. Mitigation: follow-up lint-rule sortie noted in HANDOFF (deferred per council).
- New sidebar item added without nb+en keys → resolves to key literal, visible debt. Same mitigation as above.

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0 (no impact, but sanity check)
- `grep "label:" apps/web/src/components/dashboard/sidebar-config.ts` → 0 hits (hard cutover proof)
- `grep "labelKey:" apps/web/src/components/dashboard/sidebar-config.ts` → 59+ hits
- `jq '.sidebar | length' packages/i18n/locales/nb/dashboard.json` → 59+
- `jq '.sidebar | length' packages/i18n/locales/en/dashboard.json` → 59+
- `git diff campaign/ui-shell..HEAD -- apps/web/src/components/dashboard/NavItem.tsx` → empty (zero changes per council guard)
- `git diff campaign/ui-shell..HEAD -- packages/i18n/src/translate.ts` → empty (zero changes per council guard)
- EN length check: `jq -r '.sidebar | to_entries[] | "\(.key): \(.value | length)"' packages/i18n/locales/en/dashboard.json | awk -F: '{if ($2 > 22) print}'` → empty (no label > 22 chars)

## E2E (recommended)

S12 protocol already verifies sidebar items reach < 500 (orphan-coverage). Bilingual rendering not in S12 scope. Per-locale Playwright spec deferred to follow-up sortie if Pontus prioritizes EN-locale QA.

## Council learning captured

Chair convention claim "20-of-20 standalone namespace" was PARTIALLY FALSE — `dashboard.nav` already existed inside `dashboard.json`. Same class as L-0176 (docstring vs body drift) — convention claims must be code-traced against module-internal scopes before invoking "N-of-N convention." Promote to learning log if 2nd occurrence. Not ADR-worthy yet.
