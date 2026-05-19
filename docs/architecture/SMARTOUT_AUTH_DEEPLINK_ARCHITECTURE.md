---
title: "Auth & Deep-Link Architecture"
id: AUTH_DEEPLINK_ARCH
version: "1.0"
status: canonical
layer: architecture
created: 2026-05-18
updated: 2026-05-18
author: pontus + claude
supersedes: []
superseded_by: null
depends_on:
  - SUBDOMAIN_ARCH
  - CORE_ARCH_V2
related_adrs:
  - ADR-0021
  - ADR-0075
  - ADR-0132
  - ADR-0133
  - ADR-0134
  - ADR-0167
  - ADR-0168
  - ADR-0169
  - ADR-0374
tags:
  - auth
  - oauth
  - pkce
  - magic-link
  - reset-password
  - invitation
  - deep-link
  - universal-link
  - subdomain
  - mobile
  - portal
tables:
  - user_identity
  - profile
  - workspace
  - invitation
  - signup_progress
changelog:
  - date: 2026-05-18
    change: "Initial canonical version — consolidates ADR-0021 amendment, ADR-0374 portal-redirect, ADR-0167/0168/0169 auth-invitation council, and the unshipped mobile universal-link doctrine into one ground-truth document."
---

# Smartout — Auth & Deep-Link Architecture

> **Status:** Canonical (v1.0). Web portal-redirect shipped 2026-05-18 (ADR-0374). Mobile universal-link bridge is P2 (Phase 6 of `docs/superpowers/specs/2026-04-20-auth-invitation-implementation-plan.md`).
> **Depends on:** `SMARTOUT_Subdomain_Routing_Architecture.md` (host topology + cookie-domain rules).
> **Audience:** anyone touching `apps/web/src/proxy.ts`, `apps/web/src/app/api/auth/`, `apps/web/src/app/login`, `apps/web/src/app/signup`, `apps/web/src/app/invite`, `apps/web/src/app/reset-password`, `apps/web/src/app/update-password`, `apps/mobile/app/(auth)/`, `supabase/config.toml`, or Supabase Cloud / Google Cloud / Apple / Google Play auth config.

---

## 1. The Three Invariants

Every auth flow in Smartout — web or mobile, OAuth or magic-link or password — obeys three load-bearing rules. Break any one and the system fails in the same way: bouncing the user back to `/login?error=Invalid_link` with no useful diagnostic.

### I1. Portal Doctrine — `app.smartout.ai` is the only auth surface.

Per **ADR-0021 amendment 2026-04-20** (Auth & Invitation Council Q1=b) and **ADR-0374**: every auth screen (`/login`, `/signup`, `/join`, `/reset-password`, `/update-password`, `/invite/**`, `/confirm-email`, `/select-workspace`, `/welcome`) lives on `app.smartout.ai` only. Workspace subdomains (`{slug}.smartout.ai`) middleware-redirect (307) every auth-route request to the portal with `?continue=<slug>` preserved. Rationale: PKCE code-verifier cookies are host-scoped. Centralising on one host means one Supabase Cloud Redirect URL whitelist entry — and zero whitelist churn as new workspaces are added.

### I2. Cookie Doctrine — sessions are scoped to `.smartout.ai`.

Session cookies are set with `Domain=.smartout.ai` (leading dot) so any subdomain can read them. A user who completes auth on `app.smartout.ai` is automatically authenticated on `acme.smartout.ai`, `peppes.smartout.ai`, and every future workspace slug — no extra handshake. The cookie domain is computed in `packages/supabase/src/client.ts:6` (`getCookieDomain`), `packages/supabase/src/middleware.ts:6` (`getMiddlewareCookieDomain`), and `apps/web/src/proxy.ts:204` (`rootDomain` lookup). The single env var driving this is `NEXT_PUBLIC_ROOT_DOMAIN=smartout.ai` on Vercel production.

### I3. Universal-Link Doctrine — mobile auth is HTTPS-first, scheme-second.

Mobile uses `https://app.smartout.ai/...` Universal Links (iOS) / App Links (Android) for every auth callback target. The custom URL scheme `smartout://` is a **fallback only inside the app** (when the app has already opened the URL). Rationale: e-mail clients on desktop cannot resolve `smartout://`. QR codes scanned by non-installers cannot resolve `smartout://`. Apple Mail strips unknown schemes. Universal Links degrade gracefully — the same URL works in the browser (web fallback) and in the native app (deep-link).

---

## 2. Surface Map — what runs where

```
┌────────────────────────────────────────────────────────────────────────┐
│  AUTH ENTRY POINTS                                                      │
├────────────────────────────────────────────────────────────────────────┤
│  Surface              Host                          What it does       │
│  ────────             ──────                        ───────────        │
│  /login               app.smartout.ai               Email+pwd, OTP, OAuth│
│  /signup              app.smartout.ai               Email+pwd new acct  │
│  /join                app.smartout.ai               Workspace-create    │
│  /invite/<token>      app.smartout.ai               Accept invitation   │
│  /reset-password      app.smartout.ai               Request reset link  │
│  /update-password     app.smartout.ai               Set new password    │
│  /confirm-email       app.smartout.ai               Email-confirm hash  │
│  /select-workspace    app.smartout.ai               Workspace picker    │
│  /welcome             app.smartout.ai               Post-signup CTA     │
│  /api/auth/callback   app.smartout.ai               exchangeCodeForSession│
│                                                                          │
│  /m/auth/callback     app.smartout.ai (P2)          Universal-link bridge│
│  /m/invite/<token>    app.smartout.ai (P2)          Universal-link bridge│
│  /m/reset             app.smartout.ai (P2)          Universal-link bridge│
│                                                                          │
│  Mobile native        smartout://*                  Inside-app fallback │
│    (auth)/verify.tsx                                Login/SMS-OTP/Email-OTP│
│    (auth)/invite/                                   In-app invite-accept │
│                                                                          │
│  Workspace subdomain  <slug>.smartout.ai            ⟶ 307 to portal     │
│    (any auth route)                                  with ?continue=<slug>│
└────────────────────────────────────────────────────────────────────────┘
```

| Layer | Web | Mobile |
|---|---|---|
| Auth entry | Portal pages on `app.smartout.ai` | Native screens under `apps/mobile/app/(auth)/` |
| OAuth provider redirect | `https://<ref>.supabase.co/auth/v1/callback` (Google Cloud Console authorized URI) | Same |
| PKCE verifier cookie scope | Host-scoped to portal | App keychain (Expo SecureStore via supabase-js) |
| Post-auth callback target | `https://app.smartout.ai/api/auth/callback?code=...` | `https://app.smartout.ai/m/auth/callback?...` (Universal Link → app deep-link) |
| Session storage | Cookie `Domain=.smartout.ai` | SecureStore (Supabase storage key) |
| Cross-subdomain SSO | Automatic via shared cookie | N/A (single-app instance) |
| Logout | `signOut()` clears cookies | `signOut()` clears SecureStore |

---

## 3. The Four Canonical Flows

Each flow is documented in three sections: **happy path**, **sequence**, and **failure modes**. All four are governed by the three invariants in §1.

### 3.1 Google OAuth

#### Happy path — Web

User on `acme.smartout.ai/login` → 307 to `app.smartout.ai/login?continue=acme` (proxy.ts §5a, ADR-0374). User clicks "Fortsett med Google" → `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://app.smartout.ai/api/auth/callback?next=/dashboard" }})`. Supabase client sets PKCE `code-verifier` cookie on `.smartout.ai` (via `createBrowserClient` cookie config). Browser → Google → Supabase Cloud GoTrue (`<ref>.supabase.co/auth/v1/callback`) → 302 to `app.smartout.ai/api/auth/callback?code=<authcode>&continue=acme` (continue preserved by Supabase pass-through). Callback runs `exchangeCodeForSession(code)`, reads PKCE verifier from cookie (same host = success), creates session. `resolveContinueDestination()` validates `continue=acme` against `SLUG_PATTERN` + `profile` existence → 307 to `https://acme.smartout.ai/dashboard`. Browser sends `.smartout.ai`-scoped cookies on new request → workspace dashboard renders.

#### Happy path — Mobile

User opens mobile app, taps "Logg inn med Google" → `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://app.smartout.ai/m/auth/callback" }})`. Supabase-js writes PKCE verifier to Expo SecureStore. iOS opens `SFAuthenticationSession` / Android opens `Custom Tab` to Google. Google → Supabase Cloud → 302 to `https://app.smartout.ai/m/auth/callback?code=...`. iOS resolves Universal Link via `applinks:app.smartout.ai` association → opens app at `(auth)/callback` native screen. Native screen reads `code` from URL params → `supabase.auth.exchangeCodeForSession(code)` (PKCE verifier resolved from SecureStore — same client instance). Session created. Navigate to `/(auth)/workspace-select`.

#### Sequence

```
Web:
  acme.smartout.ai/login
        ↓ 307 (proxy.ts §5a)
  app.smartout.ai/login?continue=acme
        ↓ signInWithOAuth({ provider:"google", redirectTo:"app.smartout.ai/api/auth/callback" })
        ↓ PKCE verifier → cookie .smartout.ai
  accounts.google.com  ──→  <ref>.supabase.co/auth/v1/callback
                                  ↓ 302
  app.smartout.ai/api/auth/callback?code=<x>&continue=acme
        ↓ exchangeCodeForSession(code) — reads PKCE verifier from cookie
        ↓ profile lookup
        ↓ resolveContinueDestination("acme") — slug regex + profile-existence guard
  acme.smartout.ai/dashboard   ← session cookies sent via .smartout.ai

Mobile:
  Mobile app (Logg inn med Google)
        ↓ signInWithOAuth({ provider:"google", redirectTo:"app.smartout.ai/m/auth/callback" })
        ↓ PKCE verifier → SecureStore (Supabase storage adapter)
  SFAuthenticationSession/Custom Tab → accounts.google.com → <ref>.supabase.co/auth/v1/callback
        ↓ 302
  https://app.smartout.ai/m/auth/callback?code=<x>
        ↓ Universal Link resolves (associatedDomains)
  Mobile app: (auth)/callback native screen
        ↓ exchangeCodeForSession(code) — reads PKCE from SecureStore
  (auth)/workspace-select
```

#### Failure modes

| Failure | Cause | User-visible | Recovery |
|---|---|---|---|
| `/login?error=Invalid_link` after Google → callback | PKCE verifier cookie missing or host-mismatch (e.g. OAuth init on workspace host, callback on portal). Pre-ADR-0374 default. | Bounced back to portal `/login` with error banner | Fixed by ADR-0374 (workspace-subdomain auth-route redirect). If still occurs post-fix: Supabase Cloud Redirect URLs whitelist doesn't include `https://app.smartout.ai/**`. |
| Google OAuth screen shows `redirect_uri_mismatch` | Google Cloud Console Authorized redirect URIs missing `https://<ref>.supabase.co/auth/v1/callback` | Google error page (never reaches Supabase) | Add the Supabase project callback URI to Google Cloud Console. |
| Mobile callback opens browser (not app) | iOS associatedDomains not propagated, OR `apple-app-site-association` file missing/invalid on portal | Web `/m/auth/callback` bridge attempts manual deep-link via `smartout://auth/callback` (P2 fallback) | Verify `apple-app-site-association` JSON valid + served with `Content-Type: application/json` at `https://app.smartout.ai/.well-known/apple-app-site-association`. |
| `continue=victim-slug` redirect bypass attempt | Bad-faith query param crafted to bounce user to wrong workspace | Falls through to portal `/dashboard` (`resolveContinueDestination` rejects on profile-existence) | Guard already in place (callback/route.ts:39-52). |

### 3.2 Magic-link OTP

#### Happy path — Web

User on portal `/login` → switches to "Engangskode" tab → enters email → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false }})`. Supabase Cloud emails 6-digit code + magic link (both work). User enters code into `OtpVerificationForm` (`apps/web/src/components/auth/OtpVerificationForm.tsx`) → `verifyOtp({ email, token: code, type: "email" })` → session created. Cookie set on `.smartout.ai`. Redirect to `/dashboard`.

#### Happy path — Mobile

User on `(auth)/verify.tsx` flow=login → switches to "Send meg kode" → SMS or email tab → enters phone/email → `supabase.auth.signInWithOtp({ phone | email })`. Supabase Cloud sends SMS via Twilio (phone) or email (email). User enters 6-digit code → `verifyOtp({ phone|email, token, type: "sms"|"email" })`. Session stored in SecureStore. Navigate to `/(auth)/workspace-select`.

#### Magic-link variant (web only)

Magic link target is `https://app.smartout.ai/api/auth/callback?token_hash=...&type=magiclink`. Click → callback `exchangeCodeForSession()` path → session → `/dashboard`. (Supabase consolidates OTP magic-link onto same callback as OAuth.)

#### Magic-link variant (mobile)

Universal Link to `https://app.smartout.ai/m/auth/callback?token_hash=...&type=magiclink`. iOS/Android resolve → app `(auth)/callback` → `verifyOtp({ token_hash, type: "magiclink" })` → session.

#### Failure modes

| Failure | Cause | Recovery |
|---|---|---|
| Code never arrives | Supabase Cloud default SMTP rate-limit (~3-4/hour); no custom SMTP wired | Wire SendGrid SMTP in Supabase Cloud → Auth → SMTP Settings (`SENDGRID_API_KEY` already in vault). |
| "Email rate limit exceeded" error | Same code re-sent >3 times in <1 hour | Wait 60min (Supabase default) or wire custom SMTP. |
| OTP form accepts code but session never sticks | Cookie domain misconfigured (NEXT_PUBLIC_ROOT_DOMAIN missing on Vercel) | Set env var. |
| Magic link clicked on desktop opens app on mobile (or vice versa) | Cross-device limitation of Universal Links — clicked link follows the device | Document in onboarding: "open the link on the device you want to sign in on." |

### 3.3 Password reset

#### Happy path — Web (self-service)

User on `acme.smartout.ai/reset-password` → 307 to `app.smartout.ai/reset-password?continue=acme`. User enters email → `resetPasswordForEmail(email, { redirectTo: "https://app.smartout.ai/update-password" })`. Generic message shown regardless of account existence (`apps/web/src/app/reset-password/page.tsx:69` — `enumeration-safe`). User checks email → clicks recovery link → lands on `https://app.smartout.ai/update-password#access_token=...&type=recovery`. Supabase client SDK auto-consumes the hash → fires `PASSWORD_RECOVERY` auth event → page sets `ready=true` → user submits new password → `updateUser({ password, data: { force_password_reset: false }})` atomic. Redirect to `/select-workspace` after 1.5s.

#### Happy path — Web (Bubble-migration force-reset)

User has session with `user_metadata.force_password_reset === true` (pre-created by `strike-auth-bridge`). Middleware `proxy.ts:243-249` detects flag on any authenticated route → 307 to `/update-password`. Page shows migration banner ("Vi har oppgradert plattformen") → user sets password → `updateUser({password, data:{force_password_reset:false}})` clears flag atomically.

#### Happy path — Mobile (P2)

User on `(auth)/verify.tsx` → "Glemt passord?" → enter email → `resetPasswordForEmail(email, { redirectTo: "https://app.smartout.ai/m/update-password" })`. Supabase emails recovery link. User clicks on phone → Universal Link → app `(auth)/update-password` native screen → reads hash from URL params → `updateUser({password})`.

#### Failure modes

| Failure | Cause | Recovery |
|---|---|---|
| `/update-password` shows but form disabled | No session AND no recovery hash (direct navigate) | Page redirects to `/reset-password` (L-0089 ghost-route guard, update-password/page.tsx:55-66). |
| Reset link from email shows expired error | Supabase recovery token TTL exceeded (default 1h) | Request new link. |
| Mobile recovery link opens browser instead of app | Universal Link not yet wired for `/m/update-password` (P2 pending) | Web `/m/update-password` bridge shows "Open in app" CTA OR completes in browser (degrades gracefully). |

### 3.4 Invitation accept

#### Happy path — Web (new user via Google)

Invitee receives email containing `https://app.smartout.ai/invite/<token>` (note: portal-host, NOT workspace-host, per current convention — see `apps/web/src/lib/notifications/*` invite-mailer wiring). User clicks → portal `/invite/[token]` page. RPC `track_invitation_opened(p_token)` fires (idempotent, emits `invitation opened` once per token). User clicks "Logg inn med Google" → routes to `/login?invite=<token>` on portal → Google OAuth → callback. Callback's `exchangeCodeForSession` succeeds → `accept-invitation` Edge Function called (creates `user_identity`, `profile`, `company_member`) → session → `/dashboard` on workspace subdomain (via `continue` if present, OR via invitation's workspace).

#### Happy path — Web (workspace-subdomain invite link)

If invitation email is mistakenly sent with `https://<slug>.smartout.ai/invite/<token>` (legacy, or admin-shared link from workspace context) → invitee clicks → workspace subdomain → middleware 307 to `app.smartout.ai/invite/<token>?continue=<slug>` (proxy.ts §5a) → standard invite flow. The `continue` is honored on callback so user returns to the originating workspace dashboard.

#### Happy path — Mobile (P2)

QR or in-app paste → `(auth)/invite/[token]` native screen. Invite info displayed. User taps "Aksjons med Google" → `signInWithOAuth({redirectTo: "https://app.smartout.ai/m/invite/callback?token=<token>"})` (P2). Native callback → `accept-invitation` Edge Function. Workspace-select navigation.

#### Failure modes

| Failure | Cause | Recovery |
|---|---|---|
| Invite "already used" | Token single-use, already accepted | Admin re-issues invitation. |
| Invite "expired" | Token TTL exceeded | Admin re-issues. |
| Invite-Google flow lands on `/login?error=Invalid_link` | Pre-ADR-0374 PKCE-verifier-host-mismatch bug | Fixed by ADR-0374. |
| Mobile invite opens web instead of app | Universal Link not wired (P2 pending) | Web fallback shows "Last ned appen" prompt + same accept-invite flow proceeds in browser. |

---

## 4. Wire Configuration

The auth+deeplink system has **five** independent configuration surfaces that must match. Mismatch in any one produces `/login?error=Invalid_link` or worse.

### 4.1 Supabase Cloud

**Path:** `https://supabase.com/dashboard/project/<prod-ref>/auth/url-configuration`

| Setting | Value | Why |
|---|---|---|
| **Site URL** | `https://app.smartout.ai` | GoTrue fallback when `redirectTo` is missing from a request. Sets the email-template link base. |
| **Redirect URLs** (whitelist) | `https://app.smartout.ai/**` | Single entry — no wildcards across subdomains needed (I1 + I3). All workspace-redirect flows funnel through the portal. |

**Path:** `https://supabase.com/dashboard/project/<prod-ref>/auth/providers`

| Provider | Setting | Value |
|---|---|---|
| Google | Enabled | ✓ |
| Google | Client ID + Secret | from 1Password `smartout_ai_prod/Google-OAuth/{client_id,secret}` |

**Path:** `https://supabase.com/dashboard/project/<prod-ref>/auth/templates`

Email templates use `{{ .SiteURL }}` token which resolves to Site URL (`https://app.smartout.ai`). Recovery/magic-link/confirm templates all build URLs on the portal. **Do not hardcode workspace hosts in templates.**

**Path:** `https://supabase.com/dashboard/project/<prod-ref>/auth/smtp-settings`

| Setting | Value |
|---|---|
| Enable custom SMTP | ✓ |
| Host | `smtp.sendgrid.net` |
| Port | `587` |
| Username | `apikey` |
| Password | from 1Password `smartout_ai_prod/SendGrid/api_key` |
| Sender email | from 1Password `smartout_ai_prod/SendGrid/sender_email` |

Without custom SMTP, Supabase default cap is ~3-4 emails/hour — production-broken for reset + OTP at scale.

### 4.2 Google Cloud Console

**Path:** `https://console.cloud.google.com/apis/credentials` → OAuth 2.0 Client IDs → Smartout Web

| Field | Value |
|---|---|
| Authorized JavaScript origins | `https://app.smartout.ai` (portal only — workspace-subdomain origins NOT required because OAuth init runs on portal) |
| Authorized redirect URIs | `https://<prod-ref>.supabase.co/auth/v1/callback` (Supabase GoTrue endpoint — Google talks to Supabase, not Next.js) |

Common trap: developers add `https://app.smartout.ai/api/auth/callback` to Google's whitelist. **Wrong.** Google never redirects to the Next.js app directly — it redirects to Supabase GoTrue, which then redirects to the app's `redirectTo`.

### 4.3 Vercel

**Path:** Vercel → Project `smartout-web` → Settings → Environment Variables → Production

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from 1Password `smartout_ai_prod/Supabase/anon_key` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `smartout.ai` |
| `SUPABASE_SERVICE_ROLE_KEY` | from 1Password `smartout_ai_prod/Supabase/service_role_key` |

`NEXT_PUBLIC_ROOT_DOMAIN` is the single source for cookie-domain (`.smartout.ai`) AND portal-redirect target (`app.${rootDomain}`). Missing → cookies host-scoped (no SSO across subdomains) AND no workspace-to-portal redirect → entire ADR-0021 architecture broken.

### 4.4 Apple Universal Links (mobile P2)

**File:** `apps/web/public/.well-known/apple-app-site-association` (served by Vercel; no extension; `Content-Type: application/json`)

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["<TEAM_ID>.ai.smartout.mobile"],
        "components": [
          { "/": "/invite/*", "comment": "Invitation accept" },
          { "/": "/m/auth/callback", "comment": "OAuth callback bridge" },
          { "/": "/m/invite/callback", "comment": "Invite OAuth callback bridge" },
          { "/": "/m/update-password", "comment": "Password recovery bridge" },
          { "/": "/m/confirm-email", "comment": "Email confirmation bridge" }
        ]
      }
    ]
  }
}
```

`<TEAM_ID>` from Apple Developer Portal → Membership tab. App bundle = `ai.smartout.mobile` (from `apps/mobile/app.json:ios.bundleIdentifier`).

**Trap:** Vercel by default rewrites `.well-known/*` requests via `next.config.js`. Verify the file is served verbatim (no MIME re-write) by `curl -I https://app.smartout.ai/.well-known/apple-app-site-association`.

### 4.5 Android App Links (mobile P2)

**File:** `apps/web/public/.well-known/assetlinks.json` (served as `application/json`)

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "ai.smartout.mobile",
      "sha256_cert_fingerprints": ["<SHA256_OF_RELEASE_KEYSTORE>"]
    }
  }
]
```

`<SHA256_OF_RELEASE_KEYSTORE>` from Google Play Console → Setup → App Integrity → App signing key certificate. **In debug builds, additionally include the debug-keystore SHA-256** (different fingerprint) so testers can verify deep-links.

### 4.6 Expo / React Native config

**File:** `apps/mobile/app.json`

```json
{
  "expo": {
    "scheme": "smartout",
    "ios": {
      "bundleIdentifier": "ai.smartout.mobile",
      "associatedDomains": ["applinks:app.smartout.ai"]
    },
    "android": {
      "package": "ai.smartout.mobile",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "https", "host": "app.smartout.ai", "pathPrefix": "/invite" },
            { "scheme": "https", "host": "app.smartout.ai", "pathPrefix": "/m/" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

Both lists currently declare `app.smartout.ai` and the `/invite` path. **P2 adds the `/m/` path-prefix and Universal-Link path components.**

### 4.7 supabase/config.toml (local dev only)

Already wired:

```toml
[auth]
site_url = "http://localhost:3060"          # ← match apps/web dev port
additional_redirect_urls = [
  "http://localhost:3060/**",
  "http://localhost:3070/**"
]
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
skip_nonce_check = true   # ← local only, never in prod
```

**Local dev does NOT exercise the portal-redirect (proxy.ts §5a skips when `NEXT_PUBLIC_ROOT_DOMAIN=localhost`).** Per-host testing of the redirect requires `*.localhost` host entries OR a staging deploy.

---

## 5. Web Bridge Routes (mobile P2)

Universal Links require the target URL to be valid HTML/HTTP. A web bridge serves three roles:

1. **Deep-link launcher.** If app is installed, the OS intercepts the URL and opens the app — bridge HTML never renders. If app is NOT installed, the bridge renders.
2. **Graceful fallback.** Bridge HTML shows "Open in Smartout app" CTA + App Store / Play Store buttons + (for non-OAuth flows) a "Continue in browser" link that resumes the auth flow on the portal.
3. **Hash-fragment relay.** Supabase password-recovery / email-confirm URLs use `#hash` fragments which cannot be read server-side. Bridge runs client-side JS to re-emit the hash into `smartout://...` (when app installed via universal-link intent) OR into the portal `/update-password` flow (when not).

### 5.1 Route catalog

| Path | Purpose | Backed by |
|---|---|---|
| `/m/auth/callback` | OAuth post-exchange landing (mobile redirectTo target) | Server-side: validates `code` query, JS deep-link relay if app intent fails |
| `/m/invite/callback` | Invite-Google post-exchange | Same as above + invitation token forwarding |
| `/m/update-password` | Password recovery landing | Client-only: reads `#access_token` hash, relays |
| `/m/confirm-email` | Email confirmation landing | Same as `/m/update-password` |
| `/m/invite/<token>` | Invitation accept entry (when QR scanned) | Server-side render of invite context, JS deep-link attempt |

### 5.2 Implementation pattern (canonical)

```tsx
// apps/web/src/app/m/auth/callback/page.tsx (sketch)
"use client";
import { useEffect } from "react";

export default function MobileAuthCallbackBridge() {
  useEffect(() => {
    // Universal Link should have opened the app already. If we're rendering
    // this React tree, the app wasn't installed OR the URL was opened in a
    // regular browser tab. Build the scheme-link from the current URL and
    // attempt to launch the app. If nothing happens, the user sees the
    // fallback UI below.
    const url = new URL(window.location.href);
    const schemeUrl = `smartout://auth/callback${url.search}${url.hash}`;
    window.location.replace(schemeUrl);
    // ~1.5s timeout: if still here, app not installed
  }, []);
  return (
    <main>
      <h1>Åpne Smartout-appen</h1>
      <p>Hvis appen ikke åpnet seg automatisk:</p>
      <a href={appStoreUrl}>Last ned for iOS</a>
      <a href={playStoreUrl}>Last ned for Android</a>
    </main>
  );
}
```

**Security note:** the bridge does NOT call `exchangeCodeForSession` server-side — that's the app's job (PKCE verifier lives in SecureStore, not on the web). The bridge only relays the URL.

---

## 6. Open-Redirect Surface and Guards

Every redirect that takes a user-controllable target is a potential open-redirect. Smartout has five such surfaces and the corresponding guards.

| # | Surface | User-controlled input | Guard |
|---|---|---|---|
| 1 | `proxy.ts:5a` workspace→portal | `pathname` (request URL) | Allowed-set check (`AUTH_ROUTES_REDIRECT_TO_PORTAL`); only portal target allowed |
| 2 | `callback/route.ts` `continue` | `?continue=<slug>` | `SLUG_PATTERN` regex (lowercase + digits + hyphen, 1–63 chars) + `profile` row exists for `user_id` in `workspace.workspace_id WHERE slug = continue` |
| 3 | `callback/route.ts` `next` | `?next=<path>` | `next.startsWith("/")` else fallback `/dashboard` |
| 4 | `reset-password/page.tsx` `redirectTo` | None (hardcoded `${origin}/update-password`) | Origin always portal post-§5a redirect |
| 5 | `update-password/page.tsx` post-success | None (hardcoded `/select-workspace`) | Same |

**Anti-pattern (do NOT do):** accept `redirect_uri`, `return_to`, `next` as fully-qualified URLs. Always relative paths only; always validate target host against an allowlist.

**Bridge-route surface (P2):** `/m/*` bridge JS relays `window.location.search + hash` into `smartout://...`. Since the scheme URL is per-app and not network-routable, no host-validation needed — but content-sniff guard against `javascript:` injection IS needed in the JS (use `URL` constructor, reject if `protocol !== "https:" && protocol !== "http:"`).

---

## 7. Telemetry Catalog

All auth events live under the `auth` category in `packages/telemetry/src/registry.ts`. Required `actor_id` + `workspace_id` per ADR-0134 (mobile) — for unauth flows, use `nonEmpty("anonymous", "actor_id")` + `workspace_id: null`.

| Event | Producer | Fields |
|---|---|---|
| `auth otp_sent` | login/page, signup/page, verify.tsx, OtpVerificationForm resend | `data.context` ("login" \| "workspace_entry" \| "signup") |
| `auth otp_verified` | OtpVerificationForm.verifyCode, verify.tsx.verifyOtpWithCode | `data.attempts`, `data.duration_ms` |
| `auth otp_failed` | Same | `data.reason` ("max_attempts" \| "expired" \| "wrong_code") |
| `auth password_reset_requested` | reset-password/page | `data.email_hash` (SHA-256), `data.user_exists` |
| `auth password_reset_completed` | update-password/page | `data.user_id`, `data.context` ("migration" \| "self_service") |
| `signup completed` | api/auth/callback (post-exchange) | `data.user_identity_id` |
| `invitation opened` | invite/[token]/InviteTokenClient mount | `entity` + `data.invitation_id`, `workspace_id`, `token_preview` (first 8 chars) |
| `invitation accepted` | accept-invitation Edge Function | `data.invitation_id`, `data.profile_id`, `data.user_identity_id` |

**Email enumeration safety:** `password_reset_requested` and `otp_sent` MUST hash the email (SHA-256 normalized lowercase) — never log raw email. `reset-password/page.tsx:34-41` is the canonical implementation.

---

## 8. Test Surface

### 8.1 E2E (Playwright) — `apps/e2e/tests/auth-invitation/`

Existing suite (F1–F10) covers web auth flows. **P2 additions:**

| Spec | Tests |
|---|---|
| `F11-portal-redirect-workspace-subdomain.spec.ts` | Workspace `/login`, `/signup`, `/invite/<token>`, `/reset-password` → 307 to `app.smartout.ai/<path>?continue=<slug>` |
| `F12-callback-continue-validation.spec.ts` | Callback with `?continue=acme` when user has profile → workspace dashboard; without profile → portal `/dashboard`; malformed slug → ignored |
| `F13-universal-link-fallback-web.spec.ts` (mobile P2) | `/m/auth/callback` renders fallback HTML in browser context |

### 8.2 Unit — `packages/supabase/src/__tests__/` + `apps/web/src/lib/__tests__/`

| Module | Coverage |
|---|---|
| `subdomain.test.ts` | Extracts workspace slug, portal, reserved, root from host header (existing) |
| `subdomain.test.ts` (P2 addition) | Validates auth-route redirect path detection |

### 8.3 Manual smoke (post-deploy)

Documented in `infra/scripts/smoke-probe.sh` extensions OR as `docs/runbooks/AUTH_DEEPLINK_SMOKE.md`:

1. Open clean browser → `https://acme.smartout.ai/login` → assert 307 to `https://app.smartout.ai/login?continue=acme`.
2. Click "Continue with Google" → complete OAuth → assert landing on `https://acme.smartout.ai/dashboard`.
3. Open invite email link `https://app.smartout.ai/invite/<token>` → Google sign-in → assert acceptance.
4. Click "Forgot password" → enter email → check inbox → click link → set new password → assert redirect to workspace dashboard.
5. (Mobile P2) Scan QR with `https://app.smartout.ai/invite/<token>` → assert app opens (not browser).

---

## 9. Operator Runbook

### 9.1 Initial production setup checklist

- [ ] Supabase Cloud → URL Configuration: Site URL + Redirect URLs per §4.1
- [ ] Supabase Cloud → Providers → Google: Client ID + Secret from prod vault
- [ ] Supabase Cloud → SMTP: SendGrid wired
- [ ] Google Cloud → OAuth Client: Supabase callback URI authorized
- [ ] Vercel → smartout-web → Prod env: `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_SUPABASE_URL`, anon + service-role keys
- [ ] DNS: `app.smartout.ai` CNAME → `cname.vercel-dns.com`; `*.smartout.ai` wildcard → same
- [ ] (P2) `.well-known/apple-app-site-association` + `assetlinks.json` deployed
- [ ] (P2) Mobile app signed + universal-link verification passes (`xcrun assetutil dump --json` for iOS, `adb shell pm get-app-links ai.smartout.mobile` for Android)

### 9.2 Symptom → fix lookup table

| Symptom | Most-likely cause | First diagnostic |
|---|---|---|
| `/login?error=Invalid_link` after Google | PKCE verifier mismatch; usually missing `app.smartout.ai/**` in Supabase Cloud Redirect URLs OR pre-ADR-0374 build | Supabase Cloud → Auth → Logs filter `auth.url_redirect_to` |
| Reset email never arrives | SMTP not wired, rate-limited | Supabase Cloud → Auth → SMTP Settings; Logs filter `mail` |
| Session works on portal but not workspace subdomain | `NEXT_PUBLIC_ROOT_DOMAIN` missing → cookie host-scoped | `curl -I https://app.smartout.ai/<auth-needed-path>` inspect `Set-Cookie` header — should show `Domain=.smartout.ai` |
| Mobile invite opens browser instead of app | Universal Link not verified by OS | iOS: `adb shell pm get-app-links ai.smartout.mobile`; Android same; verify well-known file served with correct MIME |
| Google OAuth shows `redirect_uri_mismatch` | Google Cloud Console missing Supabase callback URI | Update Google Cloud Console |
| Workspace subdomain `/login` doesn't redirect to portal | `NEXT_PUBLIC_ROOT_DOMAIN` missing OR pathname not in `AUTH_ROUTES_REDIRECT_TO_PORTAL` | Check Vercel env + `proxy.ts:37-48` |

### 9.3 Drift detection

`infra/scripts/drift-check.sh` is the canonical 4-channel parity gate (env-template ↔ Vercel ↔ EF secrets ↔ droplet). It does NOT yet check:

- Supabase Cloud Site URL / Redirect URLs (Cloud Dashboard, no CLI surface)
- Google Cloud OAuth Client authorized redirect URIs
- Apple/Android well-known files served correctly

**P2 follow-up:** add a `auth-drift-check.sh` that probes the 3 external surfaces with simple HTTP GETs (well-known files) + Supabase admin API (URL config readback).

---

## 10. Open Questions / P2 Backlog

| # | Question | Decision deadline | Owner |
|---|---|---|---|
| 1 | When ships the mobile universal-link bridge (web routes + well-known files)? | Pre-mobile-public-launch | Pontus |
| 2 | Should bridge routes (`/m/*`) emit telemetry (`auth bridge_relayed`) for cross-device drop-off analytics? | Pre-bridge-merge | TBD |
| 3 | iOS/Android keystore SHA-256 fingerprints — where stored? 1Password? CI secret? | Pre-bridge-merge | Pontus |
| 4 | Apple Team ID — discoverable via `xcrun` or hardcoded in app.json? | Pre-bridge-merge | Pontus |
| 5 | E2E F11-F13 — when shipped? | Q3 2026 | TBD |
| 6 | Add `auth-drift-check.sh` to heartbeat? | Q3 2026 | TBD |
| 7 | Magic-link cross-device UX ("you clicked on desktop but signed in on phone") — explicit handling or accept user confusion? | Post-launch feedback | UX |

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Portal** | `app.smartout.ai` — the single auth surface |
| **Portal-redirect** | The 307 from a workspace subdomain to the portal for auth routes (proxy.ts §5a) |
| **PKCE** | Proof Key for Code Exchange. Supabase OAuth uses PKCE flow. Verifier cookie is host-scoped. |
| **Universal Link (iOS)** | An https:// URL that opens the native app on click (if installed) via Apple's `applinks:` mechanism |
| **App Link (Android)** | Android's equivalent of Universal Links, declared via intent-filter + `autoVerify=true` + `assetlinks.json` |
| **Scheme link** | A custom-protocol URL like `smartout://...`. Cannot be resolved by desktop browsers or email clients. Fallback only inside app context. |
| **Continue param** | `?continue=<slug>` query param preserved through the OAuth handshake to route the user back to their originating workspace dashboard |
| **Bridge route** | A `/m/*` web route that serves as both a Universal-Link landing target AND a graceful fallback when the app isn't installed |
| **Force-password-reset flag** | `user_metadata.force_password_reset === true` set by `strike-auth-bridge` for Bubble-migrated users. Middleware redirects them to `/update-password` until cleared. |

---

## 12. References

### ADRs

- [ADR-0021](../decisions/0021-subdomain-workspace-routing.md) — Subdomain workspace routing (amended 2026-04-20)
- [ADR-0075](../decisions/0075-knowledge-system-consolidation.md) — Knowledge system consolidation (ORIENTATION + Dashboard rules)
- [ADR-0132](../decisions/0132-mobile-ai-routing.md) — Mobile AI routing (thin-client BFF)
- [ADR-0133](../decisions/0133-web-composes-mobile-executes.md) — Mobile surface boundary
- [ADR-0134](../decisions/0134-mobile-telemetry-contract-enforcement.md) — Mobile telemetry contract
- [ADR-0167](../decisions/0167-invitation-tokens-as-credentials.md) — Invitation tokens as credentials
- [ADR-0168](../decisions/0168-magic-link-as-default-auth-method.md) — Magic-link default
- [ADR-0169](../decisions/0169-partial-unique-index-pending-invitation.md) — Partial unique index on pending invitations
- [ADR-0374](../decisions/0374-portal-auth-redirect-implementation.md) — Portal auth redirect implementation

### Specs

- `docs/superpowers/specs/2026-04-19-auth-invitation-holistic-design.md` — Holistic design (§11 mobile-parity, §12 middleware)
- `docs/superpowers/specs/2026-04-20-auth-invitation-implementation-plan.md` — P1 plan + Q1=b + Q22=b
- `docs/superpowers/specs/2026-04-22-auth-invitation-wave-h-amendment.md` — Wave H amendment

### Code anchors

- `apps/web/src/proxy.ts:23-56` — `AUTH_ROUTES_REDIRECT_TO_PORTAL` + `isAuthRouteForPortal`
- `apps/web/src/proxy.ts:342-364` — Workspace §5a portal-redirect
- `apps/web/src/app/api/auth/callback/route.ts:5-58` — `SLUG_PATTERN` + `resolveContinueDestination`
- `apps/web/src/app/login/page.tsx:209-238` — Google OAuth + OTP init
- `apps/web/src/components/auth/OtpVerificationForm.tsx` — 6-digit OTP UI
- `apps/web/src/app/reset-password/page.tsx:48-87` — Reset request
- `apps/web/src/app/update-password/page.tsx:32-136` — Set new password
- `apps/web/src/app/invite/[token]/invite-token-client.tsx` — Invite accept entry
- `apps/mobile/app/(auth)/verify.tsx` — All mobile auth surfaces
- `packages/supabase/src/client.ts:6-15` — Browser cookie-domain
- `packages/supabase/src/middleware.ts:6-15` — Middleware cookie-domain
- `supabase/functions/accept-invitation/index.ts` — Invitation acceptance Edge Function

### Sister docs

- [SMARTOUT_Subdomain_Routing_Architecture.md](./SMARTOUT_Subdomain_Routing_Architecture.md) — Host topology (this doc depends on §5 cookie-sharing rule)
- [secrets-protocol skill](../../.claude/skills/secrets-protocol/SKILL.md) — Where keys live
- [smartout-edge-function-guide skill](../../.claude/skills/smartout-edge-function-guide/SKILL.md) — Edge Function auth patterns

---

> **Maintenance:** Update this doc whenever you touch any of the code anchors in §12. Add a changelog entry to frontmatter on every edit. New auth surfaces (e.g. SSO with non-Google providers, SAML, passkeys) extend the Flows table in §3.
