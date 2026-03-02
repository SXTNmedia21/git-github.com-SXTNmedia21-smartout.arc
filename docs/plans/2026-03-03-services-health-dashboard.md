---
title: "Services Health Dashboard"
status: in_progress
updated: 2026-03-03
created: 2026-03-03
module: platform-admin
tags: [services, health, monitoring, godmode]
---

# Services Health Dashboard

## Goal

A godmode-only page at `/platform-admin/services` showing real-time health of all Smartout microservices.

## Services to Monitor

| Service          | Package                      | Port | Health Endpoint |
| ---------------- | ---------------------------- | ---- | --------------- |
| Stage Engine     | `@smartout/stage-engine`     | 3000 | `GET /health`   |
| Shift MCP        | `@smartout/shift-mcp`        | 3001 | `GET /health`   |
| Contract Service | `@smartout/contract-service` | 3100 | `GET /health`   |

## Architecture

```
platform-admin/services/
├── page.tsx                    — Server component, godmode gate
├── _components/
│   ├── services-page-client.tsx — Client component, polling + state
│   ├── service-card.tsx         — Card per service: name, status, uptime, last check
│   └── service-config.ts       — Service registry (name, url, port, healthPath)
└── _hooks/
    └── use-service-health.ts   — Hook: polls /health every 30s, returns status per service
```

## UI Design

### Service Card

- **Header:** Service name + colored status badge (green=healthy, yellow=degraded, red=down)
- **Body:** Response time (ms), last checked timestamp, uptime indicator
- **Footer:** Link to service docs, restart hint
- Use `shadcn/ui` Card, Badge, Skeleton (while loading)

### Page Layout

- Grid of 3 cards (responsive: 1 col mobile, 3 col desktop)
- Auto-refresh toggle (default: on, 30s interval)
- Manual "Check All" button
- Last global check timestamp in header

## Health Check Flow

1. Client-side `fetch()` to API route (NOT direct to services — CORS)
2. API route at `apps/web/src/app/api/platform-admin/services/health/route.ts`
3. API route calls each service's `/health` endpoint with 5s timeout
4. Returns aggregated status JSON
5. Client polls every 30s via `useQuery` with `refetchInterval`

## API Route

```typescript
// GET /api/platform-admin/services/health
// Response:
{
  services: [
    {
      name: "stage-engine",
      url: "http://localhost:3000",
      status: "healthy" | "degraded" | "down",
      responseTime: 45,        // ms
      checkedAt: "2026-03-03T...",
      error?: "Connection refused"
    }
  ]
}
```

## Security

- Page: `is_godmode` check in server component (same pattern as `/platform-admin/keys`)
- API route: verify user session + `is_godmode` from `user_identity`
- Never expose service URLs to non-godmode users

## Tasks

1. Create `service-config.ts` — service registry with names, URLs, health paths
2. Create API route `api/platform-admin/services/health/route.ts` — proxy health checks
3. Create `use-service-health.ts` hook — polling with useQuery
4. Create `service-card.tsx` — individual service card component
5. Create `services-page-client.tsx` — page layout with grid
6. Create `page.tsx` — server component with godmode gate
7. Typecheck, commit, push, PR, `/close-feature`
