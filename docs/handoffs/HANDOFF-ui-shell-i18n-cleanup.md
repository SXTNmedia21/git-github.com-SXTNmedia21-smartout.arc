---
title: "Handoff — i18n-cleanup"
status: ready-to-merge
feature: i18n-cleanup
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [handoff, ui-shell, i18n, sidebar, council-verified, campaign-ui-shell]
---

# Handoff — ui-shell i18n-cleanup

Sub-sortie of `campaign/ui-shell`. Branch: `feat/ui-shell-i18n-cleanup`. Base: `campaign/ui-shell`.

Key commits:
- `0afb19762` — plan + journey + council verdict
- `35ecd2f52` — migration (59 sidebar labels → i18n keys)
- `e11976672` — G4 fix (DisabledNavItem hardcoded Norwegian strings)

---

## What Was Built

Migrated all hardcoded Norwegian sidebar labels in `apps/web/src/components/dashboard/sidebar-config.ts` to i18n keys, establishing `dashboard.sidebar.*` as the canonical translation namespace for sidebar UI copy.

### Scope

- **59 hardcoded Norwegian strings** in `sidebar-config.ts` replaced with `labelKey` references
- **56 flat keys** added under `dashboard.sidebar.*` in both `packages/i18n/locales/nb/dashboard.json` and `packages/i18n/locales/en/dashboard.json`
  - 54 group/item label keys
  - 2 disabled-state keys: `disabled_tooltip` + `disabled_badge`
- **Type change:** `SidebarItem.label` + `SidebarGroupDef.label` renamed to `labelKey` (required `string`, no optional fallback)
- `SidebarGroup.tsx` resolves `t(labelKey)` once per item/group, passes resolved string to `NavItem` via existing `label` prop — zero changes to `NavItem.tsx`
- `DisabledNavItem` receives resolved tooltip + badge as props (single-resolution pattern preserved)
- `DashboardShell.tsx` key prop updated: `group.label` → `group.labelKey`
- Test fixtures updated in `__tests__/SidebarGroup.test.tsx` + `__tests__/sidebar-config.test.ts`

---

## Council Conditions — Final Verification

7 mandatory conditions from `docs/plans/PLAN-i18n-cleanup.md`. All pass.

| # | Condition | Status |
|---|-----------|--------|
| 1 | Type change required, no optional fallback — `labelKey: string` | PASS |
| 2 | Proper nouns 1:1 (Mr. Botsson, POS Lightspeed, Templates, Analytics, Desks, Policies, AI & Botsson) | PASS |
| 3 | Single `t()` call per render — NavItem.tsx untouched (0 diff lines) | PASS |
| 4 | Flat keys under `dashboard.sidebar.*` — 56 flat string values, no nesting | PASS |
| 5 | EN ≤ 22 chars — 0 violations | PASS |
| 6 | `translate.ts` untouched — 0 diff lines | PASS |
| 7 | Zero `label:` on SidebarItem/SidebarGroupDef in sidebar-config.ts | PASS |

---

## G4 Code Review

Conducted by `feature-dev:code-reviewer` (sonnet). 3 findings.

**HIGH — Fixed in `e11976672`:**
`DisabledNavItem` had hardcoded `"Kommer snart"` tooltip and `"Snart"` badge strings, leaking Norwegian to EN locale. Fixed by adding 2 keys (`disabled_tooltip`, `disabled_badge`) to both locale files and wiring them through as resolved-string props to `DisabledNavItem`.

**HIGH — Deferred:**
Test assertions are structural-only. Fixtures use raw `labelKey` strings that survive the mock's fallback behavior (`t(key) → key`), so tests cannot distinguish "translation was called" from "raw key was rendered." Suggested fix: explicit `useTranslation` mock that prefixes returned strings (e.g. `"[translated] X"`). Deferred — outside council scope, not a regression risk. Tackle in a follow-up sortie alongside a Playwright EN-locale spec.

**LOW — Deferred:**
`item_oversikt` key is reused for both a group header and the dashboard home item. Functionally identical today, but conflates two distinct UI elements. Defer — naming-accuracy refactor only, no user-visible impact.

---

## Decisions

No new ADR. Council verdict encodes all architectural decisions for this sub-sortie and is registered in `docs/plans/PLAN-i18n-cleanup.md`. The type rename from `label` to `labelKey` is a breaking change within the campaign scope — no external consumers outside dashboard sidebar components.

---

## Learnings

**Council claim drift — convention claims must be code-traced against module-internal scopes.**
Chair stated "20-of-20 standalone namespace convention" for `dashboard.json`, but `dashboard.json` already contained a `nav` sub-object internally. Same class as L-0176 (docstring vs body drift). Not promoted to learning log yet — promote on 2nd occurrence.

**Worktree dist symlinks missing on session resume.**
`pnpm install` reported "Already up to date" but `node_modules/@smartout/{telemetry,types,ai}/dist/` were absent. Required `pnpm turbo build --filter='@smartout/*' --force` to populate. Existing memory entries `L-worktree-missing-pnpm-symlinks` + `L-stale-telemetry-dist` cover this class — no new entry needed.

**Build agent extended scope responsibly.**
Agent edited `DashboardShell.tsx` (1 line: `group.label` → `group.labelKey` key prop) and 2 test files — not in the original "allowed files" list, but required for the type rename to typecheck cleanly. Validated by spot-check + G4. Pattern: when a type rename has callsites, the build agent is expected to update them without separate instruction.

---

## Known Issues / Debt

**Test assertions structural-only** (G4 #2).
`__tests__/SidebarGroup.test.tsx` mocks `useTranslation` with fall-through behavior. Cannot distinguish translation being called from a raw key being rendered. Recommend improving to a prefix-mock in a follow-up sortie, or rolling into a Playwright EN-locale spec sortie.

**No lint rule for nb/en key-set parity.**
Council-noted follow-up, not in this sortie. A new sidebar item added without matching nb+en keys silently breaks the EN locale. Suggest ESLint custom rule scanning `sidebar-config.ts` for `labelKey:` values and cross-referencing both JSON files.

**`item_oversikt` key collision** (G4 #3).
Naming-accuracy refactor only. Defer until product needs to diverge group header from dashboard home item copy.

**Mobile sidebar i18n out of scope.**
ADR-0133 explicitly excluded. Mobile uses the 5-tab Approve/Execute layout; no sidebar parity required.

---

## Files Changed

```
apps/web/src/components/dashboard/sidebar-config.ts
apps/web/src/components/dashboard/SidebarGroup.tsx
apps/web/src/components/dashboard/DashboardShell.tsx
apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx
apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts
packages/i18n/locales/nb/dashboard.json
packages/i18n/locales/en/dashboard.json
docs/plans/PLAN-i18n-cleanup.md
docs/journeys/JOURNEY-ui-shell-i18n-cleanup-sidebar-labels-migrated.md
docs/HANDOFF-ui-shell-i18n-cleanup.md  ← this file
```

---

## Verification Commands

Rerun-able at any time to confirm state.

```bash
# Typecheck
pnpm --filter web typecheck

# Site-map validation
pnpm --filter web site-map:validate

# No bare `label:` on SidebarItem/SidebarGroupDef (NavIndicator type + indicators warning acceptable)
grep -nE "^\s*label:" apps/web/src/components/dashboard/sidebar-config.ts

# 61 labelKey occurrences (59 entries + 2 type defs)
grep -c "labelKey:" apps/web/src/components/dashboard/sidebar-config.ts

# 56 keys in each locale
jq '.sidebar | length' packages/i18n/locales/nb/dashboard.json
jq '.sidebar | length' packages/i18n/locales/en/dashboard.json

# NavItem.tsx untouched
git diff campaign/ui-shell..HEAD -- apps/web/src/components/dashboard/NavItem.tsx | wc -l

# translate.ts untouched
git diff campaign/ui-shell..HEAD -- packages/i18n/src/translate.ts | wc -l

# EN keys ≤ 22 chars (should be empty)
jq -r '.sidebar | to_entries[] | "\(.value | length) \(.key)"' packages/i18n/locales/en/dashboard.json | awk '$1 > 22'

# No hardcoded Norwegian in DisabledNavItem
grep -nE '"Snart"|"Kommer snart"' apps/web/src/components/dashboard/SidebarGroup.tsx
```

---

## Next Steps

1. Run `close-feature.sh` from inside `/home/sxtnl/wsl/smartout.ai-ui-shell-wt-1` (no arg — auto-detects sub-sortie context, merges to `campaign/ui-shell` per ADR-0213).
2. Sub-sortie merges to `campaign/ui-shell` as merge-commit, preserving ancestry.
3. Worktree removed by close-feature.
4. Update `docs/plans/CAMPAIGN-ui-shell.md` Completed Sub-Sorties table with the merge SHA.
5. M8 (cleanup) milestone complete after this merge — M5/M6/M7 + M9 remain in campaign.
6. Pontus decides whether to tackle deferred debt items (test mock improvement, parity lint rule, `item_oversikt` split) before campaign milestone PR.
