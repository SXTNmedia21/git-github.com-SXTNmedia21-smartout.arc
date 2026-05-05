---
title: "Welcome Mission V0 — Rework Sortie Plan"
id: PLAN_WELCOME_MISSION_REWORK
status: in_progress
created: 2026-05-04
updated: 2026-05-04
module: mission-engine
sortie: feat/welcome-mission-rework
worktree: smartout.ai-wt-6
parent_council: docs/council/COUNCIL-LOG.md (2026-05-04 row, REJECT verdict)
parent_spec: docs/engines/artificial-intelligence/mission-engine/IMPLEMENTATION_SPEC_welcome_mission_v0.md
parent_design: docs/engines/artificial-intelligence/mission-engine/WELCOME_MISSION_V0.md
tags: [mission-engine, rework, council-driven, R2-required]
---

# Welcome Mission V0 — Rework Sortie

Council 2026-05-04 returned REJECT — REWORK REQUIRED on Welcome Mission V0 implementerings-spec + ADRer 0271-0274. This sortie applies the 10 BLOCKERs + 8 HIGH fixes from Phase 5 synthesis, then queues R2-only fast-track review.

## Goal

Make the implementation spec + 4 ADRs accept-able by:
- Fixing 3 column-name collisions (would fail at migration-apply)
- Fixing 4 phantom tools (would fail at runtime via empty tool_allowlist)
- Resolving 2 ADR-cross-references (ADR-0246 cite, ADR-0180 amendment)
- Resolving spec-internal contradictions (OQ-2 pre/post-CAS)
- Closing telemetry-namespace registration gap

Success = R2 fast-track review verdict APPROVE WITH EDITS or APPROVE.

## BLOCKERs (must fix before R2)

### B1: ADR file commit-state ✅ DONE in council Phase 7-8
ADRs 0271-0274 + IMPLEMENTATION_SPEC committed to development as `proposed` in commit `414a9100d`.

### B2: M5 RLS column fix — `is_godmode` on `user_identity` not `profile`

**File:** spec §1 M5 (engine_audit_outbox migration) + ADR-0273 schema-section

**Current (broken):**
```sql
EXISTS (SELECT 1 FROM public.profile p WHERE p.user_id = auth.uid() AND p.is_godmode = true)
```

**Fix:**
```sql
EXISTS (SELECT 1 FROM public.user_identity ui WHERE ui.user_id = auth.uid() AND ui.is_godmode = true)
```

Reference pattern: `supabase/migrations/20260301140000_journey_system.sql:179` (canonical join).

### B3: Drop `engine_missions.base_instruction` — use existing `system_prompt`

**File:** spec §1 M1 + §2 prompt-builder + §13 schema sketch + ADR-0272 + WELCOME_MISSION_V0.md §3.1, §4.1, §9.1

**Action:**
- Drop M1 migration entirely
- All references to `base_instruction` → `system_prompt`
- Verify `Mission` type at `services/stage-engine/src/types/session.ts:33` already has `system_prompt: string | null` (it does)
- Verify `stage-manager.ts:197` reads `mission.system_prompt` (it does)
- ADR-0272 §migration-strategy: clarify why we use the existing column (single source of truth, no orphan)

Reference: existing migration `20260318120000_engine_tuning_notes_and_mission_prompt.sql` already added `system_prompt`.

### B4: Replace `last_activity_at` with `updated_at`

**File:** WELCOME_MISSION_V0.md §10.8 + ADR-0274 §Resume-semantikk

**Current (broken):**
```
IF (now - session.last_activity_at) < WELCOME_MISSION_RESUME_WINDOW_HOURS:
```

**Fix:**
```
IF (now() - session.updated_at) < make_interval(hours => $resume_window):
```

`engine_sessions.updated_at` exists (verified via `database.types.ts`). `last_activity_at` does not.

### B5: Telemetry namespace fix — space-form, not dot-form

**File:** spec T5 + M5 event_name + ADR-0273 §teknisk-beslutning + ADR-0274 §recovery

**Per L-0046:** `packages/telemetry/src/registry.ts` uses space-form (`"season created"`, `"shift published"`); dot-form is registry-internal conversion via `engine-event.ts::toDotNotation`.

**Required actions:**
- Spec event-names: `"welcome stage_advanced"` (not `"welcome.stage_advanced"`)
- Spec event-names: `"inquiry noted"` (not `"inquiry.noted"`)
- Spec event-names: `"welcome mission_abandoned"` (not `"welcome.mission_abandoned"`)
- Add `inquiry` and `welcome` to `EventCategory` union in `packages/telemetry/src/registry.ts:26-58`
- Register all welcome-mission events in `EVENT_ROUTING` map

Without this, `emit("welcome.stage_advanced")` will throw at TypeScript compile time (per agent-coord trace #10).

### B6: Phantom tools — implementation order fix

**Current spec §4 ordering bug:** seed M6 references tools that don't exist yet (`transition_to_other_mission`, `point_at_setting`, `show_demo`, `note_inquiry`).

**Required reordering:**
1. Build `inquiry` capability + `note_inquiry` tool — BEFORE M6 seed
2. Add `transition_to_other_mission` to `mission` capability — BEFORE M6 seed
3. Add `point_at_setting` + `show_demo` to `ui` capability — BEFORE M6 seed
4. Per-tool compliance table written into spec (per L-0175, L-0176) BEFORE registration

Each new tool gets:
- gate_action call (write tools only)
- gatedMutation wrapper (write tools only)
- emit() with workspace_id + actor_id non-null (per L-0177)
- allowedChannels declaration (per ADR-0078)
- File:line citation in spec

### B7: Add `workspace_id NOT NULL` to `engine_audit_outbox`

**File:** spec §1 M5 + §13.3 schema sketch + ADR-0273

**Add column:**
```sql
workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
```

Update RLS to use direct `workspace_id` filter (avoids initplan performance hazard per harness Concern §5).

Per CLAUDE.md Law 1: "Every workspace-scoped table needs `workspace_id`."

### B8: ADR-0274 must explicitly cite ADR-0246 as superseding-by-extension

**File:** ADR-0274 §Decision-Outcome

**Add paragraph:**

> ADR-0274 extends ADR-0246's engine_state vs engine_sessions split by introducing `engine_session_step` as the per-stage durability table for the sessions-gren. This is consistent with ADR-0246's mandate that conversation-state is separate from cascade-state — `engine_state_step` is for `engine_state` (cascade journey-engine), `engine_session_step` is for `engine_sessions` (interactive mission-mode). The parallel-naming is deliberate to make the split visible in the schema list. Phase A0+A1 of ADR-0246 (additive `engine_state.kind` enum) is unaffected by this ADR.

### B9: ADR-0273 must declare ADR-0180 amendment + atomicity mechanism

**File:** ADR-0273 §depends_on + §Decision-Outcome + §Implementation-notes

**Add:**
1. `amends: ADR-0180` (parity contract) in frontmatter
2. Specify atomicity mechanism — pick ONE:
   - **(a) Postgres RPC** — `complete_session_step_and_emit(...)` SECURITY DEFINER, BEGIN/COMMIT wrap. True atomicity. Phase 0 deliverable.
   - **(b) Pragmatic V0** — explicit "best-effort coordination via exception-propagation; engine_event INSERT failure after step UPDATE leaves orphan committed state. Idempotency-key + retry-on-divergence required." Documented limitation, no theatre.

Choose (a) or (b) before R2. ADR-0273 currently implies (a) ("two-phase-commit-aktig") but reality is (b). Pick one and own it.

3. Single helper function: `emitEngineEventSync(supabase, payload)` with throw-on-error. All welcome-mission engine_event writes go through this helper. Lint-rule (or code-review checklist) bans direct `.from("engine_event").insert(`.

### B10: Resolve OQ-2 pre/post-CAS contradiction

**Conflict:**
- Spec line 482 (OQ-2 forslag): "Kall PRE-CAS. Stage settes til current_stage_id."
- ADR-0274 line 138: "Kall evaluateOutcomes post-CAS i advanceStage."

**Decision needed:** PRE-CAS or POST-CAS for `evaluateOutcomes(session_id)`?

**Recommendation:** POST-CAS (per ADR-0274). Rationale:
- POST-CAS = outcome evaluated against committed state
- PRE-CAS = race-risk between evaluation and CAS
- Failure mode of POST-CAS: hook throws after CAS-success → outcome eval missed → guardian-evaluator catches at next 120s tick (secondary safety-net)

Update spec OQ-2 to match ADR-0274. Remove contradiction. Document the failure-mode + guardian-evaluator catch-up.

## HIGH fixes (same PR after blockers)

### H1: Per-tool compliance table

For each of 5 new tools (note_inquiry, transition_to_other_mission, point_at_setting, show_demo, navigate_to-wrapper), spec must include:

| Tool | gate_action | gatedMutation | emit() | allowedChannels | Verdict |
|------|-------------|---------------|--------|-----------------|---------|

Per L-0175 + L-0176. Body verification, not docstring claims.

### H2: tool_allowlist consumer-wiring path

Specify how `engine_stages.tool_allowlist` reaches `tool-selector.selectTools()`:

**Recommended path (from agent-coord trace #4):**
1. `session-manager.createSession()` reads stage's `tool_allowlist` at spawn → stores in `engine_sessions.context.active_tool_allowlist`
2. `agent-router` reads from session context → passes as `stageContext.tool_allowlist` parameter to `selectTools()`
3. `tool-selector.applyToolAllowlist(tools, allowlist)` filters hard

Alternative: add to AgentToolContext signature (broader change). Choose before R2.

### H3: WELCOME_MISSION_RESUME_WINDOW_HOURS env-var registration

**Files:**
- `apps/web/src/env.ts` — add `WELCOME_MISSION_RESUME_WINDOW_HOURS: z.coerce.number().int().positive().default(24)`
- `.env.template` — add `WELCOME_MISSION_RESUME_WINDOW_HOURS="op://smartout_ai/welcome-mission/resume_window_hours"`
- 1Password vault (both `smartout_ai` + `smartout_ai_prod`) — add `welcome-mission/resume_window_hours = 24`

### H4: inquiry capability intent-classifier binding

**File:** `packages/ai/src/router/intent-classifier.ts:38-69`

Add `"inquiry"` to the `z.enum()` intent list. Without this, `note_inquiry` only fires in `general` fallback intent.

### H5: M3-M5 RLS re-runnability

Wrap policies in `DROP POLICY IF EXISTS ... ; CREATE POLICY ...` for re-runnability. Postgres syntax limitation: no `CREATE POLICY IF NOT EXISTS`.

### H6: M3 RLS use `get_workspace_ids_for_user()` helper

**File:** spec §1 M3

Currently inlines join chain. Use existing helper for parity with M4 + Smartout convention.

### H7: M7 backfill safety

- Explicit non-default-allow logic
- `updated_by` populated (fall back to first godmode user, RAISE NOTICE if none — per existing pattern in `20260515130500_seed_session_authority.sql`)
- workspace-scoped not cross-workspace mass-set
- Safe re-run via `WHERE NOT EXISTS` guard

### H8: authority_snapshot clarification

**File:** ADR-0274 §Frozen authority-snapshot

Add: "Snapshot is audit-historical; re-evaluation always re-resolves via `gate_action()` RPC at action time. Snapshot is never consulted at runtime authority decision; it is read-only audit evidence in `engine_sessions.context.authority_snapshot`."

This closes Steward Phase 3 concern about ADR-0099 conflict (which was REVERSED in Phase 5 — clarification removes ambiguity).

## MEDIUM fixes (follow-up sortie OK if blocking)

- M1: `agent_inquiry` TTL strategy declared in ADR-0274 ("no TTL ever" → "perpetual until status='closed' or status='superseded'; admin-initiated archive after 12 months opt-in")
- M2: Cross-mission workspace-isolation test (T8) — admin in W1 spawning mission in W2 cannot see W1's open inquiries
- M3: `tool_allowlist` FK to capability registry (deferred until junction table exists)
- M4: OQ-7 stage_1_questions_asked — increment-site documented in spec §4.2 (agent-router post-LLM-response heuristic; counter resets per session-spawn)
- M5: Migration timestamp staggering (M1-M7 use `20260525100000` through `20260525100600` — one minute increments to leave headroom)

## Journeys

| # | Role | Journey |
|---|------|---------|
| J1 | Spec-author | Reworks 4 ADR drafts (0271-0274) + IMPLEMENTATION_SPEC per B1-B10 + H1-H8 fixes. Each ADR commit references this PLAN by id. |
| J2 | Migration-author | Writes 7 migrations (M1 dropped, M2-M7) with column-collision fixes, RLS using helper, idempotent re-run via DROP POLICY IF EXISTS. Verifies `\d table_name` for every ADD COLUMN. |
| J3 | Capability-developer | Implements 4 phantom tools (note_inquiry in new `inquiry` capability; transition_to_other_mission in `mission`; point_at_setting + show_demo in `ui`). Each tool gets per-tool compliance row in spec H1 table. |
| J4 | Telemetry-author | Adds `inquiry` + `welcome` to `EventCategory` union, registers events in `EVENT_ROUTING` map (space-form), adds `inquiry` to intent-classifier z.enum, adds `WELCOME_MISSION_RESUME_WINDOW_HOURS` to env.ts + .env.template + vault. |
| J5 | Reviewer | Triggers R2 fast-track council review post-rework. Skip Phase 4 narrator. Single Phase 5 synthesis with Trust Gate re-evaluation per L-0175 per-tool table. |

## Re-review trigger

R2 fast-track review (NOT full council) when:
- All 10 BLOCKERs fixed
- All 8 HIGH fixed (or explicitly deferred with single-line justification)
- All 5 journeys touched
- Spec + 4 ADRs re-read end-to-end for internal consistency
- `pnpm turbo typecheck` passes
- `git ls-files docs/decisions/0271-0274` confirms files on disk

R2 reviewers: system-steward (chair, expedited synthesis), supervisor (column-name + telemetry verification), system-agent-coordinator (10-point Code-Tracer Mandate re-trace), botsson-harness-builder (Trust Gate re-evaluation).

R2 SKIPS: frontend-designer (still backend-only), narrator (orchestrator inline), Phase 2.5 fact-check (orchestrator inline since fix-list is pre-verified).

Estimated R2 reviewer-hours: 2-3.

## Out of scope for this rework

- Phase A0+A1 of ADR-0246 (Steward's original Phase 3 recommendation; REVERSED in Phase 5 because parallel-table is legitimate per ADR-0246, not violation)
- BotssonShell connect-handler integration (separate sortie post-R2)
- Voice-spesifikk personality_override (V0.1 deferral)
- Mission v2 versioning (defer to first text-change PR after v1 ships)
- True transactional atomicity for two-brain emit (Phase A — Postgres RPC, post-V0)

## Acceptance criteria

| Criterion | How to verify |
|---|---|
| All 10 BLOCKERs fixed | Each BLOCKER section has commit-hash citation |
| Per-tool compliance table written | `grep -A 6 "Per-tool" docs/engines/artificial-intelligence/mission-engine/IMPLEMENTATION_SPEC_welcome_mission_v0.md` shows table |
| Telemetry events registered | `grep "welcome\|inquiry" packages/telemetry/src/registry.ts` shows entries |
| Migrations idempotent | `pnpm supabase db reset && pnpm supabase db reset` both succeed |
| TypeScript clean | `pnpm turbo typecheck` exit 0 |
| ADRs cross-referenced | `grep "ADR-0246" docs/decisions/0274-*.md` finds B8 paragraph; `grep "ADR-0180" docs/decisions/0273-*.md` finds B9 amendment |
| R2 verdict | APPROVE WITH EDITS or APPROVE in `docs/council/COUNCIL-LOG.md` |

## Closure

When R2 verdict APPROVE: run `/close-feature` from sortie worktree. Handoff includes:
- Fix-by-fix diff vs original spec
- R2 verdict citation
- ADR status transitions (proposed → accepted)
- Next-phase recommendation (mission-engine implementation can begin)
