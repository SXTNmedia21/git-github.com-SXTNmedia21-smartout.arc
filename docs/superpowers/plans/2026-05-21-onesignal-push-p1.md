---
title: OneSignal Push (P1) Implementation Plan
status: draft
updated: 2026-05-21
created: 2026-05-21
module: notifications
tags: [push, onesignal, pwa, plan, phase-1]
---

# OneSignal Push (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Source spec: `docs/superpowers/specs/2026-05-21-notification-system-design.md` (Phase 1).
> Skills to load before relevant tasks: `smartout-edge-function-guide` (Tasks 2,4), `secrets-protocol` (Task 3), `vercel-react-native-skills` (Tasks 5-7).

**Goal:** Make the push channel deliver to the mobile PWA via OneSignal (replacing the dead Expo path), with deep-link navigation on tap, proven on a real device.

**Architecture:** A shared Deno helper `sendOneSignalPush()` POSTs the OneSignal REST API targeting `external_id = profile_id`. `push-dispatch` calls it instead of Expo, preserving the critical-event SMS fallback (now triggered by OneSignal zero-recipients). The mobile client (Expo-web PWA) initialises the OneSignal Web SDK, calls `OneSignal.login(profile_id)` when a profile resolves, and `logout()` on sign-out. Deep links ride the OneSignal `url` field, sourced from each event's `action_url`.

**Tech Stack:** Supabase Edge Functions (Deno), OneSignal REST API v1 + Web SDK v16 (`react-onesignal`), Expo (React Native web), TypeScript, Zod.

**Scope (P1 only):** the outbox push path (`process-notifications → push-dispatch`). The two operational Expo senders (`engine-dispatch/handlers/day-line-push.ts`, `platform-admin/.../push/send`) stay on Expo and are deferred to a P1-followup (spec decision D2). They remain dead in PWA until then — acceptable, they are operational/admin pushes.

---

## File Structure

- **Create** `supabase/functions/_shared/onesignal.ts` — the single push-send helper. One responsibility: POST OneSignal REST, return `{ ok, recipients, error? }`.
- **Create** `supabase/functions/_shared/onesignal.test.ts` — Deno unit test for the helper (mocked `fetch`).
- **Modify** `supabase/functions/push-dispatch/index.ts` — replace Expo POST with helper; map zero-recipients → SMS for critical; read deep-link `action_url`; update docstring.
- **Modify** `supabase/functions/process-notifications/index.ts:356-361` — pass `action_url` into the push payload.
- **Modify** `.env.template` — add `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `ONESIGNAL_DEEP_LINK_BASE`, `EXPO_PUBLIC_ONESIGNAL_APP_ID` (op:// refs, no raw values).
- **Create** `apps/mobile/src/lib/onesignal.ts` — web-guarded init/login/logout (Platform + dynamic import).
- **Create** `apps/mobile/public/OneSignalSDKWorker.js` — service worker shim at site root.
- **Modify** `apps/mobile/app/_layout.tsx` — call `initOneSignal()` once at mount.
- **Modify** `apps/mobile/src/hooks/use-push-token.ts:47` — call `loginOneSignal(profileId)` alongside `registerPushToken`.
- **Modify** `apps/mobile/app/(app)/(home)/settings.tsx` + `apps/mobile/src/components/home/SettingsSheet.tsx` — call `logoutOneSignal()` before `supabase.auth.signOut()`.
- **Modify** `apps/mobile/package.json` — add `react-onesignal` dependency.
- **Create** `docs/decisions/0394-onesignal-push-channel.md` + register in `0000-decision-log.md`.

---

## Task 1: ADR-0394 — OneSignal as the push channel

**Files:**
- Create: `docs/decisions/0394-onesignal-push-channel.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Verify slot still free**

Run: `for n in 0389 0390; do test -e docs/decisions/${n}* && echo "$n TAKEN" || echo "$n FREE"; done && git log --all --name-only | grep -E 'docs/decisions/0389' | sort -u`
Expected: `0389 FREE` and no `--all` hit. If taken, use the next free number and update every reference in this plan.

- [ ] **Step 2: Write the ADR**

Use `docs/templates/decision.md`. Content points:
- **Context:** mobile is Expo exported as web PWA; Expo push tokens require a native build, so `push-dispatch`'s Expo path is dead for PWA users. OneSignal account available; does Web Push now + native later under one app.
- **Decision:** push channel sends via OneSignal REST, targeting `external_id = profile_id` (no device-registry DB column). Expo send code is retired from the outbox path. Critical-event SMS fallback preserved (OneSignal zero-recipients → `attemptSmsFallback`). Deep links via OneSignal `url` = event `action_url`.
- **Consequences:** iOS push only on home-screen-installed PWA (16.4+); `day-line-push` + godmode broadcast deferred (still Expo, dead in PWA) per spec D2; native phase reuses the same OneSignal subscriptions.
- **Alternatives considered:** keep Expo (rejected — dead in PWA); custom Web Push + VAPID (rejected — OneSignal bridges PWA→native, less code).

- [ ] **Step 3: Register in the decision log**

Add the ADR-0394 row to `docs/decisions/0000-decision-log.md` following the existing format.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0394-onesignal-push-channel.md docs/decisions/0000-decision-log.md
git commit -m "docs(notifications): ADR-0394 OneSignal as push channel"
```

---

## Task 2: Shared OneSignal send helper (TDD)

**Files:**
- Create: `supabase/functions/_shared/onesignal.ts`
- Test: `supabase/functions/_shared/onesignal.test.ts`

The helper is the ONLY place that knows the OneSignal REST contract. Returns
`recipients` so callers can detect "no subscribed device" (zero) and apply their
own fallback.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/onesignal.test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@1";
import { sendOneSignalPush } from "./onesignal.ts";

function stubFetch(status: number, json: unknown) {
  globalThis.fetch = ((..._args: unknown[]) =>
    Promise.resolve(
      new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } }),
    )) as typeof fetch;
}

Deno.test("sendOneSignalPush posts external_id alias + headings/contents + url", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
    captured = { url: String(url), init: init! };
    return Promise.resolve(
      new Response(JSON.stringify({ id: "n1", recipients: 1 }), { status: 200 }),
    );
  }) as typeof fetch;

  const res = await sendOneSignalPush({
    appId: "app-123",
    restApiKey: "key-abc",
    externalIds: ["profile-1"],
    title: "Hei",
    body: "Du har en ny vakt",
    url: "https://m.smartout.ai/dashboard/shifts",
    data: { event: "shift.published" },
  });

  assertEquals(res.ok, true);
  assertEquals(res.recipients, 1);
  assertEquals(captured!.url, "https://onesignal.com/api/v1/notifications");
  const sentBody = JSON.parse(captured!.init.body as string);
  assertEquals(sentBody.app_id, "app-123");
  assertEquals(sentBody.target_channel, "push");
  assertEquals(sentBody.include_aliases.external_id, ["profile-1"]);
  assertEquals(sentBody.headings.en, "Hei");
  assertEquals(sentBody.contents.en, "Du har en ny vakt");
  assertEquals(sentBody.url, "https://m.smartout.ai/dashboard/shifts");
  assertEquals(
    (captured!.init.headers as Record<string, string>)["Authorization"],
    "Basic key-abc",
  );
});

Deno.test("sendOneSignalPush reports zero recipients (no subscribed device)", async () => {
  stubFetch(200, { id: "", recipients: 0, errors: ["All included players are not subscribed"] });
  const res = await sendOneSignalPush({
    appId: "a",
    restApiKey: "k",
    externalIds: ["nobody"],
    title: "t",
    body: "b",
  });
  assertEquals(res.ok, true);
  assertEquals(res.recipients, 0);
});

Deno.test("sendOneSignalPush returns ok=false on non-2xx", async () => {
  stubFetch(400, { errors: ["Invalid app_id"] });
  const res = await sendOneSignalPush({
    appId: "a",
    restApiKey: "k",
    externalIds: ["x"],
    title: "t",
    body: "b",
  });
  assertEquals(res.ok, false);
  assertEquals(res.recipients, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions && deno test _shared/onesignal.test.ts --allow-net`
Expected: FAIL — `Module not found "./onesignal.ts"`.

- [ ] **Step 3: Write the helper**

Create `supabase/functions/_shared/onesignal.ts`:

```ts
/**
 * onesignal — single push-send helper for the OneSignal REST API.
 *
 * Targets recipients by OneSignal External ID (= Smartout profile_id), set
 * client-side via OneSignal.login(profile_id). No device token is stored in
 * our DB — OneSignal owns the device registry.
 *
 * Returns `recipients` so callers can detect "no subscribed device" (0) and
 * apply their own fallback (e.g. push-dispatch SMS for critical events).
 */
export type SendOneSignalPushInput = {
  appId: string;
  restApiKey: string;
  externalIds: string[];
  title: string;
  body: string;
  /** Deep link opened when the user taps the notification (PWA route URL). */
  url?: string;
  data?: Record<string, string>;
};

export type SendOneSignalPushResult = {
  ok: boolean;
  recipients: number;
  error?: string;
};

const ONESIGNAL_ENDPOINT = "https://onesignal.com/api/v1/notifications";

export async function sendOneSignalPush(
  input: SendOneSignalPushInput,
): Promise<SendOneSignalPushResult> {
  const payload: Record<string, unknown> = {
    app_id: input.appId,
    target_channel: "push",
    include_aliases: { external_id: input.externalIds },
    headings: { en: input.title },
    contents: { en: input.body },
  };
  if (input.url) payload.url = input.url;
  if (input.data) payload.data = input.data;

  try {
    const res = await fetch(ONESIGNAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${input.restApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = Array.isArray(json?.errors)
        ? json.errors.join("; ")
        : `OneSignal ${res.status}`;
      return { ok: false, recipients: 0, error: errMsg };
    }
    return { ok: true, recipients: Number(json?.recipients ?? 0) };
  } catch (err) {
    return {
      ok: false,
      recipients: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

> NOTE on auth header: OneSignal v1 REST uses `Authorization: Basic <REST_API_KEY>`.
> The newer api.onesignal.com endpoint uses `Key <REST_API_KEY>`. Confirm against the
> OneSignal dashboard for this app during Task 8; if the app is on the new API, change
> the endpoint to `https://api.onesignal.com/notifications` and the header to `Key ...`.
> Update the test's two assertions to match whichever is shipped.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions && deno test _shared/onesignal.test.ts --allow-net`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/onesignal.ts supabase/functions/_shared/onesignal.test.ts
git commit -m "feat(notifications): OneSignal REST send helper with unit tests"
```

---

## Task 3: Env keys + secrets

**Files:**
- Modify: `.env.template`

Load `secrets-protocol` skill first. No raw secret values anywhere — only `op://` references and Edge Function secret names.

- [ ] **Step 1: Add env entries to `.env.template`**

Append (use the existing op:// path convention in the file; `smartout_ai` dev vault):

```bash
# OneSignal push (ADR-0394)
ONESIGNAL_APP_ID="op://smartout_ai/onesignal/app-id"
ONESIGNAL_REST_API_KEY="op://smartout_ai/onesignal/rest-api-key"
ONESIGNAL_DEEP_LINK_BASE="https://m.smartout.ai"
EXPO_PUBLIC_ONESIGNAL_APP_ID="op://smartout_ai/onesignal/app-id"
```

> `ONESIGNAL_APP_ID` is not secret but is read server-side in push-dispatch; keep it as an
> env for parity. `EXPO_PUBLIC_ONESIGNAL_APP_ID` is the client-exposed copy (Expo requires
> the `EXPO_PUBLIC_` prefix for client env). `ONESIGNAL_DEEP_LINK_BASE` is the PWA origin
> used to build absolute deep-link URLs.

- [ ] **Step 2: Set the Edge Function secrets (operator action — log it)**

The operator (Pontus) adds the values to 1Password (`smartout_ai/onesignal` for dev,
`smartout_ai_prod/onesignal` for prod), then sets the Supabase secrets. Do NOT paste raw
values into chat. Command shape (operator runs):

```bash
op run --env-file=.env.template -- bash -c \
  'supabase secrets set ONESIGNAL_APP_ID="$ONESIGNAL_APP_ID" ONESIGNAL_REST_API_KEY="$ONESIGNAL_REST_API_KEY" ONESIGNAL_DEEP_LINK_BASE="$ONESIGNAL_DEEP_LINK_BASE"'
```

- [ ] **Step 3: Commit the template**

```bash
git add .env.template
git commit -m "chore(notifications): add OneSignal env keys to template (ADR-0394)"
```

---

## Task 4: Swap push-dispatch to OneSignal + deep links + SMS preserve

**Files:**
- Modify: `supabase/functions/process-notifications/index.ts:356-361`
- Modify: `supabase/functions/push-dispatch/index.ts`

- [ ] **Step 1: Pass `action_url` into the push payload (process-notifications)**

In `supabase/functions/process-notifications/index.ts`, replace the push body (lines 356-361) `data: {}` so the deep link travels to push-dispatch:

```ts
        body: JSON.stringify({
          event: (row.metadata?.event_key as string) ?? "notification",
          profile_id: row.recipient_id,
          workspace_id: row.workspace_id,
          payload: {
            title: resolvedTitle,
            body: resolvedBody,
            data: { action_url: row.action_url ?? "" },
          },
        }),
```

- [ ] **Step 2: Rewrite push-dispatch send path**

In `supabase/functions/push-dispatch/index.ts`:

(a) Update imports (top of file) — add the helper, keep twilio + cors:

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendSms } from "../_shared/twilio.ts";
import { sendOneSignalPush } from "../_shared/onesignal.ts";
import { corsHeaders } from "../_shared/cors.ts";
```

(b) Update the file docstring (lines 1-13) — replace "via Expo Push API" / "Postgres triggers" with:

```ts
/**
 * push-dispatch — sends push notifications via OneSignal (ADR-0394).
 *
 * Called over HTTP by process-notifications (cron fan-out) with a
 * PUSH_DISPATCH_SECRET bearer token. Targets OneSignal by External ID
 * (= profile_id; set client-side via OneSignal.login). For critical
 * events with no subscribed device (OneSignal recipients = 0), falls
 * back to SMS via Twilio. Deep link rides the OneSignal `url` field.
 */
```

(c) Replace the profile fetch (lines 100-116) — we no longer need `expo_push_token`, only `user_id` for SMS fallback:

```ts
  // Fetch the target profile's user_id (for SMS fallback lookup)
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("user_id")
    .eq("profile_id", profile_id)
    .eq("workspace_id", workspace_id)
    .single();

  if (profileError || !profile) {
    console.error("Profile not found:", profile_id, profileError?.message);
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isCritical = CRITICAL_EVENTS.has(event);
```

(d) Replace the entire Expo send block (the `if (!pushToken) {...}` at 120-132, the `ExpoPushMessage` build at 134-146, and the `try { fetch(exp.host...) ...} catch {...}` at 148-205) with the OneSignal send + zero-recipient SMS fallback:

```ts
  // Build the deep link (absolute PWA URL) from action_url, if present
  const actionUrl = payload.data?.action_url;
  const deepLinkBase = Deno.env.get("ONESIGNAL_DEEP_LINK_BASE") ?? "";
  const url = actionUrl ? `${deepLinkBase}${actionUrl}` : undefined;

  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  if (!appId || !restApiKey) {
    console.error("OneSignal not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await sendOneSignalPush({
    appId,
    restApiKey,
    externalIds: [profile_id],
    title: payload.title,
    body: payload.body,
    url,
    data: { event, ...payload.data },
  });

  // No subscribed device (or send failed) → SMS fallback for critical events
  if ((!result.ok || result.recipients === 0) && isCritical) {
    await attemptSmsFallback(supabase, profile.user_id, payload.body);
  }

  return new Response(
    JSON.stringify({
      sent: result.ok && result.recipients > 0,
      recipients: result.recipients,
      sms_fallback: isCritical && (!result.ok || result.recipients === 0),
      error: result.error,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
```

(e) Remove the now-unused `ExpoPushMessage` type (lines 37-45). Update `PushRequest.payload.data` type comment is fine as-is (`Record<string, string>` already covers `action_url`). Keep `CRITICAL_EVENTS` and `attemptSmsFallback` unchanged.

- [ ] **Step 3: Typecheck the Edge Functions**

Run: `cd supabase/functions && deno check push-dispatch/index.ts process-notifications/index.ts`
Expected: no errors. (If `deno check` is not the project convention, run the repo's EF lint/typecheck task instead.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-dispatch/index.ts supabase/functions/process-notifications/index.ts
git commit -m "feat(notifications): push-dispatch sends via OneSignal + deep links (ADR-0394)"
```

---

## Task 5: Add react-onesignal + client init/login/logout helper

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/src/lib/onesignal.ts`

Load `vercel-react-native-skills`. The helper is web-only; native must never import
`react-onesignal`. Use a Platform guard + dynamic import (spec D7) — no `metro.config.js`
change needed.

- [ ] **Step 1: Add the dependency**

Run: `cd apps/mobile && pnpm add react-onesignal`
Expected: `react-onesignal` appears in `apps/mobile/package.json` dependencies.

- [ ] **Step 2: Write the client helper**

Create `apps/mobile/src/lib/onesignal.ts`:

```ts
/**
 * onesignal (client) — OneSignal Web SDK wiring for the Expo-web PWA (ADR-0394).
 *
 * Web-only: native builds must not bundle react-onesignal, so every entry point
 * guards on Platform.OS === "web" and dynamically imports the SDK. On native this
 * file is a no-op (push there will use the native OneSignal SDK in a later phase).
 */
import { Platform } from "react-native";

let initialised = false;

export async function initOneSignal(): Promise<void> {
  if (Platform.OS !== "web" || initialised) return;
  const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) {
    console.warn("[onesignal] EXPO_PUBLIC_ONESIGNAL_APP_ID missing — push disabled");
    return;
  }
  const OneSignal = (await import("react-onesignal")).default;
  await OneSignal.init({
    appId,
    serviceWorkerPath: "OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: "/" },
    allowLocalhostAsSecureOrigin: true,
  });
  initialised = true;
}

export async function loginOneSignal(profileId: string): Promise<void> {
  if (Platform.OS !== "web" || !profileId) return;
  try {
    const OneSignal = (await import("react-onesignal")).default;
    await OneSignal.login(profileId);
    // Prompt for permission (no-op if already granted/denied)
    await OneSignal.Notifications.requestPermission();
  } catch (err) {
    console.warn("[onesignal] login failed:", err);
  }
}

export async function logoutOneSignal(): Promise<void> {
  if (Platform.OS !== "web") return;
  try {
    const OneSignal = (await import("react-onesignal")).default;
    await OneSignal.logout();
  } catch (err) {
    console.warn("[onesignal] logout failed:", err);
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/mobile exec tsc --noEmit` (or the repo's mobile typecheck task)
Expected: no errors in `onesignal.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/lib/onesignal.ts
git commit -m "feat(mobile): OneSignal web SDK helper (init/login/logout, web-guarded)"
```

---

## Task 6: Service worker asset

**Files:**
- Create: `apps/mobile/public/OneSignalSDKWorker.js`

The OneSignal Web SDK requires its worker at the site root. Expo web export copies
`apps/mobile/public/*` to the served root, so the file resolves at `/OneSignalSDKWorker.js`.

- [ ] **Step 1: Create the worker shim**

Create `apps/mobile/public/OneSignalSDKWorker.js` with exactly:

```js
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/public/OneSignalSDKWorker.js
git commit -m "feat(mobile): OneSignal service worker shim at PWA root"
```

---

## Task 7: Wire init / login / logout into the app lifecycle

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/src/hooks/use-push-token.ts`
- Modify: `apps/mobile/app/(app)/(home)/settings.tsx`
- Modify: `apps/mobile/src/components/home/SettingsSheet.tsx`

- [ ] **Step 1: Init at root mount**

In `apps/mobile/app/_layout.tsx`, add the import and a mount effect inside `RootLayout` (before the returned providers; co-locate with existing top-level effects if any):

```ts
import { useEffect } from "react";
import { initOneSignal } from "@/lib/onesignal";
```

```ts
  useEffect(() => {
    void initOneSignal();
  }, []);
```

- [ ] **Step 2: Login when the profile resolves**

In `apps/mobile/src/hooks/use-push-token.ts`, at the existing `registerPushToken(profileId)` call (line ~47), call OneSignal login alongside it. Add the import and the call:

```ts
import { loginOneSignal } from "@/lib/onesignal";
```

In the effect that calls `registerPushToken(profileId)`:

```ts
    registerPushToken(profileId)
      // ...existing chain unchanged...
    void loginOneSignal(profileId);
```

(Place `void loginOneSignal(profileId);` immediately after the existing `registerPushToken(profileId)` statement, inside the same `if (profileId)` guard.)

- [ ] **Step 3: Logout on sign-out**

In `apps/mobile/app/(app)/(home)/settings.tsx`, add the import and call `logoutOneSignal()` immediately before each `supabase.auth.signOut(...)` (lines ~115, ~176):

```ts
import { logoutOneSignal } from "@/lib/onesignal";
```

```ts
      await logoutOneSignal();
      await supabase.auth.signOut(/* existing args */);
```

In `apps/mobile/src/components/home/SettingsSheet.tsx` (line ~163), do the same before `supabase.auth.signOut()`:

```ts
import { logoutOneSignal } from "@/lib/onesignal";
```

```ts
            void logoutOneSignal();
            supabase.auth.signOut();
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @smartout/mobile exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/src/hooks/use-push-token.ts \
        "apps/mobile/app/(app)/(home)/settings.tsx" apps/mobile/src/components/home/SettingsSheet.tsx
git commit -m "feat(mobile): wire OneSignal init/login/logout into app lifecycle"
```

---

## Task 8: OneSignal dashboard config + device test (manual verification)

No code. This is the de-risking step — the only unproven part of P1.

- [ ] **Step 1: Configure the OneSignal app (operator)**

In the OneSignal dashboard for this app: enable Web Push; set Site URL to the PWA origin (`https://m.smartout.ai`); set the default notification icon; confirm the "Web SDK v16 (custom code)" setup so the self-hosted `OneSignalSDKWorker.js` is used. Verify the App ID matches `EXPO_PUBLIC_ONESIGNAL_APP_ID`.

- [ ] **Step 2: Confirm REST auth form**

Send a test from the dashboard "Messages → New Push" to confirm the app is live. Then confirm whether this app uses the v1 (`Basic`) or new (`Key`) REST auth (Task 2 NOTE) and reconcile `_shared/onesignal.ts` + its test if needed.

- [ ] **Step 3: Android device end-to-end test (the proof)**

Android first — no install gate. On a real Android phone, open the PWA in Chrome, sign in (resolves a profile → `loginOneSignal` fires), accept the push permission prompt. Then trigger an outbox push: either insert an outbox row whose event allows `push` for that recipient, or call `insertOutboxNotification({ workspace_id, recipient_id, event_key: "chat.message", metadata: {...} })`. Within ≤30s (cron) the push should arrive.
Expected: notification appears; tapping it opens the PWA at the event's `action_url` route (deep link).

- [ ] **Step 4: iOS spot-check**

On iOS 16.4+, install the PWA to the home screen first ("Add to Home Screen"), open it, sign in, accept permission, repeat the trigger. Expected: push arrives in the installed PWA. (In a Safari tab it will NOT — documented limitation.)

- [ ] **Step 5: Record the result**

Append the device-test outcome (device, OS version, push received Y/N, deep-link Y/N) to the HANDOFF when closing the feature.

---

## Self-Review notes (for the implementer)

- **Spec coverage:** P1 = push leg alive (Tasks 2,4) + client subscribe (5,6,7) + deep links (Task 4 step 1, Task 2 url field) + device proof (Task 8) + ADR (Task 1). Matrix prefs, AI tools, mobile prefs UI, and the 2 operational Expo senders are explicitly OUT (later phases / P1-followup).
- **Type consistency:** helper input/result types `SendOneSignalPushInput` / `SendOneSignalPushResult` are used identically in Task 2 (definition + test) and Task 4 (call site). Client helper exports `initOneSignal` / `loginOneSignal` / `logoutOneSignal` used verbatim in Task 7.
- **Known fragile point:** OneSignal REST auth header form (`Basic` vs `Key`) and endpoint — Task 8 step 2 reconciles before declaring done.
