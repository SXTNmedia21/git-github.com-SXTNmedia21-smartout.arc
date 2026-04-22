---
title: "Plan — helpdesk shared primitives"
status: in_progress
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [plan, helpdesk, ui, design-tokens, i18n, phase-1]
---

# Plan — helpdesk shared primitives

> Branch: `feat/helpdesk-shared-primitives` | Worktree: `/home/sxtnl/dev/smartout.ai-helpdesk-wt-1`
> Base: `campaign/helpdesk` | Module: Helpdesk | Started: 2026-04-20
> Spec: `docs/superpowers/specs/2026-04-20-helpdesk-phase-1-ui.md` §4.4 (shared primitives) + §4.2 (i18n) + Spec 3 Token Map (native tokens)

## Goal

Ship the dual-platform presentational primitives (`ResponsibilityOrb`,
`LighthouseAvatar`, `OrphanBadge`, `StatusLabel`) plus helpdesk i18n
dictionary and native orb color tokens so that the web and mobile
sub-sorties can compose against a stable foundation.

## Scope

Included:
- `packages/ui/src/helpdesk/` — 4 primitives, each as `.tsx` (web) + `.native.tsx` (RN), plus `types.ts` + barrel `index.ts`.
- `packages/ui/src/index.ts` — re-export the helpdesk barrel.
- `packages/ui/package.json` — peer deps on `react-native`, `react-native-svg`, `expo-linear-gradient`, `react-native-reanimated` (optional peers — only mobile consumers pay).
- `packages/i18n/locales/{nb,en}/helpdesk.json` — dictionary per Spec §4.2.
- `packages/design-tokens/src/native.ts` — orb color tokens + radii/spacing additions per Spec §3.7.

Excluded (other sub-sorties):
- Web desks admin page, ticket conversation view → `feat/helpdesk-web`.
- Mobile queue tab, ticket detail, FAB, ResolveSheet → `feat/helpdesk-mobile`.

## Tasks

- [x] Scaffold sub-sortie (`new-feature.sh`)
- [ ] `packages/ui/src/helpdesk/types.ts` — `TicketStatus` enum, shared `OrbProps` interface.
- [ ] `packages/ui/src/helpdesk/ResponsibilityOrb.tsx` (web) — CSS radial-gradient + optional breathing pulse (framer-motion) + reduced-motion gate.
- [ ] `packages/ui/src/helpdesk/ResponsibilityOrb.native.tsx` (RN) — `react-native-svg` `<RadialGradient>` + reanimated pulse.
- [ ] `packages/ui/src/helpdesk/LighthouseAvatar.tsx` + `.native.tsx` — avatar wrapped in `ResponsibilityOrb`.
- [ ] `packages/ui/src/helpdesk/OrphanBadge.tsx` + `.native.tsx` — dashed 1px border + `AlertCircle` (lucide) + label.
- [ ] `packages/ui/src/helpdesk/StatusLabel.tsx` + `.native.tsx` — uppercase mono status label primitive.
- [ ] `packages/ui/src/helpdesk/index.ts` — barrel.
- [ ] `packages/ui/src/index.ts` — re-export helpdesk barrel.
- [ ] `packages/ui/package.json` — add optional peer deps for RN surface.
- [ ] `packages/i18n/locales/nb/helpdesk.json` — Norwegian dictionary per Spec §4.2.
- [ ] `packages/i18n/locales/en/helpdesk.json` — English dictionary per Spec §4.2.
- [ ] `packages/design-tokens/src/native.ts` — `colors.orb.*`, `radii.sheetHandle|fab|card`, `spacing.fabOffsetRight|fabOffsetBottom`.
- [ ] `pnpm turbo typecheck --filter=@smartout/ui --filter=@smartout/design-tokens --filter=@smartout/i18n`.
- [ ] Journey doc `docs/journeys/JOURNEY-helpdesk-shared-primitives.md`.
- [ ] HANDOFF at closure.

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck` (all three packages).
- [ ] Decision log updated (no new ADRs expected — spec-driven).
- [ ] User journeys written (component-consumption journeys).
- [ ] Orb primitive respects `prefers-reduced-motion` on web, `useReducedMotion()` on native (pulse disabled + instant chroma).
- [ ] No inline OKLCH literals in component files — all colors come from `@smartout/design-tokens` (web via CSS vars, native via `nativeTheme.colors.orb.*`).
- [ ] No red. No Lucide icons inside `ResponsibilityOrb`. No `framer-motion` springs outside design-system range (stiffness 30–45, damping 20–24, mass 2–2.5).

## Out of scope

- Storybook stories (Phase 1 minimum = three stories per Spec App B). Stories ship alongside components but are not a blocking acceptance criterion for the sub-sortie.
- SLA phase 2 `slaProgress` prop is declared but ignored (default `undefined`).
