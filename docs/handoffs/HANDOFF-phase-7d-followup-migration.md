---
title: "Handoff — phase-7d-followup-migration"
status: done
feature: phase-7d-followup-migration
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [handoff, payroll, lovsen, phase-7d, migration, schema]
---

# Handoff — phase-7d-followup-migration

## Summary

Sortie 2 of 3 in Phase 7d-followup execution. Shipped migration
`20260618100000_workspace_union_binding_and_tariff_floor.sql` implementing ADRs 0355 +
0353 amended §A+§D + 0351 amended (Option C → TRIGGER). Single migration file with 10
Parts (A–J): new `public.workspace_union_binding` lifecycle table, new
`payroll.tariff_snapshot` provenance table, 2 columns added to `payroll.workspace_settings`
(`active_union_id`, `active_binding_id`), 1 column added to
`public.shift_pay_calculation_event` (`tariff_binding_id`, NULLABLE), 3 triggers (cache
sync Part E, auto-seed stub Part F, tariff-floor enforcement Part G), RLS policies
(JWT + API key per ADR-0153), pre-migration audit DO-block (Part I), and self-test
DO-block (Part J). Applied clean on local Supabase. Types regenerated. 240/240 golden-month
tests pass. 13/13 typecheck pass on affected packages. Backfill (Part H) seeded 6
BOOTSTRAP-BACKFILL rows for existing dev workspaces; 0 `workspace_settings` cache rows
updated (settings absent for all 6 dev workspaces — expected, per learning below). Phase
7f capability tools remain BLOCKED on Sortie 3 delegation tools per ADR-0173 frozen-4 +
ADR-0356.

---

## Decisions Made

### Single migration file (not split per-Part)

Canonical pattern from `20260525120000_workspace_framework_binding_auto_seed.sql` —
all Parts in one file, atomic apply. Fewer self-test DO-blocks to coordinate across
files; migration failures roll back the whole unit, not partial schema. Accepted tradeoff:
single large file harder to review in isolation. Mitigated by Part-labeled comments and
pre-migration audit DO-block (Part I) that validates state before destructive Parts fire.

### `tariff_snapshot` schema = `payroll`

Phase 5 council chair self-reversal per ADR-0355 Gap 5. Original ADR-0353 §B proposed
`public` schema. Code-tracer found `payroll` schema hosts all payroll-domain provenance
tables. Chair reversed to `payroll`. Consistent with `payroll.workspace_settings`,
`payroll.payroll_calculation`, and `payroll.payroll_period` schema placement.

### `seed_default_workspace_union_binding` trigger (Part F) is a no-op stub

Trigger fires on `public.workspace` INSERT (parallel to `seed_default_framework_binding`
for cascade D3). At workspace INSERT time, no profile exists yet — the trigger cannot
resolve `created_by_profile_id` for the lovsen binding row. Rather than silently insert
a binding without a creator, trigger emits `RAISE NOTICE` deferring to Phase 7f
`setup_workspace_tariff` capability tool. Trigger is retained as an architectural
placeholder for future bootstrap-cascade EF integration. Decision: no-op is safer than
partial INSERT; Phase 7f tool is the correct seeding path.

### `shift_pay_calculation_event.tariff_binding_id` column NULLABLE

Per ADR-0353 §D amendment + ADR-0251 append-only constraint: historical rows in
`shift_pay_calculation_event` cannot be backfilled retroactively. Making the column
NOT NULL would require backfilling thousands of historical audit rows — violates
append-only semantics. NULLABLE accepted; all new rows post-Sortie 2 should populate
`tariff_binding_id` via Phase 7f calc-engine integration. Historical NULL is documented
as an accepted audit gap (ADR-0353 §D amended).

### Part H backfill uses subquery iteration with `IF EXISTS` skip-guard

Alternative was `INSERT ... ON CONFLICT DO NOTHING` with a `SELECT workspace_id FROM
workspace` subquery. The `IF EXISTS` skip-guard was chosen because (a) workspaces with
profiles missing a role column needed conditional logic that ON CONFLICT alone cannot
express, and (b) the explicit skip-log via `RAISE NOTICE` provides a migration-time
audit trail of which workspaces were skipped and why. On CONFLICT handles deduplication;
`IF EXISTS` handles the pre-check.

### Part J self-test scope is defensive (settings-row-absent is acceptable)

Original self-test design was going to assert "all backfilled bindings have
`payroll.workspace_settings` cache populated." Dev workspaces have `workspace` rows and
profile rows but NO `payroll.workspace_settings` rows — settings created later by
bootstrap-cascade EF, not at workspace INSERT. Self-test assertion softened to:
"all active bindings have populated `workspace_settings` cache WHERE settings row
exists." This allows migration to succeed on dev databases while still catching cache
trigger failures on databases where settings rows do exist.

---

## Learnings Discovered

### `npx supabase gen types typescript --local` emits CLI warnings on STDOUT

`supabase gen types typescript --local` outputs CLI warning lines (e.g., deprecation
notices, schema introspection progress) to STDOUT mixed with the TypeScript output.
Without stderr suppression, warning lines leak into `database.types.ts` and corrupt
the file — typecheck then fails with parse errors on the injected warning text. Fix:
run with `2>/dev/null` to route CLI warnings to stderr only. Different class from
`L-op-run-corrupts-gen-types` (1Password substitution) but same symptom:
`database.types.ts` contains non-TypeScript text, typecheck fails. Caught by typecheck
failure on first types regen attempt; fixed by re-running with stderr suppression
in commit 4c1c66d04. Promote to standalone learning (L-0295 candidate) if recurs on
next types regen.

### Part J self-test must account for settings-row-absent dev workspaces

The expectation that "all backfilled bindings have cache rows" is only valid on databases
where `payroll.workspace_settings` rows are pre-populated. Dev databases use a different
bootstrap order: (1) workspace INSERT → (2) profile created by bootstrap-cascade EF →
(3) settings created by a later EF call. Between steps 1 and 3, Part H backfill
fires and the cache trigger silently no-ops (0 rows updated). This is correct behaviour
— not a trigger bug. Self-test must use a WHERE EXISTS filter to only assert cache
populated for workspaces that already have a settings row. Blanket assertion would
produce false-fail on dev, hiding real failures on production. Defensive self-test
scope is the correct pattern for migrations that run on databases with varying setup
completeness.

---

## Known Issues / Debt

### Phase 7f capability tools ALL Trust Gate FAIL — blocked on Sortie 3

`setup_workspace_tariff`, `change_workspace_tariff`, `add_supplement_override` — all
three capability tools from the original Phase 7f plan are BLOCKED on Sortie 3
delegation tools (`cascade.bind_workspace_union`, `cascade.add_supplement_rule`) per
ADR-0356. Trust Gate Fail verdict from Sortie 1 council: tools must delegate via
Sortie 3 tools before they can be implemented (ADR-0173 frozen-4 namespace boundary +
ADR-0204 `gatedMutation` mandatory on delegation tools). Phase 7f does NOT open until
Sortie 3 closes.

### 6 BOOTSTRAP-BACKFILL rows in local dev — production cutover needs verification

Part H backfill seeded 6 `BOOTSTRAP-BACKFILL` rows in local dev. All 6 used
`union_id='non-bound'` skeleton (no real tariff binding). Production cutover requires:
(a) verifying each production workspace has ≥1 admin/owner profile before migration
applies (Part H skips workspaces without profiles — creates silent gap if production
has profile-less workspaces), (b) confirming production `payroll.workspace_settings`
rows exist before expecting cache trigger to populate them, (c) running Part J self-test
against production state. Consider adding a pre-deploy check script before production
apply.

### `seed_default_workspace_union_binding` trigger is a no-op stub

Part F trigger fires on `public.workspace` INSERT but does nothing (RAISE NOTICE only).
Future Phase 7f wizard integration may: (a) convert to active trigger once
bootstrap-cascade EF guarantees profile existence before trigger fires, OR
(b) remove trigger entirely and rely solely on Phase 7f `setup_workspace_tariff` tool.
Defer decision to Phase 7f planning — current stub is safe (RAISE NOTICE cannot break
workspace creation).

### 358 cert-cells carry pre-pivot lineage — BOOTSTRAP-BACKFILL Phase 7c follow-on

Per Sortie 1 HANDOFF: 358 certification cells stamped `lovsen-mcp@v1` carry pre-pivot
rate derivation lineage. These will be re-derived via Phase 7f `derive_supplement_set`
MCP once delegation tools ship (Sortie 3). Cannot re-derive until `cascade.add_supplement_rule`
delegation tool exists AND Bubble workspace bindings are seeded with real `union_id`
values (not `'non-bound'`).

### `shift_pay_calculation_event.tariff_binding_id` audit gap on historical rows

Column added NULLABLE; all historical rows carry NULL. New calc-engine runs post-Sortie 2
should populate `tariff_binding_id` via Phase 7f calc-engine integration with binding
lookup. Until Phase 7f ships, all new rows also carry NULL. Full audit coverage (every
calculation traceable to a binding row) requires Phase 7f calc-engine write integration.

---

## Next Steps

1. **Sortie 3:** Open `feat/payroll-phase-7d-cascade-delegation-tools` sub-sortie.
   Implement `cascade.bind_workspace_union` + `cascade.add_supplement_rule` delegation
   tools per ADR-0356. Load `payroll-engine-developer` + `smartout-database-guide` +
   `smartout-cascade-developer` skills. ADR-0204 `gatedMutation` mandatory. Required
   before Phase 7f can open.

2. **Phase 7f:** Capability tools (`setup_workspace_tariff`, `change_workspace_tariff`,
   `add_supplement_override`) + onboarding wizard tariff selection step + admin drift
   inbox UI per ADR-0353 amended §B+§C + ADR-0351 amended + ADR-0354 freshness cron.
   Gated on Sortie 3 delegation tools. Load `payroll-engine-developer` skill before
   authoring any Phase 7f capability tool.

3. **Phase 7e:** Lovsen bridge (`packages/ai/src/lib/lovsen-client.ts` + BFF routes
   added to workspace-api gateway) per ADR-0350 HTTP-via-BFF transport contract.
   Can open in parallel with Sortie 3 — no schema dependency on delegation tools,
   only on ADR-0350 transport spec.

4. **BOOTSTRAP-BACKFILL Phase 7c follow-on:** Re-derive 358 cert-cells via
   `derive_supplement_set` MCP once Phase 7f delegation tools ship and Bubble workspace
   bindings are seeded with real `union_id` values (Strøm Mat & Bar, Bårdshaug Vegkro,
   Yogurt Heaven).

5. **Production cutover:** Before applying migration `20260618100000` on production,
   verify all production workspaces have ≥1 admin/owner profile (Part H skip-guard
   creates silent gap otherwise). Consider pre-deploy check script. Coordinate with
   Phase 7f `setup_workspace_tariff` rollout — production `workspace_union_binding`
   rows need real `union_id` values, not `'non-bound'` skeletons.
