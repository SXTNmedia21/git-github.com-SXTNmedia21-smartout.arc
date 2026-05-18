---
id: ADR-0368
title: "Mobile Auth Universal-Link Bridge"
status: accepted
date: 2026-05-18
deciders: pontus, claude
supersedes: []
superseded_by: []
relates_to: [ADR-0021, ADR-0132, ADR-0133, ADR-0134, ADR-0167, ADR-0362]
tags: [mobile, auth, oauth, pkce, universal-link, app-link, deep-link]
---

# ADR-0368 — Mobile Auth Universal-Link Bridge

## Status

Accepted (implementation P1 — placeholder fingerprints; production verification deferred until app published).

## Context

ADR-0362 fixed the web side of ADR-0021's portal doctrine: workspace subdomains redirect auth routes to `app.smartout.ai`. Mobile auth flows remained on a separate, broken path:

- `apps/mobile/app/(auth)/verify.tsx` used `redirectTo: "smartout://auth/callback"` for both Google OAuth and password reset.
- `smartout://...` scheme is NOT in any Supabase Cloud Redirect URLs whitelist — emails containing scheme URLs are dead on desktop browsers and rejected by Apple Mail.
- Password reset emails sent from mobile were unopenable on a different device (cross-device drop-off → user abandonment).
- iOS `associatedDomains: ["applinks:app.smartout.ai"]` was declared in `apps/mobile/app.json` but no `apple-app-site-association` file existed on the portal — the declaration was a no-op.

Per Council Q22=b 2026-04-20 (Auth & Invitation Implementation Plan), mobile auth screens were explicitly deferred to P2. This ADR + sortie execute Phase 6 of that plan.

## Decision

Establish a **Universal-Link Bridge** for all mobile auth redirectTo targets. The bridge is HTTPS-first, scheme-second:

1. Mobile `redirectTo` targets become `https://app.smartout.ai/m/<path>` (Universal Link / App Link).
2. When the app is installed, iOS Associated Domains / Android App Links intercept the URL BEFORE any web render — user lands inside the app at a matching native route (e.g. `app/(auth)/m/auth/callback.tsx`).
3. When the app is NOT installed (desktop, or mobile without app), the web bridge route under `apps/web/src/app/m/<path>/page.tsx` renders. The bridge:
   - Attempts a one-shot scheme-URL relay (`smartout://<path>?search&hash`) as a best-effort second try (covers cases where the OS missed the UL intent, e.g. user opened the link in an in-app webview).
   - Renders fallback HTML with App Store + Play Store CTAs.
   - Emits `auth bridge_relayed` telemetry for cross-device drop-off analytics.
4. The custom URL scheme `smartout://` is retained ONLY as in-app fallback. It MUST NOT appear in any Supabase `redirectTo`, email template, or QR code. Emails and QR codes carry HTTPS URLs only.

Five web bridge routes (`apps/web/src/app/m/`):

| Path | Bridge purpose | Mobile native target |
|---|---|---|
| `/m/auth/callback` | OAuth post-exchange | `app/(auth)/m/auth/callback.tsx` (this sortie) |
| `/m/invite/callback` | Invite-OAuth post-exchange | (P3 — bridge-only for now) |
| `/m/invite/<token>` | QR-scanned invite | (existing `app/(auth)/invite/[token].tsx` via scheme relay) |
| `/m/update-password` | Password recovery landing | (P3 — bridge-only for now) |
| `/m/confirm-email` | Email confirmation landing | (P3 — bridge-only for now) |

Two `.well-known` files declare the Universal Link / App Link associations:
- `apps/web/public/.well-known/apple-app-site-association` — iOS Associated Domains JSON, served via Next.js `headers()` config with `Content-Type: application/json`.
- `apps/web/public/.well-known/assetlinks.json` — Android App Links digital asset links.

`apps/mobile/app.json` Android `intentFilters` extended with `pathPrefix: "/m/"` (wildcard — Android handles all `/m/*` paths via the same VIEW intent). iOS `associatedDomains` already declared `applinks:app.smartout.ai` and is now validated by the served `apple-app-site-association` file.

PKCE code-verifier scope: with `signInWithOAuth` running inside the mobile app, supabase-js writes the verifier to Expo SecureStore via the mobile-storage-adapter. After the external-browser OAuth hop, the Universal Link routes the user back into the SAME app instance — SecureStore is read by `exchangeCodeForSession` in the native callback screen. No cookie scope concerns (mobile uses SecureStore, not cookies).

## Pre-flight items deferred

Per Pontus 2026-05-18 — app not yet published to App Store / Play Store. The following pre-flight items are SKIPPED in this sortie and tracked as P3 follow-up:

1. **Apple Team ID** — `apple-app-site-association` ships with `PLACEHOLDER_TEAM_ID.ai.smartout.mobile` appID. Real Team ID must replace before iOS Universal Link verification can succeed.
2. **Android keystore SHA-256** — `assetlinks.json` ships with `PLACEHOLDER_RELEASE_SHA256_FROM_PLAY_CONSOLE_APP_INTEGRITY` + `PLACEHOLDER_DEBUG_SHA256_FOR_TESTER_BUILDS`. Real fingerprints required before Android App Link `autoVerify=true` will succeed.
3. **App Store URL** + **Play Store URL** — bridge fallback CTAs read from `NEXT_PUBLIC_APP_STORE_URL` and `NEXT_PUBLIC_PLAY_STORE_URL` env vars (default `#`). Real URLs to be set in Vercel env after first store submission.

Graceful degradation: until the placeholders are replaced, Universal Link interception fails (OS cannot verify association) → ALL mobile clicks open the web bridge in a browser → bridge attempts the scheme-URL relay → if app present, opens app; if not, fallback HTML renders with broken store CTAs. The web flow remains functional as a fallback.

## Consequences

**Positive:**

- Supabase Cloud `Redirect URLs` whitelist stays minimal at `https://app.smartout.ai/**` — no `smartout://` scheme entries needed.
- Recovery + magic-link + OAuth emails work cross-device (open on desktop → web fallback; open on phone with app → native screen).
- Mobile auth ergonomics align with web doctrine: one URL works everywhere.
- Cross-device drop-off measurable via `auth bridge_relayed` telemetry.
- Adding new auth surfaces (passkeys, SAML, etc.) follows the same pattern.

**Negative / Risks:**

- Five web routes + two `.well-known` files + telemetry contract = surface area to maintain.
- Apple's `apple-app-site-association` parsing is strict — MIME, no extension, valid JSON. Bug here = silent failure (OS never verifies). Mitigated by Next.js `headers()` config + manual `curl -I` validation in operator runbook.
- Placeholder fingerprints in `.well-known/` files until app published — must be replaced atomically when keystore is generated, or `autoVerify=true` will permanently fail on Android.
- Two `m/*` web routes (`/m/update-password`, `/m/confirm-email`) currently bridge-only; no native screen. Mobile flow is functional via browser-fallback but loses the in-app polish until P3 native screens ship.

**Operator follow-up (post-app-publish):**

1. Get Apple Team ID → replace `PLACEHOLDER_TEAM_ID` in `apps/web/public/.well-known/apple-app-site-association`.
2. Get Android release keystore SHA-256 → replace `PLACEHOLDER_RELEASE_SHA256_FROM_PLAY_CONSOLE_APP_INTEGRITY` in `assetlinks.json`.
3. Set `NEXT_PUBLIC_APP_STORE_URL` + `NEXT_PUBLIC_PLAY_STORE_URL` in Vercel prod env.
4. Run iOS verification: `xcrun assetutil dump <ipa-or-app>` — confirm `applinks:app.smartout.ai` ENABLED.
5. Run Android verification: `adb shell pm get-app-links ai.smartout.mobile` — confirm `verified=true`.
6. Manual smoke: cold-installed app + click `https://app.smartout.ai/invite/<test-token>` from Mail — assert app opens at invite screen, no browser pit-stop.

## Alternatives Considered

- **Keep `smartout://` scheme on mobile redirectTo + add to Supabase Cloud whitelist.** Rejected — Supabase Cloud rejects non-HTTPS schemes per platform policy. Apple Mail / Gmail also strip unknown schemes from clickable URLs in some clients.
- **Single web bridge for all `/m/*` paths.** Rejected — different surfaces need different fallback messaging ("Open invitation" vs "Set new password"). Five focused routes with shared `UniversalLinkBridge` component beats one generic route.
- **Server-side `exchangeCodeForSession` in bridge.** Rejected explicitly — PKCE verifier is in app's SecureStore. Bridge does NOT touch tokens. Only the app completes the exchange.

## References

- ADR-0021 (subdomain-workspace-routing, amended 2026-04-20)
- ADR-0132 (mobile-ai-routing — thin client)
- ADR-0133 (web-composes-mobile-executes)
- ADR-0134 (mobile-telemetry-contract — `actor_id` + `workspace_id` invariants)
- ADR-0167 (invitation-tokens-as-credentials)
- ADR-0362 (portal-auth-redirect-implementation — predecessor on web)
- Spec: `docs/superpowers/specs/2026-05-18-mobile-auth-universal-link-bridge.md`
- Canonical: `docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md` §3, §4.4-4.5, §5
- Apple docs: <https://developer.apple.com/documentation/xcode/supporting-associated-domains>
- Android docs: <https://developer.android.com/training/app-links>
