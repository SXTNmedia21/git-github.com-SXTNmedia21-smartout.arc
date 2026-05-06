---
title: PLAN — Audit Sortie 3, Telemetry Coverage Sweep
status: in_progress
created: 2026-05-06
updated: 2026-05-06
module: telemetry
tags: [audit, telemetry, adr-0004, sortie]
sortie: feat/audit-sortie-3-telemetry-sweep
worktree: ~/dev/smartout.ai-wt-8
audit-source: docs/audits/2026-05-06-adr-contract-validation/00-SYNTHESIS.md
---

# Plan: Audit Sortie 3 — Telemetry Coverage Sweep

## Context

Audit synthesis Top-10 #7+#8 — capability tools and tables shipped post-baseline without registry events. ADR-0004 mandates every mutation emits to four destinations (PostHog + Logger + activity_trail + engine_event). Three known gaps:

1. `outreach` capability authority seed shipped (migration `20260525110000`) without registry events for `send_sms` / `call_employee` mutations. Will be dark on launch.
2. `engine_world` table shipped (migration `20260525000000`) without registry events for observation/status writes. Plus missing from `database.types.ts`.
3. `sendEmployeeContract` (`packages/ai/src/capabilities/contract/tools.ts:331-406`) zero `emit()` in success branch — persists from baseline B4.
4. `gatedMutation()` SS-5 path emits no `gate_evaluated` event — registered nowhere.

## Scope

| # | Surface | Severity | Type |
|---|---|---|---|
| F1 | `packages/telemetry/src/registry.ts` — register `outreach.sms_sent` + `outreach.call_initiated` | HIGH | Registry add |
| F2 | `packages/telemetry/src/registry.ts` — register `engine_world.observation_written` + `engine_world.status_changed` | HIGH | Registry add |
| F3 | `packages/telemetry/src/registry.ts` — register `gate_evaluated` event for gatedMutation | MEDIUM | Registry add |
| F4 | `packages/ai/src/capabilities/contract/tools.ts` — add `emit()` in `sendEmployeeContract` success branch | HIGH | Code add |
| F5 | `packages/supabase/src/database.types.ts` — regenerate to include `engine_world` table types | HIGH | Type regen |

## Out of scope

- Mobile telemetry remediation (Sortie 4 — 6 caller-supplied-ID hooks + chat_message direct insert)
- Workspace_id derivation sweep across stage-engine + capability tools (audit Top-10 #7 second clause; needs ADR + plan)
- ADR-0204 SS-5 transactional gap (separate sortie — `shift-lifecycle/gate.ts:93` sentinel)

## Order

1. **F1, F2, F3** — registry edits in `packages/telemetry/src/registry.ts`. Independent. One commit per logical group.
2. **F4** — `sendEmployeeContract` emit. Independent.
3. **F5** — regenerate database.types.ts (`pnpm db:gen-types` or canonical command). Last because depends on Supabase Local up + migration applied.

## Acceptance criteria

- F1+F2+F3: 5 new events appear in `packages/telemetry/src/registry.ts` with correct routing destinations (PostHog + Logger + activity_trail + engine_event for mutations). Names follow `<namespace> <verb>` convention.
- F4: `sendEmployeeContract` success branch contains `emit({ event: "contract sent", ... })` with `workspace_id`, `actor_id`, `entity_id` from server-derived context (ADR-0151 + L-0177).
- F5: `engine_world` table type appears in `database.types.ts`. Stop hook typecheck passes.

## Dependencies / risk

- F5 requires Supabase Local running + the engine_world migration applied. If migration not applied, types regen produces empty types for that table.
- F4 requires reading `createEmployeeContract` (already emits per audit slice 06 closure) — copy pattern for consistency.
- Registry conventions per `packages/telemetry/src/registry.ts` header — follow exactly. Event names use space-separator (`"outreach sms_sent"`); engine-event.ts translates to dot notation.

## Steps

### F1 — Outreach events
Read `supabase/migrations/20260525110000_outreach_capability_authority_seed.sql` for capability surface. Read `packages/telemetry/src/registry.ts` for convention. Add:
- `outreach sms_sent` — PostHog + Logger + activity_trail + engine_event
- `outreach call_initiated` — same

### F2 — engine_world events
Read `supabase/migrations/20260525000000` for table shape. Add:
- `engine_world observation_written`
- `engine_world status_changed`

### F3 — gate_evaluated event
Audit slice 07: gatedMutation SS-5 path emits `gate_evaluated` but no registry entry. Add. Routing: PostHog + Logger + activity_trail (gate evaluation is auditable; engine_event optional).

### F4 — sendEmployeeContract emit
Read `packages/ai/src/capabilities/contract/tools.ts:331-406`. Find success branch. Look at neighboring `createEmployeeContract` for emit pattern. Add `emit({ event: "contract sent", workspace_id, actor_id, entity_id, ... })`.

### F5 — Regenerate database.types.ts
Verify Supabase Local running (`supabase status` or check 127.0.0.1:54321). Run `pnpm db:gen-types`. Verify `engine_world` appears. Commit.

## Closure deliverables

- [x] Plan written
- [x] Journey doc
- [ ] All 5 fixes shipped
- [ ] Typecheck passes
- [ ] HANDOFF written
- [ ] `close-feature.sh 8` run by Pontus

## Estimated wall time

~1-2 days. F1-F4 mechanical adds. F5 may need Supabase Local debug if migration not applied.
