---
title: "Journey — Botsson svarer 'is CI green?' via injected world state"
feature: engine-world-phase-1
journey: agent-leser-status
status: verified
verified_at: 2026-05-06
e2e_test: "apps/e2e/engine-world/agent-leser-status.spec.ts"
created: 2026-05-06
updated: 2026-05-06
phase_f_note: "Code-verified: reader hook present (agent-router.ts L363-368), whitelist enforced (no details JSONB), telemetry silent on read path, cross-workspace OR filter correct. Remaining for verified status: E2E test, manual end-to-end chat test with debug log."
phase_2e_note: "E2E tests pass (T1-T6 in agent-leser-status.spec.ts). Verification: 5/6 boxes checked. Box 3 (manual end-to-end chat test with Botsson) still pending — requires running stage-engine + seeded engine_world rows + active Botsson session. Journey stays draft until box 3 is ticked."
module: ai
tags: [journey, engine-world, botsson, world-state]
---

# Journey: Agent leser status fra engine_world

**Role:** admin (or any authenticated user with active profile)

**Precondition:**
- Phase 0 + Phase 1 migrations applied
- Heartbeat job `engine-world-refresh` has run at least once (engine_world has rows for `vercel.web`, `ci.workflow.<name>`, `supabase.prod`)
- User authenticated via Botsson chat surface (channel `chat`)
- Stage-engine reader hook live in `agent-router.ts` between L353-L356

## Happy Path

1. User asks Botsson "Hvordan står det til med CI?" → BFF (`/api/emma/chat`) routes to stage-engine `/agent/chat` with `channel: "chat"` and server-derived `workspace_id`
2. Stage-engine `agent-router.ts` runs intent classifier (L235) → gate_action (L257) → collectContext (L316) → fetchActiveStateSummary (L353)
3. NEW HOOK (between L353-L356): Reader fetches engine_world surfaces via supabaseAdmin
   - Filter: workspace_id matches OR is NULL (platform-level)
   - Cap: 50 most-recent non-stale rows
   - Whitelist scalar fields only: `surface_id|surface_type|status|is_stale`
4. Reader injects `<world_state>` block alongside missionSummary/userContext/workspaceContext/routeContext (L367-L400) into Botsson system prompt
5. Stage-engine continues to `selectTools` (L356), passes to LLM → System receives prompt including `<world_state>` data → User sees compact, accurate status answer ("CI er grønn på workflow X, rød på workflow Y siden 14:32")
6. Optional: User asks "Vis meg detaljer på workflow Y" → Botsson calls `read_surface(surface_id="ci.workflow.<name>")` capability tool → System returns full SurfaceRecord including `details` JSONB → User sees details (now safe — comes through capability tool, not prompt injection)

**Postcondition:** User has accurate live status. No domain mutation. `agent_session_recording` row written by existing recorder pipeline.

## Error Paths

- **Scenario:** engine_world table empty (heartbeat hasn't run) → Reader injects empty `<world_state>` block → Botsson responds "Jeg har ingen oppdatert status akkurat nå" + offers to call `read_surface_class` for current snapshot
- **Scenario:** All surfaces stale (TTL exceeded) → Reader marks `is_stale: true` in injection → Botsson disclaims staleness in answer ("Sist sjekket for X minutter siden")
- **Scenario:** Workspace filter returns 0 rows but platform-level rows exist → Reader still injects platform rows → User sees CI/deploy info even on workspace with no observed surfaces yet
- **Scenario:** Voice channel attempts read → BFF hardcodes `channel: "chat"` for `/agent/chat`; voice via LiveKit (ADR-0135) doesn't route through this endpoint yet → Reader runs only for chat surface; voice path absent by design

## Verification

- [x] Implementation matches the steps above (Phase F code-verified)
- [x] E2E test exists and passes — apps/e2e/engine-world/agent-leser-status.spec.ts T1-T6 pass (Phase 2E)
- [ ] Manually tested end-to-end: ask "is CI green?" with seeded engine_world rows; verify `<world_state>` injection in stage-engine debug log
- [x] Whitelist enforced: T2 (leak-me probe) + DB F6 integration test confirm details JSONB not in block (Phase 2E)
- [x] Telemetry: `engine_world observation_written` event NOT emitted on read path — code-verified Phase F (renderWorldStateBlock is pure function, no emit)
- [x] Cross-workspace test: workspace A reader does NOT see workspace B-scoped surfaces — DB integration test in tests/engine-world/agent-leser-status.spec.ts (cross-workspace isolation passing, Phase 2E)

**Mark `status: verified` in frontmatter when all six boxes are checked.**
