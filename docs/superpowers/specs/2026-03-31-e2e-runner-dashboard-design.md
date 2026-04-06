---
title: "E2E Runner Dashboard — Live Test Execution UI"
status: approved
updated: 2026-03-31
created: 2026-03-31
module: platform-admin
tags: [e2e, testing, dashboard, playwright, sse, journeys]
---

# E2E Runner Dashboard — Live Test Execution UI

## Summary

A "Runner" tab on `/platform-admin/journeys` that lets godmode admins start E2E tests from the browser and watch live progress — step-by-step status with expandable terminal log. Uses SSE streaming from a Next.js API route that spawns Playwright as a child process.

## Architecture: SSE + Child Process

```
Browser                    Next.js API                     Server
───────                    ───────────                     ──────
"Kör auth" ──POST──→  /api/platform-admin/e2e/run
                          │ spawns child_process
                          │ returns { runId }
                          │
Subscribe  ──GET───→  /api/platform-admin/e2e/stream/[runId]
                          │ SSE stream ←── stdout piped from Playwright
                          │
  ◄── event: step_start   { test: "login page loads", status: "running" }
  ◄── event: step_done    { test: "login page loads", status: "pass", ms: 2100 }
  ◄── event: log          { line: "navigating to /login..." }
  ◄── event: step_done    { test: "auth guard", status: "fail", error: "timeout" }
  ◄── event: run_done     { passed: 6, failed: 1, duration: 45000 }
```

## API Routes

### POST /api/platform-admin/e2e/run

**Auth:** Godmode only (`getSuperAdminId()`).

**Body:**

```typescript
{
  spec?: string;           // e.g. "auth.spec.ts" — single file
  grep?: string;           // e.g. "@smoke" — tag filter
  suite?: "smoke" | "full"; // shorthand: smoke = --grep @smoke, full = all
}
```

**Behavior:**

1. Reject if a run is already active (max 1 concurrent)
2. Generate `runId` (nanoid)
3. Spawn: `npx playwright test [--grep] [spec] --reporter=./reporters/sse-reporter.ts --project=web`
4. Store `{ runId, process, startedAt }` in module-level `Map`
5. Return `{ runId }`

**Environment:** Inherits `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from server. Sets `SKIP_WEB_SERVER=1` (assumes dev server already running). Sets `E2E_SSE=1` flag so the reporter knows to output JSON lines.

### GET /api/platform-admin/e2e/stream/[runId]

**Auth:** Godmode only.

**Response:** `Content-Type: text/event-stream`

**Behavior:**

1. Look up `runId` in the active runs Map
2. Pipe child process stdout line-by-line as SSE `data:` events
3. On process exit: send `event: run_done` with summary, then close stream
4. On client disconnect: keep process running (results still go to DB via existing reporter)

**SSE Event Types:**

| Event        | Data                                           | When                      |
| ------------ | ---------------------------------------------- | ------------------------- | --------------------- | --------- |
| `step_start` | `{ spec, test, status: "running" }`            | Test begins               |
| `step_done`  | `{ spec, test, status: "pass"                  | "fail"                    | "skip", ms, error? }` | Test ends |
| `log`        | `{ line: string }`                             | Playwright verbose output |
| `run_done`   | `{ passed, failed, skipped, duration, runId }` | All tests done            |

## Playwright SSE Reporter

**File:** `apps/e2e/reporters/sse-reporter.ts`

A minimal Playwright reporter that writes one JSON line per event to stdout. Only active when `E2E_SSE=1` env var is set.

```typescript
// Events emitted:
onTestBegin(test)  → { type: "step_start", spec: "auth.spec.ts", test: "login page loads" }
onTestEnd(test)    → { type: "step_done", spec, test, status, ms, error? }
onStdOut(chunk)    → { type: "log", line: "..." }
onEnd(result)      → { type: "run_done", passed, failed, skipped, duration }
```

Coexists with the existing `journey-reporter.ts` — Playwright supports multiple reporters via config. The SSE reporter is added conditionally:

```typescript
// playwright.config.ts (relevant section)
reporter: [
  ["list"],
  ["html"],
  ["./reporters/journey-reporter.ts"],
  ...(process.env.E2E_SSE ? [["./reporters/sse-reporter.ts"]] : []),
];
```

## UI Components

### Tab Layout

The existing journey-list-client.tsx gets a tab-switcher: "Pipeline" (existing) | "Runner" (new).

### Runner Tab

```
┌─────────────────────────────────────────────────────────┐
│  [▶ Kör smoke]  [▶ Kör alle]          ● Idle / Running  │
│  ████████████░░░░░░░░░░░░  12/24 tests   52s            │
│─────────────────────────────────────────────────────────│
│  auth.spec.ts                              6/9 pass     │
│  ├─ ✓ login page loads @smoke         2.1s              │
│  ├─ ✓ auth guard redirect @smoke      1.8s              │
│  ├─ ◐ persist session across nav      ···   ← spinner  │
│  ├─ ○ persist session on reload            ← pending    │
│  └─ ○ signup page loads                                 │
│                                                         │
│  workspace-setup-flow.spec.ts         ▶ [Kör]          │
│  ├─ ○ shows wizard @smoke                              │
│  └─ ...10 more                                          │
│─────────────────────────────────────────────────────────│
│  ▼ Terminal log                                [clear]  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ navigating to /login...                             ││
│  │ waiting for locator('input[type="email"]')          ││
│  │ ✓ login page loads (2.1s)                           ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Components

| Component      | File                | Responsibility                                                                              |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `RunnerTab`    | `runner-tab.tsx`    | Tab container, holds SSE connection + run state                                             |
| `RunnerHeader` | `runner-header.tsx` | Suite buttons (smoke/all), status indicator (idle/running/done), progress bar               |
| `SpecGroup`    | `spec-group.tsx`    | Collapsible group per .spec.ts file, "Kör" button, pass/fail count                          |
| `StepRow`      | `step-row.tsx`      | Single test row: icon (○/◐/✓/✗/⊘) + title + duration. Click failed row → scroll to terminal |
| `TerminalLog`  | `terminal-log.tsx`  | Monospace scrollable log, auto-scroll, clear button, collapsible                            |

### Status Icons

| Icon | State              | Color        |
| ---- | ------------------ | ------------ |
| ○    | Pending            | muted        |
| ◐    | Running (animated) | orange       |
| ✓    | Passed             | emerald      |
| ✗    | Failed             | rose         |
| ⊘    | Skipped            | muted italic |

### Hook: useE2eRunner

```typescript
type RunState = {
  runId: string | null;
  status: "idle" | "running" | "done";
  specs: Map<string, { tests: TestResult[] }>;
  logs: string[];
  summary: { passed: number; failed: number; skipped: number; duration: number } | null;
};

function useE2eRunner(): {
  state: RunState;
  startRun: (opts: { spec?: string; grep?: string; suite?: "smoke" | "full" }) => Promise<void>;
  isRunning: boolean;
};
```

- Calls `POST /api/platform-admin/e2e/run` to start
- Opens `EventSource` to `/api/platform-admin/e2e/stream/{runId}`
- Updates `specs` map on `step_start`/`step_done` events
- Appends to `logs` on `log` events
- Sets `summary` + `status: "done"` on `run_done`
- Cleans up EventSource on unmount

## File Structure

### New files

```
apps/web/src/app/platform-admin/journeys/
  _components/
    runner-tab.tsx
    runner-header.tsx
    spec-group.tsx
    step-row.tsx
    terminal-log.tsx
  _hooks/
    use-e2e-runner.ts

apps/web/src/app/api/platform-admin/e2e/
  run/route.ts
  stream/[runId]/route.ts

apps/e2e/reporters/
  sse-reporter.ts
```

### Modified files

| File                                                                           | Change                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx` | Add tab switcher: "Pipeline" / "Runner"         |
| `apps/e2e/playwright.config.ts`                                                | Conditionally add sse-reporter when `E2E_SSE=1` |

### No new files needed

- No new DB tables (uses existing `journey_test_run`)
- No new dependencies (child_process + EventSource are built-in)
- No new services

## Constraints

- **Max 1 concurrent run** — second request returns 409 Conflict
- **Dev-only** — `child_process.spawn` only works in Node.js, not Vercel Edge. This is fine — E2E testing is a dev activity.
- **Godmode-only** — same auth pattern as all platform-admin routes
- **No headed mode from browser** — tests run headless. Use `--headed` from terminal if you need to watch.
- **Process cleanup** — on API route shutdown or max timeout (10 min), kill child process

## Error Handling

| Scenario                            | Behavior                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Supabase not running                | Reporter detects, `run_done` event with error message                    |
| Edge Runtime down                   | Tests that call Edge Functions fail individually, visible in step status |
| Web server not running              | Playwright timeout on first navigation, clear error in terminal log      |
| SSE disconnect (browser tab closed) | Process continues, results still written to DB by journey-reporter       |
| Concurrent run attempt              | 409 response with `{ error: "Run already active", activeRunId }`         |

## Success Criteria

1. Admin can click "Kör smoke" and see 7 tests progress live in under 90 seconds
2. Failed tests show red with error message, clickable to terminal log
3. "Kör alle" runs full suite (~24 active tests) with live progress
4. Per-spec "Kör" button runs a single spec file
5. Results persist in `journey_test_run` table after completion
6. No new dependencies, no new DB tables, no new services
