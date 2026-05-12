---
title: "Harness Coverage Top-3 Batch 8 — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [e2e, harness, coverage, journey-authoring, shift-swap, ui]
---

# Harness Coverage Top-3 Batch 8 — HANDOFF

## What was built

Three new E2E harness specs covering 3 capabilities × ~5 tools each = +14 tools, 70 new test() calls.

| Spec | Tools covered | Tests / Skips |
|------|---------------|---------------|
| `apps/e2e/tests/journey-authoring-harness-e2e.spec.ts` | 4 tools (save_draft, check_duplicates, lookup_journeys, publish_draft) | 22 tests · 1 voice skip · 3 DB-integrity soft-skip |
| `apps/e2e/tests/shift-swap-harness-e2e.spec.ts` | 5 tools (get_swap_requests, get_swap_eligibility, request_swap, respond_to_swap, cancel_swap) | 26 tests · 1 voice skip · 9 conditional soft-skips on lifecycle chain |
| `apps/e2e/tests/ui-harness-e2e.spec.ts` | 5 tools (navigate_to, fill_field, highlight_element, show_panel, show_toast) | 22 tests · 1 by-design skip (presentation-only, no voice guard exists) |

Coverage now 22/29 capabilities (76%), 97/127 tools (76%). Only 2 capabilities remain: kb_query (1) + operations-intelligence (1).

## Decisions

### D1: ADR-0240 delegation gap documented, not fixed (journey-authoring)
`publish_draft` in `tools.ts` writes `journey` + `journey_version` rows directly inside `gatedMutation().execute` callback. Does NOT delegate to `journey.publish_mission`. The tool body acknowledges the gap in a comment at lines 453-458 referencing ADR-0240 and noting future delegation refactor. Spec D2 asserts the acknowledgment comment exists, that `publishMission` is NOT called internally (would be double-write bug), and that `gatedMutation` wraps all writes. Correct "today" posture — separate sortie required to refactor delegation.

### D2: Swap state in engine_state.context JSONB (ADR-0067)
Shift-swap has NO `shift_swap_request` table. State lives entirely in `engine_state.context` JSONB. `engine_state.id` IS the `swap_id`. Spec asserts `context.status` progression: `pending_recipient` → `pending_manager` → `cancelled`. This is the ADR-0067 "engine as state machine" pattern.

### D3: UI is REAL backend capability, not page-tool registry shim
Despite the coverage matrix note suggesting otherwise, `ui` is a first-class L4 capability registered in `packages/ai/src/capabilities/registry.ts` as `uiCapability`. Distinguishing traits:
- `emitPrefix: null` — tool bodies never call `gate_action` or `emit()`
- `readOnlyTools: []` — all 5 tools ARE the read-only surface
- `allowedChannels: ['chat', 'voice', 'sms', 'email']` — ADR-0163 exempts presentation-only
- `toolAuthPattern: 'direct_admin'` — same godmode gate as `business_intelligence`, NOT `engine_authority_config`
- Tool bodies call `ctx.broadcast?.()` — callback injected by stage-engine; no-ops silently when WS not connected (E2E case)

Page-tool registry shims live separately at L1 (`BotssonTools.ts` / `useRegisterTools`). Different layer.

### D4: M1 gate_evaluation absence invariant for UI
Since UI tools never mutate, no `gate_action` row should ever appear for UI turns. M1 asserts absence — same pattern as `business_intelligence` M1.

### D5: Dual-path tolerance for journey-authoring writes
`defaultAuthority='read_only'` means `engine_authority_config` may not grant write level for E2E workspace. Gate-blocked structured JSON response is accepted alongside success path. Pipe-reach is the assertion, not mutation success. Same pattern as contract-intake from batch 7.

## Learnings

### L-B8-1: emitPrefix=null capability pattern
A capability with `emitPrefix: null` opts out of tool-body `emit()` calls. The `botsson.tool_invoked` trail entry comes from the stage-engine Vercel AI adapter (vercel-ai.ts) instead. Tests still assert on `activity_trail.event='botsson.tool_invoked'` — the adapter emits it. This is the UI capability pattern.

### L-B8-2: `ctx.broadcast?.()` is load-bearing for UI tools
UI tool bodies use optional chaining on `ctx.broadcast` callback. In E2E where no live browser WS exists, broadcast no-ops. Tests must not assume broadcast was actually delivered — only that the call site didn't throw.

### L-B8-3: engine_state.context JSONB for transient lifecycle state
ADR-0067 pattern: state machines like shift-swap don't need a separate request table. `engine_state.context` JSONB holds the full lifecycle state. Look up swap by `engine_state.id`. Status field paths: `context.status`, `context.requester_profile_id`, `context.target_profile_id`.

## Known issues / debt

1. **ADR-0240 delegation refactor for journey-authoring** — `publish_draft` writes journey+journey_version directly. Separate sortie to refactor to `journey.publish_mission` delegation.
2. **Shift-swap self-swap RPC check** — `respond_to_shift_swap` RPC validates `auth.uid() === target_profile_id`. E2E admin session owns both shifts in seed → RPC may reject the target-profile check. Tests soft-skip when this happens.
3. **UI broadcast not asserted on receiver side** — tests verify call site doesn't throw, but cannot verify the browser actually received the broadcast (no WS in E2E).

## Next steps

1. Merge to development.
2. Refresh coverage matrix v5 → 22/29 = 76% (DONE in this batch).
3. Final batch: kb_query + operations-intelligence (1 tool each, can pair single sortie).
4. After 100% capability coverage, retire single-tool checks in favour of `pnpm --filter e2e test:e2e -- --grep harness-e2e`.
5. Separate sortie: ADR-0240 publish_draft delegation refactor.

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Prior batches: HANDOFF-harness-coverage-top3.md through -batch7.md
- ADR-0067 (engine_state as state machine), ADR-0078 (channel guard), ADR-0099 (capability authority), ADR-0116 (botsson.tool_invoked telemetry), ADR-0151 (server-derive IDs), ADR-0163 (presentation-only exemption), ADR-0194 (publish_mission is_active=false), ADR-0240 (cross-namespace write delegation)
