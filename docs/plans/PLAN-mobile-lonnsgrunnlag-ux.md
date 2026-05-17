---
title: Mobile Lønnsgrunnlag UX Polish — S2
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: payroll-mobile
tags: [mobile, payroll, lønnsgrunnlag, ux, flashlist, skeleton, expo-sharing, a11y]
---

# Plan: Mobile Lønnsgrunnlag UX Polish (S2)

## Context

Council verdict 2026-05-16 reversed S2 from REJECT to APPROVE based on a
falsifiable acceptance list from frontend-designer. This plan executes that list.

ADR-0133: mobile is WITNESS-only for payroll — no generation, no admin actions.
ADR-0134: emit() on every mutation (read-only screen; no mutations in scope here).
ADR-0151: profile_id derived server-side, never from route params.

## What exists

- `apps/mobile/app/(app)/(me)/payroll/index.tsx` — payroll hub with inline
  lønnsgrunnlag section (up to 5 items rendered via `.map()`, no virtualisation)
- `apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx` — detail screen
  using `Linking.openURL` for PDF. No skeleton — layout shift on first load.
- `apps/mobile/src/hooks/queries/use-lonnsgrunnlag.ts` — data hooks.
- `@shopify/flash-list` — NOT yet in package.json.
- `expo-sharing` — NOT yet in package.json.

## What we build

### A. List view — refactor hub inline section (index.tsx)

The existing hub's inline lønnsgrunnlag section rendered via `.map()` with no
virtualisation. Refactor the section to use `FlashList` from `@shopify/flash-list`.

- `LonnsgrunnlagListItem` component: `React.memo`, callbacks `useCallback`
- Status badge: draft / locked / paid → token-mapped colours
- Period label: `theme.typography.bodyBold` (approximated via fontWeight 600)
- Date range: Geist Mono `text-xs` via monospace fontFamily
- Empty state: centred `FileText` icon + "Ingen lønnsgrunnlag ennå"
- Motion press feedback: Reanimated withSpring(0.97 scale) using
  `nativeTheme.motion.springReactive` (≡ springSnappy in native token set)

### B. Loading skeleton — lonnsgrunnlag-detail.tsx

Add 3-row skeleton that displays while `isLoading && !urlData`. Reanimated
`useSharedValue` opacity pulse (animate opacity only — GPU compositor rule).
Spring via `nativeTheme.motion.springAmbient` (≡ springGentle in native tokens).

### C. No period selector

Detail screen is single-period. NO picker. Already the case — confirm unchanged.

### D. PDF share button — lonnsgrunnlag-detail.tsx

Replace `Linking.openURL` primary button with `expo-sharing` `Sharing.shareAsync`.
Button: `Share` icon + "Del / Åpne" label at top of actionsBlock.
Loading state: `ActivityIndicator` (standard RN, no custom spinner).
Keep the `Linking.openURL` fallback path for devices where Sharing is unavailable.

### E. Accessibility sweep

All interactive elements: `accessibilityLabel` + `accessibilityRole`.
Min touch target 44×44pt via `StyleSheet.create` (no inline).

### F. Token compliance

Zero hardcoded hex in new/modified files. `theme.colors.*` + `nativeTheme.motion.*`.

## Dependency additions

```
apps/mobile/package.json:
  "@shopify/flash-list": "^1.7.3"   (expo 55 compatible)
  "expo-sharing": "~13.1.5"          (expo 55 SDK compatible)
```

## Task sequence

| # | Description | Commit prefix |
|---|-------------|---------------|
| T1 | Plan + 3 journeys | `docs(payroll):` |
| T2 | Add flash-list + expo-sharing deps; refactor hub list section | `feat(mobile-payroll):` |
| T3 | Loading skeleton on detail screen | `feat(mobile-payroll):` |
| T4 | PDF share button (expo-sharing) | `feat(mobile-payroll):` |
| T5 | A11y sweep | `fix(mobile-payroll):` |
| T6 | typecheck 52/52 | — |
| T7 | Journey status: verified | `docs(payroll):` |
| T8 | Handoff | `docs(payroll):` |

## Open gaps this plan depends on

- Wave B BFF route `/api/payroll/lonnsgrunnlag-url` — still pending. PDF sharing
  uses signed URL from hook; if hook returns no data, share button is disabled.
  Sharing surface gracefully degrades (button disabled + loading indicator).
