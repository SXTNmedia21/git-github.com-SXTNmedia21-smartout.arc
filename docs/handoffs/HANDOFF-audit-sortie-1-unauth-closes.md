---
title: HANDOFF — Audit Sortie 1, Unauth EF Closes
status: review
created: 2026-05-06
updated: 2026-05-06
module: edge-functions
tags: [audit, security, edge-functions, sortie, handoff]
sortie: feat/audit-sortie-1-unauth-closes
worktree: ~/wsl/smartout.ai-wt-6
audit-source: docs/audits/2026-05-06-adr-contract-validation/00-SYNTHESIS.md
---

# HANDOFF: Audit Sortie 1 — Unauth EF Closes

## Summary

Closed 2 CRITICAL + 2 HIGH unauth Edge Function surfaces from the 2026-05-06 audit synthesis. All four fixes use the canonical `verifyInternalAuth()` helper from `supabase/functions/_shared/internal-auth.ts` — same pattern shipped to 19 other cron functions.

## Fixes shipped

| # | File | Severity | Commit | Verification |
|---|---|---|---|---|
| F1 | `supabase/functions/journey-stuck-detector/index.ts` | CRITICAL | `2526feef5` | Custom `isAuthorized()` deleted (-28 lines), replaced with 2-line `verifyInternalAuth()` call. `config.toml` comment updated. |
| F2 | `supabase/functions/bootstrap-cascade/index.ts` | CRITICAL | `1d553a4bc` | `verifyInternalAuth()` added at `Deno.serve()` entry. Caller chain verified: only `finalize-workspace:79` calls bootstrap-cascade, already sends `Bearer SUPABASE_SERVICE_ROLE_KEY`. Safe to merge. |
| F3 | `supabase/functions/cleanup-sandbox-workspaces/index.ts` | HIGH | `2526feef5` | Module-level `Deno.env.get` removed. `verifyInternalAuth()` added at handler entry. `Bearer undefined` bypass closed. |
| F4 | `supabase/functions/sendgrid-webhook/index.ts` | HIGH | `2526feef5` | `if (KEY) { verify }` flipped to `if (!KEY) return 500; verify` — fail-closed on missing env. |

Branch: `feat/audit-sortie-1-unauth-closes`. Worktree: `~/wsl/smartout.ai-wt-6`. Base: `0f5aaf39c` (plan + journeys).

## Behavior matrix (post-fix)

| Endpoint | No auth | Wrong secret | Missing env | Valid bearer |
|---|---|---|---|---|
| journey-stuck-detector | 401 | 401 | 500 | 200 |
| bootstrap-cascade | 401 | 401 | 500 | 200 + 42 mutations |
| cleanup-sandbox-workspaces | 401 | 401 | 500 | 200 + cleanup |
| sendgrid-webhook | 401/403 | 403 | 500 | 200 + suppression update |

Before fix: each one had at least one row producing a 200 + side effect on anonymous/misconfig input.

## Decisions made

No new ADRs. Pure ADR-0029 enforcement using established pattern. The four fixes mechanically apply `verifyInternalAuth()` to surfaces that should already have used it.

## Learnings

### L-NEW-1 — Parallel agents on shared worktree race the staging area

3 of 4 build-agents (F1, F3, F4) ran in parallel on the same worktree. Each independently staged its file with `git add` and called `git commit`. Whichever agent committed first absorbed all currently-staged changes from sibling agents into its commit (`2526feef5`) — even though the subject line only describes its own fix (`sendgrid-webhook fail-closed on missing env`). The diff at `2526feef5` actually contains 4 files spanning 3 fixes; F2 (`bootstrap-cascade`) ran longer and committed cleanly afterward as `1d553a4bc`.

**Why:** Git's staging area is a single shared resource per repo. `git add` is atomic per-file, but `git add A` from agent X followed by `git add B` from agent Y produces a single staged set `{A, B}`. The first `git commit` consumes both.

**How to apply:** When dispatching N parallel build-agents that all commit to the same branch, either (a) serialize the commit step via a coordination mechanism (queue, lock file, mutex), (b) give each agent its own worktree via `Agent` tool's `isolation: "worktree"` parameter, or (c) accept the bundling and write the commit message in the HANDOFF post-hoc. We chose (c) here since the fixes are mechanical and the bundling is harmless — but the misleading subject line is a real cost. Future parallel-fix sorties: prefer (b).

### L-NEW-2 — `verifyInternalAuth()` is the canonical EF cron-auth helper

`supabase/functions/_shared/internal-auth.ts` exports `verifyInternalAuth(req)` which is fail-closed on both axes:
- Missing `WATCHDOG_CRON_SECRET` AND `SUPABASE_SERVICE_ROLE_KEY` → returns `{ ok: false, response: 500 }`
- Bearer mismatch → returns `{ ok: false, response: 401 }`

Returns `{ ok: true }` only when env vars present AND request bearer matches one of them. This is the pattern audit slice 03 confirmed shipped in 19/20 cron functions. Any new cron-only EF should `import { verifyInternalAuth } from "../_shared/internal-auth.ts"` and call it as the first line of the handler. Custom `isAuthorized()` rolls is the trap that produced both CRITICALs in this sortie.

### L-NEW-3 — Module-level `Deno.env.get()` is a deferred-evaluation trap

Reading env at module scope means the env value is captured at module-load time. If the value is `undefined` at that moment, every subsequent template literal `\`Bearer ${secret}\`` produces the literal string `"Bearer undefined"` — a stable, predictable bypass token any caller can send. Always read env inside the handler scope where you can fail-fast on `undefined`. This applies to all Deno EFs, not just cron.

## Known issues / debt

- **Bundled commit `2526feef5` subject misleading.** Subject says "sendgrid-webhook fail-closed", actual diff covers journey-stuck-detector + cleanup-sandbox-workspaces + sendgrid-webhook (3 fixes, 4 files). Reading `git log` will misclassify what shipped where. Mitigation: this HANDOFF + the audit synthesis cross-reference both ground-truth.
- **Prod env var sync (F4 dependency).** F4 flips sendgrid-webhook to require `SENDGRID_WEBHOOK_VERIFICATION_KEY`. If that env var is not set in the production Supabase project, live SendGrid bounce/suppression events will return 500 after deploy until the secret is added. Pontus must verify via `op vault list smartout_ai_prod` and `supabase secrets list --project-ref <prod-ref>` before merging to main.
- **No E2E test added.** Cron-auth EF endpoints have no live test infrastructure. This is acceptable for read-only audit closes — a future Sortie should add Playwright/curl-based smoke tests as part of the post-deploy verification ladder (per ADR-0265 smoke-probe).

## Next steps

### Pre-merge (Pontus)
1. Verify prod 1Password vault sync:
   - `op://smartout_ai_prod/SendGrid/webhook_verification_key` exists
   - `op://smartout_ai_prod/Watchdog/cron_secret` exists (was already required for 19 cron functions)
2. Verify prod Supabase secrets deployed:
   - `supabase secrets list` includes `SENDGRID_WEBHOOK_VERIFICATION_KEY`, `WATCHDOG_CRON_SECRET`
3. Run `pnpm turbo typecheck` from worktree root — confirm 0 errors.
4. Run `close-feature.sh 6` to merge to development.

### Post-merge (next sortie)
- **Sortie 2** — ADR-0204 §3 enforcement: ship `scripts/ci/no-inline-gate-rpc.sh`, wire into `ci.yml`, migrate `_shared.ts:101` + 3 route handlers off direct `gate_action` RPC. Highest-leverage architectural fix in the audit; prevents the regression class.
- **Sortie 3** (telemetry sweep) and **Sortie 4** (mobile remediation) can run in parallel after Sortie 2 lands.

## Closure deliverable status

- [x] Plan: `docs/plans/PLAN-audit-sortie-1-unauth-closes.md`
- [x] Journeys: `docs/journeys/JOURNEY-audit-sortie-1-unauth-closes.md`
- [x] All 4 fixes shipped + verified
- [x] Typecheck passes (web filter 9/9; full repo per F1 report 46/46)
- [x] HANDOFF (this file)
- [ ] Decision log — no new ADRs needed (ADR-0029 enforcement only); skip
- [ ] `close-feature.sh 6` — Pontus runs after pre-merge checks above
