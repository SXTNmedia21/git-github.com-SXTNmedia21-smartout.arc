---
title: "Slice 11 — Performance & Design Audit"
status: done
updated: 2026-05-18
created: 2026-05-18
module: performance-design
tags: [audit, adr-0019, adr-0366, performance, design-tokens, oklch, motion]
---

# Slice 11 — Performance & Design Audit

**Surface:** `apps/web/next.config.ts` · `packages/design-tokens/` · `apps/web/src/app/globals.css`
**ADRs:** ADR-0019 (performance governance), ADR-0366 (OKLCH literal ban)
**Date:** 2026-05-18

---

## 1. next.config.ts — PASS with notes

`optimizePackageImports` covers 13 packages including the high-traffic ones: `lucide-react`, `framer-motion`, `recharts`, `@dnd-kit/*`, `@smartout/ui`, `date-fns`, `posthog-js`. Coverage is good.

`serverExternalPackages` correctly externalises `posthog-node` (Node.js I/O) and `livekit-client` (WebRTC). Webpack fallback for `posthog-node` on client builds is also present (lines 100–105). No redundancy issues.

Turbopack `resolveAlias` and Webpack `resolve.alias` are in sync (11 `@smartout/ai` subpaths each). Duplication is intentional — different bundlers, same target paths.

`typescript.ignoreBuildErrors: false` is correctly set per ADR-0019 (was `true` in first-rollout workaround, restored to `false` per SMA-353 comment).

**Concern (low):** `perf-budgets.json` lists only 4 routes. ADR-0019 requires budgets per route. High-complexity routes added since 2026-02-28 (`/dashboard/hms`, `/dashboard/komm/*`, `/dashboard/year-wheel`, `/dashboard/season/*`) are not covered. The ADR mandates agent teams update budget files when adding route complexity.

---

## 2. design-tokens — PASS

`packages/design-tokens/src/tokens.ts` is the single source of truth. All OKLCH values are defined here and mirrored to `tokens.css`. The comment in `tokens.css` states "AUTO-DERIVED from tokens.ts — change values in tokens.ts, update here." Sync between the two files appears manual (no generator script was found), but values are consistent across the sample checked.

`native.ts` (React Native) correctly provides non-OKLCH equivalents for platform compatibility.

Motion tokens (`motion.spring`, `motion.springSnappy`, `motion.springGentle`, easing arrays) are fully defined at `tokens.ts:195–215`.

---

## 3. globals.css — ADR-0366 VIOLATIONS PRESENT

ADR-0366 bans OKLCH literals in component scope — they must live exclusively in token files or `globals.css` `@theme` / `@layer base` blocks.

`globals.css` itself contains OKLCH literals **outside** the allowed `@theme inline` and `@layer base` blocks:

| Line | Context | Violation |
|------|---------|-----------|
| 381 | `.scroll-overlay:hover::-webkit-scrollbar-thumb` | `oklch(0.5 0 0 / 0.2)` — hardcoded inline |
| 414 | `.sk-bone::after` gradient | `oklch(0.88 0.012 50 / 0.38)` — should reference `--muted` or a token |
| 430–446 | `[data-document-mode]` vars | 10 `oklch(...)` literals in custom property definitions |
| 440–447 | `.dark [data-document-mode]` vars | 6 `oklch(...)` literals |
| 502–503 | `blockquote` fallback | `oklch(0.7 0.15 55)` as fallback value |
| 511 | `mark` highlight | `oklch(0.88 0.12 85 / 0.4)` hardcoded |

**Note:** The `@theme inline` block (lines 92–116) is the *correct* location for new tokens and those OKLCH values there are compliant. The `[data-document-mode]` block and utility classes outside `@theme`/`@layer base` are the violations.

---

## 4. ADR-0366 violations in components — HIGH SEVERITY

`grep oklch( apps/web/src/**/*.tsx **/*.ts` (excluding token/config files) returns **283 hits across ~50 files**.

Top offenders:

| File | Hit count | Pattern |
|------|-----------|---------|
| `DashboardShell.tsx` | ~30 | Inline Tailwind arbitrary `[oklch(...)]` values |
| `SlotPicker.tsx` | ~12 | Per-slot-type color classes |
| `ApplyTemplateDialog.tsx` | ~9 | Same pattern as SlotPicker |
| `NavItem.tsx` | ~8 | Light-mode conditional `text-[oklch(...)]` |
| `WorkspaceSwitcher.tsx` | ~12 | isDark ternary with OKLCH literals |
| `SavedTimelinesDropdown.tsx` | ~6 | Slot color classes |
| `LighthouseAvatar.tsx` | 3 | Inline `style={}` OKLCH |
| `WelcomeWizard.tsx` / `DoneStep.tsx` | 2 | Gradient |

The dominant pattern is `bg-[oklch(x_y_z)]` / `text-[oklch(x_y_z)]` in Tailwind arbitrary values for light-mode conditional rendering. These should be CSS variable tokens registered in `tokens.css` and referenced via `bg-[var(--token)]`.

---

## 5. Motion tokens — PARTIAL COMPLIANCE

`motionTokens` is imported and used correctly in `EntityDrawer`, `SlotPicker`, `SlotQuickAddPopover`.

However, 19+ files contain **inline spring magic numbers**:

- Exact canonical values (35/22/2.2) repeated verbatim in `WelcomeWizard`, `DoneStep`, `StripeRedirectInterstitial`, `ActivityView`, `NotificationBell`.
- Non-canonical values with no token backing: `stiffness: 250` (`KpiPillGrid`), `stiffness: 400` (`OtpVerificationForm`), `stiffness: 300, damping: 15` (`login/page.tsx`).
- `SwipeReconciliation` uses `{ type: "spring", damping: 15 }` / `damping: 20` bare.

Non-canonical values are the higher concern — they drift from the Nordic Split motion spec silently.

---

## 6. Legacy color formats — LOW

- `globals.css` lines 348–351, 527–533: `rgba(255, 107, 53, ...)` in `glow-pulse` keyframes — should use CSS variable `--brand-orange`.
- `DashboardShell.tsx` lines 1503–1524: `rgba(249,115,22,0.3)` in Tailwind shadow arbitrary values.
- `GlobalCallAlert.tsx`: `rgba(24,24,27,...)` / `rgba(34,197,94,...)` in framer-motion inline styles.
- `ReconciliationView.tsx` lines 540/546: fallback `"#6366f1"` hex hardcode.
- `global-error.tsx`: `"#666"` / `"#999"` — emergency error page, lower priority.
- `PunchButton.tsx`: `"#00b894"`, `"#5b9bd5"` in a color array — should map to `--dept-*` tokens.

---

## Summary

| Area | Status | Count |
|------|--------|-------|
| next.config.ts optimizePackageImports | PASS | — |
| ADR-0019 perf-budgets coverage | WARN | 4 routes covered, missing ~8 high-complexity routes |
| design-tokens single source | PASS | — |
| globals.css — OKLCH outside @theme | FAIL | ~18 violations |
| Component OKLCH literals (ADR-0366) | FAIL | 283 occurrences, ~50 files |
| Motion token usage | PARTIAL | ~19 files with inline magic numbers |
| Legacy rgba/hex literals | LOW | ~15 occurrences |

**Recommended sortie:** Create CSS variable tokens for the recurring OKLCH patterns in `DashboardShell`, `NavItem`, `WorkspaceSwitcher`, `SlotPicker`, `ApplyTemplateDialog`, `SavedTimelinesDropdown`, and migrate the `[data-document-mode]` OKLCH literals in `globals.css` into `tokens.css`. Estimate: 1 sub-sortie, ~4–6 token additions.
