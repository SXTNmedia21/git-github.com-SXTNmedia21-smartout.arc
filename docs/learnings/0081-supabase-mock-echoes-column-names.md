---
title: "Supabase chainable-proxy mocks echo any column name — schema divergence is invisible to tests"
id: LEARNING_0081
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [testing, supabase-mocks, schema-divergence, capability-tools]
---

# Learning-0081: Supabase chainable-proxy mocks echo any column name — schema divergence is invisible to tests

## Context

The helpdesk_query capability tools (`listMyQueue`, `getTicket`) shipped
at `70103fc0` on development with five call sites selecting `created_at`
on `engine_state`. That column doesn't exist — the table has `started_at`
and `updated_at`. The 14-test unit suite passed because the test
double for Supabase is a chainable proxy that echoes any `.select()`
argument back as a returned row. The real PostgREST call would have
produced a `SelectQueryError`.

The bug stayed hidden through:
- Phase 0 backend review (ADR-0161)
- Capability ship to development
- Phase 1 UI implementation (backend ran against mock in tests, never hit a real DB)

Only surfaced when the web sub-sortie's `QueueSheet.tsx` tried to
typecheck against the generated `Database` types — TypeScript refused
the invalid column name.

## Discovery

A Supabase mock that uses a `Proxy` (or a manually chained `vi.fn()`
stack) can echo any method chain without schema knowledge. When the
System Under Test only cares about shape ("did `.select()` get called?
did the promise resolve?"), the mock is a happy oracle — regardless of
whether the column is real.

This is the third observed occurrence of mock-echo hiding a real bug
(prior: `shift_shift` → `schedule_shift` rename 2026-03, `sender_profile_id`
typo 2026-04-16). The pattern is now worth a process rule.

## Impact

Promote to process guidance: **any Supabase-dependent unit test must
either**:

1. Use the real `Database` generated types in the mock's return-type
   generics so TypeScript rejects unknown columns at compile time, OR
2. Run against `supabase start` integration DB for at least the happy
   path so PostgREST surfaces bad columns, OR
3. Pair each unit test with a "schema assertion" utility that grep's
   generated types for every selected column name.

The 14-test suite that passed on a wrong column was not wrong — it was
testing an orthogonal concern (control flow). The gap is that no test
in the repo binds "the column name in `.select()`" to "a column on the
target table" via a type-system check.

For future Phase 0 backend councils: add a code-tracer question — "does
any `supabase.from(X).select('...')` in this PR reference a column
absent from `packages/supabase/src/database.types.ts`?"

## References

- `packages/ai/src/capabilities/helpdesk_query/tools.ts` — fix applied via commit `ba5ff0e0` (5 call sites migrated `created_at` → `started_at`).
- `packages/ai/src/capabilities/helpdesk_query/__tests__/tools.test.ts` — 14 tests passed against both the wrong and right column name because the mock is chainable-proxy.
- Prior occurrences: `shift_shift` rename regression (2026-03), `sender_profile_id` typo (L-0023 era).
- Related: L-0059 (grep-count briefings undercount without code-trace pairing).
