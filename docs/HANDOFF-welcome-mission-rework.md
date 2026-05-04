---
title: "Handoff — welcome-mission-rework"
feature: welcome-mission-rework
branch: feat/welcome-mission-rework
closed: 2026-05-04
module: mission-engine
tags: [mission-engine, council-driven, spec-rework, R2-approved]
---

# Handoff — welcome-mission-rework

## Summary

Spec/ADR rework sortie for Welcome Mission V0. R1 council 2026-05-04 returned REJECT — REWORK REQUIRED with 10 BLOCKERs + 8 HIGH fixes. This sortie applied all 18 fixes plus 3 R2-conditional fixes from system-agent-coordinator code-trace, then R2 fast-track council returned APPROVE. Spec + 4 ADRs (0271-0274) now ready for implementation phase in separate sortie. **Zero runtime code shipped** — text + telemetry-registry + intent-classifier + env-var only.

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| welcome-mission-rework (umbrella process-journey) | verified | none — spec sortie, no runtime code |

## Decisions Made

This sortie did NOT introduce new ADRs. It applied fixes to ADR drafts 0271-0274 already committed in 414a9100d (council-output commit pre-sortie). Decision-log entries lines 47-50 retain R1 verdicts; R2 APPROVE outcome reflected in this HANDOFF + journey file.

| Decision | Reason | Impact |
|----------|--------|--------|
| Drop M1 migration; reuse `engine_missions.system_prompt` (B3) | Column already exists via `20260318120000_engine_tuning_notes_and_mission_prompt.sql` | Zero new schema cost; `Mission` type at `services/stage-engine/src/types/session.ts:33` already has `system_prompt: string \| null`; `stage-manager.ts:197` reads it |
| ADR-0273 atomicity Option (b) Pragmatic V0 (B9) | True atomicity requires Postgres RPC — out of V0 scope | Two-brain emit uses exception-propagation + idempotency-key + retry-on-divergence; documented limitation, no theatre. Phase A converts to RPC post-V0 |
| OQ-2 POST-CAS (B10) | PRE-CAS race-risk between evaluation and CAS | `evaluateOutcomes(sessionId)` runs after CAS-success; failure-mode: hook throw → guardian-evaluator catch on next 120s tick (secondary safety-net) |
| Telemetry namespace space-form per L-0046 (B5) | Registry uses space-form (`"shift created"`); dot-form is registry-internal conversion via `engine-event.ts::toDotNotation` | Compile-time type safety: `emit("welcome.stage_advanced")` would throw TS error; `emit("welcome stage_advanced")` is correct call shape |
| Direct-call emit pattern for ui + mission capabilities (R2 C2) | Both have `emitPrefix: null` in current code; flipping breaks existing tools | Welcome-mission's 4 new emit-call-sites use `emit("ui pointed_at_setting", ...)` etc. directly with full event-name; matches tips/lovsen precedent |
| `point_at_setting` separate from `highlight_element` (R2 C3) | Distinct input-shape (setting-path vs CSS-selector) + separate telemetry observation | New tool in ui capability rather than extending existing `highlight_element` |

## Learnings

| Learning | Context |
|----------|---------|
| Phantom contract via docstring claim about existing emit-reuse | Spec §1.8 row 5 originally claimed `navigate_to` reuses existing `emit("ui navigated", ...)` — body has only `ctx.broadcast()`, zero emit() calls. Caught by R2 system-agent-coordinator code-trace (per L-0176 mandate). Fix: drop the claim, frame `navigate_to` as unchanged. |
| `emitPrefix: null` capabilities — direct-call pattern is acceptable | Multiple capabilities (ui, mission, tips, lovsen) have `emitPrefix: null`. Tools in these capabilities call `emit()` directly with full event-name. Pattern is consistent and compatible with new event additions. No flip required when adding emits. |
| Council R1 → R2 fast-track works when fix-list is mechanical | R1 produced 10 BLOCKERs + 8 HIGHs as concrete fix-list. R2 verified each with file:line evidence. Skipped frontend-designer + narrator + Phase 2.5 fact-check per plan §Re-review. R2 reviewer-hours: ~2-3 across 4 parallel reviewers. |
| H1 per-tool compliance table format | Per L-0175 + L-0176, capability with ≥2 tools must have body-traced compliance table with columns: gate_action / gatedMutation / emit() / allowedChannels / Verdict. Verdict frame "Compliant when implemented per template" is honest for spec-phase (no body to trace yet). |

## Known Issues / Debt

- ADR-0271 EDITS deferred (R1 council asked for Zod schema for `exit_criteria_jsonb` shape + agent_inquiry TTL/retention strategy). Not addressed in this rework. Tracked for implementation-phase sortie.
- ADR-0272 EDITS deferred (R1 council asked for `ON CONFLICT DO UPDATE` resolution + tool_allowlist typo-check against CapabilityName registry). Not addressed.
- ADR statuses remain `proposed` (not flipped to `accepted`). Plan §Closure permits transition but conservative path keeps proposed until implementation phase confirms feasibility.
- `WELCOME_MISSION_RESUME_WINDOW_HOURS` 1Password vault entry pending operator action: `op://smartout_ai/welcome-mission/resume_window_hours = 24` for both `smartout_ai` (dev/shared) and `smartout_ai_prod`.
- DomainChatOwnership / ADR-0238 not declared in spec (R2 botsson-harness-builder note). Welcome mission mounts via Botsson Orb only; low collision risk for V0. Add one-line note in §9.1 during implementation phase.
- ADR-0132/0133 mobile-boundary citations not explicit in spec. Doc hygiene only — implementation pattern (BFF→stage-engine) already satisfies pattern.
- Phase A (post-V0) work: convert two-brain emit to true atomicity via Postgres RPC (`complete_session_step_and_emit(...)` SECURITY DEFINER with BEGIN/COMMIT). Tracked in ADR-0273 §Implementation notes.

## Next Steps

1. **Implementation-phase sortie** (separate worktree). Order per spec §4:
   - 1.x — accept ADRs 0271-0274 (proposed → accepted via review)
   - 2.x — migrations M2-M7 (M1 dropped, M2/M3/M4/M5/M6/M7 in dependency order)
   - 3.x — `inquiry` capability (capabilities/inquiry/tools.ts + index.ts) + registry + types.ts CapabilityName
   - 4.x — template.ts + template.test.ts (T0)
   - 5.x — M6 seed + M7 backfill (gated on tools landed)
   - 6.x — stage-manager.shouldAdvanceStage + evaluateOutcomes; tool-selector.applyToolAllowlist; prompt-builder.buildStagePromptWithMissionFrame; session-manager frozen snapshot; transition_to_other_mission + point_at_setting + show_demo
   - 7.x — BFF /api/botsson/session/init route
   - 8.x — Tests T1-T7
   - 9.x — BotssonShell connect-handler integration (frontend-designer territorium)
2. **Voice-stack migration** (Ultravox → LiveKit) — separate sortie/campaign per session intent 2026-05-04. Distinct from welcome-mission-rework scope.
3. **1Password vault entry** — operator adds `welcome-mission/resume_window_hours = 24` to both vaults before implementation deploy.
4. **System-map update** — `BOTSSON-SYSTEM-MAP.md` row for mission-engine spec phase: ADR-drafts 🟡 → 🟢 once implementation phase begins (deferred to that sortie).
5. **R2 council outcome** — append to `docs/council/COUNCIL-LOG.md` 2026-05-04 row (or new row) noting R2 verdict APPROVE for welcome-mission-rework. Currently only R1 REJECT logged.

## Verified against commits

| Commit | Scope |
|---|---|
| 414a9100d | docs(council): welcome-mission V0 council 2026-05-04 — REJECT, 4 ADRs, 4 learnings (pre-sortie) |
| 37c745bf6 | docs(plan): welcome-mission-rework sortie plan — B1-B10 + H1-H8 fix-list (sortie start) |
| f98995685 | fix(welcome-mission): apply B1-B10 + H1-H8 council rework |
| 80ff24692 | fix(welcome-mission): apply R2 council C1-C3 conditions |

Verification: `pnpm turbo typecheck` 46/46 pass (cached after both fix-commits).
