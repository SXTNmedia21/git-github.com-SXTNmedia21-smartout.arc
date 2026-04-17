---
title: "ADR-0004: Derived columns + constant columns in mapping schema"
status: accepted
created: 2026-04-16
updated: 2026-04-16
module: strike-mcp
tags: [decision, framework, mapping, engine, transforms]
---

# ADR-0004: Derived columns + constant columns in mapping schema

## Status

Accepted 2026-04-16 in response to council 2026-04-16 P.1 verdict during
workspace-and-company attestation.

## Context

`runEngine()` builds row.values purely from `mapping.field_map` — one Bubble field
maps to exactly one v3 column, optionally via a transform. This was insufficient
for two real cases that surfaced during Wrightegaarden Tier 1 migration:

1. **Slug derivation.** v3 tables like workspace, location, department, team have
   `slug text NOT NULL` (no DEFAULT). Bubble has no slug field — it must be derived
   from the entity's name (e.g., `slugify(Titel)`). 17 v3 tables follow this pattern.
   The legacy `migrate_workspace.ts` tool computes `slugify(pickName(record))`
   externally, but that path was inconsistent with the auto_align flow and didn't
   actually inject slug into row.values.

2. **Source discriminator constant.** Per ADR-0108 (smartout.ai), 12 migration-
   targeted tables have a `source text NOT NULL DEFAULT 'operational'` column. Rows
   inserted by Bubble migration must carry `source = 'bubble_migration'` so the
   M8 reconciliation triggers don't fire on imported data. The Postgres DEFAULT
   silently lands rows as 'operational' if the engine doesn't override — defeating
   the safety mechanism.

A previous workaround (commit ea1ccff, since amended) added `slug` and `source` to
`CONTEXT_INJECTED_COLUMNS` in `scripts/lib/align.ts`. That suppressed the alignment
blocker but no engine-side code actually injected the values — the blocker check
was lying. Confirmed at attest time when reviewing actual SQL emission path.

The `field_map` shape (one source → one target) cannot represent:
- "Read Bubble field X, write to v3 column Y AND v3 column Z (with different
  transforms)"
- "Inject literal 'bubble_migration' into v3 column W on every row regardless of
  source data"

A schema extension is needed.

## Decision

### 1. Mapping schema gets two new optional fields

```typescript
interface DerivedColumn {
  from: string;       // Bubble source field name to read from
  transform: string;  // Registered transform name to apply
}

interface Mapping {
  // ... existing
  derived_columns?: Record<string, DerivedColumn>;
  constant_columns?: Record<string, string | number | boolean | null>;
}
```

Example:
```jsonc
{
  "target_table": "public.workspace",
  "field_map": { "Titel": { "target": "name", "transform": "trim", ... } },
  "derived_columns": {
    "slug": { "from": "Titel", "transform": "slugify" }
  },
  "constant_columns": {
    "source": "bubble_migration"
  }
}
```

### 2. Engine processes both after field_map

`runEngine()` iterates `mapping.field_map` first (existing behavior), then:
- For each `derived_columns[target]`, reads `record[from]`, applies the transform,
  writes to `values[target]`. Errors surface as record skips with `derived column
  "X" failed (from="Y", transform="Z"): <reason>`.
- For each `constant_columns[target]`, sets `values[target]` to the literal value.

Constant columns run last so they cannot be overwritten by derived/mapped columns
unintentionally.

### 3. New `slugify` transform registered

`slugify` is added to `src/migration/transforms.ts`. Implementation reuses
`src/migration/staging.ts`'s `slugify()` — single source of truth. Returns null
for null/empty input; throws for non-string input (catches misuse early rather
than producing junk slugs).

### 4. Alignment blocker check honors derived + constant columns

`scripts/lib/align.ts` blocker check now extends `mappedV3Columns` to include
keys from `mapping.derived_columns` and `mapping.constant_columns`. A v3 column
satisfied by derivation or constant is no longer flagged as a NOT NULL blocker.

### 5. `slug` removed from `CONTEXT_INJECTED_COLUMNS`

The previous allowlist entry for `slug` was a misleading workaround. It is
removed so any mapping that targets a NOT-NULL slug column without declaring
`derived_columns: { slug: ... }` correctly blocks at attestation time. Forces
the right pattern instead of silent breakage.

`source` is still NOT in CONTEXT_INJECTED_COLUMNS — the M7 DEFAULT handles the
NOT NULL constraint, and engineers must opt in to bubble_migration via
`constant_columns: { source: 'bubble_migration' }`.

### 6. Constant value type narrowing

Constants are `string | number | boolean | null`. Object/array constants are
intentionally rejected at the type level — those represent JSON payloads which
should be modeled as a transform (`json_literal:<json>`) if the need arises,
not as an opaque constant.

## Consequences

- **Migrations of slug-bearing entities work end-to-end.** Workspace, location,
  department, team, etc. can declare slug derivation and the engine emits
  complete INSERTs. Previously broken silently.
- **ADR-0108 source discriminator is enforced at engine level.** Mappings for the
  12 source-tagged tables MUST add `constant_columns: { source: 'bubble_migration' }`
  or the M8 reconciliation triggers fire on imported rows.
- **Existing mappings (workspace, company) need updating.** Workspace mapping
  attested 2026-04-16 already references `slug` implicitly via the
  CONTEXT_INJECTED_COLUMNS workaround; it must be re-attested with explicit
  `derived_columns` and `constant_columns`.
- **Mapping schema becomes richer but still backward-compatible.** Both new
  fields are optional; mappings without them work unchanged.
- **Engine error surface grows.** Derived column failures produce per-record skips
  with a target-named reason — easier to debug than transform errors on raw
  field_map iteration.
- **Test coverage extended.** transforms.test.ts adds slugify cases;
  engine.test.ts adds derived_columns + constant_columns cases.

## Related

- ADR-0001: Phase 3.5b auto-align (the alignment-shadow workflow)
- ADR-0002: Incremental migration via watermark
- ADR-0003: Per-entity conflict strategy (the explicit-decision philosophy)
- ADR-0108 (smartout.ai): bubble_migration source discriminator (the WHY for
  constant_columns)
- Council 2026-04-16: P.1 verdict that drove this framework change
