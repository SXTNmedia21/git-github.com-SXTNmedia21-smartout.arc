---
title: "POS Adapter Contract & Vendor Lifecycle"
id: ADR_0319
status: accepted
layer: decision
created: 2026-05-14
updated: 2026-05-14
---

# ADR-0319: POS Adapter Contract & Vendor Lifecycle

## Context and Problem Statement

ADR-0305 ships POS integration V1 with a single vendor (Lightspeed K-Series) and a
hardcoded `mockPull` adapter stub. The schema uses a TEXT `vendor` column with a
`CHECK` constraint listing the single allowed value. The `pos-sync` Edge Function body
is vendor-specific rather than dispatch-based.

When vendor #2 arrives, the current shape forces simultaneous edits across 4 artifacts:

1. SQL `ALTER TABLE` to relax the `CHECK` constraint
2. SQL `DROP CONSTRAINT` / `ADD CONSTRAINT` to replace the per-workspace unique index
3. Edge Function body edit to route to the new vendor
4. Type-duplication across Deno (Edge Function) and Node (`packages/ai/`) for the adapter shape

This is a V2 tax. The dispatcher pattern exists in other domains (e.g. engine action_type
handlers); it should be codified for POS adapters BEFORE a second vendor proves the
pattern under pressure.

## Decision Drivers

- Vendor #2 must require one file edit, not four.
- Schema changes (enum, unique index) are irreversible and painful to coordinate cross-branch.
- Type-sharing between Deno and Node is a known pain point; strategy must be explicit.
- Currency constraints are simple and correct for V1; FX risk must be documented, not silently assumed.

## Considered Options

1. **Status quo (TEXT + CHECK)** — cheapest now, maximum V2 tax.
2. **Postgres enum `pos_vendor_kind` + dispatcher registry** — one-time migration cost, vendor #2 = 1 file.
3. **Codegen shared types (option b per Supervisor)** — `pnpm pos:sync-adapter` script copies adapter body into EF, single source of truth.

## Decision Outcome

Chosen: **Option 2 (enum + dispatcher) + Option 3 (codegen type-share)**. Applied together.

### Rules

**Rule 1 — Vendor enum promotion.**
Promote `pos_account.vendor` from `TEXT + CHECK` to Postgres enum `pos_vendor_kind`
seeded with `'lightspeed_kseries'` as its first value. Adding a new vendor requires:

```sql
ALTER TYPE pos_vendor_kind ADD VALUE 'new_vendor_slug';
```

No `CHECK` relax. No `UNIQUE` drop. DDL surface is one statement.

**Rule 2 — Multi-vendor unique index.**
Replace `UNIQUE (workspace_id, vendor)` with `UNIQUE (workspace_id, vendor, external_account_id)`.
Multiple vendors per workspace and multiple accounts per vendor per workspace are implicit
in the new constraint. The index replaces the old one in the same migration that promotes
the enum.

**Rule 3 — Dispatcher registry in `pos-sync` EF.**
`supabase/functions/pos-sync/index.ts` must use the registry pattern:

```typescript
const adapter = adapters[account.vendor];
if (!adapter) throw new Error(`Unknown vendor: ${account.vendor}`);
const events = await adapter.pull(account, since);
```

Adding a new vendor = one new adapter file only. The EF body is NOT touched.

**Rule 4 — Type-share via codegen.**
Adapter shape is defined once in `packages/ai/src/adapters/pos/types.ts` (Node/TypeScript).
A codegen script `pnpm pos:sync-adapter` copies the adapter contract into the EF
`supabase/functions/pos-sync/_shared/adapter-types.ts`. The EF imports from `_shared/`.
Documented at the top of `supabase/functions/pos-sync/index.ts` with a `DO NOT EDIT —
run pnpm pos:sync-adapter to regenerate` header.

**Rule 5 — Currency: single-currency safe only (V1).**
`pos_sale_event.currency` retains `CHECK (char_length(currency) = 3)` (ISO 4217).
`cascade.v_pos_sales_hour` aggregates `gross_amount_minor` across all events for a
workspace without FX conversion. Mark the view definition with:

```sql
-- SINGLE-CURRENCY SAFE ONLY: assumes all events share workspace currency.
-- Multi-currency aggregation deferred to ADR-0312 (FX).
```

The view is NOT renamed or removed; it is annotated. Dashboards reading the view must
not claim cross-currency accuracy until that ADR ships.

**Rule 6 — Vendor-impact checklist (appendix).**
Before shipping any new vendor adapter, the author must verify and check off:

- [ ] `pos_vendor_kind` enum value added via `ALTER TYPE ADD VALUE` migration
- [ ] Adapter file created at `packages/ai/src/adapters/pos/<vendor>.ts`
- [ ] `pnpm pos:sync-adapter` run + EF `_shared/adapter-types.ts` committed
- [ ] `pos-sync` registry object updated with new key
- [ ] Credentials schema documented (op:// pattern, never plaintext)
- [ ] `external_event_id` uniqueness strategy confirmed (vendor-assigned ID vs Smartout composite)
- [ ] `mockPull` stub or sandbox credentials provided for E2E tests
- [ ] ADR row added to decision log

## Consequences

- **Good, because** vendor #2 requires editing 1 file (`packages/ai/src/adapters/pos/<vendor>.ts`) instead of 4.
- **Good, because** enum is forward-only; adding a value never breaks existing policies or queries.
- **Good, because** codegen strategy is explicit — no silent Deno/Node drift on adapter types.
- **Good, because** multi-account-per-workspace is possible without schema change (index already allows it).
- **Bad, because** `ALTER TYPE ADD VALUE` is not transactional in PostgreSQL < 12 (we are on 17 — safe).
- **Bad, because** one-time migration cost to promote TEXT → enum on existing `pos_account` table.
  Estimated: forward-only migration, ~1 day to write + test + apply.
- **Bad, because** codegen (`pnpm pos:sync-adapter`) is a manual step — must be in `package.json` scripts
  and documented in the onboarding checklist for EF contributors.

---

> Register in `docs/decisions/0000-decision-log.md`. Migration: `ALTER TYPE pos_vendor_kind ADD VALUE`
> pattern established here; first application in `feat/pos-integration-lightspeed-mvp` sortie.
> Depends on ADR-0305 (POS adapter V1 foundation).
