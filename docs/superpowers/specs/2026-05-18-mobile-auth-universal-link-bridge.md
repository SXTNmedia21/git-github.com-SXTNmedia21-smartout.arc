---
title: "Sortie Spec — Mobile Auth Universal-Link Bridge"
id: SORTIE_MOBILE_AUTH_UL_BRIDGE
status: proposed
layer: spec
created: 2026-05-18
updated: 2026-05-18
sortie: feat/mobile-auth-universal-link-bridge
phase: P2 (Phase 6 of auth-invitation P1 — was deferred per Q22=b)
estimated_complexity: medium
related_adrs:
  - ADR-0021
  - ADR-0132
  - ADR-0133
  - ADR-0134
  - ADR-0167
  - ADR-0362
related_docs:
  - SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md (canonical, §3.1, §3.4, §4.4, §4.5, §5, §6)
  - SMARTOUT_Subdomain_Routing_Architecture.md (cookie-domain rule §5)
tags: [mobile, auth, oauth, universal-link, deep-link, pkce, expo, ios, android]
---

# Sortie Spec — Mobile Auth Universal-Link Bridge

> **Sortie type:** Sortie (from main `development`)
> **Worktree:** `~/dev/smartout.ai-wt-<N>` (next free slot)
> **Branch:** `feat/mobile-auth-universal-link-bridge`
> **Estimated:** 6–10 hours implementation + ops setup
> **Owner:** Pontus (operator config) + Claude (code)
> **Trust gate:** Universal Link verified by both iOS and Android via OS-level association probes

---

## 1. Goal (one sentence)

Replace mobile `smartout://` redirectTo targets with `https://app.smartout.ai/m/...` Universal Links so that OAuth + magic-link + reset-password + invitation flows work identically on mobile, desktop browsers, and email clients — while keeping the existing scheme URL as in-app fallback only.

## 2. Why now

- ADR-0362 just landed (2026-05-18) closing the web side of the auth-host doctrine. Mobile remains the only surface that still uses host-specific scheme URLs in `redirectTo`.
- Recovery and OTP emails on mobile contain `smartout://` URLs that are dead links when the email is opened on desktop — silent failure for end-users who switch devices.
- Q22=b 2026-04-20 deferred 4 mobile auth screens to P2. P1 closed 2026-05-02. This sortie executes P2 Phase 6.
- iOS `associatedDomains: ["applinks:app.smartout.ai"]` is already declared in `apps/mobile/app.json:25` but no Universal Link target exists on the web side — declaration is currently a no-op.

## 3. Non-goals

- New auth providers (Apple, Facebook, passkeys) — out of scope.
- SSO (SAML, OIDC) — out of scope.
- Mobile authoring flows (D1–D5) — explicitly forbidden by ADR-0133.
- E2E test infrastructure changes — handled by sibling sortie `feat/e2e-portal-redirect-tests`.

## 4. Acceptance criteria

The sortie is done when ALL of the following are true:

- [ ] Mobile `verify.tsx` `resetPasswordForEmail` redirectTo = `https://app.smartout.ai/m/update-password` (not `smartout://`).
- [ ] Mobile `verify.tsx` Google `signInWithOAuth` redirectTo = `https://app.smartout.ai/m/auth/callback`.
- [ ] Mobile invitation accept flow's OAuth uses `https://app.smartout.ai/m/invite/callback?token=<token>`.
- [ ] 5 web bridge routes exist under `apps/web/src/app/m/`: `auth/callback/page.tsx`, `invite/callback/page.tsx`, `invite/[token]/page.tsx`, `update-password/page.tsx`, `confirm-email/page.tsx`.
- [ ] Each bridge attempts a deep-link relay to the corresponding `smartout://` URL on mount AND renders a "Open in app" fallback UI within 2 seconds.
- [ ] `apps/web/public/.well-known/apple-app-site-association` served at `https://app.smartout.ai/.well-known/apple-app-site-association` with `Content-Type: application/json` and HTTP 200.
- [ ] `apps/web/public/.well-known/assetlinks.json` served same.
- [ ] `apps/mobile/app.json` Android intentFilters extended with `pathPrefix: "/m/"`.
- [ ] Apple Team ID + Android SHA-256 fingerprints stored in 1Password (`smartout_ai_prod`).
- [ ] iOS verification: `xcrun assetutil dump <ipa-or-app>` shows `applinks:app.smartout.ai` ENABLED.
- [ ] Android verification: `adb shell pm get-app-links ai.smartout.mobile` shows `verified=true` for `app.smartout.ai`.
- [ ] Universal Link smoke: cold-installed app + click `https://app.smartout.ai/invite/<test-token>` from Mail → app opens to invite screen (no browser pit-stop).
- [ ] Non-installed device: same URL → bridge HTML renders with App Store + Play Store CTAs.
- [ ] Reset-password email arrives on phone, clicked link opens app (not Safari/Chrome).
- [ ] ADR proposed for canonical Universal Link bridge pattern (extends ADR-0021 mobile section).
- [ ] Decision log row registered.
- [ ] Journey written.
- [ ] HANDOFF written.
- [ ] Typecheck + lint pass.

## 5. Architecture (summary — see canonical doc §3.1, §5 for full)

```
                  ┌──────────────────────────┐
                  │  Email/QR/in-app link    │
                  │  https://app.smartout.ai │
                  │      /m/auth/callback    │
                  └────────────┬─────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                     │
       App installed                         App NOT installed
       (Universal Link                       (Web fallback)
        intercepts URL)                       │
            │                                  │
            ▼                                  ▼
  ┌────────────────────┐         ┌─────────────────────────┐
  │ Mobile app native  │         │ apps/web/src/app/m/...  │
  │ /(auth)/callback   │         │ JS: window.location.    │
  │ exchangeCode...    │         │  replace("smartout://") │
  │ session → store    │         │ Fallback UI (App Store) │
  └────────────────────┘         └─────────────────────────┘
```

## 6. Pre-flight (operator)

Pontus must obtain BEFORE sortie starts:

1. **Apple Team ID** — Apple Developer Portal → Membership → Team ID (10-char prefix like `ABC1234XYZ`). Save to `op://smartout_ai_prod/Apple-Developer/team_id`.
2. **Android release keystore SHA-256** — `keytool -list -v -keystore <release.jks>` from Google Play Console → Setup → App Integrity → "App signing key certificate" → SHA-256. Save to `op://smartout_ai_prod/Android-Keystore/sha256_fingerprint`.
3. **Android debug keystore SHA-256** (for tester builds) — `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey`. Save to `op://smartout_ai_prod/Android-Keystore/sha256_debug_fingerprint`.
4. **App Store URL** + **Play Store URL** (or placeholders for unreleased apps) — save to `op://smartout_ai_prod/SmartOut/app_store_url` and `play_store_url`.

If any of #1–#3 unavailable (app not yet published), sortie ships with placeholder fingerprints + JIRA-style follow-up issue for keystore-cert later.

## 7. Tasks

### T1 — Bridge web routes (apps/web)

Create 5 files under `apps/web/src/app/m/`:

```
m/
  auth/callback/page.tsx       ← OAuth post-exchange landing
  invite/
    callback/page.tsx          ← Invite-OAuth post-exchange
    [token]/page.tsx           ← QR / direct invite landing
  update-password/page.tsx     ← Reset-link landing
  confirm-email/page.tsx       ← Email-confirm landing
```

Each follows the canonical pattern (canonical doc §5.2): client-component, on mount attempts `window.location.replace(\`smartout://...\`)` rebuilding the URL preserving search + hash, then renders fallback after 1.5s. Bridge does NOT call `exchangeCodeForSession` — that's the app's job (PKCE verifier lives in SecureStore).

**Telemetry:** emit `auth bridge_relayed` with `data.surface` ("oauth_callback" \| "invite_callback" \| "update_password" \| "confirm_email" \| "invite_token") to track cross-device drop-off rates. (Open question #2 in canonical doc — recommend YES per this spec.)

### T2 — `.well-known` files (apps/web/public)

```
apps/web/public/.well-known/
  apple-app-site-association   ← NO extension, served as application/json
  assetlinks.json
```

Both content per canonical doc §4.4 + §4.5. Values for `<TEAM_ID>` + `<SHA256>` injected from env vars OR committed as known-prod values (decision in pre-flight).

**Trap:** Vercel `next.config.js` may rewrite `.well-known/*` URLs. Verify with `curl -I https://<preview-deploy>.vercel.app/.well-known/apple-app-site-association` BEFORE merging. Adjust `apps/web/next.config.ts` `rewrites()` to exclude `/.well-known/*` if needed.

### T3 — Mobile config (apps/mobile/app.json)

Extend Android `intentFilters` with `/m/` path-prefix:

```json
{
  "scheme": "https",
  "host": "app.smartout.ai",
  "pathPrefix": "/m/"
}
```

iOS already covered by wildcard `applinks:app.smartout.ai`.

### T4 — Mobile auth surface updates (apps/mobile/app/(auth)/verify.tsx)

Replace 2 redirectTo strings:
- Line 106 `resetPasswordForEmail`: `smartout://auth/callback` → `https://app.smartout.ai/m/update-password`
- Line 178 `signInWithOAuth` Google: `smartout://auth/callback` → `https://app.smartout.ai/m/auth/callback`

Add a new native screen `apps/mobile/app/(auth)/callback.tsx` (Expo Router file-based route) that:
- Reads `code` from URL params (when Universal Link opens the app at `/m/auth/callback`, Expo Router parses path)
- Calls `supabase.auth.exchangeCodeForSession(code)` — same client instance as `signInWithOAuth` was called from
- On success: navigate to `(auth)/workspace-select`
- On failure: show error + back to `(auth)/welcome`

### T5 — Invitation deep-link (apps/mobile/app/(auth)/invite/[token].tsx — NEW)

Mirror the web invite-token-client. Reads token from path → `track_invitation_opened` RPC → renders invite context → "Logg inn med Google" CTA calls `signInWithOAuth({redirectTo: "https://app.smartout.ai/m/invite/callback?token=<token>"})`.

### T6 — Telemetry registry

Register new event `auth bridge_relayed` in `packages/telemetry/src/registry.ts` per ADR-0134 + L-0083 (every registered event must have grep-verifiable emit site before merge).

Properties:
```ts
{
  data: {
    surface: "oauth_callback" | "invite_callback" | "update_password" | "confirm_email" | "invite_token";
    has_app_intent: boolean; // true if the OS likely consumed the URL pre-render (currently always false from render-time POV)
  }
}
```

### T7 — Vercel `next.config.ts` audit

Verify `.well-known/*` not rewritten or intercepted. If any rewrite rule applies, add explicit pass-through OR move `.well-known/` to a public-route bypass in `proxy.ts`.

### T8 — ADR

Draft ADR-0363 `mobile-auth-universal-link-bridge` covering:
- Universal Link as the canonical mobile redirectTo target (extends ADR-0362 + ADR-0021)
- Bridge route pattern (web fallback)
- Scheme URL `smartout://` retained as in-app fallback only (NOT for OAuth redirectTo, NOT in emails)
- .well-known file serving + MIME requirements
- Pre-flight operator data (Team ID, SHA-256)

### T9 — Journey + HANDOFF

`docs/journeys/JOURNEY-mobile-auth-universal-link-bridge.md` covering 3 journeys:
1. Invitee on phone — open email link → app launches → invite accepted (no browser)
2. Invitee on desktop — open email link → bridge renders → "Continue in browser" → portal `/invite/<token>` works
3. Existing mobile user — Google OAuth → app callback → workspace

### T10 — Smoke + close

Manual smoke per acceptance criteria + `close-feature.sh`.

## 8. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Vercel rewrites strip `.well-known/*` | T7 audits, fixes upfront; verify in preview deploy before main merge |
| Universal Link verification fails on Android (autoVerify=true requires assetlinks.json valid + reachable) | T2 + T3; run `adb shell pm verify-app-links --re-verify ai.smartout.mobile` after install |
| App opens browser instead of app on iOS — common cause is associated-domains not propagated until app reinstalled | Reinstall after building; verify via `xcrun simctl openurl booted https://app.smartout.ai/m/auth/callback?code=test` |
| PKCE verifier lost when Universal Link cold-opens app | supabase-js uses SecureStore via storage adapter — verifier persists across cold-launch. Verify with a forced cold-launch test (force-quit app, then click email link). |
| `code` query param URL-encoded inconsistently between iOS/Android intent handling | Bridge route also runs `decodeURIComponent` defensively; mobile reads via `useLocalSearchParams` which handles decoding |
| Apple Team ID or SHA-256 wrong → silent universal-link failure | Pre-flight checklist in §6 — block sortie start until obtained |

## 9. Open questions

1. Should `auth bridge_relayed` distinguish between "app present + URL intercepted" vs "fallback rendered"? Currently can only emit from fallback path. Resolution: ship single-event variant; iterate if drop-off analytics need finer split.
2. Should `/m/invite/<token>` page on the bridge also call `track_invitation_opened` RPC, OR defer to the app? Resolution: bridge does NOT call (avoids double-count when app handles); web `/invite/<token>` still does for desktop flow.
3. Email templates currently use `{{ .SiteURL }}/path` — already maps to portal. Do magic-link emails need a separate mobile-targeted template? Resolution: NO — Universal Link makes one URL work both surfaces.

## 10. References

- Canonical: `docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md` §3, §4.4, §4.5, §5, §6
- ADR-0362 (web portal-redirect — the predecessor)
- ADR-0021 amendment 2026-04-20
- Auth & Invitation Council `docs/superpowers/specs/2026-04-20-auth-invitation-implementation-plan.md` Q22=b
- Holistic design `docs/superpowers/specs/2026-04-19-auth-invitation-holistic-design.md` §11.3, §11.4
- Mobile config: `apps/mobile/app.json:25-50`
- Mobile auth surface: `apps/mobile/app/(auth)/verify.tsx`
