---
title: "Journey — 9 Lovsen telemetry events registered + emit() routes correctly"
feature: lovsen-foundation
journey: telemetry-events-registered
status: verified
verified_at: 2026-04-29T04:50+02:00
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, telemetry, dev-acceptance, p1-s0]
---

# Journey: 9 Lovsen telemetry events registered + emit() routes correctly

**Role:** developer (downstream P1.S1a-S4 sub-sortie author)

**Precondition:**
- `packages/telemetry/src/registry.ts` exists and is the single source of truth for telemetry events
- No `lovsen.*` events registered yet
- Test infrastructure (vitest) for telemetry pkg works

## Happy Path

1. Developer opens `packages/telemetry/src/registry.ts` → finds 9 new entries with `category: 'lovsen'`:
   1. `lovsen.query.received`
   2. `lovsen.query.classified`
   3. `lovsen.skill.invoked`
   4. `lovsen.mcp.fetch`
   5. `lovsen.mcp.fetch.completed`
   6. `lovsen.mcp.fetch.failed`
   7. `lovsen.answer.composed`
   8. `lovsen.confidence.degraded`
   9. `lovsen.citation.stale`
2. Each entry has Zod schema for payload + destinations `['posthog','log','activity_trail']`
3. Developer runs `pnpm --filter @smartout/telemetry test` → registry tests pass for all 9 names
4. Developer calls `emit('lovsen.query.received', { workspace_id: 'w_x', actor_id: 'a_y', query: 'aml § 14-6' })` from a smoke-test → call returns without throwing
5. Logger destination shows the event (stdout in dev); PostHog mock receives it; activity_trail row written (verified via test fake)
6. Developer calls `emit('lovsen.query.received', { actor_id: '' })` → emit throws (non-empty-string guard from existing `non-empty-string.ts`)

**Postcondition:**
- 9 `lovsen.*` events live in registry with locked Zod schemas
- emit() routes each to PostHog + log + activity_trail (no `engine_event` yet — that's P1.S4 capability scope)
- Downstream sub-sorties can `emit('lovsen.…', payload)` without registering anything new

## Error Paths

- **Scenario:** Schema for `lovsen.confidence.degraded` rejects `score: 0` (treated as missing) → use `z.number().min(0).max(1)`, not `z.number().positive()` → fix: relax to `min(0)`
- **Scenario:** `emit()` silently drops event because category lacks routing wiring → check `packages/telemetry/src/emit.ts` reads the registry's `destinations` field, not a hard-coded category list → fix: ensure routing is registry-driven (already true per ADR-0004); if not, file blocker
- **Scenario:** `actor_id: ''` slips through → `non-empty-string.ts` guard not applied to lovsen schemas → fix: use `nonEmptyString` helper for `actor_id` + `workspace_id`

## Verification

- [x] Implementation matches the steps above
- [x] All 9 events present in `registry.ts` with `category: 'lovsen'`
- [x] `pnpm --filter @smartout/telemetry test` exits 0 (327 tests total, 48 new lovsen tests)
- [x] Smoke test: lovsen-events.test.ts §4 emit smoke calls logToStdout mock and asserts it received lovsen.query.received
- [x] Manually tested: nonEmpty('', 'actor_id') throws in test env — verified by lovsen-events.test.ts §3

**Mark `status: verified` in frontmatter when all five boxes are checked.**
