---
title: OneSignal Push — Gap Closure & Completion Plan
status: draft
updated: 2026-05-22
created: 2026-05-22
module: MODULE_COMMUNICATION
tags: [push, onesignal, deeplink, plan, gap-closure]
---

# OneSignal Push — Gap Closure & Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
> Branch: `feat/onesignal-push` (worktree `~/dev/smartout.ai-wt-5`). Spec: `docs/superpowers/specs/2026-05-21-notification-system-design.md`. Builds on the P1 plan `2026-05-21-onesignal-push-p1.md`.

**Goal:** Close the verified gaps so all 3 journeys reach `status: verified` — make a tapped OneSignal web push land on the correct mobile screen (deep link), and complete the ops/deploy/device gates.

**Architecture:** OneSignal web push sets `url = https://mobile.smartout.ai{action_url}` (web-shaped path, e.g. `/dashboard/my-schedule`). Tapping it navigates the PWA to that URL. Expo Router has no `/dashboard/*` routes, so a catch-all route `app/dashboard/[...rest].tsx` intercepts it and redirects to the matching mobile screen using a shared pure mapper extracted from the existing NotificationScreen logic (DRY — one map, two consumers).

**Tech Stack:** Expo Router (React Native web), TypeScript, OneSignal Web SDK v16, vitest (mobile unit tests).

**Verified state going in (from /verify):** server side PASS — push-dispatch reaches OneSignal (new API), critical SMS-fallback fires, auth gate holds. Open: deep-link lands on a real screen (unbuilt), device subscribe (no deploy/subscriber), ops gates.

---

## File Structure

- **Create** `apps/mobile/src/lib/deep-link.ts` — pure `mobileRouteForActionUrl(actionUrl)` mapper. Single source of web-path→mobile-route truth. One responsibility.
- **Create** `apps/mobile/src/lib/__tests__/deep-link.test.ts` — unit tests for the mapper.
- **Modify** `apps/mobile/src/components/notifications/NotificationScreen.tsx:57-112` — replace the inline `if`-ladder with a call to the shared mapper (DRY).
- **Create** `apps/mobile/app/dashboard/[...rest].tsx` — catch-all route; resolves the incoming web path via the mapper and `router.replace`s to the mobile screen (fallback: home). Handles OneSignal web-push `url` navigation (warm + cold).
- **Ops/verification (no code):** Supabase Cloud secrets, redirect whitelist, SW-serves-as-JS check, deploy, device test.

---

## Task 1: Extract shared deep-link mapper (TDD)

**Files:**
- Create: `apps/mobile/src/lib/deep-link.ts`
- Test: `apps/mobile/src/lib/__tests__/deep-link.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/__tests__/deep-link.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mobileRouteForActionUrl } from "../deep-link";

describe("mobileRouteForActionUrl", () => {
  it("maps komm channel to channel-detail", () => {
    expect(mobileRouteForActionUrl("/dashboard/komm/abc123")).toBe(
      "/(app)/(me)/channel-detail/abc123",
    );
  });
  it("maps shift-clock to punch-clock", () => {
    expect(mobileRouteForActionUrl("/dashboard/shift-clock")).toBe("/(app)/(home)/punch-clock");
  });
  it("maps my-schedule and schedule to shifts tab", () => {
    expect(mobileRouteForActionUrl("/dashboard/my-schedule?date=2026-05-22")).toBe("/(app)/(shifts)");
    expect(mobileRouteForActionUrl("/dashboard/schedule")).toBe("/(app)/(shifts)");
  });
  it("maps operations and reconciliation to operations", () => {
    expect(mobileRouteForActionUrl("/dashboard/operations")).toBe("/(app)/(home)/operations");
    expect(mobileRouteForActionUrl("/dashboard/reconciliation")).toBe("/(app)/(home)/operations");
  });
  it("maps my-training to training", () => {
    expect(mobileRouteForActionUrl("/dashboard/my-training")).toBe("/(app)/(home)/training");
  });
  it("maps contracts to contract index", () => {
    expect(mobileRouteForActionUrl("/dashboard/contracts")).toBe("/(app)/(me)/contract");
  });
  it("maps people to team", () => {
    expect(mobileRouteForActionUrl("/dashboard/people")).toBe("/(app)/(home)/team");
  });
  it("returns null for generic dashboard and unknown paths", () => {
    expect(mobileRouteForActionUrl("/dashboard")).toBeNull();
    expect(mobileRouteForActionUrl("/dashboard/unknown-thing")).toBeNull();
    expect(mobileRouteForActionUrl("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @smartout/mobile test deep-link`
Expected: FAIL — `Cannot find module '../deep-link'`.
(If the mobile test script differs, find it: `grep '"test"' apps/mobile/package.json`. The existing `src/hooks/__tests__/use-push-token.test.ts` confirms a runner is configured.)

- [ ] **Step 3: Write the mapper**

Create `apps/mobile/src/lib/deep-link.ts`:

```ts
/**
 * deep-link — single source of truth mapping a web-shaped notification
 * action_url (e.g. "/dashboard/my-schedule") to a mobile Expo Router route.
 *
 * Used by:
 *  - NotificationScreen (in-app bell tap)
 *  - app/dashboard/[...rest].tsx (OneSignal web-push url landing, ADR-0389)
 *
 * Returns null for the generic "/dashboard" and any unknown path — callers
 * decide the fallback (no-op for the bell, home for the catch-all route).
 */
export function mobileRouteForActionUrl(actionUrl: string): string | null {
  if (!actionUrl) return null;
  const [pathname] = actionUrl.split("?");
  const segments = pathname.split("/").filter(Boolean); // ["dashboard","komm","<id>"]
  if (segments[0] !== "dashboard") return null;

  const section = segments[1];
  switch (section) {
    case "komm":
      return segments[2] ? `/(app)/(me)/channel-detail/${segments[2]}` : null;
    case "shift-clock":
      return "/(app)/(home)/punch-clock";
    case "my-schedule":
    case "schedule":
      return "/(app)/(shifts)";
    case "operations":
    case "reconciliation":
      return "/(app)/(home)/operations";
    case "my-training":
      return "/(app)/(home)/training";
    case "contracts":
      return "/(app)/(me)/contract";
    case "people":
      return "/(app)/(home)/team";
    default:
      return null; // generic /dashboard or unknown
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @smartout/mobile test deep-link`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/deep-link.ts apps/mobile/src/lib/__tests__/deep-link.test.ts
git commit -m "feat(mobile): shared deep-link action_url to mobile-route mapper"
```

---

## Task 2: Refactor NotificationScreen to use the shared mapper (DRY)

**Files:**
- Modify: `apps/mobile/src/components/notifications/NotificationScreen.tsx:57-112`

- [ ] **Step 1: Add the import**

At the top of `NotificationScreen.tsx`, add:

```ts
import { mobileRouteForActionUrl } from "@/lib/deep-link";
```

- [ ] **Step 2: Replace the inline if-ladder**

Replace the entire body of `handleNotificationPress` (current lines 57-112, the `if (!notification.action_url) return;` through the closing `[router]`) with:

```ts
  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      if (!notification.action_url) return;
      const route = mobileRouteForActionUrl(notification.action_url);
      // Generic /dashboard or unknown → no navigation; the tap itself is the feedback.
      if (route) router.push(route as never);
    },
    [router],
  );
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/mobile exec tsc --noEmit 2>&1 | grep -i "NotificationScreen\|deep-link" || echo "no errors in changed files"`
Expected: `no errors in changed files`. (If you see `Cannot find module '@smartout/telemetry'` style errors elsewhere, build deps first: `TURBO_CONCURRENCY=1 pnpm --filter @smartout/telemetry --filter @smartout/types --filter @smartout/utils build`.)

- [ ] **Step 4: Re-run the mapper test (still green after refactor)**

Run: `pnpm --filter @smartout/mobile test deep-link`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/notifications/NotificationScreen.tsx
git commit -m "refactor(mobile): NotificationScreen uses shared deep-link mapper"
```

---

## Task 3: Catch-all route for OneSignal web-push landing

**Files:**
- Create: `apps/mobile/app/dashboard/[...rest].tsx`

**Why:** OneSignal web push sets `url = https://mobile.smartout.ai/dashboard/<section>`. Tapping navigates the PWA there. Expo Router has no `/dashboard/*` screen, so without this it hits `+not-found`. This catch-all resolves the path via the shared mapper and redirects.

- [ ] **Step 1: Create the catch-all route**

Create `apps/mobile/app/dashboard/[...rest].tsx`:

```tsx
/**
 * Catch-all for /dashboard/* — the landing target of OneSignal web-push deep
 * links (ADR-0389). The push `url` is web-shaped (e.g. /dashboard/my-schedule);
 * this route maps it to the real mobile screen and redirects. Unknown paths
 * fall back to home so a tap never dead-ends on +not-found.
 */
import { useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { mobileRouteForActionUrl } from "@/lib/deep-link";

export default function DashboardDeepLinkCatchAll() {
  const pathname = usePathname(); // e.g. "/dashboard/my-schedule"
  const params = useLocalSearchParams();

  useEffect(() => {
    // Preserve query string (e.g. ?date=) for the mapper's pattern matching.
    const query =
      typeof params.date === "string" ? `?date=${params.date}` : "";
    const target = mobileRouteForActionUrl(`${pathname}${query}`);
    router.replace((target ?? "/(app)/(home)") as never);
  }, [pathname, params]);

  return <View />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @smartout/mobile exec tsc --noEmit 2>&1 | grep -i "dashboard\|rest\|deep-link" || echo "no errors in changed files"`
Expected: `no errors in changed files`.

- [ ] **Step 3: Verify route resolves locally (run the web PWA)**

Run the Expo web build and hit the path directly:
```bash
cd apps/mobile && pnpm exec expo start --web --port 8083 &
sleep 25
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8083/dashboard/my-schedule"
```
Expected: `200` (SPA serves index; the route mounts and redirects). Then in a browser open `http://localhost:8083/dashboard/my-schedule` → should land on the shifts tab, not `+not-found`. Capture the screen. Kill the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/dashboard/[...rest].tsx
git commit -m "feat(mobile): catch-all /dashboard route maps OneSignal deep links to mobile screens"
```

---

## Task 4: Ops gates — secrets, auth whitelist, service worker (operator: Pontus)

No app code. These unblock the deployed pipeline + device test. Load `secrets-protocol` + `deploying` skills.

- [ ] **Step 1: Secrets into 1Password (both vaults)**

```bash
# dev vault
op item create --vault smartout_ai --title onesignal \
  app-id="b7d27f4f-5e80-47dc-8728-8f4de8eec1fe" rest-api-key="<REST_KEY>"
# prod vault
op item create --vault smartout_ai_prod --title onesignal \
  app-id="b7d27f4f-5e80-47dc-8728-8f4de8eec1fe" rest-api-key="<REST_KEY>"
```
(App ID is public; REST key is secret. Never paste raw values into chat.)

- [ ] **Step 2: Set Supabase Cloud Edge Function secrets**

```bash
op run --env-file=.env.template -- bash -c \
  'supabase secrets set ONESIGNAL_APP_ID="$ONESIGNAL_APP_ID" \
     ONESIGNAL_REST_API_KEY="$ONESIGNAL_REST_API_KEY" \
     ONESIGNAL_DEEP_LINK_BASE="$ONESIGNAL_DEEP_LINK_BASE" --project-ref <prod-ref>'
```
Verify: `supabase secrets list --project-ref <prod-ref>` shows all three.

- [ ] **Step 3: Add `mobile.smartout.ai/**` to the Supabase Auth redirect whitelist**

Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → add `https://mobile.smartout.ai/**`. Without this, sign-in on that origin fails → `loginOneSignal` never fires → no subscription.

- [ ] **Step 4: Verify the service worker serves as JS (after deploy)**

```bash
curl -s -H "Accept: application/javascript" https://mobile.smartout.ai/OneSignalSDKWorker.js | head -2
```
Expected: the `importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");` line — NOT the SPA `<!doctype html>`. If HTML, add a Vercel route exception so the static file wins over the `/(.*) → /index.html` rewrite.

---

## Task 5: Deploy + device verification → flip journeys

- [ ] **Step 1: Land the branch + deploy to mobile.smartout.ai**

Merge `feat/onesignal-push` → `development` (per CLAUDE.md flow), let the pipeline deploy the mobile PWA to `mobile.smartout.ai`. (Operator decision: merge now vs preview-deploy first.)

- [ ] **Step 2: Subscribe a real Android device**

On Android Chrome, open `https://mobile.smartout.ai` → sign in (resolves profile → `loginOneSignal` fires) → tap "Allow" on the push prompt. Verify subscription landed:
```bash
# via MCP: should now show total_count >= 1
```
Run the `mcp__onesignal__view_players` tool → expect `total_count >= 1`.

- [ ] **Step 3: Send a test push + observe delivery (Journey: employee-receives-push)**

Use the MCP `mcp__onesignal__send_push_notification` with `external_ids: ["<the subscribed profile_id>"]`, `title`, `message`, and `data: { action_url: "/dashboard/my-schedule" }`. Expected: push arrives on the device; tapping it opens the PWA and lands on the shifts tab (catch-all → mapper). Capture the device screen.

- [ ] **Step 4: Verify deep link (Journey covered by Tasks 1-3)**

Confirm the tap landed on `(app)/(shifts)`, not `+not-found`. Try a second `action_url` (e.g. `/dashboard/shift-clock` → punch-clock).

- [ ] **Step 5: Verify critical SMS fallback (Journey: critical-sms-fallback)**

Already proven server-side in /verify (live: `sms_fallback:true` + "No phone number" log). For a full end-to-end: trigger a `deviation_reported` outbox event for a recipient with a phone but no subscribed device → confirm SMS arrives (Twilio). Or accept the server-side proof + document.

- [ ] **Step 6: Flip the 3 journeys to verified**

In each `docs/journeys/JOURNEY-onesignal-push-*.md`, check the 3 verification boxes and set `status: verified` + `verified_at:`. Then the feature is closable via `/close-feature`.

---

## Self-Review

**1. Spec coverage:** Deep-link-to-correct-screen (spec D5) → Tasks 1-3. Mobile-only origin → unchanged. Critical SMS (D4) → verified server-side (Task 5 step 5). Secrets/whitelist/SW (spec Risk section) → Task 4. Device proof → Task 5. All P1 spec items mapped. Matrix prefs / AI tools / day-line migration remain out of scope (P2-P4, separate plans) — not gaps in P1.

**2. Placeholder scan:** No TBD/TODO. `<REST_KEY>` and `<prod-ref>` in Task 4 are operator-supplied secret/ref values (correctly NOT hardcoded per secrets-protocol), not plan placeholders. Every code step has complete code.

**3. Type consistency:** `mobileRouteForActionUrl(actionUrl: string): string | null` — identical signature in Task 1 (def + test), Task 2 (NotificationScreen call), Task 3 (catch-all call). Return type `string | null` handled consistently (bell: no-op on null; catch-all: home fallback on null).

**Known UX note (not a gap):** OneSignal "Click Behavior" defaults to "navigate to new tab" — for an installed PWA this may open a browser tab rather than focusing the standalone window. If the device test shows that, change Click Behavior in the OneSignal dashboard to focus/exact; the catch-all route works regardless of which window it lands in. SPA-no-reload click-handler is deferred polish, not required for the journeys.
