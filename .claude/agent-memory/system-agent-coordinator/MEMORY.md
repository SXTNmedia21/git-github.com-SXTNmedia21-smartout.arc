# Engine Architect Memory

## Onboarding "Lise" Flow (traced 2026-03-04)

See [onboarding-flow-trace.md](./onboarding-flow-trace.md) for full request path and blocking issues.

- Voice-only via Ultravox (NOT text chat)
- Frontend: `useBotsson.ts` -> `/api/wizard/start` -> Stage Engine `/adapters/ultravox/create-call`
- Three blockers: wrong STAGE_ENGINE_URL port (3070 vs 5010), empty platform_api_key table, Docker SUPABASE_URL can't reach host (127.0.0.1 vs host.docker.internal)

## CRITICAL: Startup Blocker (confirmed 2026-03-20)

See [startup-blockers.md](./startup-blockers.md) for full details.
**Stage Engine cannot start** due to ESM/CJS module mismatch. `@smartout/types` and `@smartout/ai` lack `"type": "module"` in package.json. Their dist uses ESM syntax (bare re-exports like `export * from "./enums"`) without `.js` extensions. Stage-engine uses `NodeNext` resolution which requires fully-qualified `.js` extensions. Node throws `ERR_MODULE_NOT_FOUND` immediately on startup.
Fix options: (a) Add `"type": "module"` to both packages, (b) Switch packages to `NodeNext` tsconfig so they emit `.js` extensions, (c) Switch stage-engine to bundler (esbuild/tsx dev works already).
Note: `tsc --noEmit` passes — this is a RUNTIME error only. tsx dev mode works (bypasses the issue).

## Database State (verified 2026-03-03)

- Supabase local: port 55331, DB port 55432
- Keys: use `npx supabase status -o env` to get ANON_KEY/SERVICE_ROLE_KEY (JWT format)
- `get_secret` RPC works (Vault has ultravox key)
- onboarding-interview mission: `system_prompt: NULL` (needs Lise's personality)
- Stage order 0 "onboarding-main" has `next_stage: null` (session gets stuck)
- 1 agent_profile exists (seed workspace)

## Architecture Overview

- See `architecture.md` for full system map
- See `patterns.md` for code patterns and conventions
- See `database-schema.md` for engine table details

## Key File Paths

- Stage Engine entry: `services/stage-engine/src/index.ts` (Hono, port 3000)
- Agent router pipeline: `services/stage-engine/src/core/agent-router.ts`
- Agent session: `services/stage-engine/src/core/agent-session.ts`
- Stage manager: `services/stage-engine/src/core/stage-manager.ts`
- Memory manager: `services/stage-engine/src/core/memory-manager.ts`
- Authority: `services/stage-engine/src/core/authority.ts`
- Prompt builder (missions): `services/stage-engine/src/core/prompt-builder.ts`
- Relationship manager: `services/stage-engine/src/core/relationship-manager.ts`
- Chat route: `services/stage-engine/src/routes/agent/chat.ts`
- AI package root: `packages/ai/src/index.ts`
- Capability types: `packages/ai/src/capabilities/types.ts`
- Capability registry: `packages/ai/src/capabilities/registry.ts`
- Profile capability: `packages/ai/src/capabilities/profile/`
- Intent classifier: `packages/ai/src/router/intent-classifier.ts`
- Tool selector: `packages/ai/src/router/tool-selector.ts`
- Mr Botsson prompt: `packages/ai/src/prompts/mr-botsson.ts`
- Posture resolver: `packages/ai/src/prompts/posture.ts`
- Context collector: `packages/ai/src/context/collector.ts`
- Vercel AI adapter: `packages/ai/src/adapters/vercel-ai.ts`
- Mission registry: `packages/ai/src/missions/registry.ts`
- Ultravox call starter: `packages/ai/src/missions/ultravox.ts`
- Onboarding agent: `packages/ai/src/agents/onboarding.ts`
- Onboarding tools: `packages/ai/src/tools/onboarding.ts`
- Session context (legacy): `packages/ai/src/session-context.ts`
- Condition evaluator: `packages/ai/src/engine/condition-evaluator.ts`
- useBotsson hook: `apps/web/src/app/onboarding/hooks/useBotsson.ts`
- useOnboardingState: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts`
- Onboarding API route: `apps/web/src/app/api/onboarding-agent/route.ts`

## Two Parallel Systems

1. **Mission mode** (voice, Ultravox): engine_missions + engine_stages + engine_sessions. Sequential/free/hybrid stage navigation. System prompt built from stage definitions. Tools via Ultravox server-side tools pointing back to Stage Engine endpoints.
2. **Agent mode** (chat): engine_sessions with mode="agent", NULL mission_id. Pipeline: classify intent -> load authority -> collect context -> select tools -> build prompt -> LLM (generateText via OpenRouter/Anthropic).

## Current Onboarding = Voice-Only via Ultravox Client Tools

- Lise mission in `missions/registry.ts` with massive system prompt
- Client tools registered in `useBotsson.ts` (updateBusiness, updateSeason, addDepartments, triggerScrape, getOnboardingState, advanceToNextSection, addKeyFact, saveMemory)
- These are Ultravox `temporaryTool` with `client: {}` = executed in browser
- No Stage Engine stages for onboarding - it's a monolithic prompt with embedded flow
- `onboarding_session` table (separate from engine_sessions) tracks state

## Capability Registry State (verified 2026-04-13)

9 capabilities registered: profile, ui, guardian, schedule, operations, communication, contract, contract_intake, shift_swap.
12 CapabilityName values in types: knowledge, schedule, training, operations, profile, communication, memory, payroll, ui, guardian, contract, contract_intake, shift_swap.
**No `season` capability exists** — neither in CapabilityName type nor registry.
Intent classifier has 12 values + "general". No "season" in classifier enum.

## Season Tools — Orphaned (verified 2026-04-13)

5 tools in `packages/ai/src/tools/season/`: create_season, set_revenue, get_readiness, learn_factors, save_playbook.
Context type: `SeasonToolContext` (supabase, workspaceId, sessionId, collectedData?) — **INCOMPATIBLE** with `AgentToolContext` (supabaseAdmin, profileId, userId, channel, processId, engineStateId, actingOnBehalfOf).
These tools were built for mission mode (Stage Engine) not agent mode (chat). Wiring them into a capability requires refactoring to accept `AgentToolContext`.

## Calendar Guardian — Single Season Bug (verified 2026-04-13)

`calendar-guardian.ts` line 91-98: queries `season` table with `.limit(1).single()` filtering by `status IN ('draft','active')` ordered by `created_at DESC`. If multiple seasons exist (which the "max 1 active" policy should prevent), it picks the newest one. But: there's no enforcement of "max 1 active" at the DB level — the governance policy (ADR-0085) is UI-only. A race condition or direct DB insert could create two active seasons, and the guardian would only evaluate one.

## Page Tools Bridge Pattern (verified 2026-04-13)

Schedule page uses: `use-schedule-voice-tools.ts` hook → `ScheduleVoiceToolsBridge` component → `useRegisterTools("schedule", voiceTools)` from tool-registry.
Year Wheel has ZERO equivalent — no voice tools hook, no bridge component, no tool registration.
Tool registry is in `apps/web/src/app/Botsson/_components/tool-registry.ts`.

## Authority Levels

autonomous > confirm > suggest > read_only > disabled
Default is read_only when no config exists.

## Domain Process Engine (Separate from Agent)

Migration `20260304100000`: engine_process, engine_step, engine_trigger, engine_event, engine_state, engine_delayed_trigger. This is for domain processes (daily_close, onboarding_14d), NOT for AI conversations. Different from engine_missions.

## Stage Engine — Full Route Map (verified 2026-03-20)

- GET /health — public, no auth
- POST /sessions — start mission session
- GET /sessions/:id — get session status
- POST /sessions/:id/abandon
- POST /sessions/:id/store — agent stores data to inbox
- POST /sessions/:id/fetch — agent requests context/inbox/stage/history
- POST /sessions/:id/advance — advance to next stage
- POST /adapters/ultravox/create-call — creates Ultravox voice call
- POST /adapters/ultravox/store — Ultravox tool format
- POST /adapters/ultravox/fetch — Ultravox tool format
- POST /adapters/ultravox/advance — Ultravox new-stage format
- POST /agent/chat — agent mode conversations
- WS /ws/:sessionId — UI<->engine bidirectional
- WS /guardian/ws — admin dashboard monitoring

## Stage Engine — docker-compose (verified 2026-03-04)

- docker-compose.yml sets `PORT=5010`, override exposes `5010:5010`
- config.ts defaults to 5010. Health check correctly pings `localhost:5010/health`
- `ENGINE_URL=http://localhost:5010` in override — but this is wrong inside Docker (should be public URL or host.docker.internal)
- `infra/.env` -> symlink to `../.env.local`. Docker-compose picks up root .env.local vars
- SUPABASE_URL from .env.local = `http://127.0.0.1:54321` which is unreachable from inside Docker
- ULTRAVOX/OPENROUTER keys: Vault fails (can't reach Supabase), falls back to env vars (which DO exist in .env.local)

## context/collector.ts — profile column name mismatch

collector.ts selects `id, display_name` from profile table. But the actual profile table PK is `profile_id` (not `id`). Also uses `employee_id` on schedule_shift for active shift lookup — verify this column name is correct.

## Season Engine (completed 2026-03-06)

- Season-lifecycle mission: 8 stages (seed -> revenue -> concept -> staffing -> prepare -> ready -> running -> reflect)
- Calendar Guardian in `services/stage-engine/src/core/calendar-guardian.ts` auto-advances stages based on time rules
- Long-lived sessions: `expires_at = null` for season-lifecycle, skipped by cleanup job
- 5 season tools in `packages/ai/src/tools/season/` use `SeasonToolContext` (supabase + workspaceId pattern from JourneyToolContext)
- Season tables: `season` (season_type enum: default|calendar|focus|cycle|custom, season_status: draft|active|archived), `season_budget` (1:1), `day_factor` (weekday 0-6), `hour_factor` (hour 0-23)
- `protocol_assignment.status` enum: pending | completed | expired (NOT in_progress, NOT active, NOT complete)
- SeasonCard in StrategicView via `useActiveSeason` hook
- Seed data: `supabase/seed/season-mission.sql`

## Capability Tools Audit Findings (2026-05-18 Slice 01)

37 tools.ts files traced. Key findings:
- **M-001** `billing-query/tools.ts:270` — `get_usage_snapshot` accepts body-supplied `workspace_id`, violates ADR-0151. Fix: use `ctx.workspaceId` instead.
- **M-002** `payroll/tools.ts` — `adjust_timebank_balance` (line 1104) + `force_timebank_payout` (line 1186): callGateAction then direct INSERT outside gatedMutation (ADR-0204 gap). Multiple payroll tools follow this "gate-then-direct" convention — needs ADR amendment.
- **M-003** `shift-lifecycle/tools.ts` — `publish_shift` (line 177) + `approve_shift` (line 350): callGateAction then direct update outside gatedMutation (same class as M-002).
- **M-004** `timeline-template/tools.ts:318-346` — `apply_template` inserts `session_hook` rows directly without delegating to an owning capability tool (ADR-0173 gap).
- **Smoke run journey-authoring:483-509 NOT confirmed**: publish_draft dual-namespace writes ARE inside gatedMutation. PASS.
- **Pattern insight**: "callGateAction + direct write" used across payroll/shift-lifecycle/operations/day-line/task — consistent per-capability convention but not ADR-0204 compliant. Needs cross-cutting ADR amendment.
- Audit output: `docs/audits/2026-05-18-adr-contract-validation-02/01-capability-tools.md`

## Tool Context Patterns

- **SessionContext** (`session-context.ts`): wraps `onboarding_session` table. Used by onboarding tools only.
- **JourneyToolContext**: `{ supabase, workspaceId, sessionId, currentPhase, draftJourney }`. Pattern for DB-backed tools.
- **SeasonToolContext**: `{ supabase, workspaceId, sessionId, collectedData? }`. Follows JourneyToolContext pattern.
- Tools return strings. The LLM gets the string as tool result text.
- Each tool set has a barrel export pattern: individual exports + `TOOLS` array cast to `SmartoutTool<Context>`.
