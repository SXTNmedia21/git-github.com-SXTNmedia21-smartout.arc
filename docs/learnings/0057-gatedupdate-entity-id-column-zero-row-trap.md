---
title: "Optional `entityIdColumn` default silently corrupts audit provenance"
id: LEARNING_0057
status: canonical
layer: learning
created: 2026-04-18
updated: 2026-04-18
tags: [gate-client, api-design, audit, provenance, typesafety]
---

# Learning-0057: Optional `entityIdColumn` default silently corrupts audit provenance

## Context

During Gate-Client Wave 2 council's Phase 3 code review (2026-04-18), Agent
Coordinator traced the `gatedUpdate` + `gatedDelete` helpers in
`packages/supabase/src/gate-client.ts`. The original API accepted
`entityIdColumn` as an optional parameter and defaulted to `"id"` when
omitted.

Smartout convention for primary keys on gated tables is `{table}_id`:
`profile.profile_id`, `season.season_id`, `schedule_shift.schedule_shift_id`,
`employment_contract.employment_contract_id`. There is no column named
`id` on most gated tables.

## Discovery

A caller forgetting to pass the explicit `entityIdColumn` triggers
`.eq("id", <uuid>)` inside the helper. That filter matches zero rows on
any gated table using the `{table}_id` convention. The Supabase client
returns `{ data: [], error: null }` — no error.

But `cascade_gate_write` has already logged the gate evaluation as
succeeded (the gate pre-check passed — only the WHERE clause failed to
match). Result:

- `activity_trail` records a mutation that didn't happen.
- `gate_evaluation` records an authority evaluation for a row that wasn't
  touched.
- `change_proposal` (if outcome was "proposed") claims provenance for a
  proposal whose underlying target row was never located.

**The audit trail lies.** Invariant 8 (provenance) violated. Trust-but-verify
breaks when the verification substrate cannot be trusted.

## Impact

**For the gate-client helper (fixed in this council):** Make
`entityIdColumn` REQUIRED at the type level. Callers who omit it get a
TypeScript compile error, not a runtime silent zero-row update. Default
values that produce silent corruption are worse than no default.

**For API design generally:** When a parameter's default value could
produce silent wrongness (as opposed to loud failure), the default must
be removed. Prefer compile-time failure over runtime silent wrongness.

**Pattern rule:** A governance-critical parameter (one whose value flows
into audit columns, authority checks, or provenance JSONB) cannot have an
optional default. Test that the type rejects callers who omit it — add
`@ts-expect-error` assertions in the test suite that prove the API is
non-optional.

**For code review:** Any helper in `packages/supabase/` or the capability
layer that writes to audit-tracked tables must have its parameter
optionality audited. Optional + default = re-review needed.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-04-18 (Gate-Client Wave 2)
- Helper under review: `packages/supabase/src/gate-client.ts`
- Fix landing in Wave 2A migration (entityIdColumn required)
- Related: Learning 0038 (registry destinations claim routes providers silently drop — same class: declaration claims, actuality fails, audit lies)
- Related: Learning 0043 (audit column→table identity verification — different shape, same root: audit claims not matched by runtime)
- Cascade Invariant 8: provenance tables must not contain entries for mutations that didn't happen.
