# ADR-0005: Testing Infrastructure — Four-Layer Strategy

**Date:** 2026-02-27
**Status:** Accepted

## Context

Smartout is a multi-tenant SaaS with complex business logic (governance chains, RLS policies, session lifecycles) that requires reliable testing at multiple levels. We need a testing strategy that catches regressions without slowing down development.

## Decision

We adopt a four-layer testing strategy:

1. **Type-level validation** — Zod schemas in `@smartout/types` enforce runtime type safety. `tsc --noEmit` across all packages catches type errors at build time.
2. **Database-level testing** — Supabase `db reset` runs all migrations + seed in sequence. Any migration that fails breaks the chain. RLS policies are tested via API calls with different auth contexts.
3. **Integration testing** — Edge Functions validate input with Zod and return proper HTTP status codes. Testable via `curl` against local Supabase.
4. **E2E testing** — Playwright in `apps/e2e` tests critical user flows (login, onboarding, dashboard navigation) against the full stack.

### Tools

| Layer       | Tool                 | Location                                  |
| ----------- | -------------------- | ----------------------------------------- |
| Types       | TypeScript + Zod     | `packages/types/`, `pnpm lint`            |
| Database    | Supabase CLI         | `supabase db reset`, `supabase db lint`   |
| Integration | curl / Supabase REST | Manual + CI                               |
| E2E         | Playwright           | `apps/e2e/`, `pnpm --filter e2e test:e2e` |

## Rationale

- Unit tests for UI components are deferred until the UI stabilizes (currently in rapid iteration)
- Zod schemas act as both runtime validation AND compile-time type inference, reducing the need for separate unit tests on data shapes
- Database migration sequencing acts as an implicit integration test for the schema layer
- Playwright E2E tests cover the highest-value user flows

## Consequences

- No component-level unit tests yet (acceptable during rapid UI iteration)
- CI pipeline must run `supabase db reset` to validate migrations
- E2E tests require local Supabase to be running
