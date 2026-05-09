---
title: "Telemetry package conditional exports for client/server split"
id: ADR-0084
status: accepted
layer: decision
created: 2026-04-09
updated: 2026-04-09
---

# ADR-0084: Telemetry package conditional exports for client/server split

## Context and Problem Statement

The `@smartout/telemetry` package exports a single `emit()` function used by ~100 files across `apps/web`. The server-side PostHog provider (`posthog-node`) imports `node:fs`, which causes Turbopack (Next.js 16) to fail when tracing the import graph for client components. Dynamic `await import()` was not sufficient — Turbopack performs static analysis and still pulls the dependency into the client bundle.

## Decision Drivers

- Turbopack traces all import paths statically, including dynamic imports
- `posthog-node` uses `node:fs` which is unavailable in client bundles
- ~100 client-side files import `emit()` — changing import paths is not feasible
- `serverExternalPackages` in `next.config.ts` only works if the bundler knows the import is server-only
- The `emit()` API must remain identical for consumers on both sides

## Considered Options

1. **Conditional exports in package.json** — `react-server` condition for full server emit, `default` for client-safe emit
2. **String-based dynamic import** to trick Turbopack — fragile, non-standard
3. **Separate import paths** (`@smartout/telemetry/client`) — requires updating ~100 import sites

## Decision Outcome

Chosen option: **"Conditional exports"**, because it requires zero changes to consumers, uses a standard Next.js/Turbopack mechanism, and cleanly separates server and client code.

### Architecture

```
package.json exports:
  "." -> react-server: ./src/index.ts     -> emit.ts      (full: posthog-node, activity_trail, engine_event, logger)
  "." -> default:      ./src/index.client.ts -> emit.client.ts (safe: posthog-js, proxy for server destinations)
  "./server":          ./src/index.ts     (explicit server import)
  "./react":           ./src/react.ts     (React hooks, unchanged)
```

### Client-side proxy contract

Client `emit()` handles browser-safe destinations directly (posthog-js, console logger, notifications). Server-only destinations (`activity_trail`, `engine_event`) are proxied through `/api/telemetry`, which calls server-side `emit()` and handles all five destinations.

**Invariant:** Every destination declared in `registry.ts` must be reachable from both client and server emit paths, either directly or via the `/api/telemetry` proxy.

### Server emit cleanup

Server `emit.ts` no longer contains any client-side code paths (`isServer` checks, `posthog-client` imports, `window` detection). It is a pure server file loaded only via `react-server` condition.

## Rules & Consequences

- **Good, because** zero consumer changes — all 100 import sites work unchanged
- **Good, because** client bundle no longer contains `posthog-node` or `node:fs`
- **Good, because** server emit is simpler (no client branches)
- **Bad, because** client events have an extra HTTP hop for `activity_trail` and `engine_event` (fire-and-forget via `/api/telemetry`)
- **Bad, because** the proxy is best-effort — if `/api/telemetry` is down, those destinations are silently lost
- **Agent Impact:** When adding new telemetry destinations, ensure they are handled in BOTH `emit.ts` (server) and `emit.client.ts` (client). If the destination requires server-side resources (DB, service role), add it to the proxy condition in `emit.client.ts`.
