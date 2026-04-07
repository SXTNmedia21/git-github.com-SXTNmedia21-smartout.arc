---
title: "Learning 0025: Stage Engine WebSockets are a Vercel Fluid Compute blocker"
id: LEARNING-0025
status: accepted
created: 2026-04-07
updated: 2026-04-07
module: stage-engine
tags: [learnings, stage-engine, vercel, websockets, infrastructure, agent-runtime]
---

# Learning 0025: Stage Engine WebSockets are a Vercel Fluid Compute blocker

**Discovered:** 2026-04-07 during ADR-0072 council review
**Discovered by:** system-agent-coordinator (council reviewer)

## What we learned

`services/stage-engine/` exposes two WebSocket routes that are load-bearing for the agent runtime:

1. **`/ws/:sessionId`** (`services/stage-engine/src/routes/ws.ts`) — bidirectional UI ↔ engine channel used by the onboarding flow and Botsson client tools.
2. **`/guardian/ws`** — persistent connection used by the admin/guardian monitoring dashboard.

Both are managed by `services/stage-engine/src/ws/connection-manager.ts` and feed events from the in-process `guardian-bus.ts` (an EventEmitter-based pub/sub).

**Vercel Functions and Fluid Compute do NOT support arbitrary WebSocket upgrades.** Vercel's WebSocket story is limited to partner services (Ably, Pusher) or Server-Sent Events (SSE).

## Why this matters

- **Any proposal to migrate Stage Engine to Vercel is structurally blocked** until both WebSocket surfaces are refactored to SSE or an external transport.
- The blocker is not visible from reading `vercel.json` or `infra/Caddyfile` — you have to read the actual route registrations in the service.
- The in-process `guardian-bus` adds a second blocker: even if WebSockets were refactored, Fluid Compute's warm-instance model would silently drop events between instances, because the bus is an in-process EventEmitter with no external transport.
- Background loops (`CLEANUP_INTERVAL_MINUTES=5` in `session-manager.ts`, plus the Calendar Guardian tick) would need conversion to Vercel Cron Jobs.

## What this changes

**For future Vercel migration discussions:**
- shift-mcp is the only stateless service in `services/` that could move cleanly today.
- Stage Engine migration requires three preceding refactors: (1) WS → SSE or external transport, (2) guardian-bus → Upstash Redis pub/sub or Vercel Queues, (3) background loops → cron jobs.
- contract-service needs separate validation that Fluid Compute body parsing preserves the raw request body for DocuSeal HMAC verification.
- scrapling and n8n cannot move at all (Python browser deps + persistent volume respectively).

**For Stage Engine refactors generally:**
- Anyone touching `connection-manager.ts`, `guardian-bus.ts`, or `ws.ts` should be aware that these files define the runtime's hosting constraints. Removing WebSockets would unlock platform flexibility; keeping them locks us to the droplet (or any host with arbitrary WebSocket support).

**For the agent runtime hosting question generally:**
- Voice (Ultravox) is NOT a constraint. Voice runs browser ↔ Ultravox directly. Stage Engine only receives short-lived server-side tool callbacks (`/adapters/ultravox/store`, `/fetch`, `/advance`). These are pure request/response and would work on Fluid Compute. The constraint is the WS UI channel, not voice.

## How we found it

The council briefing for ADR-0072 asked the system-agent-coordinator to evaluate Vercel migration impact on the agent runtime. Agent-coord read the actual stage-engine source (not just the briefing) and found `routes/ws.ts` and the WebSocket wiring in `connection-manager.ts`.

**Council process learning:** Steward and Supervisor evaluated at the concept and convention level. Agent-coord did the code-tracing pass. Both perspectives were necessary — the concept review confirmed the ADR conflict, but the structural blocker was only visible by reading the implementation.

## Files referenced

- `services/stage-engine/src/routes/ws.ts`
- `services/stage-engine/src/ws/connection-manager.ts`
- `services/stage-engine/src/core/guardian-bus.ts`
- `services/stage-engine/src/core/session-manager.ts`
- `services/stage-engine/src/core/calendar-guardian.ts`
- `services/stage-engine/src/routes/adapters/ultravox.ts`

## Related

- ADR-0072: Vercel multi-service migration — rejected pending platform investigation
- ADR-0040: Infrastructure stays in monorepo
- ADR-0036: shift-mcp service
