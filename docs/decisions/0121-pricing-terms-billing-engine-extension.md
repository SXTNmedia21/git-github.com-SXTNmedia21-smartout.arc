---
title: ADR-0121 — pricing_terms Extension for Billing Engine
id: ADR_0121
status: accepted
layer: decision
created: 2026-04-17
updated: 2026-04-17
module: billing
tags: [adr, billing, c3-commercial, pricing-terms, schema, adr-0027-amends]
---

# ADR-0121 — `pricing_terms` Extension for Billing Engine

## Context and Problem Statement

Billing Engine Fase 1 (spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md`) introduces an invoice generator (Phase 1.3) that must resolve pricing parameters at generation time. The generator reads `pricing_terms` as its canonical pricing source (per ADR-0027), but the existing columns are insufficient for the billing engine's requirements:

- The included-users threshold for overage calculation is not stored — the generator has no basis for computing `active_users > free_users`.
- The per-overage-user price is not stored — overage line items cannot be produced.
- The delivery channel (manual handoff, Stripe charge, EHF/Peppol network) is not stored — the dispatcher cannot route generated invoices.
- The invoice format (PDF or EHF XML) is not stored — the renderer cannot select the correct serialiser.
- The contract duration (start/end of the commercial agreement) is not stored — invoice PDFs and EHF envelopes have no period to display.

A new `billing_agreement` table was considered but rejected (see Considered Options). The correct fix is an additive migration extending `pricing_terms` with five columns. ADR-0027 is amended, not superseded — the canonical placement decision (`pricing_terms` as a platform-admin table, service-role only, no RLS) remains fully in force.

## Decision Drivers

- Invoice generator (Phase 1.3) must resolve all pricing parameters from a single read on `pricing_terms` — no join-to-agreement-table fan-out at generation time
- Overage billing requires both the included-user threshold and the per-user rate; neither can be derived from existing columns
- Delivery routing and format selection are workspace-level choices that belong on the pricing term row, not on individual invoices
- `agreement_period` (contract duration for display) must be kept strictly separate from `effective_from / effective_until` (price validity for computation) — see Semantic Clarification below
- Migration must be additive (new nullable or defaulted columns only) so that existing `pricing_terms` rows remain valid without backfill

## Considered Options

1. **Extend `pricing_terms` with 5 columns (additive migration)** — no new table; generator reads one row; ADR-0027 preserved
2. **New `billing_agreement` table** — separate entity linked to pricing_terms; requires join at generation time; adds schema complexity without benefit; rejected
3. **Store delivery channel + format on `invoice` row at creation time** — duplicates workspace-level intent across every invoice; no canonical source for the default; rejected
4. **Store `agreement_period` inside existing `effective_from/effective_until`** — collapses two semantically distinct time windows into one column; breaks reproducibility contract (ADR-0119); rejected

## Decision Outcome

Chosen option: **Option 1 — extend `pricing_terms` with 5 additive columns**.

### Columns added (Phase 1.2 migration)

- `free_users int NOT NULL DEFAULT 10` — the number of active users included in the base monthly cost before overage applies. `DEFAULT 10` keeps existing rows valid without backfill.
- `overage_price_per_user decimal(12,2)` — nullable. Per-user price charged for each active user above `free_users`. `NULL` means overage billing is disabled for this pricing term; the generator emits no overage line item.
- `delivery_channel text NOT NULL DEFAULT 'manual' CHECK (delivery_channel IN ('manual', 'stripe', 'ehf'))` — how generated invoices are dispatched. `manual` = PDF produced, no automated transmission; `stripe` = Stripe charge via Edge Function; `ehf` = EHF/Peppol XML transmitted to buyer's access point.
- `invoice_format text NOT NULL DEFAULT 'pdf' CHECK (invoice_format IN ('pdf', 'ehf'))` — serialisation format for the invoice document. Orthogonal to `delivery_channel` (e.g. `delivery_channel = 'manual'` can still produce `invoice_format = 'ehf'` for manual upload to the Peppol network).
- `agreement_period daterange` — nullable. The calendar span of the commercial agreement (e.g. `[2026-01-01, 2026-12-31)`). Used for display on invoice PDFs and EHF envelope fields. Not used by the computation engine. See Semantic Clarification below.

### Semantic Clarification: `agreement_period` vs `effective_from / effective_until`

These two time concepts are **distinct** and may both be populated on the same row simultaneously. They must never be collapsed into one column.

| Column | Semantics | Used by |
|---|---|---|
| `effective_from` / `effective_until` | Price validity window. Defines which `pricing_terms` row the generator selects when a billing period falls within it. `effective_until IS NULL` means currently active. | Computation engine (invoice generator, snapshot resolver, ADR-0119) |
| `agreement_period` | Contract duration. The legal span of the customer agreement as printed on invoices and communicated to the customer. | Display layer: PDF renderer, EHF XML envelope, platform-admin UI |

Example: a contract signed 2026-01-01 for a 12-month term has `agreement_period = '[2026-01-01, 2026-12-31)'`. If a price increase takes effect 2026-07-01, a new `pricing_terms` row is inserted with `effective_from = '2026-07-01'` and the same `agreement_period`. Both rows share the same contract duration; only the price validity differs. A future migration author MUST NOT replace `agreement_period` with `effective_from` or vice versa.

## Rules & Consequences

- **Good, because** the invoice generator reads a single `pricing_terms` row and has all required fields — no multi-table join at generation time
- **Good, because** additive migration with `NOT NULL DEFAULT` columns requires no backfill of existing rows; `effective_until IS NULL` rows remain valid
- **Good, because** `delivery_channel` and `invoice_format` are orthogonal; the combination space is intentionally kept open (e.g. manual dispatch of EHF XML is a valid ops workflow)
- **Good, because** `agreement_period` as `daterange` supports both open-ended agreements (`[start, NULL)` using `daterange` upper-bound infinity) and fixed-term contracts
- **Bad, because** platform-admin UI must be updated to expose the 5 new columns on the pricing-terms edit form (Phase 2 / out of scope for Fase 1)
- **Bad, because** existing rows will have `free_users = 10` as the default; platform-admin must review and correct rows where the actual contract threshold differs
- **Agent Impact:** Phase 1.2 migration MUST add all 5 columns with exact types, defaults, and CHECK constraints as specified above. The invoice generator (Phase 1.3) MUST read `free_users` and `overage_price_per_user` to determine whether an overage line item is emitted. The dispatcher (Phase 1.5) MUST read `delivery_channel` to route the invoice. The PDF/EHF renderer MUST read `invoice_format` for serialisation and `agreement_period` for display. No code path may read `agreement_period` as a computation input.

## Related

- ADR-0027: Pricing Terms Table for Workspace Commercial Model (this ADR amends; ADR-0027 stays `accepted` — canonical placement decision unchanged)
- ADR-0118: Invoice Engine as C3 Commercial Consumer (parent — establishes what the generator reads and writes)
- ADR-0119: Usage Snapshot Reproducibility (sibling — defines `active_users` count that is compared against `free_users`)
- ADR-0120: Invoice Immutability + Credit Note Policy (sibling — defines invoice table constraints)
- Billing Fase 1 spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md` (Phase 1.2 migration, Phase 1.3 generator)
