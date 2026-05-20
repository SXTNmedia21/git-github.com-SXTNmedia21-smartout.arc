---
title: "Plan — design-token-sweep"
status: in_progress
updated: 2026-05-19
created: 2026-05-19
module: Mobile
tags: [plan, design-tokens, nordic-split]
---

# Plan — design-token-sweep

> Branch: `feat/mobile-design-token-sweep` | Worktree: /home/sxtnl/dev/smartout.ai-mobile-wt-4 | Base: `campaign/mobile` | Module: Mobile | Started: 2026-05-19

## Goal

Replace all hardcoded color literals (hex, rgba, OKLCH) in mobile components with design tokens
from the Nordic Split palette, following ADR-0366 mobile equivalent rules.

## Token Mapping

| Hardcoded literal | Semantic token | Rationale |
|---|---|---|
| `"#11ad32"` | `theme.colors.success` | status.active is same value; success is correct semantic |
| `"#8b5cf6"` / `rgba(139,92,246,…)` | `theme.colors.brandPurple` + `withOpacity` | Overtime supplement badge |
| `"#f97316"` / `rgba(249,115,22,…)` | `theme.colors.brandOrange` + `withOpacity` | Evening/weekend supplement badge |
| `token + "1A"` | `withOpacity(token, 0.1)` | `"1A"` hex = 26/255 ≈ 0.10 opacity |
| `"#ffffff"` on colored bg | `theme.colors.primaryForeground` | Text/icons on brandOrange buttons |
| `"rgba(255,255,255,0.N)"` on colored bg | `withOpacity(theme.colors.primaryForeground, N)` | Overlay/icon on colored card |
| `withOpacity("#000000", 0.1)` | `withOpacity(theme.colors.foreground, 0.1)` | Dark mode noise overlay |
| `withOpacity("#ffffff", 0.05)` | `withOpacity(theme.colors.background, 0.05)` | Light mode noise overlay |
| `shadowColor: "#000"` | `shadowColor: SHADOW_COLOR` | Module-level constant in theme/index.ts |

## Tier 1 — Tier 1 (payroll + HMS + shift-clock)

- [x] PayslipScreen.tsx: badge rgba + hex purple/orange → brandPurple/brandOrange + withOpacity
- [x] PayslipScreen.tsx: `color="#11ad32"` × 2 → `theme.colors.success`
- [x] HACCPForm.tsx: `success + "1A"` + `destructive + "1A"` → withOpacity
- [x] HoursConfirmation.tsx: `warning + "1A"` → withOpacity
- [x] HandoffForm.tsx: `success + "1A"` → withOpacity

## Tier 2 — Home shift views + theme shadow

- [x] DuringShiftView.tsx: `"#ffffff"` × 3 → primaryForeground
- [x] DuringShiftView.v2.tsx: `"#ffffff"` × 3, `withOpacity("#000000"…)`, `withOpacity("#ffffff"…)` → tokens
- [x] BeforeShiftView.tsx: `"#ffffff"` × 2, `rgba(255,255,255,…)` × 5, special `rgba(255,219,204,0.8)` → tokens
- [x] AfterShiftView.tsx: `"#ffffff"` → primaryForeground
- [x] theme/index.ts: `shadowColor: "#000"` × 3 → SHADOW_COLOR constant

## Tier 3 — Deferred

- [ ] Channels feature: CallBar, IncomingCallScreen, ParticipantTile, PTTButton → follow-up sortie `mobile-channels-design-token-sweep`
- [ ] push.ts: `lightColor: "#FF6B35"` → native notification config, defer

## Acceptance Criteria

- [x] `pnpm --filter @smartout/mobile typecheck` passes with 0 errors
- [x] Tier-1 + Tier-2 grep count drops from 65 to ≤ remaining theme + BeforeShiftView deliberate rgba
- [x] User journeys written
- [x] Handoff written
