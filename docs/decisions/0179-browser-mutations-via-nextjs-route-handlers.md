---
id: ADR-0179
title: Browser-Originated Mutations Route Through Next.js Route Handlers
status: accepted
date: 2026-04-22
updated: 2026-04-22
layer: decision
---

# ADR-0179: Browser-Originated Mutations Route Through Next.js Route Handlers

## Context and Problem Statement

Browser code that calls Edge Functions directly via `supabase.functions.invoke()` produces three classes of recurring problems:

1. **CORS bug** — Edge Functions live at `<project>.supabase.co/functions/v1/*`, cross-origin from any `*.smartout.ai` browser origin. CORS preflight required, allowlist drift inevitable. Verified 2026-04-22: 22 functions import static `corsHeaders` (which returns `allowedOrigins[0]` regardless of request) + 26 functions hardcode `*` inline. Local-dev port mismatch (`.env.template:160` lists `localhost:3060,3055`; web dev runs `localhost:3050`) silently breaks all browser → Edge calls.
2. **ADR-0045 silent violation** — Edge Functions run on Deno, cannot import `packages/notifications` (Node). Any Edge dispatching email/SMS hand-rolls `fetch` to SendGrid/Twilio, bypassing the package's retry, kill-switch, suppression, and rate-limit logic. `create-invitation/index.ts:474-561` was the canonical example.
3. **Telemetry parity gap** — Edge Functions cannot import `packages/telemetry` `emit()`. Direct inserts to `activity_trail` + `engine_event` skip PostHog and Logger destinations. Half-blind observability for any browser-triggered Edge action.

Meanwhile, the codebase already has 30+ files in `apps/web/src/app/api/**/route.ts` that do this correctly: Next.js Node route handlers, JWT auth via `@smartout/supabase/server` SSR client, mutations via service-role escalation when needed, dispatch via `@smartout/notifications`, telemetry via `@smartout/telemetry` `emit()`. The pattern was never written down, so the anti-pattern grew alongside it.

## Decision Drivers

- Same-origin = no CORS (browser at `acme.smartout.ai` → `acme.smartout.ai/api/*` is same-origin per ADR-0021 cookie-domain `.smartout.ai`)
- `packages/notifications`, `packages/telemetry`, all internal libraries importable from Node route handlers (no Deno boundary)
- Existing canonical pattern at 30+ sites (e.g., `apps/web/src/app/api/engine-dispatch/route.ts`, `apps/web/src/app/api/schedule/send-message/route.ts`)
- Authority gating via `withWorkspaceAdmin` (SECURITY DEFINER `is_admin_in_workspace()` RPC) is stronger than hand-rolled role checks in Edge

## Considered Options

1. **Browser → Next.js route handler → Supabase** (canonical for browser-originated workspace mutations)
2. **Browser → Edge Function (direct invoke)** — current anti-pattern; suffers CORS + ADR-0045 + telemetry parity issues
3. **Browser → Next.js rewrite proxy → Edge Function** — same-origin without route-handler logic; preserves Edge implementation but loses package-import benefits

## Decision Outcome

Chosen: **Option 1.** Browser code MUST NOT invoke Edge Functions directly via `supabase.functions.invoke()` for workspace-scoped mutations. Use a same-origin Next.js route handler (`apps/web/src/app/api/**/route.ts`).

When the route handler needs to delegate to an existing Edge Function (e.g., `engine-dispatch` is the engine bus, `livekit-token` is service-specific), it does so server-to-server with the service-role key. No CORS. See `apps/web/src/app/api/engine-dispatch/route.ts` as the canonical proxy template.

When the Edge Function exists only because of legacy or runtime accident (e.g., `create-invitation` was Edge but JWT-authenticated and dispatch-heavy — ADR-0045 silent violator), inline its logic into the route handler and delete the Edge Function.

## Mutation Surface Selection (binding)

| Caller | Auth surface | Canonical path |
|---|---|---|
| Browser, in workspace context | JWT cookie + `x-workspace-slug` header | `apps/web/src/app/api/**/route.ts` (Next.js Node) |
| Browser, no workspace context (signup, invite accept) | URL token / no session | Next.js route handler if session-bootstrap; Edge Function if token-as-auth |
| External integration (POS, booking, HACCP) | API key (`smo_sk_*`) | `workspace-api` Edge Function (ADR-0029) |
| Webhook callback (Stripe, SendGrid, Twilio, DocuSeal) | Provider signature | Standalone Edge Function with `verify_jwt=false` |
| Server-internal scheduled work | Service role | Edge Function or pg_cron |

## Rules & Consequences

- **Forbidden:** Browser → `supabase.functions.invoke()` for workspace-scoped mutations.
- **Required:** New browser-originated mutations land at `apps/web/src/app/api/**/route.ts` from day one.
- **Required:** Route handlers use `withWorkspaceAdmin` from `apps/web/src/lib/billing/withAdmin.ts` for admin gating (NOT hand-rolled `["admin","owner"].includes(role)` checks).
- **Required:** Route handlers import `@smartout/notifications` for email/SMS dispatch (NOT raw `fetch` to SendGrid/Twilio).
- **Required:** Route handlers import `@smartout/telemetry` `emit()` for telemetry (NOT direct `activity_trail`/`engine_event` inserts).
- **Required:** Long-running route handlers set `export const runtime = "nodejs"` and `export const maxDuration = 60` (Vercel default 10s truncates batch operations).
- **Active violations** as of 2026-04-22 (Wave H + Wave I targets): 6 browser invoke sites enumerated in `2026-04-22-auth-invitation-wave-h-amendment.md` §7. `create-invitation` is the deletion target; the other 5 become same-origin proxies.
- **Edge Functions remain canonical for:** webhook receivers, external API gateway (`workspace-api`), pre-auth surfaces with token-as-auth (`accept-invitation`), service-internal cron, and operations that the Node runtime cannot perform (none currently identified).
- **Lint candidate:** ESLint rule blocking `supabase.functions.invoke(...)` from `apps/web/src/app/dashboard/**` and `apps/web/src/components/**` (browser-side) — Wave I scope.

## Agent Impact

- New mutation features: brainstorm + plan in route-handler shape from the start. Do not propose Edge Functions for browser-originated mutations.
- Code review: any new `supabase.functions.invoke()` call site in browser-side code (components, hooks) is a blocker. Cite this ADR.
- Migrations: when an existing Edge Function shows ADR-0045 violation symptoms (raw SendGrid/Twilio fetch, direct `activity_trail` insert), prefer inline-into-route-handler over patching the Edge.

## References

- ADR-0021 (subdomain workspace routing) — cookie domain `.smartout.ai` enables same-origin route handlers from any workspace subdomain
- ADR-0029 (workspace-api gateway) — amended same date with the Mutation Surface Selection table
- ADR-0045 (SendGrid transactional email) — clarified same date; this ADR enforces the single-surface rule
- ADR-0123 (ADR-0029 pre-workspace exceptions) — amended same date; `create-invitation` removed from exceptions
- L-0101 (this date) — `supabase.functions.invoke()` from browser as anti-pattern
- Spec: `docs/superpowers/specs/2026-04-22-auth-invitation-wave-h-amendment.md`
