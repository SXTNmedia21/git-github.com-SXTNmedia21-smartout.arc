---
title: Service Routing Reference
status: canonical
created: 2026-03-19
updated: 2026-05-25
module: infrastructure
tags: [services, routing, caddy, docker, urls, endpoints]
---

# Service Routing Reference

How services communicate in local development vs production. Every service runs inside Docker Compose on the `smartout-internal` network. External access goes through Caddy (reverse proxy, auto-HTTPS).

---

## The Rule

**Web app (Next.js) never talks to services directly on localhost.** It always goes through Caddy at `https://{service}.smartout.ai`. This is true in BOTH local dev and production.

**Supabase Edge Functions** use `host.docker.internal:PORT` as fallback for local dev (they run in their own Docker container and can't resolve Caddy hostnames).

---

## Service Map

| Service          | Docker Internal         | Caddy Route                        | Port | Auth                                  |
| ---------------- | ----------------------- | ---------------------------------- | ---- | ------------------------------------- |
| Scrapling        | `scrapling:8000`        | `https://scrape.smartout.ai`       | 8000 | Bearer token (`SCRAPLING_AUTH_TOKEN`) |
| Stage Engine     | `stage-engine:5010`     | `https://engine.smartout.ai`       | 5010 | API key (`STAGE_ENGINE_API_KEY`)      |
| Shift MCP        | `shift-mcp:5011`        | `https://schedule-mcp.smartout.ai` | 5011 | API key                               |
| Contract Service | `contract-service:5012` | `https://contract.smartout.ai`     | 5012 | API key (`CONTRACT_SERVICE_KEY`)      |
| n8n              | `n8n:5678`              | `https://n8n.smartout.ai`          | 5678 | Basic auth                            |

---

## How Each Caller Reaches Services

### Next.js Web App (`apps/web`)

```
Browser -> Next.js API route -> Caddy (HTTPS) -> Docker service
```

**Always uses the Caddy URL.** Configured via env vars in `.env.template`:

| Env Var                 | Value (both local + prod)          | Used By                                        |
| ----------------------- | ---------------------------------- | ---------------------------------------------- |
| `SCRAPLING_SERVICE_URL` | `https://scrape.smartout.ai`       | `/api/workspace-intelligence`, `/api/scrape/*` |
| `STAGE_ENGINE_URL`      | `https://engine.smartout.ai`       | Stage Engine routes                            |
| `CONTRACT_SERVICE_URL`  | `https://contract.smartout.ai`     | Contract routes                                |
| `SHIFT_MCP_URL`         | `https://schedule-mcp.smartout.ai` | Shift MCP routes                               |

The Next.js app runs **outside Docker** (on the host via `pnpm dev`), so it resolves `*.smartout.ai` through Caddy's port 443, which is mapped to the host.

### Supabase Edge Functions

```
Edge Function -> host.docker.internal:PORT -> Docker service
```

Edge Functions run inside Supabase's Docker container. They **cannot resolve Caddy hostnames** (different Docker network). They use `host.docker.internal` to reach services on the host, which then routes to the Docker internal network.

| Env Var                 | Local Fallback                     | Production                   |
| ----------------------- | ---------------------------------- | ---------------------------- |
| `SCRAPLING_SERVICE_URL` | `http://host.docker.internal:8000` | `https://scrape.smartout.ai` |

### Service-to-Service (within Docker)

```
Service A -> service-name:PORT -> Service B
```

Services on the `smartout-internal` network resolve each other by container name. No Caddy, no HTTPS.

---

## Local Development Setup

### Prerequisites

1. Docker Compose running: `cd infra && docker compose up -d`
2. Caddy auto-provisions self-signed certs for `*.smartout.ai`
3. Your `/etc/hosts` or DNS must resolve `*.smartout.ai` to `127.0.0.1`

### DNS Resolution

For local dev, add to `/etc/hosts` (or use dnsmasq):

```
127.0.0.1 scrape.smartout.ai
127.0.0.1 engine.smartout.ai
127.0.0.1 schedule-mcp.smartout.ai
127.0.0.1 contract.smartout.ai
127.0.0.1 n8n.smartout.ai
```

### Verifying a Service

```bash
# Via Caddy (how the web app calls it)
curl -sk https://scrape.smartout.ai/health

# Direct from inside Docker (for debugging)
docker exec infra-scrapling-1 curl -s http://localhost:8000/health
```

### Rebuilding After Code Changes

When you change service code (e.g. `services/scrapling/`), the Docker container must be rebuilt:

```bash
cd infra && docker compose build scrapling && docker compose up -d scrapling
```

Changes to `apps/web` do NOT require Docker rebuild — it runs on the host.

---

## Production

Same Caddy URLs, same env vars. The only difference:

| Aspect      | Local                     | Production           |
| ----------- | ------------------------- | -------------------- |
| Caddy certs | Self-signed (auto)        | Let's Encrypt (auto) |
| DNS         | `/etc/hosts` or local DNS | Real DNS records     |
| Docker host | Your machine              | DigitalOcean droplet |
| Web app     | `pnpm dev` on host        | Vercel               |
| Supabase    | Local Docker              | Supabase Cloud       |

The `.env.template` is identical for both environments. Secrets differ (1Password vaults), but URLs are the same.

---

## Stage Engine — Internal Routes (ADR-0424 §Transport)

| Route                                                      | Caller                  | Auth                                    | Purpose                                                     |
| ---------------------------------------------------------- | ----------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `POST /internal/engine-dispatch/invoke-capability-tool`    | Supabase EF (`engine-dispatch`) | `x-api-key` + scope `engine:invoke` | Execute a capability tool Node-side (Node ESM bridge for EF→stage-engine) |

**Key:** `STAGE_ENGINE_INTERNAL_KEY` (scope `engine:invoke`). Distinct from `STAGE_ENGINE_API_KEY` (scope `bff:proxy`).
**Identity re-derivation:** `workspace_id` is re-derived from `engine_state` row using `engine_state_id`. Body value is sanity-check only (ADR-0151 §Cross-runtime extension).
**Gate placement:** `gate_action` runs Node-side, before `tool.execute()`. EF receives `gate_evaluation_id` in response body and persists into `engine_state_step` row (ADR-0424 §Gate placement + ADR-0356).

---

## Scrapling Endpoints

| Endpoint                  | Method | Auth   | Purpose                                                                   |
| ------------------------- | ------ | ------ | ------------------------------------------------------------------------- |
| `/health`                 | GET    | None   | Health check                                                              |
| `/extract`                | POST   | Bearer | Website data extraction (departments, locations, contacts)                |
| `/scrape-raw`             | POST   | Bearer | Raw HTML scrape                                                           |
| `/enrich`                 | POST   | Bearer | **NEW** — Workspace intelligence enrichment (BRREG + scrape + web search) |
| `/generate`               | POST   | Bearer | **NEW** — AI copywriting from intelligence data                           |
| `/extract/document`       | POST   | Bearer | Document text extraction (PDF, DOCX, etc.)                                |
| `/extract/document/batch` | POST   | Bearer | Batch document extraction                                                 |
| `/tripadvisor`            | POST   | Bearer | TripAdvisor reviews (not yet implemented)                                 |

---

## Troubleshooting

**"Connection refused" on localhost:8000**
Services are not exposed on host ports. Use Caddy: `https://scrape.smartout.ai`

**"Certificate verify failed"**
Local Caddy uses self-signed certs. Use `curl -k` or configure your system to trust Caddy's root CA.

**New code not in Docker**
Rebuild: `cd infra && docker compose build {service} && docker compose up -d {service}`

**Edge Function can't reach service**
Edge Functions use `host.docker.internal`. Verify the service is running and the port is correct.
