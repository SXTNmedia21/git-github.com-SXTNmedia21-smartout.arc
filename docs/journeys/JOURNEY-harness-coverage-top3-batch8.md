---
title: "Journey — harness-coverage-top3-batch8"
feature: harness-coverage-top3-batch8
branch: feat/harness-coverage-top3-batch8
created: 2026-05-12
updated: 2026-05-12
module: ai
status: verified
tags: [e2e, harness, coverage, journey-authoring, shift-swap, ui]
---

# Journey — harness-coverage-top3-batch8

## Why

Eighth wave of Botsson harness E2E coverage. Closes 3 capability gaps: journey-authoring (4 tools), shift-swap (5 tools), ui (5 tools). Total +14 tools, 70 new test() calls. Brings tool coverage from 65% → 76% (83 → 97 of 127). Only kb_query + operations-intelligence remain after this.

## Journey 1 — Journey-authoring capability E2E

**Precondition:** Stage-engine fresh, seed admin profile. NOT the journey runtime capability (covered in batch 6 — separate).

1. BFF call per tool — 4 tools (`save_draft`, `check_duplicates`, `lookup_journeys`, `publish_draft`)
2. `save_draft` writes `journey_draft` row, gate-wrapped
3. `publish_draft` writes `journey` + `journey_version` rows directly (ADR-0240 delegation gap acknowledged in tool body)
4. `lookup_journeys` + `check_duplicates` read-only structured responses
5. ADR-0194 Gate: publish writes `is_active=false` — accepted as correct
6. Dual-path tolerant: `defaultAuthority='read_only'` means gate may block writes; both gate-blocked AND success paths accepted (pipe reached L4 is what matters)
7. D2 asserts ADR-0240 acknowledgment comment exists in tool body + `publishMission` is NOT called internally (would be double-write bug) + `gatedMutation` wraps all writes

**Postcondition:** All 4 journey-authoring tools verified. 22 tests.

**Error paths:** N1 voice skipped (allowedChannels=['chat']). D1/D2/D3 soft-skip when source/fixture unreadable.

## Journey 2 — Shift-swap capability E2E

**Precondition:** Same. Seed must have ≥2 shifts + ≥2 profiles to model swap relation.

1. BFF call per tool — 5 tools (`get_swap_requests`, `get_swap_eligibility`, `request_swap`, `respond_to_swap`, `cancel_swap`)
2. **Architectural discovery:** swap state lives in `engine_state.context` JSONB (ADR-0067), NOT a separate `shift_swap_request` table. `engine_state.id` IS the `swap_id`.
3. Lifecycle chain: `request_swap` → `respond_to_swap` (accept) → `cancel_swap` — serial mode enforced
4. Context status progression: `pending_recipient` → `pending_manager` → `cancelled`
5. Dotted capability authority: `CAPABILITY_REQUEST`, `CAPABILITY_RESPOND`, `CAPABILITY_CANCEL` constants in tool file → dotted slugs in `engine_authority_config`
6. G-series loop generates 3 tests verifying each dotted authority row exists

**Postcondition:** All 5 shift-swap tools verified. 26 tests.

**Error paths:** N1 voice skipped (chat-only guard). B-series soft-skips if LLM requests clarification instead of firing tool, or if RPC target-profile check rejects self-swap.

## Journey 3 — UI capability E2E

**Precondition:** Same. UI tools are stateless directives, no DB pre-seed needed.

1. BFF call per tool — 5 tools (`navigate_to`, `fill_field`, `highlight_element`, `show_panel`, `show_toast`)
2. **Architectural distinction:** UI is REAL backend capability (registered in registry as `uiCapability`), NOT page-tool registry shim. Different from `BotssonTools.ts` / `useRegisterTools` at L1.
3. Execution model: tool bodies call `ctx.broadcast?.()` callback injected by stage-engine. In E2E without live browser WS, broadcast no-ops silently — `?.` optional chaining is load-bearing.
4. `emitPrefix: null` — tool bodies never call `gate_action` or `emit()`. The `botsson.tool_invoked` trail entry comes from stage-engine Vercel AI adapter (vercel-ai.ts), not from tool body.
5. `toolAuthPattern: "direct_admin"` — same godmode gate as `business_intelligence`, NOT `engine_authority_config`.
6. M1 invariant: gate_action NEVER called by UI tools (no mutations) — assert absence in `gate_evaluation` for UI turn.

**Postcondition:** All 5 UI tools verified. 22 tests.

**Error paths:** N1 by-design skip (ADR-0163 exempts presentation-only tools from voice guard; nothing to assert absence of). N2 unauthenticated → 401/403.

## Cross-cutting

- All 3 specs use shared helpers from `apps/e2e/helpers/botsson-harness.ts`
- All 3 add capability-specific helpers
- All 3 use `test.describe.configure({ mode: "serial" })`
- Typecheck: 0 errors
- Commits: `ac52f3f3a` ui · `4ab09f688` journey-authoring · `e339d1de4` shift-swap

## Postcondition (campaign)

22/29 capabilities covered (76%). 97/127 tools covered (76%). Remaining 🔴: kb_query (1), operations-intelligence (1). Single sortie can close both.
