---
id: ADR-0029
title: Workspace API Gateway
status: Accepted
date: 2026-03-01
updated: 2026-04-22
---

# ADR-0029: Workspace API Gateway

> **Amended 2026-04-17 by [ADR-0123](0123-adr-0029-amendment-pre-workspace-exceptions.md).**
> Pre-workspace Edge Functions (`accept-invitation`, `create-invitation`) are explicit exceptions
> to the gateway rule. A 3rd pre-workspace endpoint triggers an identity-api gateway ADR.

## Context and Problem Statement

The API key management system (ADR-0028) provides key creation, validation, and rotation. But no endpoints exist that serve workspace data to external consumers. We need a public API gateway that external integrations (POS, booking, HACCP systems) can call with their API key.

## Decision Drivers

- Gateway pattern: one entry point, Supabase validates at the gate
- Scope enforcement: keys should only access resources they're granted
- Workspace isolation: must be provably impossible for key A to see workspace B's data
- Environment enforcement: test keys must not access production data

## Decision Outcome

Single `workspace-api` Edge Function with sub-routing. Uses `executeWithWorkspaceContext` for transaction-scoped RLS via PostgreSQL GUC variables. New RLS policies on exposed tables check `current_setting('app.workspace_id')` alongside existing JWT-based policies.

## Mutation Surface Selection (Amendment 2026-04-22)

| Caller | Auth surface | Canonical path |
|---|---|---|
| Browser, in workspace context | JWT cookie + `x-workspace-slug` header | `apps/web/src/app/api/**/route.ts` (Next.js Node route handler) |
| Browser, no workspace context (signup, invite accept) | URL token / no session | Next.js route handler if session-bootstrap; Edge Function if token-as-auth |
| External integration (POS, booking, HACCP) | API key (`smo_sk_*`) | `workspace-api` Edge Function (this ADR) |
| Webhook callback (Stripe, SendGrid, Twilio, DocuSeal) | Provider signature | Standalone Edge Function with `verify_jwt=false` |
| Server-internal scheduled work | Service role | Edge Function or pg_cron |

**Forbidden:** Browser → `supabase.functions.invoke()` for workspace-scoped mutations. Use a Next.js route handler instead. Reason: Edge Functions (Deno) cannot import `packages/notifications`, `packages/telemetry`, or any internal package — every browser-originated mutation that hits an Edge Function risks ADR-0045 silent violations and telemetry parity gaps. See ADR-0179 for the canonical decision.

## Key Decisions

### Single Function with Sub-Routing

One Edge Function (`workspace-api`) handles all `/v1/*` routes. Simpler deployment, single `verify_jwt = false` entry, shared auth context. Routes are `GET /v1/profiles`, `GET /v1/departments`, etc.

### RLS via GUC Variables

Added `get_api_workspace_id()` helper and `api_key_read_*` policies on 11 tables. These coexist with JWT-based policies (PostgreSQL OR logic). API key auth sets `app.workspace_id` GUC → policies grant access → workspace isolation enforced at database level.

### Environment Enforcement at Gateway

Test keys (`smo_sk_test_*`) are blocked from production via Edge Function check. No schema-level separation — environment is metadata on the key, enforced at the gateway.

## Rules & Consequences

- New workspace-scoped tables MUST get both a JWT-based and `api_key_read_*` RLS policy
- Query results must never include sensitive fields (document_url, signature_id, etc.)
- Usage tracking via hourly bucket upserts for every workspace-api request
- Future write endpoints need `api_key_write_*` policies + scope enforcement
