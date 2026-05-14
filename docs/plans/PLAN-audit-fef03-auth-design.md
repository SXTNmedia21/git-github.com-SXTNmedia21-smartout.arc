---
title: "Design Brief — F-EF-03 Auth Model for Intelligence Edge Functions"
feature: audit-fef03-intelligence-ef-auth
spec: ../audits/2026-05-13-adr-contract-validation/03-edge-functions.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: edge-functions
tags: [design-brief, auth, edge-functions, f-ef-03]
---

# Design Brief — F-EF-03 Auth Model for Intelligence Edge Functions

> Branch: `feat/audit-fef03-intelligence-ef-auth` | Worktree: `~/dev/smartout.ai-wt-11`
> Spec: [Slice 03 audit](../audits/2026-05-13-adr-contract-validation/03-edge-functions.md) §F-EF-03
> Sortie task: T1 (Design surface audit)

## Goal

Pick an auth model for five `verify_jwt=false` intelligence Edge Functions that today accept anonymous POST and proxy paid external APIs (Scrapling, Serper, Google Places, Brreg). Output below is a **ship-decision** — no council needed, see rationale.

The five targets:

- `supabase/functions/gather-workspace-intelligence/index.ts`
- `supabase/functions/google-places-intelligence/index.ts`
- `supabase/functions/web-search-intelligence/index.ts`
- `supabase/functions/scrape-website/index.ts`
- `supabase/functions/search-brreg/index.ts`

All five: `config.toml` lines 466–475, 559, 571 set `verify_jwt = false`. Zero handler-level auth check today. Active money/abuse vector per audit synthesis.

---

## Caller Inventory

| Edge Function | Caller | Path | Posture | ADR ref |
|---|---|---|---|---|
| `gather-workspace-intelligence` | Browser (legacy `/onboarding`) | `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:433` (`"use client"`) | DIRECT invoke from browser — ADR-0179 violation | F-EF-04 |
| `gather-workspace-intelligence` | **EF (internal proxy)** | calls `web-search-intelligence` (line 63) + `google-places-intelligence` (line 92) with `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` | EF-to-EF, already service-role signed | — |
| `search-brreg` | Browser (legacy `/onboarding`) | `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:585` (`"use client"`) | DIRECT invoke from browser | F-EF-04 |
| `scrape-website` | Browser (legacy `/onboarding`) | `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:657` (`"use client"`) | DIRECT invoke from browser | F-EF-04 |
| `web-search-intelligence` | EF-only | called by `gather-workspace-intelligence` (line 63) | EF-to-EF, service-role signed | — |
| `google-places-intelligence` | EF-only | called by `gather-workspace-intelligence` (line 92) | EF-to-EF, service-role signed | — |

**Crucial findings from caller audit:**

1. **NO Vercel BFF / Next.js route handler currently invokes any of the five EFs.** The live `/join` wizard pipeline uses `apps/web/src/app/api/workspace-intelligence/route.ts` + `apps/web/src/app/api/scrape/*/route.ts`, all of which call `services/scrapling` on the droplet (`scrape.smartout.ai`) DIRECTLY. They do not delegate to these EFs (verified by grep across `apps/web/src/app/api/**`).
2. **NO mobile or landing caller.** Grep across `apps/mobile/`, `apps/landing/` returns zero hits.
3. **NO capability tool in `packages/ai/` invokes these EFs.** `packages/ai/src/tools/intelligence/search-company.ts` calls Brreg API directly (not via the EF).
4. The only live external caller of any of these EFs today is **`apps/web/src/app/onboarding/hooks/useOnboardingState.ts`** — the legacy `/onboarding` wizard hook flagged in F-EF-04 + F-OB-10-01 as ADR-0179-violating dead-but-mounted code. F-EF-04 is a separate sortie target.
5. **`gather-workspace-intelligence` is already internally service-role-signed** when calling its EF siblings (lines 67, 90 use `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`). Adding `verifyInternalAuth` to `web-search-intelligence` and `google-places-intelligence` will not break the live pipeline — those two have NO non-EF caller today.

---

## Precedent Inventory

| EF | Auth pattern | File | Notes |
|---|---|---|---|
| `bootstrap-cascade` | `verifyInternalAuth(req)` first action in `Deno.serve` | `supabase/functions/bootstrap-cascade/index.ts:183` | Canonical service-role-only pattern. `verify_jwt=false` + handler-level bearer check. |
| `engine-dispatch` | `verifyInternalAuth` | `supabase/functions/engine-dispatch/index.ts` | Same pattern. Also signs outbound HTTP API dispatches with HMAC-SHA-256. |
| `cleanup-sandbox-workspaces` | `verifyInternalAuth` | `supabase/functions/cleanup-sandbox-workspaces/index.ts` | Cron-style. |
| `journey-stuck-detector` | `verifyInternalAuth` | `supabase/functions/journey-stuck-detector/index.ts` | Cron-style. |
| `process-settlement-image` | `verifyInternalAuth` | `supabase/functions/process-settlement-image/index.ts` | Internal pipeline. |
| `validate-settlement` | `verifyInternalAuth` | `supabase/functions/validate-settlement/index.ts` | Internal pipeline. |
| `payroll-period-locked-handler` | `verifyInternalAuth` | `supabase/functions/payroll-period-locked-handler/index.ts` | Internal pipeline. |
| `workspace-api` (external) | `resolveAuth` (dual-auth, JWT + API key) | `supabase/functions/workspace-api/index.ts:82` | External-integration entry point, ADR-0077 dual-auth. Workspace context resolution required (line 102). |
| `stripe-webhook` | `stripe.webhooks.constructEventAsync` | `supabase/functions/stripe-webhook/index.ts` | Signature-verify pattern for external webhooks. |
| `sendgrid-webhook` | ECDSA P-256 signature verify | `supabase/functions/sendgrid-webhook/index.ts` | Signature-verify pattern for external webhooks. |
| `livekit-webhook` | LiveKit `WebhookReceiver` | — | Signature-verify pattern for external webhooks. |

**Shared helper:** `supabase/functions/_shared/internal-auth.ts:29`

```ts
export function verifyInternalAuth(req: Request): InternalAuthOk | InternalAuthFail {
  // Accepts: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OR Bearer ${WATCHDOG_CRON_SECRET}
  // Returns: { ok: true } | { ok: false, response: 401|500 }
}
```

Used by 7 production EFs today. Zero net-new infrastructure.

---

## Recommendation

**Chosen model: Option 2 — Internal-bearer via existing `verifyInternalAuth()` helper.**

- Apply `verifyInternalAuth(req)` as the first action inside `Deno.serve` in all 5 EFs (after CORS preflight, before body parse).
- Keep `verify_jwt = false` in `config.toml` (no change). Auth enforced in handler.
- No new secret needed today — reuses `SUPABASE_SERVICE_ROLE_KEY` (server-to-server) + `WATCHDOG_CRON_SECRET` (operator/cron).
- `gather-workspace-intelligence` is the single external entry point; it already calls its two sub-EFs (`web-search-intelligence`, `google-places-intelligence`) with `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` (lines 67, 90), so the EF-to-EF chain Just Works post-wrap.
- All future legitimate callers will be **Vercel route handlers** (per ADR-0179 §Mutation Surface) — those forward `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` via `supabase.functions.invoke()` from server context. Pattern matches `apps/web/src/app/api/engine-dispatch/route.ts` (the canonical proxy template named in ADR-0179).

**Why not the other three options:**

- **HMAC shared secret (Option 1):** New secret (`INTELLIGENCE_EF_HMAC_SECRET`) for no functional gain. We already have a working bearer-secret precedent. HMAC's replay protection is overkill for an internal-network bearer that rotates with `SUPABASE_SERVICE_ROLE_KEY`. Would diverge from the 7-EF precedent and force re-implementation of timestamp + replay logic per L-0176 audit hygiene.
- **Signed proxy header / short-TTL JWT (Option 3):** Adds JWT signing overhead to every call from BFF → EF for a defense that is identical to bearer-in-Authorization-header in this context (same TLS hop, same risk surface). Premature optimization until ADR-0123 tripwire forces an `identity-api` gateway.
- **Route through workspace-api gateway (Option 4):** Architectural mismatch. ADR-0029 §Mutation-Surface table classifies "external API gateway" as `workspace-api`'s scope, but these five EFs proxy **external services** (Scrapling/Brreg/Serper/Google) for **pre-workspace flows**. `workspace-api` (`auth-middleware.ts:102`) hard-requires `auth.workspaceId` — onboarding callers have no workspace yet. Forcing the merge would either (a) require gateway changes to `resolveAuth` (L effort, ADR-0123 amendment territory) or (b) post-date the closure of F-EF-03 indefinitely. Out of scope for a HIGH-severity money-vector fix.

---

## Council needed? **NO.**

**Reason:** The precedent is unambiguous — 7 production EFs use `verifyInternalAuth()` exactly as proposed; one shared helper; no new secret class; no new ADR required (the pattern is implicit in ADR-0029 + ADR-0179 §Mutation Surface Selection — "Server-internal scheduled work → Service role → Edge Function or pg_cron"). The legacy browser caller (F-EF-04) is **already a separately tracked sortie**; T2 of this sortie is intentionally scoped to NOT migrate that caller. Adding auth here is a no-regret hardening that closes the money vector immediately and leaves F-EF-04 as the orderly follow-up.

T2 proceeds with the internal-bearer model.

---

## Implementation Outline (T2 scope)

File-by-file changes T2 will make:

1. **`supabase/functions/gather-workspace-intelligence/index.ts`**
   - Add `import { verifyInternalAuth } from "../_shared/internal-auth.ts";`
   - Inside `Deno.serve`, immediately after the `OPTIONS` preflight branch, add:
     ```ts
     const authResult = verifyInternalAuth(req);
     if (!authResult.ok) return authResult.response;
     ```
   - Remove the "optional auth" comment block at lines 136–139 and the unused `supabaseClient.auth.getUser()` call (no longer needed — auth is enforced at the perimeter; user context for `provision_onboarding_workspace` flows from the caller's request body, not from JWT). **Verify with steward before deleting; this is a behavior change for any legacy caller that relied on `if (user)` branching.** If steward flags risk, leave the user-detection block in place — it becomes dead code but not unsafe.
   - Replace inline `corsHeaders` with `getCorsHeaders(req)` to address F-EF-06 (deferred to a different sortie unless trivially inline).

2. **`supabase/functions/google-places-intelligence/index.ts`**
   - Same import + `verifyInternalAuth` gate at top of `Deno.serve`.
   - No other code changes.

3. **`supabase/functions/web-search-intelligence/index.ts`**
   - Same import + `verifyInternalAuth` gate at top of `Deno.serve`.
   - Local `corsHeaders` object at lines 3–6 → optionally replace with `_shared/cors.ts` import (deferred to F-EF-06 sortie).

4. **`supabase/functions/scrape-website/index.ts`**
   - Same import + `verifyInternalAuth` gate at top of `Deno.serve`.
   - No other code changes.

5. **`supabase/functions/search-brreg/index.ts`**
   - Same import + `verifyInternalAuth` gate at top of `Deno.serve`.
   - No other code changes.

6. **`supabase/functions/_shared/internal-auth.ts`** — no changes. Reuse as-is.

7. **Telemetry** (S5 acceptance criterion): on rejection, optionally `console.warn("[<ef-name>] auth_failure: missing or invalid bearer")`. Edge runtime cannot import `@smartout/telemetry`, so structured telemetry via `emit()` is impossible per ADR-0045 / ADR-0179. Log line is sufficient; PostHog ingestion of the EF log stream is out of scope.

8. **`config.toml`** — no changes. `verify_jwt = false` stays. Auth enforced at handler.

---

## Caller-Side Impact

| Caller | Impact | Action |
|---|---|---|
| `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:433, 585, 657` | **Will break post-T2** — browser bearer is anon-key, not service-role. Calls will start returning 401. | Acceptable per F-EF-04 scope: this is the legacy `/onboarding` wizard, already flagged ADR-0179-violating + ADR-0041 dead-code in F-OB-10-01. Live signup uses `/join` which goes via BFF and does NOT touch these EFs. T2 should NOT migrate this caller — F-EF-04 owns it. T2 should add an inline comment in the EF body pointing to F-EF-04 for any operator who hits a 401 in dev. |
| `apps/web/src/app/api/workspace-intelligence/route.ts` (live `/join`) | None — does not call any of the 5 EFs. | Verified by grep. |
| `apps/web/src/app/api/scrape/{brreg,company,public,raw}/route.ts` | None — calls scrapling droplet direct. | Verified by grep. |
| `apps/web/src/app/platform-admin/health/_components/api-registry.ts:356, 419` | Display-only registry already lists `auth: "service-role"` — now true at runtime. | No code change. Aligns docs with reality. |
| `apps/landing/src/app/docs/api/page.tsx:1984–2002` | Docs page listing intelligence EFs. | T3 may update auth-column to reflect `service-role` requirement; non-blocking. |
| `packages/ai/src/tools/intelligence/*` | None — calls Brreg API directly, not the EF. | Verified. |

**Net browser-side impact:** zero on live `/join` path. Legacy `/onboarding` already broken in spirit (ADR-0179) and will return 401 at the EF layer — surfaces the brokenness instead of silently leaking quota.

---

## New Secrets Needed

**NONE.** Reuses existing 1Password references:

- `op://smartout_ai/Supabase/SUPABASE_SERVICE_ROLE_KEY` (already populated; used by server-to-server callers via `supabase.functions.invoke` from Node route handlers)
- `op://smartout_ai/SmartOut/watchdog_cron_secret` (already populated; used by cron/operator paths)

No new secret to provision, rotate, or audit.

---

## Tests to Add (T5 scope)

| Test | Type | Surface | Falsifiable signal |
|---|---|---|---|
| Anonymous POST to each of the 5 EFs returns 401 | curl smoke (T5 manual) | `/functions/v1/<ef-name>` | `HTTP/1.1 401 Unauthorized` + body `{"error":"unauthorized"}` |
| POST with `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` returns 200 (or proper 400 on missing body params) | curl smoke (T5 manual) | same endpoints | Status != 401, response shape matches existing contract |
| Internal EF-to-EF chain still works: `gather-workspace-intelligence` → `web-search-intelligence` + `google-places-intelligence` | Integration test (Deno test or live curl on local supabase) | `gather-workspace-intelligence` | Pipeline completes phase A2 + phase C without `auth_failure` log line |
| Browser invoke from `useOnboardingState.ts` now returns 401 (regression-confirmation, not pass-test) | Playwright spec in `apps/e2e/onboarding/legacy-unauth.spec.ts` (optional) | dev `/onboarding` wizard | `gather-workspace-intelligence` invocation surfaces 401 in network panel — proves perimeter is closed; legacy caller migration tracked separately in F-EF-04 |
| pgTAP / DB test: confirm `config.toml` still has `verify_jwt = false` for all 5 (no accidental upgrade to JWT-mode which would break legitimate service-role callers — service-role bearer is not a Supabase JWT) | grep test in CI or hand-check | `supabase/config.toml` lines 466–475, 559, 571 | Lines unchanged |
| vitest unit test on `_shared/internal-auth.ts` happy/sad paths (if not already covered) | vitest in CI | — | Existing helper, may already be tested; T5 checks first |

S5 acceptance criterion (`edge_function.auth_failure` telemetry emit) is **not feasible from inside an Edge Function** per ADR-0045 + ADR-0179 — Edge cannot import `@smartout/telemetry`. T2 will log via `console.warn` only; T3 updates audit synthesis to reflect this constraint. If operator-visible auth-failure metric is required, it goes through Supabase log-drain → PostHog ingestion (separate sortie, out of scope).

---

## Forward References

- F-EF-04 (separate sortie): migrate `/onboarding` browser caller off direct `invokeEdgeFunction` for `gather-workspace-intelligence`, `search-brreg`, `scrape-website` to a Next.js route handler. After T2 lands, this caller returns 401 — operator-visible signal that the migration is overdue.
- F-EF-06 (separate sortie / sweep): CORS hardcoded `*` cleanup across 22+ EFs including `web-search-intelligence`. T2 should NOT bundle this unless trivially adjacent.
- F-OB-10-01 (separate sortie): delete `/onboarding` legacy wizard files. Resolves F-EF-04 as a side effect.
- ADR-0123 tripwire: this sortie does **not** add a 3rd pre-workspace standalone EF (these 5 are not pre-workspace exception candidates — they should be Node route handlers per ADR-0179). No `identity-api` gateway ADR triggered.

---

## Deliverables Summary (T1)

- This brief: `docs/plans/PLAN-audit-fef03-auth-design.md`
- No code changes (read-only by T1 contract)
- T2 unblocked: proceed with internal-bearer model using existing `verifyInternalAuth()` helper
- No council escalation required

> Registered in `0000-decision-log.md`? No — this is a design brief, not an ADR. T3 will decide whether the auth-perimeter decision warrants its own ADR; if so, it documents an application of ADR-0029 + ADR-0179, not a new direction.
