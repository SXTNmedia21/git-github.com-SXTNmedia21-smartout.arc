---
title: "Journey — welcome-mission-rework"
feature: welcome-mission-rework
status: verified
verified_at: 2026-05-04
created: 2026-05-04
updated: 2026-05-04
module: mission-engine
type: process-journey
tags: [mission-engine, council-driven, spec-rework]
---

# Journey — welcome-mission-rework

Process-journey for spec/ADR rework sortie. No runtime user-journey — this sortie is documentation + ADR + telemetry-registration only.

## Precondition

R1 council 2026-05-04 returned **REJECT — REWORK REQUIRED** on Welcome Mission V0 implementation spec + 4 ADRs (0271-0274) with 10 BLOCKERs + 8 HIGH fixes. Council artifacts:
- `docs/council/COUNCIL-LOG.md` (2026-05-04 row, REJECT verdict)
- `docs/engines/artificial-intelligence/mission-engine/IMPLEMENTATION_SPEC_welcome_mission_v0.md`
- `docs/decisions/0271-0274` ADR drafts (status: proposed)

## Journey: Spec-author applies B1-B10 + H1-H8

**Precondition:** Plan PLAN-welcome-mission-rework.md committed (37c745bf6) declaring fix-list.

1. Spec-author reads plan + spec + 4 ADRs end-to-end → identifies fix-points per BLOCKER/HIGH.
2. Author applies B2 (M5 RLS godmode → user_identity), B3 (drop M1, base_instruction → system_prompt), B4 (last_activity_at → updated_at), B7 (audit_outbox workspace_id NOT NULL + workspace_read_audit_outbox RLS), B8 (ADR-0274 cite ADR-0246), B9 (ADR-0273 amends ADR-0180 + atomicity Option (b)), B10 (OQ-2 POST-CAS), H1 (per-tool compliance table), H2 (tool_allowlist consumer-wiring), H5 (DROP POLICY IF EXISTS), H6 (get_workspace_ids_for_user), H7 (M7 backfill safety pattern), H8 (authority_snapshot clarification).
3. System updates spec + ADR-0272 + ADR-0273 + ADR-0274 + WELCOME_MISSION_V0.md → user sees diff in commit f98995685.

**Postcondition:** All BLOCKER/HIGH fixes applied to spec/ADR text. Author commits as one atomic unit.

**Error paths:**
- Column-name fix wrong (e.g., applies `is_godmode` to `profile` instead of `user_identity`) → caught by R2 supervisor verification against `database.types.ts`.
- ADR-0273 atomicity option (a) chosen but no Postgres RPC exists → R2 agent-coord flags as phantom contract.

## Journey: Telemetry-author registers events

**Precondition:** Spec §Avhengigheter declares 12 new events with space-form names (B5-fix per L-0046).

1. Author edits `packages/telemetry/src/registry.ts` → adds `welcome` + `inquiry` to `EventCategory` union (lines 54-55).
2. Author declares 12 event interfaces with space-form `event:` field (lines 6985-7096): WelcomeStageAdvanced, WelcomeStageFailed, WelcomeMissionAbandoned, WelcomeSessionResumed, WelcomeSessionRestartedAfterWindow, WelcomeSpawnEvaluated, WelcomeEarlyExitViaTransition, InquiryNoted, InquiryClosed, MissionTransitioned, UiPointedAtSetting, UiDemoShown.
3. Author adds 12 entries to `SmartoutEvent` union (lines 7780-7791).
4. Author registers all 12 in `EVENT_ROUTING` map (lines 10625-10677) with destinations + category. `engine_event` destination only on cascade-critical (welcome stage_advanced/stage_failed/mission_abandoned, mission transitioned).
5. System runs `pnpm turbo typecheck --filter=@smartout/telemetry` → 1/1 pass.
6. Author adds `"inquiry"` to `packages/ai/src/router/intent-classifier.ts` z.enum() (H4-fix).
7. Author registers `WELCOME_MISSION_RESUME_WINDOW_HOURS` in `apps/web/src/env.ts` (z.coerce default 24) + `.env.template` (op:// reference).

**Postcondition:** Compile-time type safety on all welcome-mission emit() call-sites. Future `emit("welcome.stage_advanced")` (dot-form) throws TypeScript error per L-0046.

**Error paths:**
- Mismatch between interface event-name + EVENT_ROUTING key → typecheck fails with "missing properties" error (caught by Stop hook during edit).
- Forgot to add to SmartoutEvent union → EVENT_ROUTING `Record<SmartoutEvent["event"], EventMeta>` complains missing keys.

## Journey: R2 fast-track council reviews rework

**Precondition:** Commit f98995685 lands all 18 fixes. Plan acceptance criteria ready for verification.

1. Orchestrator dispatches 4 parallel reviewers: system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder. Skip frontend-designer + narrator + Phase 2.5 fact-check per plan §Re-review.
2. Each reviewer reads spec + ADRs + diff `git diff origin/development..HEAD` → produces verdict with file:line evidence.
3. system-steward verdict: APPROVE — all 18 fixes verified Pass.
4. supervisor verdict: COLUMN+TELEMETRY OK — schema verified against `database.types.ts:18588` (`user_identity.is_godmode`), `:8467` (`engine_missions.system_prompt`), `:8592` (`engine_sessions.updated_at`).
5. system-agent-coordinator verdict: TRUST-GATE PASS WITH 3 CONDITIONS (C1: navigate_to phantom claim, C2: emitPrefix:null on ui+mission, C3: point_at_setting vs highlight_element rationale).
6. botsson-harness-builder verdict: TRUST GATE PASS WITH NOTES (DomainChatOwnership + ADR-0132/0133 cite — both deferred to impl phase).
7. Spec-author applies C1-C3 in commit 80ff24692 → spec §1.8 row 5 reframes navigate_to as unchanged, §1.8.1 added (emitPrefix-konsekvens), §1.8.2 added (point_at_setting rationale).

**Postcondition:** R2 verdict aggregate APPROVE (4/4 pass after C1-C3 applied). Sortie ready for closure.

**Error paths:**
- Reviewer finds undocumented gap (e.g., spec promises feature codebase can't deliver TODAY) → REJECT, return to spec-author for new BLOCKER fix.
- Typecheck fails on event registration → cannot proceed to R2 until fixed.
- ADR cross-reference unresolvable (e.g., ADR-0246 doesn't have referenced section) → REJECT.

## Journey: Sortie closure

**Precondition:** R2 APPROVE verdict + all conditions applied + typecheck 46/46 pass.

1. Spec-author runs `/close-feature` → Journey Guardian verifies this file (status: verified).
2. close-feature.sh re-runs gates: decision log + frontmatter + typecheck.
3. Script merges feat/welcome-mission-rework → development → push.
4. Worktree wt-6 removed, branch deleted.
5. Activity-log records `feature-closed` event.

**Postcondition:** ADR drafts (0271-0274) on development branch; mission-engine implementation phase can begin in separate sortie. R2 verdict logged in council-log. HANDOFF documents next-phase recommendations.

**Error paths:**
- close-feature.sh detects missed BLOCKER → blocks merge, returns to author.
- Typecheck regression introduced by C1-C3 commit → blocks merge.
- Conflict on merge to development (concurrent ADR additions) → manual resolution required.

## Out-of-scope for this sortie

- Welcome mission V0 implementation (migrations, capability code, BFF route, tests). Spec describes implementation contract but no code lands.
- Voice-stack migration (Ultravox → LiveKit) — separate sortie/campaign per session intent 2026-05-04.
- True transactional atomicity for two-brain emit (ADR-0273 Phase A — Postgres RPC, post-V0).
- BotssonShell connect-handler integration (separate sortie post-R2).
- 1Password vault entry for `welcome-mission/resume_window_hours` (operator action, post-merge).

## Verified against commits

| Commit | Scope |
|---|---|
| 37c745bf6 | docs(plan): welcome-mission-rework sortie plan — B1-B10 + H1-H8 fix-list |
| f98995685 | fix(welcome-mission): apply B1-B10 + H1-H8 council rework |
| 80ff24692 | fix(welcome-mission): apply R2 council C1-C3 conditions |
