---
title: "DB Classification Table Anti-Pattern — Use TS Const Instead"
id: LEARNING_0173
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [schema, anti-pattern, classification, council, contract-module]
---

# Learning-0173: DB Classification Table Anti-Pattern

## Context

Council 2026-04-29 Steward review of Contract Module Phase 0a foundation flagged `field_classification_metadata` table (proposed in ADR-0001-contract-service) as anti-pattern. Table stored `(table_name, column_name, classification IN material/admin/derived/system)` to drive amendment-handler. Drift risk: rename column → silent classification gap. DB roundtrip required for every classify-change call. Mutable from anywhere → admin can edit classification of `personal_number` to `admin` (no consent needed) bypassing PII protection.

## Discovery

Schema-introspection tables (tables that describe other tables' columns) are an anti-pattern when the metadata is:
1. **Static or near-static** — classifications change with schema migrations, not operationally
2. **Type-safety-relevant** — classification drives compile-time enforcement, not runtime decisions
3. **Security-relevant** — drift = security boundary collapse

Better pattern: TypeScript const map in `packages/contracts/src/field-classification.ts`:
```ts
import type { Database } from "@smartout/supabase";

type ColumnKey<T extends keyof Database["public"]["Tables"]> = 
  `${T}.${Extract<keyof Database["public"]["Tables"][T]["Row"], string>}`;

export const FIELD_CLASSIFICATION = {
  "employment_contract.start_date": "material",
  "employee_payroll_profile.tax_table_number": "derived",
  // ...
} as const satisfies Record<ColumnKey<keyof Database["public"]["Tables"]>, FieldClassification>;
```

Result:
- Compile-time error if column renamed without classification update
- Compile-time error if classification missing for new column
- No DB roundtrip — synchronous access at amendment-handler call site
- Immutable at runtime — classification cannot be tampered with

Pattern signature for the anti-pattern:
- Migration creates table with `(table_name, column_name, ...)` columns
- Rows are seeded once, rarely updated
- Code reads from this table to drive logic
- No type-level connection to actual schema

## Impact

**ADR review checklist:** when ADR proposes new metadata table, ask: (a) does this metadata change at runtime? (b) is it type-safety-relevant? (c) is it security-relevant? If yes to any → propose TS const instead.

**ADR-0235 enforces:** field classification lives in TS const, not DB. `field_classification_metadata` table dropped from contract module foundation migration.

**Reusable pattern for similar future cases:** entity-property classification, capability-channel mapping, authority-level mapping — all candidates for TS const over DB table.

## References

- ADR-0235 (obligation lifecycle — drops field_classification_metadata)
- Council 2026-04-29 Contract Module Phase 0a
- Cascade integrity rule 4 (rules-as-data, declarative)

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-04-29.
