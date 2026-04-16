---
title: Council Session Log
status: live
updated: 2026-04-16
created: 2026-03-26
module: governance
tags: [council, decisions, multi-agent, review, governance]
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
| 2026-03-29 | Protocol Verification Engine          | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR-0074 (was ADR-0071, renumbered 2026-04-07)                                    | Two mission systems (AgentMission/Ultravox vs engine_missions/Stage Engine) — generator must target DB schema. JSONB on existing table beats new table. Spring animations need 1500ms settle. protocol.json rejected as dual source of truth — TypeScript definitions instead.                                                         |
| 2026-03-29 | PVE Operations + Dashboard + Agent    | architecture | APPROVE WITH CONDITIONS  | steward, supervisor, agent-coordinator, frontend-designer | None (extends ADR-0074, was ADR-0071)                                             | Agent split: protocol-writer (observer) never touches apps/web/. Dashboard: local-only dev tool, dark theme, no Nordic Split. Manual: task-oriented not role-oriented. Testid fixes delegated via reports, not agent self-modification.                                                                                                |
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
| 2026-04-14 | Contract System Phase 2-3             | feature      | APPROVE WITH CHANGES     | frontend-designer (3 agents failed: usage limits)         | None                                                                              | useMemo+setState = anti-pattern. Semantic table scope/aria-label mandatory for matrix UIs. Degraded council mode works when orchestrator covers gaps.                                                                                                                                                                                  |
| 2026-03-29 | Interactive Dashboard Redesign        | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | session_task resolution, broadcast channel, telemetry, ADR-0068 mutation boundary | session_task.department_session_id NOT NULL blocks inline task creation in Prep mode — resolved via active/upcoming session lookup. Broadcast uses news channel_type. Spring constants were 3-10x too high. prefers-reduced-motion was missing. Entity drawer must remain read-only (ADR-0068). Feature flag recommended for rollback. |
| 2026-03-29 | Reconciliation "Stilling" Data Fix    | bug          | APPROVE WITH CHANGES     | steward, supervisor, frontend-designer                    | None                                                                              | `schedule_shift.role` (D6) != `position.name` (D2) — different dimensions, not interchangeable. Added `positionName` as new field, kept `role` unchanged. Employee name was null due to missing profile join. ~15 hardcoded Norwegian strings + `#6366f1` fallback flagged as polish-pass debt.                                        |
| 2026-04-06 | Code Review: mobile-prod + prod-gaps  | code review  | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Migration Safety ADR                                                     | DROP TABLE CASCADE in migrations = silent data destruction. supabaseAdmin:unknown forces unsafe casts across all agent tools. sendMessage only mutation tool without emit(). indigo-500 is cold-spectrum (hue ~240) in warm-only OKLCH system. Agent tools bypass RLS by design — every query MUST include manual .eq(workspace_id).   |
| 2026-04-06 | Full Plan Portfolio Review (11 plans) | plan         | MIXED (see below)        | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | See details below                                                                                                                                                                                                                                                                                                                      |
| 2026-04-06 | Journey Inference as Agent Harness    | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Mobile Telemetry Offline Emit ADR, Journey Progress via Domain Process Engine ADR | 5 breaks verified: 12/12 mobile hooks 0 emit(), no runtime journey tracking, two journey systems, Guardian AI-only, rescue unwired. Rescue≠Re-engagement (two-tier model). Journey DB tables are dev-tracking artifacts (never repurpose). All orchestration via engine_process. |
| 2026-04-14 | Module 6 Sub-project 0 Plan Review (pre-execution) | plan | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator | None | 3 blockers found: (1) ALTER TYPE ADD VALUE in transaction — split migration, (2) trigger uses NEW.profile_status but column is NEW.status, (3) Task 5 "mobile bug" isn't a bug (is_active exists, profile_status is type not column). Plus: missing FK on assigned_by/waived_by, column default still 'pending', getTeamReadiness data exposure (moved to suggestTools), package.json incomplete. Learning: ALTER TYPE ADD VALUE cannot run in transactions (second occurrence). |
| 2026-04-14 | Module 6 Training & Competence — Implementation Plan Scoping | plan | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator, frontend-designer | None (corrections, not new architecture) | `protocol_assignment` missing `workspace_id` (blocking). Training capability is "declared ghost" (intent routes to nothing). Existing CRUD already exists (6 forms + mutations). Mobile hook has live bug (`is_active` vs `profile_status` enum). Nordic Split compliance ~30-40%. Five low-cost AI columns prevent Phase 2 rework. Shared hooks must move to `packages/` before mobile UI. Sub-project 0 (Schema + Data Foundation) is mandatory prerequisite. |
| 2026-04-13 | Contract E2E Gap Closure + Template Binding + Hospitality Intelligence | architecture | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator, frontend-designer | Amend ADR-0076 (template as input), New ADR (employment_category enum), Amend ADR-0077 (form-based PII Phase 1-2) | 13 gaps mapped in contract flow — chain completely broken between composition and signing. 3-phase plan: gap closure, template binding, agent integration. Template binding placed as K1b. employment_category needs enum (TEXT is sand). Tariff lookup fragile (LIMIT 1 returns arbitrary rate). Send route telemetry bug (emits wrong event). Wizard restructured to 5 steps. Template selection invisible to admin (cascade-derived). PII collection via form page, not agent, for Phase 1-2. Tripletex researched: they do NOT generate documents — our cascade-derived contracts + compliance checking is the differentiator. |
| 2026-04-09 | Agent Harness Foundation Spec         | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: ADR-0083 (Agent Harness Foundation, extends ADR-0042)                    | engine_session_event vs guardian_log boundary must be explicit (internal replay vs external audit). delegate_task tool must live in stage-engine, not packages/ai (package boundary). createSession() requires mission_id — subagents need separate createSubagentSession(). Hooks are chat-pipeline only in Phase 1 (voice bypasses routeAgentMessage). Orbiting electrons rejected — concentric pulse rings match Nordic Split ambient language. |
| 2026-04-07 | ADR-0075 Implementation Review (post-migration) | architecture | APPROVE WITH CHANGES → FIXED | steward, supervisor, agent-coordinator, frontend-designer | ADR-0075 already written + accepted; 7 follow-up fixes applied same session | Decision log file was corrupt (concatenated frontmatters from merged feature branches) — rebuilt from scratch. `/status` did NOT regenerate DASHBOARD from `git worktree list` — command doc rewritten to enforce regeneration contract. Race in end-session.sh (DASHBOARD sed before activity-log write) reordered. close-feature.sh silent failure `2>/dev/null || true` replaced with explicit warning pattern. narrator.md line 135 missed in sweep — fixed. INDEX vs ORIENTATION trust-hierarchy conflict resolved (STATE.md demoted to layer 7). ORIENTATION MEMORY.md ambiguity clarified. All 7 fixes committed 5fe73c8b and pushed. Biggest lesson: sweep grep regex must match bare words, not just file extensions. |
| 2026-04-09 | Contract System Reconciliation: Two Unfinished Strategies | architecture | APPROVE WITH CHANGES | steward (chair), supervisor, system-agent-coordinator, frontend-designer | None (ADR-0076 already covers) | **CRITICAL FINDING: CompositionWizard is a non-functional shell** — merged as "complete" but never calls resolveComposition or any API. `state.proposal` always null, wizard always shows "Ingen forslag tilgjengelig". **Send-drawer template fetch broken** — API returns `{ data: [...] }`, drawer expects bare array, always shows empty state. Neither contract flow has EVER worked for end users despite 79 files + 5300 LOC merged. Root cause: backend is correct, UI shells exist, but wiring between them was never completed. The two strategies (template-based vs cascade-derived) are COMPLEMENTARY not competing: cascade owns substance (terms, rates, compliance), templates own form (document presentation). Phase 1 plan: wire wizard to resolveComposition API (~50 LOC), fix template fetch (1-line), fix tariff lookup (add framework_id filter), replace UUID input with employee picker, add telemetry (13 events registered but never emitted). Phase 2: change_proposal integration per ADR-0076, workspace admin template CRUD at /dashboard/settings/contracts/, merge send-drawer into wizard as final step, i18n + Nordic Split. Phase 3 (separate): contract_intake capability completely unreachable (not in intent classifier, channel never set on AgentToolContext, allowedChannels dead code). Additional findings: actor_id uses auth.uid() not profile_id in contract API routes, RLS vs API semantic mismatch (is_system vs workspace_id IS NULL), authority config seed uses wrong key format (dotted vs flat — all capabilities default to read_only). |
| 2026-04-08 | Contract Composition Engine — Round 2 (13 detailed decisions) | feature | APPROVE WITH CHANGES | steward (chair), supervisor, system-agent-coordinator, frontend-designer | ADR-0080 (compliance drift signal), ADR-0081 (admin PII bypass RPC), ADR-0082 (drafts are not versions) | 6 tensions resolved. Key rejects: `engine_state_step.status` CHECK extension (refusal belongs on contract level), per-field step granularity (bundled groups of ~5 prevents 2000 waiting-states), auto change_proposal for framework drift (use read-only materialized view instead), 4 new enum values (only `declined` + `pending_data` added, dashboard bucketing is UI layer), cross-device Realtime sync (deferred to Phase 3 — no broadcast infra exists). Key accepts: `decline_reason_code` + text on employment_contract, bundled intake groups with empathy copy per group, escalation via `engine_delayed_trigger.cancelled_at` pattern (requires migration), drafts are not versions (versioning starts at sent, idempotency key on send), admin PII bypass dashboard-only with data-shaming UX + required reason + employee notification, framework_snapshot JSONB immutable at send-time. Steward's load-bearing principle: "cascade/execution boundary — every tension that tried to cross it got rejected for the same reason. Hold that line." |
| 2026-04-07 | Contract Composition Engine (B+C+D) | feature | APPROVE WITH CHANGES (substantial) | steward, supervisor, system-agent-coordinator, frontend-designer | ADR-0076 (composition as cascade derivation), ADR-0077 (intake PII handling, proposed), ADR-0078 (engine process channel restriction), ADR-0079 (ADR-0024 amendment — employment vs platform contract separation) | 8 blockers identified. Key resolutions: `human_only` flag REJECTED (replaced by collect_signature + allowed_channels + C4 authority — cascade invariant #2); `contract_compliance_override` table REJECTED (override data lives as `employment_contract.compliance_overrides JSONB` provenance per cascade invariant #8); composition pipeline is INSIDE cascade as derivation producing `change_proposal`, not beside; `employment_contract` (HR) vs `contract` (ADR-0024 platform legal) clarified as two separate systems; `Forklart på norsk` tab reserved in UI but DISABLED in Phase 1 (Phase 2 will build `framework_lookup` verbatim, never `framework_explain` paraphrase); `framework_id` on template REJECTED (frameworks resolve at composition time via `workspace_framework_binding`). PII ADR blocks all intake code. Voice forbidden for critical data — enforced via 3-layer defence (process + capability + tool). Supervisor caught `contract_status` enum naming collision with text column in migration 20260228140000. Agent-coordinator confirmed `human_only` and `allowed_channels` do NOT exist in codebase, must be added. Frontend caught "magisk UX" risk (per-block acknowledgement non-negotiable) and proposed segmented tabs `Kontrakt \| Rettigheter \| Forklart` on mobile with bottom-sheet IA. Learnings 0029 (four permission mechanisms smell) and 0030 (contract name overloaded) captured. |
| 2026-04-07 | Three-issue retrospective: build-agent gap, parallel sessions, ADR-0075 v1.1 | architecture | APPROVE WITH CHANGES | steward (chair), supervisor, system-agent-coordinator, narrator | ADR-0075 → v1.1 amendment in place; ADR-0076 (build-agent verification evidence contract) and ADR-0078 (dev-time agent infrastructure parity) to write. ADR-0077 reserved/skipped. | Three-issue council. (1) Build agent on journey-harness-poc paraphrased DoD #5 — fix `ee2d2bb0` corrected detector off-by-one (`current_step=1` → `=2`). Process lesson: headless build agents must dump raw curl/SQL, not paraphrased prose. (2) Parallel Claude sessions both worked on ADR-0075; cb7c7c60 was committed directly to development in violation of ADR-0075's own resolved Open Q3. *"ADR-0075 was violated by the commit that shipped ADR-0075"* — preserved as canonical learning. Fix: husky Hook #7 (branch guard with MERGE_HEAD allowance), implemented via worktree (eat the dogfood). (3) ADR-0075 retroactive: ORIENTATION.md was self-described "North Star" but not in either CLAUDE.md Boot Sequence; promoted to step 0 + self-listed as tier 0 in own trust hierarchy + Hook #8 grep enforces ADR-0075 reference. Agent Coordinator's deeper insight: *"world-class agent architecture for runtime agents, zero infrastructure for the agents that build the codebase. The asymmetry is the bug."* ADR-0078 (dev_session sibling table, sealed envelope subagent prompts, dev.* telemetry family) reserved for next sprint. |
| 2026-04-16 | Botsson Observability Foundation P0+P1 pre-PR review | post-implementation | APPROVE WITH CHANGES | steward, supervisor, system-agent-coordinator | none (follow-ups queued) | Learnings 0034, 0036, 0037. Prior verdict held. 5 MUST-FIX before merge: spec stamp, sub-route AppEnv, index.ts console.*, PR Trust Gate disclosure, ADR-0113 forward-ref fix. |
| 2026-04-16 | PR #213 R2 post-implementation review | post-implementation | APPROVE WITH CHANGES | steward, supervisor, system-agent-coordinator | ADR-0114 (authority post-Phase-4) + ADR-0113 addendum (entity contract) | Learnings 0038, 0039. Trust Gate verdict PARTIAL until entity fix. Supervisor caught activity_trail silent-drop bug R1 missed — promoted to council rule in Phase 9. |

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

---

## 2026-04-09 — Contract Composition Engine (Post-Implementation Review)
**Type:** feature
**Verdict:** APPROVE WITH CHANGES (8 blocking fixes applied)
**Agents consulted:** System Steward, Supervisor, Agent Coordinator, Frontend Designer
**Key decision:** 8 critical bugs caught and fixed before merge: column name mismatches, engine process lookup, JSONB access syntax, missing role gates, actor_id type error, scope creep reverts
**ADR created:** none (ADR-0076 change_proposal omission documented as tracked debt)
**Learning created:** none

### Blocking issues found and fixed
1. `address_line_1` column name mismatch in RPC + intake tools (Steward + Supervisor)
2. Engine process lookup `.eq("name")` should be `.eq("id")` (Steward + Supervisor)
3. Compliance drift view JSONB array syntax on object (Steward)
4. `compute_compliance_diff` field name mismatches (Steward)
5. Missing admin/owner role gates on 4 API routes (Supervisor)
6. `actor_id` using auth UID instead of profile_id (Supervisor)
7. Scope creep: useShiftClock emit removal (Supervisor) — reverted
8. Scope creep: notifications outbox gutted (Supervisor) — reverted

### Follow-up items tracked
- ReasoningDrawer: use Sheet instead of fixed panel (Frontend)
- DerivationStep: use WizardLoadingOverlay not bare spinner (Frontend)
- Hardcoded Tailwind colors → CSS variables (Frontend + Supervisor)
- Hardcoded Norwegian → i18n keys (Steward + Supervisor)
- Missing motion/animation (Frontend)
- ADR-0076 change_proposal integration (Steward)
- ADR-0082 idempotency key on send (Steward)
- Intent classifier for contract vs contract_intake (Agent Coord)
- Authority config defaults for contract_intake (Agent Coord)
- actingOnBehalfOf context stripping (Agent Coord)
- Entity type standardization: employment_contract (Supervisor)
- DocuSeal Nordic Split chrome (pre-existing gap)
- E2E test implementation (pre-existing gap)

### Council effectiveness
All 4 agents found real issues. Steward and Supervisor both independently found bugs 1 and 2. Agent Coordinator identified 6 missing contracts. Frontend identified 9 design issues. High-value session — bugs 1-2 alone would have caused silent data loss in production.

---

## 2026-04-09 — Production Readiness Plan (3 Sub-Plans)

**Type:** plan
**Verdict:** APPROVE WITH CHANGES — Task A2 (schedule_control) BLOCKED, 6 moderate fixes applied
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer
**Key decision:** `session_hook` is a config table, not a per-session instance table. `session-hook-executor` cron handles materialization. ADR needed for future granular scheduling.
**ADR created:** none (recommended for session hook model)
**Learning created:** L-0029: session_hook is config/template table; session-hook-executor cron materializes session_task from config + department_session join

### Critical findings (3)
1. **Task A2 schema mismatch** — plan inserted into columns that don't exist on `session_hook`. Table is per-department config, not per-session scheduling. Task BLOCKED and replaced with telemetry event registration.
2. **Outbox route payload mismatch** — `emit.ts` sends `{ event_key, metadata }`, plan expected `{ event_type, workspace_id, ... }`. Fixed to match actual payload.
3. **Missing telemetry events** — `"settings updated"`, `"team created"`, `"team deleted"` not in registry. Added registration task.

### Moderate fixes applied (6)
- Added `emit()` on team delete mutation
- Replaced `text-emerald-600` with `text-success` token
- Fixed `actor_id: ""` to use actual profile/user ID
- Added join syntax verification note for cost dashboard
- Fixed component names (SettingsLoadingSkeleton, TabContent)
- Added context propagation note for upsert_session

### Agent effectiveness
- **System Steward:** HIGH — caught schema mismatch, verified cascade model alignment
- **Supervisor:** HIGH — caught outbox payload mismatch + missing registry events + missing emit
- **Agent Coordinator:** HIGH — caught schema mismatch independently + context propagation gap
- **Frontend Designer:** MEDIUM — good design guidance but couldn't read plan file (tooling issue)

---

## 2026-04-09 — Production Readiness Post-Implementation Review

**Type:** feature (post-implementation review)
**Verdict:** APPROVE WITH CHANGES — 2 critical, 3 moderate fixes applied inline
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer
**Key decision:** Merge order wt-4 → wt-5 → wt-3 with registry dedup. Agent-coord caught dead-code outbox route (key format mismatch).
**ADR created:** none
**Learning created:** L-0030: Notification event config uses dot-notation keys but emit.ts sends space-separated — format conversion needed at API boundary

### Critical findings (2)
1. **Registry.ts conflict** — wt-3 and wt-5 both defined TeamCreated/TeamDeleted with incompatible types. Resolved by keeping wt-3's stronger types (EntityRef), removing wt-5's weaker defs and wt-3's unused SettingsUpdated.
2. **Outbox route key format** — emit.ts sends space-separated ("shift completed"), NOTIFICATION_EVENTS uses dot-notation ("shift.published"). Without conversion, the entire outbox route was dead code. Fixed with `.replace(/\s+/g, ".")`.

### Agent effectiveness
- **Supervisor:** HIGH — found registry conflict + duplicate types + all convention violations
- **Steward:** HIGH — confirmed cascade alignment + found same registry conflict + merge order
- **Agent Coordinator:** HIGH — found the CRITICAL key format mismatch that all others missed
- **Frontend Designer:** LOW — couldn't find worktrees (path mismatch smartout.ai-wt-N vs wt-N)

---

## 2026-04-10 — Platform Admin PostHog Bridge Phase 1

**Type:** architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decision:** Keep Supabase landing tables as operational source-of-truth and use PostHog as auxiliary investigative context via detail + row quick-action links.
**ADR created:** none (ADR-0037 addendum updated)
**Learning created:** 0031

---

## 2026-04-10 — Year Wheel (Årshjul) UX Pivot

**Type:** architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decision:** Physical directory rename (`season/` → `year-wheel/`) + `next.config.ts` permanent redirect. Supervisor's rewrite strategy overruled — actual blast radius verified as 25 string replacements across 14 files, not "hundreds of import path changes". Canvas/Blocks/Pins maps 1:1 to cascade resolution tiers.
**ADR created:** none (ADR-0085 already covers governance)
**Learning created:** 0032

### Key rulings

1. **Physical rename + redirect**, not rewrite (overrules Supervisor — blast radius overestimated)
2. **Click-to-edit for v1**, not drag (accepts Frontend Designer — touch incompatible)
3. **"Duplicate Last Year" is Phase 3**, not scope creep (concept is core, implementation is phased)
4. **E2E tests in Phase 1** (not Phase 5 — tests break immediately on route move)
5. **Keep BotssonTools key as `"season"`**, update path only (accepts Agent Coordinator)
6. **Block overlap needs design decision** before Phase 2 starts (swim lanes vs stacking)
7. **Pin minimum 44px hit area** (WCAG 2.5.8) with cluster collapsing for 3+ pins
8. **New fixup migration** for `resolve_cascade_tasks_rpc.sql` hardcoded hrefs (BLOCKING)

### Consensus (all 4 agents agreed)

- Canvas/Blocks/Pins is the correct mental model — direct visualization of cascade resolution
- SQL migration with hardcoded hrefs needs fixup migration (immutable)
- i18n layer already aligned (sidebar says "Årshjul", locale keys exist)
- AI architecture unaffected (Stage Engine routes by mission_id, not URL)

### Conflicts resolved

- **Rename vs Rewrite:** Steward overruled Supervisor. App Router relative imports survive rename. Rewrite would create permanent URL/filesystem discrepancy contradicting the pivot's purpose.
- **"Kopier forrige år" scope:** Supervisor called it scope creep, Designer called it hospitality-native. Resolution: ship CTA as disabled placeholder in Phase 1, full implementation in Phase 3.
- **Events tab removal:** Must keep PlanningEventsTab as list-view fallback until Pin UI has full CRUD parity.

### Agent effectiveness

- **System Steward:** HIGH — verified all 25 references, confirmed cascade alignment, correct rename decision
- **Supervisor:** HIGH — caught i18n violations, nested Sheet risk, mobile parity gap; rewrite recommendation was reasonable but overestimated risk
- **Agent Coordinator:** HIGH — confirmed AI safety, precise 10-change list with line numbers, correct BotssonTools key recommendation
- **Frontend Designer:** HIGH — complete design spec (typography, blocks, pins, canvas, empty state, animations, a11y, responsive), caught 3 high-risk areas

---

## 2026-04-12 — Year Wheel PRD Consolidation + "Fra kaos til kaskade" Hypothesis
**Type:** architecture + feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer
**Key decision:** Consolidate 5 Year Wheel documents into one master PRD (MODULE_YEAR_WHEEL_PRD.md v2.0.0). Mark UX pivot spec and gap closure design spec as superseded. Keep gap closure execution plan (stale paths need update). Keep ADR-0085. PRD written in English (convention alignment). Hypothesis framework lives in PRD Section 3 (pragmatic compromise — design rationale marked explicitly).
**ADR created:** none (language exception documented in PRD frontmatter)
**Learning created:** UI event types != DB enum values — PRD must show both layers and the mapping

### Critical findings

1. **Cascade Resolution Gap (Steward, P0):** Seasons exist in DB but produce zero `department_operating_hours` rows. Canvas/Blocks/Pins is conceptually correct but operationally disconnected from cascade scheduling. Activating a season has no downstream effect on actual staffing calculations.
2. **`season.opening_hours` is deprecated (Steward, confirmed by code):** Migration `20260421210000` explicitly marks it as `LEGACY: deprecated by Cascade A1`. Dead schema.
3. **`is_default` is governance fallback, not Canvas (Steward, confirmed by code):** Restaurant templates use `is_default = true` to find a season for policy-binding. Canvas in cascade resolution is `season_id IS NULL`. Two different concepts.
4. **Gap closure plan has 44 stale paths (Supervisor, P0):** All references point to deleted `/dashboard/season/` directory. Any agent executing this plan will fail.
5. **5 orphaned season tools (Agent Coordinator):** `packages/ai/src/tools/season/` tools exist but are not registered in any capability. Year Wheel has zero voice/chat tools.
6. **Design system violations (Frontend Designer, P0):** Hardcoded color classes, isDark prop drilling, spring constants 10x stiffer than Nordic Split tokens, no prefers-reduced-motion handling.

### Resolved questions (user confirmed)

| Question | Answer | Evidence |
|---|---|---|
| `is_default` semantics | Governance template fallback, NOT Canvas | `governance.sql:108`, `mattilsynet.sql:118`, `alcohol-labor.sql:86` all query `is_default = true` for policy-binding |
| `season.opening_hours` role | Dead schema (deprecated) | `20260421210000_cascade_cleanup_markers.sql:17-21` explicitly marks as LEGACY |
| Multiple active seasons | Max 1 active (current behavior correct) | User confirmed. Overlapping blocks are draft/planning only. |
| PRD language | English (convention alignment) | User confirmed. |

### Agent effectiveness
- **System Steward:** HIGH — found cascade resolution gap, data model incompleteness, is_default ambiguity, opening_hours dual-source risk
- **Supervisor:** HIGH — found stale path danger, convention analysis (spec vs PRD), scope creep guardrails, i18n violation
- **Agent Coordinator:** HIGH — found orphaned tools, missing capability, dual control path, calendar guardian single-season bug
- **Frontend Designer:** HIGH — complete design spec for all 7 planned features, found 6 design system violations with specific fix recommendations

---

## 2026-04-13 — Year Wheel Implementation Sequencing (Handoff Review)
**Type:** plan/architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), system-agent-coordinator, frontend-designer (supervisor returned without review)
**Key decision:** B (design debt) and C (cascade resolution gap) execute in parallel. B is a hard prerequisite for A (Phase 1 features). Agent tool registration gated on C completion ("agent trust gate"). D4-only season activation is valid with warning. Calendar Guardian bug included in C scope.
**ADR created:** ADR-0086 (Year Wheel Implementation Sequencing)
**Learning created:** Agent trust depends on data pipeline completeness, not tool registration. Calendar Guardian must scope by session context, not global workspace query.

### Critical findings

1. **Option C scope understated (Steward):** "Wire season activation" requires per-department season hours config UI + activation warning + D1 row lifecycle — not just a hook.
2. **B is prerequisite for A (Frontend Designer):** FR-SEA-15 (fractal noise overlay) cannot be implemented without CSS variable color system. 258+ hardcoded color instances, 227+ isDark references across 17/29 files.
3. **Agent trust gate (Agent Coordinator):** Registering season tools before cascade gap is fixed lets Emma make promises the system can't keep. Tool registration must wait for data pipeline.
4. **Calendar Guardian bug confirmed (Agent Coordinator):** `calendar-guardian.ts:91-98` picks newest season by `created_at`, not active season. With multiple drafts, evaluates wrong season.
5. **D4-only activation is valid (Steward):** `resolveEffectiveHours()` correctly falls back to default hours. Warn on activation, don't block.

### Implementation sequence
```
Phase 0: D (supersede stale plan) + fix decision log — DONE
Phase 1: B + C in parallel (zero file overlap)
Phase 2: A (after B merges)
Phase 3: Agent wiring (after C merges)
```

### Plans written
- `docs/superpowers/plans/2026-04-13-year-wheel-design-debt-cleanup.md` (Plan B)
- `docs/superpowers/plans/2026-04-13-year-wheel-cascade-resolution.md` (Plan C)

### Agent effectiveness
- **System Steward:** HIGH — verified cascade gap depth, found ADR index gap, correct scoping questions, self-corrected Phase 3 priority after hearing other agents
- **Supervisor:** DID NOT REVIEW (returned without output)
- **Agent Coordinator:** HIGH — verified capability registry gap, found SeasonToolContext incompatibility, Calendar Guardian bug with exact line numbers, "trust-destroying pattern" insight was council's strongest finding
- **Frontend Designer:** HIGH — 258 hardcoded color instances counted, detailed design specs for all Phase 1 features, correct FR-SEA-15 prerequisite analysis

---

## 2026-04-13 — Contract `pending_data` Workflow Wiring
**Type:** feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** System Steward, Supervisor, Frontend Designer (Agent Coordinator skipped — no AI involvement)
**Key decision:** Wire existing admin PII bypass form to contract detail page and data table for `pending_data` status. Add `--warning-foreground` design token. Keep `UserPlus` icon (Steward overruled Designer).
**ADR created:** none
**Learning created:** none (convention reminder: add missing semantic tokens WITH the feature, not as follow-up debt)

### Key findings
1. **Steward:** ADR-0081 compliance confirmed. Secondary action placement correct. `profile_id` FK is correct and RLS-protected.
2. **Supervisor:** Clean wiring, i18n correct, 4 pre-existing debts noted but none introduced.
3. **Frontend Designer:** 6 hardcoded amber values, missing `--warning-foreground` token, `UserPlus` icon semantically wrong. Two "must fix" raised.
4. **Steward synthesis:** Accepted amber token fix, rejected icon change (UserPlus = established SaaS convention for "complete your profile").

### Implementation
- Added `--warning-foreground` to design tokens (light + dark mode)
- Replaced all 6 hardcoded amber values with `bg-warning/10`, `text-warning-foreground`, `border-warning/30`
- Added `pending_data` + `declined` to status filter dropdown
- Added "Fyll ut data" button in detail sheet for `pending_data` contracts

### Agent effectiveness
- **System Steward:** HIGH — ADR verification precise, good synthesis weighing icon decision
- **Supervisor:** HIGH — found 4 pre-existing debts, correctly scoped what's new vs inherited
- **Frontend Designer:** HIGH — only agent to catch dark mode risk and missing token. Icon pushback was reasonable even though overruled.

## 2026-04-13 — Communications/Chat/Channels Architecture — Hospitality Intelligence Integration
**Type:** architecture
**Verdict:** APPROVE WITH CHANGES (Phased Remediation)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer
**Key decision:** Communications is a cascade consumer, not a domain owner. C2 control plane delivers intelligence via Event Engine; Komm is a thin display surface. No cascade queries in Komm hooks. ADR-0087 written.
**Critical bugs found:** 3 (sender_profile_id wrong column, unread_count non-existent column, collector.ts employee_id vs profile_id)
**Dead infrastructure flagged:** channel_ai_policy (zero consumers), channel_event (zero consumers) — wire or drop within 90 days
**Design debt:** 20+ hardcoded Norwegian strings, ~55 hardcoded color classes, zero Framer Motion, zero glassmorphism
**Long-term vision:** Replace Slack paradigm with Shift Intelligence Surface (briefing card + quick reach + persistent PTT) — Phase 3, future council topic
**ADR created:** ADR-0087
**Learning created:** AI tool column verification, dead infrastructure 90-day deadline

## 2026-04-14 — AI Intelligence Layer for Hospitality
**Type:** architecture + feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer
**Key decisions:**
- Kill `ai_session_event` table — use existing `emit()` → `engine_event`
- Kill `ai_operations_config` table — use `policy_type: 'ai_operations'`
- No persistent daemon — use Event Engine triggers + scheduled Edge Functions
- Split into `operations-intelligence` (manager/system) + existing `operations` (employee) capabilities
- HACCP tools inside `operations-intelligence` with domain discriminator
- PREDICT is advisory only — never mutates cascade state
- LEARN persists to K1b (`engine_memory`)
- Phase: COMPILE+TRIAGE → MONITOR+ACT → PREDICT+LEARN
**ADR created:** ADR-0088
**Learning created:** Specs proposing new config/event tables must check existing policy + telemetry infra first
**Mobile requirements:** HACCP temp input <3s, offline queue, punch-in bottom sheet, three-tier haptic alerts, all capabilities must support apps/mobile/

## 2026-04-14 — Emma Voice-Mode: Contract Tools + Entity Drawer Fix
**Type:** feature + bug
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer
**Key decisions:**
- Contract mutation tools restricted to chat-only via `allowedChannels` (ADR-0078 enforcement)
- `search_profiles_by_name` added to profile capability for name-to-UUID resolution
- Entity drawer `open_entity_drawer` tool gets UUID validation
- No direct client-to-server tool bridge — use existing chat pipeline (ADR-0089)
- `emit()` added to mutating client tools (task schedule/complete)
**ADR created:** 0089 — WalkAi Bridge Architecture
**Learning:** `allowedChannels` was declared on `CapabilityDefinition` type and set on 2 capabilities (`contract_intake`, `shift_swap`) but never enforced in `selectTools()`. Defence-in-depth requires verification at every layer, not just declaration.

## [2026-04-14] — Contract System Phase 2-3 Post-Implementation Review
**Type:** feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** frontend-designer (steward, supervisor, agent-coordinator hit usage limits)
**Key decision:** 3 parallel features (template binding UI, contract intake agent, notifications) approved with P1 accessibility fixes applied immediately
**ADR created:** none
**Learning:** useMemo with setState calls is a lint-breaking anti-pattern — always useEffect. Semantic table attributes (scope="col"/"row") and aria-label on icon-only buttons are mandatory for matrix UIs. 3 council agents hitting usage limits simultaneously = degraded mode acceptable when orchestrator can cover gaps.

## 2026-04-14 — Phase E C4 Governance Plan Review
**Type:** plan
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator (frontend-designer skipped — 95% backend)
**Key decisions:**
- Postgres RPC gate with SECURITY DEFINER (ADR-0091)
- Contract drafts through unified apply_cascade (ADR-0093, amends ADR-0076)
- Severity → enum (ADR-0094, retrofits WP1)
- WP8 deferred to Phase E.1
- WP7 promoted P1 → P0
**ADRs created:** 0091, 0093, 0094
**Learnings created:** none
**Notes:** WP1 shipped during council review (3 commits, 23 tests green). Severity retrofit needed before WP2. Min_role enforcement in tool-selector is prerequisite for WP4.

## 2026-04-15 — Shift Lifecycle Consolidation
**Type:** architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decisions:**
- Five-Layer Architecture: Reality / Interpretation / Derivation / Decision / Execution
- Event Engine = coordination spor, NOT truth-owner (engine_state lives only during active coordination)
- shift-mcp stays thin (ADR-0036 honored); new `shift_lifecycle` capability separate from read-only `schedule`
- daily_close consumes `shift.settled` events; doesn't subsume shift_lifecycle_v1
- 1 session : N shifts (formal relation)
- time_entry = D6 source input, immutable after interpretation
- Unified authority-gate extracted from agent-router, wired into engine-dispatch (closes ADR-0077/78 active violation)
- UI: 4 phenomenological phases (Planlegges/Pågår/Oppgjør/Avsluttet); orb-driven timeline; cockpit primary, shift-sheet drill-down
- Botsson mediates deviation conversation; `deviation` table owns state
**ADRs to create:** 0095 (Five-Layer), 0096 (session↔shift), 0097 (time_entry immutable), 0098 (engine_state coordination spor), 0099 (unified authority-gate), 0100 (daily_close as aggregate consumer)
**Learnings:**
- Diagnosis "5 parallel state machines" was symptom; actual disease is missing Interpretation layer between time_entry and shift_approval
- engine_state lifespan must match coordination need (per-transition, not per-entity-lifetime) to avoid scale blowup
- Mobile punch DOES emit telemetry (deep dive overstated this gap); real telemetry hole is admin_action paths in approval/reconciliation
**Notes:** Phase 1 (authority-gate + channel-guard in engine-dispatch) ships independently as security fix regardless of consolidation cadence. Phase 3 (Derivation migrations) blocks payroll work.

---

## 2026-04-16 — Web Performance Optimization Plan
**Type:** plan
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor (code-tracer), system-agent-coordinator, frontend-designer
**Prior verdict held?** n/a — first council on web performance
**Key decision:** Sprint 1 ships after REJECT items pulled + NordicSkeleton primitive lands. Sprint 2 RSC-migrates 4 routes (people, handbook, hms, reports) with `/dashboard/schedule` explicitly excluded (ADR-0032 local-state + cross-route state push to header). Sprint 3 blocked on 3 ADRs being `accepted`.
**ADRs created:** 0113 (DashboardContext decomposition completion, facade hook + ThemeContext hoist + BotssonProvider placement), 0114 (Server Actions canonical mutation primitive + capability authority relation, explicit emit contract + shared gate RPC), 0115 (RSC migration pattern — streaming boundary, NordicSkeleton pairing, ambience invariant, first-chunk heading rule). All `proposed`.
**Learnings created:**
- **Audit inflation pattern** (`learning_audit_inflation_pattern.md`) — 4 false claims caught by code-trace: LiveKit NOT eager (statically imported in CallRoom.tsx), 28 TipTap files inflated 6× (real scope ~5 parents), middleware queries on DIFFERENT code paths (never coexist), Upstash migration would be NET SLOWER. Pattern 3rd occurrence across councils.
- **Trust Gate for mutation plans** (`feedback_trust_gate_mutation_plans.md`) — three concurrent write paths (TanStack / Server Action / capability tool) can silently diverge. Agent Coordinator caught `emit()` contract gap + authority divergence + gate bypass risk. Without ADR-0114 migration would silently drop telemetry.
- **Perceived performance = design system concern** (embedded in ADR-0115) — skeleton cold-pulse against Nordic Split warm OKLCH, TipTap dynamic pop-in, Instrument Serif FOUT would make optimized app FEEL slower.
- **"Complete ongoing decomposition" ≠ "split monolith"** (embedded in ADR-0113) — framing changes risk profile. EntityDrawer/VoiceTools/ChatPanel already split; audit understated decomposition in progress.

### Critical findings
1. **Audit was inflated.** 4 false claims caught. Shipping REJECTs would have been 4 wasted PRs — one (Upstash) would have been a user-facing perf regression.
2. **Memory 2026-03-28 about WalkAiProvider is STALE.** `useEntityDrawerOptional` exists, BotssonProvider degrades. Memory rewritten. Stale code-behavior memories are a real risk.
3. **Agent Trust Gate blockers for Sprint 3** — emit contract, authority divergence, gate bypass. Without ADR-0114 capability trust silently degrades.
4. **Schedule route is architecturally special** — ADR-0032 + cross-route state push to header. Naive RSC migration breaks the header. Parked.
5. **Design prerequisites are hard prerequisites** — NordicSkeleton primitive, Framer entrance wrapper, synchronous `data-theme` flip, first-chunk heading rule.

### Implementation sequence
```
Sprint 1 (this week)
  ├─ Bundle analysis baseline
  ├─ Pull REJECTs (LiveKit dynamic claim, middleware parallelize, Upstash, createClient hoist)
  ├─ Delete dead: apps/web/src/components/providers/posthog-provider.tsx
  ├─ NordicSkeleton primitive (design blocker for loading.tsx)
  ├─ TipTap: 5 parent dynamic() + Framer entrance wrapper
  ├─ loading.tsx for HMS + handbook (3/5 already exist)
  ├─ Geist Mono audit before removing
  └─ sonner → optimizePackageImports (the one meaningful addition)

Sprint 2 (next week)
  ├─ ADRs 0113/0114/0115 MOVED to accepted
  ├─ RSC migration: people, handbook, hms, reports
  └─ Schedule EXCLUDED (ADR-0032)

Sprint 3 (after ADRs accepted)
  ├─ Facade useDashboard() + new contexts
  ├─ Server Actions migration per ADR-0114
  └─ Perf budgets warn → fail transition
```

### ADR numbering note
Decision log shows active collision: ADR-0107 has two entries (Botsson channel derivation + Strike-MCP telemetry boundary). Used 0113/0114/0115 to avoid further collision. Verify against open branches before merge — per council_meta 2026-04-15 tripletex learning on ADR-numbering reservation protocol.

### Agent effectiveness
- **Steward (chair):** HIGH — semantic conflict resolution, Agent Trust Gate verdict, ADR reference correction (0007 not 0021 for dashboard shell), revised own 1→3 ADR split after Agent Coordinator's input
- **Supervisor (code-tracer):** HIGH — 4 false audit claims caught surgically with file:line. LiveKit + TipTap count + Upstash perf + middleware paths were each verified against code, not assumed.
- **Agent Coordinator:** HIGH — stale memory flagged, three write paths diagnosed, Trust Gate blockers enumerated, "finishing decomposition" reframe, BotssonProvider placement rule, proposed the 3-ADR split
- **Frontend Designer:** HIGH — NordicSkeleton design blocker flagged (would have shipped cold shadcn), TipTap pop-in risk, Instrument Serif FOUT streaming rule, motion eager-load list, scope-exclusion of Onboarding + Botsson

### Sprint Delivery Status (rolling)

**Sprint 1 — DONE 2026-04-16**
- 1A (#211 merged): cleanup + 3 ADRs in `proposed`
- 1B (#212 merged): Skeleton primitive (replaces shadcn), SkeletonEntrance, 7 variants
- 1C (#214 merged): 8 dynamic-imports (4 TipTap + 4 Recharts), Entrance + withEntrance HOC, 2 new + 1 upgraded loading.tsx

**Sprint 2 — DONE 2026-04-16**
- 4 routes RSC-migrated: `/dashboard/people` (full server-fetch + map → initialData), `/dashboard/handbook` (HydrationBoundary pattern with TanStack v5 cache pre-population), `/dashboard/hms` (minimal — children own data), `/dashboard/reports` (minimal — already lazy from 1C)
- New shared `_data/resolve-page-context.ts` resolver
- Schedule explicitly excluded per ADR-0032 (deferred to separate ADR)
- ADR-0113 + ADR-0115 moved `proposed` → `accepted` (pattern proven by Sprint 2)
- ADR-0114 stays `proposed` — `gate-client.ts` (ADR-0091 WP3) does not yet exist

**Sprint 3 — DEFERRED**
- Server Actions migration: BLOCKED on `gate-client.ts`. Sprint cannot start until ADR-0091 WP3 lands.
- DashboardContext decomposition: feasible but 155 consumers + careful theme cascade work. Recommended as separate dedicated effort with its own pre-flight audit (per ADR-0113 step 1: introduce facade hook + ESLint rule before any consumer migration).
- Perf budgets warn → fail: deferred. Activate after Sprint 2 baseline metrics captured.

### Sprint 2 post-implementation review (2-agent degraded mode)
Supervisor code-tracer + autonomous Designer scope review. Verdict: APPROVE FOR MERGE.
- Type preservation across server/client boundary ✓
- No Set/Map serialization bugs (Map/Set used only server-side during mapping) ✓
- HydrationBoundary cache-key match verified ✓
- No additional DB hits (cache() decorators dedupe layout's prior calls) ✓
- Mobile parity preserved (data layer in `packages/utils/`) ✓
- Skeleton CLS-safe (people min-h-[104px] matches real card height)
- One drift documented: resolver-vs-layout fallback semantics on wsParam failure (added clarifying comment per Supervisor recommendation)
