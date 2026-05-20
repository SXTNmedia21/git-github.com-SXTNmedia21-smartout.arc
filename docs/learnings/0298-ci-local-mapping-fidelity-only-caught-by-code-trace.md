---
title: "ci:local mapping fidelity is only caught by code-trace, not concept-review"
id: L-0298
status: captured
layer: learning
created: 2026-05-17
updated: 2026-05-17
adr_refs: [ADR-0359]
sibling_of: [L-0147, L-0294, L-0297]
---

# L-0298: ci:local mapping fidelity is only caught by code-trace, not concept-review

## What happened

Council 2026-05-17 reviewed the proposed `coverage-check` gate design for `pnpm ci:local`. Chair (System Steward) issued **PASS WITH CONDITIONS** in Phase 3 — design was structurally sound, marker pattern worktree-safe, scope correctly bounded to `feat/*→development`.

Supervisor (Phase 3, code-tracer mandate) inspected `.github/workflows/ci.yml`, `pgtap.yml`, `authority-seed-parity.yml`, `migration-lint.yml`, `check-rls.yml`, `eslint-mobile.yml`, `gate-action-coverage.yml`. Returned **REJECT-AS-PROPOSED** with 9 missing path classes + 3 false mapping claims (no vitest in `apps/web`, `gate-action-coverage` not in capability row, `pgTAP` triggers on `supabase/tests/**` + `supabase/seed.sql` + `supabase/config.toml` per workflow file:line).

Per L-0147 Chair Self-Reversal Protocol (promoted as hard rule per L-0294), Chair reversed Phase 3 verdict to **REJECT IN CURRENT FORM** in Phase 5.

## Why it happened

The mapping table in the proposal had been built from memory and prior-skill text. It described **what CI ought to test** for each path class. Supervisor opened the actual workflow files and discovered:

- `apps/web` is in the diff path list but `pnpm turbo run test` (the vitest job) does not actually cover `apps/web` because `apps/web` has no vitest config — only typecheck + build do.
- `gate-action-coverage.yml` triggers on `packages/ai/src/capabilities/**` per its own `paths:` filter — the proposed mapping listed `vitest + authority-seed-parity + invariants-emit` but omitted `gate-action-coverage`.
- `pgtap.yml` triggers on more than just `supabase/migrations/**` — it also covers `supabase/tests/**`, `supabase/seed.sql`, `supabase/config.toml`. Mapping was too narrow.
- 9 entire path classes (`apps/e2e/**`, `packages/telemetry/**`, `database.types.ts`, `services/voice-agent|contract-service|...`, `infra/**`, `package.json↔pnpm-lock.yaml`, `tsconfig/turbo.json`, `supabase/seed.sql`, `.github/workflows/**`) had no row at all.

Concept-review (Steward) saw the design intent and approved. Code-trace (Supervisor) read the workflow files and saw the implementation. Approving the concept-correct-but-fidelity-incorrect mapping would have shipped a `coverage-check` that **passes when it shouldn't and warns nobody** — the exact false-green failure mode the gate exists to prevent.

## Pattern

Sibling of L-0147 (single-axis Phase 3 misses design+a11y), L-0294 (chair self-reversal hard rule promotion), L-0297 (ADR-to-enforcement-code receipt rule). All four are instances of:

**Concept review certifies the shape of the answer. Code-trace verifies the answer matches a real file.**

When the answer claims "X covers Y" (mapping fidelity, ADR enforcement, contract compliance, schema parity), only opening X and reading what it actually does catches the lie. Chairs that vote on conceptual integrity will always approve plausible-shape claims because plausible-shape is the only thing concept-level reasoning can evaluate.

## Fix in place

ADR-0359 ships:
1. Corrected mapping table (longest-prefix-wins, 24 rows covering the 9 missing classes + 3 corrected ones).
2. `coverage-check` gate as first step of `ci:local`. Catches its own future drift via end-of-run "required gates were invoked" check.
3. `learning-cross-check` gate that greps the script for captured-learning mitigations. Catches silent regression of any encoded fix.
4. `baseline-check` + `self-learn-write` to surface outliers without false-failing.

## Rule going forward

**When proposing any mapping / coverage table / contract enforcement design: assign a code-tracer reviewer (Supervisor or domain agent) the explicit task of opening the source files and verifying each row corresponds to actual filter / actual code path.** Mapping that has not been code-traced is not mapping — it is hope.

## Promotion check

This is the 4th occurrence in the L-0147 family (single-axis Phase 3 misses → reverse via code-trace). L-0294 promoted the Chair Self-Reversal Protocol from advisory to hard rule. This learning adds the **Mapping Fidelity rule** as a complementary hard rule under Phase 3 in the `run-council` skill: any topic proposing a mapping / classification / coverage table requires a code-tracer seat.

If this pattern recurs in 2 more sessions, the run-council skill's `## Phase 3 Hard Rules` section gets a new block named "Mapping fidelity".

---

> Register in `docs/learnings/0000-learning-log.md`.
