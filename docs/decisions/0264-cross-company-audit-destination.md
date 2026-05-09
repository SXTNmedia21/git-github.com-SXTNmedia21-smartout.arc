---
title: "Cross-company audit destination for platform-scoped settlement events"
id: ADR-0264
status: proposed
layer: decision
created: 2026-05-02
updated: 2026-05-02
module: billing
tags: [billing, telemetry, settlement, audit, bokforingsloven, billing-activity-log]
version: "1.0"
---

# ADR-0264: Cross-company audit destination for platform-scoped settlement events

## Context and Problem Statement

Settlement runs in the Smartout billing system aggregate orders across all workspaces belonging to a tenant. A single `executeSettlementRun` call covers N workspaces that may belong to M distinct companies. This cross-company nature creates a structural mismatch with the two existing audit destinations in the telemetry pipeline:

1. `activity_trail` — workspace-scoped (`workspace_id NOT NULL`). The provider at `packages/telemetry/src/providers/activity-trail.ts:90` explicitly early-returns when `event.workspace_id === null`. Settlement run events (`settlement run_completed`, `settlement run_failed`) emit with `workspace_id: null` per `packages/billing/src/server/settlement/run.ts:333` and `run.ts:372`. These events are silently dropped.

2. `billing_activity_log` — company-scoped (`company_id NOT NULL` constraint, rejection enforced at `packages/telemetry/src/providers/billing-activity-log.ts:147–152`). The provider resolves `company_id` via either an invoice lookup or a caller-supplied `data.company_id`. Settlement events carry no `invoice_id` and no single `data.company_id` — the run spans multiple companies. Both resolution paths fail; the event is rejected with the warning "Could not resolve company_id".

**Current routing table** (`packages/telemetry/src/registry.ts:10327–10350`):

- `settlement run_completed` → `["posthog", "activity_trail", "billing_activity_log"]`
- `settlement run_failed` → `["logger", "activity_trail", "billing_activity_log"]`
- `settlement period_locked` → `["posthog", "activity_trail", "billing_activity_log"]`

`activity_trail` silently drops the first two (workspace_id null). `billing_activity_log` silently drops the first two (no company_id resolution). `settlement period_locked` has a valid workspace_id (per-workspace emit in `run.ts:195–204`) so it passes `activity_trail`; however it also routes to `billing_activity_log` and will fail company_id resolution unless the caller supplies it.

Result: `settlement run_completed` and `settlement run_failed` — the two events that form the top-level Bokføringsloven audit record for every settlement period — currently write to **no audit table at all**. The audit guarantee promised in ADR-0262 Amendment 1 is broken for the run-lifecycle events.

## Decision Drivers

- **Bokføringsloven §10 audit coverage** — every settlement execution must appear in a durable, queryable audit log. Erik (accountant) must be able to reconstruct "who ran the settlement for period X, when, and did it succeed?" from the database without relying on transient logs.
- **Query ergonomics for Erik** — Erik's view of the world is company-centric. The `billing_activity_log` is already the correct ledger; its index `(invoice_id, created_at DESC)` and company-scoped RLS map directly to Erik's access grants. Adding settlement rows to this table gives Erik a unified per-company audit view with zero new infrastructure.
- **Schema mutation cost** — any option requiring a migration to the `billing_activity_log` table (nullable columns, new flags) carries risk: column additions require re-testing all existing provider paths, risk NULL-related Postgres constraint errors at existing insert sites, and expand the blast radius of the change.
- **Audit table proliferation cost** — a third audit table means every consumer of audit data (Erik's UI queries, platform-admin dashboards, future compliance exports) must know which table to read for which event class. This compounds over time and has already caused routing confusion in the current settlement implementation.
- **Security invariant** — the existing provider verifies `company_id` against the DB before writing (prevents cross-tenant audit spoofing per the comment at `billing-activity-log.ts:72–87`). Any new path must preserve this invariant.
- **N company count is small** — a typical Smartout tenant with multiple workspaces has 1–5 companies. Fan-out row count is bounded and negligible for audit storage.

## Considered Options

### (a) Fan-out per company

The `billing_activity_log` provider gains a second resolution path: when `data.company_ids` is a non-empty string array, iterate it and insert one row per company_id. Each row represents "this settlement run touched your company's data." The caller (`run.ts`) passes `company_ids: companyIds` in the `data` block of the emit payload; `companyIds` is already resolved and RLS-verified at `run.ts:225` from `companyMap`.

**Security:** `company_ids` in the payload arrive from an already-authenticated path (`resolveCompanyIds` used the user-scoped RLS client, and `hasAccountantAccess` was checked per workspace). The provider still verifies each company_id exists via a DB lookup (same pattern as the existing `declaredCompanyId` branch at line 122–145), providing defense-in-depth against any future refactor that might pass an unverified list.

**Row count:** for a run covering 3 workspaces across 2 companies: `run_completed` → 2 rows, `run_failed` → 2 rows. Bounded by M companies per tenant, never by event volume.

**Pros:**
- Zero schema migration — `billing_activity_log` `company_id NOT NULL` constraint is satisfied row-by-row.
- Erik gets per-company ledger rows that match accounting reality: each company can query "did my settlement run succeed this period?" independently.
- No new table, no new destination in the routing enum, no new provider file.
- `companyIds` is already available at every emit call site in `run.ts` — no additional DB lookup required in the provider for the success path.
- Consistent with the existing provider security model.

**Cons:**
- Audit row count > event count (M rows per event where M = company count). A run spanning 1 company produces 1 row — same as today's expectation. A run spanning 5 companies produces 5 rows. This is auditing reality, not a bug.
- Provider logic becomes conditional (fan-out branch vs. single-company branch). Complexity is contained to ~30 lines in one provider file.
- `settlement run_failed` emits from the catch block (line 370), where `companyIds` is not in scope — must derive `Array.from(new Set([...companyMap.values()]))` inline, or hoist `companyIds` to outer function scope. `companyMap` IS in outer scope (line 136) so this is a one-line fix.

### (b) Allow NULL company_id with explicit platform marker

Add `company_id` as nullable to `billing_activity_log`, add `is_platform_scoped BOOLEAN NOT NULL DEFAULT FALSE`, update queries to filter by `is_platform_scoped` for platform-level reads.

**Pros:**
- Single row per event — cleaner event-to-row parity.
- Semantically honest: the event is platform-scoped, not company-scoped.

**Cons:**
- Requires a non-trivial migration (`ALTER TABLE billing_activity_log ALTER COLUMN company_id DROP NOT NULL; ADD COLUMN is_platform_scoped BOOLEAN NOT NULL DEFAULT FALSE;`). All existing NOT NULL insert paths must be retested.
- RLS on `billing_activity_log` currently gates on `company_id` — adding platform-scoped rows requires a new RLS policy path for platform-admin reads, while preserving company-scoped access for accountants. Two policies where there was one.
- Erik's UI query (`SELECT * FROM billing_activity_log WHERE company_id = $1`) returns platform-scoped rows only if the query is updated, or misses them entirely if it isn't. A join/union is required to give Erik the complete picture.
- `company_id` index loses selectivity when NULLs are introduced.
- Violates the existing provider contract: every existing caller was written with the guarantee that a row without company_id is rejected. Relaxing that guarantee widens the attack surface for future cross-tenant audit pollution.

### (c) New `platform_activity_log` destination

Create a third audit table (`platform_activity_log`) and third destination in `EventDestination`, for cross-tenant aggregation events.

**Pros:**
- Perfect semantic separation: company-scoped in one table, platform-scoped in another.
- No schema mutation to existing tables.
- Existing provider and all its callers are untouched.

**Cons:**
- Third audit table means Erik, future compliance exporters, and platform-admin dashboards all must know which table to consult for which event class. This is the same fragmentation problem that ADR-0262 Amendment 1 was written to prevent (consolidating workspace-scoped events that were leaking into void back into a single billing ledger).
- Adds `"platform_activity_log"` to the `EventDestination` union, a new provider file, a new migration, and new RLS policies — all for 2 event types today, with limited expected growth.
- Settlement timeline query for Erik would require a UNION across two tables (company rows in `billing_activity_log` for invoices, platform rows in `platform_activity_log` for the run lifecycle). Two-table queries are harder to index and harder to explain.
- Contradicts the stated goal in ADR-0262 Amendment 1 of routing platform-scoped events to `billing_activity_log` — adding a third table partially reverts that decision.

## Decision Outcome

**Chosen option: (a) Fan-out per company.**

The fan-out approach is the only option that satisfies all three critical constraints simultaneously: zero schema migration, preserved `company_id NOT NULL` security invariant, and per-company ledger rows that match Erik's accounting reality. The row-count multiplier is bounded by the number of distinct companies in a settlement scope — in practice 1–3 for a typical tenant — and does not approach any storage or performance concern.

Option (b) weakens the security model of the provider (nullability erodes the rejection guarantee) and requires RLS surgery. Option (c) creates a third audit surface that must be unified at query time, compounding the fragmentation that ADR-0262 Amendment 1 was written to solve.

The implementation requires changes to exactly two files and no migration.

## Implementation Sketch

### Change 1: `packages/billing/src/server/settlement/run.ts`

Add `company_ids` to every platform-scoped settlement emit. `companyMap` is in outer scope, so the derived array is available in both the success path and the catch block.

**Success path (line ~330):**

```ts
// Before
await emit({
  event: "settlement run_completed",
  actor_id: nonEmpty(userId, "actor_id"),
  workspace_id: null,
  properties: {
    entity: { entity_type: "settlement_run", entity_id: runId },
    data: {
      run_id: runId,
      period_start: periodStart,
      period_end: periodEnd,
      workspace_count: input.workspace_ids.length,
      artifact_count: artifactInserts.length,
    },
  },
});

// After
const resolvedCompanyIds = Array.from(new Set([...companyMap.values()]));
await emit({
  event: "settlement run_completed",
  actor_id: nonEmpty(userId, "actor_id"),
  workspace_id: null,
  properties: {
    entity: { entity_type: "settlement_run", entity_id: runId },
    data: {
      run_id: runId,
      period_start: periodStart,
      period_end: periodEnd,
      workspace_count: input.workspace_ids.length,
      artifact_count: artifactInserts.length,
      company_ids: resolvedCompanyIds,      // ← new: fan-out anchor
    },
  },
});
```

**Catch path (line ~370):**

```ts
// Before
await emit({
  event: "settlement run_failed",
  actor_id: nonEmpty(userId, "actor_id"),
  workspace_id: null,
  properties: {
    entity: { entity_type: "settlement_run", entity_id: runId },
    data: {
      run_id: runId,
      period_start: periodStart,
      period_end: periodEnd,
      error: errMessage.slice(0, 500),
    },
  },
}).catch(console.error);

// After
await emit({
  event: "settlement run_failed",
  actor_id: nonEmpty(userId, "actor_id"),
  workspace_id: null,
  properties: {
    entity: { entity_type: "settlement_run", entity_id: runId },
    data: {
      run_id: runId,
      period_start: periodStart,
      period_end: periodEnd,
      error: errMessage.slice(0, 500),
      company_ids: Array.from(new Set([...companyMap.values()])),  // ← new
    },
  },
}).catch(console.error);
```

**For `settlement period_locked` (line ~195):** This event already has a valid `workspace_id`. Add `company_id: companyMap.get(wsId)` to its `data` block so the existing single-company resolution path in the provider succeeds without triggering the fan-out branch.

```ts
// After
await emit({
  event: "settlement period_locked",
  actor_id: nonEmpty(userId, "actor_id"),
  workspace_id: nonEmpty(wsId, "workspace_id"),
  properties: {
    entity: { entity_type: "settlement_period", entity_id: wsId },
    data: {
      workspace_id: wsId,
      period_start: periodStart,
      period_end: periodEnd,
      company_id: companyMap.get(wsId),   // ← new: enables billing_activity_log path
    },
  },
});
```

### Change 2: `packages/telemetry/src/providers/billing-activity-log.ts`

Add a fan-out branch before the single-company resolution logic. When `data.company_ids` is a non-empty string array, iterate it and insert one row per company.

Insert the following block after the `data` and `changes` extraction (after line ~59), before the `invoiceId` resolution:

```ts
// Fan-out path: settlement events supply data.company_ids[] when the run
// spans multiple companies. Insert one billing_activity_log row per company.
// Each company_id is verified against the DB (same invariant as single path).
// ADR-0264: this path is the sole audit mechanism for settlement run_completed
// / run_failed events (workspace_id: null → activity_trail silently drops them).
if (Array.isArray(data.company_ids) && data.company_ids.length > 0) {
  const source: string = typeof data.source === "string" ? data.source : "web";
  const insertPromises = (data.company_ids as string[]).map(async (cid) => {
    // Verify company exists — same defense-in-depth as single-company path.
    const { data: company, error: companyErr } = await supabase
      .from("company")
      .select("company_id")
      .eq("company_id", cid)
      .maybeSingle();

    if (companyErr || !company) {
      console.warn(
        `[telemetry.billing_activity_log] fan-out: company ${cid} not found for "${event.event}". Skipped.`,
      );
      return;
    }

    const { error: insertErr } = await supabase.from("billing_activity_log").insert({
      company_id: cid,
      invoice_id: null,
      event: event.event,
      entity_type: entityType,
      entity_id: entityId,
      data,
      changes,
      actor_user_id: event.actor_id || null,
      source,
    });

    if (insertErr) {
      console.error(
        `[telemetry.billing_activity_log] fan-out insert failed for "${event.event}" / company ${cid}:`,
        insertErr,
      );
    }
  });

  await Promise.allSettled(insertPromises);
  return; // Fan-out handled; skip single-company path below.
}
```

No migration required. The `billing_activity_log` table schema is unchanged: `company_id NOT NULL` is satisfied row-by-row. `invoice_id` is nullable and remains NULL for settlement run rows (correct — there is no invoice for a run-level event). Verified against `supabase/migrations/20260417122417_billing_activity_log.sql:15` (`invoice_id uuid REFERENCES public.invoice(invoice_id)` — no NOT NULL).

## Rules & Consequences

- **Good, because** the audit guarantee of ADR-0262 Amendment 1 is restored with zero schema migration. `settlement run_completed` and `settlement run_failed` now write durable rows to `billing_activity_log` for every company covered by the run.
- **Good, because** Erik gets per-company ledger entries that match his grants: if his grant covers company A and company B, he sees two rows per settlement run, one scoped to each company. This mirrors how invoice rows are already scoped.
- **Good, because** the existing `company_id NOT NULL` security invariant is preserved row-by-row. The fan-out path still verifies each company_id against the DB, maintaining the same defense depth as the single-company path.
- **Good, because** no new table, no new destination enum value, no new provider. The change is contained to two files.
- **Bad, because** audit row count > event count for multi-company runs. A run over 3 companies produces 3 `run_completed` rows in `billing_activity_log`. Monitoring queries that count events by row count must group by `(event, entity_id)` to avoid overcounting. This is the correct mental model for company-ledger audit tables.
- **Bad, because** `data` column will contain `company_ids: string[]` in settlement rows — a field that is irrelevant to single-company billing events stored in the same table. This is a minor schema-smell, not a functional problem. Future work: strip `company_ids` from `data` before insert in the fan-out path (easy, deferred).
- **Agent Impact:** any engineer adding a new platform-scoped billing event that spans multiple companies MUST include `company_ids: string[]` in the emit `data` block. The provider will silently reject the event (existing rejection path at line 147) if neither `company_ids` nor a resolvable `company_id`/`invoice_id` is present. The convention is: workspace-scoped events use `data.company_id` (single); platform-scoped multi-company events use `data.company_ids` (array).

## Acceptance Criteria

The audit guarantee of ADR-0262 Amendment 1 is considered restored when all of the following hold after the implementation sortie:

1. Running `executeSettlementRun` in local Supabase with N workspaces across M companies produces exactly M rows in `billing_activity_log` with `event = 'settlement run_completed'` and `entity_id = <run_id>`.
2. A settlement run that throws an error (e.g. `compute_period_aggregates` returns an error) produces exactly M rows in `billing_activity_log` with `event = 'settlement run_failed'`.
3. Each `settlement period_locked` emit produces exactly 1 row in `billing_activity_log` with the correct `company_id` for that workspace.
4. No `console.warn "[telemetry.billing_activity_log] Could not resolve company_id"` appears in logs during a successful settlement run.
5. The existing `billing_activity_log` provider tests pass without modification (no fan-out path is triggered by existing invoice-scoped events).
6. `pnpm turbo typecheck` passes with 0 errors across the monorepo.

## References

- ADR-0262 Amendment 1 — platform-scoped events routed to `billing_activity_log`; initial routing rule that this ADR implements correctly
- ADR-0125 — billing_activity_log destination origin
- L-0177 — forgeable-ID class; defense-in-depth rationale for DB verification in the fan-out path
- `packages/telemetry/src/providers/billing-activity-log.ts:147` — current rejection point
- `packages/telemetry/src/providers/activity-trail.ts:90` — early-return precedent for workspace_id:null
- `packages/billing/src/server/settlement/run.ts:333` — workspace_id: null emit for run_completed
- `packages/billing/src/server/settlement/run.ts:372` — workspace_id: null emit for run_failed
- `packages/telemetry/src/registry.ts:10327–10350` — current EVENT_ROUTING for settlement events
- `supabase/migrations/20260417122417_billing_activity_log.sql:15` — invoice_id nullability confirmed

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
