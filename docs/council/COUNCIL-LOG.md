---
title: Council Session Log
status: in_progress
updated: 2026-04-07
created: 2026-03-26
module: governance
tags: [council, decisions, multi-agent, review]
---

# Council Session Log

Tracks all System Council sessions — multi-agent review meetings where specs, plans, bugs, and architectural decisions are reviewed by the full agent team.

## Sessions

| Date       | Topic                                 | Type         | Verdict                  | Agents Consulted                                          | ADR                                                                               | Learning                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------- | ------------ | ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-26 | Mobile Production Readiness v1.0      | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None (per-role authority ADR deferred to v1.1)                                    | Authority default mismatch: tool-selector.ts=read_only vs agent-router.ts=suggest. Ultravox client tools cannot be wrapped as SmartoutTools.                                                                                                                                                                                           |
| 2026-03-27 | Onboarding Route Code Review          | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR 13-18 in decision log                                                         | See decision log for full list. Key learning: pre-auth API calls fail silently.                                                                                                                                                                                                                                                        |
| 2026-03-27 | Invitation Flow E2E Audit             | feature      | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: RLS policy ADR, existing-user acceptance ADR                             | `USING (true)` RLS is never safe for PII tables. Trainee status was a no-op. Batch mode silent on dispatch.                                                                                                                                                                                                                            |
| 2026-03-27 | Invitation Core Fixes Spec Review     | spec         | APPROVE WITH CHANGES     | steward, supervisor                                       | None                                                                              | RPC must limit PII to pending invitations. Simplify existing-user to password-only (defer magic link). Migration+page must deploy together.                                                                                                                                                                                            |
| 2026-03-26 | Migration Ordering & Idempotency      | bug          | APPROVE WITH CHANGES     | steward, supervisor                                       | None                                                                              | `CREATE TABLE IF NOT EXISTS` silently ignores FK differences (CASCADE lost). Follow-up migration required. Timestamp collisions from parallel branches.                                                                                                                                                                                |
| 2026-03-27 | Notification System Fixes (8-Fix)     | bug          | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator                    | Pending: Notification Outbox Architecture ADR                                     | Engine templates invisible to registry (different namespace). Recipient resolution is a feature, not a detail. Outbox RLS `WITH CHECK (TRUE)` is never safe.                                                                                                                                                                           |
| 2026-03-27 | Profile Schema Mismatch Audit         | bug          | APPROVE WITH CHANGES     | steward, supervisor                                       | None (CLAUDE.md trap added)                                                       | `profile` has `display_name` only, not `first_name`/`last_name`. 4 broken queries found (leader-pulse, session-manager x2, list-data-sources) + 2 guardian-bus downstream. 20 files confirmed OK. Data model is correct — identity layer vs D2 workspace layer.                                                                        |
| 2026-03-28 | Wizard Routing Architecture           | architecture | APPROVE                  | steward, supervisor, agent-coordinator, frontend-designer | None (ADR-0060 already covers)                                                    | Per-route pages win over dynamic `/wizard/[id]`. Auth boundaries (public/auth/auth+workspace) prevent unification. TypeScript generics collapse in dynamic routes. Page files are 16-34 lines — no meaningful DRY gain.                                                                                                                |
| 2026-03-28 | Setup Wizard Shell Migration          | spec         | APPROVE WITH CONDITIONS  | steward, supervisor, agent-coordinator, frontend-designer | Pending: Wizard Shell Completion Contract ADR                                     | `loadState` declared in WizardDefinition type but never called by `useWizardState` — dead code across all 3 wizards. BotsTip contains regulatory content (tariffs, Mattilsynet) — not cosmetic. Step headers rendered by legacy shell, not step components — silent regression risk.                                                   |
| 2026-03-28 | Communications Stack Architecture     | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR-0063: Comms consolidation                                                     | Komm canonical, Chat frozen. 3 telemetry gaps (reactions, read, mute). queueMicrotask anti-pattern in CallRoom. 4x MessageBubble maintenance problem. AI integration gap (no ai_assistant channel type yet).                                                                                                                           |
| 2026-03-28 | Chat→Komm Migration + i18n Sweep      | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-explorer | ADR-0063 amendment pending                                                        | Parallel table systems create hidden coupling through AI tools, mobile hooks, telemetry that survives UI deletion. ~90 hardcoded strings (3x initial estimate). Two tool sets for same domain (communication/ + channels.ts) — only one registered. useShiftChat blind spot in both web+mobile.                                        |
| 2026-03-28 | Dynamic Landing Engine Spec           | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: ADR-0057 (supersedes ADR-0046), ADR-0058 (conditional GSAP)              | ADR-0046 block-builder silently superseded without declaration. Landing engine must be I1 consumer, not standalone data source. 300ms crossfade violates motion.md (500ms min entrance). GSAP/Framer transform boundary must be explicit. 7 landing tables in DB undocumented in DATABASE.md.                                          |
| 2026-03-28 | Drift Insights Branch Review          | feature      | APPROVE WITH CHANGES     | steward, supervisor, frontend-designer                    | None                                                                              | i18n interpolation convention mismatch (`{x}` vs `{{x}}`) fails silently — no runtime error. Shared index files (decision log, learning log) must never be overwritten in feature branches. Hardcoded colors bypass OKLCH warm hue-shifting in dark mode.                                                                              |
| 2026-03-28 | Entity Drawer Post-Implementation     | feature      | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | 4 blockers fixed: actor_id audit trail, hardcoded strings, pin/localStorage drift, dead ref. 31 hardcoded colors flagged for follow-up. WCAG AA contrast gap on inactive tabs. Missing focus trap in sheet mode. EntityDrawerProvider isolation pattern should get ADR.                                                                |
| 2026-03-29 | Protocol Verification Engine          | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR-0071                                                                          | Two mission systems (AgentMission/Ultravox vs engine_missions/Stage Engine) — generator must target DB schema. JSONB on existing table beats new table. Spring animations need 1500ms settle. protocol.json rejected as dual source of truth — TypeScript definitions instead.                                                         |
| 2026-03-29 | PVE Operations + Dashboard + Agent    | architecture | APPROVE WITH CONDITIONS  | steward, supervisor, agent-coordinator, frontend-designer | None (extends ADR-0071)                                                           | Agent split: protocol-writer (observer) never touches apps/web/. Dashboard: local-only dev tool, dark theme, no Nordic Split. Manual: task-oriented not role-oriented. Testid fixes delegated via reports, not agent self-modification.                                                                                                |
| 2026-03-28 | Entity Drawer Phase 2 Design          | feature      | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR-0068: Entity Drawer Surface Pattern                                           | Shift P1 > profile P2 > session P3 > team P4. Read-only only. Declarative registry. Agent bridge via WalkAi client tool. Fix debt (colors, focus trap, touch targets) IN Phase 2. day_session renamed to department_session. Drawer != schedule drawers (lightweight vs deep).                                                         |
| 2026-03-28 | Entity Drawer Phase 2 Plan Review     | plan         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | 3 blockers found: employment_contract wrong columns (contract_type→employment_category, is_active→status), CascadeTaskTab/DepartmentDetailTab props not renamed to entityId, agent bridge dead (CustomEvent→WalkAi client tool fix). All resolved during implementation.                                                               |
| 2026-03-28 | Telegram WalkAi Adapter               | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator                    | Pending: ADR-0059 (platform-admin pipeline separation)                            | Nullable DB column != nullable pipeline — TypeScript types form independent enforcement chain. Admin pipeline must be separate from employee pipeline (different authority, intent, tools). PG NOTIFY > Realtime for server-side relay. callback_data 64-byte limit requires lookup table.                                             |
| 2026-03-28 | Telegram Adapter Post-Impl            | feature      | REJECT → Fixed           | steward, supervisor, agent-coordinator                    | ADR-0059 written                                                                  | 6 column name mismatches between migration and code — subagent implementers drifted from schema. emitGuardianEvent != emit() (wrong telemetry system). Tests mock Supabase so column bugs invisible. Post-impl council is essential for adapter code.                                                                                  |
| 2026-03-28 | Cascade Tasks Production Readiness    | bug          | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | incomplete_training CTE caught zero-touch only, not partial. workspace_operating_hours is legit 4th hours table (needs CLAUDE.md update). Hardcoded colors/Norwegian/any-casts all fixed. messages group should be C4 not C2 (P2). dept_summary done/total misleading (P1).                                                            |
| 2026-03-28 | Dashboard + HMS/Drift Prod Ready      | feature      | NOT READY FOR PRODUCTION | steward, supervisor, agent-coordinator, frontend-designer | Pending: Edge Function vs Engine execution ownership ADR                          | Session lifecycle broken (signoff bypasses pending_signoff). Dual execution paths (cron EF + engine) = split-brain risk. Notification pipeline dead (hooks never fire). Fake stubs worse than missing features. Agent ops tools bypass emit(). 10 HMS files hardcoded Norwegian + stripped diacritics.                                 |
| 2026-03-28 | WizardShell + WalkAi Integration      | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Emma-Wizard Bridge ADR (supersedes ADR-0049 for wizard tools)            | Stale closures in useRegisterTools — always use refs. WalkAiProvider only in DashboardShell — onboarding needs it. WizardContext.tsx has 15 consumers, not 5. CustomEvent in packages/ui breaks React Native compat — use callback prop. Client tools have no C4 authority gating (by design).                                         |
| 2026-03-29 | Auth Security & Friction              | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Rate-limit fail-closed ADR                                               | `workspace.status` column doesn't exist — spec built on sand. `email_verified` belongs on auth.users not workspace. Engine FK missing CASCADE = cleanup cron failure. Stage Engine bypasses RLS via service_role — sandbox gates must be middleware, not RLS. Telemetry must use entity-verb format, not dot-notation.                 |
| 2026-03-28 | WizardShell + WalkAi Plan Review      | plan         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | WalkAiProvider crashes outside DashboardShell (useEntityDrawer hard dep). Context bridge useState without sendContext is dead code. Nav tool no-ops mislead Emma. completedSteps Set new ref each render. emit() may be server-only. AnimatePresence mode="wait" creates tool gap. ARIA live region V1.                                |
| 2026-03-28 | Mobile Group Call Expanded UI         | spec         | PASS WITH CONDITIONS     | steward, supervisor, frontend-designer                    | None                                                                              | CallSession type missing videoPolicy (lives on channel table). LiveKit canPublish is coarse (one boolean) — UI enforces audio/video split. RTCView import path needs verification. Speaker glow must be spring-driven not CSS keyframe. Grid-to-focus needs shared-element animation. Reduced motion check mandatory.                  |
| 2026-03-28 | Mobile Group Call Plan Review         | plan         | REJECT → Fixed           | steward, supervisor, frontend-designer                    | None                                                                              | 3 compile blockers: useTranslation doesn't exist in mobile (use constants/strings.ts), caption2/title3 typography variants don't exist (use micro/headline), CallSheet bypassed BottomSheet wrapper. Also: VideoPolicy type orphaned (moved to call-types.ts), headerLeft.color invalid ViewStyle, emit() empty actor_id.              |
| 2026-03-28 | Mobile Group Call Post-Impl           | feature      | ACCEPT WITH FIX          | steward, supervisor                                       | None                                                                              | CallBar had 5 hardcoded Norwegian strings not migrated to strings.call (fixed). useLiveKitCall.connect() doesn't enable camera for default_on/required videoPolicy (follow-up). No emit() in components (parent handles). Hardcoded hex colors logged as debt. Frontend-designer couldn't access wt-2 (worktree isolation).            |
| 2026-03-29 | Interactive Dashboard Redesign        | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | session_task resolution, broadcast channel, telemetry, ADR-0068 mutation boundary | session_task.department_session_id NOT NULL blocks inline task creation in Prep mode — resolved via active/upcoming session lookup. Broadcast uses news channel_type. Spring constants were 3-10x too high. prefers-reduced-motion was missing. Entity drawer must remain read-only (ADR-0068). Feature flag recommended for rollback. |
| 2026-03-29 | Reconciliation "Stilling" Data Fix    | bug          | APPROVE WITH CHANGES     | steward, supervisor, frontend-designer                    | None                                                                              | `schedule_shift.role` (D6) != `position.name` (D2) — different dimensions, not interchangeable. Added `positionName` as new field, kept `role` unchanged. Employee name was null due to missing profile join. ~15 hardcoded Norwegian strings + `#6366f1` fallback flagged as polish-pass debt.                                        |
| 2026-04-06 | Code Review: mobile-prod + prod-gaps  | code review  | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Migration Safety ADR                                                     | DROP TABLE CASCADE in migrations = silent data destruction. supabaseAdmin:unknown forces unsafe casts across all agent tools. sendMessage only mutation tool without emit(). indigo-500 is cold-spectrum (hue ~240) in warm-only OKLCH system. Agent tools bypass RLS by design — every query MUST include manual .eq(workspace_id).   |
| 2026-04-06 | Full Plan Portfolio Review (11 plans) | plan         | MIXED (see below)        | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | See details below                                                                                                                                                                                                                                                                                                                      |
| 2026-04-06 | Journey Inference as Agent Harness    | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Mobile Telemetry Offline Emit ADR, Journey Progress via Domain Process Engine ADR | 5 breaks verified: 12/12 mobile hooks 0 emit(), no runtime journey tracking, two journey systems, Guardian AI-only, rescue unwired. Rescue≠Re-engagement (two-tier model). Journey DB tables are dev-tracking artifacts (never repurpose). All orchestration via engine_process. |

### 2026-04-06 — Full Plan Portfolio Review

**Type:** plan
**Scope:** All 11 remaining plans in `docs/superpowers/plans/`
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer (3 batches, 11 parallel agents)

#### Verdicts

| Plan                           | Verdict                 | Key Finding                                                                                                                                                                                                                               |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| telemetry-botsson-reactive     | **DO NOT MERGE**        | `workspace_setup` engine_process has 9 `wait_for_event` steps depending on `wizard.step_completed` in `engine_event`. Branch removes this routing → setup wizard hangs forever. Fix: keep engine_event routing or migrate engine_process. |
| telegram-walkai-adapter        | **DO NOT MERGE**        | Duplicate migration `20260328180000` already on development → `table already exists` failure. Branch stale: merge would delete 19+ telemetry events (auth OTP, security, enrichment). Fix: rebase on development.                         |
| invitation-flow-core-fixes     | APPROVE WITH CONDITIONS | Security fix (USING(true) → RPC). Missing emit() calls, hardcoded colors/Norwegian.                                                                                                                                                       |
| sjohuset-simulator             | APPROVE WITH CONDITIONS | Missing cascade proof tests, cleanup failure recovery, provenance on seeded data. ADR-0068 approved.                                                                                                                                      |
| protocol-verification-engine   | APPROVE WITH CONDITIONS | Skip Task 4 (migration already exists). Throw on missing service role key.                                                                                                                                                                |
| protocol-monitor-dashboard     | APPROVE                 | Fix RESULTS_BASE path. Execute after protocol engine.                                                                                                                                                                                     |
| developer-tooling-optimization | APPROVE WITH CONDITIONS | Keep "Critical Traps" and "What NOT To Do" in CLAUDE.md — only move reference material to skills.                                                                                                                                         |
| infra-prod-alignment           | APPROVE WITH CONDITIONS | **CRITICAL: Droplet path wrong** (`/opt/smartout/` → `~/dev/smartout.ai/`). Mark Tasks 1-2 done.                                                                                                                                          |
| module-zero-completion         | APPROVE WITH CONDITIONS | Split: WS-1 done → archive, WS-2 → new plan, WS-3 → backlog. Fix pg_cron violations.                                                                                                                                                      |
| deployment-pipeline            | APPROVE WITH CONDITIONS | Tasks 8-9 are Pontus-only (main branch). Verify 86 index count.                                                                                                                                                                           |
| swipe-task-review              | **REJECT**              | ALL `walkAi/` paths wrong → renamed to `Botsson/`. `useWalkAi()` doesn't exist → `useBotsson()`. `viewActionsRef` not exported. Full rewrite needed.                                                                                      |

#### Key Learnings

1. **Unmerged branches rot fast.** Both merge-ready branches (telemetry, telegram) had critical blockers discovered only through verification. Stale branches accumulate migration conflicts and telemetry regressions.
2. **engine_process event dependencies are invisible.** The `workspace_setup` process depends on wizard events routed to `engine_event`, but this dependency is only visible in SQL seed data — not in TypeScript code. Need a dependency map for engine_process triggers.
3. **Directory renames break plans silently.** The `walkAi` → `Botsson` rename invalidated an entire plan without any automated detection.
4. **Droplet path discrepancy** (`/opt/smartout/` in plan vs `~/dev/smartout.ai/` in reality) would have caused all SSH commands to fail. Memory files caught this.
5. **CLAUDE.md safety rails must stay always-loaded.** Multiple agents independently flagged that moving "Critical Traps" and "What NOT To Do" to on-demand skills creates a blind spot when skills aren't triggered.

## 2026-04-07 — Mobile Employee Login + Shifts E2E
**Type:** feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor
**Key decision:** Workspace store (Zustand + MMKV) for multi-workspace profile selection — follows existing use-theme-store pattern.
**ADR created:** none (follows existing patterns)
**Learning created:** none

**What was reviewed:**
- 2 journey documents (JOURNEY-mobile-employee-login.md, JOURNEY-mobile-shifts-overview.md)
- 3 code fixes: password reset handler, signup link wiring, workspace store for profile selection
- 6 files changed across auth flow + data hooks

**Critical finding (both agents independently):** workspace-select.tsx was reverted by linter during review — orchestrator fixed atomically with full Write.

**Follow-ups identified:**
1. Add `workspace_id` filter to shift query (defense-in-depth)
2. Add `emit()` for workspace selection (telemetry convention)
3. Fix push token registration for multi-workspace
4. Add stale-profile guard in hooks
5. i18n for hardcoded Norwegian strings (pre-existing debt)

## 2026-04-07 — Mobile Auth+Shift Bug Triage (15 bugs)
**Type:** bug
**Verdict:** APPROVE WITH CHANGES (fix 2, log 10, drop 3)
**Agents consulted:** system-steward, supervisor
**Key decision:** B1 (cache key mismatch) is OUR bug — fixed. B2 (.single() crash) pre-existing but trivial — fixed. B3-B12 pre-existing — logged. B4, B5, B13, B15 are false positives.
**ADR created:** none (B3 code-flow needs future ADR)
**Learning created:** none

**Bugs fixed this session:**
- B1: `[id].tsx:161` optimistic update cache key → `["my-shifts", selectedProfileId]`
- B2: `use-my-profile.ts:64` → `.maybeSingle()` + null handling

**Pre-existing bugs logged (10):**
- B3 (CRITICAL): Code entry flow never creates profile — dead end
- B6 (HIGH): Google OAuth callback not handled on native
- B7 (LOW): Realtime dead on pending (polling compensates)
- B8 (MEDIUM): No rejection feedback on pending
- B9 (MEDIUM): Push token for wrong workspace
- B10 (LOW): Google OAuth loading state resets instantly
- B11 (MEDIUM): Search flow silent fail on null company_id
- B12 (LOW): Wrong invite_type for search flow
- B14 (LOW): DEV_SHIFTS masks errors in dev mode

**False positives dropped (3):**
- B4: FK guarantees workspace exists for active profiles
- B5: PostgreSQL silently ignores PK in SET clause
- B13: Zustand function selectors are referentially stable
- B15: 5-min stale time is standard TanStack behavior

**Architectural findings:**
- Code-join path (B3) is an unfinished feature — needs design decision (code = authorization vs invitation)
- OAuth on native (B6) was never tested — no callback route exists

## 2026-04-06 — Journey Harness PoC Instruction Review
**Type:** spec
**Verdict:** APPROVE WITH CHANGES (5 amendments required, all incorporated)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator
**Key decision:** PoC scoped to web-only for v1 (mobile is Phase 2). Process uses `wait_for_event` step advancement, NOT second trigger. Stuck detection via dedicated Edge Function on pg_cron, not Stage Engine Guardian.
**ADR created:** none (learning logged instead)
**Learning created:** "Journey processes require entity-scoped payload + wait_for_event step advancement"

**What was reviewed:**
- `docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md`
- The PoC plan to prove the Journey Harness chain end-to-end for Journey 03 (Sjekke vakter)

**Convergent findings (3 agents independently identified):**
1. Mobile `emit()` path is broken for engine_event delivery (web-only)
2. Event name format (registry space form vs trigger dot form) was unspecified
3. Entity payload (`entity_type` + `entity_id`) not specified for engine_state creation
4. Step advancement mechanism (wait_for_event vs second trigger) was unspecified
5. Stuck detection runtime (pg_cron vs Edge Function) was vague

**Two agents flagged:**
- ActionVerb/SmartoutEvent type expansion needed in registry.ts
- `shift roster_viewed` was misplaced (manager screen, employee journey)
- engine-dispatch resume-waiting logic must be verified before coding

**5 Amendments incorporated into the spec:**
- C1: Web-only scope for v1 (mobile Phase 2)
- C2: Entity payload contract (`entity_type: "profile"`, `entity_id: <profile_id>`)
- C3: Step advancement via `wait_for_event`, not second trigger
- C4: Event name format (space form in registry, dot form in trigger/step)
- C5: Stuck detection via dedicated Edge Function on pg_cron

**Prerequisite verification added:** Build agent must verify engine-dispatch resume-waiting logic, dispatch_push_notification existence, pg_cron availability, and engine_event provider auth path BEFORE writing any code.

**Biggest risk avoided:** Without amendments, PoC would create duplicate `engine_state` rows per profile and a journey that never advances past step 1 — "running" but proving nothing.

## 2026-04-06 — Journey Harness PoC Re-Review (Verification of Amendments)
**Type:** spec (re-review)
**Verdict:** APPROVE WITH CHANGES (2 NEW critical bugs found, both fixed)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator
**Key decision:** Amendment verification round caught 2 critical bugs that first review missed: G1 (wrong payload key `event_type` vs `event`) and G2 (client-side dev mode short-circuit). Both fixed in spec before dispatch. Added C6 constraint requiring server-side emit origin.
**ADR created:** none
**Learning created:** "Verification rounds find what first reviews miss — agent-coord traces actual code, others trace specs"

**What was reviewed:**
- The amended spec from the first council session
- Verification that all 5 amendments (C1-C5) actually solved the original gaps

**Convergent findings (Steward + Supervisor):**
- Both said "PASS WITH MINOR CONDITIONS" — same minor tilføyelser flagged
- Agreed on: employee-facing route check, pg_net check, EVENT-SEQUENCE.md update, COUNT query for DoD #8

**CRITICAL bugs found ONLY by agent-coord (not by Steward or Supervisor):**

**G1: Wrong payload key in C3** — Spec said `action_payload: { event_type: 'shift.list_viewed' }` but `engine-dispatch/index.ts:411` reads `action_payload.event` (without `_type`). Verified against existing seeds (`seed_daily_close_process.sql:71` uses `"event"`). If build agent followed the spec literally, step 1 would enter `waiting` forever — silent PoC failure.

**G2: Client-side dev mode short-circuit** — `engine-event.ts:74` returns immediately when `NODE_ENV === "development"` for client-side emits. Since PoC runs in Supabase Local with Next.js dev server, every `emit()` from a `"use client"` component (drawer, onClick, useEffect) would silently no-op. The entire telemetry chain would die in local PoC environment without anyone noticing.

**Fixes incorporated:**
- C3 updated: `action_payload: { event: '...' }` (correct key) with line 411 quoted as evidence
- New C6 added: Emit MUST originate server-side (Server Component / Server Action / Route Handler), with anti-pattern + correct pattern code examples
- Section 2 process design corrected
- Prerequisite Check expanded from 4 items to 8 items (route check, schema check, index check, extension check, etc.)
- DoD expanded from 8 to 10 items (COUNT query, EVENT-SEQUENCE.md update, emit call site documentation)
- Registry expansion now requires all 4 destinations (posthog, logger, activity_trail, engine_event)

**Council process learning:** The verification round caught what the original review missed. Agent-coord traced actual code line-by-line (engine-dispatch.ts:411, engine-event.ts:74) while Steward/Supervisor evaluated the spec at concept level. Both perspectives were necessary — concept review approves the architecture, code-tracing review catches the implementation bugs. Always run a verification round after spec amendments.

**Biggest risk avoided (this round):** Build agent would have followed spec literally and shipped a PoC where (a) no step ever advances because of payload key mismatch, OR (b) entire chain silently no-ops in local dev. Both bugs would only surface during testing — wasting hours of build time.

---

## 2026-04-07 — Untracked vercel.json: migrate droplet services to Vercel?

**Type:** architecture
**Verdict:** REJECT (DELETE the file)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator
**Frontend-designer:** skipped (not a UI question)
**ADR created:** ADR-0072
**Learning created:** 0025-stage-engine-websocket-vercel-blocker

**Subject:** An untracked `vercel.json` appeared at repo root on 2026-04-06 with an undocumented `experimentalServices` field naming web + 4 backend services. No ADR, no plan, no driver, no provenance. Question: delete, integrate, or hybrid?

**Verdict:** Unanimous DELETE (3/3).

**Key findings (each agent caught something the others missed):**

**System Steward (chair):**
- File violates Source of Truth Hierarchy — `experimentalServices` is undocumented, cannot be canonical for service topology.
- Bypasses ADR-0040 without supersession ADR.
- ADR-0071 (preview env asymmetry "services have no preview tier") would need re-derivation — vault structure, env sync manifest, the asymmetry rationale.
- scrapling network isolation regression: currently internal-only, the proposed routePrefix would make it publicly addressable.
- n8n persistent volume cannot move to Fluid Compute → Option B impossible by construction.
- Timing: cost of "no" today is zero, cost of "yes" is unbounded. We just shipped first preview→main release.

**Supervisor:**
- Scope creep: file bypassed `/start-feature`, decision log, SESSION.md, council. Every quality gate.
- DocuSeal HMAC verification depends on raw request body — Fluid Compute body parsing under `experimentalServices` is unverified. Production billing-adjacent code at risk.
- `interview-mcp` exists in `services/` but is missing from the proposed file → spec already incomplete.
- Adding Vercel Functions creates a THIRD compute fabric (Supabase Edge + droplet + Vercel) — fragmentation.
- `experimentalServices` not in any documented Vercel config surface (only `functions`, `crons`, `bunVersion`, `routes`, or `vercel.ts` + `@vercel/config`).

**System Agent Coordinator (CRITICAL — caught structural blockers others missed):**
- **WebSocket routes in stage-engine** — `/ws/:sessionId` and `/guardian/ws` are persistent connections used by onboarding UI and admin dashboard. Vercel Functions DO NOT support arbitrary WebSocket upgrades. **Hard blocker.**
- **In-process guardian-bus** — `services/stage-engine/src/core/guardian-bus.ts` distributes events via in-process EventEmitter. Multiple Fluid Compute warm instances would silently drop cross-instance events. Externalization to Upstash Redis pub/sub or Vercel Queues required.
- **Background loops** — `CLEANUP_INTERVAL_MINUTES=5` and Calendar Guardian tick need conversion to Vercel Cron.
- shift-mcp is the only clean candidate but cold-start variance (800ms-2.5s vs droplet's always-warm 300-500ms) breaks agent tool latency budget for voice flows.
- Voice (Ultravox) clarification: voice runs browser↔Ultravox directly. Stage Engine receives only short-lived server-side tool callbacks. NOT a sustained-connection issue. Good news for any future migration.

**Key decision:** Option A (DELETE). Option B impossible by construction (n8n, scrapling). Option C premature (latency cost, no driver, requires WS refactor first).

**Doc references checked:** The 3 older docs that mention `vercel.json` actually reference `apps/mobile/vercel.json` (legitimate Expo PWA SPA rewrite config), NOT the root file. No doc audit needed. Clean delete.

**Council process note:** Full council was the right call here. Each agent contributed unique findings — Steward caught the ontology + ADR conflicts, Supervisor caught the scope-creep + DocuSeal webhook risk, Agent-Coord caught the structural WebSocket blocker that nobody else would have known about. None of these would have been found by reading docs alone.

---

## 2026-04-06 — Employee Contract Management Post-Implementation Review

**Type:** feature (post-implementation)
**Verdict:** APPROVE WITH CHANGES — 6 must-fix, 4 should-fix
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decision:** Architecture sound (D2 Resource placement, contract_type branching, cascade integrity preserved). Implementation had 6 runtime-breaking bugs requiring fix before merge.
**ADRs created:** 5 entries in feature decision log (table reuse, status propagation, suggestTools placement, X-Service-Key auth, fetch timeouts)

### What broke
1. Botsson tools referenced 4 nonexistent columns (`id` vs `contract_id`, `profile_id` doesn't exist, `contract_template_id` vs `template_id`)
2. Webhook wrote `"declined"` to enum that lacks that value → PostgreSQL constraint violation
3. POST /api/contracts created without `emit()` → telemetry gap
4. Auth header used `Authorization: Bearer` instead of `X-Service-Key` convention
5. `sendEmployeeContract` autonomous instead of suggest-confirm flow
6. Hardcoded Tailwind colors (blue-500, green-500, yellow-500) throughout UI

### Learnings captured
1. **Always verify Botsson tool schemas against `database.types.ts`** — 3 agents independently caught the same column mismatches. Plans written from memory drift from reality fast.
2. **Service-to-service auth is `X-Service-Key`, not Bearer** — second time this pattern has been confused.
3. **Irreversible AI actions belong in `suggestTools`** — `confirm`/`autonomous` authority levels expose tools without enforced UI confirmation. The suggest tier is the only one that gates on user confirmation.

### Verdict held
All fixes applied in single commit (`2fbdbdf7`). Typecheck 27/27 passing. Architecture untouched — only implementation accuracy fixes.

---

## 2026-04-06 — Employee Contract Management R2 Re-Review

**Type:** feature (re-review after R1 fixes)
**Verdict:** REJECT — 3 new blockers found by tracing end-to-end flow
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer, narrator

### What R2 found that R1 missed
R1 reviewed each side of the feature in isolation. R2 traced the integration and found 3 new blocking bugs:

1. **B1 RUNTIME BUG (Supervisor):** Drawer sent `{field_values}` but route Zod schema expects `{overrides}`. Drawer read `id` from response but route returned `{contract_id}`. The send-contract user flow was broken on first use. Pure typecheck couldn't catch this — local type annotations on `await response.json()` are unchecked claims.

2. **B2/NEW-3 INVARIANT (Steward):** Botsson `createEmployeeContract` had no `emit()` call. Silent mutation path through agent layer — bypassed activity_trail, PostHog, and engine_event. Violation of "no mutation without emit".

3. **B3/NEW-4 SECURITY (Steward):** POST /api/contracts had no role check. Any authenticated workspace member (including employees) could create contracts for any profile. Privilege escalation vector.

### Fix path
- B1: Drawer body shape aligned to Zod schema, response destructure fixed (commit `51b7b49c`)
- B2: First attempt wrote directly to activity_trail (incomplete). Second attempt refactored `@smartout/telemetry` package to use `globalThis["window"]` instead of `typeof window`, allowing import from server-only `@smartout/ai` (commit `d92a597e`)
- B3: Added admin/owner role check in route handler with user-scoped client (commit `51b7b49c`)
- Regression tests + 2 learnings filed (commit `3ce3ec71`)

### Process learning
End-to-end review IS different from per-file review. For features with drawer→API→DB flows, the reviewer must trace every payload field both directions. Captured as Learning 0023.

---

## 2026-04-07 — Employee Contract Management R3 Verification

**Type:** feature (third review)
**Verdict:** APPROVE WITH CHANGES — 0 new blockers, 2 closure-blockers tracked
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer

### Gate status
- **Merge to development:** GREEN — all R2 blockers verified fixed by 4 independent reviewers
- **Feature closure:** YELLOW — 2 items tracked

### Closure-blockers (must address before `/close-feature`)
1. **NEW-5 — `as never` cast on webhook line 225.** Gated on type regen. Local Supabase has migration drift from parallel worktree work; type regen requires resolving drift first. Tracked as closure-blocker, not merge-blocker.
2. **PII (personnummer) handling decision.** Personnummer flows through placeholder map to DocuSeal. Needs Pontus decision + ADR. Three options on table: encrypt at rest, defer to DocuSeal entirely, or split into separate restricted-access table.

### Backlog (track, don't block)
- Rename Test 1 in contracts-api.spec.ts to reflect Zod silent-strip (Supervisor)
- Document or widen route response shape for `recipient_name` (Supervisor)
- Extract `requireWorkspaceAdmin()` helper if a 4th caller appears (Steward)
- Audit codebase for other `as never` casts after type regen (Steward)

### Process observation: Convergence pattern
R1: 6 blockers → R2: 3 new blockers (in fixes) → R3: 0 new blockers. This is healthy convergence: find → fix → verify → ship. Council depth (3 rounds) was right for this surface area. Simpler features should converge in 2 rounds; cascade-touching features may need 4+. **Council depth scales with cross-cutting surface area.**

### Verdict held
4 reviewers converged on ship. Steward: "From the agent architecture perspective: this is the right fix in the right place. No follow-up needed." Supervisor: "Ship it, log items as follow-ups." Frontend: grep verified zero hardcoded palette colors.
