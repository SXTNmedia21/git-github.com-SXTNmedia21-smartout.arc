---
title: "Sortie Spec — ADR-0387b: Role-Mandatory Compliance Gating (trigger + governance RPC + readiness gate)"
status: draft
created: 2026-05-21
updated: 2026-05-21
module: task-manager
tags: [spec, sortie, task-manager, hospitality-intelligence, adr-0387b, load-bearing, council-gated, readiness-gate, auto-assign-trigger]
---

# Sortie Spec — ADR-0387b: Role-Mandatory Compliance Gating

> **Load-bearing. Council-gated.** This is the second half of [ADR-0387](../../decisions/0387-role-mandatory-compliance-hospitality-intelligence.md). 0387a (additive spine + I1 profiles + reader) shipped @ `campaign/daily-operation 0dd9528d6`. 0387b makes role-mandatory compliance **actually gate** — it touches the live hire path and the shift-publish gate, so it must NOT dispatch before a dedicated council pass approves B0 + B3.

## Goal

Turn the dormant `profession_training` spine (0387a) into enforced compliance:
1. Hiring someone into a position **auto-assigns** that position's mandatory protocols.
2. Governance protocols **exist on real workspaces** (so the spine actually populates).
3. The shift-publish/approve gate blocks (configurably) when an employee's **mandatory** protocols for their role are incomplete — governed by C4, not hardcoded.

## Success criteria (falsifiable)
- Inserting a `profile_position` (profile↔position) auto-creates `protocol_assignment` rows for that position's mandatory protocols (`assigned_via='position'`); a different position gets a different set; existing workspace/dept/team/location auto-assign unchanged.
- Finalizing a fresh hospitality workspace seeds governance protocols → 0387a's `fn_seed_profession_training` now populates `profession_training` mappings (not just empty `profession` rows).
- A Bartender with incomplete **mandatory** protocols is flagged/blocked at shift publish per the `governance.readiness_gate` authority level; a Bartender missing only **non-mandatory** protocols is NOT blocked; a zero-mandatory role is `ready`.
- `season.get_readiness` (% metric) and engine-dispatch `case "check_readiness"` are **unchanged**.
- `pnpm turbo typecheck` green; golden-case + regression tests pass.

## Pre-conditions (before /start-feature)
1. **0387a merged to development** (currently only on campaign/daily-operation). 0387b builds on the shipped spine + I1 profiles + reader.
2. **Council pass** on this spec — mandatory. Load-bearing triggers (B0/B1) + gate rewire (B3). Council must resolve the Open Design Questions below before build.
3. Supabase Local running; `pnpm --filter @smartout/ai build` (dist).
4. Reserve ADR/learning numbers vs all branches at closure.

---

## Open design questions (COUNCIL MUST RESOLVE before build)

### Q1 — position → profession link (the load-bearing gap)
0387a seeded `profession` (slug=roleSlug) + `profession_training` (profession→protocol). But the auto-assign trigger fires on `profile_position` (profile→**position**). There is **no `position → profession` link in the DB** — that mapping lives only in I1 `roleCapabilityProfiles.positionSlugs[]` (code). The trigger cannot resolve `position → profession → profession_training` without it.

**Options:**
- **(a) `profession_position` junction** (recommended): seed `(profession_id, position_id, workspace_id)` at bootstrap from `roleCapabilityProfiles.positionSlugs`. Trigger joins `profile_position → profession_position → profession_training`. Clean, explicit, RLS-scopable.
- (b) `profile_position.profession_id` denorm column — fragile, position can map to one profession only.
- (c) name-match position.name ↔ profession at trigger time — brittle (string match in hot path).

→ Recommend (a). This becomes **B0** (prerequisite). Adds a small junction + extends 0387a's seed RPC.

### Q2 — gate level: hard-block vs warn+override?
`governance.readiness_gate` ships at `suggest` (non-blocking, emit-only) FIRST. Does V1 ever hard-block (`enforce`), or always `suggest` until a workspace opts in? **Council decides default.** Recommend `suggest` default; `enforce` opt-in per workspace.

### Q3 — does `check_readiness` change in place or get a sibling?
`evaluateReadinessGate` + other callers depend on `check_readiness` "all protocols" semantics. Mandatory-only is a behavior change for them. **Option:** add `check_mandatory_readiness` (new) + leave `check_readiness` as-is; `evaluateReadinessGate` switches to the new one. Avoids silently changing every `check_readiness` consumer. Recommend new sibling tool.

---

## Phases (dependency-ordered)

```
B0 position→profession junction + seed extension
  └─▶ B1 auto-assign trigger (profile_position INSERT)
B2 governance.sql → installed RPC + governance_seed step   (independent of B0/B1; enables real protocols)
  └─▶ (B0/B1 only meaningful once B2 makes protocols exist)
B3 readiness mandatory-aware + gate rewire ──▶ B4 authority seed + backfill ──▶ B5 C1/C4 doc split
```

### B0 — position → profession link (prereq) · db · COUNCIL-WATCHED
- New `profession_position(profession_id, position_id, workspace_id, created_at)` junction (UNIQUE `(position_id, workspace_id)` — a position maps to one profession; PK composite). RLS workspace-scoped + platform NULL.
- Extend `fn_seed_profession_training` (0387a) — or a sibling RPC — to also seed `profession_position` from `roleCapabilityProfiles.positionSlugs` (resolve position by name within workspace; best-effort skip on no-match).
- **Acceptance:** seeding a hospitality workspace creates `profession_position` rows mapping each position (Bartender, Kokk, …) to its profession; idempotent.

### B1 — auto-assign mandatory protocols on hire · db · COUNCIL-WATCHED
- New trigger `auto_assign_mandatory_on_position` **`AFTER INSERT ON profile_position`** (NOT `profile` — m2m empty at profile-insert). Resolves `NEW.position_id → profession_position → profession → profession_training (is_required=true)`, inserts `protocol_assignment(profile_id, protocol_id, workspace_id, status='not_started', assigned_via='position', assigned_ref_id=position_id)` ON CONFLICT DO NOTHING.
- Explicit **ELSE / no-match → no-op** (closes the silent-NULL-drop class the original `auto_assign_protocols_to_new_employee` had).
- Coexists with the existing `profile`-INSERT trigger (workspace/dept/team/location scopes) — must NOT double-assign (unique constraint on `protocol_assignment` dedups).
- **Golden case (both directions + regression):**
  - INSERT profile_position(Bartender) → `protocol_assignment` rows for bartender-mandatory protocols, `assigned_via='position'`.
  - INSERT profile_position(Kokk) → kokk set, NOT bartender set.
  - Existing hire flow (profile INSERT with workspace/dept/team/location policies) → unchanged, no regression.
  - Position with no profession mapping → no-op, no error.

### B2 — install governance template as RPC + bootstrap governance_seed · db + edge-fn · COUNCIL-WATCHED
- Promote `supabase/templates/restaurant/governance.sql` (+ deps: `mattilsynet.sql`, `alcohol-labor.sql` as needed) from dev-seed-only files into **committed migrations defining SECURITY DEFINER functions** (`template_restaurant_governance(workspace_id)` etc.) so they exist in every DB.
- New `bootstrap-cascade` Step (after Step 11 `profession_seed`) `governance_seed`: when hospitality-gated, call the RPC (idempotent via `workspace_bootstrap_run`). ADR-0240-clean: call the RPC, NOT inline SQL.
- Order: governance_seed must run BEFORE `profession_seed` populates mappings (protocols must exist first) — re-sequence or make profession_seed re-runnable after governance_seed.
- **Acceptance:** finalize fresh hospitality workspace → governance `protocol` rows exist → `profession_training` + `profession_position` populate → hiring a Bartender auto-assigns (B1 chain end-to-end). Idempotent.

### B3 — readiness mandatory-aware + gate rewire · capability · COUNCIL-WATCHED
- New `governance.check_mandatory_readiness(profile_id?)` tool (per Q3): readiness over the profile's **mandatory** protocols (resolve via `profile_position → profession_position → profession_training(is_required)` ∩ `protocol_assignment`). `ready = missing_mandatory === 0` (NO `rows.length>0` trap — zero-mandatory role = ready).
- **Rewire** `evaluateReadinessGate` (`packages/ai/src/capabilities/shift-lifecycle/tools.ts:54`): call `check_mandatory_readiness`, then `callGateAction({capability:'governance.readiness_gate', ...})`; honor level — `suggest`→emit+allow, `confirm/enforce`→block. Currently it hard-blocks with no gate_action call; this is a rewrite, not a tweak.
- Leave `season.get_readiness` (`packages/ai/src/tools/season/get-readiness.ts`) UNCHANGED. Do NOT touch engine-dispatch `case "check_readiness"` (name collision, not a consumer).
- **Acceptance:** mandatory-incomplete bartender blocked at `enforce`, allowed+emit at `suggest`; non-mandatory gaps never block; zero-mandatory role ready. Existing `check_readiness` consumers unaffected.

### B4 — authority seed + backfill · db · COUNCIL-WATCHED
- Add `governance.readiness_gate` to the bootstrap authority seed (new workspaces) at level `suggest`.
- **Backfill migration:** seed `governance.readiness_gate` (`suggest`) for ALL existing workspaces — `governance` is in the never-seeded list (`20260518000000`); without backfill the gate hits default-allow (inert) on existing workspaces.
- **Acceptance:** every workspace (new + existing) has a `governance.readiness_gate` row; gate is honored, not default-allow.

### B5 — C1/C4 split documentation · docs
- Document in ADR-0387 (flip 0387b → accepted at close) + module: `check_*_readiness` = C1 belief; `gate_action` = C4 permission. "Confident ≠ Authorized."

---

## Guardrails
- Migrations: B0 junction + B1 trigger + B2 RPC functions + B4 seed — separate migrations, timestamps strictly > all-branch max at build time (L-0042).
- No `op run` on gen-types (corrupts). Local-only `npx supabase gen types`.
- Trigger work is hot-path — golden + regression mandatory before merge.
- Telemetry: trigger-driven `protocol_assignment` writes can't `emit()` from plpgsql — route via `activity_trail` direct or a follow-up event (L:telemetry-without-emit). Register any new event in registry (ADR-0377).
- Gate rewire: ship authority at `suggest` first (reversible); never hard-block by default without Q2 council decision.

## Out of scope (→ separate sortie: "task-i1-starter-routines" / 0387c)
- `StarterRoutineCatalogue` type + `IndustryPackage.starterRoutines` (0387a shipped only `roleCapabilityProfiles`).
- Wizard "pick starter routines" step (RP6) — port from `taskmanager-handoff/`, mandatory-locked ghost-card.
- These need B2 (governance protocols installed) as a foundation, so they follow 0387b.

## Council escalation points
- Q1 (position→profession link) — schema decision, blocks B0/B1.
- Q2 (gate default level) — product/safety decision, blocks B3/B4.
- Q3 (check_readiness in-place vs sibling) — consumer-blast-radius, blocks B3.
- B1 trigger semantics — regression class (live hire path).
- B3 gate rewire — can block scheduling.

## Suggested journeys (declare at /start-feature)
1. `hire-into-position-auto-assigns-mandatory` — admin adds a position to an employee → mandatory protocols auto-assigned.
2. `unready-employee-blocked-at-shift-publish` — manager publishes a shift for an employee missing mandatory protocols → gate fires per authority level.
3. `bootstrap-seeds-governance-and-spine` — finalize hospitality workspace → governance protocols + profession_training + profession_position all populate.
