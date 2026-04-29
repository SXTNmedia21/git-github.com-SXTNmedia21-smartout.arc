---
title: "Plan — Arena Harness Migration (heartbeat-as-mission-dispatcher)"
id: PLAN_ARENA_HARNESS_MIGRATION
status: draft
created: 2026-04-29
updated: 2026-04-29
owner: harness-builder
worktree: ~/dev/smartout.ai-wt-4
branch: feat/botsson-harness-expansion
module: MODULE_BOTSSON
tags: [harness, arena, mission-dispatch, heartbeat, migration]
---

# Arena Harness Migration

## Intro — sett deg riktig før du leser videre

Dette er en **bunnsolid plan som fundamentalt endrer mulighetene våre framover.** Vi bygger en hjerterytme inn i Smartout — en heartbeat som slår jevnt og dispatchere oppgaver til agenter som er kalibrert for å løse dem. Selve produktet og selve utviklingen kjøres på samme motor. Pontus og Claude piller. Alt annet eksekverer.

**Ekstremt viktig:**
- **Ingenting eksisterende skal forstyrres.** Phase 0–2 er strengt additive. Eksisterende capabilities, stage-engine, BFF og Botsson rører vi ikke før de migreres én-for-én i Phase 3 med 7-dagers parallel-trace.
- **Falsifiable test først.** Hver fase har en Harness Candidate-test. Den skal feile rødt før implementasjon, og bli grønn 3 ganger på rad før neste fase låses opp.
- **Mission-folder = sannhet.** All agent-atferd er beskrevet i `docs/journeys/<slug>/`. Ingen kjernekode-endring trengs for å legge til ny agent.

**Les først, i rekkefølge:**
1. **§Why** — to systemiske gap (phantom-consumer B1 + manglende N-C worker) som planen lukker.
2. **§Hard constraints** — 10 lover som er ufravikelige under hele migrasjonen.
3. **§Phase 0** — Krona. Tre uker eller mindre. Når denne står, står alt resten.
4. **`harness-candidate-0-crown.spec.ts`** — det første du skriver. Falsifiable acceptance for hele prosjektet.
5. **Migration `engine_state` scheduling-kolonner** — hele dispatch-loopen hviler på tre nullable kolonner.
6. **`heartbeat-dispatcher` Edge Function** — nøkkelen til framgang. Cron + `FOR UPDATE SKIP LOCKED` + `pg_notify`. ~50 linjer, gjør resten mulig.

**Nøkkelmetafor:** Vi bygger ikke en ny Smartout. Vi bygger en parallell dispatch-loop som dag-for-dag absorberer eksisterende kall. Hver overflate fungerer til den dagen dens migrasjon-fase starter. Cutover er per-capability, gated, og reversibel.

**Suksessivt. Ingenting bryter. Krona først.**

---

> **Mantra:** First build the crown. Prove the heartbeat. Then migrate the project onto it. Suksessivt. Nothing existing breaks.

> **What this plan IS:** an additive build of a heartbeat-driven mission-dispatch loop, then progressive migration of existing Smartout components onto it.
>
> **What this plan IS NOT:** a refactor of stage-engine, capabilities, BFF, or Botsson. None of those are touched in Phase 0–2. They migrate one-by-one in Phase 3 with backward-compat parallel paths.

---

## Why

Two systemic gaps today:

1. **Phantom-consumer (B1).** Capabilities write `engine_state`; stage-engine reads `engine_sessions`; no producer emits `journey.completed/stuck/run_failed`. Fjernkontroll renders `active` indefinitely.
2. **No N-C worker.** `run_dev` queues `engine_state` rows. Nothing dequeues them in cloud. Local Playwright path works; cloud path dormant. Tracked in handoff §Known Open-Loop.

Plan closes both via heartbeat-dispatcher → mission-pool worker pattern. Same pattern serves customer journeys AND development missions (writing ADRs, refreshing system-map, running trend-ingestion).

---

## Architectural premise

```
heartbeat (cron, every Nm)
   ↓ SELECT engine_state WHERE status='scheduled' AND scheduled_for <= now() FOR UPDATE SKIP LOCKED
   ↓ pg_notify('mission_dispatch', mission_id)
mission-pool worker (1..N slots)
   ↓ LISTEN mission_dispatch
   ↓ load journey-folder (MISSION.md, LICENSE.md, RESCUE-PROMPT.md, FLOW.md, ir/journey.yaml)
   ↓ verify hash, derive workspace_id, load authority
agent boot (packages/agent-sdk)
   ↓ LLM main-loop with tool-proxy
   ↓ stage-engine routes capability calls (existing gatedMutation per ADR-0204)
stage-engine FLOW broker
   ↓ per FLOW.md row: validate event registry-bound, emit, advance step
   ↓ terminal: emit journey.completed | journey.stuck | journey.run_failed
   ↓ if recurrence != null: re-schedule next run
```

Two new tables-columns. No new tables. No new gating layer. Every existing invariant preserved.

---

## Hard constraints

1. **Additive only.** No delete, rename, or signature-change of existing files in Phase 0–2.
2. **Backward-compat parallel paths in Phase 3.** Direct capability calls keep working until cutover criteria met.
3. **No new telemetry events without ADR amendment.** Reuse existing 5 events (`journey run_started`, `step_reached`, `completed`, `stuck`, `run_failed`).
4. **No new authority gates.** Reuse `gatedMutation` (ADR-0204) and `engine_authority_config` (frozen-4 capabilities, ADR-0173).
5. **`workspace_id` derived server-side (ADR-0151).** Never from request body or mission payload.
6. **RLS on every new table.** Every new column on existing tables ships with policy update.
7. **Falsifiable acceptance test BEFORE implementation.** Each phase has a Harness Candidate test; it must fail first, then pass.
8. **Phase frontmatter in every new file.** `phase: 0` / `phase: 1` / etc., so we can find and grade work.
9. **Commit body opens with `phase-N-step-M:` token; subject stays conventional.** Project commitlint (`@commitlint/config-conventional`, enforced via `commit-msg` hook) rejects non-conventional subject types. Use a conventional subject (`feat(harness):`, `test(harness-candidate):`, `docs(harness):`) and put `phase-0-step-1:` (etc.) as the first body line. `git log --grep "phase-0"` matches body text and returns crown commits — the filterability goal is preserved without breaking commitlint or skipping hooks.
10. **No production deploys until Phase 0 + 1 acceptance green.** Phase 0 and 1 run on local Supabase + dev container.

---

## Phase 0 — Build the crown (zero disruption)

**Goal:** heartbeat dispatcher + one mission-pool slot that runs ONE dummy dev-mission end-to-end. No customer touch.

### Step 0.1 — Migration: scheduling columns

File: `supabase/migrations/<ts>_engine_state_scheduling.sql`

```sql
ALTER TABLE engine_state
  ADD COLUMN scheduled_for timestamptz,
  ADD COLUMN recurrence interval,
  ADD COLUMN dispatch_lock_id uuid;

CREATE INDEX idx_engine_state_dispatch
  ON engine_state (scheduled_for)
  WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;

COMMENT ON COLUMN engine_state.scheduled_for IS 'Heartbeat dispatch time. NULL = run-now manual. Past timestamp = ready for pickup.';
COMMENT ON COLUMN engine_state.recurrence IS 'Re-schedule interval after terminal status. NULL = one-shot.';
COMMENT ON COLUMN engine_state.dispatch_lock_id IS 'Set by heartbeat under FOR UPDATE SKIP LOCKED to prevent double-dispatch.';
```

Idempotent. Drops nothing. Existing rows unaffected (`scheduled_for IS NULL`).

### Step 0.2 — Heartbeat dispatcher Edge Function

File: `supabase/functions/heartbeat-dispatcher/index.ts`

Behavior:
- Cron schedule via Supabase pg_cron (`*/1 * * * *` for crown, `*/5` for prod).
- Selects up to 50 rows: `WHERE status='scheduled' AND scheduled_for <= now() FOR UPDATE SKIP LOCKED`.
- Sets `dispatch_lock_id = gen_random_uuid()`, `status = 'pending'`.
- Calls `pg_notify('mission_dispatch', json_build_object('engine_state_id', id, 'mission_id', mission_id)::text)`.
- Emits one telemetry event per dispatch (`journey run_started` already exists, reuse).
- Acceptance: function deploys, manual `select * from heartbeat_dispatcher_run()` picks up scheduled row, emits notify.

### Step 0.3 — Mission-pool slot prototype

File: `services/stage-engine/src/workers/mission-pool-slot.ts`

Behavior:
- Single Hono route or daemon entry: `LISTEN mission_dispatch`.
- On notify: fetch engine_state row, fetch mission folder from repo (read-only, mounted volume).
- Validate `ir/journey.hash` against `ir/journey.yaml` sha256.
- Derive `workspace_id` from `engine_state.workspace_id` (server-side, never request body).
- Load LICENSE.md → idempotent CROSS JOIN authority insert (already pattern, ADR-0176).
- Load MISSION.md → boot agent via agent-sdk.
- Run main-loop. On terminal: update `engine_state.status`, emit `journey.completed`/`stuck`/`run_failed`.
- If `recurrence IS NOT NULL`: insert NEW engine_state row with `scheduled_for = now() + recurrence, status='scheduled'`.

NOT yet building: full FLOW broker, stuck-detection, RESCUE-PROMPT loader. Stub these. Return `complete` after dummy steps.

### Step 0.4 — First dev-mission folder (the meta-mission)

Folder: `docs/journeys/dev-arena-bootstrap/`

Files:
- `MISSION.md` — persona "harness-builder", 3 dummy stages: log step 1, log step 2, emit completion
- `LICENSE.md` — authority profile `internal-platform-admin` (no workspace mutations)
- `RESCUE-PROMPT.md` — minimal: "log error, mark failed"
- `FLOW.md` — 3 rows, all `actor: agent`, all events from existing registry (`journey run_started`, `journey step_reached` ×2, `journey completed`)
- `ir/journey.yaml` — minimal IR
- `ir/journey.hash` — sha256

Path-prefix `dev-` distinguishes from customer journeys (no ROADMAP.md required).

### Step 0.5 — Harness Candidate 0 (acceptance test)

File: `apps/e2e/tests/harness-candidate-0-crown.spec.ts`

Steps:
1. Insert `engine_state` row: `mission_id='dev-arena-bootstrap'`, `status='scheduled'`, `scheduled_for=now() - interval '1 minute'`, `workspace_id=<test-workspace>`.
2. Wait up to 90s for `engine_state.status='complete'`.
3. Assert: 1× `journey run_started`, 2× `journey step_reached`, 1× `journey completed` in `engine_event` for that engine_state_id.
4. Assert: no `journey run_failed` in same window.
5. Assert: `dispatch_lock_id IS NOT NULL` (proof heartbeat picked it up via FOR UPDATE SKIP LOCKED).

Test must fail before Step 0.1–0.4 land. Must pass before Phase 1 starts.

### Phase 0 gate

- All 5 steps committed
- Test runs 3 consecutive times, all green
- No regression on existing E2E suite (`pnpm turbo test:e2e`)
- Migration runs idempotent (`supabase db reset` followed by redo)

---

## Phase 1 — Prove meta-loop with first real dev-mission

**Goal:** heartbeat dispatches the writing of ADR-0246. Mission produces a real PR.

### Step 1.1 — Mission folder for ADR-0246

Folder: `docs/journeys/dev-adr-0246-base-consolidation/`

`MISSION.md` stages:
1. Read `docs/architecture/SMARTOUT_PRODUCTION_ARCHITECTURE.md` and `infra/docker-compose.*.yml`
2. Read `docs/templates/decision.md`
3. Compose ADR-0246 draft per Steward's structural fix (base.yml complete, prod.yml additive-only)
4. Write `docs/decisions/0246-base-yml-consolidation.md`
5. Append entry to `docs/decisions/0000-decision-log.md`
6. Open PR via `gh pr create` against `development`
7. Emit `journey.completed`

`LICENSE.md`: `internal-platform-admin` scope, allow `gh` shell, allow Edit on `docs/decisions/`, deny everything else.

`FLOW.md`: 7 rows, all events bound to existing registry.

### Step 1.2 — Manual approval gate

Pontus reviews mission folder. If approved: `UPDATE engine_state SET status='scheduled', scheduled_for=now() WHERE mission_id='dev-adr-0246-base-consolidation'`. Heartbeat picks up within next tick.

### Step 1.3 — Acceptance

- PR opened in GitHub by mission-pool worker
- ADR-0246 file exists with sections per template
- decision-log updated
- All 7 FLOW events emitted

### Phase 1 gate

- ADR-0246 PR merged after human review
- Mission re-runnable (insert another engine_state row, runs again, idempotent)

---

## Phase 2 — Plug gap B1 (gated on ADR-0245 council accept)

**Goal:** consolidate `engine_state` vs `engine_sessions` ontology per ADR-0245 verdict.

DO NOT START Phase 2 until:
- ADR-0245 status `accepted` in decision-log
- Migration plan for stage-engine ontology shift in ADR-0245 §Implementation
- Council retrospective signed off

### Step 2.1 — Pick smallest blast-radius capability

Recommend: `governance`. Lowest read-volume, simplest authority-shape.

### Step 2.2 — Build ontology bridge

If ADR-0245 verdict is "consolidate on `engine_state`":
- Add `engine_state` reader to stage-engine `core/session-manager.ts`
- Keep `engine_sessions` reader live (parallel-read for 7 days)
- Compare every read for trace-divergence; emit `ontology.read_divergence` if mismatch

If verdict is "bridge":
- Stage-engine reads union of both, prefers `engine_state` if mission_id present

### Step 2.3 — Acceptance

- governance E2E passes on `engine_state` path
- 7 days zero divergence on parallel-read
- ADR-0245 §Implementation step ticked

### Phase 2 gate

- 7-day clean parallel-read
- Cutover commit removes `engine_sessions` read for governance only
- Other capabilities still on `engine_sessions` (Phase 3 migrates them one-by-one)

---

## Phase 3 — Migrate existing customer-agents

**Goal:** every customer-facing capability runs through mission-pool with FLOW-driven dispatch.

Order (smallest blast-radius first):
1. `memory` (already a fresh capability per Phase A3, lowest risk)
2. `governance` (Phase 2 already migrated reader)
3. `operations`
4. `communication`
5. `training`
6. `shift_lifecycle`
7. `schedule` (deferred — has known bugs per system-map)
8. `contract_intake`
9. `contract`
10. `shift_swap`
11. `operations_intelligence`
12. `billing_query`
13. `profile`
14. `ui`
15. `guardian`
16. Botsson chat (last, biggest)

### Per-capability migration template

For each capability:

1. **Wrap as mission folder:** `docs/journeys/customer-<capability-slug>/`
2. **Adapter in stage-engine:** when intent classified to this capability, route to mission-pool instead of direct call
3. **Backward-compat:** old direct-call path stays live, emits `legacy.direct_call` event for comparison
4. **Parallel-trace for 7 days:** mission-pool path produces identical `engine_event` sequence to direct-call path
5. **Cutover:** delete adapter route, capability now only callable via mission

### Phase 3 gate

- 5 capabilities migrated with zero production incidents
- 7-day parallel-trace per capability shows zero divergence
- Botsson chat migration is its own sub-sortie with full council review

---

## Phase 4 — Service-pool (off-Arena agents)

**Goal:** internal/utility agents (ADR-writer, schema-migrator, code-reviewer, test-runner) run as service-pool, not mission-pool.

### Step 4.1 — Service-pool kontrakt

- New table `engine_service_agents` (slug, capabilities[], schedule, last_run, status)
- Service-agents register on container boot
- Triggered by cron / webhook / Linear event, not by `engine_state` rows
- Emit to `activity_trail` with `actor_kind='service_agent'`

### Step 4.2 — Migrate ADR-writer (already proven in Phase 1)

Generalize the dev-adr-0246 mission into reusable ADR-writer service.

### Phase 4 gate

- ADR-writer runs as service-agent, not mission
- 3 successful ADR-writer invocations from Linear-issue triggers

---

## Phase 5 — Governance recurring missions

**Goal:** the loops run themselves.

Mission folders, all with `recurrence`:
- `docs/journeys/recurring-system-map-refresh/` — 7d
- `docs/journeys/recurring-adr-drift-sample/` — weekly
- `docs/journeys/recurring-trend-ingestion-anthropic/` — weekly
- `docs/journeys/recurring-trend-ingestion-nextjs/` — weekly
- `docs/journeys/recurring-trend-ingestion-supabase/` — weekly
- `docs/journeys/recurring-trend-ingestion-regulatorisk/` — monthly
- `docs/journeys/recurring-agent-rotation-evaluator/` — monthly
- `docs/journeys/recurring-council-retrospective/` — monthly

Each terminal-state re-schedules itself.

### Phase 5 gate

- 5 recurring missions running for 30 days without manual intervention
- All produce evidence-artifacts (research-log entries, system-map commits, retrospective reports)

---

## What Harness starts with — TODAY

1. **Read this plan.** Confirm understanding of Phase 0 hard constraints.
2. **Branch already exists** (`feat/botsson-harness-expansion` in WT4). No new worktree needed for Phase 0–1.
3. **Step 0.1:** write the migration `<ts>_engine_state_scheduling.sql`. Run `npx supabase db reset` locally. Verify columns exist, index created, no data loss.
4. **Step 0.5 first:** write `harness-candidate-0-crown.spec.ts`. Make it fail. This is the falsifiable acceptance.
5. **Step 0.2:** heartbeat-dispatcher Edge Function. Reuse `journey-stuck-detector/index.ts` pattern.
6. **Step 0.3:** mission-pool slot in stage-engine. Single slot, single concurrency. Don't over-engineer.
7. **Step 0.4:** dev-arena-bootstrap mission folder. Minimal IR, 3 dummy steps.
8. **Run Harness Candidate 0.** Iterate until green 3 consecutive runs.
9. **Commit phase-by-step.** Subject prefix `phase-0-step-N`.
10. **Open Phase 0 PR** to `development`. Wait for human review (Pontus).

---

## What's important when changing

| Rule | Why | How to apply |
|---|---|---|
| Additive only in Phase 0–2 | Zero disruption | Never delete or rename existing files. Never change function signatures. New code in new files. |
| Falsifiable test first | Acceptance proven, not claimed | Write `harness-candidate-N-*.spec.ts` BEFORE implementation. Run it red, then implement to green. |
| Reuse `gatedMutation` | ADR-0204 invariant | Every capability call inside missions goes through existing wrapper. No new gate. |
| Reuse 5 telemetry events | ADR-0175 frozen | If new event needed, draft ADR amendment first, do not add ad-hoc. |
| Server-derive `workspace_id` | ADR-0151 invariant | Mission-pool worker reads `engine_state.workspace_id`. Never trusts mission-payload. |
| RLS on new tables/columns | Database law | `engine_state.scheduled_for`, `recurrence`, `dispatch_lock_id` covered by existing RLS. New table `engine_service_agents` (Phase 4) ships with RLS in same migration. |
| `journey.hash` verification | ADR-0178 invariant | Worker MUST verify sha256(`ir/journey.yaml`) == `ir/journey.hash` before agent boot. Mismatch = fail with `mission.tampered` event. |
| Parallel-path during migration | Zero-incident cutover | Phase 3 keeps direct-call alive next to mission-call. Cutover only after 7 days zero divergence. |
| Path-prefix `dev-` vs no-prefix | Skill-gate distinction | Dev missions skip ROADMAP.md (no UX entry). Customer missions enforce ROADMAP+MISSION pairing per ADR-0224. |
| Phase-frontmatter in every new file | Auditability | `phase: 0` etc. so `grep -r "phase: 0" docs/journeys` returns crown-build artefacts. |
| Commit prefix `phase-N-step-M:` | Filterable history | `git log --grep "phase-0"` returns crown commits. |
| Never skip hooks (`--no-verify`) | CLAUDE.md law | Fix the hook failure root cause. |
| No `--squash` on campaign merge | ADR-0213 | Merge-commit preserves ancestry. |

---

## Coordination

| Track | Owner | Output |
|---|---|---|
| ADR-0245 ontology council prep | Claude (orchestrator) | Council brief + draft ADR for review |
| ADR-0246 base.yml consolidation | Claude → Phase 1 mission output | PR opened by mission-pool worker |
| Infra / hardware / secrets | Pontus | Droplet ready, 1Password vault sync, Vercel env, Supabase env |
| Phase 0–5 build | Harness builder agent | PR per phase, all gates green |
| Plan revisions | Claude | This file updated as we learn |

---

## Failure modes Harness must handle

| Mode | Symptom | Action |
|---|---|---|
| Heartbeat double-dispatch | Same mission picked up twice | `FOR UPDATE SKIP LOCKED` + `dispatch_lock_id` prevents. If observed: dump `dispatch_lock_id`, file regression. |
| Mission folder missing | Worker can't load MISSION.md | Emit `mission.folder_missing`, mark `failed`, do not retry without human. |
| IR hash mismatch | Tampered journey | Emit `mission.tampered`, mark `failed`, alert via guardian. |
| Capability call denied by gate | Authority misconfig | Emit `mission.authority_denied`, mark `failed`, RESCUE-PROMPT loaded for next attempt. |
| LLM timeout | Provider down | Retry with backoff (3 attempts), then `failed`, RESCUE-PROMPT escalation. |
| Recurrence past 24h skipped | Cron missed window | Heartbeat catches up: any past `scheduled_for` eligible. Document expected lateness in MISSION.md. |
| Migration runs partially | Down between Phase 0 steps | Migrations idempotent. `supabase db reset` re-applies cleanly. |

---

## Self-test before declaring crown done

```bash
# In WT4
pnpm turbo typecheck                                      # 0 errors
pnpm turbo test:e2e -- harness-candidate-0-crown          # 3 consecutive green
npx supabase db reset && npx supabase migration up        # idempotent
git log --grep "phase-0" --oneline                        # ≥ 5 commits
ls docs/journeys/dev-arena-bootstrap/                     # 6 files (MISSION, LICENSE, RESCUE, FLOW, ir/yaml, ir/hash)
gh pr view <crown-pr-number> --json mergeable             # MERGEABLE: true
```

When all six checks pass: Phase 0 complete. Pontus reviews PR. Merge. Phase 1 starts.

---

## What this plan deliberately defers

- **ADR-0245 ontology decision.** Goes to council in parallel. Plan's Phase 2 is gated on it.
- **Voice-agent Dockerfile (ADR-0250).** Phase 0–2 don't need voice. Address in Phase 3 when migrating Botsson voice mount.
- **`engine_service_agents` table.** Phase 4. Service-pool not needed for crown.
- **FLOW dashboard rendering.** Phase 5. FLOW-event matching minimum-viable in Phase 0; full live-render later.
- **Mobile thin-client integration.** Phase 6+ (out of scope of this plan).
- **stuck-detector reactivation (ADR-0215 Option A).** Triggers naturally when mission-pool emits `journey.stuck` in Phase 0–1. Can flip ADR-0215 status to `accepted-A` once observed live.

---

## Final note to Harness builder

You are not refactoring Smartout. You are building a parallel dispatch loop that one-day-at-a-time absorbs the existing capability calls. Every existing surface keeps working until its migration phase. Cutover is per-capability, gated, and reversible.

The crown is small. Build it, prove it, then absorb the project into it. Suksessivt.
