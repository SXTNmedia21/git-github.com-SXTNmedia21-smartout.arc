---
title: ADR-0416 — Schema-Fixture Coherence CI Gate
id: ADR-0416
status: proposed
date: 2026-05-24
module: meta
tags: [adr, ci, migration, fixture, e2e, coherence-check]
related: [ADR-0389, ADR-0392, ADR-0393, L-0042]
---

# ADR-0416 — Schema-Fixture Coherence CI Gate

## Context

Journey-sweep council 2026-05-24 documented BUG-12: migration `20260519150000_contract_text_to_enum_cast.sql:160` added `NOT NULL` constraint on `employment_contract.employment_form`. E2E seed helpers that INSERT into `employment_contract` were NOT updated in the same PR. Tests fail at fixture stage with `null value in column "employment_form" violates not-null constraint`.

This is the third instance of "schema migration ships without fixture update" class. Existing CI gates do not catch it:
- **migration-lint** (per L-0042) checks timestamp ordering + duplicate names + SECURITY DEFINER search_path. Does not cross-reference fixtures.
- **check-otp-coherence.mjs** (per ADR-0389) enforces OtpVerificationForm.tsx + GoTrue otp_length parity. Single-purpose.
- **domain-lint.mjs** (per ADR-0392) enforces domain doc + code parity. Different concern.

The pattern: a migration adds NOT NULL or CHECK constraint on a column. Helpers / fixtures / seed scripts that INSERT into that table without the new value silently break in CI (or worse, in prod migration apply). Currently caught only at test-run time — and only if the failing test happens to run.

This belongs in pre-merge enforcement, not test-time discovery.

## Decision

Ship a new CI gate `scripts/check-schema-fixture-coherence.mjs` that flags this defect class at pre-push + GH Actions.

### Algorithm

1. Compute diff of `supabase/migrations/` vs `origin/main` (only new/changed migrations)
2. For each diff'd migration, regex-extract:
   - `ALTER TABLE <table> ALTER COLUMN <col> SET NOT NULL`
   - `ALTER TABLE <table> ADD COLUMN <col> <type> NOT NULL`
   - `ALTER TABLE <table> ADD CONSTRAINT <name> CHECK (...)`
3. For each (table, column) pair found:
   - grep `.insert\(\{` calls on the same table across:
     - `apps/e2e/helpers/**/*.ts`
     - `apps/e2e/tests/**/*.spec.ts`
     - `supabase/seed.sql` + `supabase/seed/**`
     - `scripts/**` (one-off seed scripts)
   - If matching insert calls exist AND none of them include the new column, FAIL with file:line of each missing insert + the migration that introduced the constraint
4. Pass (exit 0) silently otherwise

### Wire-up

- `package.json` add `"check:schema-fixture": "node scripts/check-schema-fixture-coherence.mjs"`
- `.husky/pre-push` append after existing `check:otp` / `check:redirect` / `check:domains` calls
- `.github/workflows/ci.yml` add step in Format Check job after `check:otp`

### Output format

```
✗ Schema-fixture coherence FAILED:
  Migration: supabase/migrations/20260519150000_contract_text_to_enum_cast.sql:160
    Added: employment_contract.employment_form NOT NULL
  Missing in inserts:
    apps/e2e/helpers/contract-harness.ts:87 (seedContract)
    apps/e2e/tests/contract-employee/journey-2-admin-send.spec.ts:107 (ensureDraftContract)
  Fix: add employment_form to those .insert({...}) payloads OR amend migration to set default
```

### False-positive handling

- If a helper deliberately omits the new column to test the NOT NULL constraint, suppress with comment `// fixture-coherence-skip: <reason>` on the offending line
- The check ignores type-only changes (e.g. `text → enum cast`) unless they also add NOT NULL

## Consequences

**Positive:**
- BUG-12 class detected at pre-push, NOT at test-run
- Forces same-PR discipline: migration + fixture update land together
- Sibling pattern to existing coherence checks (OTP, domain-lint) — operator already trained on similar output format

**Negative:**
- Adds ~5-10s to pre-push runtime (regex grep over migrations + helper files)
- Initial inventory may surface backlog of existing schema-fixture incoherence (one-time cleanup sortie)
- Author must remember `fixture-coherence-skip` comment when intentionally omitting (low risk — comment is self-documenting)

## Alternatives Considered

1. **TypeScript types-helper generation** — generate `EmploymentContractInsert` type from `database.types.ts`; helpers must use it; `tsc` catches missing required fields. Better long-term but requires migrating all helpers — propose as follow-up sortie. This ADR ships the gate; helper-type adoption is incremental.
2. **Runtime fixture validator** — every helper auto-validates against types at run-time. Slow, runs at test-time not pre-push. Defeats the purpose.
3. **Manual review only** — current state. Continues to fail.

## References

- ADR-0389 — OTP coherence check (sibling)
- ADR-0392 — domain-lint coherence check (sibling)
- ADR-0393 — redirect coherence check (sibling)
- L-0042 — migration timestamp ordering precedent (related migration-lint family)
- L-0344 — BUGS.md ghost-claim pattern (this council)
- Journey-sweep council 2026-05-24 chair Phase 5 synthesis + Supervisor proposal
- BUG-12 in `docs/test-runs/2026-05-23-journey-sweep/BUGS.md`
