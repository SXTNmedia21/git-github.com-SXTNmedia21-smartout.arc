---
title: "Auth & Invitation — Wave H Amendment (Browser → Next.js Route Handlers)"
id: SPEC_AUTH_INVITATION_WAVE_H_2026_04_22
version: "1.0"
status: accepted
layer: spec
created: 2026-04-22
updated: 2026-04-22
author: claude (orchestrator) + system-steward (chair) + supervisor + system-agent-coordinator
extends:
  - 2026-04-20-auth-invitation-implementation-plan.md (Waves A–G)
depends_on:
  - ADR-0021 (subdomain workspace routing, amended 2026-04-20)
  - ADR-0029 (workspace-api gateway) — amended in this wave
  - ADR-0045 (SendGrid transactional email) — clarified in this wave
  - ADR-0123 (ADR-0029 pre-workspace exceptions) — amended in this wave
  - ADR-0152 (activity-trail fail-fast)
  - ADR-0167 (invitation tokens as credentials)
  - ADR-0179 NEW — Browser-Originated Mutations Route Through Next.js Route Handlers
  - ADR-0180 NEW — Engine Event Parity Contract for Telemetry
council_session: 2026-04-22 Auth & Invitation Wave H
trust_gate: CONDITIONAL PASS (5 conditions enumerated in §6)
tags: [spec, auth, invitation, refactor, browser-bff, edge-functions, telemetry, wave-h]
module: auth
---

# Auth & Invitation — Wave H Amendment

## 1. TL;DR

Wave H deletes the `create-invitation` Edge Function and inlines its logic into a Next.js route handler at `apps/web/src/app/api/admin/invite/route.ts`. This eliminates the cross-origin browser → Edge Function pattern that produced the local-dev CORS bug AND auto-fixes the silent ADR-0045 violation (Edge/Deno cannot import `packages/notifications`/Node). Lands as 4 sequenced PRs (H.0 ADRs → H.1 easy proxies → H.2 invite refactor → H.3 cleanup), gated on Trust Gate (5 conditions). External callers verified zero. Mobile parity unaffected (mobile only invokes `accept-invitation`, which stays Edge per ADR-0123).

## 2. Council Verdict

**APPROVE WITH CHANGES — strengthened.** Full quorum (4/4 reviewers + Phase 2.5 fact-check + targeted re-review). Verdict held across two rounds: original council (briefing-stale L-0083 framing falsified mid-session) and re-review (Pontus chose Option 2 — delete Edge, inline into route handler).

## 3. The Bug (root cause)

`invite-member-dialog.tsx:434, :482` calls `supabase.functions.invoke("create-invitation")` directly from the browser. Browser at `http://localhost:3050` (or `acme.smartout.ai`) → cross-origin POST to `<project>.supabase.co/functions/v1/create-invitation` → CORS preflight required.

`supabase/functions/_shared/cors.ts` exports a static `corsHeaders` constant that returns `allowedOrigins[0]` regardless of request origin. `.env.template:160` lists `localhost:3060,localhost:3055`. Web dev runs on `localhost:3050`. **Result:** Function returns `Access-Control-Allow-Origin: http://localhost:3060`, browser blocks the response. Same bug class hits 22 functions importing static `corsHeaders` + 26 functions hardcoding `*` inline.

**The bug is downstream of the architectural mistake.** Browser → Edge Function (cross-origin) is the wrong pattern for workspace-scoped mutations. Canonical pattern (already in 30+ files) is browser → Next.js route handler (same-origin, no CORS) → server-to-server.

## 4. Architectural Decisions

### 4.1 Browser-originated mutations (NEW: ADR-0179)

Browser code MUST NOT invoke Edge Functions directly via `supabase.functions.invoke()` for workspace-scoped mutations. Use a same-origin Next.js route handler (`apps/web/src/app/api/**/route.ts`).

| Caller | Auth surface | Canonical path |
|---|---|---|
| Browser, in workspace context | JWT cookie + `x-workspace-slug` | Next.js route handler (Node) |
| Browser, no workspace (signup, invite accept) | URL token / no session | Next.js route handler if session-bootstrap; Edge if token-as-auth |
| External integration (POS, booking) | API key (`smo_sk_*`) | `workspace-api` Edge Function (ADR-0029) |
| Webhook callback (Stripe, SendGrid) | Provider signature | Standalone Edge Function `verify_jwt=false` |
| Server-internal scheduled work | Service role | Edge Function or pg_cron |

### 4.2 Engine event parity (NEW: ADR-0180)

Any registered telemetry event with `dual` routing in `packages/telemetry/src/registry.ts` MUST produce both `activity_trail` AND `engine_event` rows, OR have documented exclusion. Wave H lands the parity test (`packages/telemetry/__tests__/parity.test.ts`); future Edge Functions are audited in Wave I.

### 4.3 ADR-0029 amendment (mutation surface table)

Adds the table from §4.1 as a new section "Mutation Surface Selection." Forbids browser → `supabase.functions.invoke()` for workspace-scoped mutations.

### 4.4 ADR-0123 amendment (pre-workspace exceptions)

Removes `create-invitation` from exception list (deleted in this wave). Tripwire threshold lowered from 3 → 2: "When 2nd pre-workspace endpoint is proposed (in addition to `accept-invitation`), open identity-api ADR."

### 4.5 ADR-0045 clarification

One-line addition: "`packages/notifications` is the single dispatch surface. Browser-originated dispatch routes through Next.js route handlers (Node runtime). Edge Functions (Deno) MUST route dispatch through a Next.js route handler or a server-internal callback rather than re-implementing dispatch in Deno."

## 5. The Refactor (`create-invitation` → `/api/admin/invite/route.ts`)

### 5.1 Responsibility map (Edge → route handler)

| Edge responsibility | New location | Reuses |
|---|---|---|
| OPTIONS / CORS preflight | DELETE (same-origin) | — |
| Auth: `supabase.auth.getUser()` | `withWorkspaceAdmin(workspace_id, fn)` | `apps/web/src/lib/billing/withAdmin.ts:93-120` |
| Mode dispatch (batch vs single) | Same — branch on `body.invites` vs `body.invite_type` | — |
| Inviter role check (`admin`/`owner`) | `is_admin_in_workspace()` SECURITY DEFINER RPC via `withWorkspaceAdmin` | RPC already exists |
| INSERT to `invitation` (RLS via JWT) | Same shape, JWT client (NOT service role) | `@smartout/supabase/server` |
| SendGrid dispatch | `sendEmailBatch()` from `@smartout/notifications` | `packages/notifications/src/sendgrid.ts` |
| Twilio dispatch | `sendSms()` from `@smartout/notifications` | `packages/notifications/src/sms-service.ts` |
| Telemetry (`invitation created/dispatched`) | `emit()` from `@smartout/telemetry` (all 4 destinations) | `packages/telemetry/src/emit.ts` |
| Token censoring (ADR-0167) | `censorToken()` extracted to `apps/web/src/lib/invitations.ts` | — |

### 5.2 Shared library

Extract reusable logic to `apps/web/src/lib/invitations.ts`:
- `createInvitation(params): Promise<InvitationResult>`
- `resolveInviterProfile(workspace_id, user_id)`
- `dispatchInvitationChannels(invitation, channels)`
- `censorToken(token: string): string`

Both `/api/admin/invite/route.ts` (browser) AND `people-actions.ts:413` (Server Action `resendInvitation`) call `createInvitation()`. Single chokepoint = single security review surface.

### 5.3 Runtime config

```ts
export const runtime = "nodejs";  // not edge
export const maxDuration = 60;    // Vercel default 10s would truncate batch invites
```

### 5.4 Authority gate

```ts
return withWorkspaceAdmin(workspace_id, async (userId, adminClient) => {
  return await createInvitation({ ...body, invited_by: userId, client: adminClient });
});
```

`is_admin_in_workspace()` SECURITY DEFINER prevents RLS bypass. Stronger than the Edge Function's manual `["admin", "owner"].includes(role)` grep.

## 6. Trust Gate (5 conditions, all BLOCKING)

1. **ADR-0179 lands BEFORE refactor commit (H.2).** Without canonical decision, migration is "just a refactor" instead of "first application of pattern."
2. **ADR-0029 amendment lands with ADR-0179.** Mutation surface table is the architecture; ADR-0179 is its first invocation.
3. **ADR-0123 amendment lands with ADR-0179.** Tripwire threshold change protects against the next pre-workspace endpoint.
4. **Engine_event parity test (`packages/telemetry/__tests__/parity.test.ts`) lands BEFORE H.2 merges.** The whole point is to prove the canonical pattern doesn't have parity gaps.
5. **Route handler MUST set `runtime: "nodejs"` + `maxDuration: 60`.** Vercel default 10s could truncate batch invites mid-`Promise.all`.

## 7. Wave H Scope (what ships)

| Item | PR |
|---|---|
| ADR-0179 (NEW) — Browser-originated mutations | H.0 |
| ADR-0180 (NEW) — Engine event parity contract | H.0 |
| ADR-0029 amendment (mutation surface table) | H.0 |
| ADR-0123 amendment (remove create-invitation, threshold 3→2) | H.0 |
| ADR-0045 clarification (one-line) | H.0 |
| Easy proxy: existing `/api/engine-dispatch/route.ts` (zero new code) | H.1 |
| New proxy: `/api/admin/change-proposals/[id]/apply/route.ts` | H.1 |
| New proxy: `/api/reconciliation/settlement-image/process/route.ts` | H.1 |
| New proxy: `/api/reconciliation/validate/route.ts` | H.1 |
| New proxy: `/api/shift-clock/compliance/route.ts` | H.1 |
| Update 5 browser call sites | H.1 |
| `apps/web/src/lib/invitations.ts` (shared) | H.2 |
| `apps/web/src/app/api/admin/invite/route.ts` (new) | H.2 |
| Update `invite-member-dialog.tsx` (lines 434, 482) | H.2 |
| Update `people-actions.ts:413` (`resendInvitation`) | H.2 |
| `packages/telemetry/__tests__/parity.test.ts` (new) | H.2 |
| Update `apps/e2e/tests/journey-employee-invitation.spec.ts:83` | H.2 |
| Update `apps/web/src/app/platform-admin/health/_components/api-registry.ts:329` | H.2 |
| Delete `supabase/functions/create-invitation/` | H.2 |
| Delete `[functions.create-invitation]` block in `supabase/config.toml` | H.2 |
| `/platform-admin/dev-outbox` stub utility (3 affordances + `notFound()` in prod) | H.2 |
| `/update-password` ghost route closure (carry from prior council) | H.2 |
| Delete `apps/web/src/lib/supabase-edge-invoke.ts` (0 call sites) | H.3 |
| `docs/HANDOFF-wave-h.md` | H.3 |

## 8. Defers (NOT Wave H)

| Item | Owner |
|---|---|
| Migrate `accept-invitation` Edge Function | Stays Edge (mobile dependency, pre-auth surface) |
| Remaining 5 browser invoke sites NOT in H.1 (already covered: see §7) | — |
| 48-occurrence CORS sweep on remaining ~21 Edge Functions | Wave I (separate sortie) |
| Hybrid C fail-fast pattern for remaining Edge Functions | Wave I |
| Real-time view-tracking on dev-outbox | Backlog |
| Inbucket-polling UI | Backlog |
| Q15 reverify-OTP if it issues new credentials | Separate spec (credential-multiplication risk) |
| Per-workspace feature-flag table (vs env-var) | Backlog |
| Twilio webhook delivery status in dev | Backlog |

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| ADR-0179 lands AFTER refactor (out-of-order) | High | H.0 merges first. Phase 8 verifies. |
| Route handler hits Vercel 10s timeout on batch invites | Medium | `maxDuration: 60` enforced (Trust Gate #5) |
| Hand-rolled role check vs `withWorkspaceAdmin` drift | Medium | Code review on H.2; lint candidate for Wave I |
| Telemetry round-trip fails (route handler → engine-dispatch Edge) | Medium | Parity test verifies in dev (Trust Gate #4) |
| Mobile breaks (false alarm — verified zero invokes) | Low | Verified by grep (`apps/mobile/`: 0 hits for `create-invitation`) |
| External callers break (false alarm — verified zero) | Low | Verified by grep (`n8n/`, `.github/`, webhooks: 0 hits) |
| `dev_outbox` accidentally ships to prod | Medium | Page hard-gates on `process.env.NODE_ENV !== "production"` via `notFound()` |
| L-0083/L-0094 phantom-emit pattern recurs | Low | Audit-inflation L-0100 logged; future councils Phase 2.5 must verify Edge direct-insert sites |

## 10. Acceptance criteria (per PR)

### H.0 (ADR alignment)
- [ ] ADR-0179 written, status `accepted`
- [ ] ADR-0180 written, status `accepted`
- [ ] ADR-0029 amended with §"Mutation Surface Selection" table
- [ ] ADR-0123 amended (create-invitation removed, threshold 3→2)
- [ ] ADR-0045 clarification added
- [ ] `docs/decisions/0000-decision-log.md` updated
- [ ] `pnpm turbo typecheck` passes (no code changes; should be no-op)

### H.1 (easy proxies)
- [ ] 4 new route handlers created (engine-dispatch already exists)
- [ ] 5 browser call sites updated to `fetch("/api/...")`
- [ ] `pnpm turbo typecheck` passes
- [ ] Reconciliation E2E + close-out E2E + shift-clock E2E green

### H.2 (invite refactor)
- [ ] `apps/web/src/lib/invitations.ts` created with `createInvitation`, `resolveInviterProfile`, `dispatchInvitationChannels`, `censorToken`
- [ ] `apps/web/src/app/api/admin/invite/route.ts` created with `runtime: "nodejs"` + `maxDuration: 60`
- [ ] `withWorkspaceAdmin` used for auth (NOT hand-rolled role check)
- [ ] `@smartout/notifications` `sendEmailBatch` + `sendSms` used (NOT raw fetch)
- [ ] `emit()` from `@smartout/telemetry` used (NOT direct `activity_trail` insert)
- [ ] `packages/telemetry/__tests__/parity.test.ts` created and passes
- [ ] `invite-member-dialog.tsx:434, :482` updated to `fetch("/api/admin/invite")`
- [ ] `people-actions.ts:413` updated to call shared `createInvitation()` lib
- [ ] `apps/e2e/tests/journey-employee-invitation.spec.ts:83` updated (auth header → session cookie)
- [ ] `supabase/functions/create-invitation/` deleted
- [ ] `[functions.create-invitation]` block deleted from `config.toml`
- [ ] `apps/web/src/app/platform-admin/health/_components/api-registry.ts:329` updated
- [ ] `/platform-admin/dev-outbox/page.tsx` created with 3 DEV-ONLY affordances + `notFound()` in prod
- [ ] `/update-password` ghost route page created OR redirect added
- [ ] `pnpm turbo typecheck` passes
- [ ] E2E `journey-employee-invitation.spec.ts` green (full path: invite → dispatch → opened → accepted)

### H.3 (cleanup)
- [ ] `apps/web/src/lib/supabase-edge-invoke.ts` deleted
- [ ] `docs/HANDOFF-wave-h.md` written

## 11. Knowledge to Capture (Phase 8)

**ADRs:**
- ADR-0179 NEW
- ADR-0180 NEW
- ADR-0029 amendment
- ADR-0123 amendment
- ADR-0045 clarification

**Learnings:**
- L-0099 — phantom-emit briefing-staleness pattern (Edge direct-inserts invisible to grep `emit\(`)
- L-0100 — audit-inflation 4th occurrence
- L-0101 — `supabase.functions.invoke()` in browser is anti-pattern (CORS + ADR-0045 silent violation)
- L-0102 — ADR-0123 tripwire fired in reverse direction (counter went down via migration, threshold lowered)

## 12. Out of Campaign Boundary

⚠️ This work touches `dashboard/people` (D2/D5), `dashboard/settings` (cross-cutting), `hooks/shift-clock` (D6) — cross-campaign. MUST NOT execute from `campaign/daily-operation` worktree per CLAUDE.md "100% Dedikasjon" rule. Execute from `development` directly (small) or sortie off main (`feat/wave-h-browser-invoke-cleanup`).
