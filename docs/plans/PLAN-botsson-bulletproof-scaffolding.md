---
title: "Botsson Harness Bulletproof Scaffolding — Closed-Loop on Journey Engine"
id: PLAN_BOTSSON_BULLETPROOF_SCAFFOLDING
status: draft
layer: plan
created: 2026-04-30
updated: 2026-04-30
depends_on:
  - docs/architecture/BOTSSON-SYSTEM-MAP.md
  - docs/plans/CAMPAIGN-journey-engine.md
  - ADR-0151
  - ADR-0173
  - ADR-0186
  - ADR-0204
  - ADR-0240
---

# Botsson Harness Bulletproof Scaffolding — Closed-Loop on Journey Engine

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. **No task ships without falsifiable acceptance proof. Kill at every gate failure — no soft-pass, no retry, no skip.**

**Goal:** Run every Botsson harness sortie as an instance of the journey-engine itself — `engine_missions` blueprint, `engine_state` runtime, `engine_state_step` per gate. Closed feedback loop: each step emits a falsifiable signal, the next step refuses to fire until prior signal is GREEN. Kill-switch on red — no forward motion without proof.

**Tech Stack:** Existing journey-engine (`engine_missions`, `engine_stages`, `engine_state`, `engine_state_step`, `engine-dispatch` Edge Function), Stage Engine telemetry, `gatedMutation()` orchestrator, pg_notify guardian bus, GitHub Actions, bash entry points.

**Source documents:**

- `docs/architecture/BOTSSON-SYSTEM-MAP.md` — pipe diagram (status verified 2026-04-30)
- `docs/plans/CAMPAIGN-journey-engine.md` — journey-engine campaign log
- `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` — cascade core
- ADR-0151 (server-derived profile_id), ADR-0173 (capability ownership), ADR-0186 (guardian fanout), ADR-0204 (gatedMutation), ADR-0240 (cross-namespace writes)
- L-0176 (docstring/body drift), L-0177 (silent workspace fallback), L-0178 (dual chat surface)

---

## Core Principle — Closed Loop, Kill on Red

```
        ┌─────────────────────────────────────────────────────────┐
        │  BOTSSON SORTIE = engine_state instance of MISSION_X    │
        │                                                          │
        │   Step 1 → emit signal → verify → GREEN ──┐              │
        │                                            ▼             │
        │                                        Step 2            │
        │                                            │             │
        │                                            ▼             │
        │                                        emit signal       │
        │                                            │             │
        │                                            ▼             │
        │                                       verify → RED       │
        │                                            │             │
        │                                            ▼             │
        │                                       ⛔ KILL            │
        │                                            │             │
        │                                            ▼             │
        │                                       engine_state.status│
        │                                          = 'failed'      │
        │                                       (no rollback to    │
        │                                        green without     │
        │                                        operator action)  │
        └─────────────────────────────────────────────────────────┘
```

**Three rules — non-negotiable:**

1. **Every gate emits a falsifiable signal.** Boolean GREEN/RED + machine-readable artifact (test output, file diff, type check exit). Vibes don't pass.
2. **Next step blocks on prior signal.** `engine-dispatch` refuses to advance `engine_state.current_stage_id` if previous step's signal is missing or RED.
3. **Kill on red — no soft-pass.** RED = `engine_state.status = 'failed'`, sortie halts, operator must explicitly resume after fix. No "skip", no `--force`, no environment override.

This collapses the five-ring scaffolding (preflight / observability / post-merge / recovery / map-check) into **one runtime: the journey engine itself**, applied to its own builders.

---

## Architecture Overview

The journey-engine already has the primitives. This plan **registers Botsson sorties as missions** instead of building parallel infrastructure.

| Primitive | Existing | What we add |
|-----------|----------|-------------|
| `engine_missions` row | ✅ runtime | One row: `MISSION_BOTSSON_SORTIE_V1` (TEXT id) — declares the 7 stages |
| `engine_stages` rows | ✅ runtime | Seven stage rows for the loop (map-check, preflight, build, telemetry-probe, post-merge, map-refresh, close) |
| `engine_state` row | ✅ runtime | One per sortie — instance of the mission |
| `engine_state_step` rows | ✅ runtime | One per stage transition — holds the falsifiable signal |
| `engine-dispatch` action handlers | ✅ runtime | Reuse `wait_for_event`, `assign_task`, `validate_settlement`, `lock_checkout` |
| Kill-switch | ⛔ new | New action handler `kill_on_red` — sets `engine_state.status='failed'` + `pg_notify('botsson_sortie_killed')` |
| Operator-resume | ⛔ new | One CLI: `botsson:resume <state_id>` — verifies fix, advances cursor |

The seven stages map 1:1 to the rings from the previous draft, but now they are **stages of a real running mission** — every Botsson sortie literally runs as a journey-engine instance.

---

## Prerequisites

- [ ] Journey-engine campaign closed to `accepted` state (current: `verified_against_code: 2026-04-30`).
- [ ] `engine_missions`, `engine_stages`, `engine_state`, `engine_state_step` tables green on local Supabase.
- [ ] `engine-dispatch` Edge Function deployable + reachable from local.
- [ ] `BOTSSON-SYSTEM-MAP.md` `verified_against_code` ≤ 7 days old.
- [ ] `gatedMutation()` orchestrator merged (B1 SS-3 done).

If any prerequisite RED → plan blocked. Don't start.

---

## Tasks

### Task 1: Mission blueprint — `MISSION_BOTSSON_SORTIE_V1`

**What:** Seed `engine_missions` + `engine_stages` rows defining the 7-stage loop. Each stage has a `signal_contract` JSONB column (new) describing what GREEN looks like.

| Stage slug | Signal | Source of truth |
|------------|--------|-----------------|
| `map-check` | `{ map_age_days: <=7, hot_files_present: true }` | `scripts/botsson/map-check.ts` exit code + stdout JSON |
| `preflight` | `{ branch_match: true, worktree_clean: true, skills_loaded: true, adr_0173_clean: true }` | `scripts/botsson/preflight.ts` JSON |
| `build` | `{ typecheck: pass, lint: pass, capability_unit: pass }` | `pnpm turbo typecheck && lint && test --filter=@smartout/ai` |
| `telemetry-probe` | `{ workspace_id_present: true, dual_gate_clean: true, channel_guard_clean: true }` | dev-only probes from `packages/telemetry/src/dev-probes.ts` |
| `post-merge` | `{ docstring_body_diff: 0, registry_emit_diff: 0, map_refreshed: true }` | `scripts/botsson/post-merge-verify.ts` JSON |
| `map-refresh` | `{ map_diff_committed: true, pr_opened: true }` | GitHub Actions output |
| `close` | `{ adr_written_if_needed: true, learning_written_if_needed: true, journey_committed: true }` | close-feature gate |

**Files:**
- `supabase/migrations/<ts>_botsson_sortie_mission.sql` — seed mission + 7 stages + add `signal_contract` JSONB column to `engine_stages` if missing
- `packages/ai/src/missions/botsson-sortie-v1.ts` — TypeScript mission spec (parallels DB seed for type safety)

**Acceptance (FALSIFIABLE):**
```
psql> SELECT id, name FROM engine_missions WHERE id = 'MISSION_BOTSSON_SORTIE_V1';
→ exactly 1 row
psql> SELECT slug FROM engine_stages WHERE mission_id = 'MISSION_BOTSSON_SORTIE_V1' ORDER BY sort_order;
→ exactly 7 rows in declared order, all with non-null signal_contract
```
KILL if either query returns wrong count.

---

### Task 2: `kill_on_red` action handler

**What:** New `engine-dispatch` action handler. When prior `engine_state_step.signal` is RED, this handler:
1. Sets `engine_state.status = 'failed'`.
2. Writes `failure_reason` + the RED signal artifact path.
3. `pg_notify('botsson_sortie_killed', '{state_id, stage_slug, reason}')`.
4. Refuses to advance cursor — operator-only resume.

No environment flag bypasses this. No `--force`. No "soft-fail mode."

**Files:**
- `services/stage-engine/src/dispatch/actions/kill-on-red.ts` (new)
- `services/stage-engine/src/dispatch/registry.ts` — register handler
- Type extension in `packages/ai/src/engine/types.ts`

**Acceptance (FALSIFIABLE):**
- Inject a synthetic RED signal at stage `build` → `engine_state.status` flips to `'failed'` within 1s, `pg_notify` payload arrives at a test subscriber, cursor does NOT advance to next stage.
- Attempt `UPDATE engine_state SET status='running' WHERE status='failed'` from non-operator path → blocked by RLS or function check.

KILL if cursor advances on RED. KILL if status flip is reversible without operator action.

---

### Task 3: Stage runner CLIs (one per stage)

**What:** Seven idempotent CLI entry points. Each reads the current `engine_state` for the active sortie, fetches its stage's `signal_contract`, runs the work, emits the signal, writes the `engine_state_step`. **No CLI modifies code outside its scope.** **No CLI returns 0 unless signal is GREEN.**

**Files:**
- `scripts/botsson/stages/map-check.ts`
- `scripts/botsson/stages/preflight.ts`
- `scripts/botsson/stages/build.ts`
- `scripts/botsson/stages/telemetry-probe.ts`
- `scripts/botsson/stages/post-merge.ts`
- `scripts/botsson/stages/map-refresh.ts`
- `scripts/botsson/stages/close.ts`
- `scripts/botsson/lib/emit-signal.ts` — shared signal emitter (writes `engine_state_step`, calls `engine-dispatch`)
- `package.json` — `"botsson:stage:<slug>"` for each

**Acceptance (FALSIFIABLE):**
- Run `pnpm botsson:stage:map-check` against fresh sortie → exits 0, `engine_state_step` row created with `signal_status='green'`, `signal_artifact` JSON contains `map_age_days <= 7`.
- Run same CLI with map artificially aged to 30 days → exits 1, `signal_status='red'`, kill_on_red fires.

KILL each CLI individually if it returns 0 with RED signal — that's the worst-case bug class.

---

### Task 4: Sortie bootstrapper — `botsson:start-sortie`

**What:** One CLI that:
1. Reads sortie name from arg.
2. Asserts current branch matches `feat/<sortie-name>` or `feat/botsson-<sortie-name>`.
3. Creates `engine_state` row instance of `MISSION_BOTSSON_SORTIE_V1`.
4. Returns the `state_id` — operator pins it in env: `export BOTSSON_SORTIE_STATE=<state_id>`.

After bootstrap, every stage CLI reads `BOTSSON_SORTIE_STATE` from env. No hidden global state. No file-based session mutex.

**Files:**
- `scripts/botsson/start-sortie.ts` (new)
- `package.json` — `"botsson:start-sortie"`

**Acceptance (FALSIFIABLE):**
- Run on a fresh feat branch → returns UUID, DB has 1 new `engine_state` row with `mission_id='MISSION_BOTSSON_SORTIE_V1'`, `status='running'`, `current_stage_id` = first stage.
- Run on `development` branch → exits 1 with "wrong branch" message, no DB row created.

KILL if a sortie can boot on `development`. KILL if two sorties can share the same `state_id`.

---

### Task 5: Operator-resume CLI — `botsson:resume`

**What:** When a sortie is RED, only this CLI can advance it. It:
1. Reads `BOTSSON_SORTIE_STATE`.
2. Loads the failed `engine_state_step`.
3. Re-runs the stage CLI.
4. If now GREEN → flips `engine_state.status` to `'running'`, advances cursor.
5. If still RED → re-kills, prints diff between prior and current signal.

No flag. No bypass. The CLI itself is the audit trail.

**Files:**
- `scripts/botsson/resume.ts` (new)
- `package.json` — `"botsson:resume"`

**Acceptance (FALSIFIABLE):**
- Force a stage RED → run resume → CLI re-executes failed stage CLI → if fix landed, sortie continues; if not, stays RED.
- Attempt `UPDATE engine_state SET status='running'` outside resume → blocked.

KILL if resume can flip status to running without re-running the stage. KILL if resume returns 0 on still-RED state.

---

### Task 6: Closed-loop guard — `engine-dispatch` cursor enforcement

**What:** Modify `engine-dispatch` so the cursor advance for `MISSION_BOTSSON_SORTIE_V1` checks: previous `engine_state_step.signal_status = 'green'`. If anything else (NULL, 'red', 'pending') → refuse advance, return 409 `cursor-blocked`.

This is the **closed loop** in code. No in-memory flag. No "trust the previous step ran." Always reads from DB before advancing.

**Files:**
- `supabase/functions/engine-dispatch/index.ts` — add cursor-guard for botsson missions
- `packages/ai/src/engine/cursor-guard.ts` (new) — pure function, unit-testable

**Acceptance (FALSIFIABLE):**
- Manually NULL the previous step's `signal_status` → next dispatch returns 409.
- Manually set previous to `'green'` → next dispatch advances.
- Unit test the pure cursor-guard function with all 4 input states.

KILL if cursor advances with NULL signal_status — that's how silent skips happen.

---

### Task 7: Auto-map-refresh stage runner

**What:** Stage 6 (`map-refresh`) re-reads code via `botsson-harness-builder` agent in narrow mode, regenerates `BOTSSON-SYSTEM-MAP.md` `verified_against_code` + status table, commits to a side branch, opens PR. Pontus reviews + merges manually (no auto-merge — map is too load-bearing).

**Files:**
- `scripts/botsson/stages/map-refresh.ts` — invokes harness-builder via Agent SDK
- `.github/workflows/botsson-map-refresh.yml` — daily cron + post-merge trigger

**Acceptance (FALSIFIABLE):**
- Stage runs → side branch exists with diff to map → PR open → diff includes updated `verified_against_code` ISO date.
- If no code changes warrant a refresh → no PR, signal still GREEN with `map_diff_committed: false`.

KILL if the stage opens a PR with no real diff (noise).

---

## Validation — End-to-End Closed-Loop Smoke Test

Run a synthetic sortie through all 7 stages on a throwaway worktree:

- [ ] `botsson:start-sortie smoke-test` → `engine_state` created, status=running.
- [ ] `botsson:stage:map-check` → green, step row written.
- [ ] `botsson:stage:preflight` → green, step row written.
- [ ] **Force a typecheck error** in a Botsson file → `botsson:stage:build` → red, kill fires, `pg_notify` arrives, status=failed.
- [ ] Attempt `botsson:stage:telemetry-probe` → 409 cursor-blocked.
- [ ] Fix the typecheck → `botsson:resume` → build re-runs green, cursor advances.
- [ ] All remaining stages run green.
- [ ] `engine_state.status='completed'`, all 7 step rows present, all green.

If any of these fail, the scaffolding itself fails — fix before declaring live.

## Post-Implementation

- [ ] Update `apps/web/CLAUDE.md` Botsson section — point at `botsson:start-sortie` as canonical entry.
- [ ] Update `BOTSSON-SYSTEM-MAP.md` — add `scaffolding` row, link to `MISSION_BOTSSON_SORTIE_V1`.
- [ ] Write ADR — "Botsson sorties run as journey-engine missions" — captures closed-loop + kill contract.
- [ ] Write learning — what RED signals fired during rollout (the rings only earn their keep on real failures).
- [ ] Register in `docs/INDEX.md`.
- [ ] Move to `docs/plans/completed/` when smoke test green.

---

## Phasing — All Behind Kill-Switch From Day 1

| Phase | Tasks | Why |
|-------|-------|-----|
| **P0** | 1, 2, 6 | Mission blueprint + kill_on_red + cursor-guard. Without these the loop is fake. |
| **P1** | 3 (map-check, preflight, build), 4 | Three smallest stages + bootstrapper. First runnable sortie. |
| **P2** | 3 (telemetry-probe, post-merge), 5 | Live observability + operator-resume. Catches what P1 misses. |
| **P3** | 3 (map-refresh, close), 7 | Auto-refresh + closure. Polish. |

Each phase ends with the smoke test (subset). No phase ships if its smoke subset has any RED.

---

## Hard Rules — Closed Loop, No Bypass

1. **No `--force` flag anywhere.** Not on stages, not on resume, not on dispatch. RED is RED.
2. **No env-var override.** `BOTSSON_SKIP=*` and `BOTSSON_FORCE_*` do not exist. If you find yourself wanting one, fix the gate instead.
3. **No CLI returns 0 with non-green signal.** Exit code is the contract.
4. **No cursor advance without DB read.** Every `engine-dispatch` call re-reads prior signal_status. No in-memory cache.
5. **Kill is permanent until operator-resume.** No automatic retry. No "wait 5 min and try again."
6. **Activity-log every kill.** `pg_notify('botsson_sortie_killed')` payload appended to `~/dev/second-brain-v2/ops/activity-log.md` source `system`.
7. **Production never sees scaffolding code paths.** Mission + dispatch handler are runtime-shared, but stage CLIs and probes are dev/CI only.

---

## What This Replaces

- The five-ring concentric model from prior draft → all five rings become **stages of one mission**.
- Manual session-start map-check → **stage 1 of every sortie**.
- Hand-rolled preflight skills checks → **stage 2 signal contract**.
- Ad-hoc post-merge typecheck → **stage 5 signal contract**.
- "Recovery rails" red buttons → **operator-resume after kill** (one CLI, all paths).

One runtime, one contract, one kill-switch. Built on the journey-engine that already runs. The harness builder eats its own dog food: every sortie that touches Botsson is itself a Botsson journey.

---

> After writing: add to `docs/INDEX.md` under Plans.
