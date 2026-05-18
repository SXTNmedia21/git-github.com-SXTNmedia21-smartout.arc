---
title: "Plan — mobile-auth-universal-link-bridge"
status: done
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [plan, mobile, auth, universal-link, app-link, adr-0368]
---

# Plan — mobile-auth-universal-link-bridge

> Branch: `feat/mobile-auth-universal-link-bridge` | Worktree: /home/sxtnl/dev/smartout.ai-wt-4 | Base: `development` | Module: auth | Started: 2026-05-18

**Spec:** [2026-05-18-mobile-auth-universal-link-bridge.md](../../superpowers/specs/2026-05-18-mobile-auth-universal-link-bridge.md)

## Goal

Replace mobile `smartout://` redirectTo targets with `https://app.smartout.ai/m/*` Universal Links / App Links so OAuth + magic-link + reset-password + invitation flows work identically on phone, desktop, and email clients. Web bridge routes provide graceful fallback when app not installed.

## What landed

- **5 web bridge routes** under `apps/web/src/app/m/`: `auth/callback`, `invite/callback`, `invite/[token]`, `update-password`, `confirm-email`. Shared `UniversalLinkBridge` component attempts `smartout://...` relay then renders App Store / Play Store fallback. Emits `auth bridge_relayed` telemetry.
- **2 `.well-known` files** at `apps/web/public/.well-known/`: `apple-app-site-association` (extensionless, application/json via next.config headers) + `assetlinks.json`. Ship with PLACEHOLDER Team ID + SHA-256 fingerprints per Pontus's pre-flight deferral.
- **next.config.ts**: explicit `headers()` for both `.well-known` paths setting Content-Type + Cache-Control.
- **proxy.ts matcher**: excluded `.well-known` from middleware.
- **apps/mobile/app.json**: Android `intentFilters` extended with `pathPrefix: "/m/"`. iOS already covered by existing `applinks:app.smartout.ai`.
- **apps/mobile/app/(auth)/verify.tsx**: 2 redirectTo swaps (smartout:// → https://app.smartout.ai/m/...) for reset + Google OAuth.
- **apps/mobile/app/(auth)/m/auth/callback.tsx** NEW: native screen for OAuth post-exchange. Reads code, calls `exchangeCodeForSession`, handles recovery hash, routes to workspace-select.
- **packages/telemetry/src/registry.ts**: `AuthBridgeRelayed` interface + `SmartoutEvent` union entry + `EVENT_REGISTRY` destinations entry.
- **ADR-0368** + decision-log row + journey + this plan + handoff.

## Verification

- Manual review of all 5 bridge routes + native screen
- next.config.ts headers explicitly verified for `application/json` MIME on `apple-app-site-association`
- proxy.ts matcher regex extended (no regression to other paths)
- mobile redirectTo strings verified swapped — no remaining `smartout://auth/callback` in verify.tsx
- Typecheck: deferred to close-feature.sh Gate 4

## Pre-flight items deferred (operator post-app-publish)

Per Pontus 2026-05-18:

1. Apple Team ID — replace `PLACEHOLDER_TEAM_ID` in `apple-app-site-association`
2. Android release + debug keystore SHA-256 — replace both `PLACEHOLDER_*_SHA256_*` in `assetlinks.json`
3. App Store + Play Store URLs — set `NEXT_PUBLIC_APP_STORE_URL` + `NEXT_PUBLIC_PLAY_STORE_URL` in Vercel prod env

Until replaced, OS-level Universal Link / App Link verification fails — fallback path always renders (graceful degradation).

## Acceptance Criteria

- [x] 5 web bridge routes + shared component
- [x] 2 `.well-known` files (PLACEHOLDER fingerprints)
- [x] next.config.ts MIME headers
- [x] proxy.ts matcher excludes .well-known
- [x] apps/mobile/app.json Android intentFilters extended
- [x] verify.tsx redirectTo swap
- [x] Native (auth)/m/auth/callback.tsx
- [x] auth bridge_relayed telemetry registered
- [x] ADR-0368 + decision-log row
- [x] Journey written
- [x] HANDOFF written
- [ ] Typecheck passes (close-feature Gate 4)

## Out-of-scope (P3 follow-up)

- Native screens for `/m/update-password`, `/m/confirm-email`, `/m/invite/callback`
- "Continue in browser" CTA on bridge fallback
- iOS/Android UL verification with real fingerprints (operator task post-publish)
- E2E coverage for bridge routes (Playwright cannot test `smartout://` relay)
- Shared manifest for UL path declarations
