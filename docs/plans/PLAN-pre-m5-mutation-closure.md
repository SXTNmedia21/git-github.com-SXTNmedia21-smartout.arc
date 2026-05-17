---
title: "Plan — pre-m5-mutation-closure"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [plan, ui-shell, mutation-closure, gate-action, council-verified, campaign-ui-shell, M5-prereq]
---

# Plan — pre-m5-mutation-closure

> Branch: `feat/ui-shell-pre-m5-mutation-closure` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-17

## Goal

Close 3 ADR-0099 / ADR-0114 / ADR-0204 violations on HMS + policies surface before M5 polish sorties can ship. Convert 2 direct-browser-write hooks to Server Actions w/ `gate_action`; add `gate_action()` RPC to `createPolicy`; seed `policy.create_manual` capability; register unregistered `"policy created"` telemetry event.

## Council Decision (2026-05-17 — verdict ref: COUNCIL-LOG.md row "M5 HMS cluster scoping")

**Verdict:** APPROVE WITH CHANGES — Option C+ (4-sortie sequence). This is **Sortie 1 of 4, BLOCKER for Sortie 2-4**. Chair Self-Reversal Phase 3 Option B → Phase 5 Option C+ via L-0147 protocol (9th codified precedent). Three code-tracers (Supervisor + Agent-Coord + Harness) brought file:line evidence reversing Phase 3 verdict.

## Scope

**In scope:**
- Convert `apps/web/src/app/dashboard/hms/_hooks/use-update-deviation.ts:26-67` to delegate to Server Action (verify `apps/web/src/app/dashboard/_actions/update-deviation-action.ts` exists per Agent-Coord trace; if missing, CREATE it with `gate_action` + `gatedMutation` wrapper)
- Convert `apps/web/src/app/dashboard/hms/_hooks/use-complete-task.ts:25-33` to delegate to Server Action (verify or create `complete-task-action.ts`)
- Add `gate_action()` RPC call to `apps/web/src/app/dashboard/policies/_actions/policy-actions.ts:createPolicy` (currently role-string check only at line 77)
- Seed `policy.create_manual` capability in `engine_authority_config` via new migration
- Register `"policy created"` event in `packages/telemetry/src/registry.ts` (currently emitted at policy-actions.ts:111 but unregistered)

**Out of scope:**
- L-0258 collision fix (Sortie 2 ships ADR-0348 detector + dedupe; renumbered from 0347 → 0348 in Sortie 1 G4 to resolve collision with schedule-density-persistence ADR-0347)
- HMS surface polish (Sortie 3+4)
- New capabilities for hms/policies/handbook/deviations (separate ADR'd sortie if needed; L-0287 flag)
- BotssonProvider lift (ADR-0238) — separate ongoing work, foreign WIP stashed
- Mobile equivalents (ADR-0133 — HMS is D3/C4 author/compose, web-only)

## Council Conditions (6 — MANDATORY)

1. **All 3 mutations close in one PR.** No partial closure.
2. **Server-resolved IDs only (ADR-0151).** `workspace_id` + `actor_id` come from server context (`resolveCurrentProfile()`), NOT request body.
3. **Awaited `emit()` server-side.** Fire-and-forget `void emit()` is forbidden; must `await emit()` and surface failures.
4. **`gate_action()` RPC mandatory.** Role-string check is insufficient (ADR-0099). Every mutation calls `gate_action(capability, action, actor_id, workspace_id, ...)`.
5. **Capability seed migration MUST land in same PR.** `policy.create_manual` row in `engine_authority_config` (min_role=admin, level=confirm or suggest, depending on default).
6. **Telemetry registry entry for `"policy created"`.** Add entry to `packages/telemetry/src/registry.ts` per registry pattern (interface + SmartoutEvent union + EVENT_ROUTING + EntityType if new entity).

## Tasks

- [ ] **T1** — Recon: read `update-deviation-action.ts` (does it exist? if yes, what's its shape?); read `complete-task-action.ts` (same); read `policy-actions.ts:createPolicy` body
- [ ] **T2** — Recon: read `packages/telemetry/src/registry.ts` to identify EventCategory + EntityType for `"policy created"` (likely `"policy"` category, `"policy"` entity)
- [ ] **T3** — Recon: read existing capability seed migration pattern (look at recent `capability=*` seeds for shape — `policies/_actions/policy-actions.ts` writes to which capability?)
- [ ] **T4** — Convert `use-update-deviation.ts` to delegate (create/reuse Server Action; hook becomes thin TanStack mutation wrapper)
- [ ] **T5** — Convert `use-complete-task.ts` to delegate (same pattern)
- [ ] **T6** — Add `gate_action()` call to `policy-actions.ts:createPolicy` BEFORE the admin client write
- [ ] **T7** — Add capability seed migration: `policy.create_manual` row in `engine_authority_config`
- [ ] **T8** — Register `"policy created"` in `packages/telemetry/src/registry.ts` (interface + SmartoutEvent union both sites + EVENT_ROUTING + EntityType)
- [ ] **T9** — Verify all 3 mutations: typecheck + grep `void emit` in changed files (should be 0) + grep `supabase.from("deviation").update` in `_hooks/` (should be 0 outside Server Actions)
- [ ] **T10** — G4 supervisor code-reviewer pass (per-mutation table: gate_action / gatedMutation / emit / workspace_id source / Verdict)
- [ ] **T11** — HANDOFF + close-feature

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] `grep -nE 'supabase\.from\("(deviation|session_task)"\)\.(update|insert|delete)' apps/web/src/app/dashboard/hms/_hooks/` → 0 hits
- [ ] `grep -nE 'void emit\(' apps/web/src/app/dashboard/hms/_hooks/ apps/web/src/app/dashboard/policies/` → 0 hits in changed files
- [ ] `grep 'gate_action' apps/web/src/app/dashboard/policies/_actions/policy-actions.ts` → ≥1 hit (in `createPolicy` body)
- [ ] New capability seed migration applied locally (`supabase db reset` works)
- [ ] `"policy created"` registered in `packages/telemetry/src/registry.ts` (grep returns ≥1 hit)
- [ ] Primary journey verified (feature: pre-m5-mutation-closure)
- [ ] HANDOFF written
- [ ] G4 APPROVE

## Risks

- **Server Action target missing:** If `update-deviation-action.ts` or `complete-task-action.ts` doesn't exist, builder must CREATE them with full `gate_action` + `gatedMutation` + server-emit pattern. This expands scope from ~30-min refactor to ~2hr builder work. Acceptable. Escalate to council ONLY if shape conflicts with existing Server Action conventions.
- **Capability seed timestamp collision (L-0042):** New migration timestamp must be greater than HEAD max migration timestamp on `development`. Verify with `ls supabase/migrations/ | tail -3` before creating migration.
- **Telemetry registry shape drift:** Adding `"policy created"` requires updating BOTH the `SmartoutEvent` union sites + `EVENT_ROUTING` + possibly `EntityType` union. Past sorties hit this 3× (contracts/cost/billing). Builder self-recovers via fresh typecheck.
- **Capability default level ambiguity:** `policy.create_manual` — is it `autonomous`, `suggest`, or `confirm`? Builder should default to `confirm` + `min_role=admin` (safest); HANDOFF documents the choice.
- **Stop-hook SIGTERM noise (L-2026-05-04):** Concurrent typecheck during builder work cascade-fails Stop-hook. Agent's own tsc is truth. Ignore SIGTERM noise; verify with fresh pnpm typecheck after builder reports done.

## Next

Single sonnet build agent dispatched with 6 council conditions. Solo + sequential. After T11 close-feature, dispatch Sortie 2 (hms-collision-fix).
