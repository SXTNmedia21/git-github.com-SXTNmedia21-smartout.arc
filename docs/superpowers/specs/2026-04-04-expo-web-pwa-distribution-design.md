---
title: Expo Web PWA Distribution
status: draft
created: 2026-04-04
author: Claude
scope: apps/mobile → web build target + PWA at mobile.smartout.ai
---

# Expo Web PWA Distribution

## Problem

The Smartout mobile app (51+ screens, full business logic) is ready for employee
use but not yet published to app stores. We need a distribution channel so
employees can start using the app immediately via a URL on their phones.

## Solution

Enable Expo Web on the existing `apps/mobile` codebase. Build as a static web
app, deploy as a PWA at `mobile.smartout.ai`. No new app, no code duplication —
same codebase, new build target.

## Architecture

```
apps/mobile/  (existing React Native + Expo app)
  ├── expo export --platform web  →  static bundle → dist/
  ├── Deploy to Vercel at mobile.smartout.ai
  ├── PWA manifest + service worker → "Add to Home Screen"
  └── .web.ts fallback files for native-only modules
```

The native app remains the primary target. Web fallbacks degrade gracefully —
functional enough for beta, not pixel-perfect.

## Native Module Fallback Inventory

### Already handled (no work needed)

| Module               | Files | Status                                                  |
| -------------------- | ----- | ------------------------------------------------------- |
| `expo-secure-store`  | 1     | localStorage fallback in `src/lib/supabase.ts`          |
| `expo-notifications` | 1     | Comprehensive `Platform.OS` guards in `src/lib/push.ts` |

### Auto-works on web (test, don't rewrite)

| Module                         | Files | Notes                                    |
| ------------------------------ | ----- | ---------------------------------------- |
| `react-native-reanimated`      | 49    | Provides own web implementation via Expo |
| `react-native-gesture-handler` | 2     | GestureHandlerRootView is no-op on web   |

### Needs fallbacks (the actual work)

#### 1. expo-haptics (89 files) — NO-OP WRAPPER

**Strategy:** Metro `.web.ts` resolution. No import rewrites.

**Audit command:**

```bash
grep -r "from ['\"]expo-haptics['\"]" --include="*.ts" --include="*.tsx" apps/mobile/src/
```

**Decision threshold:**

- If ALL 89 files already import via `src/lib/haptics` → create `haptics.web.ts` no-op sibling (10 min)
- If files import directly from `expo-haptics` → refactor to central wrapper first, then add `.web.ts` (1-2 hours depending on count)

**Implementation:**

```typescript
// src/lib/haptics.web.ts — no-op for all methods
export const impactAsync = () => {};
export const notificationAsync = () => {};
export const selectionAsync = () => {};
export default { impactAsync, notificationAsync, selectionAsync };
```

#### 2. @gorhom/bottom-sheet (12 files) — CSS DRAWER

**Strategy:** `.web.tsx` sibling for the existing wrapper at
`src/components/ui/BottomSheet.tsx`.

**Audit command:**

```bash
grep -r "from ['\"]@gorhom/bottom-sheet['\"]" --include="*.ts" --include="*.tsx" apps/mobile/src/
```

**Decision threshold:**

- If ALL consumer components import via `src/components/ui/BottomSheet` → only
  the wrapper needs a `.web.tsx` sibling (30 min)
- If files import directly from `@gorhom/bottom-sheet` → refactor to central
  wrapper first, then add `.web.tsx` (1-2 hours depending on count)

**Implementation:** CSS `translate` + backdrop overlay. Same props interface as
the native version. No gesture physics needed — simple slide-up drawer with
backdrop click to dismiss.

**BottomSheetModalProvider:** `app/_layout.tsx` wraps the entire app in
`BottomSheetModalProvider` from `@gorhom/bottom-sheet`. This WILL crash on web.
Create a `src/components/ui/BottomSheetModalProvider.web.tsx` that renders a
plain React context provider (or just passes children through). Then replace the
direct `@gorhom/bottom-sheet` import in `_layout.tsx` with the local wrapper.

**Files using bottom sheet:**

- `src/components/ui/BottomSheet.tsx` (base wrapper — gets `.web.tsx` sibling)
- `src/components/shift-clock/SupplementSheet.tsx`
- `src/components/task/TaskModal.tsx`
- `src/components/ai/BotssonSheet.tsx`
- `src/features/channels/components/CallSheet.tsx`
- `src/components/chat/NewConversationSheet.tsx`
- `src/components/home/NotificationSheet.tsx`
- `src/components/home/SettingsSheet.tsx`
- `app/_layout.tsx` (BottomSheetModalProvider — needs explicit web fallback)
- `app/(app)/_layout.tsx`
- `app/(app)/(home)/shift-hub.tsx`
- `app/(app)/(chat)/index.tsx`

#### 3. expo-sqlite (1 file) — SKIP ON WEB

**Strategy:** Early return in `src/lib/sync/db.ts` when `Platform.OS === "web"`.
No offline queue on web. Writes go directly to Supabase — if offline, they fail.

**Rationale:** Beta distribution, employees have connectivity. IndexedDB wrapper
is overengineering for a temporary channel.

#### 4. @livekit/react-native (3 files) — DISABLE ON WEB

**Strategy:** Show "Ikke tilgjengelig i nettleser" placeholder on call UI
components instead of attempting WebRTC in browser.

**Files:**

- `app/_layout.tsx` — already guarded (`Platform.OS !== "web"`)
- `src/hooks/mutations/use-livekit-call.ts` — already partially guarded, complete it
- `src/features/channels/components/ParticipantTile.tsx` — replace VideoView with placeholder

**Rationale:** `livekit-client` JS works in browsers, but debugging
WebRTC edge cases across mobile Safari isn't worth it for a beta. Native app
handles video/PTT; web version handles everything else.

## PWA Configuration

### Manifest (`apps/mobile/public/manifest.json`)

```json
{
  "name": "Smartout",
  "short_name": "Smartout",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Icons sourced from existing `apps/mobile/assets/` app icon, resized.

### Manifest linking

Expo Web does NOT automatically link the manifest. The `<link rel="manifest">`
tag must be added via a custom `app/+html.tsx` file (Expo Router's HTML template
override). This is the exact file to create:

```typescript
// apps/mobile/app/+html.tsx
import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

This file is only used for web builds — native ignores it.

### Service worker

Expo Web generates a basic one for asset caching. No push notifications via
service worker for beta.

## Environment Variables

The web build needs Supabase credentials exposed as `EXPO_PUBLIC_*` variables.

**Required in Vercel project settings for `mobile.smartout.ai`:**

| Variable                        | Source                 | Notes                           |
| ------------------------------- | ---------------------- | ------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase project URL   | Same as native                  |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key      | Same as native                  |
| `EXPO_PUBLIC_LIVEKIT_URL`       | LiveKit server URL     | For future use if video enabled |
| `EXPO_PUBLIC_POSTHOG_KEY`       | PostHog EU project key | Telemetry                       |

**Important:** These are public/anon keys only. No service role keys in the web
build. Verify that `apps/mobile` env usage matches these variable names — if the
app currently uses different names, align them.

## Deployment

**Vercel project:** New project for `apps/mobile` web build.

- **Build command:** `cd apps/mobile && npx expo export --platform web`
- **Output directory:** `apps/mobile/dist`
- **Framework preset:** Other (static)
- **Domain:** `mobile.smartout.ai`

**Vercel config (`apps/mobile/vercel.json`):**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

SPA fallback is critical — Expo Router handles all client-side routing.

**Turbo task:** Add `build:web` script to `apps/mobile/package.json`:

```json
{
  "scripts": {
    "build:web": "expo export --platform web"
  }
}
```

## Implementation Phases

### Phase 0 — Validate the Foundation

**Goal:** Confirm Expo SDK 55 + Router 55 can produce a working web build.

**Pre-step — SPA output mode:** Expo Router 55 defaults to static rendering for
web export. Dynamic routes with `[id]` segments (which this app has extensively)
will 404 after deploy unless output mode is set to SPA. Before running the
build, add to `app.json`:

```json
{
  "expo": {
    "web": {
      "output": "single",
      "bundler": "metro"
    }
  }
}
```

This ensures all routes are handled client-side. Without this, every `[id]`
route returns 404 in production — a classic Expo Router web trap.

**Steps:**

1. Add `web.output: "single"` to `app.json` (see above)
2. Run `cd apps/mobile && npx expo export --platform web`
3. If build succeeds: serve `dist/` locally, open in Chrome and iOS Safari
4. Test in iOS Safari standalone mode: "Add to Home Screen" → open → verify shell loads
5. Test auth persistence: log in via Safari standalone → close app → reopen → verify session survives

**Exit criteria — build succeeds:**
→ Proceed to Phase 1.

**Exit criteria — build fails:**
→ Read the error. If it's a missing web fallback for a native module (expected),
note which module and proceed to Phase 1 (the fallback work will fix it).
→ If it's an Expo SDK / Router incompatibility (e.g., metro bundler crash,
router web export not supported in SDK 55), **STOP and escalate**. This is a
strategic decision — may require SDK version change, different bundler config, or
a fundamentally different approach. Do not spend more than 30 minutes debugging
SDK-level issues.

**Exit criteria — Safari auth fails:**
→ If localStorage doesn't persist in standalone mode, the auth strategy needs to
change (e.g., cookie-based session, or IndexedDB for token storage). Escalate
before proceeding — this affects the entire approach.

### Phase 1 — Fix Native Module Crashes

**Order (by impact):**

1. **expo-haptics** — blocks the most files (89). Audit direct imports first.
2. **@gorhom/bottom-sheet** — blocks 12 UI components
3. **expo-sqlite** — one file, quick fix
4. **@livekit/react-native** — complete existing guards

After each fix: rebuild and verify the crash is resolved.

### Phase 2 — PWA & Deployment

1. Add `manifest.json` + icons to `apps/mobile/public/`
2. Add `<link rel="manifest">` to web entry (Expo Web's `app.json` web config or HTML template)
3. Add `vercel.json` with SPA rewrite
4. Configure Vercel project with env vars (`EXPO_PUBLIC_*`)
5. Deploy to `mobile.smartout.ai`
6. Add `build:web` script to package.json + turbo task

### Phase 3 — iOS Safari Validation

Full validation on target device (iPhone, Safari standalone):

1. **Add to Home Screen** — app icon, splash screen, standalone mode
2. **Auth flow** — full login → OTP → workspace select → dashboard
3. **Core features** — shift schedule, punch clock, chat, training
4. **Navigation** — tab bar, back button, deep links
5. **Viewport** — safe area insets, keyboard behavior, notch handling
6. **Performance** — initial load time, navigation speed, animation smoothness

Note: Items 1-2 are tested early in Phase 0. Phase 3 covers the full feature
surface after deployment.

## Out of Scope

- Push notifications via Web Push API (not reliable on iOS Safari)
- Offline support / IndexedDB sync
- Video calls / walkie-talkie in browser
- Desktop viewport optimization (employees use phones)
- App store submission (separate track)

## Success Criteria

- Employee can open `mobile.smartout.ai` on iPhone Safari
- Can "Add to Home Screen" and launch in standalone mode
- Can log in, view schedule, use punch clock, access chat
- Session persists between app opens
- No crashes from unguarded native modules
