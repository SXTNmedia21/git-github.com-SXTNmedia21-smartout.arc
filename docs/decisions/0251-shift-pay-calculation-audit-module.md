---
title: "shift_pay_calculation Full Audit Module — 5-year retention per Bokføringsloven §13"
id: ADR_0251
renumbered_from: ADR_0246
status: accepted
layer: decision
created: 2026-04-30
updated: 2026-05-06
supersedes: []
relates_to:
  - ADR_0076
  - ADR_0111
  - ADR_0241
  - ADR_0243
---

# ADR-0251: shift_pay_calculation Full Audit Module

> Renumbered from ADR-0246 to ADR-0251 on 2026-04-30 due to filename collision with `0246-engine-state-vs-engine-sessions-ontology.md` (existed before this ADR was authored).

## Context and Problem Statement

PLAN-contract-employee.md Phase 5 (line 138) specifies that shift_cost
calculation reads `contract_pay_rule` per ARCHITECTURE §5.7. ARCHITECTURE
§5.7 (line 475) states: "Skriver til `shift_pay_calculation` (egen tabell,
audit-trail 5 år)." The architecture doc further names `shift_pay_calculation`
as out of scope for the Contracts Module proper (ARCHITECTURE §1 "Ikke i
scope", line 36) and defers it explicitly: ARCHITECTURE §8 (line 531)
repeats "shift_pay_calculation (egen modul, ikke contracts)."

The deferral is codified in the local contract-service ADR-0001 §"Konsekvenser"
point 3 (file: `docs/architecture/contract-service/ADR-0001-kontrakt-og-
lonnsprofil-fundament.md`, line 225): "Ny ADR for `shift_pay_calculation` +
audit-trail-tabell trengs (5 års lagring per Bokføringsloven)."

Without this ADR, three things are broken:

1. **No schema.** `shift_pay_calculation` is named in architecture but has
   no migration, no table in `database.types.ts`, and no RLS. The name
   appears only in free-text comments and ARCHITECTURE prose.
2. **No retention policy.** Bokføringsloven §13 mandates that accounting
   records — including lønnsmaterialet — must be retained for 5 years from
   the end of the accounting year (`regnskapsåret`) to which they pertain.
   An absence of a formal table means there is no retention cutoff anchor,
   no archival path, and no delete-prohibition at the schema layer.
3. **No Botsson source.** PLAN Phase 5 line 139 requires a `salary_query`
   capability that allows Botsson to answer "Hvorfor fikk jeg denne lønnen?"
   with kilde-referanse (rate applied, rule_id, Riksavtalen-paragraph, vakt
   reference). Without a line-item audit table, the capability has no source.

The existing `shift_cost_snapshot` table (C3 Commercial, confirmed in
`packages/supabase/src/database.types.ts` lines 16955–17030) is a
per-shift aggregate snapshot. It records `base_cost`, `gross_cost`,
`total_cost` and a `tariff_rate_snapshot JSONB` column, but does not record
one row per pay rule applied. It is a settlement-level summary, not a
per-rule audit trail. These are two distinct artifacts at two distinct
abstraction levels; this ADR defines the lower-level per-rule table.

This ADR ends the deferral.

## Decision Drivers

- **Bokføringsloven §13 (5-year retention).** Lønnsmaterialet er
  regnskapsmateriale. The 5-year clock starts at the end of the accounting
  year to which the shift belongs — not from `created_at` on the row. The
  schema must capture `shift_period_end_date` (or derivable shift date) as
  the retention anchor.
- **Botsson salary_query capability** requires a structured, queryable
  per-rule source (PLAN Phase 5 line 139; ARCHITECTURE §5.7 line 476).
  JSONB stored in `shift_cost_snapshot.tariff_rate_snapshot` is not
  queryable via SQL joins and cannot serve as the kilde-referanse the
  capability needs.
- **ADR-0076 snapshot-and-forward principle** (accepted,
  `docs/decisions/0076-contract-composition-as-cascade-derivation.md`
  lines 64–86): override-data must carry provenance on the artifact that
  was overridden. The same principle applies to pay-rule application:
  the rate actually applied must be snapshotted at calculation time so that
  future `framework_rule` changes do not retroactively alter the audit row.
- **ADR-0111 append-only invariant** (accepted,
  `docs/decisions/0111-employment-contract-detail-versioning.md` lines
  59–98): the `shift_cost_snapshot` PK pattern (surrogate UUID +
  UNIQUE constraint, cited in ADR-0111 §"Council A1 verdict") is precedent
  for this module.
- **ADR-0243 trigger-SECURITY requirement** (proposed,
  `docs/decisions/0243-obligation-lifecycle-trigger-semantics.md` lines
  39–54): any trigger that does cross-table SELECT must be declared
  SECURITY DEFINER with explicit `SET search_path = public, pg_temp`.
- **ADR-0204 gatedMutation** (accepted,
  `docs/decisions/0204-gated-mutation-composition-orchestrator.md` lines
  43–67): writes to governance-gated entities must go through the
  orchestrator. Calculation events are system-originated (not interactive),
  so the `channel` is `'system'` and the `actor_profile_id` is the
  engine-state actor (or system service role) — but the orchestrator call
  chain still applies to prevent ungated direct writes.
- **Multi-tenant isolation.** All workspace-scoped tables require RLS with
  both JWT and API key paths (CLAUDE.md "Never create workspace-scoped
  tables without BOTH JWT and API key RLS policies").

## Considered Options

### A — Extend `shift_cost_snapshot` with per-rule rows

Add a `rule_breakdown JSONB[]` column or a `shift_cost_line_item` child
table where `shift_cost_snapshot` is the parent. The aggregate snapshot
becomes the parent record; line items are children.

Rejected because:
- `shift_cost_snapshot` has a `snapshot_basis` enum (`'planned' | 'actual'`,
  `database.types.ts` line 20395) that ties it to the D6 planned/actual
  reconciliation cycle. Pay-rule audit events do not belong to that cycle.
- Coupling the retention obligation to `shift_cost_snapshot` would force
  the 5-year no-delete policy onto the aggregate, complicating the daily
  reconciliation read pattern (`snapshot_shift_cost` RPC at
  `database.types.ts` line 19911).
- A child `shift_cost_line_item` would be structurally identical to the
  new table proposed here, but with worse naming and a forced FK to
  `shift_cost_snapshot` that may not always exist (calculation can be
  triggered before a snapshot is written).

### B — New standalone table `shift_pay_calculation_event`

An append-only, per-shift-per-rule table. Owning module: C3 Commercial
(per CLAUDE.md cascade model: "C3 Commercial: shift_cost_snapshot"). The
aggregate `shift_cost_snapshot` remains the settlement-level C3 view;
`shift_pay_calculation_event` is the line-item audit trail underneath it.

Chosen. See Decision Outcome.

### C — Embed line items in JSONB on `shift_cost_snapshot`

Store all rule applications as a JSONB array on `shift_cost_snapshot
.supplements` (existing column, `database.types.ts` line 16977).

Rejected because:
- JSONB is not queryable via SQL joins (same objection raised in ADR-0076
  §"Bad, because compliance_overrides JSONB" at line 131).
- Botsson `salary_query` needs to join rule rows against `contract_pay_rule`
  and `framework_rule` — JSONB prevents relational queries.
- Retention enforcement (delete-prohibition, archival) cannot be enforced
  per-row on JSONB array elements.

## Decision Outcome

Chosen option: **Option B — new standalone table
`shift_pay_calculation_event`**, because it satisfies the retention
obligation at the schema layer, enables relational read patterns for
Botsson, keeps the snapshot table's reconciliation semantics intact,
and follows the ADR-0111 append-only precedent cleanly.

---

### A. Table schema

```sql
CREATE TABLE public.shift_pay_calculation_event (
  -- Identity
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL
                            REFERENCES public.workspace(workspace_id)
                            ON DELETE RESTRICT,   -- never cascade-delete accounting records

  -- What shift
  shift_id                uuid NOT NULL
                            REFERENCES public.schedule_shift(id)
                            ON DELETE RESTRICT,   -- same; audit must outlive shift row
  profile_id              uuid NOT NULL
                            REFERENCES public.profile(profile_id)
                            ON DELETE RESTRICT,

  -- What rule was applied
  contract_pay_rule_id    uuid NOT NULL
                            REFERENCES public.contract_pay_rule(id)
                            ON DELETE RESTRICT,
  framework_rule_id       uuid                   -- NULLABLE: base pay has no Riksavtalen reference
                            REFERENCES public.framework_rule(id)
                            ON DELETE RESTRICT,

  -- Snapshotted values at calculation time (immutable even if parent rule changes)
  rule_type               text NOT NULL,         -- mirrors contract_pay_rule.rule_type at calc-time
  rate_value_applied      numeric(10, 4) NOT NULL,  -- the actual rate used (NOK/hour, %, etc.)
  rate_type               text NOT NULL,         -- mirrors contract_pay_rule.rate_type at calc-time
  source_text_applied     text,                  -- Riksavtalen §X.Y text at calc-time (shown to employee)
  quantity_value          numeric(10, 4) NOT NULL,  -- hours worked, shift count, etc.
  subtotal                numeric(12, 2) NOT NULL,  -- rate_value_applied × quantity_value (after rounding)

  -- Provenance (ADR-0076 snapshot-and-forward)
  provenance              jsonb NOT NULL DEFAULT '{}',
  -- Minimum shape:
  -- {
  --   "framework_snapshot": { ... },   -- K1a rule values at calculation time
  --   "compliance_overrides": [ ... ], -- per ADR-0076 §"Data model resolution"
  --   "trigger_condition_evaluated": { ... },  -- the trigger_condition that matched
  --   "stacked_with_event_ids": [ "uuid", ... ] -- IDs of sibling events this stacked with
  -- }

  -- Calculation context
  calculated_at           timestamptz NOT NULL DEFAULT now(),
  calculated_by           text NOT NULL,
  -- 'system' for engine-driven calc; engine_state_id UUID for engine-orchestrated calc;
  -- 'manual_recalc:<actor_profile_id>' for admin-triggered recalculation.
  engine_state_id         uuid,                  -- nullable; FK deferred until engine_state table confirmed
  shift_period_end_date   date NOT NULL,
  -- The last date of the pay period the shift belongs to.
  -- This is the Bokføringsloven §13 retention anchor: 5-year clock starts
  -- at the close of the accounting year that contains shift_period_end_date.
  -- NOT created_at — per ADR-0241 §"Lovsen Amendments 2026-04-29" point 7
  -- (file: docs/decisions/0241-contract-schema-migration-foundation.md line 83).

  -- Append-only control: supersession chain (recalculation)
  superseded_by_event_id  uuid                   -- NULLABLE; set only on recalculation
                            REFERENCES public.shift_pay_calculation_event(id)
                            ON DELETE RESTRICT,
  superseded_at           timestamptz,           -- set when superseded_by_event_id is written

  -- Audit timestamps
  created_at              timestamptz NOT NULL DEFAULT now()
  -- No updated_at: this table is append-only (see Clause B below)
);
```

**Column justifications:**

- `workspace_id`: denormalized for RLS (CLAUDE.md "Never bypass RLS for
  convenience"). `ON DELETE RESTRICT` because accounting records must not
  disappear when workspace is soft-closed.
- `shift_id`: the shift this calculation belongs to. `ON DELETE RESTRICT`
  because the accounting record must outlive the shift operational record.
- `profile_id`: the employee. Required for Botsson `salary_query` to scope
  results to "mine" without joining through shift.
- `contract_pay_rule_id`: the rule that generated this line. The rule may
  change later (raise, renegotiation) — the snapshot columns below preserve
  the actual values used.
- `framework_rule_id`: NULLABLE because base pay rules (`rule_type='base'`)
  may not reference a Riksavtalen rule. When present, this enables "which
  Riksavtalen paragraph justified this rate?" queries.
- `rule_type`, `rate_value_applied`, `rate_type`, `source_text_applied`:
  snapshotted at calculation time. Per ADR-0076 §"snapshot-and-forward"
  (line 82): the contract already applied these values; changes to the
  parent rule must not mutate audit history.
- `quantity_value`: hours worked for `fixed_per_hour`; shift count for
  `fixed_per_shift`; dimensionless multiplier for `percent_of_base`.
- `subtotal`: the computed line amount. Redundant given rate × quantity,
  but necessary because rounding is applied at calculation time and must
  not drift on re-read.
- `provenance JSONB`: per ADR-0076 cascade invariant #8, all outputs carry
  provenance. Minimum shape records the framework snapshot, any compliance
  overrides, the trigger condition that fired, and stacking context.
- `calculated_by`: text discriminator rather than a FK to avoid coupling to
  a specific actor model. Format: `'system'`, `'engine_state:<uuid>'`, or
  `'manual_recalc:<profile_id>'`.
- `engine_state_id`: nullable reference to the engine_state instance that
  orchestrated this calculation. Not a hard FK in this ADR because
  `engine_state.id` references the process engine (separate from
  `engine_sessions`); the relationship is informational, not enforced.
- `shift_period_end_date`: the Bokføringsloven §13 retention anchor. The
  5-year clock runs from the end of the accounting year that contains this
  date. Using shift date (not `created_at`) per ADR-0241 §"Lovsen
  Amendments 2026-04-29" point 7 (line 83 of ADR-0241): "5 år from
  `regnskapsår_slutt` for lønnsmaterialet, NOT from `terminated_at`."
- `superseded_by_event_id` / `superseded_at`: for recalculation chains.
  The original event is never deleted; a new event is appended; the
  original event records which newer event supersedes it. This makes the
  full audit chain traversable without DELETE.

**Indexes:**

```sql
-- Primary read pattern for Botsson salary_query
CREATE INDEX shift_pay_calc_profile_shift_idx
  ON public.shift_pay_calculation_event (profile_id, shift_id);

-- Retention scan: find rows eligible for archival
CREATE INDEX shift_pay_calc_period_end_idx
  ON public.shift_pay_calculation_event (shift_period_end_date);

-- Active (non-superseded) rows per shift — used in daily enforcement
CREATE INDEX shift_pay_calc_active_idx
  ON public.shift_pay_calculation_event (shift_id)
  WHERE superseded_by_event_id IS NULL;

-- Workspace-scoped queries (RLS filter support)
CREATE INDEX shift_pay_calc_workspace_idx
  ON public.shift_pay_calculation_event (workspace_id, calculated_at DESC);
```

---

### B. Append-only invariant

The table is append-only with a single exception: the `superseded_by_event_id`
and `superseded_at` columns may be SET on an existing row when a
recalculation appends a replacement event. No other column may be updated.
No row may ever be deleted during the 5-year retention window.

**Enforcement via RLS policies (not DB trigger, per justification below):**

```sql
-- No UPDATE policy for regular users
CREATE POLICY "no_update_shift_pay_calc"
  ON public.shift_pay_calculation_event
  FOR UPDATE USING (false);

-- No DELETE policy for regular users
CREATE POLICY "no_delete_shift_pay_calc"
  ON public.shift_pay_calculation_event
  FOR DELETE USING (false);

-- Service role has a narrow UPDATE policy: only supersession columns
CREATE POLICY "service_role_supersede_shift_pay_calc"
  ON public.shift_pay_calculation_event
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (
    auth.role() = 'service_role'
    -- Application layer must enforce: only superseded_by_event_id + superseded_at changed
  );
```

**Trigger vs. constraint approach — justification:**

A DB trigger enforcing "only supersession columns may be updated" would
require a SECURITY DEFINER trigger reading `OLD.*` vs `NEW.*` and raising
an exception if non-supersession columns changed. This pattern is correct
per ADR-0243 §"Required changes" (line 51). However, a trigger on a
high-volume table introduces write amplification on every shift calculation.

The chosen approach restricts UPDATE to service role at the RLS layer,
which is already a strong enforcement. The application layer (shift-engine
calculation path) uses INSERT only; supersession is an explicit RPC call.
This is a deliberate trade-off: the constraint is softer than a trigger,
but the `service_role` UPDATE path is only reachable by server-side code
that can be code-reviewed. A future amendment may add a SECURITY DEFINER
trigger if evidence of misuse emerges.

**The DELETE prohibition is permanent.** Even for rows superseded by a
later event, the superseded row stays in the table. Bokføringsloven §13
does not permit deletion of accounting records within the retention window
regardless of whether they were later corrected. The archival process
(Clause E) moves rows to cold storage after the 5-year window; it does not
delete them.

---

### C. Recalculation semantics

When `contract_pay_rule` changes for a future period (employee raise,
renegotiation, tariff version bump), shifts already calculated MUST NOT be
automatically recalculated. Per ADR-0076 §"snapshot-and-forward" (lines
82–86): the rate at calculation time is the accounting truth. Changing the
rule changes future calculations only.

**Recalculation trigger:** only via explicit admin action:

1. Admin navigates to shift-cost detail for a specific shift.
2. Admin selects "Recalkuler lønn" — requires C4 authority level ≥
   `confirm` for capability `contract_pay_calc_recalc`.
3. Shift-engine re-runs the evaluation pipeline with the rules active
   at the ORIGINAL `shift_period_end_date` (not today's rules), unless the
   admin explicitly selects "bruk gjeldende regler" (use current rules).
4. Each new event row is INSERTed with a fresh UUID.
5. Each original event row for the same `shift_id` is UPDATEd via the
   service-role supersession path: `superseded_by_event_id = <new event id>`,
   `superseded_at = now()`.
6. `shift.pay_queried` telemetry emitted with `recalc: true`.

**The supersession chain makes the audit trail complete.** A reader can
traverse the full history for any shift: start with rows WHERE
`superseded_by_event_id IS NULL` (current), follow `superseded_by_event_id`
backwards to earlier calculations. The chain terminates at the first event
(which has `superseded_at = NULL`).

**Tariff version bump (bulk recalculation):** when Riksavtalen is
renegotiated and the new rates take effect from a future date, no existing
event rows are recalculated. The new rates apply to shifts with
`shift_period_end_date >= effective_from` of the new framework_rule. This
is the same forward-only principle used by `employment_contract_detail`
(ADR-0111 §"Clause B", line 101–115): new rows for new periods, history
untouched.

---

### D. Read pattern for Botsson `salary_query`

The `salary_query` capability is channel-restricted to `chat` per
ADR-0078 (voice is forbidden for PII-adjacent financial data). The
capability reads from `shift_pay_calculation_event` to answer:
"Du tjente X på vakt Y — fordi Z."

**Chosen approach: RPC `get_salary_breakdown(profile_id, period)`**

Rather than direct table access via the workspace-api gateway, the
capability invokes a Postgres function:

```sql
CREATE OR REPLACE FUNCTION public.get_salary_breakdown(
  p_profile_id  uuid,
  p_shift_id    uuid DEFAULT NULL,   -- if NULL, returns period summary
  p_period_start date DEFAULT NULL,
  p_period_end   date DEFAULT NULL
)
RETURNS TABLE (
  event_id              uuid,
  shift_id              uuid,
  rule_type             text,
  source_text_applied   text,
  rate_value_applied    numeric,
  rate_type             text,
  quantity_value        numeric,
  subtotal              numeric,
  calculated_at         timestamptz,
  is_current            boolean       -- TRUE when superseded_by_event_id IS NULL
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    e.id,
    e.shift_id,
    e.rule_type,
    e.source_text_applied,
    e.rate_value_applied,
    e.rate_type,
    e.quantity_value,
    e.subtotal,
    e.calculated_at,
    (e.superseded_by_event_id IS NULL) AS is_current
  FROM public.shift_pay_calculation_event e
  WHERE e.profile_id = p_profile_id
    AND e.workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND (p_shift_id IS NULL OR e.shift_id = p_shift_id)
    AND (p_period_start IS NULL OR e.shift_period_end_date >= p_period_start)
    AND (p_period_end IS NULL OR e.shift_period_end_date <= p_period_end)
  ORDER BY e.shift_period_end_date DESC, e.calculated_at DESC;
$$;
```

**Justification for RPC over direct table access:**

- Shape control: the RPC controls which columns are exposed, preventing
  accidental exposure of `provenance JSONB` (which contains
  `compliance_overrides` that may include admin justification text).
- Read-side authority pattern: per ADR-0204 §"Ordering rationale" (line
  124–131), capability authority gates must be evaluated before any data
  is returned. The capability tool calls `gate_action` with capability
  `salary_query` and `action_type = 'read'` before invoking the RPC.
  This is the read-side equivalent of `gatedMutation` for query tools.
- The `SECURITY DEFINER` + `SET search_path` pattern follows ADR-0243
  §"Required changes" item 3 (line 51), applied here to a read function.
- The `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))`
  clause inside the DEFINER function preserves per-employee scoping: an
  employee calling this RPC can only see their own workspace's data. The
  RPC is NOT a bypass of RLS — it re-implements the RLS predicate
  explicitly, which is the correct pattern for SECURITY DEFINER functions
  per CLAUDE.md "Never bypass RLS for convenience."

**Botsson tool shape:**

```ts
// packages/ai/src/tools/contract/salary_query.ts
// Context: AgentToolContext (per MEMORY.md "Tool Context Patterns")
export const salaryQueryTool = {
  name: "salary_query",
  channel: ["chat"],    // voice FORBIDDEN per ADR-0078
  description: "Retrieves a breakdown of pay for a shift or pay period, with rule citations.",
  // ... schema + handler calling get_salary_breakdown RPC
};
```

---

### E. Retention enforcement (Bokføringsloven §13)

**Retention window:**

Bokføringsloven §13 mandates 5 years of retention for regnskapsmateriale,
measured from the close of the accounting year the material pertains to.
For Norwegian businesses the accounting year is the calendar year (unless
a special fiscal year has been approved).

**Retention anchor:** `shift_period_end_date`, not `created_at`. A shift
worked on 15 December 2026 has `shift_period_end_date = 2026-12-31`
(the last date of its pay period). The accounting year is 2026. The 5-year
retention clock starts 2026-12-31. The row must not be archived before
2031-12-31 at the earliest.

**Archival trigger:** a scheduled cron job (separate sub-plan, not
specified here) runs annually after the preceding year's accounts are
closed (typically February of the following year). It:

1. Identifies rows WHERE
   `shift_period_end_date < date_trunc('year', now()) - interval '5 years'`.
2. INSERTs those rows into `shift_pay_calculation_archive` (same schema,
   see §"Archive table" below).
3. DELETEs the rows from the live table — the only legitimate DELETE path.
   Deletion from the live table after confirmed archival is permitted
   because the records are preserved in the archive table.

This job requires explicit manual confirmation before the DELETE step.
It is NOT an automated silent delete.

**Archive table:**

```sql
CREATE TABLE public.shift_pay_calculation_archive
  (LIKE public.shift_pay_calculation_event INCLUDING ALL);

ALTER TABLE public.shift_pay_calculation_archive
  ADD COLUMN archived_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN archive_batch_id uuid NOT NULL;
```

The archive table mirrors the live table schema (via `LIKE ... INCLUDING ALL`
so indexes and constraints are inherited). `archived_at` and
`archive_batch_id` are added for archival-run traceability. RLS is
identical: select via workspace membership, no UPDATE, no DELETE — ever.

**Partition vs. separate archive table:**

PostgreSQL native partitioning by year on `shift_pay_calculation_event`
was considered. Rejected because:
- Partitioning does not help the retention use case: we want to MOVE rows
  to a different table (different RLS policy, potentially different
  tablespace or cold storage), not just partition them in the same table.
- The archive table approach gives a clean "live vs. archived" signal
  without requiring declarative partition management in migrations.
- For query performance over the live table, the `shift_period_end_date`
  index (Clause A) gives O(log n) scans on the most common filter.
  Partitioning is premature optimization at current scale.

This decision may be revisited via an amendment if the table exceeds
10M rows and the period-end index scan becomes a bottleneck.

---

### F. Telemetry registration

Four events are registered in `packages/telemetry/src/registry.ts`.
All four destinations per CLAUDE.md telemetry contract: PostHog
(analytics), Logger (stdout), activity_trail (audit), engine_event
(workflow automation).

**`shift_pay.calculated`**
Emitted once per `shift_pay_calculation_event` INSERT (one per rule
applied). Destination: all four. Used by C3 commercial dashboards and
as the engine_event trigger for cost-projection workflows.

**`shift_pay.recalc_requested`**
Emitted when an admin triggers recalculation. Destination: all four.
Contains `shift_id`, `actor_profile_id`, `reason` (free text, admin
supplied). Used for audit trail: "who recalculated, when, and why."

**`shift_pay.superseded`**
Emitted when a supersession UPDATE is applied to an existing event row.
Destination: all four. Contains `original_event_id`, `new_event_id`,
`shift_id`. Separate from `recalc_requested` because a single recalc
request produces one `recalc_requested` event and N `superseded` events
(one per original event row for that shift).

**`shift_pay.queried`**
Emitted when Botsson invokes `get_salary_breakdown`. Destination:
PostHog (analytics), Logger, activity_trail. NOT engine_event — a read
query does not drive workflow automation. Contains `profile_id`,
`shift_id` (if queried), `period_start`, `period_end`, `row_count`.
Used to measure how often employees query their pay — product signal.

Event registration shape follows the dot-convention per ADR-0164 (season
prefix example) and existing `contracts.*` events at
`packages/telemetry/src/registry.ts` lines 2121–2394.

---

### G. Migration shape

This ADR triggers a new migration:

```
supabase/migrations/<YYYYMMDDHHMMSS>_shift_pay_calculation_event.sql
```

Timestamp must be greater than the current `development` HEAD maximum.
The migration author (Cycle 4 or later) must:

1. Create `shift_pay_calculation_event` per Clause A schema.
2. Create `shift_pay_calculation_archive` per Clause E.
3. Create all indexes per Clause A.
4. Enable RLS; add all policies per Clause B.
5. Create `get_salary_breakdown` RPC per Clause D.
6. Create cron-job registration (separate migration or pgcron row) per
   Clause E archival trigger.
7. After migration: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
   per CLAUDE.md "Never edit database.types.ts manually."

**Do not write the migration in this ADR.** Decision-only per task brief.

---

### H. Relationship to `shift_cost_snapshot`

`shift_cost_snapshot` (C3 Commercial, `database.types.ts` lines
16955–17030) remains the canonical settlement-level view. It holds
aggregated cost columns (`base_cost`, `gross_cost`, `total_cost`) plus
`tariff_rate_snapshot JSONB` and `supplements JSONB`. It is written by
`snapshot_shift_cost` RPC (`database.types.ts` line 19911).

`shift_pay_calculation_event` is the line-item audit trail: one row per
pay rule applied, per shift. These two tables answer different questions:

- "What did this shift cost in total?" → `shift_cost_snapshot`
- "Why did it cost that? Which rules fired, at what rates, for what quantities?" → `shift_pay_calculation_event`

The typical write order for a completed shift:

1. Shift-engine evaluates all `contract_pay_rule` for the employee.
2. One `shift_pay_calculation_event` row per rule that fired.
3. `shift_cost_snapshot` row written/updated via `snapshot_shift_cost` RPC,
   summing the subtotals from the event rows.

`shift_cost_snapshot` does NOT have an FK to `shift_pay_calculation_event`.
The relationship is implicit via `schedule_shift_id` (shared FK to the
same shift). This avoids a circular dependency and allows `shift_cost_snapshot`
to be written independently (e.g., for planned estimates before event rows
exist).

## Rules & Consequences

- **Good, because** Bokføringsloven §13 retention obligation has an explicit
  schema anchor (`shift_period_end_date`) and a no-DELETE policy. The
  accounting obligation is no longer informal.
- **Good, because** Botsson `salary_query` capability gains a structured,
  queryable source. "Hvorfor fikk jeg denne lønnen?" can now be answered
  with rule_id, Riksavtalen §X.Y citation, and applied rate — per
  ARCHITECTURE §5.7 line 476.
- **Good, because** the append-only + supersession pattern follows ADR-0111
  §"Clause B" (line 101) exactly: same invariant, same enforcement shape,
  same UNIQUE-constraint-for-idempotency rationale.
- **Good, because** ADR-0076 snapshot-and-forward principle is enforced
  at column level: `rate_value_applied`, `rule_type`, `source_text_applied`
  are snapshotted at INSERT time. Future changes to `contract_pay_rule`
  cannot retroactively alter the audit.
- **Good, because** the two-table separation (`shift_cost_snapshot` for
  aggregates, `shift_pay_calculation_event` for line items) avoids
  coupling the D6 reconciliation cycle to the accounting retention cycle.
- **Bad, because** new migration adds schema surface area: two new tables,
  one RPC, four telemetry events, four indexes, and a cron-job registration.
  Cycle 4 must author all of these before Phase 5 can close.
- **Bad, because** the `service_role`-only UPDATE path for supersession is
  softer enforcement than a SECURITY DEFINER trigger (see Clause B
  justification). If a future code path introduces a service-role UPDATE
  that corrupts non-supersession columns, the DB will not reject it. This
  is tracked as a known risk.
- **Bad, because** the archival cron job (Clause E) requires manual
  confirmation before the DELETE step — it cannot be fully automated
  without legal review of whether automated deletion of archived
  accounting records is permitted under current Norwegian praxis.
- **Agent Impact:**
  - Shift-engine calculation paths MUST INSERT into `shift_pay_calculation_event`
    (one row per rule fired) before writing `shift_cost_snapshot`.
  - The `salary_query` capability tool MUST call `gate_action` with
    `channel='chat'` before invoking `get_salary_breakdown`. Voice callers
    must be rejected at Layer 1 per ADR-0078.
  - Recalculation paths MUST use the service-role supersession UPDATE
    (not DELETE + re-INSERT). The audit chain must remain traversable.
  - Migration authors MUST specify `SECURITY DEFINER SET search_path =
    public, pg_temp` on the `get_salary_breakdown` function per ADR-0243
    §"Required changes" item 3.
  - Build agents implementing the shift-engine calculation pipeline MUST
    emit `shift_pay.calculated` via `@smartout/telemetry` emit() after
    each successful INSERT — not before, per ADR-0196 Invariant 11
    (no phantom emits, cited in ADR-0204 §"Invariant 11 compliance" line 136).

## Open Questions for Orchestrator Escalation

1. **`engine_state_id` FK requirement.** The `engine_state_id` column is
   nullable in this ADR. If all shift calculations are engine-driven (every
   shift calculation occurs inside an `engine_state` instance), the column
   should be NOT NULL with a hard FK. If some calculations are triggered
   outside the process engine (e.g., direct API call from shift-engine
   service), the column must remain nullable. Orchestrator to resolve by
   specifying whether shift-engine calculation is always engine-orchestrated
   or can be triggered ad-hoc.

2. **Archive table vs. archive partition.** This ADR chose a separate
   archive table over Postgres native partitioning by year (see Clause E
   justification). If the main table exceeds 10M rows before the first
   archival run (unlikely in year 1 but possible in year 3+), a partitioning
   amendment should be drafted. Orchestrator to flag for re-evaluation in
   the 12-month post-launch review.

3. **A-melding rapportering link.** ARCHITECTURE §7.3 (line 514) notes that
   "Contracts leverer kildedata via stable API" for A-melding rapportering.
   `shift_pay_calculation_event` is part of that kildedata (lønn per period,
   salary type code). The A-melding module (separate, out of scope per
   ARCHITECTURE §1 line 39) will need to query this table. Whether the
   `get_salary_breakdown` RPC is sufficient or a dedicated
   `get_salary_for_amelding` function is needed is out of scope here but
   the orchestrator should flag it before A-melding module design begins.

4. **Multi-arbeidsgiver edge case.** An employee with active profiles in
   two workspaces appears in both workspaces' `shift_pay_calculation_event`
   rows. Cross-workspace salary aggregation (for tax reporting: combined
   income across employers) is out of scope per ARCHITECTURE §12 (line 612:
   "Multi-arbeidsgiver edge case"). Flagged here because Skatteetaten
   A-melding requires total income across employers; the audit table does
   not help with that. Orchestrator to confirm this is deferred.

5. **Cron-job authority for archival DELETE.** The archival DELETE (Clause E)
   runs with service role. Under C4 governance, a destructive operation on
   an accounting table should require at minimum admin acknowledgement or a
   `change_proposal` of type `accounting_archive`. This ADR mandates manual
   confirmation but does not specify whether a `change_proposal` is required.
   Orchestrator to decide: C4-gated archival (more formal, slower) vs.
   admin-confirmed cron (simpler, sufficient for year 1).

6. **Relation to `shift_cost.calculated` telemetry name collision.** PLAN
   Phase 5 line 142 specifies event name `shift.cost_calculated`. This ADR
   proposes `shift_pay.calculated` (with underscore namespace separating
   area from verb). A naming decision must be made before Cycle 4 registers
   events in the registry to avoid two events for the same fact. Orchestrator
   to canonicalize.

## References

- `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md`
  line 225 — original deferral ("Ny ADR for shift_pay_calculation + audit-trail-tabell trengs")
- `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md`
  §5.7 lines 465–476 — shift pay evaluation flow and shift_pay_calculation table name
- `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md`
  §8 line 531 — explicit "not contracts module" scoping
- `docs/plans/PLAN-contract-employee.md` lines 135–142 — Phase 5 Daily Enforcement
- ADR-0076 (`docs/decisions/0076-contract-composition-as-cascade-derivation.md`)
  lines 64–86 — snapshot-and-forward + provenance on outputs (cascade invariant #8)
- ADR-0111 (`docs/decisions/0111-employment-contract-detail-versioning.md`)
  lines 59–98 — append-only invariant, UNIQUE constraint, surrogate PK precedent
- ADR-0241 (`docs/decisions/0241-contract-schema-migration-foundation.md`)
  line 83 — Bokføringsloven §13: retention anchor is regnskapsår-slutt not terminated_at
- ADR-0243 (`docs/decisions/0243-obligation-lifecycle-trigger-semantics.md`)
  line 51 — SECURITY DEFINER + SET search_path on cross-table functions
- ADR-0204 (`docs/decisions/0204-gated-mutation-composition-orchestrator.md`)
  lines 43–67 — gatedMutation orchestrator; lines 136–145 — Invariant 11 (no phantom emits)
- ADR-0078 — channel restriction; voice FORBIDDEN for financial PII
- ADR-0164 — dot-convention for telemetry event naming
- ADR-0196 — Journey engine Invariant 11 (no phantom emits)
- Bokføringsloven §13 (Lov om bokføring av 19. november 2004 nr. 73) —
  5-year retention for regnskapsmateriale, measured from regnskapsårets slutt
- CLAUDE.md §"Cascade Architecture — CANONICAL MODEL": C3 Commercial = shift_cost_snapshot
- `packages/supabase/src/database.types.ts` lines 16955–17030 —
  shift_cost_snapshot confirmed schema (existing C3 table)
- `packages/supabase/src/database.types.ts` line 19911 —
  snapshot_shift_cost RPC (existing)
- `packages/supabase/src/database.types.ts` line 20395 —
  snapshot_basis enum: 'planned' | 'actual' (confirms shift_cost_snapshot's reconciliation role)

---

> Do NOT update `docs/decisions/0000-decision-log.md` — orchestrator centralizes log updates.
