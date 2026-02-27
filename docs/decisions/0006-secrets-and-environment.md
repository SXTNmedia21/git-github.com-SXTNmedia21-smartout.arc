# ADR-0006: Environment Variables, Secrets & Module Boundaries

**Date:** 2026-02-27
**Status:** Accepted

## Context

Smartout integrates with multiple external services (Supabase, Stripe, DocuSign, SendGrid, Twilio, PostHog) each requiring API keys and secrets. We need a strategy that prevents secret leakage while keeping local development ergonomic.

## Decision

### Secret Storage

| Context | Method |
|---------|--------|
| Local development | `.env.local` per app (gitignored) |
| CI/CD | Vercel environment variables |
| Production runtime | Supabase Vault (for runtime secrets) |
| Secret management | 1Password as master record |
| Script injection | `op run --env-file=.env.template` at root |

### Environment Validation

We use `@t3-oss/env-nextjs` with Zod schemas in `apps/web/src/env.ts` to validate all environment variables at build/start time. Each variable has explicit type validation (e.g., Stripe keys must start with `sk_`, SendGrid with `SG.`).

### Module Boundaries

- `NEXT_PUBLIC_*` variables are client-safe and exposed to the browser
- Server-only variables are never prefixed with `NEXT_PUBLIC_`
- Each app validates its own env — packages do NOT read env vars directly, they receive config via function arguments

### Files

- `.env.template` — Variable names with `op://` references for 1Password injection
- `.env.example` — Variable names with placeholder values for documentation
- `.env.local` — Actual values, gitignored, never committed

## Rationale

- `@t3-oss/env-nextjs` catches missing/malformed env vars at startup rather than runtime
- 1Password `op run` eliminates manual `.env.local` management for team members with 1Password access
- Packages receiving config via arguments (not reading env directly) keeps them portable and testable

## Consequences

- Developers without 1Password CLI must manually create `.env.local` from `.env.example`
- `SKIP_ENV_VALIDATION=1` is available for builds that don't need all services
- Adding a new env var requires updating both `env.ts` (validation) and `.env.template` (1Password)
