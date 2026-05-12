---
title: "Payroll Ledger Archive — Read-Only Bubble Historical Semantics"
id: ADR_0110
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0110: Payroll Ledger Archive — Read-Only Bubble Historical Semantics

## Context and Problem Statement

Bubble's `⏱️salary_transaction` table (Wrightegaarden: 17 607 rows) holds
the complete historical payroll ledger — one row per pay event (base
work-time, supplement, deduction), with a-melding codes and accounting
account codes already attached. This is the only place that history
exists; once the Bubble workspace is decommissioned, these rows are lost
unless v3 preserves them.

The question is what semantics the v3-side table has:

- Live payroll ledger (v3 cascade writes new rows here going forward)?
- Pure archive (read-only historical store; v3 cascade writes elsewhere)?
- Both?

Council 2026-04-15 flagged nomenclature ambiguity as the single highest
cascade-integrity risk in the plan. The table cannot simultaneously be
"archive" and "live ledger" without creating a parallel truth-owner and
violating cascade invariant #1 (single canonical pipeline).

## Decision Drivers

- **Cascade invariant #1** — single canonical pipeline per datum.
- **Cascade invariant #7** — no sidecars. A "live archive" is a sidecar.
- **ADR-0057** payroll-schema-separation (existing; relevant for scope
  boundary).
- **Council steward's risk assessment:** mislabeling this table as both
  archive and live ledger is the highest-impact cascade-integrity concern
  in the plan.
- **Supervisor's convention check:** no `payroll_ledger` table exists in
  the codebase. Committing to a name for the operational table would be
  scope creep.
- **Supervisor's archive precedent:** `public.engine_state_archive`
  (`supabase/migrations/20260508100100_engine_state_archive_job.sql:21-44`)
  establishes lean archive semantics: mirror source columns + `archived_at`,
  service_role write, no live-write path.

## Considered Options

1. **Dual semantics** — `payroll_ledger_archive` receives Bubble rows AND
   future v3 cascade writes. Rejected: violates invariants #1 and #7.
2. **Archive + rename** — rename to `payroll_ledger_bubble_archive` to
   remove ambiguity, define as Bubble-only. Considered; rejected because
   the table name `payroll_ledger_archive` is already stable in the plan
   and the semantic is fixable via ADR.
3. **Archive-only with forward reference** — this ADR fixes the semantic
   as archive-only; the operational v3 payroll table is deferred to a
   future ADR when v3's cascade payroll layer is designed. Accepted.

## Decision Outcome

Chosen: **Option 3 — `payroll_ledger_archive` is archive-only for Bubble
historical data. The operational v3 payroll ledger is a separate concern
deferred to a future ADR.**

### Clause A — Role definition

`public.payroll_ledger_archive` is:

- A **read-only historical store** for Bubble `⏱️salary_transaction` rows
- Populated exclusively by strike-mcp via INSERT with
  `source = 'bubble_migration'` (ADR-0107, ADR-0108)
- NOT a live cascade table. No v3 cascade engine writes to this table.
- A data source for Tripletex historical sync (read-only query target)

### Clause B — Immutability (RLS)

After initial strike-mcp INSERT, rows are immutable. RLS policies:

```sql
ALTER TABLE public.payroll_ledger_archive ENABLE ROW LEVEL SECURITY;

-- Workspace-scoped read for admins and the profile-owner
CREATE POLICY "select_payroll_archive" ON public.payroll_ledger_archive
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- Service role only for INSERT (strike-mcp path)
CREATE POLICY "insert_payroll_archive_service_role"
  ON public.payroll_ledger_archive
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Nobody updates or deletes archive rows — EVER
CREATE POLICY "no_update_payroll_archive" ON public.payroll_ledger_archive
  FOR UPDATE USING (false);

CREATE POLICY "no_delete_payroll_archive" ON public.payroll_ledger_archive
  FOR DELETE USING (false);
```

Immutability is enforced at RLS layer (per steward/supervisor both) rather
than trigger. RLS `USING (false)` blocks every attempt including admin
UPDATE. Any future need to amend archive rows requires an ADR explicitly
amending this clause.

### Clause C — Column shape (lean + raw_json)

Per supervisor's `engine_state_archive` precedent (lean column set + no
JSONB blob) and steward's completeness concern, the column shape is a
Tripletex-sync-ready minimum plus one JSONB column for Bubble fidelity:

**Typed columns (for Tripletex sync + query paths):**
- `payroll_ledger_id uuid PK`
- `workspace_id uuid NOT NULL FK` (per CLAUDE.md workspace rule)
- `profile_id uuid NOT NULL FK`
- `schedule_shift_id uuid NULL FK` (Bubble may have orphans — council B3 verdict)
- `department_id uuid NULL FK` (orphan-tolerant)
- `team_id uuid NULL FK` (orphan-tolerant)
- `transaction_date date NOT NULL`
- `hours numeric(8,2)`
- `base_salary numeric(12,2)`
- `total_salary numeric(12,2)`
- `a_melding_code text`
- `accounting_account_code text`
- `bubble_record_id text NOT NULL`
- `source text NOT NULL DEFAULT 'bubble_migration'` (CHECK via ADR-0108
  semantics; default differs from other 12 tables because this table exists
  solely for bubble_migration data)
- `archived_at timestamptz NOT NULL DEFAULT now()`

**Fidelity column:**
- `raw_json jsonb NOT NULL` — complete original Bubble row for replay /
  re-derivation / unforeseen questions

**Indexes:**
- `UNIQUE (workspace_id, bubble_record_id)` — composite uniqueness per
  council B2 verdict (Bubble IDs are per-tenant, not global)
- `idx_payroll_archive_profile_date (profile_id, transaction_date)` —
  primary query path (Tripletex sync per profile per period)
- Partial indexes on nullable FKs: `idx_payroll_archive_shift WHERE
  schedule_shift_id IS NOT NULL` etc.

Columns NOT included (considered but rejected):
- `work_date`, `start_time`, `stop_time` — redundant with `raw_json` fidelity
- `is_worktime`, `salary_category`, `salary_type_name` — derivable from
  `a_melding_code` + `raw_json`
- `comment` — per-row notes live in `raw_json`

Rationale: `raw_json` captures Bubble shape completely; typed columns
cover Tripletex-sync + indexed query paths. Adding every Bubble column as
typed duplicates storage and creates drift risk.

### Clause D — No partitioning in Phase 1

Per council B4 verdict: no partitioning. 17 607 rows × N workspaces is
not partition-scale. No partitioned tables exist in this codebase (zero
precedent). Partitioning commits to a dimension (workspace vs date) before
access patterns are observed. If growth warrants it (>100k rows per
workspace, or access patterns prove workspace-scoped queries dominate),
introduce partitioning via dedicated ADR.

### Clause E — Orphan reporting (post-migration audit)

Per council B3 verdict: FK nullability on shift/department/team tolerates
Bubble orphans (deleted shifts with remaining payroll rows, etc.).
Strike-mcp MUST emit a post-migration report with counts per workspace:

- Rows with NULL `schedule_shift_id`
- Rows with NULL `department_id`
- Rows with NULL `team_id`

This report is a compensating control for relaxed FK strictness. Lives in
strike-mcp's repo-local log per ADR-0107 Clause E.

### Clause F — Operational payroll ledger (forward reference, not scope)

v3's own payroll derivation will eventually produce rows to a live
operational payroll ledger table. That table:

- Is NOT `payroll_ledger_archive`. This ADR forbids dual semantics.
- Is a future ADR's scope. Name and schema TBD when v3 payroll derivation
  is designed.
- Will likely integrate with C3 commercial control plane and
  `shift_cost_snapshot` (ADR-0095 / 0096 / 0100 family).

This ADR does NOT commit to a name, schema, or timeline for the operational
ledger. Referenced here only to explicitly exclude it from archive scope.

## Rules & Consequences

- **Good, because** single-role table: archive only. Cascade invariants
  #1 and #7 preserved.
- **Good, because** lean typed-columns + raw_json balances query-path
  indexability against complete fidelity.
- **Good, because** RLS `USING (false)` UPDATE/DELETE enforces immutability
  at the source — nobody can accidentally mutate history.
- **Good, because** orphan-tolerant FKs preserve messy Bubble reality
  honestly; orphan-count audit is a compensating control.
- **Bad, because** two payroll tables (archive vs future operational)
  means Tripletex sync queries must UNION them for a complete view. Sync
  code must be aware of both.
- **Bad, because** `raw_json` is schema-less — future queries against it
  depend on stable Bubble field names. Strike-mcp locks a schema version
  via its decision log (ADR-0002).
- **Agent Impact:**
  - Tripletex sync code reads `payroll_ledger_archive` for historical
    periods, reads the (future) operational payroll table for post-cutover
    periods, UNIONs for queries spanning cutover date.
  - No agent writes to this table. Strike-mcp via service role is the
    only INSERT path.
  - Any code review that sees `INSERT INTO payroll_ledger_archive` from
    non-strike-mcp context is a violation to flag.

## References

- ADR-0057 — payroll-schema-separation
- ADR-0095 — shift-lifecycle-five-layer-architecture (C3 commercial scope)
- ADR-0100 — daily_close-as-aggregate-consumer
- ADR-0107 — Strike-MCP Telemetry Boundary (INSERT-only source)
- ADR-0108 — Source Discriminator Pattern
- `supabase/migrations/20260508100100_engine_state_archive_job.sql` —
  archive precedent
- CLAUDE.md — Cascade Core Model
- Council session 2026-04-15

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
