---
title: "Handoff — supabase-root-domain-assert"
status: done
updated: 2026-05-18
created: 2026-05-18
module: supabase
tags: [handoff, supabase, env, auth, cookie-domain, production-safety]
---

# Handoff — supabase-root-domain-assert

> Branch: `feat/supabase-root-domain-assert` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1` | Base: `development`

## Summary

Closes deploy-class risk identified in F0 Track A review of ADR-0357: `client.ts` and `server.ts` both silently fall back to host-only cookie domain when `NEXT_PUBLIC_ROOT_DOMAIN` is unset. In production this causes cookie-domain drift (browser writes `app.smartout.ai` host-scoped; server reads `.smartout.ai`) — disjoint scopes, invisible cookie, re-surfaces the refresh-token rotation race ADR-0357 closed. Fix: shared module-load assert in `packages/supabase/src/_assert-root-domain.ts`, imported and called at top of both client.ts and server.ts. Throws in `NODE_ENV=production && VERCEL_ENV=production`; warns once otherwise. Idempotent.

## Decisions made

| ID | Decision | Where |
|---|---|---|
| ADR-0363 | Module-load hard-fail for missing `NEXT_PUBLIC_ROOT_DOMAIN` in production, warn in dev/preview. Shared helper pattern prevents code duplication across client/server. | `docs/decisions/0363-prod-assert-root-domain-for-supabase-cookie-domain.md` |

## Files changed

| File | Change |
|---|---|
| `packages/supabase/src/_assert-root-domain.ts` | NEW — shared idempotent assert helper |
| `packages/supabase/src/client.ts` | Import + top-level `assertRootDomain()` call (lines 3–6) |
| `packages/supabase/src/server.ts` | Import + top-level `assertRootDomain()` call (lines 5–8) |
| `docs/decisions/0363-prod-assert-root-domain-for-supabase-cookie-domain.md` | NEW ADR |
| `docs/decisions/0000-decision-log.md` | Row inserted after ADR-0358 |
| `docs/plans/PLAN-supabase-root-domain-assert.md` | Plan (all tasks done) |
| `docs/HANDOFF-supabase-root-domain-assert.md` | This file |
| `docs/journeys/JOURNEY-supabase-root-domain-assert.md` | Operator journey |

## Learnings

| ID | Learning |
|---|---|
| new | **Module-load asserts catch env drift faster than preflight scripts.** Preflight runs once at deploy time; module-load asserts fire on every cold start, catching drift introduced mid-life (e.g. env-sync wiping a var). Idempotency flag prevents log spam. Pattern reusable for other critical env vars. (ADR-0363) |

## Known issues

None.

## Next steps

Deploy via `promote-preview` (HOP A + HOP B) per ADR-0265. No migration, no schema change — pure TypeScript module-level guard.

## Verification

- `tsc --noEmit` in `packages/supabase`: see task 9 output.
- `git diff --stat`: see task 9 output.
