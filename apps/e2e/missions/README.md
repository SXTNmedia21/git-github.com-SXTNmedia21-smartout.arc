---
title: Mission E2E Tests
status: in_progress
created: 2026-05-27
updated: 2026-05-27
module: e2e
tags: [missions, agent-ui, mobile-parity, adr-0133]
---

# Mission E2E Tests

End-to-end coverage for the five canonical Smartout agent missions registered in `packages/ai/src/missions/registry.ts`:

| Mission                | Surface Route                                    | ADR-0133 Class                |
| ---------------------- | ------------------------------------------------ | ----------------------------- |
| `onboarding-interview` | `/onboarding`, `/dashboard/onboarding-assistant` | Author (web-only)             |
| `landing-demo`         | landing app `/` (port 3056)                      | Marketing read (web + mobile) |
| `mr-botsson`           | `/dashboard` + most dashboard routes             | Mixed                         |
| `haccp-inspector`      | `/dashboard/hms*`                                | Mixed                         |
| `shift-assistant`      | `/dashboard/schedule*`, `/dashboard/my-schedule` | Mixed                         |

## File Convention

```
missions/
└── <mission-id>/
    ├── web-<verb>.spec.ts       # Runs only on `web` (Desktop Chrome) — author allowed
    ├── mobile-<verb>.spec.ts    # Runs on `web-iphone14` + `web-pixel7` — read/operator only
    └── README.md                # Per-mission journey notes
```

`web-*.spec.ts` may exercise C4-gated author verbs (D1–D5 authoring, governance, billing). `mobile-*.spec.ts` MUST stay within D6 production + C4 acceptance per ADR-0133 — no schedule editing, no governance authoring, no organization settings.

## Project Matrix (apps/e2e/playwright.config.ts)

| Project                 | baseURL              | testMatch                        | Runs                              |
| ----------------------- | -------------------- | -------------------------------- | --------------------------------- |
| `web`                   | webBaseUrl :3060     | (everything not landing/mobile)  | desktop chrome — all author flows |
| `web-iphone14`          | webBaseUrl :3060     | `missions/<id>/mobile-*.spec.ts` | iPhone 14 chromium                |
| `web-pixel7`            | webBaseUrl :3060     | `missions/<id>/mobile-*.spec.ts` | Pixel 7 chromium                  |
| `landing`               | landingBaseUrl :3056 | `landing.spec.ts`                | landing site only                 |
| `mobile` / `mobile-pwa` | mobileBaseUrl :8083  | `tests/mobile{,-pwa}/**`         | Expo PWA (separate from missions) |

## Required Assertions (per spec)

Every mission spec asserts:

1. **Locator hygiene** — `getByRole` or `getByTestId` only. No CSS chains.
2. **State sync** — Mission UI transition reflects Zustand/context state (e.g. `data-density` attribute on `BotssonShell`).
3. **Backend contract** — `page.route('**/api/.../chat', ...)` intercept; assert request payload + response shape.
4. **Contract→render parity** — Mocked response text appears verbatim in DOM.
5. **ADR-0133 boundary** — Mobile specs assert ZERO write-verb routes were hit.
6. **No skipping** — `test.skip` forbidden unless infrastructure prerequisite (DB, Supabase) is unreachable, AND the skip is reported as a blocker not a silent pass.

## Running

```bash
# Single mission, single viewport
pnpm --filter @smartout/e2e exec playwright test --project=web-iphone14 missions/mr-botsson/mobile-read.spec.ts

# All mission mobile specs across both mobile viewports
pnpm --filter @smartout/e2e exec playwright test --project=web-iphone14 --project=web-pixel7 missions/

# All author flows on desktop chrome
pnpm --filter @smartout/e2e exec playwright test --project=web missions/

# Trace Viewer for last failure
pnpm --filter @smartout/e2e exec playwright show-trace test-results/<test-name>/trace.zip
```

WSL2 OOM constraint (`workers=1`) means serial run only. Override with `E2E_WORKERS=2` if swap is configured (see `docs/protocols/WSL2-SWAP-CONFIG.md`).

## Secrets

Test credentials sourced via `op://` per `secrets-protocol`. `apps/e2e/helpers/auth.ts` reads `E2E_EMAIL` + `E2E_PASSWORD` from env; defaults are seeded local-only values. No raw production keys may appear in any spec or helper.

## Related

- `docs/decisions/0133-mobile-surface-boundary.md` — what mobile may/may not author
- `docs/decisions/0134-mobile-telemetry-contract.md` — actor_id + workspace_id resolution
- `docs/decisions/0238-domain-chat-ownership.md` — Orb passive mode rules
- `docs/decisions/0282-livekit-voice-routing.md` — voice transport (out of UI test scope)
- `.claude/reports/testing-analysis-2026-05-27.md` — current goal log
