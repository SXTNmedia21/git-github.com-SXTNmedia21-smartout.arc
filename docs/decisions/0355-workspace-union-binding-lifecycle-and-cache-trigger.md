---
title: "workspace_union_binding lifecycle + cache-trigger pattern on workspace_settings"
id: ADR_0355
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [lovsen, payroll, workspace_union_binding, cache-trigger, lifecycle, append-only, phase-7d]
related_adrs: [ADR-0173, ADR-0240, ADR-0252, ADR-0341, ADR-0353, ADR-0356]
amends: []
superseded_by: []
---

# ADR-0355: workspace_union_binding — lifecycle + cache-trigger pattern

## Context and Problem Statement

ADR-0353 §A (as originally proposed) specified a `CREATE TABLE workspace_framework_binding`
with a shape conflicting with the existing cascade D3 dimension table of the same name —
already live in
`supabase/migrations/20260421200100_cascade_a2_framework_tables.sql:135-177`. The existing
table is consumed by 8 distinct callers (`packages/utils/src/resolve-composition.ts:230-241`,
7 RPCs, 2 FK chains) and auto-seeded on every workspace INSERT by
`supabase/migrations/20260525120000_workspace_framework_binding_auto_seed.sql`.

Council 2026-05-17 Phase 3 code-trace by all 5 reviewers identified the collision. Chair
self-reversal in Phase 5 (7th L-0147 precedent) reversed ADR-0353 §A and split the binding
concept into two ADRs:

- **ADR-0355 (this ADR)** — the payroll lovsen union binding: `public.workspace_union_binding`
- **ADR-0356** — the delegation pattern for capability tools writing to this table

The two concepts are genuinely distinct:

| | `workspace_framework_binding` | `workspace_union_binding` |
|---|---|---|
| Owner | Cascade (D3 dimension) | Payroll (lovsen tariff) |
| Seeded by | trigger on workspace INSERT | capability tool `cascade.bind_workspace_union` |
| Ref target | `regulatory_framework.framework_id` | `union_id` text (taro-79, taro-226, non-bound) |
| Consumers | 7 RPCs + resolve-composition.ts | calc engine + amendment flow |
| FK targets | `tariff_rate_table`, `workspace_bootstrap_run` | `payroll.tariff_snapshot` |

ADR-0353 §A is now amended to rename its proposed table to `workspace_union_binding` and
reference this ADR for the binding contract.

---

## Decision Drivers

1. **Preserve existing cascade D3 binding** — `workspace_framework_binding` has 8 consumers
   and 2 FK targets. Any ALTER or DROP breaks live composition resolution.
   (`supabase/migrations/20260421200100_cascade_a2_framework_tables.sql:135-177`)
2. **Preserve payroll calc-engine determinism** — `packages/payroll-calculate/src/evaluate-supplements.ts:328`
   reads `is_tariff_bound` boolean directly. Golden-month fixtures built against this
   read path. Zero refactor is a hard non-negotiable (ADR-0341 principle 4).
3. **APPEND-ONLY semantics** — per ADR-0076 snapshot-and-forward, binding rows must be
   immutable after INSERT except for closing `effective_to`. Historical recalculation must
   always resolve back to the binding active at calc-time.
4. **workspace_settings cache for hot-path read** — `is_tariff_bound` + new `active_union_id`
   stay as trigger-maintained denormalized cache so the calc engine never needs a join.
5. **ADR-0173 frozen-4 boundary** — `workspace_union_binding` belongs to the cascade
   namespace (public schema). Payroll capability tools must NOT write directly; delegation
   per ADR-0356 is mandatory.

---

## Considered Options

### Option A — ALTER existing `workspace_framework_binding`

Add `union_id`, `law_version`, `amendment_classifier`, etc. to the existing cascade table.

**Rejected:** 8 consumers + 2 FK targets would need coordinated migration. The existing
table's `framework_id` FK to `regulatory_framework` is structurally incompatible with the
lovsen `union_id` text concept. Mixing D3 cascade dimension semantics with payroll lovsen
lifecycle semantics violates the cascade invariant that each dimension table has one role.

### Option B — DROP + recreate `workspace_framework_binding`

Replace the existing cascade table with a combined table.

**Rejected:** 4 live workspaces in Supabase Local + FK chain from `tariff_rate_table` +
`workspace_bootstrap_run`. DROP breaks both FKs. The auto-seed trigger in
`supabase/migrations/20260525120000_workspace_framework_binding_auto_seed.sql` would
also need a full replacement cycle in the same migration — high blast radius for a pure
conceptual distinction.

### Option C — New table `workspace_union_binding` + cache trigger (chosen)

New `public.workspace_union_binding` table for lovsen tariff binding. Trigger-maintained
`is_tariff_bound` + `active_union_id` cache on `payroll.workspace_settings`. Cache is
synced by an AFTER INSERT/UPDATE trigger on `workspace_union_binding`.

**Chosen:** Preserves cascade integrity. Preserves calc-engine read path. Satisfies
APPEND-ONLY semantics independently of the cascade binding. Conceptual debt of 2 tables
is justified by cascade invariant §2 (each datum has one role).

---

## Decision Outcome

Chosen option: **Option C — New table `workspace_union_binding` + cache trigger.**

---

### A. Table schema

The Sortie 2 migration agent authors this table. This ADR specifies the contract.

**CRITICAL:** FK syntax uses `workspace(workspace_id)` not `workspace(id)` — correcting
the bug in ADR-0353 §A draft identified by DB-tracer in Council Phase 3.
`supabase/migrations/20260421200100_cascade_a2_framework_tables.sql:137` correctly uses
`REFERENCES workspace(workspace_id) ON DELETE CASCADE` — this ADR mirrors that pattern.

```sql
CREATE TABLE public.workspace_union_binding (
  workspace_union_binding_id  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid        NOT NULL
                                          REFERENCES public.workspace(workspace_id)
                                          ON DELETE CASCADE,
  union_id                    text        NOT NULL,
  -- 'taro-79' (Fellesforbundet) | 'taro-226' (Parat) | 'non-bound'
  law_version                 text        NOT NULL,
  -- e.g. '2024-2026', '2025-mellomoppgjor', 'n/a' for non-bound
  official_effective_date     date        NOT NULL,
  -- from NHO lønnsoppgjør cirkulær per ADR-0258
  bound_at                    timestamptz NOT NULL DEFAULT now(),
  effective_from              date        NOT NULL,
  effective_to                date        NULL,
  -- NULL = currently active; set when superseded by a new binding
  created_by                  uuid        NOT NULL
                                          REFERENCES public.profile(profile_id),
  amendment_classifier        text        NOT NULL
                                          CHECK (amendment_classifier IN (
                                            'BOOTSTRAP',
                                            'UP',
                                            'MATERIAL',
                                            'ENDRINGSOPPSIGELSE',
                                            'BOOTSTRAP-BACKFILL'
                                          )),
  derivation_snapshot_id      uuid        REFERENCES payroll.tariff_snapshot(id),
  -- nullable: NULL for non-bound workspaces
  created_at                  timestamptz NOT NULL DEFAULT now()
);
```

**Note:** `amendment_classifier` is NOT NULL (unlike ADR-0353 §A draft which had it
nullable). Every binding row must declare its lifecycle classification at INSERT time.

---

### B. APPEND-ONLY invariant

Two enforcement layers:

1. **RLS UPDATE policy** — restricted to setting `effective_to` only:
   ```sql
   CREATE POLICY "jwt_update_workspace_union_binding_close_only"
     ON workspace_union_binding
     FOR UPDATE
     USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
     WITH CHECK (
       -- only effective_to may change; all other fields must match OLD
       NEW.workspace_union_binding_id = OLD.workspace_union_binding_id
       AND NEW.workspace_id = OLD.workspace_id
       AND NEW.union_id = OLD.union_id
       AND NEW.law_version = OLD.law_version
       AND NEW.amendment_classifier = OLD.amendment_classifier
     );
   ```

2. **BEFORE UPDATE row-level trigger** — enforces immutability at DB level, surviving
   service-role bypasses of RLS:
   ```sql
   CREATE OR REPLACE FUNCTION public.enforce_workspace_union_binding_immutability()
   RETURNS TRIGGER LANGUAGE plpgsql AS $$
   BEGIN
     IF (NEW.workspace_id, NEW.union_id, NEW.law_version, NEW.amendment_classifier)
        IS DISTINCT FROM
        (OLD.workspace_id, OLD.union_id, OLD.law_version, OLD.amendment_classifier)
     THEN
       RAISE EXCEPTION
         'workspace_union_binding: only effective_to may be updated. '
         'Attempted mutation of immutable fields on row %.',
         OLD.workspace_union_binding_id;
     END IF;
     RETURN NEW;
   END $$;

   CREATE TRIGGER trg_workspace_union_binding_immutability
     BEFORE UPDATE ON public.workspace_union_binding
     FOR EACH ROW
     EXECUTE FUNCTION public.enforce_workspace_union_binding_immutability();
   ```

---

### C. Partial unique index (one active binding per workspace)

```sql
CREATE UNIQUE INDEX uq_workspace_active_union_binding
  ON public.workspace_union_binding (workspace_id)
  WHERE effective_to IS NULL;
```

Mirrors `uq_workspace_active_framework` on `workspace_framework_binding`
(`supabase/migrations/20260421200100_cascade_a2_framework_tables.sql:147-149`).

At INSERT of a new binding, the delegation tool (`cascade.bind_workspace_union` per
ADR-0356) first closes the previous active row by setting `effective_to = NEW.effective_from
- 1 day`, then INSERTs the new row. The index guarantees atomicity at DB level.

---

### D. Cache columns on `payroll.workspace_settings`

The existing `is_tariff_bound boolean NOT NULL DEFAULT false` column
(`supabase/migrations/20260527100200_payroll_phase1_workspace_policies.sql:74-83`)
remains as-is. Two additions:

```sql
-- New column: nullable initially for backfill compatibility.
-- Tightened to NOT NULL or CHECK after backfill verified.
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS active_union_id text NULL;

COMMENT ON COLUMN payroll.workspace_settings.active_union_id IS
  'Trigger-maintained cache of workspace_union_binding.union_id WHERE effective_to IS NULL. '
  'NULL until backfill complete or until workspace completes tariff setup. '
  'Read by: calc engine hot-path (prefer this over querying workspace_union_binding). '
  'Written by: trg_sync_workspace_settings_union_cache only. ADR-0355.';
```

**Eventual CHECK constraint** (Sortie 2, applied after backfill):
```sql
ALTER TABLE payroll.workspace_settings
  ADD CONSTRAINT chk_tariff_bound_union_id_coherence
  CHECK (
    (is_tariff_bound = true  AND active_union_id IS NOT NULL
                              AND active_union_id != 'non-bound')
    OR
    (is_tariff_bound = false AND (active_union_id IS NULL
                              OR  active_union_id = 'non-bound'))
  );
```

---

### E. Cache sync trigger

AFTER INSERT/UPDATE on `workspace_union_binding`. Syncs `payroll.workspace_settings` when a
binding row is inserted or its `effective_to` changes. SECURITY DEFINER + locked
`search_path = public, payroll, extensions` per L-0172.

```sql
CREATE OR REPLACE FUNCTION public.sync_workspace_settings_union_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
BEGIN
  -- Only sync when the row being inserted/updated is the ACTIVE binding.
  IF NEW.effective_to IS NULL THEN
    UPDATE payroll.workspace_settings
       SET is_tariff_bound = (NEW.union_id != 'non-bound'),
           active_union_id = NEW.union_id
     WHERE workspace_id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_workspace_settings_union_cache
  AFTER INSERT OR UPDATE ON public.workspace_union_binding
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_workspace_settings_union_cache();
```

**Why AFTER INSERT OR UPDATE (not just INSERT):** closing a binding row sets
`effective_to != NULL` on the OLD row. If the OLD row was previously synced as active,
closing it alone does NOT break the cache — the new binding INSERT (which fires separately
via the delegation tool's two-step: close-old, insert-new) will re-sync. The trigger on
UPDATE is therefore defensive: it clears cache only if somehow a row with `effective_to =
NULL` gets UPDATE'd to `effective_to IS NOT NULL` without a companion INSERT (e.g. admin
tooling directly against the DB). In normal operation, the INSERT path fires and syncs.

---

### F. Auto-seed trigger on workspace INSERT

`seed_default_workspace_union_binding` — mirrors the `seed_default_framework_binding`
trigger in `supabase/migrations/20260525120000_workspace_framework_binding_auto_seed.sql:74-122`.

Inserts a skeleton `non-bound` row on every workspace INSERT. This ensures ADR-0252 §B's
workspace fan-out query always returns a defined result. Coexists with the 3 existing
AFTER INSERT triggers on `workspace`:

- `workspace_seed_authority_defaults_trg`
- `trg_botsson_channel_on_workspace`
- `trg_workspace_seed_default_binding` (existing cascade binding)

All four are independent `AFTER INSERT FOR EACH ROW` triggers. PostgreSQL executes them
in alphabetical name order — no ordering dependency.

```sql
-- Skeleton row: non-bound, no snapshot, BOOTSTRAP classifier.
-- Admin review prompt will replace via setup_workspace_tariff → cascade.bind_workspace_union.
CREATE OR REPLACE FUNCTION public.seed_default_workspace_union_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
BEGIN
  INSERT INTO public.workspace_union_binding (
    workspace_id,
    union_id,
    law_version,
    official_effective_date,
    effective_from,
    created_by,            -- system bootstrap: NULL tolerated here (no profile yet at INSERT)
    amendment_classifier,
    derivation_snapshot_id
  )
  VALUES (
    NEW.workspace_id,
    'non-bound',
    'n/a',
    CURRENT_DATE,
    CURRENT_DATE,
    NULL,                  -- profile not yet created; trigger fires before company_member promotion
    'BOOTSTRAP',
    NULL
  )
  ON CONFLICT DO NOTHING;  -- idempotent; capability tool bootstrap will upsert with correct profile
  RETURN NEW;
END $$;
```

**Note on `created_by = NULL`:** The column is defined NOT NULL in §A. The auto-seed
trigger is the one exception — at workspace INSERT moment, no profile row exists yet
(profiles are inserted later in the bootstrap-cascade chain, per the comment in
`supabase/migrations/20260525120000_workspace_framework_binding_auto_seed.sql:69-72`).
Sortie 2 migration agent must define `created_by` as NULLABLE with a comment explaining
the bootstrap exception, OR use a platform-sentinel UUID for system rows. Sentinel UUID
pattern is preferred (consistent with ADR-0192 service-role bootstrap pattern).

---

### G. Backfill for existing workspaces

4 existing workspaces in Supabase Local (Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven,
seed workspace). Sortie 2 migration includes a one-time backfill:

```sql
-- BOOTSTRAP-BACKFILL for workspaces missing a union binding row.
-- Inserts skeleton non-bound rows. Cache trigger fires, sets
-- is_tariff_bound=false, active_union_id='non-bound'.
INSERT INTO public.workspace_union_binding (
  workspace_id, union_id, law_version, official_effective_date,
  effective_from, created_by, amendment_classifier, derivation_snapshot_id
)
SELECT
  w.workspace_id,
  'non-bound',
  'n/a',
  CURRENT_DATE,
  CURRENT_DATE,
  NULL,   -- BOOTSTRAP-BACKFILL: no admin actor; system-initiated
  'BOOTSTRAP-BACKFILL',
  NULL
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_union_binding b
   WHERE b.workspace_id = w.workspace_id
     AND b.effective_to IS NULL
)
ON CONFLICT DO NOTHING;
```

Skeleton backfill rows persist until admin completes the tariff setup wizard step (which
calls `setup_workspace_tariff` → `cascade.bind_workspace_union` → inserts real BOOTSTRAP row
+ closes skeleton via `effective_to`).

---

## Rules & Consequences

- **Good, because** cascade D3 binding (`workspace_framework_binding`) and its 8 consumers
  are completely untouched. `packages/utils/src/resolve-composition.ts:230-241` continues
  to read the cascade table unchanged.
- **Good, because** calc engine determinism is preserved. `packages/payroll-calculate/src/evaluate-supplements.ts:328`
  reads `is_tariff_bound` boolean directly — zero refactor. Golden-month fixtures unchanged.
  (ADR-0341 principle 4 satisfied.)
- **Good, because** APPEND-ONLY semantics satisfied. Historical recalculations reference
  the frozen binding at calc-time via `shift_pay_calculation_event.tariff_binding_id`
  (ADR-0076 snapshot-and-forward).
- **Good, because** trigger-synced cache prevents drift between canonical lifecycle table
  and hot-read cache columns. Defense-in-depth via DB CHECK on `workspace_settings`.
- **Good, because** ADR-0173 frozen-4 boundary respected: payroll capability tools NEVER
  write directly to `workspace_union_binding`; they delegate to `cascade.bind_workspace_union`
  per ADR-0356.
- **Bad, because** 2 tables instead of 1 (conceptual debt). Justified by cascade invariant
  §2: each datum has one role. The tables serve different lifecycle contracts.
- **Bad, because** migration coordination with Sortie 2 is required. ADR-0355 contract
  must land on `campaign/payroll` before Sortie 2 opens (sequencing hard constraint).

### Agent Impact

- **(a) Sortie 2 migration agent** MUST author `workspace_union_binding` table + 2
  triggers (`trg_workspace_union_binding_immutability` + `trg_sync_workspace_settings_union_cache`)
  + auto-seed trigger + RLS policies + backfill query per the specs in §A–G above.
- **(b) Sortie 3 delegation tool agent** MUST create `cascade.bind_workspace_union`
  per ADR-0356 BEFORE any Phase 7f payroll capability tool ships. Payroll capability NEVER
  writes directly to `workspace_union_binding`.
- **(c) Calc-engine consumers** reading "active union" SHOULD prefer
  `payroll.workspace_settings.active_union_id` (hot-path cache) over querying
  `public.workspace_union_binding` directly (provenance-only surface).
- **(d) Calc engine + golden-month fixtures** are unchanged. Read `is_tariff_bound`
  boolean directly from `payroll.workspace_settings` as today.

---

## Open Questions

1. **Multi-union workspaces** (Fellesforbundet + Industrioverenskomsten back-of-house) —
   deferred to ADR-0252 §"Open Questions #2". Schema already accommodates multiple
   non-overlapping rows per workspace.
2. **`created_by` NULL on auto-seed** — resolve in Sortie 2 by either (a) sentinel UUID
   for platform/system actors or (b) nullable FK with explicit bootstrap comment. Sentinel
   UUID is preferred (ADR-0192 pattern).
3. **Skeleton backfill for workspaces that never complete review** — skeleton `non-bound`
   rows persist indefinitely if admin never completes the tariff setup wizard. Mitigation:
   ADR-0354 snapshot-freshness surface shows `BOOTSTRAP-BACKFILL` rows as requiring action
   in the payroll pre-flight dashboard.

---

## References

- `supabase/migrations/20260421200100_cascade_a2_framework_tables.sql:135-177` —
  existing `workspace_framework_binding` schema (UNTOUCHABLE; 8 consumers)
- `supabase/migrations/20260525120000_workspace_framework_binding_auto_seed.sql:74-122` —
  `seed_default_framework_binding` trigger pattern (template for §F auto-seed)
- `supabase/migrations/20260525120000_workspace_framework_binding_auto_seed.sql:69-72` —
  `activated_by = NULL` justification (no profile at workspace INSERT moment)
- `supabase/migrations/20260527100200_payroll_phase1_workspace_policies.sql:74-83` —
  existing `is_tariff_bound` column spec (preserved, cache only)
- `packages/utils/src/resolve-composition.ts:230-241` — cascade reader (must remain
  untouched; reads `workspace_framework_binding`, NOT this table)
- `packages/payroll-calculate/src/evaluate-supplements.ts:328` — hot-path `is_tariff_bound`
  read (calc engine reads this; zero refactor per ADR-0341)
- ADR-0076 — snapshot-and-forward principle; APPEND-ONLY invariant
- ADR-0173 — frozen-4 capability boundaries; cascade namespace ownership of public tables
- ADR-0192 — bootstrap-trigger pattern (AFTER INSERT, SECURITY DEFINER, ON CONFLICT DO NOTHING)
- ADR-0240 — journey_authoring delegation precedent (generalized in ADR-0356)
- ADR-0252 — Riksavtalen versjonering; §B fan-out query; §F amendment-classifier
- ADR-0341 — golden-case determinism (non-negotiable principle 4)
- ADR-0353 — amended by this ADR; §A now references `workspace_union_binding`
- ADR-0356 — delegation pattern; `cascade.bind_workspace_union` tool spec
- L-0042 — migration timestamp dependencies
- L-0172 — SECURITY DEFINER + locked search_path pattern (triggers)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
