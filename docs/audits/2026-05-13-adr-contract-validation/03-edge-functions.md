---
title: Slice 03 — edge-functions Audit
status: done
created: 2026-05-13
updated: 2026-05-13
module: audit
tags: [audit, edge-functions, adr, adr-0029, adr-0039, adr-0077, adr-0078, adr-0179]
---

# Slice 03 — edge-functions Audit

Surface: `supabase/functions/**`
ADRs: 0029 (workspace-api gateway), 0039 (infra), 0077 (PII), 0078 (channel restriction), 0123 (pre-workspace amend), 0179 (browser MUST NOT invoke EF)
Date: 2026-05-13
Method: full sweep of all 56 functions; `config.toml` verify_jwt audit + per-file auth posture + grep of browser-invoke sites from `apps/web/src`, `apps/mobile`, `apps/landing`.

## Summary

1. **F-EF-01 CLOSED** — `analyze-setup-documents` (SMA-350/ADR-0151) now does real JWT bearer validation + workspace-membership check via anon-key RLS client + storage_path prefix guard before any service-role read. No remaining pseudo-auth.
2. **F-EF-02 PARTIAL** — Direct-invoke check:
   - `wizard-definition.ts:295` (browser `"use client"`) → `ingest-workspace-knowledge`. **STILL OPEN. HIGH.** Browser-originated workspace mutation invoking Edge Function = ADR-0179 violation.
   - `people-actions.ts:766` → `send-login-code`. File header is `"use server"` (React Server Action, runs server-side). NOT a browser invoke. **DOWNGRADED — false positive under ADR-0179 literal reading. NOTE for spirit-of-ADR.**
3. **F-EF-03 NEW HIGH** — Five "intelligence" Edge Functions (`gather-workspace-intelligence`, `google-places-intelligence`, `web-search-intelligence`, `scrape-website`, `search-brreg`) have `verify_jwt = false` AND zero internal auth check AND no signature verification. They are open-internet endpoints that proxy to scrapling/Brreg/Serper/Google Places, billed against Smartout's API quotas. Browser-callable from anywhere on the internet for the cost of one cURL.
4. **F-EF-04 NEW HIGH** — Legacy `/onboarding` (`apps/web/src/app/onboarding/hooks/useOnboardingState.ts`, `"use client"`) directly invokes `gather-workspace-intelligence`, `search-brreg`, `scrape-website` from the browser. ADR-0179 forbids this for any workspace-scoped mutation; while these are pre-workspace reads, they (a) write to `workspace_intelligence_cache` + side-table inserts in `extract-workspace-data` (b) consume external API quota — same architectural shape as F-EF-02.
5. **F-EF-05 NEW MEDIUM** — `create-invitation/index.ts` still exists on disk despite ADR-0179 mandating its deletion (Wave H, 2026-04-22). Not in `config.toml` (so default `verify_jwt=true`), no browser caller, but live SendGrid+Twilio code path remains compilable. Dead code increases attack surface — admin/invite/route.ts is the canonical replacement.
6. **F-EF-06 NEW MEDIUM** — `accept-invitation` (the documented ADR-0123 exception) sets `"Access-Control-Allow-Origin": "*"` inline (not via `getCorsHeaders(req)`). 22 other functions still hardcode `*`. CORS allowlist drift per ADR-0179 §1.
7. **Webhook surface compliant** — `stripe-webhook` (signature verify), `sendgrid-webhook` (ECDSA P-256), `livekit-webhook` (LiveKit receiver), all set `verify_jwt=false` with proper signature verification.
8. **Cron surface compliant** — 17 cron-targeted functions all gate on `WATCHDOG_CRON_SECRET` / `CRON_SECRET` / `MORNING_DIGEST_SECRET` / `PROCESS_NOTIFICATIONS_SECRET` or `verifyInternalAuth()`. No bare cron endpoints.
9. **workspace-api gateway healthy** — `index.ts:82` calls `resolveAuth(req)` (dual-auth JWT + API key, ADR-0077), `:101` enforces `auth.workspaceId` non-null, `:111` blocks test keys in production, GUC-based RLS via `executeWithWorkspaceContext`. ADR-0029 contract intact.

## Findings

| ID | Sev | File:Line | ADR | Evidence |
|----|-----|-----------|-----|----------|
| F-EF-02a | HIGH | `apps/web/src/app/dashboard/setup/wizard-definition.ts:295` | ADR-0179 | File header `"use client"` (line 1). `void invokeEdgeFunction(supabase, "ingest-workspace-knowledge", ...)` inside `onComplete(state)` — runs in browser after wizard finish. Workspace-scoped (`workspace_id: state.workspaceId`). Should be Next.js route handler per ADR-0179 §Rules ("Browser-originated mutations land at `apps/web/src/app/api/**/route.ts` from day one"). |
| F-EF-02b | DOWNGRADED | `apps/web/src/app/dashboard/people/_actions/people-actions.ts:766` | ADR-0179 | File line 1: `"use server"`. Server Action runs on Node, not browser. Literal ADR-0179 text targets "browser code". However: the canonical alternative would be inlining the SendGrid magic-link logic into the action (which itself does call `@smartout/notifications` via `send-login-code` EF). Spirit-of-ADR borderline; literal compliance: pass. |
| F-EF-03 | HIGH | `supabase/functions/gather-workspace-intelligence/index.ts`, `google-places-intelligence/index.ts`, `web-search-intelligence/index.ts`, `scrape-website/index.ts`, `search-brreg/index.ts` | ADR-0029, ADR-0039 (auth posture) | All 5: `verify_jwt = false` in `config.toml` lines 466-475, 559, 571. Zero auth check in handler — no `verifyInternalAuth`, no bearer compare, no signature. Each proxies a paid external API (Scrapling, Google Places, Serper, Brreg). Reachable from open internet for the cost of a POST. Per ADR-0029 mutation-surface table these belong on `workspace-api` (or behind cron secret if internal). |
| F-EF-04 | HIGH | `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:433, 585, 657` | ADR-0179, ADR-0123 | File line 1: `"use client"`. Browser invokes `gather-workspace-intelligence`, `search-brreg`, `scrape-website` directly via `invokeEdgeFunction(supabase, ...)`. Pre-workspace flow (signup wizard) — qualifies under ADR-0123 exception list **only if** the EF cannot be replaced by a route handler. Per MEMORY (`reference_join_vs_onboarding_wizards.md`) the live `/join` wizard already uses Vercel route handlers → `scrape.smartout.ai`. The legacy `/onboarding` is the holdout. ADR-0123 tripwire was lowered to 2 endpoints — currently we have `accept-invitation` (permitted) + these three intelligence calls (not permitted). |
| F-EF-05 | MEDIUM | `supabase/functions/create-invitation/index.ts` (entire file) | ADR-0179 (Wave H) | ADR-0179 explicitly named `create-invitation` as the **deletion target** ("the other 5 become same-origin proxies; `create-invitation` is the deletion target"). File still present at `supabase/functions/create-invitation/index.ts`, 580+ lines, with `Deno.serve` + SendGrid (`api.sendgrid.com/v3/mail/send`) + Twilio (`sendSms`). Not in `config.toml` → defaults `verify_jwt=true` so JWT required at runtime, but the dead code can still be deployed (`supabase functions deploy create-invitation`). Replaced by `apps/web/src/app/api/admin/invite/route.ts` (confirmed line 4 header). |
| F-EF-06 | MEDIUM | `accept-invitation/index.ts:14`, +21 other EFs | ADR-0179 §1 (CORS) | `corsHeaders = { "Access-Control-Allow-Origin": "*", ... }` hardcoded. ADR-0179 §Context.1 explicitly flagged "22 functions import static corsHeaders + 26 functions hardcode `*` inline" as a verified bug from 2026-04-22. Files still using hardcoded `*`: `accept-invitation`, `ingest-workspace-knowledge`, `extract-workspace-data`, `web-search-intelligence`, `process-settlement-image`, `heartbeat-dispatcher`, `_shared/internal-auth.ts`, +others. Only `analyze-setup-documents` migrated to `getCorsHeaders(req)`. |

## Per-ADR Rollup

- **ADR-0029** (workspace-api gateway): Gateway itself is healthy — `resolveAuth` enforces workspace context, GUC-based RLS, environment check on test keys. Five intelligence functions (F-EF-03) bypass the gateway with no replacement auth. Per ADR-0029 §Mutation-Surface table, browser-callable workspace-scoped data should route through Next.js route handlers (`apps/web/src/app/api/**`), and external-integration data through `workspace-api` — neither path is taken for the five intelligence EFs.
- **ADR-0039** (infra consolidation): No infra-level violations found in EF scope. CORS allowlist (F-EF-06) is a contract drift that affects local-dev cross-port calls but not infra topology.
- **ADR-0077** (contract intake PII): `contract-lifecycle` reviewed — uses `verifyInternalAuth` (per L-0177 fail-fast pattern). `process-settlement-image` also internal-auth-gated. No PII leak via misrouted EF auth observed in this slice (cross-reference with slice 08).
- **ADR-0078** (channel restriction): `engine-dispatch` stamps `originating_channel` for every new `engine_state` at lines 343-344. Channel guard pinning is server-side as required. `process-notifications`, `push-dispatch`, `guardian-notify` honour `allowed_channels` array on event-config. No drift found.
- **ADR-0123** (pre-workspace exceptions): Tripwire violated. The amendment threshold is 2 (lowered 2026-04-22). Today's pre-workspace browser-invoke count = 4 (`accept-invitation` permitted + `gather-workspace-intelligence` + `search-brreg` + `scrape-website` not permitted). New ADR for `identity-api` gateway tier should already be open, OR the 3 intelligence EFs migrated.
- **ADR-0179** (browser MUST NOT invoke EF for workspace-scoped mutations): 4 violation sites confirmed (`wizard-definition.ts:295`; `useOnboardingState.ts:433, :585, :657`). 1 baseline downgraded (`people-actions.ts:766` is server action). 1 deletion target not yet deleted (`create-invitation`). CORS hardcoded `*` (F-EF-06) is the §Context.1 symptom that hasn't been swept.

## Counts

- Findings: 6 (4 HIGH equivalents counting F-EF-03 multi-file as one + F-EF-02a + F-EF-04 multi-file + 2 MEDIUM + 1 LOW-ish CORS sweep)
  - HIGH: 3 (F-EF-02a, F-EF-03, F-EF-04)
  - MEDIUM: 2 (F-EF-05, F-EF-06)
  - DOWNGRADED: 1 (F-EF-02b)
  - CLOSED (verified remediated since baseline): 1 (F-EF-01)
- Baseline reconciliation: F-EF-01 closed since baseline. F-EF-02 split — half closed (server action), half open (wizard-definition).
- Functions audited: 56 / 56 (full sweep, all `supabase/functions/*/index.ts`)
- `verify_jwt=false` functions: 52 / 56 (only `livekit-token`, `apply-change-proposal`, `shift-clock-compliance`, `guardian-actions` enforce JWT at the runtime layer)
- Browser-invoke sites in scope: 4 violations + 4 compliant proxies (admin/invite, channels/call/start, channels/call/respond, channels/call/token route to EFs server-to-server)

## Top 3 Critical One-Liners

1. **`wizard-definition.ts:295` invokes `ingest-workspace-knowledge` from browser** — F-EF-02a HIGH, ADR-0179, fix by moving K1b trigger into Next.js route handler (canonical pattern at `apps/web/src/app/api/engine-dispatch/route.ts`).
2. **Five intelligence EFs (`gather-workspace-intelligence`, `google-places-intelligence`, `web-search-intelligence`, `scrape-website`, `search-brreg`) have ZERO auth** — F-EF-03 HIGH, ADR-0029, anyone on the internet can burn Smartout's Scrapling / Serper / Google Places / Brreg quotas via these endpoints.
3. **`/onboarding` browser wizard still hits 3 EFs directly** — F-EF-04 HIGH, ADR-0179 + ADR-0123 tripwire, migrate to Vercel route handler pattern matching `/join` (per `reference_join_vs_onboarding_wizards.md`) or delete the legacy onboarding surface.
