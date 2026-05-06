---
title: "Journey Engine — Autonomous Orchestration Plan"
status: ready_for_execution
version: 1.1.0
created: 2026-04-21
updated: 2026-04-22
module: journey-engine
tags: [journey, orchestration, agents, parallel, council, campaign]
spec: docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md
campaign: docs/plans/CAMPAIGN-journey-engine.md
---

# Journey Engine — Autonomous Orchestration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This is the orchestration layer.** Per-sub-sortie TDD task breakdowns live inside each `/start-feature`-generated plan. This plan governs *when* to spawn each sub-sortie, *which* subagent to dispatch, *how* to parallelise safely, and *where* council gates trigger.

---

## Mission Brief

One Journey Engine. Three experiences. One intermediate representation. Five generated artefacts. Ten weeks. Zero phantom contracts, zero default-allow authority combos, zero drift between dev, docs, and runtime.

**The wager:** Every journey a Smartout user takes — onboarding, daily task completion, certification — is today authored, tested, documented, and executed by three separate systems that silently diverge. This campaign collapses them into one IR and one authoring surface. Authoring-to-artefacts under 5 seconds. Stuck-detection under 30 seconds. Mobile thin-client with non-null `workspace_id` + `actor_id` before every emit. One package path (`packages/journey-ir`); the old one (`packages/ai/src/journey`) retires in Act II and never returns.

**The prize:** The council's 2026-04-21 Journey Runner Suite verdict (APPROVE WITH CHANGES → v1.7.0) unblocks; 7 ADRs (0171–0177) move `proposed → accepted`; 5 learnings (0094–0098) stop being recurring scars and become enforced CI gates. Beyond that: the authoring team ships journeys instead of reconciling them. The runtime team ships live missions that match what was tested. The mobile team stops theatre — `journey.run_guided` becomes the only capability that surfaces on device, and it goes through the BFF as contract.

**What this plan refuses to tolerate:** Silent branch crossings into sibling campaigns. `emit()` calls without registry entries. `ALTER TYPE journey_status ADD VALUE`. Default-allow `read_only` + `gate_action` combos on journey capabilities. New imports from `packages/ai/src/journey` after Act II closes. Adapter rot past M3 cutover. Any `--no-verify`. Any direct `push` to `development`, `preview`, or `main`. Any destructive git without operator approval.

**Tech stack underlying the wager:** TypeScript monorepo (pnpm + Turbo), Next.js 14 App Router + Tailwind + shadcn/ui (web), React Native + Expo (mobile), Supabase (Postgres + Edge Functions + Realtime + Storage), Playwright (runner), Zod (IR validation), Framer Motion (Fjernkontroll — spring 35/22/2.2), `@smartout/journey-ir` (canonical IR package — minted in Act II).

**Architecture:** Orchestrator-worker pattern. Main agent conducts; specialised subagents execute sub-sorties in parallel where the DAG allows, serial where dependencies demand. Council runs at four pre-defined gates. Every sub-sortie is an atomic PR to `campaign/journey-engine` with its own close-feature gate. Milestones merge to `development` only after operator approval.

---

## The Compact — what the orchestrator promises

| # | Promise | How it's measured |
|---|---------|-------------------|
| 1 | **One IR, many artefacts.** Every journey authored once; 5 artefacts generated downstream. | `packages/journey-ir/` exists; 5 emitters land in M3; generators read IR only, never `docs/protocol/` post-cutover. |
| 2 | **No phantom contracts.** Every `emit('journey.*')` registered in `packages/telemetry/src/registry.ts` in the same commit. | CI grep gate on every PR. Phase 2.5 grep before every council Phase 3. L-0094 stops being the 5th occurrence. |
| 3 | **Authority seeded, never defaulted.** Every capability gets an explicit `engine_authority_config` row via migration. | `grep -c "journey\\." <authority-seed-migration>` ≥ 4. Zero runtime inserts. |
| 4 | **Enum discipline.** Zero `ALTER TYPE journey_status ADD VALUE`. Every new status lifecycle via 0a/0b/0c. | CI grep gate. L-0075 becomes policy, not anecdote. |
| 5 | **Mobile thin-client only.** `journey.run_guided` is the single mobile surface; every emit resolves `workspace_id` + `actor_id` non-null before firing. | `getProfileContext()` on every mobile emit path. No direct capability import in `apps/mobile/`. ADR-0134 upheld. |
| 6 | **Nordic Split rendered, not hardcoded.** Spring 35/22/2.2, `useReducedMotion()`, Instrument Serif, Lucide, tokens only. | Axe-core clean on M4 + M5 surfaces. Zero hardcoded Tailwind colors on new files. |
| 7 | **Campaign boundaries held.** Zero touches to `campaign/daily-operation`, `campaign/year-wheel`, `campaign/helpdesk`, `campaign/botsson-arena` surfaces. | Orchestrator halts at the first cross-boundary hint; scope-creep sub-sortie escalates to operator. |
| 8 | **Operator-only promotions.** Orchestrator never pushes to `development`, `preview`, or `main`. | M6 closes with a PR `campaign/journey-engine → development` awaiting operator review. |

Break any of these, and the orchestrator halts — no silent retry, no creative work-around.

---

## Campaign Theatre — the 10-week arc

```
   Week    Act                              Gate           Output
   ────────────────────────────────────────────────────────────────────────────
      1    I    Foundations                 ─── Gate A ──▶  telemetry registry
                S1.1 · S1.2 · S1.3 · S1.4                   enum 0a/0b/0c
                                                            authority seed
                                                            4 capability skeletons
                                                            ADRs 0171..0176 accepted
   ────────────────────────────────────────────────────────────────────────────
    2–3    II   Unblocks + Spec v1.7.0      ─── Gate B ──▶  packages/journey-ir
                S2.1 · S2.2 · S2.3 · S2.4 · S2.5            legacy compile.ts migrated
                                                            actor_id resolution doc
                                                            ADR-0074 cutover contract
                                                            journey_version tables
                                                            Spec v1.7.0 published
   ────────────────────────────────────────────────────────────────────────────
    3–4    III  JourneyIR + Generator       ─── Gate C ──▶  protocolToJourneyIR adapter
                Unification                                 mission / docs / audit
                S3.1..S3.10                                 generators retargeted
                                                            trigger_subtype enum
                                                            journey-compile CI
                                                            adapter deleted at cutover
   ────────────────────────────────────────────────────────────────────────────
    5–6    IV   Authoring Surface                          platform-admin/journeys/*
                S4.1 · S4.2 · S4.3 · S4.4                  JourneyStoreListingCard
                                                           publish actions wired
                                                           step-timeline shared
   ────────────────────────────────────────────────────────────────────────────
    7–9    V    Runtime + Mobile            ─── Gate D ──▶  Fjernkontroll 6-state
                S5.1..S5.7                                 stuck-detector cutover
                                                           BFF route + mobile UI
                                                           agent spotlight overlay
   ────────────────────────────────────────────────────────────────────────────
     10    VI   Close + Handoff                            close-feature gates
                S6.1 · S6.2 · S6.3 · S6.4                  Journey Guardian CI
                                                           HANDOFF-journey-engine.md
                                                           PR: campaign → development
   ────────────────────────────────────────────────────────────────────────────
```

Each Act revisits the last. Each Gate reads what the last Act shipped. The operator holds the reins at Gate A (before M1 dispatch) and at M6 (before promotion). Between those two points, the orchestrator runs autonomously through the gates.

---

## Operator Creed — the orchestrator's ten commandments

1. **I do not write production code.** I decompose, dispatch, verify, close. Subagents write TSX, SQL, RPC, tests. My edits are limited to `CAMPAIGN-journey-engine.md` progress tables, sync-log rows, and activity-log entries.
2. **I trust nothing a subagent claims without `git diff` to back it.** The diff is the fact; the report is the story.
3. **I parallelise only within a DAG-clean window.** `preflight` before every 2+ dispatch. Single message per parallel batch. Never > 5 concurrent subagents.
4. **I run council at gates, not as padding.** Four gates. Clear topic. Clear "what's on trial." REJECT halts. DEGRADED-MODE (< 3 reviewers) halts.
5. **I respect campaign boundaries.** Any task that touches D6 / year-wheel / helpdesk / botsson-arena / voice / stage-engine core → stop, report, spawn a sortie in the right campaign or defer.
6. **I never cross the merge line.** No push to `development`, `preview`, `main`. No `--no-verify`. No `git reset --hard`. No destructive git without operator approval.
7. **I never skip a Trust-Gate Unblock.** Seven unblocks. Seven sub-sortie owners. Every unblock traces back to a closeable gate.
8. **I enforce the grep gates on every close.** Emit registry, authority seed, no new `packages/ai/src/journey` refs, no `ALTER TYPE journey_status ADD VALUE`. Four greps, zero tolerance.
9. **I halt loud, not silent.** Failure modes in §0.5 produce explicit user-facing reports. I never paper over a failure with a retry loop.
10. **I hand back at M6.** Campaigns don't close. The final PR goes to the operator for promotion. I do not self-merge.

---

---

## 0. Orchestration Architecture

### 0.1 Role of the Orchestrator (Main Agent)

The orchestrator does NOT write journey-engine code. Its jobs are:

1. **Read state** — `docs/plans/CAMPAIGN-journey-engine.md` + this plan + decision log + activity log.
2. **Dispatch subagents** — one per sub-sortie, with a scoped briefing derived from the plan.
3. **Run council** at pre-defined gates (see §3) — multi-perspective verification before committing to expensive downstream work.
4. **Parallelise safely** — spawn concurrent sub-sorties only when dependency graph allows (see §4). Always run `preflight` before 2+ parallel dispatches.
5. **Enforce contracts** — every sub-sortie's exit gate (typecheck, emit-registry grep, authority-seed presence, no-`packages/ai/src/journey`-refs, etc.) runs before `close-feature.sh`.
6. **Halt for judgment calls** — any surprise (subagent fails 2×, council degraded-mode, spec ambiguity, scope creep from sibling campaign) stops execution and reports to the user.
7. **Never write code directly** — the orchestrator's edits are limited to: updating `CAMPAIGN-journey-engine.md` progress tables, committing sync-log rows, appending to activity-log. All implementation goes through subagents.

### 0.2 Subagent Roster — Who Does What

| Subagent | Used for | Never used for |
|---|---|---|
| `feature-dev:code-explorer` | Pre-sortie investigation: trace execution paths, map dependencies, confirm current state | Writing code, making decisions |
| `feature-dev:code-architect` | Designing a sub-sortie's blueprint before dispatch (files to touch, component boundaries) | Implementation (passes the blueprint to a build subagent) |
| `feature-dev:code-reviewer` | Post-sortie code review before `close-feature.sh` | Pre-implementation design |
| `supervisor` | Review agent output against Smartout conventions, scope boundaries, ADR compliance; gate-keeper between build and merge | Implementation |
| `system-steward` | Pre-dispatch plan verification; post-change system integrity audit; ADR consistency check | UI work |
| `system-agent-coordinator` | Capability skeletons (M1), agent authority wiring, `journey.run_guided` stage-engine integration (M5), emit payload tracing | Pure UI or DB work |
| `walkai-bridge-builder` | (Campaign notes this is out-of-scope — ONLY use if `journey.run_guided` needs a page-tool registry entry on the mobile thin-client; otherwise skip) | M1 foundations, any capability NOT directly tied to a mobile page tool |
| `protocol-writer` | M3 `protocolToJourneyIR` adapter + generator retarget + legacy `apps/e2e/protocols/schema.ts` cleanup | Anything outside `apps/e2e/` |
| `frontend-designer` | M4 `JourneyStoreListingCard` + M5 Fjernkontroll 6-state machine + spring physics + Nordic Split compliance | Backend, DB, capabilities |
| `docs-tutor` | M4 USER-GUIDE emitter contract + post-milestone docs updates | Code |
| `general-purpose` | Council Phase 2.5 fact-check; fallback when no specialist fits | Specialist tasks (prefer the specialist) |
| `Explore` (fast) | Quick "does X exist / where is Y" queries during orchestration | Deep architectural work |

**Rule of thumb:** Pick the most specialised agent for each task. If two would work, prefer the one listed first above.

### 0.3 Skills the Orchestrator Loads

Load these in the orchestrator's conversation BEFORE dispatching subagents so they inherit:

| Skill | When |
|---|---|
| `preflight` | Before any parallel dispatch (2+ subagents) or council run |
| `run-council` | Before gate-A / gate-B / gate-C / gate-D (§3) |
| `subagent-driven-development` | Default execution mode for sub-sorties |
| `smartout-database-guide` | Before any DB/migration sub-sortie (M1 enum, M1 authority seed, M5 stuck-detector, M6 gates) |
| `smartout-nordic-split` | Before M4, M5 UI sub-sorties |
| `smartout-edge-function-guide` | Before M5 stuck-detector sub-sortie |
| `smartout-cascade-developer` | Before M1 capability skeletons, M5 `journey.run_guided` runtime integration |
| `linear-protocol` | Only if Linear issues are involved — not required for this campaign |

### 0.4 Sub-Sortie Lifecycle (Every Sub-Sortie)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Orchestrator: read plan + verify prerequisites met            │
│ 2. Orchestrator: run `preflight` skill if parallel dispatch      │
│ 3. Orchestrator: `/start-feature <sub-sortie-name>`              │
│    → creates ~/dev/smartout.ai-journey-engine-wt-N               │
│    → branch feat/journey-engine-<sub>                            │
│    → sub-sortie plan stub in new worktree                        │
│ 4. Orchestrator: flesh out sub-sortie plan with TDD task list    │
│    (or dispatch code-architect to draft it)                      │
│ 5. Orchestrator: commit plan stub to feat branch                 │
│ 6. Orchestrator: dispatch build subagent with scoped briefing    │
│ 7. Build subagent: writes failing tests → implementation → green │
│ 8. Orchestrator: dispatch code-reviewer on the diff              │
│ 9. Orchestrator: resolve review findings (may re-dispatch build) │
│ 10. Orchestrator: run sub-sortie exit gates (typecheck, grep     │
│     gates, registry presence, authority seed presence)           │
│ 11. Orchestrator: `/close-feature` → merges to campaign branch   │
│ 12. Orchestrator: update CAMPAIGN-journey-engine.md progress     │
└─────────────────────────────────────────────────────────────────┘
```

### 0.5 Failure Handling

| Failure mode | Orchestrator action |
|---|---|
| Subagent returns empty / summary-only | Re-dispatch once with explicit "provide all findings with file:line citations". If still empty, escalate to user. |
| Subagent commits to wrong branch | Halt, revert via `git revert`, never use destructive reset. Flag to user. |
| Typecheck fails on sub-sortie | Dispatch `feature-dev:code-reviewer` + build subagent together with the error output. Do NOT merge. |
| Council returns DEGRADED-MODE verdict (<3 reviewers) | Halt. Report which agents failed and ask user whether to proceed with partial verdict or re-run. |
| Council returns REJECT | Halt. Report verdict. Do NOT proceed to downstream milestones. |
| Migration timestamp collision | Halt. Run `ls supabase/migrations/ \| tail -5` to identify conflict, rename the new migration, re-dispatch. |
| Scope creep detected (sub-sortie wants to touch sibling-campaign surface) | Halt immediately. Report which campaign owns the surface. Do NOT cross boundaries. |
| `packages/ai/src/journey` new reference detected (grep gate fails post-M2) | Halt. Reject the sub-sortie's PR. Require refactor to `@smartout/journey-ir`. |

### 0.6 Autonomous vs Gated Execution

The orchestrator runs autonomously between gates. Gates require either (a) a council verdict or (b) explicit user approval. The gates are:

- **Gate A** — after M0 pre-flight, before M1 dispatch (council: verify plan consistency + Trust-Gate Unblocks).
- **Gate B** — between M2 and M3 (council: v1.7.0 spec delta review + cutover plan verification).
- **Gate C** — between M3 and M4 (council: generator unification correctness + adapter deletion sign-off).
- **Gate D** — between M5 and M6 (council: full system integrity + mobile thin-client payload trace).
- **User approval** required after any Gate that returns REJECT or DEGRADED-MODE.

Between gates, the orchestrator parallelises sub-sorties per §4.

---

## 1. Scope Check

The spec covers **one tightly coupled subsystem** — Journey Runner Suite — although it spans DB, runtime, UI, mobile, and CI. A council already validated the decomposition into 6 milestones + 7 ADRs. The orchestration plan does not further decompose; it **operationalises** the campaign.

**Not in scope for this plan:**
- Daily operations, year wheel, helpdesk, botsson-arena, voice, stage-engine core, onboarding, contract composition — all handled by sibling campaigns (see `CAMPAIGN-journey-engine.md §Sibling Campaigns`).
- Edge Functions other than `journey-stuck-detector`.
- Mobile journey authoring (forbidden per ADR-0133).

If a sub-sortie drafted by a build subagent starts touching out-of-scope surfaces, the orchestrator HALTS (see §0.5 "scope creep").

---

## 2. File Structure — Everything Created/Modified (Campaign-wide)

Locked in before sub-sortie decomposition. Each file maps to a milestone (M1–M6) and owns one responsibility.

### 2.1 Telemetry

| File | Milestone | Purpose |
|---|---|---|
| `packages/telemetry/src/registry.ts` | M1 | Add 5 journey events (`journey.run_started`, `journey.step_reached`, `journey.completed`, `journey.stuck`, `journey.run_failed`) with Zod payload schemas. 4 destinations per ADR-0175. |
| `packages/telemetry/src/__tests__/registry.journey.test.ts` | M1 | Golden-file test per event, assertion: payload schema round-trips, all 4 destinations listed. |

> **Naming convention (S1.1 clarification, 2026-04-22):** Registry keys are
> **space-separated** (e.g., `"journey run_started"`) per existing 459-event
> convention. ADR-0175 and this plan use the dot form (`journey.run_started`)
> as the **wire format** — i.e., the value produced by
> `packages/telemetry/src/providers/engine-event.ts::toDotNotation()` at emit
> time, consumed by `engine-dispatch`. Zod-schema keys, `EVENT_ROUTING` keys,
> and TypeScript `event:` literals all use the space form. Do NOT modify
> `toDotNotation()`. See `docs/superpowers/plans/2026-04-22-s1-1-telemetry-foundation.md` §A.1.

### 2.2 Migrations (strict timestamp order; run `ls supabase/migrations/ \| tail -1` before naming)

| File (template) | Milestone | Purpose |
|---|---|---|
| `supabase/migrations/YYYYMMDDHHMMSS_journey_version_status_0a_widen.sql` | M1 | Widen `journey_version.status` column to `text` temporarily. |
| `supabase/migrations/YYYYMMDDHHMMSS_journey_version_status_0b_introduce_and_backfill.sql` | M1 | `CREATE TYPE journey_version_status AS ENUM (...)` + backfill existing rows. |
| `supabase/migrations/YYYYMMDDHHMMSS_journey_version_status_0c_tighten.sql` | M1 | Drop `text`, enforce enum via `ALTER COLUMN TYPE`. |
| `supabase/migrations/YYYYMMDDHHMMSS_journey_authority_seed.sql` | M1 | Seed 4 `engine_authority_config` rows (one per capability) per ADR-0176. Explicit columns, no default-allow combos. |
| `supabase/migrations/YYYYMMDDHHMMSS_trigger_subtype_and_journey_version_fk_0a.sql` | M3 | `CREATE TYPE trigger_subtype` + add nullable column on `engine_trigger`. |
| `supabase/migrations/YYYYMMDDHHMMSS_trigger_subtype_and_journey_version_fk_0b.sql` | M3 | Backfill `trigger_subtype='state_advance'` on all existing rows. |
| `supabase/migrations/YYYYMMDDHHMMSS_trigger_subtype_and_journey_version_fk_0c.sql` | M3 | Add CHECK + `NOT NULL` + FK constraint. |
| `supabase/migrations/YYYYMMDDHHMMSS_journey_version_tables_0a.sql` | M1/M2 boundary | Create `journey_version`, `journey_artifact`, `journey_version_audit`, `journey_version_migration_audit`, `journey_run_event` tables. RLS both JWT + API-key. |
| `supabase/migrations/YYYYMMDDHHMMSS_journey_version_immutability_triggers_0b.sql` | M2 | Immutability triggers on `journey_artifact` + `journey_run_event`. Audit trigger on `journey_version.status`. |

### 2.3 `packages/journey-ir/` (canonical IR package — created M2)

> **AuthorityLevel semantics (S1.1 clarification, 2026-04-22):** `AuthorityLevel`
> (`autonomous | confirm | suggest | read_only | disabled`) is a Node-side
> advisory for `tool-selector` + the router. The `gate_action` RPC
> (`unified_authority_gate`) treats all non-disabled levels as `allow=true`;
> it only enforces `min_role` downgrade and `requires_four_eyes`.
> `suggest`-vs-`autonomous`-vs-`confirm` semantics are enforced by
> `packages/ai/src/capabilities/tool-selector.ts`, not by the DB. Downstream
> ADR-0176 consumers must not assume DB-side level gating. See
> `supabase/migrations/20260506120000_gate_action_accept_entity_id.sql:45-161`.

| File | Milestone | Purpose |
|---|---|---|
| `packages/journey-ir/package.json` | M2 | Workspace package descriptor. |
| `packages/journey-ir/tsconfig.json` | M2 | Package tsconfig. |
| `packages/journey-ir/src/index.ts` | M2 | Public API re-exports. |
| `packages/journey-ir/src/ir-schema.ts` | M2 | Zod schema for `JourneyIR` (strict, JSON-serialisable). |
| `packages/journey-ir/src/markdown-schema.ts` | M2 | Zod schema for markdown frontmatter (10 deep-spec-dimensjoner). |
| `packages/journey-ir/src/parser.ts` | M2 | `parseMarkdown(input) → { ir, errors }`. Deterministic, 100% code-coverage via property-based tests. |
| `packages/journey-ir/src/compile.ts` | M2 | Migrated from `packages/ai/src/journey/compile.ts`. Entry point: `compileJourney(markdown) → { ir, artifacts } \| { errors }`. |
| `packages/journey-ir/src/content-hash.ts` | M2 | Canonical serialisation (sorted keys, normalised whitespace) + SHA-256. |
| `packages/journey-ir/src/adapter/protocol-to-journey-ir.ts` | M3 | `protocolToJourneyIR(protocolDef) → JourneyIR` — temporary adapter for ADR-0074 unification. DELETED at M3 cutover. |
| `packages/journey-ir/src/emitters/playwright-script.ts` | M3 | IR → `.spec.ts`. |
| `packages/journey-ir/src/emitters/user-guide.ts` | M3 | IR → MDX. |
| `packages/journey-ir/src/emitters/mission.ts` | M3 | IR → mission JSONB. (Retargeted from `apps/e2e/generators/mission-generator.ts`.) |
| `packages/journey-ir/src/emitters/inference-pattern.ts` | M3 | IR → `engine_trigger` row (subtype=`journey_inference`). |
| `packages/journey-ir/src/__tests__/ir-determinism.test.ts` | M2 | Property-based: parse × 100 → identical `content_hash`. |
| `packages/journey-ir/src/__tests__/markdown-parser.test.ts` | M2 | Golden-file per deep-spec-dimensjon. |
| `packages/journey-ir/src/__tests__/emitters/*.test.ts` | M3 | One golden file per emitter per example journey. |
| `tsconfig.base.json` | M2 | Add `packages/journey-ir` project ref. |
| `pnpm-workspace.yaml` | M2 | Verify `packages/*` glob covers new package (should already). |

### 2.4 `packages/ai/src/capabilities/journey/` (4 capabilities)

| File | Milestone | Purpose |
|---|---|---|
| `packages/ai/src/capabilities/journey/run_dev.ts` | M1 | Capability skeleton: `suggest` authority, emit `journey.run_started/step_reached/completed/run_failed`. |
| `packages/ai/src/capabilities/journey/publish_mission.ts` | M1 | `suggest` authority. Inserts `journey_version` + `journey_artifact` rows. |
| `packages/ai/src/capabilities/journey/publish_guide.ts` | M1 | `suggest` authority. Writes USER-GUIDE MDX to `docs/guides/`. |
| `packages/ai/src/capabilities/journey/run_guided.ts` | M1 (skeleton) / M5 (implementation) | `autonomous` authority. Runtime stage-engine integration. |
| `packages/ai/src/capabilities/journey/index.ts` | M1 | Public barrel export. |
| `packages/ai/src/capabilities/journey/__tests__/*.test.ts` | M1 | Unit tests per capability + authority default assertion. |

### 2.5 Legacy to Remove (M2 migration sub-sortie)

| File | Action | When |
|---|---|---|
| `packages/ai/src/journey/compile.ts` | DELETE | M2 `journey-ir-migrate-compile` sub-sortie |
| `packages/ai/src/journey/` (whole dir) | DELETE (after above) | M2 same sub-sortie |
| `packages/ai/package.json` `./journey/compile` export | REMOVE | M2 same sub-sortie |
| `apps/web/src/app/platform-admin/journeys/actions/compile.ts` import | REWRITE `@smartout/ai/journey/compile` → `@smartout/journey-ir` | M2 same sub-sortie |
| `apps/e2e/protocols/schema.ts` | DELETE after M3 cutover | M3 final PR |
| `docs/protocol/` direct reads in generators | DELETE after adapter cutover | M3 final PR |

### 2.6 Authoring Surface (M4)

| File | Milestone | Purpose |
|---|---|---|
| `apps/web/src/app/platform-admin/journeys/page.tsx` | M4 | Journey list view (reads `journey_version` by status). |
| `apps/web/src/app/platform-admin/journeys/[slug]/page.tsx` | M4 | Detail view: version history, actions (Publish to Docs / Activate Mission / Initialize E2E / Mark Canonical / Rollback). |
| `apps/web/src/app/platform-admin/journeys/_components/JourneyStoreListingCard.tsx` | M4 | `JourneyStoreListingCard` per ADR-0177. Strict TS interface. |
| `apps/web/src/app/platform-admin/journeys/_components/PublishVersionButton.tsx` | M4 | Idempotent publish action → `journey.publish_mission` / `journey.publish_guide`. |
| `apps/web/src/app/platform-admin/journeys/actions/publish.ts` | M4 | Server Action calling capability. |
| `packages/ui/src/journey/StepTimeline.tsx` | M4 | Shared component — web + mobile. |

### 2.7 Runtime + Fjernkontroll (M5)

| File | Milestone | Purpose |
|---|---|---|
| `apps/web/src/components/journey/FjernkontrollStateMachine.ts` | M5 | 6-state machine (`idle \| running \| paused \| stuck \| completed \| failed`) + 13 commands + 13 events. Pure, testable. |
| `apps/web/src/components/journey/FjernkontrollPanel.tsx` | M5 | Platform Admin UI. Spring physics 35/22/2.2, Instrument Serif, Lucide icons, Nordic tokens. `useReducedMotion()`. |
| `apps/web/src/components/journey/MirrorPane.tsx` | M5 | CDP screencast or "focus local" affordance (pick one — default alt 1 per spec §Display-resolusjon). |
| `apps/web/src/components/journey/RemoteControlSheet.tsx` | M5 | Speed, recording, mode, screenshots toggles. Keyboard-operable. |
| `apps/web/src/app/api/journey/guided/[runId]/route.ts` | M5 | BFF route for mobile thin client. Proxies to stage-engine. |
| `apps/mobile/src/screens/journey/guided/[slug].tsx` | M5 | Mobile thin-client UI. ONLY consumer of `journey.run_guided` via BFF. No direct capability import. |
| `apps/mobile/src/components/agent/AgentSpotlight.tsx` | M5 | Overlay that highlighter buttons + waits for click. Reads mission plan. |
| `supabase/functions/journey-stuck-detector/index.ts` | M5 | Edge Function. Queries `engine_trigger` with `trigger_subtype='journey_inference'`. Emits `journey.stuck`. |
| `supabase/functions/journey-stuck-detector/config.toml` | M5 | Cron registration + `WATCHDOG_CRON_SECRET`. |

### 2.8 Close-feature + CI (M6)

| File | Milestone | Purpose |
|---|---|---|
| `scripts/close-feature.sh` (additions) | M6 | Journey-specific gates 6–10 per `CLAUDE.md §Feature closure gates`. |
| `.github/workflows/journey-compile.yml` | M3 | Trigger `pnpm journey:compile` on push to `development` where `docs/journeys/**` changes. |
| `.github/workflows/journey-guardian.yml` | M6 | CI gate: emit-registry grep, authority-seed grep, `packages/ai/src/journey` grep, `ALTER TYPE journey_status ADD VALUE` grep. |

### 2.9 Documentation

| File | Milestone | Purpose |
|---|---|---|
| `docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md` | M2 | Bumped to v1.7.0 with council-mandated corrections. |
| `docs/decisions/0171..0177` | M1 | Status `proposed` → `accepted` as foundations land. |
| `docs/ORIENTATION.md` | M6 | Journey Runner section added. |
| `docs/HANDOFF-journey-engine.md` | M6 | Comprehensive handoff written by orchestrator at milestone close. |
| `docs/journeys/JOURNEY-*.md` (12 canonical) | M3 | Migrated from `apps/mobile/store-listing/journeys/` (if unique content), otherwise seeded fresh. |

---

## 3. Council Gates — Where `run-council` Runs

Each gate runs the full 9-phase council (per `run-council` skill). Estimated cost: ~80-120k tokens per gate. Budget accordingly.

### 3.1 Gate A — Foundations Ready (after M0 pre-flight, before M1 dispatch)

**What's on trial:** whether this plan is safe to hand to subagents. Does the decomposition preserve cascade integrity? Are the grep gates actually catching what we claim? Is the parallelism map DAG-clean?

**Trigger:** Plan file committed + orchestration plan committed + all 7 Trust-Gate Unblocks mapped to sub-sorties.

**Topic:** "Journey Engine orchestration plan + Trust-Gate Unblocks readiness"

**Type:** `plan`

**Key question per reviewer:**
- `system-steward`: "Does the sub-sortie decomposition preserve cascade model + ADR-0171/0172/0173/0174/0175/0176/0177 integrity?"
- `supervisor`: "Are the emit-registry, authority-seed, and grep gates correctly phrased to catch regressions?"
- `system-agent-coordinator`: "Are the 4 capability skeletons (authority defaults, emit contract) correctly specified for M1?"
- `frontend-designer`: "Does M4/M5 UI file structure anchor Nordic Split + spring 35/22/2.2 + JourneyStoreListingCard contract?"

**Expected verdict:** APPROVE or APPROVE WITH CHANGES. REJECT halts the campaign.

### 3.2 Gate B — Spec v1.7.0 Ready (between M2 and M3)

**What's on trial:** whether `packages/journey-ir` actually replaces the legacy path and whether Spec v1.7.0's contracts hold under code trace. L-0094 says phantom emit contracts are the single most recurring scar; Gate B is where we catch them before M3 locks the generator retargets around a broken contract.

**Trigger:** M2 exit criteria all green (`packages/journey-ir` exists, legacy `compile.ts` migrated, spec v1.7.0 drafted).

**Topic:** "Spec v1.7.0 delta review + ADR-0074 unification cutover plan"

**Type:** `post-implementation` (because M2 code has shipped; now verifying against v1.7.0 contract)

**Code-tracer mandate:** `system-agent-coordinator` traces `protocolToJourneyIR()` adapter end-to-end: protocol markdown → adapter → JourneyIR → emitters → golden files. File:line citations required.

**Phase 2.5 fact-check MUST verify:** every `journey.*` event named in v1.7.0 is in `packages/telemetry/src/registry.ts` (L-0094 guardrail).

**Expected verdict:** APPROVE WITH CHANGES (council will almost certainly find spec refinements). REJECT halts the campaign.

### 3.3 Gate C — Generator Unification Correct (between M3 and M4)

**What's on trial:** whether every existing protocol produces the same artefacts via the adapter as it did via the legacy path. Any semantic drift = Gate C REJECTS, because Act IV (authoring surface) will lock those artefacts as canonical. One chance to catch the drift.

**Trigger:** All 3 generators retargeted, every existing protocol diffed end-to-end, adapter deletion PR drafted.

**Topic:** "ADR-0074 unification completion + adapter cutover sign-off"

**Type:** `post-implementation`

**Code-tracer mandate:** `protocol-writer` agent traces one representative protocol through the adapter → JourneyIR → all 5 emitters, diffs against legacy output, and certifies semantic equivalence.

**Phase 2.5 fact-check MUST verify:**
- `grep -R "apps/e2e/protocols/schema.ts" apps packages scripts` — expect only self-refs.
- `grep -R "packages/journey-ir/src/adapter" apps packages scripts` — expect zero outside `packages/journey-ir/` itself (adapter not consumed externally post-cutover).

**Expected verdict:** APPROVE. If REJECT, re-open adapter work; do NOT proceed to M4.

### 3.4 Gate D — Runtime + Mobile Integrity (between M5 and M6)

**What's on trial:** whether the runtime honours what the authoring surface published, and whether mobile emits resolve `workspace_id` + `actor_id` on every path (including offline queue replay). Four review layers because this is where dev-tracking (`journey_event`) meets runtime-state (`engine_state`) and L-0023 says collapsing them is where silent data corruption lives.

**Trigger:** Fjernkontroll state machine tested, mobile BFF wired, stuck-detector shipped Step 2 (flipped), `journey.run_guided` implementation green end-to-end on preview.

**Topic:** "Journey Runner Suite runtime + mobile end-to-end integrity"

**Type:** `post-implementation`

**4-layer review assignment (mandatory per run-council addendum):**
- **Layer 1** — `supervisor`: per-file semantic review across M5 sub-sorties.
- **Layer 2** — `system-agent-coordinator`: column-level payload trace: mobile → BFF → stage-engine → `journey.run_guided` → `journey_event` / `engine_state`. Verify `workspace_id` + `actor_id` non-null per ADR-0134.
- **Layer 3** — `supervisor`: trigger/constraint semantics: immutability trigger on `journey_artifact`, audit trigger on `journey_version.status`, CHECK on `engine_trigger`.
- **Layer 4** — `system-agent-coordinator`: capability-consumer trace: who reads `journey.run_guided` responses; do any placeholders leak to UI?

**Expected verdict:** APPROVE. Anything less halts M6.

### 3.5 Unplanned Council Runs (ad-hoc)

Run a (scoped) council whenever:
- A sub-sortie's code-reviewer reports ≥2 high-severity findings — run targeted council on the specific finding.
- The orchestrator detects scope creep — mini-council (steward + supervisor only) to decide whether to proceed or spawn a new campaign.
- A spec ambiguity blocks progress — council (steward + relevant domain agent) to resolve before writing code.

---

## 4. Parallelism Map

Default: serialise. Parallelise only when dependency graph is DAG-clean. Always run `preflight` before 2+ parallel dispatches.

### 4.1 M1 Parallelism

```
M1 sub-sorties dependency graph:

  [S1.1: telemetry registry] ────┐
                                  ├──▶ [S1.4: capability skeletons]
  [S1.2: enum 0a/0b/0c] ──────────┤
                                  │
  [S1.3: authority seed migration]┘
         (depends on S1.2)
```

| Sub-sortie | Runs after | Parallel-eligible with |
|---|---|---|
| S1.1 telemetry-registry | (none) | S1.2 |
| S1.2 journey-version-status-enum | (none) | S1.1 |
| S1.3 authority-seed-migration | S1.2 | — (alone) |
| S1.4 capability-skeletons | S1.1 + S1.3 | — (alone) |

**Parallel dispatch window 1:** S1.1 + S1.2 concurrently (2 subagents). Run `preflight` first.

### 4.2 M2 Parallelism

```
  [S2.1: packages/journey-ir scaffold] ──▶ [S2.2: journey-ir-migrate-compile]
         │
         └──▶ [S2.3: actor_id resolution doc]   (doc only, can parallel)
         └──▶ [S2.4: ADR-0074 unification delta spec]  (doc, parallel)

  [S2.5: journey_version tables migration] — independent, parallel with S2.1
```

| Sub-sortie | Runs after | Parallel-eligible with |
|---|---|---|
| S2.1 journey-ir-scaffold | Gate A | S2.5 |
| S2.2 journey-ir-migrate-compile | S2.1 | S2.3, S2.4 |
| S2.3 actor-id-resolution-doc | S2.1 | S2.2, S2.4 |
| S2.4 adr-0074-unification-delta-spec | S2.1 | S2.2, S2.3 |
| S2.5 journey-version-tables | (none, post-Gate A) | S2.1 |

**Parallel dispatch window 2:** S2.1 + S2.5 concurrently.
**Parallel dispatch window 3:** S2.2 + S2.3 + S2.4 concurrently (3 subagents max).

### 4.3 M3 Parallelism

```
  [S3.1: protocolToJourneyIR adapter]
         │
         ├──▶ [S3.2: mission-generator retarget]
         ├──▶ [S3.3: docs-generator retarget]
         └──▶ [S3.4: audit-generator retarget]

  [S3.5: playwright-script emitter]      — independent, parallel
  [S3.6: user-guide emitter]             — independent, parallel
  [S3.7: inference-pattern emitter]      — requires S3.8
  [S3.8: trigger_subtype migration 0a/0b/0c] — independent
  [S3.9: journey-compile GitHub Action]  — independent
  [S3.10: cutover — delete adapter + protocol reads] — last, depends on S3.2-S3.4
```

**Parallel dispatch window 4:** S3.1 + S3.5 + S3.6 + S3.8 + S3.9 (5 subagents). Run `preflight` with token-budget check.

**Parallel dispatch window 5:** S3.2 + S3.3 + S3.4 (3 subagents, all use adapter from S3.1).

### 4.4 M4 Parallelism

| Sub-sortie | Runs after | Parallel-eligible with |
|---|---|---|
| S4.1 platform-admin-shell | Gate C | S4.2 |
| S4.2 store-listing-card | Gate C | S4.1 |
| S4.3 publish-version-button | S4.1 + capabilities from M1 | — |
| S4.4 step-timeline-shared | — | S4.1, S4.2 |

### 4.5 M5 Parallelism

| Sub-sortie | Runs after | Parallel-eligible with |
|---|---|---|
| S5.1 fjernkontroll-state-machine | M4 complete | S5.2, S5.4 |
| S5.2 stuck-detector-step1-dual-write | M3 complete (needs `engine_trigger` extension) | S5.1, S5.3 |
| S5.3 mobile-bff-route | M4 complete | S5.2 |
| S5.4 mobile-thin-client-ui | S5.3 | — |
| S5.5 stuck-detector-step2-flip | S5.2 proven stable | — |
| S5.6 stuck-detector-step3-delete-legacy | S5.5 | — |
| S5.7 agent-spotlight-mobile-overlay | S5.4 | — |

### 4.6 M6 (Serial)

All M6 sub-sorties serial. No parallelism — this is the final integrity pass.

### 4.7 Rules for Parallel Dispatch

1. **≤ 5 concurrent subagents.** Beyond that, orchestrator loses track.
2. **Always `preflight` first** (5-check list; see skill).
3. **Different file sets per subagent.** If two would touch the same file, serialise.
4. **Different branches per sub-sortie.** Every sub-sortie is a fresh `feat/journey-engine-<sub>` branch; no shared working trees.
5. **Single orchestration message per parallel batch** — dispatch all N subagents in one Agent-tool call batch, then wait for all to complete before reviewing.

---

## 5. Sub-Sortie Specifications

Each sub-sortie below has: ID, Milestone, Dependencies, Parallel eligibility, Files, Subagent dispatch briefing, Exit gates, and Orchestrator follow-up.

Where a sub-sortie needs a full TDD task list, the orchestrator dispatches `feature-dev:code-architect` after `/start-feature` to draft the tasks, then dispatches the build subagent. The task-level plan lives inside the sub-sortie's worktree at `docs/superpowers/plans/feat-journey-engine-<sub>-tasks.md`.

---

### M0 — Pre-flight (already done as of 2026-04-21 23:38)

Status check before dispatch:

- [ ] **Step 1: Verify campaign state**

Run: `git -C /home/sxtnl/dev/smartout.ai-journey-engine branch --show-current && git log --oneline -5`
Expected: branch `campaign/journey-engine`, recent commits include `docs(campaign): reconcile packages/ai/src/journey reality with ADR-0171` and `chore(campaign): sync development (journey-runner council verdict + 7 ADRs + 5 learnings)`.

- [ ] **Step 2: Verify binding artefacts present**

Run: `ls docs/decisions/017[1-7]-*.md && ls docs/learnings/009[4-8]-*.md && ls docs/superpowers/specs/2026-04-21-journey-runner-*.md`
Expected: 7 ADRs + 5 learnings + 2 specs.

- [ ] **Step 3: Verify sibling-campaign boundaries**

Run: `git worktree list`
Expected: 5 campaigns (journey-engine, daily-operation, helpdesk, year-wheel, botsson-arena) + main repo.

- [ ] **Step 4: Commit this orchestration plan + campaign plan updates**

Run:
```bash
git add docs/superpowers/plans/2026-04-21-journey-engine-orchestration.md docs/plans/CAMPAIGN-journey-engine.md CLAUDE.md
git commit -m "docs(campaign): add autonomous orchestration plan for journey-engine"
```

---

### Gate A — Council run

- [ ] **Step 1: Orchestrator loads skills**

Load: `preflight`, `run-council`, `smartout-database-guide`, `smartout-cascade-developer`.

- [ ] **Step 2: Orchestrator runs `preflight`**

Expected output: `Pre-flight ✅: 4 agents, target campaign/journey-engine, plan @ docs/superpowers/plans/2026-04-21-journey-engine-orchestration.md, skills [preflight, run-council, smartout-database-guide, smartout-cascade-developer].`

- [ ] **Step 3: Orchestrator invokes `/run-council`**

Briefing: `/run-council "Review journey-engine orchestration plan + Trust-Gate Unblock readiness. Subject: docs/superpowers/plans/2026-04-21-journey-engine-orchestration.md + docs/plans/CAMPAIGN-journey-engine.md. Type: plan. Verify: (1) sub-sortie decomposition preserves ADR-0171..0177; (2) parallelism map is DAG-correct; (3) gate triggers are well-defined; (4) failure handling covers the known traps; (5) 7 Trust-Gate Unblocks are traceable to specific sub-sorties."`

- [ ] **Step 4: Synthesise council verdict**

If APPROVE or APPROVE WITH CHANGES → proceed to M1 dispatch. Implement changes inline in the plan before M1 starts.
If REJECT or DEGRADED-MODE → halt, report to user.

---

### Act I — M1 Foundations

> **Mission:** Lay the four load-bearing stones — registry, enum, authority, capability skeletons — that every later act stands on. If Act I is soft, every downstream emit / authority check / capability resolution breaks silently. This act is the floor.
>
> **Theatre of operations:** `packages/telemetry/`, `supabase/migrations/`, `packages/ai/src/capabilities/journey/`.
>
> **Victory conditions:**
> - 5 journey events live in the registry with Zod payload schemas + 4 destinations each.
> - `journey_version_status` enum migrated via 0a/0b/0c; zero `ALTER TYPE journey_status ADD VALUE` anywhere.
> - `engine_authority_config` seeded with 4 explicit rows; zero default-allow combos.
> - 4 capability skeletons registered with correct authority defaults; `run_dev` emits its events on invocation.
> - ADRs 0171/0172/0173/0175/0176 move `proposed → accepted`.
>
> **Defeat conditions:** any phantom registry entry; any migration merged before its predecessors; any runtime insert into `engine_authority_config`; any new import from `packages/ai/src/journey`.
>
> **Sub-sorties:** S1.1 (telemetry-registry) ∥ S1.2 (enum) → S1.3 (authority-seed) → S1.4 (capability-skeletons).

#### S1.1 — telemetry-registry

**Milestone:** M1 · **Dependencies:** none · **Parallel with:** S1.2

**Files:**
- Create: `packages/telemetry/src/registry.ts` (modify — add 5 journey events)
- Create: `packages/telemetry/src/__tests__/registry.journey.test.ts`

**Subagent:** `system-agent-coordinator`

**Dispatch briefing:**

```
/start-feature telemetry-registry-and-journey-events (from inside campaign worktree)

Then dispatch:

Agent(subagent_type="system-agent-coordinator", prompt="""
You are implementing sub-sortie S1.1 of the Journey Engine campaign.

Context: Journey Engine needs 5 telemetry events per ADR-0175. The telemetry registry
is at packages/telemetry/src/registry.ts. All emit() calls are CI-validated against
this registry — missing entries = merge block.

Goal: Add 5 events to the registry, each with a Zod payload schema and all 4
destinations (PostHog, Logger, activity_trail, engine_event).

Events + required payload fields (all events carry workspace_id + actor_id):
- journey.run_started: journey_version_id, run_id, capability, surface
- journey.step_reached: run_id, step_key, step_index
- journey.completed: run_id, final_step, duration_ms
- journey.stuck: run_id, step_key, timeout_ms
- journey.run_failed: run_id, step_key, error_code, error_message

Read first:
- packages/telemetry/src/registry.ts (existing structure)
- docs/decisions/0175-journey-telemetry-contract.md (normative)
- docs/learnings/0094-phantom-emit-contracts-recurring.md (why this is gate-worthy)

TDD:
1. Write failing test: packages/telemetry/src/__tests__/registry.journey.test.ts
   assert each of the 5 events exists with the correct payload schema + destinations.
2. Run: expect FAIL (events not registered).
3. Implement the 5 entries in registry.ts.
4. Run: expect PASS.
5. Run: pnpm --filter @smartout/telemetry typecheck && pnpm --filter @smartout/telemetry test
6. Commit one logical change: 'feat(telemetry): register 5 journey events per ADR-0175'.

Constraints:
- Do NOT touch any other event in the registry.
- Do NOT add emitters/consumers — just the registry entries + tests.
- Commit to feat/journey-engine-telemetry-registry-and-journey-events (your current branch).

Exit criteria:
- Test passes.
- Typecheck clean.
- Registry contains exactly 5 new entries under journey.* prefix.
- Commit pushed.
""")
```

**Exit gates (orchestrator verifies before `close-feature`):**
- [ ] `grep -c "journey\." packages/telemetry/src/registry.ts` returns at least 5
- [ ] `pnpm --filter @smartout/telemetry typecheck` exits 0
- [ ] `pnpm --filter @smartout/telemetry test` exits 0
- [ ] No files outside `packages/telemetry/` modified

---

#### S1.2 — journey-version-status enum (0a/0b/0c)

**Milestone:** M1 · **Dependencies:** none · **Parallel with:** S1.1

**Files:**
- Create: 3 migrations in `supabase/migrations/` (timestamps strictly increasing vs `tail -1` of current)
- Modify: `packages/db/src/schema/journey.ts` (or equivalent — detect via code-explorer first)

**Subagent:** `system-steward` first (pre-migration safety check) → `system-agent-coordinator` (implementation)

**Pre-dispatch check (orchestrator runs):**
```bash
ls supabase/migrations/ | tail -1
# Note the timestamp. All 3 new migrations must be strictly greater.
```

**Dispatch briefing:**

```
/start-feature journey-version-status-enum

Agent(subagent_type="system-agent-coordinator", prompt="""
You are implementing sub-sortie S1.2 of the Journey Engine campaign.

Context: journey_version.status currently lacks the full lifecycle enum
(draft | ready_test | verified | published | superseded). Introducing via
ALTER TYPE ADD VALUE would collide with journey_status elsewhere
(L-0075 — see ADR-0172). We use the 0a/0b/0c pattern: widen to text →
introduce new enum + backfill → tighten back to enum.

Read first:
- docs/decisions/0172-journey-version-status-enum-lifecycle.md (authoritative)
- docs/learnings/0075-migration-atomicity-zero-a-b-c.md
- supabase/migrations/*.sql (scan for journey_status / journey_version existing state)
- packages/db/src/schema/journey.ts (or wherever journey_version lives)

Current latest migration timestamp: [insert from pre-dispatch check]

TDD pattern for migrations: use the pgtap / migration-test harness in the repo
(check apps/e2e/ or scripts/ for existing migration test pattern before inventing).

Build these 3 migrations (strict timestamp order, each strictly greater than latest):
1. <ts>_journey_version_status_0a_widen.sql — ALTER TABLE journey_version
   ALTER COLUMN status TYPE text USING status::text. Reversible.
2. <ts+1>_journey_version_status_0b_introduce_and_backfill.sql — CREATE TYPE
   journey_version_status AS ENUM ('draft','ready_test','verified','published','superseded').
   Backfill existing rows (likely all 'draft' already, but UPDATE defensively).
3. <ts+2>_journey_version_status_0c_tighten.sql — ALTER COLUMN status TYPE
   journey_version_status USING status::journey_version_status. NOT NULL default 'draft'.

Do NOT:
- Use ALTER TYPE journey_status ADD VALUE (existing enum, CVE-class collision).
- Merge 0a+0b+0c into one migration — atomicity requires separate PRs when going to prod.
- Touch journey_event or engine_state semantics.

Validate each migration locally via npx supabase db reset and the migration test harness.

Commit per migration. Three commits total on feat/journey-engine-journey-version-status-enum.
""")
```

**Exit gates:**
- [ ] 3 migration files in `supabase/migrations/` with strictly increasing timestamps post-HEAD
- [ ] `npx supabase db reset` succeeds locally
- [ ] `grep -R "ALTER TYPE journey_status ADD VALUE" supabase/migrations/` returns zero
- [ ] `pnpm typecheck` exits 0

---

#### S1.3 — authority-seed-migration

**Milestone:** M1 · **Dependencies:** S1.2 · **Serial**

**Files:**
- Create: 1 migration (`YYYYMMDDHHMMSS_journey_authority_seed.sql`)

**Subagent:** `system-agent-coordinator`

**Dispatch briefing:**

```
/start-feature journey-authority-seed

Agent(subagent_type="system-agent-coordinator", prompt="""
You are implementing sub-sortie S1.3 of the Journey Engine campaign.

Context: Four journey capabilities require explicit rows in engine_authority_config,
seeded via migration (NEVER runtime insert). C4 authority policy (ADR-0024, extended
by ADR-0176) bans default-allow combos like read_only + gate_action default-allow
(CVE-class — see L-0066 and L-0097).

Read first:
- docs/decisions/0176-journey-c4-authority-seed.md (authoritative)
- docs/decisions/0024-authority-policy.md (primer)
- docs/learnings/0066-c4-authority-defaults-are-not-free.md
- docs/learnings/0097-c4-authority-defaults-are-not-free-v2.md
- existing engine_authority_config rows for pattern (grep supabase/migrations/ for seed patterns)

Capabilities + authority defaults (per ADR-0173 + ADR-0176):
| capability             | default authority |
|------------------------|-------------------|
| journey.run_dev        | suggest           |
| journey.publish_mission| suggest           |
| journey.publish_guide  | suggest           |
| journey.run_guided     | autonomous        |

Build: <ts>_journey_authority_seed.sql
- INSERT INTO engine_authority_config (capability_name, default_authority, gate_action, ...)
  VALUES (4 rows) ON CONFLICT (capability_name) DO NOTHING.
- Explicit columns. No default-allow + read_only combos. Follow the exact row shape
  in existing seeds.

Do NOT:
- Default to read_only + gate_action:'allow'.
- Insert at runtime (migrations only).

Exit: migration applies clean on Supabase Local. One commit.
""")
```

**Exit gates:**
- [ ] Migration applies clean (`npx supabase db reset`)
- [ ] `grep -c "journey\\." <migration-file>` returns ≥ 4
- [ ] No runtime INSERT statements in new capability code reference `engine_authority_config`
- [ ] Typecheck clean

---

#### S1.4 — capability-skeletons

**Milestone:** M1 · **Dependencies:** S1.1 + S1.3 · **Serial after dependencies**

**Files:**
- Create: 4 capability files in `packages/ai/src/capabilities/journey/`
- Create: `packages/ai/src/capabilities/journey/index.ts`
- Create: 4 test files in `packages/ai/src/capabilities/journey/__tests__/`

**Subagent:** `system-agent-coordinator` (primary) + `supervisor` (review before merge)

**Dispatch briefing:**

```
/start-feature journey-capability-skeletons

Agent(subagent_type="system-agent-coordinator", prompt="""
You are implementing sub-sortie S1.4 of the Journey Engine campaign.

Context: Four capabilities per ADR-0173, each a skeleton that registers
correctly in the capability registry with correct authority defaults and emits
the telemetry events added in S1.1. Full implementation ships in later milestones
(M5 for run_guided; M4 for publish_mission/publish_guide). THIS sortie ships
the skeleton only.

Read first:
- docs/decisions/0173-journey-capability-model.md (authoritative)
- packages/ai/src/capabilities/ (existing capability pattern — pick one to mirror)
- packages/telemetry/src/registry.ts (for the journey.* event payload types — imported)
- packages/ai/src/capabilities/journey/  — YOU CREATE THIS DIRECTORY

Capabilities:
| capability             | authority   | emit events                                                      |
|------------------------|-------------|------------------------------------------------------------------|
| journey.run_dev        | suggest     | journey.run_started, journey.step_reached, journey.completed/run_failed |
| journey.publish_mission| suggest     | (not required in skeleton — implement in M4)                     |
| journey.publish_guide  | suggest     | (not required in skeleton — implement in M4)                     |
| journey.run_guided     | autonomous  | (not required in skeleton — implement in M5)                     |

Skeleton contract:
- Export a function matching the project's capability signature (copy from existing).
- For run_dev: emit journey.run_started at entry + journey.completed/run_failed at exit.
- For the other 3: throw new Error('not implemented — M4/M5') but register the capability,
  so the capability router sees them and authority config resolves correctly.

TDD:
1. Write failing test per capability: verify capability registers, resolves correct authority
   from engine_authority_config seed, and (for run_dev) emits the expected events on
   mock invocation.
2. Implement skeletons.
3. Ensure pnpm --filter @smartout/ai typecheck + test pass.
4. Commit per capability: 'feat(ai): scaffold journey.<capability> per ADR-0173'.

Constraints:
- DO NOT import from packages/ai/src/journey (that path is deprecated legacy per ADR-0171).
- DO NOT import from packages/journey-ir yet (it doesn't exist until M2) — types inline for now.
- DO NOT implement publish logic or run_guided runtime — those are later milestones.

When done, dispatch supervisor for pre-merge review.
""")

# Then orchestrator dispatches supervisor:
Agent(subagent_type="supervisor", prompt="""
Review the S1.4 diff on feat/journey-engine-journey-capability-skeletons.

Check:
- All 4 capabilities registered with correct authority defaults matching ADR-0173.
- run_dev emits journey.run_started + completed/run_failed per ADR-0175.
- Zero imports from packages/ai/src/journey anywhere in new code (per ADR-0171 and the
  corrected CLAUDE.md rule — legacy compile.ts is grandfathered, but new code must NOT
  reference it).
- Tests exist and pass.
- No scope creep: publish_*/run_guided are skeletons only.

Report findings with file:line citations.
""")
```

**Exit gates:**
- [ ] 4 capability files exist in `packages/ai/src/capabilities/journey/`
- [ ] Tests pass
- [ ] `grep -R "packages/ai/src/journey" packages/ai/src/capabilities/` returns zero
- [ ] Supervisor review clean (≤ 1 low-severity finding)

---

#### M1 Exit + Move ADRs to `accepted`

After S1.1–S1.4 all merged to `campaign/journey-engine`:

- [ ] Orchestrator updates ADR status for 0171, 0172, 0173, 0175, 0176:
  `proposed → accepted` in each file's frontmatter + decision-log row.
- [ ] Commit: `docs(decisions): move ADRs 0171/0172/0173/0175/0176 to accepted after M1 landed`.
- [ ] Orchestrator updates `CAMPAIGN-journey-engine.md` §Milestones M1 checkboxes.

---

### Act II — M2 Unblocks + Spec v1.7.0

> **Mission:** Mint `packages/journey-ir`, retire the forbidden legacy path, write the two remaining Trust-Gate docs (`actor_id` resolution + ADR-0074 cutover contract), stand up the `journey_version` tables, and publish Spec v1.7.0. This is the act that unlocks everything downstream.
>
> **Theatre of operations:** `packages/journey-ir/**` (new), `packages/ai/src/journey/**` (deleted), `apps/web/src/app/platform-admin/journeys/actions/compile.ts` (rewired), `supabase/migrations/**`, `docs/decisions/0174.md`, `docs/decisions/0176.md`, `docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md`.
>
> **Victory conditions:**
> - `packages/journey-ir/` exists with schemas, parser, content-hash, compile, tests green.
> - `grep -R "packages/ai/src/journey" apps packages scripts` returns **zero**.
> - ADR-0176 has §Appendix: Actor ID Resolution per Surface covering 4 capabilities incl. mobile via `getProfileContext()`.
> - ADR-0174 has §Appendix: Cutover Contract with measurable deletion window.
> - `journey_version`, `journey_artifact`, `journey_version_audit`, `journey_version_migration_audit`, `journey_run_event` tables exist with RLS JWT + API-key.
> - Spec v1.7.0 published. All 7 Trust-Gate Unblocks green. Gate B APPROVES.
>
> **Defeat conditions:** spec ships with council-mandated corrections unapplied; legacy `compile.ts` consumer fails to rewire; any table missing RLS; any mobile emit path allowed to ship without `getProfileContext()`.
>
> **Sub-sorties:** S2.1 (journey-ir-scaffold) ∥ S2.5 (journey-version-tables) → S2.2 (migrate-compile) ∥ S2.3 (actor-id-doc) ∥ S2.4 (adr-0074-delta).

#### S2.1 — journey-ir-scaffold

**Milestone:** M2 · **Dependencies:** Gate A passed · **Parallel with:** S2.5

**Files:**
- Create: `packages/journey-ir/` full package (see §2.3 for file list)
- Modify: `tsconfig.base.json` (add project ref)

**Subagent:** `feature-dev:code-architect` → `system-agent-coordinator`

**Dispatch briefing:**

```
/start-feature journey-ir-scaffold

# Step 1: Architect designs the package
Agent(subagent_type="feature-dev:code-architect", prompt="""
Design the packages/journey-ir/ scaffold per ADR-0171.

Read first:
- docs/decisions/0171-journey-ir-canonical-package-path.md (authoritative)
- existing packages in packages/ (for pattern — e.g. packages/telemetry/ or packages/ui/)
- docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md §Tekniske kontrakter
- packages/ai/src/journey/compile.ts (the 114-line legacy file being migrated in S2.2)

Design output (write as markdown to the sortie's plan file):
- package.json (deps: zod, @smartout/telemetry; no react, no next)
- tsconfig.json (extends root base config)
- src/index.ts (barrel exports — what public API)
- src/ir-schema.ts (Zod schema for JourneyIR — 10 deep-spec-dimensjoner)
- src/markdown-schema.ts (Zod schema for markdown frontmatter)
- src/parser.ts (pure function: string → {ir, errors})
- src/compile.ts (the migration target for S2.2 — define signature now so S2.2 can fill it)
- src/content-hash.ts (stable SHA-256 of canonical IR)
- src/__tests__/ (TDD golden files + property-based)

Do NOT write implementation yet. Design only — signatures, types, test fixture shapes.
""")

# Step 2: Orchestrator reviews blueprint, commits as sortie's plan.
# Step 3: Dispatch build.
Agent(subagent_type="system-agent-coordinator", prompt="""
Implement the packages/journey-ir/ scaffold per the blueprint at
<sortie-plan-file>.

Build in this order (TDD):
1. package.json + tsconfig.json + pnpm workspace registration.
2. src/ir-schema.ts: Zod schema with tests.
3. src/markdown-schema.ts: Zod schema with tests.
4. src/content-hash.ts: canonical-serialise + SHA-256. Property-based test: 100 inputs
   → stable hash on re-serialise.
5. src/parser.ts: minimal scaffolding. Full parser lands in M3 when real markdown
   flows through. For now: typed skeleton + 'throws NotImplemented' happy path with
   test asserting the throw.
6. src/compile.ts: ONLY the type signature + placeholder. S2.2 fills the body by
   migrating the legacy packages/ai/src/journey/compile.ts.
7. src/index.ts: barrel.
8. Ensure pnpm typecheck + pnpm test pass.
9. Commit per step (8 commits, not one mega-commit).

Constraints:
- NO dependency on @smartout/ai (journey-ir is a sibling, not downstream).
- NO imports from apps/*.
- Test coverage target: 90% on schemas and content-hash.
""")
```

**Exit gates:**
- [ ] `packages/journey-ir/` exists with all files
- [ ] `tsconfig.base.json` project refs include the new package
- [ ] `pnpm --filter @smartout/journey-ir typecheck test` both pass
- [ ] Zero imports from `apps/*` in new package

---

#### S2.2 — journey-ir-migrate-compile

**Milestone:** M2 · **Dependencies:** S2.1 · **Parallel with:** S2.3, S2.4

**Files:**
- Modify: `packages/journey-ir/src/compile.ts` (fill body from legacy)
- Modify: `apps/web/src/app/platform-admin/journeys/actions/compile.ts` (rewire import)
- Modify: `packages/ai/package.json` (remove `./journey/compile` export)
- DELETE: `packages/ai/src/journey/compile.ts`
- DELETE: `packages/ai/src/journey/` (whole dir)

**Subagent:** `system-agent-coordinator`

**Dispatch briefing:**

```
/start-feature journey-ir-migrate-compile

Agent(subagent_type="system-agent-coordinator", prompt="""
Sub-sortie S2.2: migrate legacy compile.ts from packages/ai/src/journey/ into
packages/journey-ir/ and retire the forbidden path.

Read first:
- packages/ai/src/journey/compile.ts (the 114-line file being migrated)
- packages/journey-ir/src/compile.ts (signature placeholder from S2.1)
- apps/web/src/app/platform-admin/journeys/actions/compile.ts (the single consumer)
- packages/ai/package.json (export mapping to remove)
- docs/decisions/0171-journey-ir-canonical-package-path.md
- CLAUDE.md (journey-engine-scoped) §What NOT To Do rule on packages/ai/src/journey

Migration steps (atomic PR):
1. Copy compile.ts body from packages/ai/src/journey/ to packages/journey-ir/src/compile.ts.
   Adjust imports (remove @smartout/ai references, use @smartout/journey-ir siblings).
2. Re-point consumer import:
   apps/web/src/app/platform-admin/journeys/actions/compile.ts
     from: '@smartout/ai/journey/compile'
     to:   '@smartout/journey-ir'
3. Remove packages/ai/package.json './journey/compile' export.
4. Delete packages/ai/src/journey/ directory entirely.
5. pnpm typecheck — must pass.
6. Confirm: grep -R 'packages/ai/src/journey' apps packages scripts → zero matches.
7. Commit as ONE logical change:
   'feat(journey-ir): migrate compile.ts from packages/ai/src/journey per ADR-0171'.

Validation before commit:
- pnpm --filter @smartout/journey-ir test passes.
- pnpm --filter @smartout/web typecheck passes.
- grep -R "@smartout/ai/journey/compile" apps packages returns zero.
- grep -R "packages/ai/src/journey" apps packages scripts returns zero.
""")
```

**Exit gates:**
- [ ] `grep -R "packages/ai/src/journey" apps packages scripts` returns zero
- [ ] `grep -R "@smartout/ai/journey/compile" apps packages scripts` returns zero
- [ ] `packages/ai/src/journey/` directory gone
- [ ] `packages/ai/package.json` has no `./journey/compile` export
- [ ] `pnpm typecheck` clean across web + ai + journey-ir + telemetry

---

#### S2.3 — actor-id-resolution-doc

**Milestone:** M2 · **Dependencies:** S2.1 · **Parallel with:** S2.2, S2.4

**Files:**
- Modify: `docs/decisions/0176-journey-c4-authority-seed.md` (append appendix)

**Subagent:** `docs-tutor`

**Dispatch briefing:**

```
/start-feature actor-id-resolution-doc

Agent(subagent_type="docs-tutor", prompt="""
Append an appendix to docs/decisions/0176-journey-c4-authority-seed.md titled
'Actor ID Resolution per Surface'.

Read first:
- docs/decisions/0176-journey-c4-authority-seed.md (existing content)
- docs/decisions/0134-mobile-telemetry-contract.md (for getProfileContext pattern)
- apps/mobile/src/lib/profile-context.ts (the resolver on mobile)

Content required (per campaign CLAUDE.md Unblock 6):
For each of the 4 capabilities (journey.run_dev, .publish_mission, .publish_guide,
.run_guided), document how actor_id is resolved BEFORE emit():

- journey.run_dev — dev user session (req.user / stage-engine dev session context)
- journey.publish_mission — admin session (Platform Admin session, must have admin role)
- journey.publish_guide — admin session (same as above)
- journey.run_guided:
  - web surface: stage-engine session context
  - mobile surface: getProfileContext() from apps/mobile/src/lib/profile-context.ts,
    MUST return non-null workspace_id + actor_id BEFORE emit() per ADR-0134.
    Empty-string fallback = forbidden.

Also document: what happens if resolution fails? (Answer: emit is skipped and a
capability error is raised — never emit with null/empty actor_id.)

Keep the existing ADR content. Append as §Appendix: Actor ID Resolution per Surface.
Single commit.
""")
```

**Exit gates:**
- [ ] `docs/decisions/0176-journey-c4-authority-seed.md` has `## Appendix: Actor ID Resolution per Surface`
- [ ] All 4 capabilities covered with explicit resolution path
- [ ] Mobile thin-client path cites ADR-0134 + `getProfileContext()`

---

#### S2.4 — adr-0074-unification-delta-spec

**Milestone:** M2 · **Dependencies:** S2.1 · **Parallel with:** S2.2, S2.3

**Files:**
- Modify: `docs/decisions/0174-adr-0074-journey-ir-unification-completion.md` (append appendix)

**Subagent:** `system-steward`

**Dispatch briefing:**

```
/start-feature adr-0074-unification-delta-spec

Agent(subagent_type="system-steward", prompt="""
Append an appendix to docs/decisions/0174-adr-0074-journey-ir-unification-completion.md
titled 'Cutover Contract: Adapter, Retarget, Deletion Window'.

Read first:
- docs/decisions/0074-protocol-verification-engine.md
- docs/decisions/0174-adr-0074-journey-ir-unification-completion.md (existing)
- apps/e2e/protocols/schema.ts (the legacy ProtocolDefinition schema)
- apps/e2e/generators/mission-generator.ts
- apps/e2e/generators/docs-generator.ts
- apps/e2e/generators/audit-generator.ts
- packages/journey-ir/src/ir-schema.ts (from S2.1)

Content required:
1. Adapter contract: protocolToJourneyIR(protocolDef) → JourneyIR. What fields map 1:1,
   what fields need derivation, what is lossy (if anything).
2. Retarget order: M3 spawns 3 parallel sub-sorties (mission, docs, audit) each
   rewiring its generator input from ProtocolDefinition to JourneyIR via the adapter.
   Every retarget sortie diffs old-output vs new-output for every existing protocol
   and certifies semantic equivalence.
3. Deletion window: when is protocolToJourneyIR() deleted? Exit criteria: every
   protocol has a markdown equivalent in docs/journeys/ and no apps/e2e/generators/
   entry reads docs/protocol/ directly.
4. Rollback plan: if retarget breaks a generator output, revert the retarget commit
   and re-open the adapter contract for revision.
5. Cutover checklist (M3 exit condition):
   - [ ] All 3 generators retargeted
   - [ ] All existing protocols produce identical output via adapter
   - [ ] protocolToJourneyIR() has zero call sites
   - [ ] apps/e2e/protocols/schema.ts is a re-export only (or deleted)
   - [ ] Adapter file + re-export deleted in the same PR

Keep existing ADR content. Append as §Appendix: Cutover Contract. Single commit.
""")
```

**Exit gates:**
- [ ] ADR-0174 contains §Appendix: Cutover Contract
- [ ] Adapter contract explicit on field mapping
- [ ] Deletion window defined with measurable exit criteria

---

#### S2.5 — journey-version-tables (migration)

**Milestone:** M2 · **Dependencies:** Gate A passed · **Parallel with:** S2.1

**Files:**
- Create: 1 migration for core tables
- Create: 1 migration for immutability + audit triggers
- Modify: RLS policy SQL files if the project separates them

**Subagent:** `system-agent-coordinator`

**Dispatch briefing:**

```
/start-feature journey-version-tables

Agent(subagent_type="system-agent-coordinator", prompt="""
Sub-sortie S2.5: create journey_version + journey_artifact + journey_version_audit
+ journey_version_migration_audit + journey_run_event tables per spec v1.7.0
§Migrasjons-plan 0a.

Read first:
- docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md §Migrasjons-plan
- supabase/migrations/*.sql (for pattern — RLS JWT + API-key both)
- docs/learnings/0075-migration-atomicity-zero-a-b-c.md

Pre-dispatch check: ls supabase/migrations/ | tail -1

Build migrations:
1. <ts>_journey_version_tables_0a.sql:
   CREATE TABLE journey_version (id, journey_id FK, content_hash, source_commit_sha,
     ir_json JSONB, status journey_version_status (from S1.2), created_at, updated_at,
     verified_at, verified_by, published_at, published_by, workspace_id, compat text,
     breaking_events boolean).
   CREATE TABLE journey_artifact (id, version_id FK, artifact_type enum (5 values),
     content_ref, content_hash, created_at, workspace_id).
   CREATE TABLE journey_version_audit (id, version_id, from_status, to_status,
     actor_id, actor_role, action_at, reason TEXT, related_run_id nullable, workspace_id).
   CREATE TABLE journey_version_migration_audit (id, profile_id, journey_slug,
     from_version_id, to_version_id, migration_type enum, initiated_by, initiated_at,
     reason TEXT, outcome enum, workspace_id).
   CREATE TABLE journey_run_event (id, run_id, event_type, payload JSONB, emitted_at,
     workspace_id). Partitioned daily by emitted_at.
   RLS: JWT policy + API-key policy for every table.

2. <ts+1>_journey_version_immutability_triggers_0b.sql:
   CREATE TRIGGER on journey_artifact: block UPDATE + DELETE.
   CREATE TRIGGER on journey_run_event: same.
   CREATE TRIGGER on journey_version.status: audit-row insert on transition.

Constraints:
- All tables have workspace_id (except if explicitly platform-scoped — journey_version
  CAN be workspace-scoped or platform; decide per ADR; default workspace-scoped).
- RLS on every table.
- No default-allow RLS policies.
- Each migration is a single commit.

Validate: npx supabase db reset succeeds. Migration tests pass.
""")
```

**Exit gates:**
- [ ] 2 migrations applied clean
- [ ] All 5 tables exist with RLS JWT + API-key
- [ ] Immutability triggers fire correctly (test via pg unit test or manual INSERT+UPDATE attempt)
- [ ] Typecheck green

---

### Gate B — Spec v1.7.0 + M2 Review (after S2.1–S2.5 all merged)

- [ ] **Step 1: Spec v1.7.0 draft written**

Before council: orchestrator writes v1.7.0 delta by amending `docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md` per council-mandated corrections (carry-over from 2026-04-21 verdict).

- [ ] **Step 2: Run `preflight` + `/run-council`**

`/run-council "post-implementation review: journey-engine M2 foundations + spec v1.7.0. Subject: M1+M2 commits on campaign/journey-engine. Type: post-implementation. Code-tracer mandate: system-agent-coordinator traces one end-to-end path: markdown → parser → IR → content-hash → compile → emitters (stub). Phase 2.5 MUST grep registry for all journey.* events + verify engine_authority_config has 4 rows + verify zero packages/ai/src/journey refs."`

- [ ] **Step 3: Verdict → action**

APPROVE → proceed to M3. APPROVE WITH CHANGES → apply changes inline, bump ADRs to `accepted` where pending, proceed. REJECT → halt, report to user.

---

### Act III — M3 JourneyIR + Generator Unification

> **Mission:** Close ADR-0074. Route every generator (Mission / Docs / Audit) through `protocolToJourneyIR()` until the adapter is vestigial, then delete the adapter in the same PR that retires the last `docs/protocol/` direct read. Ship two net-new emitters (Playwright script, USER-GUIDE). Extend `engine_trigger` for inference patterns via 0a/0b/0c.
>
> **Theatre of operations:** `packages/journey-ir/src/adapter/**`, `packages/journey-ir/src/emitters/**`, `apps/e2e/generators/**`, `apps/e2e/protocols/schema.ts` (deleted at cutover), `supabase/migrations/**` (trigger_subtype), `.github/workflows/journey-compile.yml`.
>
> **Victory conditions:**
> - Adapter produces valid `JourneyIR` for every existing protocol.
> - Every generator retarget diffs old-vs-new output to **zero semantic drift**.
> - Playwright-script emitter output passes `tsc --noEmit` + `playwright test --list`.
> - USER-GUIDE emitter output compiles via `@mdx-js/mdx`.
> - `engine_trigger` has `trigger_subtype` enum + `journey_version_id` FK + CHECK.
> - `grep -R "docs/protocol/" apps/e2e/generators` returns **zero** after S3.10 cutover.
> - Adapter file deleted in same PR as last generator migration.
> - Gate C APPROVES.
>
> **Defeat conditions:** adapter rot (delete date slips); any generator retains `docs/protocol/` direct read post-cutover; any generator output differs from legacy by more than whitespace.
>
> **Sub-sorties:** S3.1 (adapter) ∥ S3.5 (playwright-emitter) ∥ S3.6 (user-guide-emitter) ∥ S3.8 (trigger_subtype migration) ∥ S3.9 (CI workflow) → S3.2 ∥ S3.3 ∥ S3.4 (three generator retargets) → S3.7 (inference-pattern emitter, needs S3.8) → S3.10 (cutover + adapter deletion).

10 sub-sorties. Parallelism per §4.3. Each sub-sortie follows the template: `/start-feature` → architect → build → review → exit gates → `/close-feature`.

#### S3.1 — protocol-to-journey-ir-adapter

**Subagent:** `protocol-writer`

**Key dispatch elements:**
- Input: ADR-0174 Appendix from S2.4.
- Files: `packages/journey-ir/src/adapter/protocol-to-journey-ir.ts` + tests.
- TDD: one golden-file per existing protocol in `apps/e2e/protocols/`. Adapter output must validate against JourneyIR schema.
- Exit: `pnpm --filter @smartout/journey-ir test` passes + adapter produces valid IR for every existing protocol.

#### S3.2 / S3.3 / S3.4 — mission-generator, docs-generator, audit-generator retargets

**Subagent per sortie:** `protocol-writer`

**Key dispatch elements:**
- Depends on S3.1.
- Each retargets one generator's input from `ProtocolDefinition` to `JourneyIR` (via adapter from S3.1).
- TDD: diff old-output vs new-output for every protocol; zero semantic drift allowed.
- Exit: `pnpm --filter @smartout/e2e test` green + diff-report shows zero regression.

#### S3.5 — playwright-script-emitter (net-new)

**Subagent:** `protocol-writer` → `code-reviewer`

- Files: `packages/journey-ir/src/emitters/playwright-script.ts` + tests.
- Emitter produces `.spec.ts` that passes `tsc --noEmit`, `eslint`, and `playwright test --list`.
- TDD: golden-file per example journey.

#### S3.6 — user-guide-emitter (net-new, shares IR with docs-generator)

**Subagent:** `docs-tutor` (primary — MDX expertise) + `protocol-writer` (review — shares contract with docs-generator)

- Files: `packages/journey-ir/src/emitters/user-guide.ts` + tests.
- Output: MDX that compiles clean via `@mdx-js/mdx`.
- TDD: golden-file MDX.

#### S3.7 — inference-pattern-emitter

**Subagent:** `system-agent-coordinator`

- Depends on S3.8 (migration).
- Files: `packages/journey-ir/src/emitters/inference-pattern.ts` + tests.
- Output: `engine_trigger` INSERT row with `subtype='journey_inference'` + `journey_version_id` FK.
- TDD: schema-validate via `journey_pattern_rule_schema` Zod.

#### S3.8 — trigger-subtype-migration (0a/0b/0c)

**Subagent:** `system-agent-coordinator`

- Three migrations (ADD column → backfill → tighten CHECK).
- Exit: `engine_trigger` has `trigger_subtype` enum column + `journey_version_id` FK + CHECK.

#### S3.9 — journey-compile-github-action

**Subagent:** `general-purpose` + `supervisor` (review)

- File: `.github/workflows/journey-compile.yml`.
- Trigger: push to `development` on path `docs/journeys/**`.
- Runs `pnpm journey:compile` + commits artefacts to same branch.
- Exit: workflow YAML lints + has branch-protection awareness.

#### S3.10 — cutover (adapter + protocol-reads deletion)

**Subagent:** `protocol-writer`

- DELETE: `packages/journey-ir/src/adapter/protocol-to-journey-ir.ts` + tests.
- DELETE: `apps/e2e/protocols/schema.ts` (or convert to pure re-export then delete next PR).
- Verify: zero `docs/protocol/` reads in any `apps/e2e/generators/*` file.
- Exit: grep zero results + all generators still green.

---

### Gate C — Generator Unification Sign-Off

`/run-council` per §3.3. Expected APPROVE. REJECT halts.

---

### Act IV — M4 Authoring Surface + Store Listing

> **Mission:** Give Platform Admins the seat they've been faking with spreadsheets. A list view that reads `journey_version` by status. A detail view with version history + action toolbar. One `JourneyStoreListingCard` component — strict TS interface, ADR-0177 contract — that renders the same card data on every surface (authoring, store listing, runtime). One `PublishVersionButton` that wires idempotently to `journey.publish_mission` / `journey.publish_guide`. One `StepTimeline` shared between web and mobile. Nordic Split rendered, not hardcoded.
>
> **Theatre of operations:** `apps/web/src/app/platform-admin/journeys/**`, `packages/ui/src/journey/StepTimeline.tsx`.
>
> **Victory conditions:**
> - List view + detail view + action toolbar live and RLS-scoped.
> - `JourneyStoreListingCard` component + TS interface match ADR-0177 exactly; Storybook story renders; `@axe-core/react` clean.
> - Publish actions idempotent (double-click = single version flip); audit row per transition.
> - Spring 35/22/2.2 on every animated element; `useReducedMotion()` respected; Instrument Serif headings; Lucide icons only; 44pt touch target on primary action.
> - Zero hardcoded Tailwind color classes in new files (grep gate).
>
> **Defeat conditions:** card variants proliferate per-surface; publish action not idempotent; any emoji in UI; any `zinc-*` / `gray-*` hardcoded in new code.
>
> **Sub-sorties:** S4.1 (platform-admin-shell) ∥ S4.2 (store-listing-card) ∥ S4.4 (step-timeline-shared) → S4.3 (publish-actions-wiring, after S4.1 + M1 capabilities).

4 sub-sorties per §4.4. Parallelism S4.1 ∥ S4.2 ∥ S4.4, then S4.3 after S4.1.

#### S4.1 — platform-admin-journeys-shell

**Subagent:** `frontend-designer` (UI) + `feature-dev:code-architect` (data flow)

- Files per §2.6.
- List view reads `journey_version` by status (RLS-scoped).
- Detail view shows version history + action toolbar.
- Nordic Split, spring 35/22/2.2, Instrument Serif, Lucide, `useReducedMotion()`.

#### S4.2 — journey-store-listing-card

**Subagent:** `frontend-designer`

- Files: `apps/web/src/app/platform-admin/journeys/_components/JourneyStoreListingCard.tsx` + TS interface + Storybook story.
- ARIA live region.
- 44pt touch target for primary action.
- Accessibility: `@axe-core/react` clean.

#### S4.3 — publish-actions-wiring

**Subagent:** `system-agent-coordinator` + `supervisor` (review)

- Depends on S4.1 + M1 capability skeletons.
- Wires `PublishVersionButton` → Server Action → `journey.publish_mission` / `journey.publish_guide`.
- Idempotent: double-click = single version flip.
- Audit row written per transition.

#### S4.4 — step-timeline-shared

**Subagent:** `frontend-designer`

- File: `packages/ui/src/journey/StepTimeline.tsx`.
- Consumed by M4 (Platform Admin) and M5 (Fjernkontroll).
- 40ms stagger, spring physics, `role="log"` + `aria-live="polite"`.

---

### Act V — M5 Runtime Agent-Guided + Mobile

> **Mission:** The Fjernkontroll ships. Six states (`idle | running | paused | stuck | completed | failed`), 13 commands, 13 events — a pure state machine that's unit-testable in isolation and renders with spring physics on every transition. The stuck-detector migrates from hardcoded to Edge Function via a three-step cutover (dual-write → flip → delete). The mobile thin-client ships: one BFF route, one screen, one emit path resolving `workspace_id` + `actor_id` via `getProfileContext()` before every fire. This is the act that ends the "mobile voice is theatre" era.
>
> **Theatre of operations:** `apps/web/src/components/journey/**`, `apps/web/src/app/api/journey/guided/**`, `apps/mobile/src/screens/journey/**`, `apps/mobile/src/components/agent/AgentSpotlight.tsx`, `supabase/functions/journey-stuck-detector/**`.
>
> **Victory conditions:**
> - Fjernkontroll state machine: 100% command/state coverage in tests; pure, no DOM deps.
> - Stuck-detector cutover Step 2 flipped; legacy goes silent; rollback <5 min via flag.
> - Stuck-detector cutover Step 3 deletes legacy detector; handoff documents closure date.
> - Mobile BFF route proxies only — zero business logic. Mobile screen is sole consumer of `journey.run_guided`.
> - `getProfileContext()` returns non-null `workspace_id` + `actor_id` before every mobile emit; offline queue Zod-validates at enqueue.
> - Stuck-detection latency < 30 s from step timeout → `journey.stuck` event → Fjernkontroll card update.
> - Gate D APPROVES across all 4 review layers.
>
> **Defeat conditions:** any direct capability import in `apps/mobile/`; any emit with empty-string `actor_id`; legacy stuck-detector continuing past Step 3; state machine with impure (DOM/ref) side effects in core logic.
>
> **Sub-sorties:** S5.1 (fjernkontroll) ∥ S5.2 (stuck-detector step 1) ∥ S5.3 (mobile-bff) → S5.4 (mobile thin-client UI) → S5.5 (stuck-detector flip) → S5.6 (stuck-detector delete legacy) → S5.7 (agent-spotlight overlay).

7 sub-sorties per §4.5.

#### S5.1 — fjernkontroll-state-machine

**Subagent:** `frontend-designer` + `supervisor` (reviews state-transition correctness)

- Files: `apps/web/src/components/journey/FjernkontrollStateMachine.ts` + `FjernkontrollPanel.tsx` + tests.
- 6 states, 13 commands, 13 events per spec §Fjernkontrollen.
- Pure state machine → unit-testable in isolation.
- 100% command/state coverage in tests.

#### S5.2 — stuck-detector-step1-dual-write

**Subagent:** `system-agent-coordinator`

- Depends on M3 `trigger_subtype` migration.
- File: `supabase/functions/journey-stuck-detector/index.ts` + `config.toml`.
- Step 1 of cutover: dual-write — new Edge Function emits AND legacy hardcoded detector stays live.
- Document flip date in handoff.
- `WATCHDOG_CRON_SECRET` pattern.

#### S5.3 — mobile-bff-route

**Subagent:** `system-agent-coordinator`

- File: `apps/web/src/app/api/journey/guided/[runId]/route.ts`.
- Proxies to stage-engine calling `journey.run_guided`.
- No business logic in BFF — pure proxy + auth.
- Emits telemetry with `workspace_id` + `actor_id` non-null (ADR-0134).

#### S5.4 — mobile-thin-client-ui

**Subagent:** `frontend-designer` + `walkai-bridge-builder` (for page-tool registry if needed)

- Depends on S5.3.
- Files: `apps/mobile/src/screens/journey/guided/[slug].tsx` + supporting components.
- ONLY consumer of `journey.run_guided` — via BFF.
- `getProfileContext()` integration before every emit.
- Offline queue: Zod-validate payload at enqueue.

#### S5.5 — stuck-detector-step2-flip

**Subagent:** `system-agent-coordinator`

- Depends on S5.2 proven stable (minimum 48h of dual-write telemetry parity).
- Flip: new Edge Function becomes sole emitter. Legacy goes silent.
- Revert-ready: flag-based, rollback in < 5 min.

#### S5.6 — stuck-detector-step3-delete-legacy

**Subagent:** `system-agent-coordinator`

- Depends on S5.5.
- Delete legacy hardcoded detector from wherever it lives.
- Handoff documents closure date.

#### S5.7 — agent-spotlight-mobile-overlay

**Subagent:** `frontend-designer`

- File: `apps/mobile/src/components/agent/AgentSpotlight.tsx`.
- Reads mission plan.
- Orb halo: warm OKLCH hue 50, L 0.7, C 0.12, alpha 0.25, radius 1.5× target, `mix-blend-mode: plus-lighter`.
- `@axe-core/react` clean.

---

### Gate D — Runtime + Mobile Integrity

`/run-council` per §3.4. 4-layer review. Expected APPROVE.

---

### Act VI — M6 Close-Feature Gate + Handoff

> **Mission:** Make the promises of Acts I–V un-breakable in CI. Add journey-specific gates 6–10 to `scripts/close-feature.sh`. Stand up `journey-guardian.yml` as a required status check on every PR into `development`. Write the HANDOFF with every ADR status, every learning, every migration, every cutover closure. Open the promotion PR `campaign/journey-engine → development` and hand control back to the operator. Campaigns don't close; orchestrators do.
>
> **Theatre of operations:** `scripts/close-feature.sh`, `.github/workflows/journey-guardian.yml`, `docs/HANDOFF-journey-engine.md`, `docs/DASHBOARD.md`, `docs/plans/CAMPAIGN-journey-engine.md` (final progress table).
>
> **Victory conditions:**
> - `close-feature.sh` enforces gates 6–10 (emit-registry in commit, authority-seed in commit, stuck-detector cutover documented, zero new `packages/ai/src/journey` refs, zero `ALTER TYPE journey_status ADD VALUE`).
> - `journey-guardian.yml` runs 5 grep gates on every PR; required status check on `development`.
> - HANDOFF lists every ADR (status), every learning (status), every migration (applied date), every cutover step (closure date), every open debt (with next-step pointer).
> - PR `campaign/journey-engine → development` open with all 7 Trust-Gate Unblocks green + every milestone checkbox ticked.
>
> **Defeat conditions:** any gate missing from `close-feature.sh` after S6.1; Journey Guardian CI not set as required check; HANDOFF missing any cutover closure date; orchestrator self-pushes to `development`.
>
> **Sub-sorties:** S6.1 → S6.2 → S6.3 → S6.4. Serial. No parallelism.

4 sub-sorties, serial.

#### S6.1 — close-feature-journey-gates

**Subagent:** `supervisor`

- Modify: `scripts/close-feature.sh` to add gates 6–10 from `CLAUDE.md §Feature closure gates`:
  - Gate 6: emit-registry entry in commit (for journey sub-sorties)
  - Gate 7: authority seed in commit (for new capabilities)
  - Gate 8: stuck-detector cutover documented if touched
  - Gate 9: no new `packages/ai/src/journey` references
  - Gate 10: no `ALTER TYPE journey_status ADD VALUE` introduced

#### S6.2 — journey-guardian-ci-workflow

**Subagent:** `general-purpose` + `supervisor`

- File: `.github/workflows/journey-guardian.yml`.
- Runs all 5 grep gates on every PR.
- Required status check for PRs into `development`.

#### S6.3 — comprehensive-handoff

**Subagent:** `docs-tutor`

- File: `docs/HANDOFF-journey-engine.md`.
- Content: every ADR status, every learning logged, every migration shipped, cutover closure dates, open debt, next steps (post-campaign).

#### S6.4 — campaign-milestone-pr

**Subagent:** Orchestrator itself (not a subagent — this is a gate, not build work).

- Open PR `campaign/journey-engine → development`.
- Pre-merge checklist:
  - [ ] All 7 Trust-Gate Unblocks green
  - [ ] All sub-sorties closed
  - [ ] CI green on campaign branch
  - [ ] `docs/HANDOFF-journey-engine.md` written
  - [ ] `docs/DASHBOARD.md` updated
  - [ ] `CAMPAIGN-journey-engine.md` §Milestones all checkboxes ticked
- Let Pontus review + merge. Orchestrator does NOT push to `development`.

---

## 6. End-to-End Autonomous Execution Procedure

What the orchestrator does, in order, start to finish:

- [ ] **Step 1: Read state**

```bash
cat docs/plans/CAMPAIGN-journey-engine.md
cat docs/superpowers/plans/2026-04-21-journey-engine-orchestration.md
git log --oneline -10
git worktree list
```

- [ ] **Step 2: Load skills**

`preflight`, `run-council`, `subagent-driven-development`, `smartout-database-guide`, `smartout-cascade-developer`, `smartout-nordic-split`, `smartout-edge-function-guide`.

- [ ] **Step 3: Commit this plan to campaign branch**

```bash
git add docs/superpowers/plans/2026-04-21-journey-engine-orchestration.md
git commit -m "docs(plans): add autonomous orchestration plan for journey-engine"
```

- [ ] **Step 4: M0 pre-flight checks** (per §5 M0)

- [ ] **Step 5: Gate A — council run**

Exit condition: APPROVE or APPROVE WITH CHANGES. Apply inline changes.

- [ ] **Step 6: M1 parallel window 1 — dispatch S1.1 + S1.2**

Run `preflight`. Single message with 2 Agent calls. Wait for both.

- [ ] **Step 7: M1 review round + close**

For each of S1.1, S1.2: dispatch code-reviewer, resolve findings, run exit gates, `/close-feature`.

- [ ] **Step 8: M1 serial — S1.3 then S1.4**

- [ ] **Step 9: M1 exit — ADR status bumps + CAMPAIGN progress update**

- [ ] **Step 10: M2 parallel window 2 — S2.1 + S2.5**

- [ ] **Step 11: M2 parallel window 3 — S2.2 + S2.3 + S2.4**

- [ ] **Step 12: Gate B — council run + v1.7.0 spec draft**

- [ ] **Step 13: M3 parallel window 4 — S3.1 + S3.5 + S3.6 + S3.8 + S3.9**

Run `preflight` with token-budget check (5 agents × ~20k = 100k; at limit).

- [ ] **Step 14: M3 parallel window 5 — S3.2 + S3.3 + S3.4**

- [ ] **Step 15: M3 serial — S3.7 + S3.10 (cutover)**

- [ ] **Step 16: Gate C — council run**

- [ ] **Step 17: M4 parallel S4.1 + S4.2 + S4.4 then serial S4.3**

- [ ] **Step 18: M5 parallel S5.1 + S5.2 + S5.3 then S5.4 after S5.3 then S5.5–S5.7 serial**

- [ ] **Step 19: Gate D — council run**

- [ ] **Step 20: M6 serial S6.1 → S6.2 → S6.3 → S6.4**

- [ ] **Step 21: Hand off to user**

Report campaign status + open PR link + invite user to review/merge.

### 6.1 Halt Conditions (stop and ask user)

Stop and report to user when:
1. Any council returns REJECT or DEGRADED-MODE with <3 reviewers.
2. Any sub-sortie subagent fails twice consecutively.
3. Typecheck fails on a sub-sortie and 2× re-dispatch doesn't fix.
4. Migration timestamp collision can't be resolved by rename.
5. Scope creep detected (sub-sortie touches sibling-campaign surface).
6. Close-feature gate fails and root cause requires architectural change.
7. Budget exhaustion (tokens / time / CI minutes).
8. User-specific decision needed (e.g. "which of two Store Listing Card variants?").

### 6.2 Resume Conditions (safe to continue autonomously)

Resume after user input when:
1. User provides missing context.
2. User approves proceeding in DEGRADED-MODE.
3. User specifies override for a scope-ambiguous case.
4. User confirms safe-to-destroy operation (e.g. delete legacy adapter).

### 6.3 Progress Reporting

Orchestrator posts a one-sentence update:
- At the start of each milestone.
- When a council gate begins and ends.
- When entering and exiting a parallel dispatch window.
- On any halt condition.
- At campaign completion.

Silent between updates.

---

## 7. Trust-Gate Unblock Traceability

Every Unblock maps to specific sub-sorties. If any Unblock sub-sortie fails, that Unblock stays red and the M2 exit / Gate B is blocked.

| # | Unblock | Primary sub-sortie | Verifier |
|---|---|---|---|
| 1 | Telemetry registry | S1.1 | grep `journey\\.` count ≥ 5 in `registry.ts` |
| 2 | Enum lifecycle 0a/0b/0c | S1.2 | migrations applied + zero `ALTER TYPE journey_status ADD VALUE` |
| 3 | C4 authority seed migration | S1.3 | migration has 4 rows, zero runtime inserts |
| 4 | Capability skeletons | S1.4 | 4 files in `packages/ai/src/capabilities/journey/`, authority defaults match ADR-0173 |
| 5 | `packages/journey-ir` created | S2.1 + S2.2 | package exists + zero `packages/ai/src/journey` refs |
| 6 | `actor_id` resolution doc | S2.3 | ADR-0176 §Appendix exists + 4 capabilities covered |
| 7 | ADR-0074 unification delta spec | S2.4 | ADR-0174 §Appendix exists + deletion window defined |

---

## 7.5 What We Earn — the outcome fence

When M6 closes and the operator promotes `campaign/journey-engine → development`, these are the measurable changes from the day we started:

| Before this campaign | After this campaign |
|---|---|
| Three parallel systems (protocols, journeys, missions) silently diverge. | One `JourneyIR`. Five emitters. Zero divergence. |
| `emit()` calls land without registry entries — L-0094 is at 4th occurrence. | CI grep gate fails on any `emit('journey.*')` without a registry row. Phase 2.5 grep mandatory before every council Phase 3. |
| `engine_authority_config` rows appear at runtime; default-allow combos ship unchecked. | Every capability seeded via migration; zero runtime inserts; zero default-allow combos on journey capabilities. |
| `journey_status` collisions force `ALTER TYPE ADD VALUE` gymnastics. | `journey_version_status` enum migrated via 0a/0b/0c; CI gate forbids the shortcut forever. |
| `packages/ai/src/journey/compile.ts` + 1 consumer, drifting from ADR-0171. | `packages/journey-ir` canonical, `packages/ai/src/journey` deleted, grep gate enforces zero references. |
| Protocol Verification Engine (ADR-0074) still parallel to journey system. | Adapter bridged the unification; cutover closed; adapter deleted in same PR as last migration. |
| Mobile "voice" never reaches stage-engine; `workspace_id` / `actor_id` occasionally empty. | Mobile thin-client goes through BFF; `getProfileContext()` on every emit; offline queue Zod-validated. |
| Stuck-detection depends on hardcoded logic nobody reads. | Edge Function `journey-stuck-detector` with documented 3-step cutover; legacy deleted; latency < 30 s from step timeout to event. |
| Fjernkontroll exists only in the spec. | 6-state machine shipped, 100% test coverage, spring 35/22/2.2, `useReducedMotion()` respected, 44pt touch targets, Nordic Split rendered. |
| Platform Admins edit journeys via spreadsheet + prayer. | `apps/web/src/app/platform-admin/journeys/*` ships list + detail + publish. Idempotent actions. Audit row per transition. |
| 7 ADRs `proposed`, 5 learnings recurring. | 7 ADRs `accepted`. 5 learnings become enforced CI gates. Recurrence stops. |
| `close-feature.sh` agnostic to journey semantics. | Gates 6–10 enforce journey discipline on every sub-sortie close. Journey Guardian CI required on every PR into `development`. |

**The singular thing this campaign unlocks:** Smartout's promise of "author once, run three ways" becomes factual, not aspirational. Every future journey lands via the same path. The campaign ends, the engine remains.

---

## 8. Self-Review Checklist (orchestrator runs before execution)

- [ ] **Spec coverage:** Every section of `2026-04-21-journey-runner-suite-mental-model.md` mapped to at least one sub-sortie. Sections checked:
  - 3 journeys (Dev / Docs & Mission / Runtime) → M5 + M4
  - 1 IR, 5 artefacts → M2 + M3
  - Versjons-bundet publisering (`journey_version` + `journey_artifact`) → S2.5
  - Governance + lifecycle → S2.5 audit triggers + S4.3 publish wiring
  - Fjernkontroll 6-state + 13-command + 13-event → S5.1
  - CDP sub-spec handoff → noted in M5 (deferred to sub-spec)
  - ADR-0074 unification → M3 fully
  - `engine_trigger` extension for inference → S3.7 + S3.8
  - Source-of-truth migrasjon (68 DB records → markdown) → M3 (not explicitly sortied — add if council flags in Gate A)
  - Design-addendum (Nordic Split) → M4 + M5
  - 12 build items → M1-M5

- [ ] **Placeholder scan:** Grep this plan for TODO / TBD / "implement later" / "fill in details" / "similar to" → zero matches. Found any? Fix inline before execution.

- [ ] **Type consistency:** Cross-check capability names across sub-sorties:
  - `journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided` — same 4 names throughout.
  - Event names: `journey.run_started`, `journey.step_reached`, `journey.completed`, `journey.stuck`, `journey.run_failed` — same 5 throughout.
  - File paths: `packages/journey-ir/` not `packages/journey_ir/` or `packages/ai/journey-ir/`.

- [ ] **Dependency graph DAG-check:** Parallelism map (§4) has no cycles. Each sub-sortie's dependencies are all listed.

- [ ] **Council gates have briefings:** Gates A, B, C, D each have a topic, type, key-question-per-reviewer, and expected verdict noted (§3).

- [ ] **Failure handling covers known traps:** L-0075 migration atomicity, L-0094 phantom-emit, L-0066/L-0097 authority defaults, L-0098 global-scripts cutover — all referenced.

- [ ] **CLAUDE.md alignment:** Campaign CLAUDE.md's "What NOT To Do" rules all mirrored as either invariants or sub-sortie exit gates.

---

## 9. Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-21-journey-engine-orchestration.md`.**

Ten weeks. Six acts. Four gates. ~25 sub-sorties. Seven Trust-Gate Unblocks. Zero phantom contracts, zero default-allow authority combos, zero drift between dev, docs, and runtime. One operator holding the promotion gate at M6.

### Two execution modes

**1. Subagent-Driven (recommended)** — Orchestrator dispatches a fresh subagent per sub-sortie, reviews between sub-sorties, runs council at the 4 gates. Fast iteration, strict scope per sub-sortie. Follows `superpowers:subagent-driven-development`. Every sub-sortie starts cold, reads its brief, does its one job, returns a diff.

**2. Inline Execution** — Orchestrator itself executes sub-sorties in this session using `superpowers:executing-plans`, with batch checkpoints at each milestone boundary. Slower, but keeps full context for cross-sortie consistency when dispatching loses too much fidelity.

**Anbefaling:** **1 — Subagent-Driven.** Jeg veide to ting: (a) 20+ sub-sorties over 10 uker vil kollapse én enkelt agent-kontekst under akkumulert tokens; (b) hver sub-sortie har en godt avgrenset kontrakt (filer, exit gates, dispatch brief) som en fersk agent kan lese kaldt og levere på. Inline-mode taper ingenting på cross-sortie consistency som ikke allerede er dekket av exit gates + council gates. Bytt til inline **kun** ved ≥ 2 halt-forhold (§6.1) på rad, så tilbake til subagent-driven når root-cause er ryddet.

### Dette er det som venter

- Om jeg starter nå: jeg går rett på M0 pre-flight → Gate A council → M1 parallel window 1 (S1.1 + S1.2).
- Om du vil reviewe først: jeg stopper her, svarer spørsmål om planen, og venter på klarsignal før M0.
- Ved enhver halt-forhold (§6.1): jeg rapporterer umiddelbart med én setning og venter.

**Skal jeg starte autonom kjøring (option 1 — anbefalt), eller vil du reviewe planen først før jeg kjører M0?**
