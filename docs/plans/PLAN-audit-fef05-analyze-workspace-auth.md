---
title: "Plan — F-EF-05 analyze-workspace auth gate"
feature: audit-fef05-analyze-workspace-auth
status: draft
created: 2026-05-14
updated: 2026-05-14
module: onboarding
tags: [audit, edge-function, auth, F-EF-05, ADR-0029, ADR-0123]
---

# Plan — F-EF-05 analyze-workspace auth gate

## Source

`docs/audits/2026-05-14-adr-contract-validation/03-edge-functions.md` — F-EF-05 (HIGH).

## Finding

`supabase/functions/analyze-workspace/index.ts` — `verify_jwt=false`, no `getUser()` call, writes to `onboarding_session` without authentication. Only RLS protects against anon caller injecting rows.

## Root cause

EF shipped without explicit auth choice. Pattern violates ADR-0029 (Edge Function auth model) unless it qualifies for the ADR-0123 pre-workspace exception (workspace doesn't exist yet → no JWT possible).

## Decision tree

**Q1:** Is analyze-workspace called pre-workspace (during /join flow before workspace exists) or post-workspace (authenticated user)?

- Pre-workspace → ADR-0123 exception applies. Fix: add to pre-workspace allowlist + explicit ADR-0123 reference comment + scope-narrowed RLS (only allow INSERT on onboarding_session with matching session token).
- Post-workspace → No exception. Fix: `verify_jwt=true` in `config.toml` + `authenticateRequest` helper + reject anonymous.

**Method:** grep `analyze-workspace` callers in `apps/web/` to determine context. Likely `/join` route or onboarding wizard.

## S-acceptance (falsifiable)

| ID | Criterion |
|---|---|
| S1 | Caller context determined (pre-workspace vs post-workspace) — documented in handoff |
| S2 | Either `verify_jwt=true` + `authenticateRequest` OR explicit ADR-0123 allowlist with comment referencing ADR |
| S3 | If pre-workspace: RLS on `onboarding_session` scoped to session-token (not blanket anon INSERT) |
| S4 | Vitest/Deno: anon call without proper credential → 401/403 |
| S5 | Vitest/Deno: legitimate call still works (golden path) |
| S6 | `verify_jwt` config matches handler expectation (no contradiction) |
| S7 | F-EF-05 marked CLOSED in `docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md` with commit SHA |
| S8 | Journey verified |
| S9 | Handoff written |

## Council escalation triggers

- If pre-workspace and current RLS allows blanket anon INSERT to `onboarding_session` → council before scoping (other EFs may depend on same RLS shape)
- If `analyze-workspace` is called from multiple contexts (some pre, some post) → council (auth-gate needs split)

## Non-goals

- F-EF-06/07/08/09 (separate findings)
- F-DB-13/14/15 (separate slice)
- Full CORS cleanup (F-EF-09)

## Touched files (expected)

- `supabase/functions/analyze-workspace/index.ts` — auth gate
- `supabase/config.toml` — `verify_jwt` flag for `[functions.analyze-workspace]`
- `supabase/functions/analyze-workspace/__tests__/auth.test.ts` (new) — anon-reject + golden path
- `supabase/migrations/<timestamp>_scope_onboarding_session_anon_rls.sql` (conditional, only if pre-workspace path chosen)
- `docs/journeys/JOURNEY-audit-fef05-analyze-workspace-auth-anon-rejected.md` — flip to verified
- `docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md` — F-EF-05 CLOSED
- `docs/HANDOFF-audit-fef05-analyze-workspace-auth.md`

## Risk

LOW — mechanical auth-gate addition. Pre-workspace path has ADR-0123 precedent. Worst case: legitimate /join callers break → caught by vitest golden-path.
