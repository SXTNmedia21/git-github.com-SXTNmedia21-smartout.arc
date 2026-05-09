---
title: "Edge Functions Own Call Orchestration"
id: ADR-0054
status: accepted
layer: decision
created: 2026-03-22
updated: 2026-04-07
---

# ADR-0054: Edge Functions Own Call Orchestration

> Renumbered from ADR-0059 → ADR-0054 on 2026-04-07. Original 0059 number collided with `0059-platform-admin-pipeline.md`, which had stronger references (HANDOFF, council, decision-log registry). Platform admin pipeline kept the 0059 slot.

## Context and Problem Statement

Call lifecycle operations (start call, mint tokens, handle webhooks, manage signaling) need a server-side home. The two candidates are Next.js API routes in `apps/web` or Supabase Edge Functions. The choice affects mobile parity, security boundaries, and operational truth.

## Decision Drivers

- Mobile app must have equal access to all call operations (not just web)
- Token minting requires server-side secrets (LiveKit API key/secret) that must never reach the client
- LiveKit webhooks need a stable, publicly-reachable endpoint with HMAC validation
- Call state must be authoritative — one source of truth, not split across platforms
- Existing pattern: Edge Functions already handle auth, invitations, and engine dispatch

## Considered Options

1. **Supabase Edge Functions** — Three functions: `livekit-token`, `livekit-webhook`, `call-command`
2. **Next.js API Routes** — All call logic in `apps/web/src/app/api/channels/[id]/call/`
3. **Hybrid** — Webhooks in Edge Functions, commands in Next.js routes

## Decision Outcome

Chosen option: **"Supabase Edge Functions"**, because they provide a single truth for both platforms.

- **Mobile parity**: Both web and mobile call `supabase.functions.invoke()` — identical code path. Next.js routes would require the mobile app to call a separate HTTP endpoint, adding auth complexity and a second deployment surface.
- **Webhook stability**: Edge Functions have stable URLs (`/functions/v1/livekit-webhook`) that don't change with web app deployments. Next.js route URLs depend on Vercel deployment state.
- **Security boundary**: LiveKit secrets stay in the Edge Function environment, never touching the Next.js server. Service role access for call session creation is scoped to the Edge Function.
- **Existing pattern**: This follows the established gateway pattern where Edge Functions own orchestration and Next.js routes are thin proxies.

## Rules & Consequences

- **Good, because** shared `@smartout/walkie-talkie` package wraps all Edge Function calls — web and mobile use identical mutation functions
- **Good, because** webhook endpoint is infrastructure-stable, not tied to frontend deployments
- **Bad, because** Edge Function cold starts add ~100-200ms latency on first call
- **Bad, because** debugging Edge Functions requires Supabase CLI tooling, not standard Node.js debugging
- **Agent Impact:** All call mutations go through Edge Functions via `supabase.functions.invoke()`. Web API routes (`/api/channels/[id]/call/*`) are thin proxies that forward to Edge Functions — never put call logic directly in Next.js routes. The `call-command` function handles both `start` and `respond` actions via the `action` field.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
