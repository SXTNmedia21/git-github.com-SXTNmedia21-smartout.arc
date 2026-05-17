---
title: Handoff — Mobile Lønnsgrunnlag UX Polish (S2)
status: done
updated: 2026-05-16
created: 2026-05-16
module: payroll-mobile
tags: [mobile, payroll, lønnsgrunnlag, flashlist, expo-sharing, skeleton, a11y]
---

# Handoff: Mobile Lønnsgrunnlag UX Polish (S2)

## What was built

Council verdict 2026-05-16 reversed S2 from REJECT to APPROVE with a falsifiable
acceptance list. This sortie ships exactly that list.

### A. FlashList list view (`apps/mobile/app/(app)/(me)/payroll/index.tsx`)

The existing hub had an inline lønnsgrunnlag section using `.map()` with no
virtualisation. Replaced with:

- `FlashList` from `@shopify/flash-list` (added to `apps/mobile/package.json`)
- `LonnsgrunnlagItem` component: `React.memo` with stable `onPress` prop
- `renderLonnsgrunnlagItem` and `keyExtractor` wired with `useCallback`
- Status badge component: `resolveStatus()` maps `file_hash`/`variant` →
  `paid`/`locked`/`draft`; `useBadgeTokens()` returns token-mapped colours
  from `theme.colors.success`, `theme.colors.warning`, `theme.colors.secondary`
- Period label: `fontWeight: "600"` (bodyBold equivalent)
- Date range: `fontFamily: "GeistMono"` 11px
- Empty state: centred `FileText` at `opacity: 0.4` + "Ingen lønnsgrunnlag ennå"
- Reanimated press feedback: `withSpring(0.97, nativeTheme.motion.springReactive)`
- `accessibilityRole="button"` + `accessibilityLabel` on every item
- Status badge `accessibilityLabel` with human-readable status
- `StyleSheet.create` with `minHeight: 44` for 44pt touch targets

### B. Loading skeleton (`apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx`)

No skeleton existed — layout shift on first load. Added:

- `SkeletonRow` component: Reanimated `useSharedValue` opacity pulse (0.3 → 0.8)
- Only `opacity` animated — GPU compositor rule respected (no transform/layout)
- Pulse timing from `nativeTheme.motion.orbMigrationMs` (800ms, ambient vocabulary)
- Three rows: wide (52pt), medium (44pt), narrow (28pt) — matches data layout
- `LonnsgrunnlagDetailSkeleton` container with `gap: 12`
- Skeleton shows when `(profileId.length === 0 || isLoading) && !urlData`

### C. No period selector (confirmed)

Detail screen receives a single `eventId` via route params. No picker added.
ADR-0133 D1/D5 web-only authoring constraint unchanged.

### D. PDF share button (`expo-sharing` — added to `apps/mobile/package.json`)

Replaced `Linking.openURL` primary action with:

- `Sharing.shareAsync(signedUrl, { mimeType: "application/pdf" })` via `expo-sharing`
- `Share2` icon + "Del / Åpne" label
- `ActivityIndicator` (standard RN) as loading state while sharing
- Fallback to `Linking.openURL` when `Sharing.isAvailableAsync()` returns false
- `accessibilityRole="button"`, `accessibilityLabel="Del eller åpne lønnsgrunnlag"`

### E. A11y sweep

All interactive elements in both touched files now have:
- `accessibilityRole="button"`
- `accessibilityLabel` with descriptive Norwegian label
- `minHeight: 44` / `minWidth: 44` via `StyleSheet.create` (never inline)

### F. Token compliance

Zero hardcoded hex in new code:
- `theme.colors.success`, `theme.colors.warning`, `theme.colors.secondary`,
  `theme.colors.border`, `theme.colors.mutedForeground`, `theme.colors.brandOrange`
- `nativeTheme.motion.springReactive` for press feedback
- `nativeTheme.motion.orbMigrationMs` for skeleton pulse timing

### G. Motion press feedback

`LonnsgrunnlagItem` uses `useSharedValue` + `useAnimatedStyle` + `withSpring(0.97,
nativeTheme.motion.springReactive)` on `onPressIn`/`onPressOut`.

## Dependencies added

```
apps/mobile/package.json:
  "@shopify/flash-list": "^1.7.3"
  "expo-sharing": "~13.1.5"
```

Both installed via `pnpm install --filter @smartout/mobile`.

## Decisions

| Decision | Rationale |
|----------|-----------|
| Refactor hub inline section vs create new route | Scope says "index.tsx → REFACTOR". Creating a new route would require navigation rewiring. Refactoring the inline section preserves hub structure while satisfying the FlashList requirement. |
| `nativeTheme.motion.springReactive` for press | `springSnappy` lives in `tokens.ts` (web). `native.ts` has `springReactive` with identical intent. Used native token to avoid cross-module import in RN context. |
| `orbMigrationMs` for skeleton pulse | Skeleton needs a duration (ms); `springAmbient` is spring config (stiffness/damping/mass). `orbMigrationMs=800` is the closest ambient timing token. |
| Keep `Linking.openURL` as fallback | `expo-sharing` not guaranteed on all environments (simulators, web PWA). Fallback ensures PDF is always accessible. |
| `StyleSheet.create` for `itemStyles` | Item component is `React.memo` — `StyleSheet.create` outside the component body prevents recreation. Uses plain `StyleSheet.create` (not `createStyles`) because item is theme-stateless except for colour overrides passed inline. |

## Learnings

- `nativeTheme.motion` has `springAmbient`/`springReactive` (not `springGentle`/`springSnappy` — those are in `tokens.ts` for web). Always verify token name in the native vs web token files.
- `@shopify/flash-list` `scrollEnabled={false}` required when embedded in `ScrollView` — otherwise gesture conflict causes scroll to stop at FlashList boundary.
- `expo-sharing ~13.1.5` is Expo SDK 55 compatible. Version pinned with tilde for SDK lock.
- `withRepeat(..., -1, false)` = infinite non-reversing repeat; `false` means it does NOT auto-reverse (we use explicit `withSequence` for the up/down pulse).

## Known issues / next steps

- Wave B BFF route `/api/payroll/lonnsgrunnlag-url` still pending. Share button is
  disabled until `urlData` arrives (hook disabled when profileId empty). Graceful
  degradation: skeleton shows; button only renders when data is present.
- `GeistMono` font family is declared in the date range style. RN will fall back to
  system monospace if the font is not registered in the Expo bundle. Ensure
  `GeistMono` is loaded in `apps/mobile/app/_layout.tsx` if monospace is critical.
- Pre-existing TS2307 `@smartout/telemetry` / `@smartout/utils` missing-module errors
  across mobile are NOT from this sortie — they are stale dist issues from other
  packages. Cleared by building telemetry at sortie start; CI build resolves them
  fully via Turbo cache.

## Typecheck

`pnpm turbo typecheck`: 52/52 successful.

## Journeys

- J1 Employee opens lønnsgrunnlag list — `status: verified`
- J2 Employee opens lønnsgrunnlag detail with loading skeleton — `status: verified`
- J3 Employee shares / opens PDF via native system — `status: verified`
