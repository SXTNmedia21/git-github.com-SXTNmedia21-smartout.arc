---
title: "Employment Contract Detail — Append-Only Versioning of Tripletex-Canonical Fields"
id: ADR-0111
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0111: Employment Contract Detail — Append-Only Versioning

## Context and Problem Statement

Tripletex's `EmploymentDetails` endpoint expects append-only history per
effective_date: every change to employment terms (position, salary,
working hours scheme, etc.) is recorded as a new `EmploymentDetails` row
with the date the change took effect. This is different from ADR-0082
which defined pre-send drafts and parent_contract_id lineage between
signed contracts.

The question: how does v3 represent this append-only history without:

- Duplicating fields that live on `employment_contract` (single source of
  truth, cascade invariant #1)
- Colliding with ADR-0082's "drafts are not versions" rule
- Over-specifying the runtime insertion mechanism before the composition
  engine integration is designed

Council 2026-04-15 resolved this with a concrete rule + narrow column
scope + deferred trigger mechanism.

## Decision Drivers

- **Tripletex API contract** — append-only EmploymentDetails per
  effective_date.
- **ADR-0082** — drafts live on the contract row (mutable until sent);
  parent_contract_id tracks lineage between signed contracts. Must not
  collide.
- **Cascade invariant #1** — single source of truth. Do not mirror fields
  whose canonical home is on `employment_contract`.
- **Council A1 verdict** — surrogate PK + UNIQUE constraint (matches
  `shift_cost_snapshot` precedent at
  `supabase/migrations/20260506100000_shift_derivation_layer.sql:132-133`).
- **Council A2 verdict** — Tripletex-only columns; existing HR fields
  (position_title, hourly_rate, monthly_salary, employment_percentage,
  start_date, end_date) stay on parent.
- **Council H1 verdict** — concrete trigger rule (not abstract), runtime
  mechanism deferred.

## Considered Options

1. **Mirror all `employment_contract` columns + effective_date** — rejected
   per A2; duplicates source of truth; creates drift risk.
2. **Abstract rule only, no column list** — rejected per H1; leaves
   strike-mcp without concrete backfill rule.
3. **Concrete rule + narrow column list (Tripletex-only) + deferred
   runtime mechanism** — accepted.

## Decision Outcome

Chosen: **Option 3 — concrete rule, narrow columns, deferred runtime
mechanism.**

### Clause A — Table schema

```sql
CREATE TABLE public.employment_contract_detail (
  detail_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_contract_id uuid NOT NULL REFERENCES public.employment_contract(contract_id) ON DELETE CASCADE,
  workspace_id           uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  effective_date         date NOT NULL,

  -- Tripletex-canonical columns (mirror M2 additions ONLY)
  occupation_code        text,
  employment_form        text CHECK (employment_form IS NULL OR employment_form IN ('permanent','temporary')),
  remuneration_type      text CHECK (remuneration_type IS NULL OR remuneration_type IN ('monthly','hourly','commission')),
  working_hours_scheme   text,
  employee_type_id       uuid REFERENCES public.employee_type(employee_type_id),

  source                 text NOT NULL DEFAULT 'operational'
                         CHECK (source IN ('operational','bubble_migration','v3_engine')),
  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ux_contract_detail_effective UNIQUE (employment_contract_id, effective_date)
);
```

- **PK:** surrogate `detail_id` per A1 verdict (matches
  `shift_cost_snapshot` pattern).
- **UNIQUE constraint:** prevents duplicate detail rows for the same
  contract × effective_date (idempotency for strike-mcp backfill).
- **Columns:** Tripletex-only. Existing HR fields stay on parent — if a
  non-Tripletex field needs versioning later, that is a separate ADR.
- **`workspace_id`:** denormalized for RLS (workspace_id IN
  get_workspace_ids_for_user).
- **`source`:** follows ADR-0108 pattern. `'bubble_migration'` when
  strike-mcp backfills from Bubble history.

### Clause B — Insertion rule (concrete)

**A new `employment_contract_detail` row MUST be inserted when any of the
following columns on the parent `employment_contract` changes value:**

1. `occupation_code`
2. `employment_form`
3. `remuneration_type`
4. `working_hours_scheme`
5. `employee_type_id`

`effective_date` = the business date the change takes effect (admin-supplied
or composition-derived). `created_at` = DB write time (auditability).

Changes to non-Tripletex columns (e.g., `position_title`, `hourly_rate`) do
NOT trigger a new detail row. If those fields ever need versioning, expand
this rule via amendment.

### Clause C — Relationship to ADR-0082

- **ADR-0082** `parent_contract_id` lineage: inter-contract versioning
  between signed contracts (supersession). Applies when admin issues a
  new contract that replaces an old one (including post-migration
  supersession per ADR-0109).
- **This ADR** `employment_contract_detail`: intra-contract state
  versioning per effective_date. Applies to the SAME contract changing
  over time (salary raise, role change) without superseding the contract
  itself.

Both are append-only. Both have UNIQUE constraints preventing duplicates.
Neither mutates historical rows. They coexist cleanly because they answer
different questions:

- "What was Anna's contract lineage?" → `parent_contract_id` chain
- "What were Anna's employment terms on date X?" → latest
  `employment_contract_detail` with `effective_date <= X`

Pre-send drafts (ADR-0082 Clause 1) do NOT produce detail rows — detail is
post-send only.

### Clause D — Strike-mcp backfill rule

Per council H1, the concrete rule gives strike-mcp a deterministic backfill
behavior:

1. For each migrated `employment_contract` row (`source='bubble_migration'`),
   enumerate Bubble's history of the 5 Clause-B columns.
2. For each distinct combination of values, INSERT one `employment_contract_detail`
   row with `effective_date` = the Bubble start date of that combination.
3. `source = 'bubble_migration'` on each detail row.
4. UNIQUE constraint enforces idempotency on re-run.

If Bubble data has only one combination (common — most employees don't
change employment form mid-tenure), only one detail row is backfilled.

### Clause E — Migrated contract immutability (ADR-0109 integration)

Detail rows for migrated contracts (`source='bubble_migration'` on parent)
are **read-only after strike-mcp backfill**. No new detail rows are added
post-migration for migrated parents because:

- ADR-0109 Clause C blocks UPDATE on migrated `employment_contract` rows
- Supersession (ADR-0109 Clause D) creates a NEW parent, not new details
  on the old parent

Strike-mcp is the only writer for detail rows with
`source='bubble_migration'`. Runtime code writes only to detail rows
whose parent is `source IN ('operational','v3_engine')`.

### Clause F — Runtime insertion mechanism (DEFERRED)

This ADR explicitly does NOT commit to:

- Database trigger on `employment_contract` UPDATE → INSERT detail
- Application-level `upsert_employment_contract_detail` RPC
- Composition-engine callback on `apply_cascade`

That choice is future work, gated on composition-engine integration design.
Until then, detail-row writes for non-migrated parents come from explicit
INSERTs in code paths that update the 5 Clause-B columns. Code review
enforces the rule.

When the mechanism lands, it is a separate ADR that amends this one with
the enforcement path.

### Clause G — RLS

```sql
ALTER TABLE public.employment_contract_detail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_employment_contract_detail"
  ON public.employment_contract_detail FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "admin_write_employment_contract_detail"
  ON public.employment_contract_detail FOR INSERT
  WITH CHECK (public.is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "service_role_employment_contract_detail"
  ON public.employment_contract_detail FOR ALL
  USING (auth.role() = 'service_role');

-- Append-only for non-service-role
CREATE POLICY "no_update_employment_contract_detail"
  ON public.employment_contract_detail FOR UPDATE USING (false);

CREATE POLICY "no_delete_employment_contract_detail"
  ON public.employment_contract_detail FOR DELETE USING (false);
```

Service role can do anything (for migration supersession / corrections in
exceptional cases). Admin can INSERT (via future mechanism). Nobody UPDATEs
or DELETEs.

## Rules & Consequences

- **Good, because** concrete Clause B rule gives strike-mcp a deterministic
  backfill.
- **Good, because** narrow column scope (5 Tripletex fields only) prevents
  source-of-truth drift with parent `employment_contract`.
- **Good, because** UNIQUE constraint enforces idempotency at the DB layer.
- **Good, because** coexists cleanly with ADR-0082 `parent_contract_id`
  lineage — different questions, different mechanisms.
- **Good, because** deferred runtime mechanism (Clause F) leaves
  composition-engine integration open.
- **Bad, because** "code review enforces detail-row writes on the 5
  columns" is a soft enforcement until the runtime mechanism lands. Easy
  to forget.
- **Bad, because** adding HR-field versioning later (e.g., hourly_rate over
  time) requires amending this ADR — not a drop-in extension.
- **Agent Impact:**
  - Strike-mcp backfills detail rows per Clause D.
  - Botsson `updateEmploymentContract` tool (if it exists / when it
    exists): if the update changes any Clause B column, the tool MUST
    also INSERT a detail row in the same transaction. Code-review gate
    until runtime mechanism ADR lands.
  - Tripletex sync reads detail rows for EmploymentDetails API calls,
    ordered by `effective_date`.

## References

- ADR-0076 — Contract Composition as Cascade Derivation (composition path
  writes detail rows for v3-authored contracts)
- ADR-0082 — Contract Drafts Are Not Versions (parent_contract_id lineage
  is a different mechanism)
- ADR-0095 / 0096 — shift_cost_snapshot surrogate-PK + UNIQUE precedent
- ADR-0108 — Source Discriminator Pattern
- ADR-0109 — Migrated Profile Contract Shell (Clause E integration)
- Tripletex API: `EmploymentDetails` append-only endpoint
- Council session 2026-04-15

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
