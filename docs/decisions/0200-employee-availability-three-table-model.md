---
title: "Employee Availability three-table model (D2 source separation)"
id: ADR_0200
status: proposed
layer: decision
created: 2026-04-23
updated: 2026-04-23
supersedes: []
amends: []
related: [ADR_0024, ADR_0065, ADR_0091, ADR_0099, LEARNING_0129, LEARNING_0131, LEARNING_0132]
---

# ADR-0200: Employee Availability three-table model (D2 source separation)

## Context and Problem Statement

Hospitality gap analysis (Council 2026-04-23) surfaced a missing primitive: employees have no way to express soft unavailability ("jeg *kan* ikke jobbe torsdag kveld") or ranking preference ("helst ikke åpning, helst lange vakter"). Today the only employee-writable temporal primitive is `schedule_absence` — a D6 execution entity for formal absence (sickness, vacation, permitted leave) with manager-approval semantics and payroll implications.

The tempting collapse — "extend `schedule_absence.absence_type` to include `'preference_unavailable'` / `'preference_rank'`" — fails on three orthogonal tests: lifecycle owner (absence is approved by manager, preference is asserted by employee), RLS (absence INSERT is `is_admin_in_workspace`-gated, self-service would require weakening or splitting the policy), and cascade role (absence is D6 execution data, preference is D2 source data that *feeds* D6 scheduling — not competes with it). Collapsing these into one table violates cascade invariant #2 (every datum has one role, L-0130).

This ADR specifies the minimal three-table split that keeps each datum in its correct cascade layer, with RLS that matches the actual writer, without touching `schedule_absence`'s existing admin contract.

## Decision Drivers

- **Cascade invariant #2 — one role per datum.** `schedule_absence` is D6 (execution ledger consumed by payroll + roster). Preference + soft-unavailability is D2 (source signal consumed by D4 demand model + D5 roster assignment). Mixing them means a single `absence_type` enum has to carry two lifecycle shapes, two RLS shapes, and two downstream consumer sets. L-0130 names this failure mode.
- **RLS already locked on `schedule_absence` (L-0132).** `schedule_absence` has `is_admin_in_workspace`-gated INSERT — employees cannot write the table at all. Extending it for self-service requires either weakening the admin gate (regression for the existing admin-owned absence flow) or adding a second INSERT policy branching on `absence_type` (load-bearing policy logic that breaks on next `absence_type` value add). New table with clean self-write RLS is cheaper and safer than rewriting `schedule_absence`'s policy.
- **Authority model fits three capabilities, not one (ADR-0024 / ADR-0173 pattern).** `availability.set_own` (self-write), `availability.query_others` (manager/roster reads), `availability.preference_rank` (self-write, ranking subset). Different authority defaults per capability — min_role=employee / min_role=manager / min_role=employee. Single-table collapse forces one capability name to cover three authority shapes.
- **Downstream consumer clarity.** D4 demand model (ADR-0065 budget engine) and D5 roster (`schedule_shift` assignment) read preference as *signal*, not *absence*. Naming the table `employee_availability` + `employee_availability_preference` makes the consumer query honest; naming it `schedule_absence WHERE absence_type IN (...)` buries intent behind enum-filter ceremony.
- **Trust-gate precedent from shift-swap (L-0131).** Shift-swap capability landed with `gate_action` missing (see ADR-0201). Building availability on the same harness-broken precedent propagates the anti-pattern. Trust Gate blocks availability capability work until shift-swap is remediated; the three-table model is the *target shape* availability ships into once the precedent is honest.

## Considered Options

1. **Extend `schedule_absence` with `absence_type IN ('preference_unavailable','preference_rank')`** — REJECTED. Violates cascade invariant #2 (L-0130), requires weakening RLS (L-0132), and collapses three authority shapes into one capability. Classic "extend, don't add" trap when the three-test rule says otherwise.
2. **Single new table `employee_availability` with a `kind` enum (`soft_unavailable`, `preference_rank`)** — REJECTED. Closer than Option 1 but still collapses two lifecycle shapes into one `kind`-filtered table. Ranking preferences have list-ordering semantics (ordered tuples per employee per dimension); soft-unavailability has interval semantics (`tstzrange`). Two different index strategies, two different consumer queries, two different update patterns. The `kind` enum would be doing structural work that tables do better.
3. **Three tables — `schedule_absence` (unchanged, D6) + `employee_availability` (NEW, D2 source, interval-typed soft unavailability) + `employee_availability_preference` (NEW, D2 source, ordered ranking hints)** — CHOSEN. Each table has one lifecycle owner, one RLS shape, one authority default, one consumer query pattern. `schedule_absence` stays admin-owned and untouched. The two new tables are employee-writable with clean RLS. D4/D5 consumers read them as first-class signal inputs, not filtered slices of absence.

## Decision Outcome

Chosen option: **"Three tables"**, because the three-test rule (different lifecycle owner? different RLS? different authority?) returns "yes" on all three axes. Any "yes" on the three-test rule is a table-split signal (L-0130). Collapsing into `schedule_absence` would require breaking at least one of (RLS admin-gate, single lifecycle, single consumer query) — all three of which are load-bearing.

### Schema (target shape)

**`employee_availability` (NEW, D2 source)**
- PK `id uuid`, FKs `workspace_id`, `profile_id` (the employee), `period tstzrange NOT NULL` (the interval the employee signals as soft-unavailable), `reason text NULL` (free-text, optional), `created_at`, `updated_at`.
- RLS: employee INSERTs/UPDATEs/DELETEs own rows (`profile_id = auth.uid()` resolved via `workspace_member`); manager SELECT for employees in their department; admin full access. API-key read policy per workspace standard.
- Index: `GIST (workspace_id, profile_id, period)` + `btree (workspace_id, profile_id)`.
- Semantics: **soft** signal. Roster assignment MAY place a shift overlapping this period; payroll is indifferent to rows here.

**`employee_availability_preference` (NEW, D2 source)**
- PK `id uuid`, FKs `workspace_id`, `profile_id`, `dimension text` (e.g. `shift_type`, `shift_length`, `time_of_day`, `weekday`), `option_key text`, `rank smallint NOT NULL` (1 = most preferred), `created_at`, `updated_at`.
- UNIQUE `(workspace_id, profile_id, dimension, option_key)` — one rank per employee per option.
- RLS: identical shape to `employee_availability` (self-write, manager-read within department, admin full).
- Semantics: ranking hints for the D5 roster scorer; no hard veto power.

**`schedule_absence` (UNCHANGED)**
- Existing admin-gated table. No new `absence_type` values added for preference/availability. `is_admin_in_workspace` INSERT gate preserved.

### Capabilities (new)

Per ADR-0173 capability-model pattern:

| Capability | Surface | Default Authority | Default Channel |
| --- | --- | --- | --- |
| `availability.set_own` | Web + mobile self-service | `suggest` / min_role=employee | `chat` (personal data, scheduling.own — ADR-0202) |
| `availability.query_others` | Web + mobile (manager) | `read_only` / min_role=manager | `chat` only (reveals other employees — ADR-0202) |
| `availability.preference_rank` | Web + mobile self-service | `suggest` / min_role=employee | `chat` |

Seeded via authority seed migration (not runtime insert) per ADR-0176 pattern. `gate_action` mandatory on all three (ADR-0201).

### What this ADR does NOT do

- Does NOT modify `schedule_absence` schema, RLS, or authority.
- Does NOT introduce a hard-veto availability model (interval here is *soft*; D5 roster may override with manager action + audit).
- Does NOT resolve overlap between `schedule_absence.period` and `employee_availability.period` — consumer queries (D5 roster) read both, with `schedule_absence` winning on conflict because absence is the approved, payroll-binding record.
- Does NOT specify the D4 demand model's consumption contract — tracked separately.

## Rules & Consequences

- **Good, because** each table has one role, one RLS shape, one authority default, one consumer query pattern. Cascade invariant #2 holds; no enum-filter ceremony papers over semantic drift.
- **Good, because** `schedule_absence` admin contract is untouched — no regression risk to existing absence approval flow, no RLS policy-branch rewrite, no `absence_type` enum expansion.
- **Good, because** capability shapes match authority shapes: self-write for `set_own` and `preference_rank`, read-only for `query_others`. Single capability with conditional authority would be a smell.
- **Bad, because** three tables is more surface than one — migration, types, RLS, seed, tests, docs all 3×. The cost is structural honesty; the alternative (one table with `kind`/`absence_type` enum) is false economy that shows up as future RLS or consumer-query complexity.
- **Bad, because** consumer queries (D5 roster, D4 demand) must UNION across `schedule_absence ∪ employee_availability` to compute "is this employee available at time T". Helper view / RPC may hide the union; the two-table shape under the view remains correct.
- **Agent Impact:**
  - Any mutation tool surfacing `availability.set_own` / `availability.preference_rank` MUST call `gate_action` before DB write (ADR-0201).
  - `availability.query_others` MUST NOT be surfaced on voice channel (reveals other employees — ADR-0202).
  - New capability tools under `packages/ai/src/capabilities/availability/` (or equivalent) register via `CapabilityName` union and seed `engine_authority_config` in the same PR.
  - Roster/D5 code reading availability MUST read both `schedule_absence` (hard) and `employee_availability` (soft), with clear precedence — absence wins.

## References

- ADR-0024 — C4 authority policy (base pattern).
- ADR-0065 — Hospitality Operations Cockpit v1 contract (D4/D5 consumer surface).
- ADR-0091 — `cascade_gate_write` RPC (pathway B — not used here; availability is capability-tool pathway A).
- ADR-0099 — unified authority gate (pathway A — availability capabilities route through here).
- ADR-0173 — capability-model pattern (four-capability analogue).
- ADR-0176 — authority seed migration pattern (seed, not runtime insert).
- L-0129 — registry-entry-as-typo phantom-contract subclass (availability emit events must not typo-drift).
- L-0130 — cascade layer separation forces table count (the three-test rule applied).
- L-0131 — Trust Gate blocks greenfield on broken precedent (availability blocked until shift-swap remediation).
- L-0132 — RLS admin-gate kills "extend, don't add" argument (the specific RLS analysis behind this ADR).

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
