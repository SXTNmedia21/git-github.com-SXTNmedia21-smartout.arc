# Expo Web PWA Distribution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Expo Web on the existing `apps/mobile` codebase and deploy as a PWA at `mobile.smartout.ai` for early employee access before app store publishing.

**Architecture:** Same React Native + Expo codebase, new web build target. Metro resolver aliases intercept native-only package imports (`expo-haptics`, `@gorhom/bottom-sheet`, `expo-sqlite`) on web platform and redirect to lightweight fallback modules. No import rewrites needed across 89+ files. Deploy as static SPA to Vercel.

**Tech Stack:** Expo SDK 55, Expo Router 55, React Native Web 0.21, Metro bundler, Vercel (static), PWA manifest

**Spec:** `docs/superpowers/specs/2026-04-04-expo-web-pwa-distribution-design.md`

---

## File Map

### New files

| File                                            | Responsibility                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `apps/mobile/src/platform/haptics.web.ts`       | No-op replacements for all `expo-haptics` exports                  |
| `apps/mobile/src/platform/bottom-sheet.web.tsx` | Web-compatible replacements for all `@gorhom/bottom-sheet` exports |
| `apps/mobile/src/platform/sqlite.web.ts`        | Stub for `expo-sqlite` that returns a no-op DB                     |
| `apps/mobile/app/+html.tsx`                     | Custom HTML template for web builds (manifest link, PWA meta tags) |
| `apps/mobile/public/manifest.json`              | PWA manifest (app name, icons, standalone mode)                    |
| `apps/mobile/public/icon-192.png`               | PWA icon 192x192                                                   |
| `apps/mobile/public/icon-512.png`               | PWA icon 512x512                                                   |
| `apps/mobile/vercel.json`                       | SPA rewrite rules + cache headers                                  |

### Modified files

| File                                                               | Change                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `apps/mobile/app.json`                                             | Add `web.output: "single"` + `web.bundler: "metro"`        |
| `apps/mobile/metro.config.js`                                      | Add web platform resolver aliases for native-only packages |
| `apps/mobile/package.json`                                         | Add `build:web` script                                     |
| `apps/mobile/src/lib/sync/db.ts`                                   | Add `Platform.OS === "web"` early return                   |
| `apps/mobile/src/hooks/mutations/use-livekit-call.ts`              | Complete web guards                                        |
| `apps/mobile/src/features/channels/components/ParticipantTile.tsx` | Complete VideoView web fallback                            |
| `apps/mobile/src/features/channels/components/CallSheet.tsx`       | Add web placeholder for call UI                            |

---

## Task 1: Configure Web Build Target

**Files:**

- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Add web config to app.json**

Open `apps/mobile/app.json` and add the `web` key inside `expo`:

```json
{
  "expo": {
    "name": "Smartout",
    "slug": "smartout-mobile",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "scheme": "smartout",
    "web": {
      "output": "single",
      "bundler": "metro",
      "favicon": "./assets/icon.png"
    },
    "splash": {
```

Add the `"web"` block right after `"scheme"`, before `"splash"`. The `"output": "single"` is critical — without it, Expo Router 55 defaults to static rendering and every `[id]` route returns 404 in production.

- [ ] **Step 2: Add build:web script to package.json**

In `apps/mobile/package.json`, add to the `"scripts"` section:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build:web": "expo export --platform web",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "test": "jest"
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/sxtnl/dev/web-wrapper
git add apps/mobile/app.json apps/mobile/package.json
git commit -m "feat(mobile): configure web build target with SPA output mode

Add web.output: single to prevent 404s on dynamic routes.
Add build:web script for expo export --platform web.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add Metro Resolver Aliases for Web Platform

**Files:**

- Modify: `apps/mobile/metro.config.js`

This is the key architectural piece. Instead of refactoring 89+ import statements,
we configure Metro to resolve native-only packages to our fallback modules when
building for the `web` platform. This is standard Metro configuration — not a hack.

- [ ] **Step 1: Update metro.config.js with web resolver**

Replace the full contents of `apps/mobile/metro.config.js` with:

```javascript
/**
 * Metro configuration for Smartout mobile app.
 * Configures monorepo support so Metro can resolve packages/* and apps/* imports.
 *
 * Web platform: native-only packages are aliased to lightweight fallback modules
 * in src/platform/. This lets the same source code build for both native and web
 * without touching import statements across 89+ files.
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so shared packages resolve
config.watchFolders = [monorepoRoot];

// Resolve node_modules from both project and monorepo root (hoisted deps)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

/**
 * Web platform aliases — redirect native-only packages to fallback modules.
 * These files live in src/platform/ and provide web-compatible implementations
 * (no-ops for haptics, CSS drawers for bottom sheets, stubs for SQLite).
 */
const webAliases = {
  "expo-haptics": path.resolve(projectRoot, "src/platform/haptics.web.ts"),
  "@gorhom/bottom-sheet": path.resolve(projectRoot, "src/platform/bottom-sheet.web.tsx"),
  "expo-sqlite": path.resolve(projectRoot, "src/platform/sqlite.web.ts"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName in webAliases) {
    return {
      type: "sourceFile",
      filePath: webAliases[moduleName],
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

- [ ] **Step 2: Verify Metro config loads without error**

Run: `cd /home/sxtnl/dev/web-wrapper/apps/mobile && node -e "require('./metro.config.js'); console.log('OK')"`

Expected: `OK` (no errors)

- [ ] **Step 3: Commit**

```bash
cd /home/sxtnl/dev/web-wrapper
git add apps/mobile/metro.config.js
git commit -m "feat(mobile): add Metro web resolver aliases for native-only packages

Redirects expo-haptics, @gorhom/bottom-sheet, and expo-sqlite to
lightweight fallback modules on web platform. Avoids refactoring
89+ import statements across the codebase.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create Haptics Web Fallback

**Files:**

- Create: `apps/mobile/src/platform/haptics.web.ts`

This module replaces `expo-haptics` on web. Every export from expo-haptics that
the app uses must be provided here as a no-op. The app uses `Haptics.impactAsync`,
`Haptics.ImpactFeedbackStyle`, `Haptics.notificationAsync`,
`Haptics.NotificationFeedbackType`, and `Haptics.selectionAsync`.

- [ ] **Step 1: Create the platform directory**

```bash
mkdir -p /home/sxtnl/dev/web-wrapper/apps/mobile/src/platform
```

- [ ] **Step 2: Create haptics.web.ts**

Create `apps/mobile/src/platform/haptics.web.ts`:

```typescript
/**
 * Web fallback for expo-haptics.
 * All methods are no-ops — haptic feedback is not available in browsers.
 * Metro resolves `expo-haptics` to this file when building for web platform.
 */

export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
  Soft = "soft",
  Rigid = "rigid",
}

export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}

export async function impactAsync(_style?: ImpactFeedbackStyle): Promise<void> {}

export async function notificationAsync(_type?: NotificationFeedbackType): Promise<void> {}

export async function selectionAsync(): Promise<void> {}

// Support both `import * as Haptics` and `import Haptics from`
export default {
  impactAsync,
  notificationAsync,
  selectionAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};
```

- [ ] **Step 3: Commit**

```bash
cd /home/sxtnl/dev/web-wrapper
git add apps/mobile/src/platform/haptics.web.ts
git commit -m "feat(mobile): add web no-op fallback for expo-haptics

All haptic methods are silent no-ops on web. Matches the full
expo-haptics export surface used across 89 files.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create Bottom Sheet Web Fallback

**Files:**

- Create: `apps/mobile/src/platform/bottom-sheet.web.tsx`

This is the most complex fallback. The 12 files that import from `@gorhom/bottom-sheet`
use these exports: default component (`BottomSheet`), `BottomSheetModalProvider`,
`BottomSheetBackdrop`, `BottomSheetBackdropProps`, `BottomSheetTextInput`,
`BottomSheetView`, `BottomSheetScrollView`, and various type exports.

The web version provides a CSS-based slide-up drawer with backdrop.

- [ ] **Step 1: Audit what exports the 12 files actually use**

Run these greps to see the exact imports:

```bash
cd /home/sxtnl/dev/web-wrapper
grep -h "import.*from.*@gorhom/bottom-sheet" --include="*.ts" --include="*.tsx" -r apps/mobile/src/ apps/mobile/app/ | sort -u
```

This tells you exactly which named exports to provide. The implementation below
covers all known exports — verify this grep confirms no missing ones.

- [ ] **Step 2: Create bottom-sheet.web.tsx**

Create `apps/mobile/src/platform/bottom-sheet.web.tsx`:

```tsx
/**
 * Web fallback for @gorhom/bottom-sheet.
 * Provides a CSS slide-up drawer with backdrop instead of native bottom sheet.
 * Metro resolves `@gorhom/bottom-sheet` to this file when building for web.
 *
 * Design: simple translate + backdrop. No gesture physics. Good enough for beta.
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  type ViewProps,
  type TextInputProps,
} from "react-native";

/* ---------- Types ---------- */

type BottomSheetProps = ViewProps & {
  children: ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  enablePanDownToClose?: boolean;
  onChange?: (index: number) => void;
  onClose?: () => void;
  backgroundStyle?: object;
  handleIndicatorStyle?: object;
  backdropComponent?: React.ComponentType<BottomSheetBackdropProps>;
  style?: object;
};

export type BottomSheetBackdropProps = {
  animatedIndex: { value: number };
  animatedPosition: { value: number };
  style?: object;
  disappearsOnIndex?: number;
  appearsOnIndex?: number;
  opacity?: number;
};

/* ---------- BottomSheet (default export) ---------- */

export type BottomSheetRef = {
  snapToIndex: (index: number) => void;
  close: () => void;
  expand: () => void;
  collapse: () => void;
  forceClose: () => void;
};

const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(function BottomSheet(
  { children, snapPoints, index = -1, onChange, onClose, enablePanDownToClose, style, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(index >= 0);

  const open = useCallback(() => {
    setVisible(true);
    onChange?.(0);
  }, [onChange]);

  const close = useCallback(() => {
    setVisible(false);
    onChange?.(-1);
    onClose?.();
  }, [onChange, onClose]);

  useImperativeHandle(ref, () => ({
    snapToIndex: (i: number) => (i >= 0 ? open() : close()),
    close,
    expand: open,
    collapse: close,
    forceClose: close,
  }));

  if (!visible) return null;

  // Derive height from first snap point, default 50%
  const height = snapPoints?.[0]
    ? typeof snapPoints[0] === "string"
      ? snapPoints[0]
      : `${snapPoints[0]}px`
    : "50%";

  return (
    <View style={webStyles.overlay}>
      <Pressable style={webStyles.backdrop} onPress={enablePanDownToClose ? close : undefined} />
      <View style={[webStyles.sheet, { height }, style]} {...rest}>
        {/* Handle indicator */}
        <View style={webStyles.handleContainer}>
          <View style={webStyles.handle} />
        </View>
        {children}
      </View>
    </View>
  );
});

export default BottomSheet;

/* ---------- BottomSheetModalProvider ---------- */

export function BottomSheetModalProvider({ children }: { children: ReactNode }) {
  // On web, no special provider context is needed — sheets are CSS overlays
  return <>{children}</>;
}

/* ---------- BottomSheetBackdrop ---------- */

export function BottomSheetBackdrop({
  style,
  opacity = 0.4,
}: BottomSheetBackdropProps & { children?: ReactNode }) {
  return (
    <View style={[webStyles.backdrop, { backgroundColor: `rgba(0,0,0,${opacity})` }, style]} />
  );
}

/* ---------- BottomSheetTextInput ---------- */

export const BottomSheetTextInput = forwardRef<TextInput, TextInputProps>(
  function BottomSheetTextInput(props, ref) {
    return <TextInput ref={ref} {...props} />;
  },
);

/* ---------- BottomSheetView ---------- */

export function BottomSheetView({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View style={[{ flex: 1 }, style]} {...rest}>
      {children}
    </View>
  );
}

/* ---------- BottomSheetScrollView ---------- */

export function BottomSheetScrollView({ children, ...rest }: { children: ReactNode } & ViewProps) {
  return <ScrollView {...rest}>{children}</ScrollView>;
}

/* ---------- BottomSheetFlatList (stub) ---------- */

export const BottomSheetFlatList = forwardRef(function BottomSheetFlatList(props: any, ref: any) {
  // If used, falls back to a basic ScrollView with mapped children
  const { data, renderItem, keyExtractor, ...rest } = props;
  return (
    <ScrollView ref={ref} {...rest}>
      {data?.map((item: any, index: number) => (
        <View key={keyExtractor?.(item, index) ?? index}>
          {renderItem({ item, index, separators: {} })}
        </View>
      ))}
    </ScrollView>
  );
});

/* ---------- Styles ---------- */

const webStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    zIndex: 1001,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
  },
});
```

- [ ] **Step 3: Commit**

```bash
cd /home/sxtnl/dev/web-wrapper
git add apps/mobile/src/platform/bottom-sheet.web.tsx
git commit -m "feat(mobile): add web CSS drawer fallback for @gorhom/bottom-sheet

Provides BottomSheet, BottomSheetModalProvider, BottomSheetBackdrop,
BottomSheetTextInput, BottomSheetView, and BottomSheetScrollView as
CSS-based overlays for web. No gesture physics — slide-up drawer
with backdrop click to dismiss.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create SQLite Web Fallback

**Files:**

- Create: `apps/mobile/src/platform/sqlite.web.ts`

Instead of modifying `src/lib/sync/db.ts` directly, the Metro resolver alias
handles this — `expo-sqlite` resolves to this stub on web. The stub provides
`openDatabaseAsync` that returns a no-op database. The sync queue silently
does nothing on web.

- [ ] **Step 1: Create sqlite.web.ts**

Create `apps/mobile/src/platform/sqlite.web.ts`:

```typescript
/**
 * Web fallback for expo-sqlite.
 * Returns a no-op database — offline sync queue is disabled on web.
 * Employees have connectivity; writes go directly to Supabase.
 * Metro resolves `expo-sqlite` to this file when building for web.
 */

export interface SQLiteDatabase {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, params?: any[]): Promise<T | null>;
  runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
}

const noOpDb: SQLiteDatabase = {
  async execAsync() {},
  async getAllAsync() {
    return [];
  },
  async getFirstAsync() {
    return null;
  },
  async runAsync() {
    return { lastInsertRowId: 0, changes: 0 };
  },
};

export async function openDatabaseAsync(_name: string): Promise<SQLiteDatabase> {
  return noOpDb;
}

// Default export to match expo-sqlite's module shape
export default { openDatabaseAsync };
```

- [ ] **Step 2: Commit**

```bash
cd /home/sxtnl/dev/web-wrapper
git add apps/mobile/src/platform/sqlite.web.ts
git commit -m "feat(mobile): add web no-op fallback for expo-sqlite

Offline sync queue silently disabled on web. Returns no-op database
that satisfies the interface without persisting anything.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Complete LiveKit Web Guards

**Files:**

- Modify: `apps/mobile/src/hooks/mutations/use-livekit-call.ts`
- Modify: `apps/mobile/src/features/channels/components/ParticipantTile.tsx`
- Modify: `apps/mobile/src/features/channels/components/CallSheet.tsx`

LiveKit is already partially guarded. `app/_layout.tsx` skips `registerGlobals()`
on web. The core `livekit-client` JS package works in browsers — but we're choosing
to disable video/PTT entirely on web for the beta to avoid WebRTC debugging.

- [ ] **Step 1: Read the current state of the three files**

```bash
cd /home/sxtnl/dev/web-wrapper
cat apps/mobile/src/hooks/mutations/use-livekit-call.ts
cat apps/mobile/src/features/channels/components/ParticipantTile.tsx
cat apps/mobile/src/features/channels/components/CallSheet.tsx
```

Review each file and identify:

1. Which imports reference `@livekit/react-native` (not `livekit-client`)
2. Which code paths use `AudioSession` or `VideoView`
3. What the existing `Platform.OS !== "web"` guards look like

- [ ] **Step 2: Complete web guards in use-livekit-call.ts**

The file already has a partial guard for AudioSession. Ensure ALL native-only
LiveKit calls are wrapped:

```typescript
// At the top of the file, replace the AudioSession import block:
import { Platform } from "react-native";

const AudioSession =
  Platform.OS !== "web"
    ? require("@livekit/react-native").AudioSession
    : { startAudioSession: async () => {}, stopAudioSession: async () => {} };
```

Find any unguarded `AudioSession.startAudioSession()` or
`AudioSession.stopAudioSession()` calls and confirm they go through this mock.

- [ ] **Step 3: Add web placeholder to ParticipantTile.tsx**

The file already has a partial VideoView guard. Ensure the web fallback shows
a meaningful placeholder:

```tsx
import { Platform, View, Text } from "react-native";

// Replace the VideoView import/usage:
const VideoView =
  Platform.OS !== "web"
    ? require("@livekit/react-native").VideoView
    : ({ style }: { style?: object }) => (
        <View
          style={[
            { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
            style,
          ]}
        >
          <Text style={{ color: "#666", fontSize: 14 }}>Video ikke tilgjengelig</Text>
        </View>
      );
```

- [ ] **Step 4: Add web placeholder to CallSheet.tsx**

If the call UI renders on web, show a banner instead of the full call interface:

```tsx
import { Platform } from "react-native";

// At the top of the component render:
if (Platform.OS === "web") {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 16, color: "#666", textAlign: "center" }}>
        Samtaler er ikke tilgjengelig i nettleseren.{"\n"}
        Bruk Smartout-appen for video og walkie-talkie.
      </Text>
    </View>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /home/sxtnl/dev/web-wrapper
git add apps/mobile/src/hooks/mutations/use-livekit-call.ts
git add apps/mobile/src/features/channels/components/ParticipantTile.tsx
git add apps/mobile/src/features/channels/components/CallSheet.tsx
git commit -m "feat(mobile): complete LiveKit web guards with Norwegian placeholders

Disable video/PTT on web for beta. Show 'ikke tilgjengelig i
nettleseren' message instead of attempting WebRTC in mobile Safari.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: First Web Build Attempt

**Files:** None (validation only)

This is the Phase 0 gate. If the build fails with an SDK-level error (not a
missing module fallback), STOP and escalate — do not spend more than 30 minutes.

- [ ] **Step 1: Run the web export**

```bash
cd /home/sxtnl/dev/web-wrapper/apps/mobile && npx expo export --platform web
```

Expected: Build succeeds and outputs to `dist/`.

If it fails:

- **"Cannot resolve module X"** where X is a native module → this means the Metro
  resolver didn't catch it. Add the module to `webAliases` in metro.config.js
  and create a stub in `src/platform/`. Rebuild.
- **Metro bundler crash / Expo Router error** → STOP. Escalate. This is an SDK
  compatibility issue that needs a strategic decision.

- [ ] **Step 2: Serve locally and test in Chrome**

```bash
cd /home/sxtnl/dev/web-wrapper/apps/mobile && npx serve dist/
```

Open `http://localhost:3000` in Chrome. Check:

1. Does the app shell render? (auth screen should appear)
2. Open DevTools console — are there any red errors?
3. Does navigation work? (try clicking around)

- [ ] **Step 3: Test in iOS Safari (if available)**

Open the same URL on an iPhone in Safari. Check:

1. Does the page load?
2. Tap "Share" → "Add to Home Screen" → open from home screen
3. Does it launch in standalone mode (no Safari chrome)?
4. Log in → close the standalone app → reopen → is the session still there?

**EXIT CRITERIA — Safari auth fails:**
If localStorage doesn't persist in standalone mode, STOP and escalate.
This changes the entire auth strategy.

- [ ] **Step 4: Document any issues found**

If build succeeded but there are runtime errors, list them. These become
additional fixes before Task 8. If everything works, proceed.

---

## Task 8: PWA Assets and HTML Template

**Files:**

- Create: `apps/mobile/app/+html.tsx`
- Create: `apps/mobile/public/manifest.json`
- Create: `apps/mobile/public/icon-192.png`
- Create: `apps/mobile/public/icon-512.png`

- [ ] **Step 1: Create the +html.tsx template**

Create `apps/mobile/app/+html.tsx`:

```tsx
/**
 * Custom HTML template for Expo Web builds.
 * Adds PWA manifest, Apple meta tags for standalone mode, and theme color.
 * This file is only used for web — native builds ignore it.
 */
import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        {/* iOS standalone mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Smartout" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Expo Router scroll reset */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create manifest.json**

Create `apps/mobile/public/manifest.json`:

```json
{
  "name": "Smartout",
  "short_name": "Smartout",
  "description": "Employee Readiness System",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Generate PWA icons from existing app icon**

The app icon is at `apps/mobile/assets/icon.png`. Resize it to 192x192 and 512x512.

If ImageMagick is available:

```bash
cd /home/sxtnl/dev/web-wrapper/apps/mobile
convert assets/icon.png -resize 192x192 public/icon-192.png
convert assets/icon.png -resize 512x512 public/icon-512.png
```

If not, use `npx sharp-cli`:

```bash
cd /home/sxtnl/dev/web-wrapper/apps/mobile
npx sharp-cli -i assets/icon.png -o public/icon-192.png resize 192 192
npx sharp-cli -i assets/icon.png -o public/icon-512.png resize 512 512
```

If neither works, manually copy the icon to both paths — any icon is better than
no icon for the beta.

- [ ] **Step 4: Commit**

```bash
cd /home/sxtnl/dev/web-wrapper
git add apps/mobile/app/+html.tsx apps/mobile/public/
git commit -m "feat(mobile): add PWA manifest, icons, and HTML template

Custom +html.tsx adds manifest link, Apple standalone meta tags,
and viewport-fit: cover for notch handling. Icons generated from
existing app icon.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Deployment Configuration

**Files:**

- Create: `apps/mobile/vercel.json`

- [ ] **Step 1: Create vercel.json**

Create `apps/mobile/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/manifest.json",
      "headers": [{ "key": "Content-Type", "value": "application/manifest+json" }]
    }
  ]
}
```

The SPA rewrite is critical — without it, direct navigation to any route other
than `/` returns 404 because Expo Router handles routing client-side.

- [ ] **Step 2: Verify the full build still works**

```bash
cd /home/sxtnl/dev/web-wrapper/apps/mobile && npx expo export --platform web
```

Check that `dist/` contains `index.html` and the assets directory.

- [ ] **Step 3: Commit**

```bash
cd /home/sxtnl/dev/web-wrapper
git add apps/mobile/vercel.json
git commit -m "feat(mobile): add Vercel config with SPA rewrite for web deploy

SPA fallback routes all paths to index.html for Expo Router.
Static assets get immutable cache headers.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Verify turbo recognizes the build:web script**

The `build:web` script added in Task 1 should already be picked up by Turborepo
since `turbo.json` defines a generic `build` task. If `build:web` needs its own
turbo pipeline entry, add it:

```bash
cd /home/sxtnl/dev/web-wrapper
# Check if turbo.json needs a build:web task
cat turbo.json | grep -A5 '"build"'
```

If `build:web` isn't covered by existing turbo config, it's fine — Vercel will
call the script directly via the build command: `cd apps/mobile && pnpm build:web`.

- [ ] **Step 5: Document environment variables needed for Vercel**

The Vercel project for `mobile.smartout.ai` needs these env vars configured
in the Vercel dashboard (Settings → Environment Variables):

| Variable                        | Value                               | Notes                                              |
| ------------------------------- | ----------------------------------- | -------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | `https://<project-ref>.supabase.co` | Same as native app                                 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...`                            | Public anon key, safe for client                   |
| `EXPO_PUBLIC_LIVEKIT_URL`       | `wss://...`                         | Not used on web yet, but prevents undefined errors |
| `EXPO_PUBLIC_POSTHOG_KEY`       | `phc_...`                           | PostHog EU project key                             |

Verify these variable names match what `apps/mobile` actually uses by checking:

```bash
grep -r "EXPO_PUBLIC_" --include="*.ts" --include="*.tsx" apps/mobile/src/ | grep -oP "EXPO_PUBLIC_\w+" | sort -u
```

Any variables found that aren't in the table above must also be added to Vercel.

---

## Task 10: End-to-End Verification

**Files:** None (manual testing)

- [ ] **Step 1: Clean build**

```bash
cd /home/sxtnl/dev/web-wrapper/apps/mobile
rm -rf dist/
npx expo export --platform web
```

Expected: Build succeeds with no warnings about missing modules.

- [ ] **Step 2: Serve and test core flows**

```bash
npx serve dist/
```

Test each flow in Chrome DevTools mobile mode (iPhone SE viewport):

1. **Auth:** Welcome screen loads → enter phone/email → OTP verify → workspace select → dashboard
2. **Navigation:** All 4 tabs work (Home, Digest, Shifts, Chat, Me)
3. **Shift schedule:** Calendar renders, shift cards visible
4. **Punch clock:** Clock UI renders (actual punch may need Supabase connection)
5. **Chat:** Channel list loads, can open a conversation
6. **Bottom sheets:** Tap an action that opens a sheet → CSS drawer appears → backdrop dismiss works
7. **No crashes:** Console shows no red errors from native modules

- [ ] **Step 3: Test on actual iPhone Safari**

If an iPhone is available, open the served URL and repeat the core flow test.
Pay special attention to:

- Standalone mode persistence (Add to Home Screen → close → reopen)
- Keyboard behavior in input fields
- Safe area / notch handling
- Tab bar visibility and tap targets

- [ ] **Step 4: Final commit with any remaining fixes**

If any fixes were needed during testing, commit them:

```bash
cd /home/sxtnl/dev/web-wrapper
git add -A
git commit -m "fix(mobile): address web build runtime issues from e2e testing

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
