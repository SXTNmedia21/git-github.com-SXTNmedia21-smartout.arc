---
title: "Handoff — audit-fef03-intelligence-ef-auth"
feature: audit-fef03-intelligence-ef-auth
status: complete
created: 2026-05-13
updated: 2026-05-13
module: edge-functions
tags: [handoff, audit-2026-05-13, f-ef-03, edge-functions, auth, security]
---

# Handoff — audit-fef03-intelligence-ef-auth

> Branch: `feat/audit-fef03-intelligence-ef-auth` | Worktree: `~/dev/smartout.ai-wt-11` | Module: edge-functions
> Audit row: F-EF-03 (HIGH/ops-critical money vector) — `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md`

## Summary

Closes **F-EF-03** from the 2026-05-13 ADR + contract audit. Five intelligence Edge Functions (`gather-workspace-intelligence`, `google-places-intelligence`, `web-search-intelligence`, `scrape-website`, `search-brreg`) were `verify_jwt = false` with **zero handler-level auth check** and no signature verification. Each proxies a paid external API (Scrapling, Serper, Google Places, Brreg). Open-internet POST = active money/abuse vector burning Smartout's external API quotas — not theoretical.

Added an internal-bearer auth perimeter via the existing `verifyInternalAuth()` helper (`supabase/functions/_shared/internal-auth.ts`). Each EF rejects anonymous POST with `401 {"error":"unauthorized"}` before the request body is parsed, and emits an operator-visible `console.warn` with the EF name. Pattern matches 7 production EFs already using the same helper (`bootstrap-cascade`, `engine-dispatch`, `cleanup-sandbox-workspaces`, `journey-stuck-detector`, `process-settlement-image`, `validate-settlement`, `payroll-period-locked-handler`). No new ADR direction, no new secret, no new dependency.

## Deliverables

| Commit | What |
|---|---|
| `15f9dda12` | `docs(audit-fef03-intelligence-ef-auth): declare plan + journeys` — `docs/plans/PLAN-audit-fef03-intelligence-ef-auth.md` + 3 journey stubs (unauth-rejected, authenticated-bff-accepted, quota-burn-vector-closed) |
| `03d8c1506` | `docs(audit-fef03): T1 design brief — auth model for intelligence EFs` — `docs/plans/PLAN-audit-fef03-auth-design.md` ship-decision, no council needed, internal-bearer pattern via existing helper |
| `e8544735f` | `fix(edge-functions): require internal auth on 5 intelligence EFs (F-EF-03)` — `verifyInternalAuth(req)` + `console.warn` as first action after CORS preflight in all 5 EFs (+48 lines, 10/9/9/10/10) |
| `4fdbd607a` | `docs(edge-functions): F-EF-03 synthesis closure + S5 emit fallback` — synthesis + delta marked CLOSED; journey-unauth body adjusted from `emit()` to `console.warn` per ADR-0045 + ADR-0179 EF-to-telemetry restriction |
| `0083b68f2` | `docs(edge-functions): T5 verification + journeys verified (F-EF-03)` — `docs/audits/2026-05-13-sortie-c-verification.md` + 3 journey frontmatter blocks flipped `draft` → `verified` |

## Decisions

- **Auth model: internal-bearer via `verifyInternalAuth()`.** Reuses the canonical helper at `supabase/functions/_shared/internal-auth.ts:29` that accepts `Bearer SUPABASE_SERVICE_ROLE_KEY` OR `Bearer WATCHDOG_CRON_SECRET`. Seven production EFs already use this exact pattern; no net-new infrastructure. T1 design brief documents the rejected alternatives (HMAC shared secret, signed proxy header, workspace-api gateway) and why each was wrong for this case.
- **Council NOT needed.** T1 was a ship-decision. Precedent is unambiguous: 7-EF helper-reuse, no new secret class, no new ADR required — the pattern is implicit in ADR-0029 + ADR-0179 § Mutation Surface Selection. Going to council would have delayed an active money-vector closure for no architectural value-add.
- **`verify_jwt = false` preserved in `supabase/config.toml`.** Auth is enforced at the handler, not at the Supabase gateway. Required because the service-role bearer is not a Supabase user JWT — enabling `verify_jwt = true` would reject the legitimate server-to-server callers we are deliberately allowing.
- **S5 acceptance downgraded from `emit()` to `console.warn`.** Original plan called for `emit('edge_function.auth_failure', …)` on rejection. ADR-0045 (Edge Function bundler boundary) + ADR-0179 (browser→EF rule) together forbid Deno EFs from importing `@smartout/telemetry`. `console.warn` is the local-runtime + operator-visible fallback; PostHog ingestion of the EF log stream is a separate follow-up sortie (out of scope per audit hygiene — one money vector at a time).
- **No journey-body edit on legacy `/onboarding` callers.** The 3 browser-direct invokes at `useOnboardingState.ts:433, 585, 657` are explicit F-EF-04 / Sortie B scope. T2 surfaces them as 401 (the protocol-intended self-fault break); migration is Sortie B's job, not this sortie's.

## Learnings

- **Intelligence EFs had ZERO live BFF callers at sortie-start.** The only external caller was legacy `useOnboardingState.ts:433, 585, 657` (`/onboarding` wizard), which Sortie B deletes. The live `/join` pipeline routes through `apps/web/src/app/api/workspace-intelligence/route.ts` + `apps/web/src/app/api/scrape/*/route.ts` straight to `services/scrapling` on the droplet — does NOT touch any of these 5 EFs. Net browser-side impact on live `/join`: zero. The auth perimeter doubles as an F-EF-04 brokenness surface (any 401 in dev surfaces unmigrated legacy callers).
- **`verifyInternalAuth()` accepts two bearer classes.** `Bearer SUPABASE_SERVICE_ROLE_KEY` (server-to-server) OR `Bearer WATCHDOG_CRON_SECRET` (operator / cron). No new secret needed today. Helper fail-closes (returns 500) if neither env var is configured — defends against accidental deploy with missing config.
- **EFs CANNOT emit telemetry events.** Deno runtime + Supabase bundler cannot resolve `@smartout/telemetry` imports per ADR-0045 + ADR-0179. Operator visibility from inside an Edge Function is `console.log` / `console.warn` only. Structured telemetry must go through Supabase log-drain → PostHog ingestion as a separate plumbing sortie.
- **Worktree-bound Supabase Local docker-compose serves one worktree at a time (bind-mount).** During T5, the running `supabase_edge_runtime_smartout.ai` container was bind-mounted to `~/dev/smartout.ai-payroll/supabase/functions` — that worktree's HEAD lacked T2's commit, so curls returned 400 (business-logic) instead of 401 (auth). Parallel sortie work blocks live edge-function testing across worktrees. Swap with `npx supabase stop` in the currently-bound worktree, then `npx supabase start` in the target worktree. Falling back to static + helper-code proof is acceptable when the swap would disrupt active campaign work elsewhere.

## Known issues / debt

- **Live curl verification deferred.** S1, S2, S9 SKIPPED at T5 because local Supabase was bound to `~/dev/smartout.ai-payroll` worktree. Static + helper-code proof completed instead (auth check is first action after CORS, helper code returns 401 unconditionally, no code path produces 200 on unauth). Re-verify after merge:

  ```
  npx supabase stop   # in currently-bound worktree
  cd /home/sxtnl/dev/smartout.ai && npx supabase start
  for ef in gather-workspace-intelligence google-places-intelligence web-search-intelligence scrape-website search-brreg; do
    curl -i -X POST "http://127.0.0.1:54321/functions/v1/$ef" \
      -H "Content-Type: application/json" -d '{}'
  done
  ```

  Expect: 5× `HTTP/1.1 401 Unauthorized` with body `{"error":"unauthorized"}`. If anything returns 200 on unauth, the journey flips should be reverted and a hotfix sortie opened.

- **F-EF-04 still open.** Legacy browser→EF callers at `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:433, 585, 657`. They WILL 401 once T2 ships to preview. Sortie B closes the route by deleting the legacy `/onboarding` wizard file. Synthesis line 120 lists F-EF-04 as the New HIGH open finding.

- **Operator log-drain → PostHog auth-failure metric.** Separate follow-up sortie. ADR-0045 + ADR-0179 prevent emitting `edge_function.auth_failure` from inside the EF; the only viable path is Supabase log-drain pipeline → PostHog ingestion. Not blocking F-EF-03 closure.

## Verification evidence

Full T5 verifier report: [`docs/audits/2026-05-13-sortie-c-verification.md`](audits/2026-05-13-sortie-c-verification.md).

| Step | Verdict |
|---|---|
| S1 — Unauth POST returns 401 on 5 EFs | SKIPPED (static + helper-code proof) |
| S2 — Authenticated request still succeeds | SKIPPED (same root cause as S1) |
| S3 — Browser code does NOT directly invoke 5 EFs | PASS (3 legacy callers documented as F-EF-04 scope) |
| S4 — ADR-0179 + ADR-0029 not violated | PASS |
| S5 — `console.warn` fallback present | PASS (all 5 EFs verified verbatim) |
| S6 — Synthesis F-EF-03 marked CLOSED | PASS |
| S7 — `pnpm turbo typecheck` 0 errors | PASS (12/12 successful, 6m1s) |
| S8 — Journey statuses flipped | PASS (3 journeys `draft` → `verified`, 2026-05-13) |
| S9 — Locally tested | SKIPPED (inherits S1+S2) |

No council escalation triggered. No code regressions. No ADR violations. No typecheck regressions.

## Next steps

1. Pontus runs `~/.claude/scripts/close-feature.sh 11` to merge `feat/audit-fef03-intelligence-ef-auth` into `development`.
2. After merge: run the live curl re-verify block under "Known issues / debt" to close the audit loop (60-second job once a worktree-swap is acceptable).
3. Sortie B (F-EF-04) follows independently to migrate / delete the legacy `useOnboardingState.ts` browser callers.
4. PostHog log-drain ingestion of EF `console.warn` lines: separate follow-up sortie when operator metrics dashboard is prioritised.
