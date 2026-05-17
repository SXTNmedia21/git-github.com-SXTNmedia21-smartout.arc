---
title: "workspace_framework_binding lifecycle — union choice at signup seeds tariff snapshot"
id: ADR_0353
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [workspace, framework, binding, lifecycle, bootstrap, union, tariff, i1, payroll, phase-7d]
amends: [ADR-0252]
related_adrs: [ADR-0252, ADR-0076, ADR-0173, ADR-0347, ADR-0350, ADR-0351, ADR-0352, ADR-0354]
---

# ADR-0353: workspace_framework_binding lifecycle — union choice at signup seeds tariff snapshot

## Context and Problem Statement

Phase 7 dynamic pivot requires a per-workspace tariff-binding lifecycle. Today
`packages/ai/src/industry/loader.ts` (I1 bootstrap) falls back through three tiers
(workspace K1b → platform K1a → hardcoded constants) with no per-workspace binding row in
the database. ADR-0252 operates on the concept of `workspace_framework_binding` throughout
(§B references it directly in the engine_event consumer step 2) but never specifies how
that binding is created, switched, or archived. ADR-0250 is unrelated (Skatteetaten
integration, DEFERRED). This ADR fills the creation, switch, and archival gap so ADR-0252
and Phase 7d can build against it.

Three principals govern:

- **Workspace selects union/tariff during onboarding wizard.** Capability tool
  `setup_workspace_tariff(union_id, version)` calls `derive_supplement_set` via the
  Lovsen bridge (ADR-0350) → persists snapshot → writes `workspace_framework_binding` row.
- **Binding is APPEND-ONLY per ADR-0076 snapshot-and-forward.** Switching union creates a
  new binding row with `effective_from`; old binding gets `effective_to`. Existing calcs
  reference old binding via FK — historical period accuracy is preserved unconditionally.
- **Union switch is a MATERIAL amendment per Aml. §14-6(m).** Requires ansatt-signering
  per ADR-0252 §F amendment-classifier when the change is adverse to the worker. Bootstrap
  (new workspace, no prior binding) does NOT require employee signature — first binding is
  the contract baseline.

---

## Decision Drivers

- **I1 bootstrap pattern (existing):** `loader.ts` provides industry defaults; workspace
  customizes on top. A per-workspace binding row is the natural K1b extension of this
  pattern — it anchors which tariff version the workspace has committed to.
- **ADR-0076 snapshot-and-forward:** rates frozen at calc-time; binding row provides the
  FK target for `shift_pay_calculation_event.tariff_binding_id`. Mutating a binding row
  in-place would break audit integrity identically to Option 2 in ADR-0252.
- **Aml. §14-6(m):** the written employment contract must identify the applicable tariff
  agreement. Switching the workspace's union binding after contracts have been issued
  = a change to the basis of existing contracts. If adverse to the worker this is
  MATERIAL and requires endringsoppsigelse-vurdering.
- **ADR-0252 §F amendment-classifier:** downstream versjonering bulk-amendment flow
  relies on `workspace_framework_binding` rows being present and correctly typed
  (BOOTSTRAP vs UP vs MATERIAL vs ENDRINGSOPPSIGELSE). Without this ADR, that classifier
  has no binding to evaluate.
- **ADR-0173 frozen-4 boundaries:** capability boundary — the `payroll` capability owns
  tariff write (Harness Phase 5). No direct DB writes from wizard server actions;
  all writes go through capability tools.
- **Non-tariff-bound workspaces:** `union_id='non-bound'` workspaces must still have a
  binding row for audit symmetry and so that ADR-0252 §B's workspace fan-out query
  (`workspace_framework_binding WHERE framework_id = ?`) returns a defined result
  (empty set, not missing table).

---

## Considered Options

### Option A — Implicit binding: derive from workspace_settings at runtime

Read `workspace_settings.active_union_id` at calc time; never write a binding row. K1a
rates resolved on-the-fly each calc cycle.

**Rejected because:**
- Violates ADR-0076 snapshot-and-forward. If the union setting changes after period
  start, historical recalculations lose their FK anchor. There is no point-in-time
  proof of which rate applied to which shift.
- ADR-0252 §B's stage-engine consumer queries `workspace_framework_binding` to fan out
  tariff version bumps. With no binding table, that consumer cannot be implemented.
- Audit integrity (ADR-0251) cannot be satisfied without a stable FK from
  `shift_pay_calculation_event` to the binding that was active at calc-time.

### Option B — Lazy creation: write binding row on first calc cycle, not at signup

Defer binding creation to the first payroll calculation. Wizard step skipped.

**Rejected because:**
- Requires the calc engine to perform a write operation (binding INSERT) during a
  period that should be idempotent and read-only with respect to workspace config.
  Violates payroll engine determinism principle (ADR-0252 §A invariant).
- Admin has no visibility of which tariff the workspace is bound to until after the
  first calculation — no UI surface for review or correction before payroll runs.
- Backfill for existing Bubble workspaces would be unmanageable: binding creation
  would fire non-deterministically on the first calc run per workspace.

### Option C — Explicit creation at onboarding (chosen)

Wizard step "Tariff" prompts union selection. Capability tool `setup_workspace_tariff`
writes binding + snapshot at setup time. Switch flow uses `change_workspace_tariff` with
amendment-classifier gate. Non-tariff-bound workspaces write a `non-bound` binding row
for audit symmetry. Backfill migration writes `BOOTSTRAP-BACKFILL` rows for existing
workspaces.

**Chosen because:**
- Provides an explicit, auditable anchor point for every workspace's tariff commitment.
- Reuses ADR-0350 Lovsen bridge + ADR-0351 supplement derivation without new
  infrastructure.
- Satisfies ADR-0252 §B's fan-out query contract.
- Amendment-classifier gates on `change_workspace_tariff` enforce Aml. §14-6(m)
  compliance without bespoke legal logic in the wizard.

---

## Decision Outcome

**Chosen: Option C — Explicit binding creation at onboarding.**

Sub-decisions are resolved as follows.

---

### A. Schema additions (Phase 7d-followup migration — not this ADR)

Two new tables and two new columns. No SQL is shipped with this ADR; the migration
sortie authors and applies the following.

```sql
-- Pointer columns on workspace_settings
ALTER TABLE workspace_settings ADD COLUMN active_union_id text;
  -- e.g. "taro-79" (Fellesforbundet), "taro-226" (Parat), "non-bound"
ALTER TABLE workspace_settings ADD COLUMN active_binding_id uuid
  REFERENCES workspace_framework_binding(id);

-- Binding lifecycle table (APPEND-ONLY — no UPDATE on existing rows except effective_to)
CREATE TABLE workspace_framework_binding (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id            uuid NOT NULL REFERENCES workspace(id),
  union_id                text NOT NULL,      -- "taro-79", "taro-226", "non-bound"
  law_version             text NOT NULL,      -- "2024-2026", "2025-mellomoppgjor"
  official_effective_date date NOT NULL,      -- from NHO lønnsoppgjør cirkulær (Phase 5 primary date authority)
  bound_at                timestamptz NOT NULL DEFAULT now(),
  effective_from          date NOT NULL,
  effective_to            date NULL,          -- NULL = currently active
  created_by              uuid NOT NULL REFERENCES profile(profile_id),
  amendment_classifier    text NULL,          -- "BOOTSTRAP" | "UP" | "MATERIAL" | "ENDRINGSOPPSIGELSE" | "BOOTSTRAP-BACKFILL"
  derivation_snapshot_id  uuid REFERENCES tariff_snapshot(id),  -- NULL for non-bound
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Immutable snapshot of the derived supplement + rate state at binding time
CREATE TABLE tariff_snapshot (
  id                      uuid PRIMARY KEY,
  workspace_id            uuid NOT NULL REFERENCES workspace(id),
  derived_at              timestamptz NOT NULL,
  derivation_version      text NOT NULL,      -- "lovdata-mcp@v1+taro-79@2025-mellomoppgjor"
  source_paragraph_refs   jsonb NOT NULL,     -- ADR-0256 citation envelopes per supplement
  rules_persisted_count   integer NOT NULL,
  rates_persisted_count   integer NOT NULL,
  incomplete_supplements  jsonb DEFAULT '[]'::jsonb
);
```

**Append-only invariant (binding on all implementations):**
No existing `workspace_framework_binding` row may be UPDATEd except to set
`effective_to` when a new binding supersedes it. All other fields are immutable
after INSERT. This mirrors the `shift_pay_calculation_event` append-only invariant
in ADR-0251.

---

### B. Bootstrap flow (new workspace onboarding)

1. Wizard step "Tariff" — admin selects union (Fellesforbundet/Parat/uorganisert) and
   version.
2. Capability tool `setup_workspace_tariff(union_id, version)` is called.
3. Tool steps:
   a. `gate_action('payroll.setup_workspace_tariff')` — confirm admin authority
      (ADR-0099 / ADR-0204).
   b. Call Lovsen bridge `derive_supplement_set(union_id, version)` (ADR-0350).
   c. Persist `tariff_snapshot` row + associated `supplement_rule` + `tariff_rate_table`
      rows scoped to `workspace_id`.
   d. INSERT `workspace_framework_binding` with `amendment_classifier = 'BOOTSTRAP'`.
   e. UPDATE `workspace_settings.active_union_id` + `active_binding_id`.
4. Telemetry: emit `workspace.tariff_binding_created` (all four destinations per
   ADR-0164 / CLAUDE.md §Telemetry).
5. Authority: BOOTSTRAP = no ansatt-signering required. First binding is the contract
   baseline — employees have not yet signed contracts against a prior tariff version.
6. Non-tariff-bound workspaces: call `setup_workspace_tariff('non-bound', 'n/a')`.
   Bridge derive call skipped. `derivation_snapshot_id = NULL`. Binding row still
   created for audit symmetry.

---

### C. Switch flow (mid-life union change)

1. Admin initiates via `/dashboard/settings/tariff` UI.
2. Capability tool `change_workspace_tariff(new_union_id, new_version, effective_from)`.
3. Tool steps:
   a. Fetch current binding via `workspace_settings.active_binding_id`.
   b. Call bridge `derive_supplement_set(new_union_id, new_version)` to get new rate set.
   c. Compute `amendment_classifier` per ADR-0252 §F: compare new rates vs old binding
      rates. If any effective hourly rate decreases by any amount → `'ENDRINGSOPPSIGELSE'`
      (Aml. §15-7 risk); if any rate increases with none decreasing → `'UP'`; equal rates
      (union switch, same rates) → `'UP'` as a conservative default.
   d. If classifier is `'ENDRINGSOPPSIGELSE'` or `'MATERIAL'`: BLOCK at tool level.
      Return error `UNION_SWITCH_REQUIRES_AMENDMENT_REVIEW`. Require explicit ansatt-
      signering flow per ADR-0252 §F (out of scope this ADR; ADR-0252 owns the
      amendment-handler path).
   e. If classifier is `'UP'`: `gate_action('payroll.change_workspace_tariff')` confirm
      admin. Persist new `tariff_snapshot`. INSERT new binding. UPDATE
      `workspace_settings.active_*`. SET `effective_to = effective_from - 1 day` on old
      binding.
4. Telemetry: emit `workspace.tariff_binding_switched`.

**Invariant:** The old binding row is only modified to set `effective_to`. No other field
on the existing row is updated.

---

### D. Reference semantics (snapshot-and-forward per ADR-0076)

- `shift_pay_calculation_event.tariff_binding_id` FK references the binding that was
  active at calc-time.
- Calc engine reads `workspace_settings.active_binding_id` at period start → freezes for
  the period in `shift_cost_snapshot`. This frozen FK survives subsequent union switches.
- Re-calc of a historical period uses the HISTORICAL binding via the period's frozen FK,
  not `active_binding_id` (which may have changed). Audit integrity per ADR-0251 is
  preserved unconditionally.
- Every calc is traceable to: `(time_entry, supplement_rule, tariff_rate_table_id,
  tariff_binding_id, tariff_snapshot_id)` — the full provenance chain required by
  ADR-0251.

---

### E. Backfill for existing workspaces (Bubble migrations + others)

Three Bubble workspaces already migrated to Supabase Local (Strøm Mat & Bar, Bårdshaug
Vegkro, Yogurt Heaven — project memory `learning_bubble_migration_campaign_2026_05_03.md`).

Phase 7d-followup migration backfills:

1. Assume `taro-79` (Fellesforbundet) for all hospitality workspaces as the default per
   Lovsen Phase 5 primary tariff.
2. `amendment_classifier = 'BOOTSTRAP-BACKFILL'` flag distinguishes automated backfill
   from admin-initiated bootstrap.
3. `derivation_snapshot_id = NULL` (no live bridge call during migration; backfill rows
   are skeleton anchors).
4. After migration: manual admin review prompt — "Confirm tariff binding for your
   workspace" — surfaces at next admin login. Admin can trigger full `setup_workspace_tariff`
   to replace the skeleton with a live snapshot.

---

### F. Non-tariff-bound workspaces

`union_id = 'non-bound'`, `derivation_snapshot_id = NULL`. Lovsen bridge derive call
skipped. Admin manually authors supplements (ADR-0351 no-floor mode). Binding row still
INSERTed for audit symmetry — ADR-0252 §B's fan-out query returns this workspace in
scope but the amendment handler skips it (no `framework_id` match).

---

## Rules & Consequences

- **Good, because** ADR-0252 §B's engine_event consumer finally has a stable table to
  query (`workspace_framework_binding WHERE framework_id = ?`). The gap flagged by the
  Lovsen Phase 5 council is closed.
- **Good, because** ADR-0076 snapshot-and-forward is preserved. The tariff_binding_id
  FK on every `shift_pay_calculation_event` creates a durable, point-in-time audit chain
  that survives union switches, Riksavtalen revisions, and workspace migrations.
- **Good, because** Aml. §14-6(m) compliance is enforced at the tool boundary.
  `change_workspace_tariff` blocks on ENDRINGSOPPSIGELSE/MATERIAL classifiers before any
  row is written. The tool cannot bypass the check.
- **Good, because** non-tariff-bound workspaces are first-class citizens. The binding row
  for `non-bound` is audit-symmetric with tariff-bound workspaces — no special-casing in
  downstream consumers.
- **Bad, because** two new tables + two new columns are required. Until the Phase 7d-
  followup migration ships, the bootstrap and switch flows cannot be implemented. This is
  a hard sequencing constraint for Phase 7f capability tools.
- **Bad, because** Bubble backfill rows have `derivation_snapshot_id = NULL`. Workspaces
  that never complete the admin review prompt will have skeleton bindings indefinitely.
  Mitigation: rate freshness verification (ADR-0354) will surface stale/skeleton bindings
  in the payroll pre-flight dashboard.
- **Agent Impact:**
  - Agents implementing `setup_workspace_tariff` MUST call `gate_action` before any
    write. MUST persist snapshot before binding row. MUST update workspace_settings
    atomically (same transaction or idempotent retry pattern).
  - Agents implementing `change_workspace_tariff` MUST compute amendment_classifier
    BEFORE writing any rows. MUST block on ENDRINGSOPPSIGELSE/MATERIAL — no override
    without explicit ADR-0252 ansatt-signering flow.
  - Agents writing the Phase 7d migration MUST set `amendment_classifier = 'BOOTSTRAP-
    BACKFILL'` on all synthetic rows. MUST NOT call the Lovsen bridge from the migration
    script (stateless migration principle; bridge calls happen at admin review time).
  - The `workspace_framework_binding` append-only invariant must be included in every
    build-agent dispatch spec. Agents must verify they never UPDATE rows except to set
    `effective_to`.
  - Calc-engine agents MUST read `active_binding_id` from `workspace_settings` at period
    start and freeze it — never re-resolve mid-period. FK stored on `shift_cost_snapshot`.

---

## Implementation Gates (Phase 7d-followup + 7f)

| Gate | Description | Phase |
|------|-------------|-------|
| T1   | Schema migration: `tariff_snapshot` + `workspace_framework_binding` tables + 2 columns on `workspace_settings` | 7d-followup |
| T2   | Capability tool `setup_workspace_tariff` — gate + bridge call + snapshot persist + binding INSERT | 7f |
| T3   | Capability tool `change_workspace_tariff` — amendment_classifier + BLOCK gate + switch INSERT | 7f |
| T4   | Wizard step "Tariff" in onboarding (L1 surface) | 7f |
| T5   | Backfill migration: `BOOTSTRAP-BACKFILL` rows for Bubble workspaces | 7d-followup |
| T6   | Admin review prompt UI (post-backfill CTA) | 7f |

---

## Open Questions

1. **Taro-79 vs taro-226 per workspace.** Fellesforbundet (taro-79) and Parat (taro-226)
   are both valid Riksavtalen variants for hospitality. Phase 7 has one variant (taro-79)
   as primary. When multi-union workspaces are supported, `union_id` on the binding row
   already accommodates taro-226 — no schema change needed. ADR-0349 open question §"taro-
   79 vs taro-226 variant per workspace" is the companion tracking item.

2. **Multi-binding workspaces (future).** If a workspace has staff on two different
   tariffs (hospitality + Industrioverenskomsten back-of-house), the binding table
   accommodates multiple active rows (different `union_id` + non-overlapping
   `effective_from`/`effective_to`). The calc engine must then resolve binding by
   employee contract, not just workspace. ADR-0252 §"Open Questions #2" is the upstream
   tracking item. No schema change in this ADR required.

3. **Backfill + live bridge call timing.** Skeleton backfill rows (T5) leave
   `derivation_snapshot_id = NULL`. The admin review prompt (T6) triggers a live
   `setup_workspace_tariff` call that fills the snapshot. If a payroll period is locked
   before admin completes review, the calc engine must tolerate `NULL` snapshot — falling
   back to platform K1a rates (current `loader.ts` Tier 2 behavior). This fallback must
   be documented in the calc-engine dispatch spec.

---

## References

- ADR-0076 (`docs/decisions/0076-contract-composition-as-cascade-derivation.md`) —
  snapshot-and-forward principle, cascade invariant #8 (provenance)
- ADR-0173 — frozen-4 capability boundaries; payroll capability owns tariff write
- ADR-0252 (`docs/decisions/0252-riksavtalen-versjonering-migration-policy.md`) —
  §B engine_event consumer (references `workspace_framework_binding`), §F
  amendment-classifier, §G migration shape
- ADR-0347 — Lovdata as K1a canonical source (taro-79, taro-226 variant)
- ADR-0350 — Lovsen MCP→capability bridge transport (`derive_supplement_set` call)
- ADR-0351 — workspace-supplement-policy (tariff floor vs no-floor)
- ADR-0352 — derive_supplement_set MCP contract (bridge method spec)
- ADR-0354 — snapshot freshness/staleness ops (companion ADR)
- `packages/ai/src/industry/loader.ts` — I1 bootstrap fallback chain (Tier 1 K1b →
  Tier 2 K1a → Tier 3 hardcoded); `active_binding_id` becomes the Tier 1 anchor
- Aml. §14-6(m) — tariff identified in written employment contract; switch = MATERIAL
- Aml. §15-7 — endringsoppsigelse risk on adverse tariff switch

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
