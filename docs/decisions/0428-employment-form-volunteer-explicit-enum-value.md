---
title: "Volunteer as explicit enum value on employment_contract.employment_form"
id: ADR_0428
status: accepted
layer: decision
created: 2026-05-26
updated: 2026-05-26
---

# ADR-0428: Volunteer as explicit enum value on employment_contract.employment_form

## Context and Problem Statement

`employment_contract.employment_form` carries a five-value enum
(`permanent | temporary | apprentice | practice | freelance`) that no
longer accommodates the Norwegian hospitality reality. Two real-world
patterns are unrepresentable:

1. **Volunteer staff** — festivals, NGO events, religious organisations.
   They draw no wage and must not flow to Tripletex payroll sync.
2. **Tilkallingsvakter / dagarbeid** — on-call event-only staffing
   common in NHO Reiseliv. Separate overtime thresholds.

ADR-0109 §Clause B (accepted 2026-04-22) established the legacy
discriminator: a migrated contract with `employment_form IS NULL AND
remuneration_type IS NULL` signals `volunteer / do-not-sync-to-Tripletex`
per the Wrightegaarden `⏱️Frivillig` row in `employee_type`.

Migration `20260519150000_contract_text_to_enum_cast.sql:140-160` then
introduced two regressions that collide with ADR-0109:

- Step C backfills every NULL → `'permanent'` ("ADR-0001 D1 fallback").
- Step C immediately sets `employment_form` to `NOT NULL`.

This silently rewrote every pre-Wave-3 volunteer contract to `'permanent'`,
losing the NULL-discriminator provenance, and made the legacy ADR-0109
Clause B signal physically impossible to express going forward.

**Restaurant-Week sim 2026-05-25 (BUG-SIM-01)** confirmed the impact: any
workspace with festival, NGO, or volunteer-staffed events on prod cannot
distinguish volunteers from permanent employees. Tripletex sync risks
filing W-2-equivalents for unpaid labour. Data loss already occurred.

## Decision Drivers

- ADR-0109 §Clause B (NULL = volunteer, no-Tripletex-sync) — superseded
  in form, preserved in intent by an explicit enum value.
- ADR-0427 §Decision Outcome — forward-only repair, never destructive
  migration. We cannot recover provenance lost in 20260519150000.
- ADR-0265 §Hard rules — no manual prod DDL outside the pipeline.
- L-0354 / restaurant-week sim — five independent agents flagged this.
- Postgres 17 supports `ALTER TYPE ... ADD VALUE` inside a transaction
  block when the new value isn't referenced in the same transaction.
- K1a `employee_type.employment_form_derived` already allows NULL for
  the `Frivillig` row — derivation column stays NULL-tolerant, parent
  column gets the explicit `volunteer` value.

## Considered Options

1. **Option A — Keep enum unchanged, drop NOT NULL** — restore ADR-0109
   semantics. Tradeoffs: NULL ambiguity (no signal vs explicit
   volunteer); breaks DECLARED-CONTRACT-FULFILLMENT (ADR-0421); existing
   `employment_form NOT NULL` callers throughout the code expect non-NULL.
2. **Option B — Add `is_volunteer BOOLEAN NOT NULL DEFAULT false`
   sibling column** — additive, no enum change. Tradeoffs: two sources
   of truth (employment_form + is_volunteer); CHECK constraint needed
   to enforce mutual exclusion; doubles surface area for new categories
   (tilkalling, dagarbeid).
3. **Option C — Add `'volunteer'` enum value, keep NOT NULL** —
   declarative, single source of truth, future-extensible. Cost: enum
   extension must precede any usage in same migration (Postgres 17
   allows but recommends ordering); recovery heuristic for lost rows
   is best-effort.

## Decision Outcome

Chosen option: **"Option C — Add `'volunteer'` enum value, keep NOT NULL"**,
because it (a) preserves ADR-0109 §Clause B intent in declarative form,
(b) honours ADR-0421 fulfillment semantics by requiring an explicit
declaration, (c) opens the path for future categories (tilkalling,
dagarbeid) via the same enum extension pattern, (d) keeps Tripletex
sync logic simple (`WHERE employment_form != 'volunteer'` is a clean
filter), (e) leaves the K1a `employment_form_derived` derivation column
untouched (NULL stays the platform-level skip-Tripletex signal).

### Concrete artifact

`supabase/migrations/20260716200000_employment_form_volunteer_enum.sql`:

1. `ALTER TYPE public.employment_form_enum ADD VALUE IF NOT EXISTS 'volunteer'`
2. Best-effort recovery heuristic — for `source = 'bubble_migration'`
   rows where `remuneration_type IS NULL AND employment_form = 'permanent'`,
   restore to `'volunteer'`. Provenance lost on non-bubble rows that hit
   the 20260519150000 Step C backfill — accept as known data-loss event
   per ADR-0427 §forward-only doctrine.
3. Comment update on `employment_form` documenting the new value and
   the ADR-0109 §Clause B supersession.

### Recovery limits

Workspaces that applied 20260519150000 BEFORE this migration:

- `source = 'bubble_migration'` volunteers: recoverable via heuristic
  above (NULL remuneration_type is a strong signal).
- `source = 'composition'` volunteers entered with NULL employment_form
  pre-Wave-3: **NOT recoverable** — backfill overwrote both fields. Self-
  correct path: admin re-authors contract via composition with the new
  enum value.

Workspaces created AFTER this migration: no data-loss risk; the
`'volunteer'` value is available from contract creation.

### Tilkallingsvakt / dagarbeid (deferred)

Out of scope for this ADR. Tilkallingsvakt has NHO Reiseliv-specific
overtime thresholds — separate ADR + framework_rule rows required.
This ADR establishes the enum-extension pattern; subsequent ADRs add
values one at a time as the K1a industry-package work lands.

### Tripletex sync

`supabase/functions/contract-*` and any payroll Tripletex sync EF MUST
add `employment_form != 'volunteer'` to their WHERE clause. Filed as
follow-up ticket — not part of this ADR's migration because Tripletex
sync is currently behind feature flag (no prod blast radius).

## Consequences

**Positive:**
- Volunteer pattern declaratively expressible.
- Pre-Wave-3 bubble-migration volunteers recoverable.
- Future hospitality categories (tilkalling, dagarbeid) ship via same
  enum-extension pattern.
- Single source of truth — no parallel `is_volunteer` flag.
- ADR-0109 §Clause B intent honoured; legacy NULL signal documented as
  superseded.

**Negative:**
- Composition-source volunteers entered with NULL pre-Wave-3 cannot be
  programmatically recovered. Self-correct via re-authoring.
- Tripletex sync filter must be updated in every consumer.
- Enum extension is permanent — `ALTER TYPE DROP VALUE` requires
  full table rewrite + verification that no rows reference it.

**Trade-off accepted:**
- Limited recovery scope (bubble-source only) traded for forward-only
  doctrine (ADR-0427) — destructive recovery would risk re-introducing
  the original ambiguity.

## Compliance / verification

After migration applies:

```sql
-- Verify enum extended:
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'public.employment_form_enum'::regtype
ORDER BY enumsortorder;
-- Expected: permanent, temporary, apprentice, practice, freelance, volunteer

-- Verify recovery heuristic landed:
SELECT COUNT(*) FROM public.employment_contract
WHERE source = 'bubble_migration'
  AND employment_form = 'volunteer';
-- Expected: matches count of bubble rows that had NULL remuneration_type
```

CI gate: no change to existing `scripts/check-otp-coherence.mjs` style
contracts; the migration is verified by the standard migration-coherence
CI step.

## Related

- ADR-0109 (migrated-contract-shell — §Clause B superseded in form)
- ADR-0427 (forward-only repair doctrine)
- ADR-0421 (declared-contract-fulfillment-rule)
- L-0354 (restaurant-week-sim council, BUG-SIM-01)
- `docs/test-runs/2026-05-25-restaurant-week-sim/SCHEMA-BUGS-TRIAGE.md`
  §BUG-SIM-01
