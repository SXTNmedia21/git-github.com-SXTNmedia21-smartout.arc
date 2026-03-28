---
title: Platform Admin Services Pages — Implementation
status: done
updated: 2026-03-06
created: 2026-03-06
module: platform-admin
tags: [services, health, config, platform-admin]
---

# Platform Admin Services — List + Detail Pages

## What was built

1. Extended the services list page (`/platform-admin/services`) with status banners, clickable cards, and planned service cards
2. Created a service detail page at `/platform-admin/services/[key]` showing health, config, API endpoints, and container actions
3. Added Caddy, Supabase, Scrapling, and Bubble MCP to the service registry
4. Fixed incorrect port mappings discovered during research

## Service Registry (8 services)

| Service          | Port  | Status  | Docker Container | Health Path                  |
| ---------------- | ----- | ------- | ---------------- | ---------------------------- |
| Caddy            | 80    | active  | caddy            | `/` (accepts 3xx)            |
| Supabase         | 54321 | active  | — (managed)      | `/rest/v1/` (needs anon key) |
| Stage Engine     | 5010  | active  | stage-engine     | `/health`                    |
| Shift MCP        | 5011  | active  | shift-mcp        | `/health`                    |
| Contract Service | 5012  | active  | contract-service | `/health`                    |
| Scrapling        | 8000  | active  | scrapling        | `/health`                    |
| Bubble MCP       | 5014  | planned | bubble-mcp       | `/health`                    |

## Architecture

No new DB tables. Combines data from:

- **Services health API** (`/api/platform-admin/services/health`) — real-time health checks for all active services
- **Secrets API** (`/api/platform-admin/secrets`) — which env vars are configured in Vault
- **API registry** (`health/_components/api-registry.ts`) — related endpoints per service
- **Service registry** (`services/_components/service-config.ts`) — static metadata per service

## List page features

- **Red alert banner** when services are down — shows service names and first error message
- **Orange banner** for degraded services
- **Green banner** when all services operational
- **Clickable cards** with red border/tint for down, orange border for degraded
- **Planned service cards** — dashed border, "Planned" badge, "Not installed" text
- **Auto-refresh** every 30s via TanStack Query

## Detail page sections

1. **Planned banner** (only for status=planned) — "Not yet installed, port reserved"
2. **Health** — Status dot with ping animation, response time, version, port, error
3. **Configuration** — Related env vars with Vault status, environment badge, last rotated date, Configure/Update buttons
4. **API Endpoints** — Table with color-coded method badges (GET=green, POST=blue, DELETE=red), path, description
5. **Actions** — Disabled "Restart Container" and "View Logs" buttons with container name (for future service layer)

## Health API enhancements

- Added Caddy check (port 80, accepts 3xx redirects as healthy)
- Added Supabase check (port 54321, sends anon key header)
- Added Scrapling check (port 8000)
- Support for custom headers per service entry
- Support for `acceptRedirect` flag (Caddy returns 308)

## Research findings (2026-03-06)

### Actual port mappings

| Service          | Documented Port | Actual Port | Notes                              |
| ---------------- | --------------- | ----------- | ---------------------------------- |
| Stage Engine     | 5010            | 5010        | Running as bare Node (not Docker!) |
| Shift MCP        | 5011            | 5011        | Docker, healthy                    |
| Contract Service | 5012            | 5012        | Docker, unhealthy but responding   |
| Scrapling        | 5013 (wrong!)   | **8000**    | Docker maps 8000:8000, not 5013    |

### Issues discovered

- **Stage Engine not in Docker** — 4+ orphaned `pnpm --filter stage-engine dev` processes from Mar 4, running as bare Node on host
- **Scrapling port mismatch** — Docker exposes 8000, code had 5013. Fixed.
- **Contract Service Docker unhealthy** — `docker ps` shows unhealthy but service responds 200

### Health endpoint implementations

All services return similar JSON:

```json
{ "status": "ok", "service": "<name>", "version": "0.1.0", "timestamp": "<ISO>" }
```

- Stage Engine: Hono `GET /health` (no auth)
- Shift MCP: Hono `GET /health` (auth middleware skips it)
- Contract Service: Fastify `GET /health` (auth hook skips it)
- Scrapling: FastAPI `GET /health` (no auth, returns `"healthy"` not `"ok"`)

## Files

| File                                                   | Action                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `services/_components/service-config.ts`               | Modified — added `status` field, Caddy, Supabase, Scrapling, Bubble MCP |
| `services/_components/service-card.tsx`                | Modified — clickable Link, red/orange borders, PlannedServiceCard       |
| `services/_components/services-page-client.tsx`        | Modified — alert banners, planned service cards                         |
| `services/[key]/page.tsx`                              | Created — server page with auth gate                                    |
| `services/[key]/_components/service-detail-client.tsx` | Created — 5-section detail view                                         |
| `api/platform-admin/services/health/route.ts`          | Modified — Caddy, Supabase, Scrapling, headers, redirects               |

## Future: Service Layer upgrade

When the [Service Layer Plan](./2026-03-06-service-layer-plan.md) is executed:

- Static `SERVICE_REGISTRY` becomes seed data for `service_config` DB table
- Actions section gets wired up (Docker restart, Vercel env sync)
- Config section writes directly to Vault instead of linking to keys page
- Service registry becomes dynamic (add/remove services from UI)
