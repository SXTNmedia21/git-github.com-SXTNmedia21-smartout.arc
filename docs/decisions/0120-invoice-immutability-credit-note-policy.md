---
title: ADR-0120 — Invoice Immutability + Credit Note Policy
id: ADR_0120
status: accepted
layer: decision
created: 2026-04-17
updated: 2026-04-17
module: billing
tags: [adr, billing, c3-commercial, invoice, immutability, credit-note, bokforingsloven]
---

# ADR-0120 — Invoice Immutability + Credit Note Policy

## Context and Problem Statement

Billing Engine Fase 1 (spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md`) introduces the `invoice` and `invoice_line_item` tables (Phase 1.4). Before those tables are designed, the immutability and correction contracts must be settled.

Norwegian bokføringsloven §5 mandates that accounting documents are numbered continuously, cannot be deleted or retroactively altered after issuance, and must be retained for a minimum of five years. A billing engine that permits DELETE or in-place edits on issued invoices is non-compliant by construction. At the same time, legitimate corrections must be possible — refunds, pricing errors, period adjustments — without violating the immutability requirement.

Three contract questions must be answered before Phase 1.4 schema work begins:

1. How are invoice numbers assigned to ensure continuous, gap-free sequencing?
2. What is the correction mechanism for issued invoices?
3. What invariants constrain valid `(status, dunning_status)` combinations to prevent nonsensical database states?

## Decision Drivers

- Bokføringsloven §5 requires continuous numbering, immutability after issuance, and 5+ year retention
- Corrections must be possible (pricing errors, disputes, refunds) without violating the above
- `invoice_number` is a human-facing, externally referenced identifier (Stripe metadata, EHF/Peppol XML, bank references); it must not be conflated with `invoice_id` (internal UUID join key)
- The `(status, dunning_status)` matrix must be constrained at the DB level — not only in application code — to prevent orphaned or contradictory states
- Dunning age must be calculable without querying external systems; the anchor date must be stored on the row
- Credit note amounts must be unambiguous for accounting reconciliation

## Considered Options

1. **Continuous numbering via Postgres sequence + trigger on `draft → issued` transition** — gap-free, atomic, application-agnostic
2. **Application-layer UUID-derived number** — not gap-free; non-compliant
3. **Allow DELETE with soft-delete flag** — violates bokføringsloven §5 immutability; rejected
4. **Corrections via in-place UPDATE on issued invoices** — violates immutability; rejected
5. **Corrections via credit notes with explicit `credits_invoice_id` FK** — compliant with Norwegian law; universally accepted accounting pattern
6. **Allow nested credit notes (credit note crediting another credit note)** — creates circular accounting chains; rejected
7. **Unconstrained `(status, dunning_status)` combinations** — produces nonsensical states (e.g. `draft` + `overdue`); rejected

## Decision Outcome

Chosen options: **Options 1, 5** (numbering and correction), with explicit rejections of 2, 3, 4, 6, 7 encoded as database-enforced constraints and triggers.

### 1. Continuous invoice numbering via Postgres sequence

Invoice numbers are assigned by a dedicated Postgres sequence `invoice_number_seq`. The sequence is created in Phase 1.4 and is workspace-global (not per-workspace — platform-wide continuous numbering satisfies bokføringsloven §5 more simply than per-workspace sequences, and avoids sequence management overhead).

Assignment occurs exclusively on the `draft → issued` status transition, enforced by a Postgres trigger on the `invoice` table. Draft invoices carry `invoice_number = NULL`. Once a number is assigned it is immutable.

### 2. No DELETE on issued invoices. Ever.

Rows in the `invoice` table with `status IN ('issued', 'paid', 'void', 'uncollectible')` MUST NOT be deleted. The Phase 1.4 migration will enforce this via an `AFTER DELETE` trigger that raises an exception if the deleted row had a non-`draft` status. Application-layer soft-delete flags are not a substitute — the constraint lives in the database.

### 3. Corrections via credit notes only

An issued invoice may only be corrected by issuing a credit note. A credit note is a row in the `invoice` table with:

- `invoice_type = 'credit_note'`
- `credits_invoice_id UUID NOT NULL REFERENCES invoice(invoice_id)` — FK to the original invoice being credited

There is no other in-place correction path. Partial credits are expressed as credit notes with line items covering only the corrected portion.

### 4. No nested credit notes

A credit note MUST NOT credit another credit note. This is enforced by an `BEFORE INSERT` trigger on `invoice` that verifies: if `invoice_type = 'credit_note'` and `credits_invoice_id IS NOT NULL`, then `(SELECT invoice_type FROM invoice WHERE invoice_id = NEW.credits_invoice_id) != 'credit_note'`. Violation raises an exception.

### 5. Legal `(status, dunning_status)` combinations constrained via CHECK

The `invoice` table carries both a `status` column (7 values — `draft`, `issued`, `sent`, `paid`, `overdue`, `void`, `uncollectible`) and a `dunning_status` column (4 values — `none`, `in_negotiation`, `reminder_sent`, `escalated`). Not all 28 combinations are legal. The `invoice_status_dunning_legal` CHECK constraint splits the states into terminal and active groups:

| status | Allowed dunning_status values |
|---|---|
| `draft` | NULL only |
| `paid` | NULL only |
| `void` | NULL only |
| `uncollectible` | NULL only |
| `issued` | any of `{NULL, none, in_negotiation, reminder_sent, escalated}` |
| `sent` | any of `{NULL, none, in_negotiation, reminder_sent, escalated}` |
| `overdue` | any of `{NULL, none, in_negotiation, reminder_sent, escalated}` |

Terminal invoice states require `dunning_status IS NULL` — dunning is meaningless on closed invoices. Active invoice states accept any `dunning_status` value (including NULL); the dunning state machine progresses orthogonally to `invoice_status` so that e.g. `sent + reminder_sent` and `sent + escalated` are legal during customer follow-up. The enum itself bounds the set of dunning_status values; no arbitrary text can slip in.

**Amendment (Phase 1.5, 2026-04-17, commit `af8dd7dc`):** this table replaces the original Phase 0 draft matrix, which enumerated combinations using pre-Task-1.3 enum names (`dunning_1`, `dunning_final`) and predated both the `sent` invoice_status value and the recognition that dunning progresses orthogonally to invoice_status. The Phase 0 matrix was too tight — it blocked the standard Fase 2 dunning flow (`sent + reminder_sent`). The relaxed form above is now the authoritative contract; code-reviewer important #4 from the B1 council drove the relaxation. Rationale also captured in the CHECK constraint's `COMMENT ON CONSTRAINT`.

### 6. Invoice identity contract: `invoice_id` vs `invoice_number`

- `invoice_id UUID` — internal primary key. Used for all FK references, joins, and API responses within the platform.
- `invoice_number INT` — human-facing sequential number. Used for display, external references (Stripe metadata, EHF/Peppol XML, bank remittance advice), and customer communication.

These two identifiers MUST NOT be mixed. No code path may use `invoice_number` as a join key. No code path may expose `invoice_id` to customers as the primary invoice reference.

### 7. Dunning age calculation from `due_at`

The `invoice` table stores `due_at TIMESTAMPTZ NOT NULL`. This column is set at invoice generation (Phase 1.4 trigger) and is immutable after issuance. Dunning age is calculated as:

```sql
days_overdue = CURRENT_DATE - due_at::date
```

No external system query is required. The value is deterministic and reproducible from the stored row.

### 8. Credit note amounts: positive numbers with explicit type

Credit note line items carry positive numeric amounts. The credit semantics are expressed by `invoice_type = 'credit_note'`, not by negative numbers. Consuming code (EHF export, accounting reconciliation, Stripe sync) MUST negate line totals when `invoice_type = 'credit_note'` to produce the correct accounting sign. This avoids ambiguity in raw data inspection and simplifies CHECK constraints on `amount > 0`.

## Rules & Consequences

- **Good, because** Postgres sequence + trigger assignment makes numbering atomic and gap-free by construction — no application-layer coordination needed
- **Good, because** `AFTER DELETE` trigger enforcement means immutability holds even if application code contains a bug or a direct DB connection is used
- **Good, because** credit notes as first-class `invoice` rows with `credits_invoice_id` gives a complete audit graph: original → credit note, traceable in a single table
- **Good, because** the no-nested-credit-notes trigger eliminates an entire class of accounting inconsistencies before they can occur
- **Good, because** `CHECK` constraints on `(status, dunning_status)` catch state machine violations at write time — no need for periodic consistency checks
- **Good, because** storing `due_at` on the row makes dunning age calculation stateless and reproducible; no drift from external clock differences
- **Bad, because** credit notes require UI support (issue credit note, apply to account, display on invoice history) — this is out of scope for Fase 1. Platform-admin will need direct DB access for corrections until Phase 7 ships the credit note UI
- **Bad, because** a platform-wide sequence produces non-contiguous numbers per workspace (workspace A may have invoice 1001 and invoice 1003; workspace B gets 1002 in between). If per-workspace contiguous numbering is required for customer-facing compliance, a per-workspace sequence strategy is needed in a follow-up ADR
- **Agent Impact:** Phase 1.4 migration MUST create `invoice_number_seq`, the `draft → issued` number-assignment trigger, the `AFTER DELETE` immutability trigger, the no-nested-credit-notes trigger, and the `(status, dunning_status)` CHECK constraint. No invoice correction path outside credit note issuance may be implemented. Phase 7 credit note UI is a hard dependency for self-serve corrections.

## Related

- ADR-0118: Invoice Engine as C3 Commercial Consumer (parent placement decision)
- ADR-0119: Usage Snapshot Reproducibility (sibling — defines what is billed; this ADR defines how it is recorded)
- Bokføringsloven §5 — Norwegian Accounting Act, document immutability and retention requirements
- Billing Fase 1 spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md` (Phase 1.4)
- Phase 7: Credit note UI (future — unblocks self-serve corrections for platform-admin)
