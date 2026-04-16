---
title: Learning 0037 — Hono AppEnv Sub-Route Generic Drift
status: captured
created: 2026-04-16
updated: 2026-04-16
module: stage-engine
tags: [learning, hono, typescript, middleware, observability]
---

# Learning 0037 — Hono AppEnv Sub-Route Generic Drift

## Context

In `services/stage-engine/`, the root Hono app was migrated to `new Hono<AppEnv>()` where `AppEnv.Variables = { requestId, sessionLane }` (2026-04-16, ADR-0116 / Phase 1 Task 1.5). Sub-routes under `src/routes/` (chat.ts, sessions.ts, store.ts, fetch.ts, advance.ts, ultravox.ts, telegram.ts) were already using their own narrower generics like `new Hono<{ Variables: { auth: AuthContext } }>()`. After the root migration, `requestId` is set at runtime on the shared context object but is compile-time invisible inside sub-routes — forcing `c.get("requestId" as never) as string` escape hatches at any sub-route call site that wants to log with requestId.

## What we learned

In Hono, `app.route("/", subApp)` merges runtime context but does NOT merge compile-time generic types. A sub-app's `Variables` generic controls what its handlers see via `c.get()`. If the root app sets a variable the sub-app's generic doesn't declare, handlers must either:

1. Cast it (`as never` escape hatch — loses type safety and spreads rot)
2. Re-declare the same variables in the sub-app's generic
3. Use a shared `AppEnv` type across root AND sub-apps

Option 3 is the only one that scales. The cost is one import line per sub-route file; the benefit is compile-time safety for every middleware-set variable.

## Why this matters

`requestId` is the keystone of structured logging in ADR-0116. Every log line, every Sentry tag, every emit() call downstream depends on it. An escape-hatch cast at the first use site becomes a copy-paste pattern, and the middleware's type contract degrades to a runtime hope.

## How to detect

`grep -rn "Hono<{" services/stage-engine/src/routes/` — every file returned should use `Hono<AppEnv>` (or extend `AppVariables` explicitly), not bespoke narrower generics.

## How to fix

For each sub-route file:
1. `import type { AppEnv, AppVariables } from "../types/app-env.js";`
2. If the sub-route only adds to parent variables: `new Hono<{ Variables: AppVariables & { auth: AuthContext; ... } }>()`
3. If the sub-route uses only parent variables: `new Hono<AppEnv>()`

Then remove any `c.get("requestId" as never)` casts in the sub-route.

## Related

- ADR-0116 — Runtime Telemetry Standard
- Council session 2026-04-16 — Botsson Runtime Review Phase 5 flagged this as a merge blocker
