---
sortie: adr-0430-shift-zone-m2m
domain: core-structure
role: secondary (schema-axis owner)
primary_state_md: docs/domains/scheduling/STATE.md
state: S4
sub_state: plan-generation-pending
tier: T3
test_mode: continuous
design_link: n/a (schema reform — no Cloud Design)
adr: ADR-0430
adr_path: docs/decisions/0430-core-structure-reform-shift-zone-m2m.md
adr_status: accepted
council_verdict: APPROVE WITH CHANGES (4/4, 2026-05-27)
council_path: docs/audits/2026-05-27-core-structure-reform-index/INDEX.md
created_at: 2026-05-28T20:00:00Z
updated_at: 2026-05-28T20:00:00Z
imported_at: 2026-05-28T20:00:00Z
campaign: development
worktree: /home/sxtnl/dev/smartout.ai
import_mode: true
---

# STATE — Core-Structure Domain — ADR-0430 (secondary owner)

> **SECONDARY** ownership for this sortie. Primary STATE.md is `docs/domains/scheduling/STATE.md`. This file mirrors only the gate state for cross-domain visibility.
> Core-structure's scope here: schema-level changes (`schedule_shift` columns DROP, new `shift_zone` table, `profile.location_id` DROP, composite FK invariants, M0.5 + M3.5 pg_depend audits).

## Why core-structure is involved

ADR-0430 touches core-structural tables: `schedule_shift` (D2 planning record per cascade), `profile` (identity), and introduces `shift_zone` (new D6 junction). Per ADR-0392 spine, schema invariants live in core-structure; cascade-level D-axis ownership lives in scheduling. Both spines reference this reform.

## Mirror of scheduling STATE.md gate history

| Gate | State | Result | Source |
|------|-------|--------|--------|
| G1 | S1 | PASS (imported) | ADR-0430 accepted |
| G2 | S2 | PASS (imported) | Audit INDEX Track K |
| G3 | S3 | PASS (imported) | Council Phase 1-5 |
| G4 | S4 | PASS (2026-05-28T12:59Z) | ADR commit `dad1e3fd7` |
| G5 | S5 | AWAITING | Plan-generation in progress on scheduling STATE.md |

## Schema-axis Phase b deliverables (mirrored from PLAN-0..PLAN-4)

| Plan | Schema deliverable | Owner |
|------|--------------------|-------|
| PLAN-0 | M0.5 position orphan SQL report + M3.5 pg_depend audit + Rule 9 `channel_constraint` column check | core-structure (audits) |
| PLAN-1 | M1 (department_id NOT NULL backfill) + M2 (CREATE shift_zone + composite FKs + RLS) + M3 (backfill) | core-structure (DDL) |
| PLAN-4 | M4 (DROP COLUMN x3) + supabase gen types --local | core-structure (DDL) + scheduling (typegen blast radius) |

## Core-structure-specific risk

- **Composite FK invariants land in M2** — `shift_zone(zone_id, location_id) REFERENCES zone(id, location_id)` and `shift_zone(day_line_id, location_id) REFERENCES day_line(id, location_id)`. Both target tables need pre-existing UNIQUE(id, location_id) constraints. Per ADR-0430 §Rule 1: "both columns already exist on the target tables." PLAN-0 schema-precondition list MUST verify UNIQUE constraints exist before M2.
- **pg_depend audit (M3.5)** — every trigger/view/policy referencing dropped columns must be rewritten BEFORE M4. `ensure_shift_session` trigger called out by name; others enumerated in PLAN-0.
- **`profile.location_id` drop** — even though zero application reads, schema-axis must verify zero database-level references (views, triggers, RLS policies) before DROP.

## Next action

Mirrors scheduling STATE.md: plan-generator dispatched against scheduling sortie folder. Core-structure gets schema-deliverable callouts via PLAN-0 and PLAN-4. After M4 ships, domain-steward `post` mode refreshes core-structure DATA-MODEL.md to reflect dropped columns + new `shift_zone` table.

## References

- Primary STATE.md: `docs/domains/scheduling/STATE.md`
- ADR-0430: `docs/decisions/0430-core-structure-reform-shift-zone-m2m.md`
- Audit INDEX: `docs/audits/2026-05-27-core-structure-reform-index/INDEX.md`
- ADR-0392 (domain spine doctrine): `docs/decisions/0392-domain-steward-8-file-spine.md`
