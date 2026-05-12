---
title: "Shift MCP Server"
id: ADR_0036
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0036: Shift MCP Server

## Context and Problem Statement

Smartout AI agents (Vercel AI SDK) need to create, read, update, and delete shifts in the schedule system. Previously all shift data lived in local React state (ADR-0032). We need a persistent database table and an API that AI agents can call through the Model Context Protocol.

## Decision Drivers

- AI agents must be able to manage shifts programmatically — MCP is the standard protocol for LLM tool use
- The schedule module needs a persistent database layer before the frontend can move beyond local state
- The service must follow established auth patterns (dual-auth: API key + JWT) and security rules (RLS)
- Docker infrastructure plan (ADR-0035) already defines the deployment pattern for microservices

## Considered Options

1. **MCP server as standalone service** — Dedicated Hono + MCP service in `services/shift-mcp/`
2. **REST API on the web app** — Add shift CRUD endpoints to `apps/web` API routes
3. **Supabase Edge Functions** — Add shift tools as Edge Functions behind the workspace-api gateway

## Decision Outcome

Chosen option: **"MCP server as standalone service"**, because:

- MCP protocol gives AI agents native tool semantics (tool discovery, schema introspection, structured I/O) — REST would require adapter glue in every agent
- Standalone service follows the established pattern (stage-engine, contract-service) and deploys independently on the DigitalOcean droplet
- Edge Functions are limited to simple request/response patterns and would add latency for multi-step shift operations
- The service reuses proven auth middleware from stage-engine (dual-auth, SHA-256 key validation)

## Rules & Consequences

- **Good, because** AI agents get structured tool access to shift CRUD with workspace-scoped auth
- **Good, because** the `schedule_shift` table has both JWT and API key RLS policies from day one
- **Good, because** the service is independently deployable and doesn't bloat the web app
- **Bad, because** another service to maintain and deploy — mitigated by shared patterns with stage-engine
- **Agent Impact:** AI agents connecting to shift management must use MCP protocol via `POST /mcp` endpoint at `schedule-mcp.smartout.ai`. Auth via `x-api-key` header with `schedules:read` and/or `schedules:write` scopes.

---
