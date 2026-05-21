---
title: "Audit Slice 02 — Stage Engine + BFF"
status: complete
created: 2026-05-20
updated: 2026-05-20
slice: 02
run_id: 2026-05-20-adr-contract-validation-02
adrs: [0042, 0049, 0186, 0246, 0247, 0248, 0255, 0261]
anchor: docs/architecture/BOTSSON-SYSTEM-MAP.md
baseline: docs/audits/2026-05-20-adr-contract-validation/00-SYNTHESIS.md
tags: [audit, stage-engine, bff, telemetry, emit-producer, workspace-id]
---

# Audit Slice 02 — Stage Engine + BFF

## Summary (top 5)

1. **SE-01 STATUS CHANGED — ADR-0248 Amendment closes HIGH as INTENTIONAL.** The Amendment (2026-05-20) explicitly names `mission-pool-slot.ts` as a second permitted producer for `journey.*` events. The file header references the amendment, workspace_id is row-derived (`stateRow.workspace_id`), and `actor_id` uses `SYSTEM_ACTOR_ID` constant. All five amendment constraints are satisfied. Baseline HIGH downgraded to INFO.

2. **SE-02 MEDIUM — `dispatch.ts` emits no telemetry on Sixten mission success/failure** at the `/agent/dispatch` HTTP endpoint. The mission-pool-slot worker correctly emits on pg-notify-triggered runs; the HTTP dispatch route (`services/stage-engine/src/routes/agent/dispatch.ts`) performs the same Sixten subprocess invocation but has zero `emit()` calls (264 lines, 0 emit hits). ADR-0255 Phase 0 does not mandate telemetry from this path, but ADR-0248 Amendment constraint 1 states the worker must own execution context — the HTTP route does own it. Gap is undocumented.

3. **SE-03 MEDIUM — ADR-0246 Phase A0 not started; 29 `engine_sessions` reads remain in stage-engine.** ADR-0246 is `proposed` and Phase A0 (schema reconciliation) has not begun. `engine_state.kind` column does not exist. Session-manager.ts (6 sites), stage-manager.ts (3), guardian-evaluator.ts (3), and 6 others still read `engine_sessions`. This is expected per ADR-0246 §Phase A2 (feature-flag dual-write not yet flipped), but the ADR promotion gate ("promote to `accepted` after A0 merges") has not been triggered.

4. **SE-04 INFO — `workspace_id` in `engine-dispatch` Edge Function is caller-supplied, not server-derived.** `index.ts:193` destructures `workspace_id` directly from body and inserts it into `engine_event` without row-level server derivation. This is architecturally correct for the internal-auth-gated cron/service-role path (callers are trusted infrastructure, not browser clients). ADR-0151 server-derivation rule applies to user-facing mutations; internal service-role paths are explicitly exempt. No violation — documented as INTENTIONAL.

5. **SE-05 INFO — ADR-0246, ADR-0247, ADR-0248 all remain `proposed`; no enforcement gate active.** Three interdependent ADRs have been `proposed` since 2026-04-30 with zero Phase A0 work in flight. The synthesis notes this as a systemic pattern (enforcement-less ADRs accumulate). No code-review gate blocks `engine_state` writes without `kind` discriminator. No CI check enforces `journey.*`-emit producer rule beyond the ADR-0248 Amendment prose.

---

## Findings table

| ID | Sev | File:line | ADR | Evidence |
|---|---|---|---|---|
| SE-01 | ~~HIGH~~ INFO | `services/stage-engine/src/workers/mission-pool-slot.ts:7-8,354-363` | 0248 | Amendment 2026-05-20 grants carve-out. All 5 constraints satisfied: execution context owned, no parallel B5 emit, registry keys match Phase A3, workspace_id row-derived (`stateRow.workspace_id` + `nonEmpty()`), actor_id = `SYSTEM_ACTOR_ID` constant. Header comment references amendment. |
| SE-02 | MEDIUM | `services/stage-engine/src/routes/agent/dispatch.ts:1-264` | 0248, 0255 | Zero `emit()` calls in HTTP dispatch route. Sixten subprocess invoked identically to mission-pool path but success/failure events never reach `activity_trail` or `engine_event`. ADR-0255 Phase 0 silent on this; amendment constraint 1 implies worker owning context should emit. Undocumented gap. |
| SE-03 | MEDIUM | `services/stage-engine/src/core/session-manager.ts` (6 sites), `stage-manager.ts` (3), `guardian-evaluator.ts` (3), `agent-session.ts` (3), `telegram.ts` (6), `guardian.ts` (2), `fetch.ts` (1), `chat.ts` (1), `guardian-bus.ts` (1), `calendar-guardian.ts` (1) | 0246 | 29 `engine_sessions` reads remain; `engine_state.kind` column absent; Phase A0 not started. Expected state per ADR-0246 pre-Phase A2, but ADR status `proposed` means no enforcement. |
| SE-04 | INFO | `supabase/functions/engine-dispatch/index.ts:193,235` | 0151 | `workspace_id` from caller body trusted directly and inserted into `engine_event`. Caller is internal-auth-gated (service-role or cron secret). ADR-0151 exempts service-role paths. INTENTIONAL. |
| SE-05 | INFO | `docs/decisions/0246-*`, `0247-*`, `0248-*` | 0246, 0247, 0248 | All three ADRs status `proposed` since 2026-04-30. No Phase A0 migration. No `kind` discriminator enforcement in CI. No code-review grep gate for `journey.*` emitters. |
| BFF-01 | INFO | `apps/web/src/app/api/botsson/chat/route.ts:186` | 0151 | `workspaceId` from request body used in profile lookup `.eq("workspace_id", body.workspaceId)`. Subject profile additionally server-verified at line 221. Pattern is `body.workspaceId` scoping profile query then server-verifying the join — not a bypass. ADR-0151 compliant. |
| BFF-02 | INFO | `apps/web/src/app/api/emma/chat/route.ts:11,63,254` | 0078 | `channel` absent from `RequestSchema`; forced to `"chat"` server-side at line 254. Comment explicitly cites ADR-0078. COMPLIANT. |
| BFF-03 | INFO | `apps/web/src/app/api/botsson/chat/route.ts:297` | 0078 | `channel: "chat"` hardcoded at line 297, not exposed in schema. COMPLIANT. |
| EDF-01 | INFO | `supabase/functions/engine-dispatch/index.ts` (config.toml) | 0186 | `verify_jwt = false` set in `config.toml`. `verifyInternalAuth()` substitutes — accepts service-role key or `WATCHDOG_CRON_SECRET`. Fail-closed on missing secrets. COMPLIANT. |
| ADR-01 | INFO | `packages/ai/src/router/tool-selector.ts:171,184` | 0078 | ADR-0078 channel guard enforced: skip capability if `channel && capability.allowedChannels && !includes(channel)`. COMPLIANT. |

---

## Per-ADR rollup

| ADR | Status in file | Code reality | Verdict |
|---|---|---|---|
| 0042 (Agent Architecture) | `accepted` | Stage Engine runs agent mode + mission mode; composable capability layers active. | COMPLIANT |
| 0049 (Agent SDK Package) | `accepted` | `packages/ai` hosts capabilities, router, intent-classifier. | COMPLIANT |
| 0078 (Channel PII restriction) | (referenced) | `emma/chat` and `botsson/chat` force `channel:"chat"` server-side; `tool-selector.ts` enforces per-capability `allowedChannels`. | COMPLIANT |
| 0151 (workspace_id server derivation) | (referenced) | BFF routes derive via profile join (user_id × workspaceId). `mission-pool-slot` uses `stateRow.workspace_id`. `engine-dispatch` caller-supplied but internal-auth-gated. | COMPLIANT |
| 0186 (pg-notify guardian bus) | `accepted` | `verify_jwt=false` + `verifyInternalAuth()` dual-secret guard. Day-line-push + sync-integration use emit bridge. | COMPLIANT |
| 0246 (engine-sessions ontology) | `proposed` | 29 `engine_sessions` reads remain; `engine_state.kind` absent; Phase A0 not started. Expected pre-Phase A2. | IN-PROGRESS (SE-03) |
| 0247 (engine_state nullability) | `proposed` | No migration applied. `engine_state.workspace_id` still NOT NULL. Expected pre-Phase A0. | IN-PROGRESS |
| 0248 (B5 canonical emit producer) | `proposed` | Amendment 2026-05-20 names `mission-pool-slot` as second producer. B5 journey-lifecycle handlers not yet implemented (existing handlers are domain-specific tick handlers). HTTP dispatch route (SE-02) not covered by amendment. | PARTIAL — SE-02 gap |
| 0255 (Sixten Stage Engine) | `proposed` | `mission-pool-slot.ts` reads `persona` from yaml and calls `dispatchToSixten()`. Phase 0 `POST /agent/dispatch` route active. `REGISTERED_PERSONAS = ["sixten"]` enforces allow-list. Phase 0.5 file-backed queue in `infra/sixten/`. | COMPLIANT (Phase 0) |
| 0261 (BFF as mutation host) | `accepted` | Confirmed pattern for tips/payroll: `execute()` skeletons return `{ok:false, error:'not_implemented'}` with zero `emit()`; BFF Server Actions own mutations. | COMPLIANT |

---

## Verified intentional

- **engine-dispatch `workspace_id` from body** — internal-auth gate (service-role + cron) makes caller trustworthy infrastructure. ADR-0151 exempts this path.
- **29 `engine_sessions` reads in stage-engine** — ADR-0246 Phase A2 dual-write not yet active. Pre-Phase A0 state is expected. ADR-0246 §Phase A2 allows `engine_sessions` writes until feature flag flips.
- **ADR-0246/0247/0248 remain `proposed`** — no Phase A0 work triggered. `proposed` is correct status pending Phase A0 schema migration.
- **`dispatch.ts` zero telemetry** — ADR-0255 Phase 0 explicitly uses CLI subprocess with no engine_state write; the telemetry gap is a known Phase 0 limitation, not a regression.

---

## In-progress (campaign filter)

- **campaign/botsson-arena** — owns ADR-0246 Phase A0–A4 + ADR-0248 B5 lifecycle handlers. No Phase A0 migrations in flight as of 2026-05-20.
- **campaign/bubble-migration** — no relevant emit chains in this slice.

---

## SE-01 baseline resolution

The baseline synthesis flagged SE-01 as HIGH: `mission-pool-slot.ts` emitting `journey.*` at 4 sites violates ADR-0248 single-producer rule. The Amendment merged with commit `b1c43f5903` (2026-05-20) adds a Phase 0 pg-notify execution worker carve-out. Verification:

1. Amendment text in ADR-0248 exactly names `services/stage-engine/src/workers/mission-pool-slot.ts`.
2. File header (lines 5–8) cites the Amendment by date and links to Phase A4b migration gate.
3. `workspace_id` derived from `stateRow.workspace_id` (line 353) + `nonEmpty()` guard (line 362) — Amendment constraint 4 satisfied.
4. `SYSTEM_ACTOR_ID` constant (line 53) used for `actor_id` — Amendment constraint 5 satisfied.
5. No parallel B5 handler emits `journey.*` (confirmed: existing B5 handlers are domain-tick only) — Amendment constraint 2 satisfied.
6. Event names match Phase A3 registry (`journey run_started`, `journey step_reached`, `journey completed`, `journey run_failed`) — Amendment constraint 3 satisfied.

**SE-01 is closed. Downgraded to INFO (documented Phase 0 exception).**

---

_Audit by: claude-sonnet-4-6 (subagent, read-only) · run_id: 2026-05-20-adr-contract-validation-02 · slice 02 of 14_
