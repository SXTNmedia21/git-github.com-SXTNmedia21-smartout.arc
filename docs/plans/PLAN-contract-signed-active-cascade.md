---
title: "Plan — contract-signed-active-cascade"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: cascade
tags: [plan, cascade, D2, engine-process, activation, contract]
---

# Plan — contract-signed-active-cascade

> Branch: `feat/contract-signed-active-cascade` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-7` | Base: `development` | Module: cascade

## Goal

Close the cascade tail surfaced by dual-perspective verification of WH-01: when `contract.signed` fires, automatically flip the employee's `profile.status` trainee→active. Today this is **comment-only** in `docuseal/route.ts:317`; the actual flip is unbuilt (only the manual admin path `people-actions.ts:673` exists).

## Locked decisions (Pontus, 2026-05-20)

1. **Signature = authorization (NO C4 gate).** Both parties legally signed → system flips status directly. The contract IS the C4 authorization. Audit-logged via `engine_state_step` + `profile.activated` telemetry. NOT routed through `change_proposal`.
2. **Scope = core cascade tail only:** the flip + `profile.activated` telemetry + idempotency guards. Notification + employee-facing UI (web/mobile) = follow-up sub-sortie, OUT OF SCOPE here.

## Architecture (cascade skill: D2 lifecycle, distinct from C3 integration_sync)

Profile activation is **D2 resource lifecycle**, NOT C3 adapter sync. Do NOT bolt onto `integration_sync` (skill trap: never mix dimension concerns). Create a dedicated `engine_process`.

### The wiring problem (must solve)

`contract.signed` engine_event carries `entity_type=employment_contract`, `entity_id=contract_id` (per WH-01 `docuseal/route.ts` payload). But `update_entity` handler (`engine-dispatch/index.ts:840-886`) updates `WHERE pkColumn = state.entity_id`. To flip the PROFILE, the engine_state for the activation process must target `entity_type=profile`, `entity_id=<employee profile_id>`.

`employment_contract.profile_id` = the employee (direct column, verified). The docuseal route already updates `employment_contract` via `.eq("signing_contract_id", contract.contract_id)` — so `profile_id` is resolvable there.

**Resolution strategy (implementer picks, document choice):**
- **Option A (preferred):** docuseal route resolves `employee profile_id` from `employment_contract` and emits a SECOND engine_event `profile.activation_requested` (or sets the activation event entity to profile). The `employee_activation` engine_trigger keys on that event with entity=profile.
- **Option B:** `employee_activation` process step 1 = a resolution step that reads contract→profile, writes profile_id into engine_state context/entity, then step 2 = `update_entity`. More engine plumbing.

Inspect how `engine_trigger` → `engine_state` sets entity (read engine-dispatch trigger-creation path) before committing. Prefer A if the event can carry the profile entity cleanly.

## Tasks

- [ ] **T1 — Resolve profile binding.** Read engine_trigger→engine_state entity-creation in `engine-dispatch/index.ts`. Decide Option A vs B. Document in HANDOFF.
- [ ] **T2 — Migration: `engine_process` `employee_activation`** seeded with one `update_entity` step: `entity=profile`, `set={status:"active", is_active:true}`. Step `condition` must guard idempotency (only flip when current `status='trainee'`; never touch inactive/offboarding). Timestamp per L-0042 (check tip + deps first).
- [ ] **T3 — Migration: `engine_trigger`** maps the activation event → `employee_activation` process (INSERT WHERE NOT EXISTS, same idempotent pattern as `20260520120100`).
- [ ] **T4 — Migration: `engine_authority_config`** seed `capability='employee_activation'` AUTO-ALLOW (signature=authorization, decision 1). Without this, `update_entity` GATED_MUTATION_TYPES (index.ts:692-703) calls `gate_action` with capability=process_id → default-deny blocks the flip. MUST seed allow row.
- [ ] **T5 — Telemetry: register `profile.activated`** in `packages/telemetry/src/registry.ts` (sibling to existing `profile deactivated`/`profile reactivated` at lines 568/576) + EVENT_ROUTING (posthog + logger + activity_trail).
- [ ] **T6 — Emit `profile.activated`** when the flip succeeds. The `update_entity` handler does NOT emit domain events today. Add a targeted emit in the activation path (handler branch keyed on entity=profile + process=employee_activation, OR a `send_notification`-style follow step). Honor ADR-0134 (workspace_id + actor_id non-empty; actor = system per ADR-0281 platform-actor pattern).
- [ ] **T7 — Idempotency proof.** DocuSeal retry fires contract.signed twice. Verify the `condition` guard (T2) makes the second run a no-op (already active → skip). No double-emit of profile.activated.
- [ ] **T8 — Typecheck + local test** per affected package.
- [ ] **T9 — Journey + HANDOFF.** Update `docs/journeys/drafts/contract-signed-to-active-cascade.idea.md` status; write JOURNEY-contract-signed-active-cascade.md (closure gate) + HANDOFF.

## Out of scope (follow-up sub-sortie)

- Notification to employee on activation (`packages/notifications` — zero hits today)
- Employee-facing "you're now active/Ready" UI (web my-cv/my-schedule + mobile home)
- Readiness score coupling (activation = employment status, NOT competence; protocols-complete is a separate axis per cascade skill)

## Acceptance criteria

- [ ] `pnpm turbo typecheck` 0 errors on affected packages
- [ ] Migration applies clean on `supabase db reset` (timestamp ordering L-0042)
- [ ] `employee_activation` process flips a trainee profile → active on contract.signed
- [ ] Already-active / inactive / offboarding profiles untouched (idempotency + status guard)
- [ ] `profile.activated` registered + emitted with non-empty workspace_id + actor_id
- [ ] NO `change_proposal` created (signature=authorization, not C4-gated)
- [ ] Decision log: ADR if the auto-activation governance model is novel (signature-as-C4-authorization may warrant an ADR — implementer judges)

## References

- WH-01 producer: `apps/web/src/app/api/webhooks/docuseal/route.ts` (engine_event contract.signed)
- engine consumer: `supabase/functions/engine-dispatch/index.ts` (update_entity:840, GATED_MUTATION_TYPES:692, gate_action:726)
- manual path (mirror logic): `apps/web/src/app/dashboard/people/_actions/people-actions.ts:673` (reactivateProfile)
- existing trigger seed pattern: `supabase/migrations/20260520120100_engine_trigger_contract_events.sql`
- contract engine processes: `supabase/migrations/20260501110000_seed_contract_engine_processes.sql`
- telemetry siblings: `packages/telemetry/src/registry.ts:568,576` (ProfileDeactivated/Reactivated)
- cascade skill: D2 lifecycle, trainee mode, "Confident != Authorized"
- ADRs: 0099 (unified authority gate), 0134 (telemetry IDs), 0151 (workspace_id), 0186 (engine event flow), 0281 (platform-actor)
- gap matrix: this session's dual-perspective verification
