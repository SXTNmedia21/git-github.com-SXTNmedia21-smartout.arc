---
title: "Handoff — mobile-auth-universal-link-bridge"
status: done
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [handoff, mobile, auth, universal-link, app-link, adr-0368]
---

# Handoff — mobile-auth-universal-link-bridge

> Branch: `feat/mobile-auth-universal-link-bridge` | Base: `development` | Sortie wt-4 | Closed: 2026-05-18

## Summary

Shipped P2 Phase 6 of the Auth & Invitation plan (deferred per Q22=b 2026-04-20). Mobile auth `redirectTo` targets are now Universal Links / App Links on `app.smartout.ai/m/<path>` instead of dead-on-desktop `smartout://` scheme URLs. Five web bridge routes render a graceful fallback (App Store CTAs + scheme-URL relay) when the app isn't installed. `apple-app-site-association` + `assetlinks.json` ship with PLACEHOLDER fingerprints per Pontus's pre-flight deferral — replace post-app-publish.

## What was built

### Web bridge (apps/web)

- `apps/web/src/app/m/_components/UniversalLinkBridge.tsx` — shared "use client" component. On mount: attempts `window.location.replace("smartout://<path>?search#hash")` then renders fallback HTML. Fires `auth bridge_relayed` telemetry with `surface` + `relay_attempted` payload. Reads App Store / Play Store URLs from `NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_PLAY_STORE_URL` env vars (default `#`).
- Five route pages under `apps/web/src/app/m/`:
  - `auth/callback/page.tsx` — OAuth post-exchange (mobile redirectTo target)
  - `invite/callback/page.tsx` — invite-OAuth post-exchange
  - `invite/[token]/page.tsx` — QR/share invitation URL
  - `update-password/page.tsx` — password recovery
  - `confirm-email/page.tsx` — email confirmation

### Well-known files (apps/web/public/.well-known/)

- `apple-app-site-association` (no extension) — iOS Associated Domains JSON. Declares `appIDs: ["PLACEHOLDER_TEAM_ID.ai.smartout.mobile"]` with components `/invite/*` + `/m/auth/callback`.
- `assetlinks.json` — Android App Link asset links. Two PLACEHOLDER SHA-256 fingerprints (release + debug).

### next.config.ts

Added `headers()` config setting explicit `Content-Type: application/json` + `Cache-Control: public, max-age=3600` for both `.well-known` paths. Apple rejects `apple-app-site-association` with `application/octet-stream` (Vercel's default for extensionless files).

### proxy.ts matcher

Excluded `.well-known/*` from middleware execution — discovery files must be served verbatim with exact MIME, no middleware mutation.

### Mobile (apps/mobile)

- `app.json` Android `intentFilters` extended with `pathPrefix: "/m/"` alongside existing `/invite`. iOS already covered by `applinks:app.smartout.ai`.
- `app/(auth)/verify.tsx` line 104, 178: redirectTo swapped from `smartout://auth/callback` to `https://app.smartout.ai/m/update-password` (reset) and `https://app.smartout.ai/m/auth/callback` (Google OAuth).
- `app/(auth)/m/auth/callback.tsx` NEW — native screen at Universal-Link path `/m/auth/callback`. Reads `code` query, calls `exchangeCodeForSession`, handles OAuth + recovery hash paths, routes to `(auth)/workspace-select` on success.

### Telemetry

- `packages/telemetry/src/registry.ts` adds `AuthBridgeRelayed` interface (line 352-371 after edits) + entry in `SmartoutEvent` union + entry in `EVENT_REGISTRY` with destinations `["posthog", "logger"]` and category `auth`.

## Decisions made

- **HTTPS-first, scheme-second.** All mobile redirectTo targets are HTTPS Universal Links. `smartout://` is now only a bridge-fallback relay, never in emails / QR / Supabase config. Closes the cross-device dead-link class.
- **Bridge does NOT exchange tokens.** PKCE verifier lives in app SecureStore — only the app can complete the exchange. Bridge only relays the URL.
- **Pre-flight items #1-3 deferred.** Per Pontus, app not yet published. PLACEHOLDER Team ID + SHA-256 + store URLs ship. Universal Link verification will fail until replaced — but the bridge fallback works regardless, so emails on mobile still degrade gracefully (open in browser → user can install app or proceed web-side).
- **Five bridge routes, three native screens (only one this sortie).** Native `(auth)/m/auth/callback.tsx` ships now (OAuth — the most common P2 flow). Native update-password + confirm-email + invite-callback are P3 — until then, those bridges always render the fallback (still functional, less polished).
- **`/m/invite/[token]` bridge relays to `smartout://invite/<token>`** — matches existing native invite screen at `app/(auth)/invite/[token].tsx`. Reuses existing handler; no new native file needed.
- **ADR-0368, not 0363+** — slots 0362-0367 + 0369 taken across branches per L-0147 outsider-renumber rule. Picked 0368 (free).

## Learnings

- **Apple's `apple-app-site-association` MIME requirement is non-negotiable.** Default Vercel serves extensionless files as `application/octet-stream` → Apple rejects. Explicit `headers()` config required. If overlooked, the file is published but no UL intercept fires and the failure is silent — only visible via `xcrun assetutil` or sustained reports of "app didn't open from email."
- **Middleware matcher must explicitly exclude `.well-known/*`.** The proxy.ts matcher regex is the only gate; adding the exclusion was a 1-line fix but caught only because of the canonical doc's audit table. Worth promoting to a future linter / pre-merge check.
- **Universal Link path declarations are exact matches, not wildcards.** Apple's `components` array maps each entry to a specific path or simple wildcard. Maintaining the list manually next to `apps/web/public/.well-known/` + the mobile native routes is duplication. P3 idea: derive both from a shared TypeScript manifest.
- **Bridge route Expo Router path collision.** First draft put native callback at `app/(auth)/callback.tsx` (URL `/callback`) — wrong; Universal Link routes to `/m/auth/callback`. Relocated to `app/(auth)/m/auth/callback.tsx`. Group folders are URL-invisible, so this matches the deep-link path correctly.

## Known issues / debt

- **PLACEHOLDER fingerprints in `.well-known/`.** Universal Link / App Link verification will fail until replaced. Documented in ADR-0368 Operator follow-up section + this handoff.
- **Three bridge routes are bridge-only** (no native screen): `/m/invite/callback`, `/m/update-password`, `/m/confirm-email`. Functional via fallback HTML, but mobile users land in browser for these flows. P3 follow-up: add native screens.
- **No E2E coverage** for bridge routes. Playwright intercepts `window.location.replace("smartout://...")` (scheme not supported). Unit-testing the bridge component is possible (vitest + jsdom mock), but lower priority than F11-F13 web tests already shipped.
- **No "Continue in browser" CTA on bridge fallback.** Desktop user clicking a mobile recovery link sees only "Install app" — needs a "Use web-version" link too. Small UX P3 polish.

## Next steps (operator + future sorties)

1. **Post-app-publish (operator):**
   - Replace `PLACEHOLDER_TEAM_ID` in `apps/web/public/.well-known/apple-app-site-association` with actual Apple Team ID (from Apple Developer Portal → Membership).
   - Replace both `PLACEHOLDER_*_SHA256_*` in `assetlinks.json` with release + debug keystore SHA-256 fingerprints (from Google Play Console → App Integrity).
   - Set `NEXT_PUBLIC_APP_STORE_URL` + `NEXT_PUBLIC_PLAY_STORE_URL` in Vercel prod env.
   - Verify with `curl -I https://app.smartout.ai/.well-known/apple-app-site-association` (must return `Content-Type: application/json`).
   - iOS: `xcrun assetutil dump` against installed app — confirm associated domain ENABLED.
   - Android: `adb shell pm get-app-links ai.smartout.mobile` — confirm `verified=true`.
2. **P3 sortie:** native screens for `/m/update-password`, `/m/confirm-email`, `/m/invite/callback`.
3. **P3 polish:** "Continue in browser" CTA on bridge fallback; shared manifest for UL path declarations.

## Acceptance verification

- [x] Plan written (`docs/plans/PLAN-mobile-auth-universal-link-bridge.md`)
- [x] Journey written
- [x] ADR-0368 written + registered in decision log
- [x] 5 web bridge routes + shared component
- [x] 2 `.well-known` files with PLACEHOLDER fingerprints
- [x] `next.config.ts` headers for .well-known MIME
- [x] proxy.ts matcher excludes .well-known
- [x] `apps/mobile/app.json` intentFilter extended
- [x] `verify.tsx` redirectTo swap (reset + Google)
- [x] Native `(auth)/m/auth/callback.tsx` screen
- [x] `auth bridge_relayed` telemetry event registered (registry interface + union + EVENT_REGISTRY destinations)
- [x] HANDOFF (this file)
- [ ] Typecheck — to be verified at close-feature

## Refs

- ADR-0368 (this sortie)
- ADR-0021 (subdomain-workspace-routing, amended 2026-04-20)
- ADR-0362 (portal-auth-redirect — web predecessor)
- ADR-0132 (mobile-ai-routing — thin client BFF)
- ADR-0133 (web-composes-mobile-executes — verb-table boundary)
- ADR-0134 (mobile-telemetry-contract — emit-site invariants)
- Spec: `docs/superpowers/specs/2026-05-18-mobile-auth-universal-link-bridge.md`
- Canonical: `docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md`
- Apple Universal Links: <https://developer.apple.com/documentation/xcode/supporting-associated-domains>
- Android App Links: <https://developer.android.com/training/app-links>
