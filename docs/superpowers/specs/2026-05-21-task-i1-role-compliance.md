---
title: "Task Manager — Role-Mandatory Compliance + Starter Routines into Hospitality Intelligence"
status: in_progress
created: 2026-05-21
updated: 2026-05-21
module: task-manager
tags: [spec, task-manager, hospitality-intelligence, i1, role-compliance, adr-0387]
---

# Task Manager — Role-Mandatory Compliance + Starter Routines into Hospitality Intelligence

> Thin spec pointer. The authoritative design lives in the task-manager module folder. This sortie builds **ADR-0387a** (the additive, zero-behavior-change half) only.

## Authoritative sources
- **ADR:** [docs/modules/task-manager/ADR-DRAFT-0387-role-mandatory-compliance-i1.md](../../modules/task-manager/ADR-DRAFT-0387-role-mandatory-compliance-i1.md) — see §Council Outcome (revised decision set; 0387a vs 0387b).
- **Build plan:** [docs/modules/task-manager/BUILD-PLAN-i1-role-compliance.md](../../modules/task-manager/BUILD-PLAN-i1-role-compliance.md) — see §Council-revised phasing (RA1–RA3 for this sortie).
- **Module:** [docs/modules/task-manager/](../../modules/task-manager/) (MODULE, DATA-MODEL, GAPS, ARCHITECTURE).

## Scope of THIS sortie — ADR-0387a (additive, zero behavior change)
- **RA1** Revive `profession_training` (`profession_id, protocol_id, is_required, weight, workspace_id`) as the canonical role→mandatory-protocol spine (orphan today — `20260421100300:69-80`). No parallel map.
- **RA2** I1 (`hospitalityPackage`) seeds `profession` + `profession_training` at bootstrap; upgrade `08-role-capability-profiles/restaurant-role-capability-baseline.md` to a slug matrix (authoring source). Bootstrap-only — no `loadIndustryPackage` K1a runtime read.
- **RA3** Add governance read tool `list_mandatory_protocols_for_role(roleSlug)` — the runtime reader so I1 data is not phantom knowledge.

## Explicitly OUT of scope (→ ADR-0387b, separate sortie, council-gated)
- `policy_scope` enum change (DROPPED — use `profession_training.is_required`).
- `protocol.is_mandatory` (DROPPED).
- `profile_position`-INSERT auto-assign trigger.
- Install `governance.sql` as RPC + `governance_seed` bootstrap step.
- Rewire `evaluateReadinessGate` to `gate_action` + authority backfill.

## Guardrails (council conditions)
- Zero behavior change: do NOT touch `evaluateReadinessGate`, `check_readiness` semantics, `season.get_readiness`, or the live auto-assign trigger in this sortie.
- Reviver only: revive the orphan spine; do not duplicate it with new tables/enums.
- Mockup-source hard rule applies to any UI (none expected in 0387a).
