---
title: "ADR-0005: Raw JSON capture target on mapping schema"
status: accepted
created: 2026-04-16
updated: 2026-04-16
module: strike-mcp
tags: [decision, framework, mapping, engine, archive]
---

# ADR-0005: Raw JSON capture target on mapping schema

## Status

Accepted 2026-04-16 — extends ADR-0004. Required for `salary_transactions`
attestation (Day 2 of Tier 1 finish plan).

## Context

The v3 table `public.payroll_ledger_archive` declares
`raw_json jsonb NOT NULL` (no DEFAULT). Per smartout.ai ADR-0110, every
migrated payroll-ledger row must carry the **complete** Bubble source record
as JSONB, so future questions about the historical ledger can be answered
without re-scraping Bubble. This pattern will recur for any future archive
table that captures pre-cutover data verbatim.

The existing framework (field_map + ADR-0004 derived_columns + constant_columns)
cannot express "the value is the entire source record":

- field_map maps **one Bubble field → one v3 column**. There is no syntax for
  "the source is the whole record."
- derived_columns reads from a single `from` field. There is no `$record`
  pseudo-source.
- constant_columns is per-row identical, so it cannot capture row-specific data.

Two designs were considered:

**A. Synthetic `$record` pseudo-source for derived_columns.**
Add a `json_self` transform; engine treats `from: "$record"` specially and
passes the entire record. Rejected: overloads derived_columns semantics,
introduces a magic string, and the transform name leaks the pattern into the
transform registry where it doesn't belong (it's not really a transform of a
single value — it's a row-level capture).

**B. New top-level `raw_json_target` field on Mapping.** Engine, after
field_map / derived / constants processing, sets
`row.values[mapping.raw_json_target] = record` (the full record object). Pure
schema-level extension; engine logic is one line; no magic strings.

Design B chosen for clarity and minimum framework surface area.

## Decision

Extend the Mapping schema with one optional field:

```typescript
export interface Mapping {
  // ...existing
  raw_json_target?: string;
}
```

**Engine processing order** (extends ADR-0004):

1. field_map iteration (one Bubble field → one v3 col, optional transform)
2. derived_columns iteration (from-field + transform name → v3 col)
3. constant_columns iteration (literal value → v3 col)
4. **NEW:** if `mapping.raw_json_target` is set, assign the full record object to
   `row.values[mapping.raw_json_target]`. The SQL emitter then JSON.stringifies
   it when serializing the INSERT.

The full source record is captured as-is — no field stripping, no
transformation. Audit fidelity over compactness.

**Alignment blocker check** (`scripts/lib/align.ts`) must add the raw_json
target to `mappedV3Columns` so the column is not flagged as a missing NOT NULL
blocker. Same pattern as derived/constant additions in ADR-0004.

**Conflict ordering rule:** if a column appears in both field_map and
raw_json_target (or derived/constant), the later phase wins by overwrite.
Documented for completeness; in practice raw_json_target should be reserved
for dedicated jsonb capture columns and not overlap with field_map targets.

## Consequences

**Positive:**

- Enables `salary_transactions` attestation today via auto_align (no manual
  SQL escape hatch needed).
- Pattern is reusable for any future archive-style table (e.g., a future
  `time_entry_archive` or `notification_archive`).
- Engine code change is ~3 lines; alignment check is ~3 lines.
- No new transform; no overloaded semantics.

**Negative:**

- Adds one more way for a v3 column to be populated. A reviewer must learn
  four mechanisms (field_map / derived / constant / raw_json_target) instead
  of three. Mitigated by the engine processing order being explicit and by
  the field being clearly scoped to "the whole record."
- Per-row JSONB payload is large for `salary_transactions` (28 fields × 17,607
  rows ≈ several MB of inline JSON in the emitted SQL file). Acceptable for
  one-shot dry-run apply; would need streaming if applied in production hot
  path (out of scope per ADR-0002 — strike-mcp is dry-run-only).

## Implementation references

- `src/research/mapping.ts` — add `raw_json_target?: string` to Mapping
  interface.
- `src/migration/engine.ts` — append raw_json assignment after constants
  loop in `runEngine()`.
- `scripts/lib/align.ts` — extend `mappedV3Columns` set to include the
  raw_json target if present (mirrors ADR-0004 derived/constant pattern).
- `tests/migration/engine.test.ts` — add test verifying raw_json_target
  populates with full record on a fixture mapping.

## Related decisions

- ADR-0004 (derived + constant columns) — same architectural lane, this is
  the third extension point.
- smartout.ai ADR-0110 (payroll_ledger_archive raw_json requirement) — the
  consumer requirement that motivated this.
- ADR-0002 (incremental migration) + ADR-0003 (conflict strategy amendment) —
  context for why dry-run-only acceptability of large JSON payloads.
