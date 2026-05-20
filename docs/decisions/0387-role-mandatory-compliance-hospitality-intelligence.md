---
title: ADR-0387 — Role-Mandatory Compliance + Starter Routines into Hospitality Intelligence
status: accepted
updated: 2026-05-21
created: 2026-05-20
module: task-manager
tags: [adr, task-manager, hospitality-intelligence, i1, profession-training, role-compliance, readiness-gate]
---

# ADR-0387 — Role-Mandatory Compliance + Starter Routines into Hospitality Intelligence

> Renumbered from draft "ADR-0379" (id collided — `0379` is `swap-marketplace-convergence`; `0380–0386` also taken). Council-reviewed 2026-05-20 (REJECT-in-form → SPLIT). **Phase a (0387a) ACCEPTED + shipped** in `feat/daily-operation-task-i1-role-compliance-a` (merged campaign/daily-operation @ `0dd9528d6`). **Phase b (0387b) PROPOSED** — load-bearing, council-gated.

## Status
- **0387a (additive):** accepted, shipped 2026-05-21.
- **0387b (load-bearing):** proposed — requires its own council pass before build.

## Context

The Task Manager module's Setup/Authoring track had three verified gaps (GAPS G17–G25):

1. **Wizard picks procedure names only** → bare `procedure` rows. Industry routine templates (24 routines, 18 control_lists, 337 assignments in `supabase/templates/restaurant/*`) exist but run **only in the dev showcase seed**; live `finalize-workspace → bootstrap-cascade` never applies them.
2. **No role/position compliance scope.** `policy_scope` = `workspace|department|team|location` (no position/role); `assignment_source` has a dead `'position'`; `auto_assign_protocols_to_new_employee` has no position branch.
3. **Readiness has no per-role/mandatory gate.** `governance.check_readiness` blocks on ANY incomplete protocol; the C4 shift gate (`evaluateReadinessGate`, `shift-lifecycle/tools.ts:54`) is hardcoded, undifferentiated.

These are **Industry Intelligence (I1)** concerns — which protocols a role must complete is knowledge that belongs in the hospitality package, not hand-authored per workspace. `IndustryPackage` (`packages/types/src/industry.ts`) carried no role-capability/routine catalogue; the role-capability baseline was prose-only.

**Decisive council finding:** the spine already existed. `supabase/migrations/20260421100300_add_profession_system.sql:69–80` ships `profession`, `profession_industry` (NACE/I1 binding), and `profession_training(profession_id, protocol_id, is_required, weight, workspace_id)` — the exact role→mandatory-protocol map — as an **orphan** (zero non-generated consumers). The original draft (add `policy_scope='role'` + `protocol.is_mandatory`) would have built a parallel source of truth → cascade invariant #1 violation. **Revive the spine; do not duplicate it.** Agent Trust Gate failed all 3 original promises (empty-join trigger, inert authority row, uninstalled template RPC).

## Decision

### Phase 0387a — additive, ZERO behavior change (ACCEPTED, shipped)
- **A1** Revive `profession_training` as the canonical role→mandatory-protocol spine. Read-path indexes added (`(workspace_id, profession_id)`, `(profession_id, protocol_id)` — migration `20260621000100`).
- **A2** I1 carries the knowledge: `RoleCapabilityProfile` type + optional `IndustryPackage.roleCapabilityProfiles` (`packages/types/src/industry.ts`); `hospitalityPackage` populated (5 roles, 21/21 protocol slugs resolve to real protocol names). `defaultPackage`/`retail` omit (optional field). Authoring source = `08-role-capability-profiles/restaurant-role-capability-baseline.md` (upgraded prose → slug matrix). **Bootstrap-only — no `loadIndustryPackage` K1a runtime read** (loader is tariff-only; runtime read unneeded).
- **A2-seed** Best-effort, idempotent, workspace-scoped `fn_seed_profession_training` SECURITY DEFINER RPC (migration `20260621000200`) + `bootstrap-cascade` Step 11 `profession_seed` (hospitality-gated). Seeds `profession` rows always; `profession_training` mappings only for protocols that exist in the workspace (best-effort — `protocol.workspace_id` is NOT NULL, so mappings light up once governance protocols exist, i.e. 0387b or showcase seed).
- **A3** `governance.list_mandatory_protocols_for_role(role_slug)` read-only tool — resolves `profession.slug == role_slug` → `profession_training(is_required)` → `protocol`; unknown role → empty (not error); ctx-scoped (ADR-0151). 4 unit tests.
- **DROPPED from the original draft:** `policy_scope='role'` (category error — `profile.role` is permission tier, not capability) and `protocol.is_mandatory` (`DEFAULT false` silently un-gates existing workspaces; use `profession_training.is_required`).

**Join-key contract:** `profession.slug == roleCapabilityProfile.roleSlug` (seed ⇄ reader).

### Phase 0387b — load-bearing (PROPOSED, council-gated)
- **B1** Auto-assign trigger fires on **`AFTER INSERT ON profile_position`** (NOT `profile` — m2m empty at profile-insert), with explicit **ELSE** guard. Reads `profession_training` for the mandatory set.
- **B2** Install `supabase/templates/restaurant/governance.sql` as a **SECURITY DEFINER RPC** before any EF calls it (showcase file today, not an installed function). `governance_seed` calls the RPC (ADR-0240-clean), not inline SQL.
- **B3** **Rewire** `evaluateReadinessGate` to `callGateAction('governance.readiness_gate')` + respect level; redefine `ready = missing_mandatory === 0` (drop the `rows.length>0` zero-mandatory trap). THEN seed the authority row.
- **B4** Backfill `governance.readiness_gate` for **existing** workspaces (governance is in the never-seeded list → default-allow trap).
- **B5** C1/C4 split: `check_readiness` = belief; `gate_action` = permission. Leave `season.get_readiness` unchanged (separate % metric). Do NOT touch engine-dispatch `case "check_readiness"` (name collision, not a consumer).

### UI (when built) — MOCKUP-SOURCE HARD RULE
All task-manager UI (wizard routine-picker; S4 admin surface — Min dag, Task-drawer, Bibliotek, Maler, manual-builder, quizmaster) is **ported from `docs/modules/task-manager/taskmanager-handoff/`** — components, tokens, interaction logic. **Do NOT redesign.** Routine-picker pattern: structured 2-row ghost card; mandatory-locked = 3-layer non-color (Lock icon + "Obligatorisk" word + `bg-muted` surface); mandatory cards NOT buttons (WCAG 2.1.1); `aria-pressed` + `focus-visible` ring; new tokens as aliases (no OKLCH literals).

## Consequences

**Positive:** role-mandatory compliance becomes industry-driven, not hand-authored; the spine is no longer orphaned; 0387a ships with zero behavior change (additive); compliance becomes a by-product of competence (the moat).

**Costs / risks:**
- 0387b's `profile_position`-INSERT trigger fires on the live hire path (the v2 migration name signals prior regression) → golden-case both directions + existing-scope regression guard.
- 0387b readiness-gate rewrite can block scheduling if mandatory-set is mis-seeded → ship the authority row at `suggest` first; rewire is required (seeding alone is inert).
- `profession_training` seed is best-effort: inert on bare workspaces until governance protocols exist. By design; `profession` rows + reader + spine are in place regardless.
- I1 `roleCapabilityProfiles` is duplicated (inlined) in the Deno EF (`bootstrap-cascade`) — Deno can't import `@smartout/ai` (ADR-0084). Sync-obligation comment added; consider a drift-guard test.

## Alternatives considered
1. Per-workspace manual authoring (status quo) — rejected: defeats I1.
2. New parallel map via `policy_scope='role'` + `protocol.is_mandatory` (original draft) — rejected: duplicates the existing `profession_training` spine.
3. Position-scope via `team` — rejected: conflates org structure with capability.

## References
- Module: `docs/modules/task-manager/` (MODULE, DATA-MODEL, GAPS-AND-DEBT, BLUEPRINT Track S, BUILD-PLAN).
- Council: `docs/council/COUNCIL-LOG.md` 2026-05-20 entry (5/5 reviewers, REJECT→SPLIT, chair self-reversal).
- Shipped (0387a): merge `87101185d` on `campaign/daily-operation`; migrations `20260621000100`, `20260621000200`; `packages/types/src/industry.ts`, `packages/ai/src/industry/packages/hospitality.ts`, `packages/ai/src/capabilities/governance/{tools,index}.ts`, `supabase/functions/bootstrap-cascade/index.ts`. Journeys: `JOURNEY-task-i1-role-compliance-a-{admin-bootstrap-seeds-role-protocols,botsson-answers-role-requirements}.md` (verified). Handoff: `docs/HANDOFF-task-i1-role-compliance-a.md`.
- Spine: `supabase/migrations/20260421100300_add_profession_system.sql:69–80`. `profile_position` join.
- Learnings: schema-orphan-rebuild; authority-seed-inert (sibling L-0083).
