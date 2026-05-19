---
title: "Journey — sidebar testids land and S12 protocol upgrades to ui_state gates"
status: verified
feature: debt-closeout
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, sidebar, testids, s12, ui-shell, campaign-ui-shell]
---

# Journey — sidebar testids land + S12 ui_state gates

> Sub-sortie: `ui-shell-debt-closeout`. Closes HANDOFF-sidebar-reorg debt #1+#2.

## Journey: E2E asserts disabled placeholder via DOM, not URL

**Precondition:** sidebar shipped 2026-05-15 via `feat/ui-shell-sidebar-reorg`. S12 protocol verifies disabled placeholders (Rutiner, Manualer) by `url_match` only — DOM presence not directly asserted.

1. Developer adds `data-testid="sidebar-disabled-rutiner"` + `data-disabled="true"` to DisabledNavItem in sidebar tree → DOM exposes disabled state declaratively
2. S12 protocol upgrades disabled-route assertions from `url_match: "/dashboard/tasks"` (404 check) to `ui_state: { selector: "[data-testid='sidebar-disabled-rutiner']", attr: "data-disabled", expect: "true" }` → assertion fires against rendered DOM
3. S12 run executes 23/23 steps → all pass with stricter ui_state gates → regression that removes `disabled: true` flag in sidebar-config.ts would be caught at DOM level, not just URL level

**Postcondition:** 11 testids present in sidebar DOM. S12 protocol assertions use ui_state for disabled-state. Removal of disabled flag = direct test failure.

**Error paths:**
- Testid attr collides with aria-* role → fix by using distinct attr (data-testid scope)
- S12 selector doesn't match rendered DOM → re-grep testid name + S12 spec for typo
- New ui_state assertions fail on existing pass-by-url-match cases → review whether url_match was masking a real defect

## Verification

- `grep -rn "data-testid=\"sidebar-" apps/web/src/components/dashboard/` → ≥11 hits
- `grep -rn "data-disabled=\"true\"" apps/web/src/components/dashboard/` → present on DisabledNavItem
- S12 protocol run (apps/e2e or wherever it lives) → 23/23 green with ui_state gates
- No accessibility regression — `data-testid` is non-semantic; aria-* attrs unchanged

## E2E (recommended)

S12 protocol IS the E2E for this journey. Upgrade in place.
