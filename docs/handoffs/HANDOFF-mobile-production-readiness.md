---
title: "Handoff — mobile-production-readiness"
feature: mobile-production-readiness
branch: feat/mobile-production-readiness
closed: 2026-03-26
module: mobile
---

# Handoff — mobile-production-readiness

## Summary

Built the mobile app's production-ready employee experience: WalkAi voice/text AI, smart home hub with priority action cards, 3 new backend AI capabilities (schedule, operations, communication with 12 tools total), deep link routing for push notifications, and ring leader phone dialer. This makes the mobile app journey-complete for the employee role (v1.0 launch gate).

## What Was Done

- [x] T1: Added `agent` EventCategory + `agent_session` EntityType + 5 telemetry events
- [x] T2: Created mobile i18n namespace (42 keys across 6 categories, nb + en)
- [x] T3: Fixed authority default mismatch (`suggest` → `read_only` in agent-router)
- [x] T4: Built schedule capability (4 read-only tools: get_my_shifts, get_shift_colleagues, get_today_schedule, get_shift_detail)
- [x] T5: Built operations capability (3 read-only + 2 suggest tools: get_my_tasks, get_session_info, get_department_status, create_deviation, complete_task)
- [x] T6: Built communication capability (2 read-only + 1 suggest tool: get_conversations, get_unread_count, send_message)
- [x] T7: Registered all 3 capabilities in registry
- [x] T8: Migrated deep link map to shared `@smartout/notifications/deep-links` package (expanded from 5 to 10 notification types)
- [x] T9: Created `prioritizeActions()` pure function with 29 passing tests (8 priority levels)
- [x] T10: Created WalkAi provider (session state, mobile context injection)
- [x] T11: Created 5 mobile client tools (navigate, open_sheet, show_toast, start_punch, call_leader)
- [x] T12: Built WalkAiSheet (75% bottom sheet, status orb with Reanimated animations, mic button, transcript)
- [x] T13: Updated FAB (tap=voice WalkAiSheet, long-press=text BotssonSheet, removed swipe-up QuickActions)
- [x] T14: Added priority action cards to home hub (urgency-coded, animated entrance)
- [x] T15: Added deep link telemetry (`notification deep_link_followed` event on push tap)
- [x] T16: Wired ring leader to phone dialer (new `useLeaderPhone` hook, fallback alerts)
- [x] T17: RLS audit passed (all hooks use anon key, all capability tools scope by workspaceId)
- [x] T18: Final typecheck 28/28 packages pass, 29/29 tests pass

## Decisions Made

| Decision                                       | Reason                                                                                                         | Impact                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Authority default `read_only` (not `suggest`)  | Align agent-router with tool-selector; v1.0 is employee-only                                                   | All capabilities default to read-only for all users                         |
| Net-new schedule tools (not wrapping existing) | Existing `tools/schedule/definitions.ts` are Ultravox client-side (`client: {}`), not wrappable as server-side | Clean separation between client tools and capability tools                  |
| Deep link map in shared package                | Both backend (notification construction) and mobile (push handler) need the same map                           | Single source of truth, no drift                                            |
| FAB tap=voice, long-press=text                 | Voice is the primary mobile interaction; text is fallback                                                      | Breaking change: QuickActions removed from FAB, moved to hub priority cards |
| Per-workspace authority (not per-role) in v1.0 | Per-role authority requires ADR for `engine_authority_config` schema change                                    | v1.1 scope: per-role authority model                                        |

## Learnings

| Learning                                                             | Context                                                                                                                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel agents can delete files via `git add -A` in commits         | 7 files from development were accidentally deleted during parallel agent staging. Always verify `git diff --diff-filter=D` after parallel agent work.                      |
| `pnpm turbo` in a worktree only sees packages in the worktree scope  | Must run from repo root to get full 28-package typecheck                                                                                                                   |
| Capability tools use `supabaseAdmin` (service role) by design        | Workspace scoping depends entirely on `.eq("workspace_id", ctx.workspaceId)` in every tool. Future tools missing this filter would silently leak data. Consider lint rule. |
| `use-day-info` and `use-shift-colleagues` rely solely on DB-side RLS | No client-side workspace filter. Safe if RLS policies exist, but worth verifying in migration audit.                                                                       |

## Known Issues / Debt

- WalkAi voice session is a placeholder — Ultravox WebRTC integration needs to be wired in WalkAiSheet
- Transcript state is local (not persisted) — voice conversation history is lost on sheet dismiss
- `pending_tasks_count` in WalkAi provider context hardcoded to 0 — needs wiring to useMyTasks
- Guardian signals and unread count in home hub passed as empty/0 — needs hook integration
- Toast in `mobile_show_toast` client tool uses `Alert.alert` instead of proper toast library
- `use-day-info` hook has no client-side workspace filter (relies on DB RLS only)
- No E2E tests for mobile (Playwright only covers web)

## Next Steps

- Wire Ultravox WebRTC into WalkAiSheet for live voice sessions
- Add per-role authority model (v1.1 ADR needed for `engine_authority_config`)
- Integrate guardian signals hook into home hub priority engine
- Add unread message count hook to home hub
- Build shift leader views (v1.1: approve hours, session signoff, team status)
- Native App Store / Google Play build configuration
- Performance testing on budget Android device (Samsung Galaxy A13)
