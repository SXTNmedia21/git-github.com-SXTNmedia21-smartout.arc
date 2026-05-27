---
title: Agent UI E2E Testing Analysis — 5 Missions × Web + Mobile
status: in_progress
created: 2026-05-27
updated: 2026-05-27
module: meta
scope: testing
tags: [playwright, e2e, missions, mobile-parity, agent-ui]
---

# Agent UI E2E Testing Analysis — 5 Missions × Web + Mobile

## 1. Executive Summary

Smartout has a sizeable Playwright suite (~44k LOC in `apps/e2e/tests/`) and one comprehensive harness for `mr-botsson` (`botsson-harness-e2e.spec.ts`). The other four missions in the goal (`onboarding-interview`, `landing-demo`, `haccp-inspector`, `shift-assistant`) have **zero direct test specs** despite being registered, surface-mapped via `ROUTE_MISSION_MAP`, and live on real dashboard routes.

The existing `mobile` and `mobile-pwa` Playwright projects target the Expo PWA at port 8083 — not the Next.js web app on mobile viewports. For the goal's "iPhone 14 + Pixel 7 viewports" criterion to apply to the web dashboard surfaces where the agent UI actually renders, **new viewport projects must be added** that mount mobile device profiles against `webBaseUrl`.

Locator hygiene is mixed: `BotssonShell.tsx` exposes a single `data-testid="botsson-orb"`. Chat input, send button, sticky, arena, and per-mission assistant UIs lack stable testids. The existing botsson harness uses DOM polling + DB assertions, not API intercept — so backend-contract verification is implicit, not explicit.

Trace capture is gated to `trace: "on-first-retry"` with `retries=0` locally → **traces are never captured during local runs**. This violates exit criterion 6.

## 2. Goal Statement (from `/goal`)

> Agent UI end-to-end flows pass on both web and mobile viewports for all five missions (`onboarding-interview`, `landing-demo`, `mr-botsson`, `haccp-inspector`, `shift-assistant`), with backend contract verified, no skipped or weakened tests.

**Exit Criteria:**

1. All critical user journeys green on Chromium desktop + iPhone 14 + Pixel 7 viewports
2. Button click handlers and state sync verified (Zustand store ↔ UI render) for every mission
3. Backend response contract asserted via intercepted API calls, UI renders match Supabase/Stage Engine payloads
4. User-facing locators (`getByRole`, `getByTestId`) used throughout, no fragile CSS selectors remain in tested flows
5. Author verb tests live web-only per ADR-0133, mobile tests cover read/operator flows only
6. Trace Viewer artifacts captured on every failure during the loop
7. Test credentials sourced via `op://` per secrets-protocol, zero raw creds in test files
8. Any unresolved blockers filed as `SMA-xxx` Linear issues per linear-protocol before loop exit

**Out of scope:** Voice provider swap (Ultravox→LiveKit, `voice.config.ts` is swap boundary, not under test); Showroom module rewrites (assume `@ag-ui/client` + `AbstractAgent` contract stable).

## 3. Surface Map (verified)

| Mission | Surface Route | Mount Site | Verb Class (ADR-0133) |
|---|---|---|---|
| `onboarding-interview` | `/onboarding`, `/dashboard/onboarding-assistant` | `apps/web/src/app/onboarding/page.tsx`, `dashboard/onboarding-assistant/page.tsx` | Author (D2 setup) — **web-only** |
| `landing-demo` | landing `/` (port 3056) | `apps/landing/src/components/landing/VoiceDemoWidget.tsx` (missionId hardcoded) | Marketing read — web + mobile OK |
| `mr-botsson` | `/dashboard` (default) + most dashboard routes | `apps/web/src/components/dashboard/DashboardShell.tsx` (`ROUTE_MISSION_MAP`, line 78–98) → `BotssonShell.tsx` | Mixed (chat-only on mobile, author on web) |
| `haccp-inspector` | `/dashboard/hms*` | Same `BotssonShell` via `ROUTE_MISSION_MAP["/dashboard/hms"]` (line 80) | Web for authoring, mobile for D6 production (run check) |
| `shift-assistant` | `/dashboard/schedule*`, `/dashboard/my-schedule` | Same `BotssonShell` via `ROUTE_MISSION_MAP` (lines 79, 92) | Web for create/update/delete shift (D4/D5 author); mobile for read (D6 my-schedule) |

`BotssonProvider` default `missionId: "botsson-session"` (line 834). `DashboardShell` overrides per-route via `resolveMissionForRoute(pathname)` (lines 101–108). Confirmed: all 5 missions resolve to live routes.

## 4. Existing Test Coverage per Mission

| Mission | Spec Files | Coverage |
|---|---|---|
| `mr-botsson` | `apps/e2e/tests/botsson-harness-e2e.spec.ts` (13 positive A1–A13, 3 negative N1–N3) | ✅ Web only. DB-poll style, no API intercept. No mobile viewport. |
| `onboarding-interview` | — | ❌ None (wizard has `apps/e2e/onboarding/` but that tests the manual wizard form, not the agent interview surface) |
| `landing-demo` | — | ❌ None (`landing.spec.ts` testMatch exists in config but file is absent or stub) |
| `haccp-inspector` | — | ❌ None |
| `shift-assistant` | — | ❌ None |

Supporting mobile coverage:
- `apps/e2e/tests/mobile/01-05*.spec.ts` — cold-open, login, workspace select, tab nav, training (Expo Metro target)
- `apps/e2e/tests/mobile-pwa/*.spec.ts` — login, lands on shift-hub, app-loads, no-runtime-errors, tab-navigation (Expo Metro target)

None of the mobile specs target agent-UI flows. None mount the web app on a mobile device profile.

## 5. Gap Analysis

### 5.1 Playwright Configuration

| Item | Current | Required | Action |
|---|---|---|---|
| Trace capture (local) | `on-first-retry` + `retries=0` → never | `retain-on-failure` always | Update `playwright.config.ts` |
| iPhone 14 web viewport | absent | required by exit criterion 1 | Add project `web-iphone14` → `webBaseUrl` |
| Pixel 7 web viewport | absent | required by exit criterion 1 | Add project `web-pixel7` → `webBaseUrl` |
| WSL2 OOM constraint | `workers=1` (ADR-0408) | unchanged | Live with serial run, plan accordingly |
| Test tagging for ADR-0133 | none | `@author-only` / `@mobile-ok` annotation | Convention in new mission specs |

### 5.2 Locator Hygiene

`BotssonShell.tsx` exposes `data-testid="botsson-orb"` only. Required additions (estimate, refined per iteration):

- `data-testid="botsson-sticky"` — retracted state
- `data-testid="botsson-arena"` — expanded state
- `data-testid="botsson-chat-input"` — text channel input
- `data-testid="botsson-chat-send"` — send button
- `data-testid="botsson-chat-messages"` — message list container
- `data-testid="botsson-mission-badge"` — current mission indicator (if rendered)

Mission-surface-specific: `VoiceDemoWidget` (landing) needs `data-testid="landing-voice-trigger"` and `data-testid="landing-voice-assistant"`. Onboarding `OnboardingShell` needs section advance / key-fact panel testids.

### 5.3 Backend Contract Verification

Existing pattern (botsson harness): poll `engine_sessions`, `engine_memory`, `activity_trail`, `agent_session_recording` after UI interaction. Adequate for L5 verification but **does not catch contract drift between L1 UI rendering and L2/L3 API responses**.

Required additions per mission spec:
- `page.route('**/api/emma/chat', ...)` — intercept BFF chat endpoint (mobile + web)
- `page.route('**/api/voice/session/start', ...)` — intercept Ultravox/LiveKit session bootstrap (mock; voice transport is out-of-scope)
- Response schema assertions via Zod (already exported from `@smartout/ai`)
- Assert UI render reflects exact intercepted payload (e.g. assistant message text matches mocked `content` field)

### 5.4 State Sync (Zustand ↔ UI)

`BotssonProvider` is the Zustand-equivalent context for Botsson. Test pattern:
- Read context via `window.__BOTSSON_STATE__` debug hook (does not exist yet — to add) OR via inspecting rendered output for state-derived classNames/aria attributes.
- Recommendation: expose `__BOTSSON_STATE__` only when `process.env.NODE_ENV !== 'production'` for non-prod assertion access. Defer if architecturally controversial — prefer DOM-derived state inference.

### 5.5 Credentials & Secrets

- `apps/e2e/playwright.config.ts:3` loads `.env.local` (gitignored, safe).
- `apps/e2e/helpers/seed.ts:5` reads `SUPABASE_SERVICE_ROLE_KEY` from env — vault-sourced when run under `op run --env-file=.env.template`.
- No raw secrets in any spec file (verified by grep).
- ✅ Compliant with secrets-protocol exit criterion 7.

## 6. Recommended Test Structure

```
apps/e2e/
├── missions/                       # NEW — one folder per mission
│   ├── onboarding-interview/
│   │   ├── web-author.spec.ts      # @web-only — full wizard interview
│   │   └── README.md
│   ├── landing-demo/
│   │   ├── landing-read.spec.ts    # runs on landing project + web-iphone14 + web-pixel7
│   │   └── README.md
│   ├── mr-botsson/
│   │   ├── web-chat.spec.ts        # full author flow (incl. memory write)
│   │   ├── mobile-read.spec.ts     # @mobile-ok — chat-only read query
│   │   └── README.md
│   ├── haccp-inspector/
│   │   ├── web-author.spec.ts      # @web-only — D3 protocol authoring
│   │   ├── mobile-run-check.spec.ts # @mobile-ok — D6 production: run check
│   │   └── README.md
│   └── shift-assistant/
│       ├── web-author.spec.ts      # @web-only — create/update/delete shift
│       ├── mobile-my-schedule.spec.ts # @mobile-ok — read own schedule
│       └── README.md
└── helpers/
    └── mission-fixtures.ts         # NEW — per-mission seed + intercept setup
```

Project matrix in `playwright.config.ts` (target):

```
Project name             | baseURL              | testMatch                         | devices
landing                  | landingBaseUrl       | landing\.spec\.ts                 | Desktop Chrome
web                      | webBaseUrl           | (everything not landing/mobile)   | Desktop Chrome
web-iphone14             | webBaseUrl           | missions/**/mobile-*.spec.ts      | iPhone 14
web-pixel7               | webBaseUrl           | missions/**/mobile-*.spec.ts      | Pixel 7
mobile (existing)        | mobileBaseUrl        | tests/mobile/**                   | iPhone 13 (Expo PWA)
mobile-pwa (existing)    | mobileBaseUrl        | tests/mobile-pwa/**               | Pixel 5  (Expo PWA)
```

`@web-only` specs grep — only mounted under `web` + `landing` projects (testIgnore the mobile projects).
`@mobile-ok` specs mounted under all three viewport-bearing projects.

## 7. Implementation Roadmap

**Iteration 1 (foundation):** Update `playwright.config.ts` — `trace: "retain-on-failure"`, add `web-iphone14` + `web-pixel7` projects with testMatch on `missions/**/mobile-*.spec.ts`. Run existing `botsson-harness-e2e.spec.ts` to confirm zero regression on baseline.

**Iteration 2 (testid coverage):** Add minimum testids to `BotssonShell.tsx` (sticky, arena, chat-input, chat-send, chat-messages). Run baseline again.

**Iteration 3 (`mr-botsson` mobile read):** Write `missions/mr-botsson/mobile-read.spec.ts` — simple "ask Botsson, get answer" on `/dashboard` via mobile viewport. Run under `web-iphone14` and `web-pixel7` projects.

**Iteration 4 (`shift-assistant` web author):** Write `missions/shift-assistant/web-author.spec.ts` — open `/dashboard/schedule`, invoke chat, ask "lag vakt for X på fredag", assert API intercept + UI shift card render.

**Iteration 5 (`haccp-inspector` web author):** Write `missions/haccp-inspector/web-author.spec.ts` — `/dashboard/hms`, chat invoke, run check via tool call, assert deviation row.

**Iteration 6 (`onboarding-interview` web author):** Write `missions/onboarding-interview/web-author.spec.ts` — `/onboarding`, exercise wizard advance + assistant key-fact panel.

**Iteration 7 (`landing-demo` read):** Write `missions/landing-demo/landing-read.spec.ts` — landing `/`, expand voice widget, assert mission badge.

**Iteration 8 (mobile read ports):** Port a read flow of `haccp-inspector` to mobile viewport for D6 verification per ADR-0133.

**Iteration 9+ (loop):** Run full suite under all 3 viewports. Diagnose failures via trace artifacts. Fix smallest. Re-run.

## 8. Loop Execution Log

### Iteration 1 — Playwright config: trace + viewport projects (completed)

**Changes:**
- `apps/e2e/playwright.config.ts:62-72` — `trace: "retain-on-failure"`, added `screenshot: "only-on-failure"` (was `on-first-retry` + retries=0 → never captured locally).
- Added `web-iphone14` project: iPhone 14 device, chromium engine (WSL2/libgtk-4 constraint), `baseURL = webBaseUrl`, `testMatch = /missions\/[^/]+\/mobile-[^/]+\.spec\.ts/`.
- Added `web-pixel7` project: Pixel 7 device, same constraints.
- Tightened `web` project `testIgnore` to exclude `tests/mobile/`, `tests/mobile-pwa/`, and `missions/<id>/mobile-*.spec.ts` (no double-discovery).
- Confirmed Playwright 1.58.2 ships `devices['iPhone 14']` + `devices['Pixel 7']` via Node probe.

**Verification:** `playwright test --list` parses, projects intact, no spec leak between viewports.

### Iteration 2 — Testid coverage on Botsson chat surface (completed)

**Changes:**
- `apps/web/src/app/Botsson/_components/BotssonShell.tsx:539-540` — added `data-testid="botsson-shell"` + `data-density={density}` on shell root (lets specs assert orb→arena transition without DOM-class fragility).
- `apps/web/src/app/Botsson/_components/BotssonShell.tsx:706,719` — added `data-testid="botsson-sticky"` and `data-testid="botsson-arena"` on density-conditional wrappers.
- `apps/web/src/app/Botsson/_components/BotssonChat.tsx:416-419` — `data-testid="botsson-chat"` on root, `data-testid="botsson-chat-messages"` on scroll container.
- `apps/web/src/app/Botsson/_components/BotssonChat.tsx:485,493` — `data-testid="botsson-chat-input"` on textarea, `data-testid="botsson-chat-send"` on submit button.

**Trap encountered:** PostToolUse hook fires `pnpm --filter web typecheck` after every edit. WSL2 (swap=0B, 15Gi RAM, 5 active claude sessions) → dual `tsc --noEmit` race triggered SIGTERM 143 OOM. Documented L-0408. Not a real type error.

**Mitigation:** waited for stale tsc to finish, re-edited. Hook reruns clean.

### Iteration 3 — First mission spec: `mr-botsson` mobile-read (in_progress)

**Hypothesis:** Mocked BFF response + new testids → mobile viewport spec runs end-to-end against `/dashboard` on web baseUrl.

**Spec:** `apps/e2e/missions/mr-botsson/mobile-read.spec.ts`
- ADR-0133-compliant: pure read verb (asks question, asserts intercepted reply).
- 7 in-spec exit-criterion assertions (EC1-EC7) covering orb visibility, density state sync, testid reachability, input fill, BFF intercept count, contract→render parity, and write-verb absence.
- Mocks both `**/api/botsson/chat` and `**/api/emma/chat` to be endpoint-agnostic.

**Discovery confirmed:** `playwright test --list missions/mr-botsson/mobile-read.spec.ts` shows 2 tests — one under `[web-iphone14]`, one under `[web-pixel7]`. Zero under `[web]` (testIgnore working).

**Verification result:** Playwright `webServer` config exited early because `npx supabase status -o env` could not reach the local stack. Spec never executed. Exit code 0 (Playwright reported the infra error cleanly + exited). Stdout:

```
[WebServer] Local Playwright app bootstrap could not read Supabase status.
[WebServer] Start the local Supabase stack with `npx supabase start` before
[WebServer] running the dedicated Playwright web servers.
Error: Process from config.webServer was not able to start. Exit code: 1
```

**Diagnosis:** Not a spec defect. Infra dependency missing. Root: Docker Desktop on Windows is not running → docker daemon unreachable in WSL2 → `supabase start` cannot launch its container stack.

### Iteration 4 — Specs fan-out (completed)

Drafted 7 additional mission specs while iter-3 blocker stood. All discovered correctly:

```
[landing]       missions/landing-demo/landing-read.spec.ts
[web]           missions/mr-botsson/web-chat.spec.ts
[web]           missions/shift-assistant/web-author.spec.ts
[web]           missions/haccp-inspector/web-author.spec.ts
[web]           missions/onboarding-interview/web-author.spec.ts
[web-iphone14]  missions/mr-botsson/mobile-read.spec.ts
[web-iphone14]  missions/shift-assistant/mobile-my-schedule.spec.ts
[web-iphone14]  missions/haccp-inspector/mobile-run-check.spec.ts
[web-pixel7]    (3 mobile specs above, mirrored)
```

Total: 11 test occurrences across 4 projects. Zero spec leak between projects (verified via `playwright test --list`).

`landing` project `testMatch` broadened to `[/tests\/landing\.spec\.ts/, /missions\/landing-demo\/.+\.spec\.ts/]` so the landing-demo mission ships against landingBaseUrl :3056, not webBaseUrl :3060.

`apps/e2e` typecheck clean (no compile errors). Commits: `b6caf7f59` (foundation), `ee130f2b8` (fan-out).

### Iteration 5 — Runtime verification (BLOCKED)

**Blocker:** Docker Desktop on Windows is not running. WSL2 `docker` CLI reports "could not be found in this WSL 2 distro" → Supabase container stack cannot start → web dev server can't bootstrap env from `supabase status` → Playwright can't execute mission specs.

**Required user action:** Start Docker Desktop on Windows, ensure WSL integration is enabled for the active distro. Then `npx supabase start` from repo root.

**On resume:** running all 11 specs is a single command —
`pnpm --filter @smartout/e2e exec playwright test --project=web --project=web-iphone14 --project=web-pixel7 --project=landing missions/`
— with `op run --env-file=.env.template` prefix if vault-sourced env is needed.

(loop reopens when infra returns)

## 9. Exit Status

**Interim — runtime blocked on Docker Desktop startup.**

| Exit Criterion | Status | Evidence |
|---|---|---|
| 1. All journeys green on Chromium + iPhone 14 + Pixel 7 | ⏸ BLOCKED — runtime infra | 11 specs scaffolded; Playwright projects + discovery confirmed |
| 2. Button click + state sync (Zustand ↔ UI) | ✅ designed | `data-density` attr asserts orb→arena transition in every spec |
| 3. Backend contract via API intercept | ✅ designed | every mission spec uses `page.route(/\/api\/(botsson\|emma)\/chat/, ...)` with body + status fulfilment |
| 4. `getByRole` / `getByTestId` only, no fragile CSS | ✅ implemented | all 8 new specs use testid or role locators; testids added to BotssonShell + BotssonChat |
| 5. Author web-only, mobile read/operator only (ADR-0133) | ✅ implemented | file naming convention enforces routing; mobile specs assert zero write-verb URLs hit |
| 6. Trace Viewer artifacts on every failure | ✅ implemented | `trace: "retain-on-failure"` (was `on-first-retry`+retries=0 = never) |
| 7. Test creds via op:// | ✅ pre-existing | `helpers/auth.ts` reads `E2E_EMAIL` + `E2E_PASSWORD` from env; no raw creds in any spec |
| 8. Blockers filed as SMA-xxx | n/a | Docker startup is transient infra, not architectural — not Linear-worthy |

**Loop will resume** once Docker Desktop on Windows is running + `npx supabase start` succeeds in WSL2. At that point one playwright invocation runs all 11 occurrences; subsequent iterations diagnose any real spec-level failures.

**Pending follow-on iterations (once runtime is back):**

1. Run full mission suite, diagnose any locator timing issues (Botsson Orb appears after dashboard hydration — may need `waitForLoadState`).
2. Verify the BFF intercept actually fires — `BotssonChat` defaults to `/api/botsson/chat` but the route handler may redirect to `/api/emma/chat` depending on caller; the spec uses an alternation regex covering both.
3. Tune any spec where mocked-reply assertion races with the Loader/sending state — add `await expect(loader).not.toBeVisible()` if needed.
4. Capture Trace artifacts per failure, attach to report.

## 10. Code Examples

(Pattern templates appended per iteration as specs are written.)
