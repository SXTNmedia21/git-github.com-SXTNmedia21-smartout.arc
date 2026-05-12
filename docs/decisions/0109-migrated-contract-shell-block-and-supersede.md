---
title: "Migrated Contract Shell — Block-and-Supersede Rule for Bubble-Imported Contracts"
id: ADR_0109
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0109: Migrated Contract Shell — Block-and-Supersede Rule

## Context and Problem Statement

Strike-mcp migrates Bubble `employment_profile` rows into v3's
`employment_contract` table with `source='bubble_migration'`. These rows
are historical artifacts: the Bubble contract was already composed, signed,
and worked under. They did not flow through v3's ADR-0076 composition
derivation (cascade → framework resolution → change_proposal → apply).

Post-migration, admins may want to correct a migrated contract (typo, wrong
start_date, missing occupation_code) or update it after a legitimate change
(salary raise, position change). The question: should an UPDATE on a
`source='bubble_migration'` row:

- (a) bypass composition and mutate the row in place (breaks ADR-0076),
- (b) re-enter composition on every UPDATE (produces a contract that may
  no longer match what the employee signed in Bubble — legal risk), or
- (c) block UPDATE and force admin to issue a new contract via the proper
  composition path?

Council 2026-04-15 resolved this after surfacing that steward (b) and
supervisor (a) produced conflicting verdicts.

## Decision Drivers

- **ADR-0076** requires composition via `change_proposal` for all
  v3-authored contracts. Allowing in-place UPDATE of migrated rows
  silently creates a parallel pipeline.
- **ADR-0077** (PII handling): the Bubble contract's content is legally
  binding. "Correcting" it via composition produces a document that
  differs from what the employee signed.
- **ADR-0099** unified authority gate: two-tier system (migrated rows
  permanently outside authority) violates the gate's universality intent.
- **ADR-0107** INSERT-only invariant: strike-mcp itself never UPDATEs.
  The question is strictly about human admin actions post-migration.
- **Steward's argument (for b):** Forcing composition on UPDATE recomposes
  a contract from current framework/tariff/C4 state, which may differ
  from the Bubble-era state. The recomposed doc may not match the signed
  doc. Legal risk.
- **Supervisor's argument (for a):** ADR-0076/0093 already established
  change-time data flows through change_proposal. Lifetime bypass creates
  permanent two-tier governance.

## Considered Options

1. **(a) INSERT-only bypass; UPDATE re-enters composition** — preserves
   single-pipeline but overwrites signed contract semantics. Legal risk.
2. **(b) Lifetime bypass; UPDATEs allowed in-place on migrated rows** —
   preserves Bubble contract fidelity but creates permanent two-tier
   authority.
3. **(c) Block-and-supersede: UPDATE on `source='bubble_migration'` raises
   exception; admin must create new `employment_contract` row via full
   composition** — accepted.

## Decision Outcome

Chosen: **Option 3 — block-and-supersede.**

### Clause A — Migration shell semantics

Bubble contracts are inserted with:

- `source = 'bubble_migration'`
- `status = 'migration_incomplete'` (new enum value per M2a) if required
  Tripletex fields (occupation_code, employment_form, remuneration_type,
  working_hours_scheme) are NULL, OR `status = 'signed'` if data is
  complete.
- Tripletex-optional fields nullable to tolerate incomplete Bubble data.
- No `change_proposal` record (did not flow through composition).

### Clause B — Volunteer null-semantics

A migrated contract with `employment_form IS NULL AND remuneration_type IS
NULL` signals "volunteer / do-not-sync-to-Tripletex" (per Wrightegaarden
`⏱️Frivillig` row in `employee_type`). Tripletex sync MUST skip these rows.

### Clause C — UPDATE block (runtime enforcement)

A database-level trigger (or RLS policy — implementation TBD in dedicated
migration, not part of this ADR's scope) SHALL raise an exception on any
UPDATE to a row with `source = 'bubble_migration'` except for:

- `updated_at` (system-managed timestamp)
- `source` column itself (to support a future "cascade-promote" path
  requiring a new ADR)

Canonical error message for admin UX:

> Cannot edit a migrated contract directly. Issue a new contract via the
> composition flow to supersede the migrated record.

### Clause D — Supersede via composition

To correct or update a migrated contract, admin creates a NEW
`employment_contract` row via the normal ADR-0076 composition flow. The
new row:

- `source = 'operational'` (or `'v3_engine'` if system-derived)
- Full composition provenance via `change_proposal` of type
  `employment_contract_compose`
- `parent_contract_id` (ADR-0082 lineage FK) points to the migrated row
- Goes through full framework resolution, tariff checks, C4 authority
  gate, and DocuSeal signing

The migrated row is marked superseded (status transitions permitted for
this specific case — superseded status TBD or use existing `'terminated'`).

### Clause E — employment_contract_detail immutability for migrated rows

`employment_contract_detail` rows (ADR-0111) derived from a
`source='bubble_migration'` parent are **read-only historical snapshots**.
Strike-mcp backfills initial detail rows from Bubble history (one per
distinct effective_date in the Bubble contract's life). No new detail
rows are written for migrated parents post-migration — supersession
creates a NEW parent, not new details on the old one.

### Clause F — Relation to ADR-0076 (explicit bypass declaration)

`source='bubble_migration'` rows are a **bounded historical exception** to
ADR-0076. The bypass is scoped to:

- INSERT-time (strike-mcp, ADR-0107 INSERT-only)
- UPDATE forbidden (Clause C)
- Supersession path re-enters ADR-0076 via new contract (Clause D)

This preserves ADR-0076's "single canonical composition pipeline"
invariant because:

- Migrated rows are declared historical, not cascade-derived
- Any live action on migrated rows routes through the canonical pipeline
  (via supersession)
- No silent parallel pipeline exists

### Worked example — Anna gets a raise

1. Bubble pre-migration: Anna has signed contract with `hourly_rate = 175`.
2. Strike-mcp imports: INSERT `employment_contract` with
   `source='bubble_migration'`, `status='signed'`, `hourly_rate=175`.
3. 2026-05-01: Admin wants to raise Anna to 185 NOK/hour.
4. Admin clicks "Edit contract" → UI routes to composition flow (not direct
   UPDATE; backend enforces Clause C).
5. New `employment_contract` row INSERTed via composition: `source='operational'`,
   `parent_contract_id = Anna's_migrated_row_id`, `hourly_rate=185`, full
   framework_snapshot, new `change_proposal`.
6. Admin approves, DocuSeal sends to Anna, she signs.
7. Migrated row status → `terminated` (superseded). Anna's active contract
   is now the cascade-derived one.

## Rules & Consequences

- **Good, because** preserves Bubble contract legal fidelity (the signed
  doc is not recomposed).
- **Good, because** re-entry to cascade is explicit (new contract) rather
  than silent (UPDATE triggers composition).
- **Good, because** ADR-0099 authority gate applies to all live contracts
  (the migrated row's lifetime is closed; its successor is fully gated).
- **Good, because** ADR-0076's single-pipeline invariant holds.
- **Bad, because** admin UX gets a hard error on direct UPDATE. Requires
  UI affordance ("Create new contract" button; disable inline-edit on
  migrated rows).
- **Bad, because** volunteer/Frivillig contracts have permanent NULL
  Tripletex fields — not a drift issue, just needs Tripletex-sync to
  filter them correctly.
- **Agent Impact:**
  - Botsson `createEmployeeContract` tool MUST NOT attempt to UPDATE a
    `source='bubble_migration'` row. Any admin request to "edit Anna's
    contract" where Anna is migrated routes to composition (new contract).
  - Strike-mcp (ADR-0107) respects INSERT-only, so does not trip Clause C.
  - API handlers (`/api/employment-contracts/[id]` PATCH) must catch the
    trigger-raised exception and return structured error for UI to show
    Clause C message.

## References

- ADR-0076 — Contract Composition as Cascade Derivation (bypassed at INSERT
  only per this ADR)
- ADR-0077 — PII handling (legal-fidelity driver)
- ADR-0079 — employment_contract vs contract separation
- ADR-0082 — parent_contract_id lineage (supersession FK)
- ADR-0099 — Unified Authority Gate
- ADR-0107 — Strike-MCP Telemetry Boundary (INSERT-only invariant)
- ADR-0111 — employment_contract_detail versioning (Clause E)
- Council session 2026-04-15

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
