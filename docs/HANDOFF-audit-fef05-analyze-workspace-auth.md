---
title: "Handoff — F-EF-05 analyze-workspace auth gate"
feature: audit-fef05-analyze-workspace-auth
status: done
created: 2026-05-14
updated: 2026-05-14
module: onboarding
tags: [handoff, audit, edge-function, auth, f-ef-05, adr-0029]
---

# Handoff — F-EF-05 analyze-workspace auth gate

## Summary

F-EF-05 (HIGH severity) — `supabase/functions/analyze-workspace/index.ts` had `verify_jwt=false`
with no auth gate, no `getUser()` call, and direct `onboarding_session` writes with only RLS as
protection. Anon callers could inject rows if RLS had any weakness.

**Fix:** `verifyInternalAuth` from `_shared/internal-auth.ts` added at handler entry point (before
any try-block or DB access). DB client switched from anon key to service-role key. Body input
validated (sessionId type-guard). 5 Deno tests added. Web typecheck 0 errors.

## Caller Context Decision (S1)

**Determined: server-internal (post-workspace-provisioning), NOT pre-workspace.**

Evidence:
1. Zero active callers in `apps/web/src/` — only `platform-admin/health/_components/api-registry.ts:311`
   references it, classified as `auth: "service-role"`.
2. `packages/Botsson/blueprints/api-surface.md` documents it as `Auth: JWT (user context)`.
3. `onboarding_session` RLS: `auth.uid() = user_id` — requires authenticated user, no anon INSERT.
4. The `/join` flow (current, live) does NOT call `analyze-workspace`. It uses the `completeSignup()`
   server action → `provision_onboarding_workspace` RPC directly.
5. The `/onboarding` wizard (legacy) also has no `functions.invoke("analyze-workspace")` call.
6. The function body is a mock AI placeholder — never shipped live to any UI caller.

**ADR-0123 pre-workspace exception:** does NOT apply. Pre-workspace exceptions require token-as-auth
(no JWT possible, e.g. `accept-invitation`). `analyze-workspace` is meant to be server-internal,
not a browser-direct endpoint.

## Fix Path Chosen: service-role verifyInternalAuth (ADR-0029)

Same pattern as `gather-workspace-intelligence` (which had `verifyInternalAuth` added in F-EF-03 wave):
- `verify_jwt=false` in `config.toml` — retained (correct: service-role bearer, not JWT passthrough)
- `verifyInternalAuth(req)` called immediately on entry (before try-block)
- DB client uses `SUPABASE_SERVICE_ROLE_KEY` (was anon key — wrong for service-internal caller)
- Body parsed defensively with `.catch(() => null)` + type-narrowing
- `sessionId` validated as non-empty string before any DB operation

## Decisions Made

No new ADR required — this is an application of existing ADR-0029 (service-role gate pattern) and
explicitly confirms ADR-0123 does NOT extend to `analyze-workspace`. Decision registered here as
handoff note, not ADR (mechanical compliance fix, not architectural choice).

| Decision | Rationale |
|---|---|
| Keep `verify_jwt=false` in config.toml | Correct for service-role bearer pattern; `verify_jwt=true` would require browser JWT, which is wrong for server-internal callers |
| Use `verifyInternalAuth` not `resolveAuth` | Internal-auth accepts service-role + cron bearer; resolveAuth is for dual-auth (JWT + API key) workspace-scoped callers |
| Use service-role client for DB writes | anon client used in original was wrong; onboarding_session RLS requires auth.uid() match — service role bypasses RLS, appropriate for server-internal writes |
| No RLS migration needed | onboarding_session RLS is already JWT-scoped (`auth.uid() = user_id`); not blanket anon INSERT. No schema change required. |
| Source-parsing Deno test pattern | Avoids Deno.serve import complexity; same pattern as livekit-webhook/hygiene_test.ts; tests are portable and run without env vars |

## Learnings

**L-XXXX: analyze-workspace had no active callers.** The function is a mock AI placeholder that was
shipped as infrastructure but never wired to any UI. The platform-admin health registry was the only
reference, marked `auth: "service-role"`. Audit correctly flagged it — RLS gap was real. Fix was
mechanical once caller context was clear.

**L-XXXX: worktree stale dist pattern (again).** Web typecheck in fresh worktree failed on
`@smartout/journey-ir`, `@smartout/payroll-export`, `@smartout/payroll-calculate`, `@smartout/contracts` —
no dist/ directories. Fix: `pnpm --filter <pkg> build` for each. Same class as L-0190 / stale-telemetry-dist.
Pattern: any package without a `dist/` in the worktree needs explicit build before typecheck.

## Known Issues / Debt

- The function uses mock AI (placeholder `// Replace with actual Claude API call later`). When real
  Claude API is wired, the caller pattern (web BFF → service role) should stay the same — the BFF
  passes the service-role key, not the user JWT. The mock → real transition is a separate sortie.
- The `suggested_branding.slogan` used `scrapedData?.companyName` for the label — changed to use
  `safeCompanyName` (the typed string from the body payload). No functional difference since the
  field was `companyName` from `payload` either way.
- CORS headers still use inline `corsHeaders` constant (not `_shared/cors.ts`). This is F-EF-09
  (LOW) — a separate sweep, not in scope for this sortie.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/analyze-workspace/index.ts` | Auth gate (verifyInternalAuth), service-role client, body validation, ADR docstring |
| `supabase/functions/analyze-workspace/auth_test.ts` | New — 5 Deno source-parse tests |
| `docs/journeys/JOURNEY-audit-fef05-analyze-workspace-auth-anon-rejected.md` | status: verified, all checkboxes ticked |
| `docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md` | F-EF-05 marked CLOSED |
| `docs/HANDOFF-audit-fef05-analyze-workspace-auth.md` | This file |

## Next Steps

- [ ] Close feature: run `close-feature.sh` — Pontus runs this
- [ ] If/when analyze-workspace is wired to real Claude API: keep service-role caller pattern; add
  Zod validation on body fields; add rate limiting (the `_shared/rate-limit.ts` helper exists)
- [ ] F-EF-06 (MEDIUM, activate-workspace error.message leak) — next audit sortie candidate

## References

- Commit: `cda536405` on `feat/audit-fef05-analyze-workspace-auth`
- Finding: `docs/audits/2026-05-14-adr-contract-validation/03-edge-functions.md` — F-EF-05
- Synthesis: `docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md`
- ADR-0029: `docs/decisions/0029-workspace-api-gateway.md`
- ADR-0123: `docs/decisions/0123-adr-0029-amendment-pre-workspace-exceptions.md`
- Pattern reference: `supabase/functions/gather-workspace-intelligence/index.ts` (F-EF-03 fix)
- Internal auth: `supabase/functions/_shared/internal-auth.ts`
