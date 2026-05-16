---
title: Mobile Layouts and Tabs
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, layouts, tabs, expo-router, sitemap]
---

# Layouts and Tabs

## Root Layout — `app/_layout.tsx`

Provider wrapping order (outermost → innermost):
```
GestureHandlerRootView
  QueryProvider
    AuthProvider
      BottomSheetModalProvider
        <Stack screenOptions={{ headerShown: false }} />
```

- `registerGlobals()` from `@livekit/react-native` called on native only (iOS/Android).
- History push/replace wrapped in try/catch for web browser extension compatibility.

## Auth Layout — `app/(auth)/_layout.tsx`

Plain `<Stack screenOptions={{ headerShown: false }} />`. No tab bar. Screens registered auto by Expo Router from files.

## App Layout — `app/(app)/_layout.tsx`

Custom `TabBar` component renders the 4 visible tabs + center `AIFab`. `BotssonProvider` wraps everything.

```
initialRouteName: "(home)"  // supersedes ADR-0268 anchor (was "(calendar)")
```

### Tab registration

```tsx
<Tabs.Screen name="(home)"     options={{ title: "Hjem" }} />
<Tabs.Screen name="(shifts)"   options={{ title: strings.tabs.vakter }} />
{/* FAB slot — center, handled in TabBar */}
<Tabs.Screen name="(chat)"     options={{ title: strings.tabs.chat }} />
<Tabs.Screen name="(me)"       options={{ title: strings.tabs.minTid }} />

{/* Hidden */}
<Tabs.Screen name="(calendar)"              options={{ href: null }} />
<Tabs.Screen name="(komm)"                  options={{ href: null }} />
<Tabs.Screen name="(queue)"                 options={{ href: null }} />
<Tabs.Screen name="journey"                 options={{ href: null }} />
<Tabs.Screen name="journey/[id]/guided"     options={{ href: null }} />
```

Two global sheets mount inside AppLayout (below `<Tabs>`):
- `AddSheet` (ref: `addSheetRef`) — receives `selectedDate={new Date()}`
- `BotssonSheet` (ref: `botssonSheetRef`)

### Flag: registered-but-no-route

`(digest)` — referenced in comment as deleted per ADR-0318. No explicit suppression needed; file was removed 2026-05-14.

## Home Layout — `app/(app)/(home)/_layout.tsx`

Stack with `headerShown: false`. Registered screens:

`index`, `punch-clock`, `deviation`, `haccp`, `edit-profile`, `spokesperson-approval`, `team`, `training`, `course-detail`, `hms`, `safety-round`, `temp-deviation`, `flow-player`, `operations`, `clockout`, `settings`, `availability`

**Gap:** `team/[id]` (dynamic sub-route used by `team.tsx:102`) is NOT registered. Expo Router will auto-generate it from the file, but the explicit Stack.Screen registration is absent — no screen options (title, animation) apply.

## Shifts Layout — `app/(app)/(shifts)/_layout.tsx`

Stack with `headerShown: false` on all screens. Registered: `index`, `[id]`, `roster`, `create`, `swap`, `marketplace`, `proposed-plan`.

## Chat Layout — `app/(app)/(chat)/_layout.tsx`

Stack with `animation: "slide_from_right"`. Registered: `index`, `settings`, `[id]`.

## Me Layout — `app/(app)/(me)/_layout.tsx`

Stack with `headerShown: false`. Registered: `index`, `notifications`, `contract/index`, `contract/[id]`, `contract/complete-data`, `channel-detail/[id]`.

**Note:** `payroll` group is a nested `_layout.tsx` — not registered here; Expo Router picks it up as a nested stack.

## Payroll Layout — `app/(app)/(me)/payroll/_layout.tsx`

Wraps screens in a `PayrollErrorBoundary` (class component). Caught errors show fallback with retry button.

Registered screens: `index`, `payslip`, `timebank`, `absence-balance`, `absence-request`, `payroll-supplements`, `payslip-detail`, `lonnsgrunnlag-detail`.

**Gap:** registered name is `payroll-supplements` but file on disk is `supplements.tsx`. Expo Router maps file name → route segment, so the correct segment should be `supplements`. Navigation to `./supplements` from `payroll/index.tsx` works; the registered Screen name `payroll-supplements` is a phantom — no file will match it.

## Calendar Layout — `app/(app)/(calendar)/_layout.tsx`

```tsx
// "Stub for Phase 3f. Full calendar screens... are built in Phase 3c."
<Stack screenOptions={{ headerShown: false }} />
```

No explicit screen registrations. All three screens (`index`, `month`, `day/[date]`) auto-resolved by Expo Router.

## Komm Layout — `app/(app)/(komm)/_layout.tsx`

Plain stack, `headerShown: false`. Comment: "Replaces the former (queue) stack per Phase 1A.2 (Spec §Mobile, ADR-0165)."

## Queue Layout — `app/(app)/(queue)/_layout.tsx`

Minimal plain stack. Legacy surface; effectively superseded by `(komm)` + Chat tab merged experience.
