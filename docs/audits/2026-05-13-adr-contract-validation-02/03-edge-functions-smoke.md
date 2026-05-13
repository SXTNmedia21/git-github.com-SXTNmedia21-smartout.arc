---
title: Edge Functions Smoke Audit — Wave-1 Closure Verification
status: done
created: 2026-05-13
updated: 2026-05-13
module: audit
tags: [audit, smoke, edge-functions]
---

# Edge Functions Smoke Audit (Slice 03 of 3)

Read-only smoke audit verifying wave-1 closure of **F-EF-03** (5 intelligence Edge Functions previously open-internet POST with `verify_jwt = false` + zero auth — a money/abuse vector). Bonus check on **F-EF-02a** (browser invokes `ingest-workspace-knowledge`) and **F-EF-04** (legacy `/onboarding` directory invokes 3 EFs from browser) post-Sortie-B.

## Wave-1 closure verification

Pattern verified per spec:
1. `import { verifyInternalAuth } from "../_shared/internal-auth.ts"` present.
2. Inside `Deno.serve(async (req) => {`, OPTIONS preflight preserved.
3. `verifyInternalAuth(req)` is first-action after OPTIONS, before any business logic.
4. `authResult.ok` check returns `authResult.response` on failure.
5. `console.warn("[<ef-name>] auth_failure: missing or invalid bearer")` logged.
6. `config.toml` retains `verify_jwt = false` (intentional — auth at handler).

| EF | Import line | Serve | OPTIONS | Auth call | Warn | config.toml | Verdict |
|---|---|---|---|---|---|---|---|
| `gather-workspace-intelligence/index.ts` | L4 | L114 | L115 | L122 | L124 | `verify_jwt = false` (line 466) | PASS |
| `google-places-intelligence/index.ts` | L3 | L35 | L36 | L42 | L44 | `verify_jwt = false` | PASS |
| `web-search-intelligence/index.ts` | L2 | L216 | L217 | L223 | L225 | `verify_jwt = false` | PASS |
| `scrape-website/index.ts` | L3 | L39 | L40 | L47 | L49 | `verify_jwt = false` | PASS |
| `search-brreg/index.ts` | L3 | L6 | L7 | L14 | L16 | `verify_jwt = false` | PASS |

`_shared/internal-auth.ts` confirmed: exports `verifyInternalAuth(req)`, accepts `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` OR `Bearer ${WATCHDOG_CRON_SECRET}`, fail-closed (500 if neither secret configured), 401 on header mismatch, CORS preserved on both paths.

**F-EF-03 verdict: PASS — 5/5 EFs have auth first-action. Money/abuse vector closed.**

## Bonus check: F-EF-02a / F-EF-04 status post-Sortie-B

**F-EF-02a — STILL OPEN (HIGH, ADR-0179).** `apps/web/src/app/dashboard/setup/wizard-definition.ts` is still on disk with `"use client"` at line 1, `invokeEdgeFunction` import at line 24, and the offending `void invokeEdgeFunction(supabase, "ingest-workspace-knowledge", {...})` at line 295. Sortie B explicitly out-of-scope (T1 deletion map only covered legacy scroll-wizard; this file is part of the KEEP_LIVE 27-file roster). The Sortie B verification report self-flags this exact gap. Fix path unchanged: move K1b trigger into Next.js route handler per ADR-0179.

**F-EF-04 — CLOSED.** Sortie B deleted `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` (was the violation locus: lines 433, 585, 657 invoking `gather-workspace-intelligence`, `search-brreg`, `scrape-website` from browser). Confirmed absent. Remaining references in `onboarding/types.ts:149` and `onboarding/lib/data-merger.ts:16` are doc comments only, not live invocations. Browser → EF blast radius for the legacy `/onboarding` scroll wizard is gone.

## New findings

**NEW CRITICAL: 0**
**NEW HIGH: 0**

Spot-checked 8 other `verify_jwt = false` EFs (`finalize-workspace`, `activate-workspace`, `fire-delayed-triggers`, `emma-task-trigger`, `analyze-setup-documents`, `bootstrap-cascade`, `leader-pulse`, `guardian-sweep`) for new unauthed exposures:

- `bootstrap-cascade` — already uses `verifyInternalAuth` (L15, L183). Good.
- `guardian-sweep` — uses inline `WATCHDOG_CRON_SECRET` bearer compare (functionally equivalent; pre-dates shared helper). Acceptable but candidate for refactor to shared helper (LOW, not new).
- `finalize-workspace` — uses `supabaseClient.auth.getUser()` against client Authorization header (user-context auth). Acceptable for browser-callable workspace setup (pre-workspace-state-transition).
- `leader-pulse` — handler not inspected beyond head; if cron-only, would need cron-secret check. Pre-existing baseline question, not introduced by wave-1.

No NEW unauthed endpoints introduced by the wave-1 patch series. Wave-1 added auth checks (additive, no removals). No regression detected on adjacent EFs.

## Summary

**PASS.**

- F-EF-03 (5 intelligence EFs): **CLOSED.** Pattern uniformly applied — import + Deno.serve + OPTIONS preserved + verifyInternalAuth first-action + auth_failure warn — across all 5 target files. `config.toml` correctly retains `verify_jwt = false` since auth is enforced at handler. Shared helper is fail-closed and accepts both service-role and cron-secret bearers, which matches the use case (server-side `supabase.functions.invoke` from BFF + pg_cron schedulers).
- F-EF-04 (legacy `/onboarding` browser→EF): **CLOSED** as collateral benefit of Sortie B file deletions.
- F-EF-02a (`wizard-definition.ts:295` browser invokes `ingest-workspace-knowledge`): **STILL OPEN.** Not in F-EF-03 scope; separate remediation needed (ADR-0179 — move to route handler).
- No NEW CRITICAL or HIGH findings on edge-functions surface.

Wave-1 patch shipped clean. Smoke audit slice 03 PASS.
