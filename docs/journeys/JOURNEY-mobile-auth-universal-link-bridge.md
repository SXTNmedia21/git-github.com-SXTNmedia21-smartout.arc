---
title: "Journey — Mobile Auth Universal-Link Bridge"
status: done
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [journey, mobile, auth, universal-link, app-link, oauth, adr-0368]
---

# Journey — Mobile Auth Universal-Link Bridge

Implements ADR-0368: mobile auth redirectTo targets become Universal Links / App Links on `app.smartout.ai`, with web bridge routes as graceful fallback.

---

## Journey 1: Mobile user signs in with Google (app installed)

**Precondition:** App installed and verified Universal Link association (post-app-publish state with real Team ID + SHA-256 fingerprints).

1. User opens mobile app → `(auth)/welcome.tsx` → "Logg inn".
2. Verify screen → "Fortsett med Google" → `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://app.smartout.ai/m/auth/callback" }})`.
3. supabase-js writes PKCE code-verifier to Expo SecureStore via mobile-storage-adapter.
4. iOS opens `SFAuthenticationSession` / Android opens Custom Tab → user authenticates with Google.
5. Google → Supabase Cloud GoTrue (`<ref>.supabase.co/auth/v1/callback`) → 302 to `https://app.smartout.ai/m/auth/callback?code=<authcode>`.
6. iOS Associated Domains / Android App Link intercepts the URL BEFORE any web render — app opens at `(auth)/m/auth/callback.tsx` native screen.
7. Native screen reads `code` from `useLocalSearchParams()` → `supabase.auth.exchangeCodeForSession(code)` reads verifier from SecureStore → session created.
8. Navigate to `(auth)/workspace-select`.

**Postcondition:** User authenticated in the mobile app. SecureStore has the session. No browser pit-stop visible to user.

**Error paths:**

- Step 4-6 user cancels in Google → callback receives `?error=access_denied&error_description=...` → native screen shows error + "Tilbake" CTA.
- Step 7 `exchangeCodeForSession` fails (PKCE verifier lost — rare, app cold-killed during external browser session) → native screen shows error + "Tilbake".
- Step 6 OS misses Universal Link intent (in-app webview, unverified association) → URL opens in mobile browser → web bridge at `/m/auth/callback` renders → bridge fires `window.location.replace("smartout://auth/callback?...")` → if app installed via in-app intent handler, app opens late; otherwise fallback HTML with App Store CTAs renders + telemetry `auth bridge_relayed { surface: "oauth_callback", relay_attempted: true }`.

---

## Journey 2: Mobile user resets password (recovery email opened on phone)

**Precondition:** User on `(auth)/verify.tsx` login screen, forgotten password. App installed, association verified.

1. User taps "Glemt passord?" → enters email → `resetPasswordForEmail(email, { redirectTo: "https://app.smartout.ai/m/update-password" })`.
2. Supabase Cloud sends recovery email. Link in body = `https://app.smartout.ai/m/update-password#access_token=...&type=recovery`.
3. User opens email on phone → taps link.
4. iOS / Android Universal Link intercept fails (no `/m/update-password` in `apple-app-site-association` components yet — P3 native screen pending) → URL opens in mobile browser → web bridge renders.
5. Bridge fires scheme-URL relay → since app is installed AND scheme registered, OS opens app at `smartout://update-password#access_token=...&type=recovery`.
6. Native handler (P3) reads hash → `updateUser({ password: ... })` → session.

**Postcondition:** Password rotated, user logged in.

**Error paths:**

- Step 4 — until `/m/update-password` is added to `apple-app-site-association` components AND native screen ships (P3), bridge always fires scheme relay; if scheme handler not registered (app uninstalled mid-flow), fallback HTML renders with "Continue in browser" / store CTAs.
- Step 2 — Supabase Cloud SMTP rate-limit (default 3-4/hour) drops email silently. Mitigated by custom SMTP (SendGrid). See canonical doc §4.1.

---

## Journey 3: Desktop user clicks mobile-only recovery link (cross-device)

**Precondition:** User initiated reset on phone but switches to desktop browser to read email (common pattern — recovery email sometimes auto-routed to desktop inbox).

1. User clicks `https://app.smartout.ai/m/update-password#access_token=...` on desktop.
2. No Universal Link to intercept (desktop browser) → web page renders at portal.
3. `UniversalLinkBridge` component on `/m/update-password/page.tsx` attempts scheme-URL relay (`smartout://update-password#...`).
4. Desktop browser cannot resolve `smartout://` scheme → relay fails silently.
5. Telemetry: `auth bridge_relayed { surface: "update_password", relay_attempted: true }` fires.
6. Fallback HTML renders: "Set new password in app" + App Store / Play Store CTAs.

**Postcondition:** User sees clear "open in app" CTA. NOT a dead-end — bridge UI explains and offers options. Future P3: add "Continue in browser" link that routes to portal `/update-password` to consume the same hash web-side.

**Error paths:**

- Bridge errors (e.g. malformed hash) → fallback HTML still renders; user can install app + try again.

---

## Out-of-scope (P3)

- Native `app/(auth)/m/update-password.tsx` screen — bridge-only for now; web fallback works.
- Native `app/(auth)/m/confirm-email.tsx` screen — same.
- Native `app/(auth)/m/invite/callback.tsx` — invite-OAuth flow shipping path P3.
- "Continue in browser" CTA on bridge fallback — small UX polish.
- iOS/Android UL verification with real fingerprints — operator task after app publish.
- E2E test coverage for bridge routes — Playwright HTTP probes possible but require `window.location.replace` testability (Playwright intercepts navigation by default).
