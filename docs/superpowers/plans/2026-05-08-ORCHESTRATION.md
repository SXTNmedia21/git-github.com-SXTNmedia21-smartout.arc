---
title: "ORCHESTRATION — 2026-05-08 Multi-Plan Execution Master"
status: ready-to-dispatch
created: 2026-05-08
updated: 2026-05-08
type: orchestration
council_review: 2026-05-08 R1 + R2 (verdicts in docs/council/COUNCIL-LOG.md)
plans:
  - 2026-05-08-b1-server-derive-workspace-id.md
  - 2026-05-08-b2-mobile-context-pipe-and-auth-lift.md
  - 2026-05-08-vad-bench-pre-sortie-gate.md
  - 2026-05-08-pre-phase-e-foundation.md
  - 2026-05-08-phase-e-cutover-tracks-2-3-4-6.md
  - 2026-05-08-doc-and-agent-instruction-consolidation.md
tags: [orchestration, execution-master, council-approved, dispatch-ready]
---

# ORCHESTRATION — 2026-05-08 Multi-Plan Execution

> **Read this first** when resuming work. This is the master execution doc — tells you what to dispatch, in what order, with what gates, and what to verify between steps.

## Status snapshot

6 plans exist. Council R1+R2 (2026-05-08) verdicts logged. Ready for dispatch on PO go-signal.

| # | Plan | Sortie branch | Verdict | Status |
|---|------|---|---|---|
| 1 | B1 server-derive workspace_id | `feat/b1-server-derive-workspace-id` | ✅ APPROVE | Ready |
| 2 | B2 mobile context pipe + auth lift | `feat/b2-mobile-context-pipe` | ✅ APPROVE WITH CHANGES | Ready (sequenced after B1) |
| 3 | vad-bench pre-sortie gate | `feat/vad-bench` | ✅ APPROVE WITH ONE FIX | Ready (parallel with B1) |
| 4 | Pre-Phase-E foundation (KRIT-1/2/4/6) | `feat/pre-phase-e-foundation` | ⚠️ REQUIRED before Phase E | Needs PO decisions |
| 5 | Phase E cutover Tracks 2/3/4/6 | `feat/botsson-arena-phase-e-cutover` | ⛔ REJECT-AS-WRITTEN — gated on #4 | Needs #4 + plan patches |
| 6 | Doc + agent + skills consolidation | `feat/doc-consolidation` | ⚠️ APPROVE WITH CHANGES (5 blocking patched, 4 minor TODO) | Phases 1-3 ready |

---

## PO DECISIONS NEEDED before dispatch

### Decision 1 — Pre-Phase-E foundation Track A (KRIT-1)

`engine_sessions.process_id` column does not exist. Phase E Task 1 query will 500.

| Option | Effort | Tradeoff |
|---|---|---|
| **A1** Add `process_id` column via migration | 3h | New column duplicates `mission_id`; future ALTER risk |
| **A2** Rewrite Phase E Task 1 to use `mission_id = 'onboarding-interview' AND mode = 'agent'` | 1h | Reuses existing column; minor Phase E plan patch |

**Recommendation: A2** (less surface, no migration debt).

### Decision 2 — Pre-Phase-E foundation Track B (KRIT-2)

`livekit-token` EF requires `channelId`. Wizard-onboarding has no channelId.

| Option | Effort | Tradeoff |
|---|---|---|
| **B1** Extend existing `livekit-token` EF with `purpose: "wizard"` branch | 3-4h | One EF, follows `purpose: "ai_voice"` pattern |
| **B2** Create new `livekit-wizard-token` EF | 4-5h | Two EFs, clearer separation but more surface |

**Recommendation: B1**.

### Decision 3 — Pre-Phase-E foundation Track D (KRIT-6)

Phase E Task 6 references `lise-interview` mission. Does not exist.

| Option | Effort | Tradeoff |
|---|---|---|
| **D1** Add new `lise-interview` mission to registry | 3h | Distinct mission for interview-flow Lise |
| **D2** Change Phase E Task 6 default to `landing-demo` (existing Lise mission) | 1h | Reuses existing mission, no new spec |

**Recommendation: D2** unless PO has specific reason for new mission.

### Decision 4 — Lise voice mapping (post-Ultravox)

Current Lise voice ID `d082550b-596a-42f7-9356-840b4a095d3f` is Ultravox-only. Post-LiveKit-flip needs OpenAI Realtime-compatible voice.

| Option | Persona fit |
|---|---|
| `coral` | Warm, measured. Aligns with founder energy. |
| `shimmer` | Clear, slightly warm. |
| `verse` | Expressive/variable. Less stable. |
| `alloy` | Neutral. Doesn't carry Lise warmth. |

**Recommendation: `coral`** (frontend-designer council R1 verdict).

### Decision 5 — Worktree pool cleanup

Currently 10 worktrees open (`git worktree list`). Practical ceiling ~8. Recommend close-feature stale ones before opening 5 new sorties:

- `~/dev/smartout.ai-bubble-migration-wt-1` (per memory: bubble-migration campaign closed 2026-05-03)
- `~/dev/smartout.ai-payroll-wt-1` (post-payroll-phase-2 leftover)

Verify via `git worktree list` + `git log --oneline -1` per worktree before deleting.

---

## DISPATCH SEQUENCE

### Phase 0 — Pre-flight (do before opening any sortie)

```bash
# 1. Worktree audit
git worktree list

# 2. Branch state
git status
git log --oneline -3

# 3. Verify all 6 plans committed on development
ls docs/superpowers/plans/2026-05-08-*.md
git log --oneline docs/superpowers/plans/2026-05-08-*.md

# 4. Verify ADR R-5 patch landed
git log --oneline | grep "fix Phase E Task 9 ADR-0276/0284"

# 5. Verify capability count (council R2 truth)
grep -c "Capability,$" packages/ai/src/capabilities/registry.ts
# Expected: 29 (use this number when patching docs/skills, NOT 16/17)
```

### Phase 1 — Dispatch B1 + vad-bench (parallel)

Both autorisert (council APPROVE), no shared files, can run simultaneously.

```bash
# Sortie 1: B1 (security fix, 30 min)
/start-feature b1-server-derive-workspace-id
# Worktree spawned at ~/dev/smartout.ai-wt-N
# tmux: tmux new -s smartout-N -c ~/dev/smartout.ai-wt-N

# Sortie 2: vad-bench (5-7h, parallel-safe)
/start-feature vad-bench
# Different worktree slot
```

Each sortie executes plan task-by-task per `docs/superpowers/plans/2026-05-08-{b1,vad-bench}-*.md`.

**Gate before B2:**
```bash
git log origin/development --oneline | grep "fix(wizard/start): reject forged workspace_id"
# Must return non-empty before dispatching B2
```

### Phase 2 — Dispatch B2 (after B1 merge)

```bash
/start-feature b2-mobile-context-pipe
# Plan: docs/superpowers/plans/2026-05-08-b2-mobile-context-pipe-and-auth-lift.md
```

**B2 acceptance verification:**
- 4 vitest cases for `resolveAuth` lift PASS
- 3 vitest cases for `/api/botsson/voice/session-context` PASS
- 3 jest cases for mobile context publisher PASS
- Manual PWA test confirms voice-agent log: `[botsson-voice] context updated: context_init`
- Pre-merge: `EXPO_PUBLIC_WEB_API_URL` added to `.env.template` if missing

### Phase 3 — Dispatch doc-consolidation Phases 1-3 (after B1 merge, parallel with B2)

Critical: doc-consolidation Phase 1 (split-brain resolution) MUST land before Phase E Task 10 (which edits `BOTSSON-SYSTEM-MAP.md`).

```bash
/start-feature doc-consolidation
# Plan: docs/superpowers/plans/2026-05-08-doc-and-agent-instruction-consolidation.md
# Execute Phases 1, 2, 3 (sequential within sortie). Stop at Phase 4 (gates on Phase E E6).
```

**Phase 1 acceptance:** `find docs/ -name "STAGE-ENGINE.md" -o -name "BOTSSON-SYSTEM-MAP.md" | wc -l` = 2 (canonical only).

**Phase 2 acceptance:** 4 HANDOFFs + 6 journeys created, MODULE_BOTSSON.md has `verified_against_code: 2026-05-08`.

**Phase 3 acceptance:** INDEX.md backfilled, decision-log verified, ADR id-format normalized via anchored sed.

### Phase 4 — Dispatch pre-Phase-E foundation (after PO decisions 1-4 made)

```bash
# Confirm PO decisions resolved (Track A1/A2, B1/B2, D1/D2, voice mapping)
# Edit pre-phase-e-foundation plan to reflect chosen options before dispatch

/start-feature pre-phase-e-foundation
# Plan: docs/superpowers/plans/2026-05-08-pre-phase-e-foundation.md
# 4 parallel tracks (A, B, C, D)
# Track C depends on B2 merged (resolveAuth helper)
```

**Pre-Phase-E acceptance gate:** all 4 KRIT closed, verified via:
```bash
# KRIT-1: schema or query-rewrite landed
[ "$(grep -c "process_id" packages/supabase/src/database.types.ts)" -gt 0 ] || \
  [ "$(grep -c "mission_id.*onboarding-interview" docs/superpowers/plans/2026-05-08-phase-e-cutover-tracks-2-3-4-6.md)" -gt 0 ]

# KRIT-2: livekit-token wizard-mode
grep -c "purpose.*wizard" supabase/functions/livekit-token/index.ts

# KRIT-4: get-server-context exists
ls apps/web/src/lib/auth/get-server-context.ts

# KRIT-6: Lise mission resolved
grep -c "lise-interview\|landing-demo" packages/ai/src/missions/registry.ts
```

### Phase 5 — Dispatch Phase E (gated on B1 + vad-bench PASS + pre-Phase-E + doc-consolidation Phase 1 ALL merged)

**Pre-flight gates (all must pass):**

```bash
# Gate A: B1 merged
git log origin/development --oneline | grep -q "fix(wizard/start): reject forged" && echo "GATE A PASS" || echo "GATE A FAIL"

# Gate B: vad-bench PASS verified
pnpm --filter @smartout/voice-agent vad-bench
echo "exit=$?"  # 0 = PASS, 1 = FAIL — only proceed if 0

# Gate C: pre-Phase-E foundation merged
git log origin/development --oneline | grep -qE "(pre-phase-e-foundation|KRIT-[1246])" && echo "GATE C PASS" || echo "GATE C FAIL"

# Gate D: doc-consolidation Phase 1 merged (split-brain resolved)
[ "$(find docs/ -name 'STAGE-ENGINE.md' | wc -l)" -eq 1 ] && \
[ "$(find docs/ -name 'BOTSSON-SYSTEM-MAP.md' | wc -l)" -eq 1 ] && \
echo "GATE D PASS" || echo "GATE D FAIL"
```

If all 4 gates PASS:

```bash
/start-feature botsson-arena-phase-e-cutover
# Inside campaign worktree ~/dev/smartout.ai-botsson-arena
# Plan: docs/superpowers/plans/2026-05-08-phase-e-cutover-tracks-2-3-4-6.md
# Tasks 1-7, then doc-consolidation Phase 4 snapshot, then Task 8 deletion sweep
```

**Critical sequencing inside Phase E:**

- Tasks 1-3 batch (do not push between)
- Task 4 push
- Task 5 push (R6 deploy gap — wizard fallback button live before Task 6)
- Task 6 push
- Task 7 push
- **STOP — dispatch doc-consolidation Phase 4 (snapshot) BEFORE Task 8**
- Task 8 deletion sweep (gated on vad-bench PASS verified again + snapshot file committed)
- Task 9 (R-5 patched — ADR status flips, no creation)
- Task 10 status flip + handoff

### Phase 6 — Dispatch doc-consolidation Phases 5-7 (after Phase E E6 + B2 merged)

```bash
# Resume doc-consolidation sortie at Phase 5 (rewrite + LiveKit replacement content)
# Phase 6: in-repo skill files + agent files + root CLAUDE.md
# Phase 7: 5 learning files (L-0225 through L-0229) + COUNCIL-LOG entries (already in this orchestration session)
```

Phase 6 splits in-repo / out-of-band per council R2 fix:
- In-repo: `.claude/skills/{smartout-edge-function-guide,smartout-database-guide}/SKILL.md`, `.claude/agents/*.md`, root `CLAUDE.md`
- Out-of-band: `~/.claude/skills/smartout-agent-dev/SKILL.md`, `~/.claude/CLAUDE.md` (manual update + activity-log entry)

Phase 7 acceptance:
- `bash -n infra/scripts/doc-drift-check.sh` (syntax check before commit)
- L-0229 already written this orchestration session (`docs/learnings/0229-capability-count-source-of-truth-drift.md`)
- COUNCIL-LOG already appended this session (R1 + R2 entries)

---

## DEFERRED MINOR PATCHES (non-blocking, can land post-dispatch)

These were identified by council R2 but not yet patched in plans. Apply during Phase 6/7 or as polish sortie:

| # | Item | Plan | Severity |
|---|---|---|---|
| 1 | Phase E Task 10 BOTSSON-SYSTEM-MAP gate (must run after doc-consolidation Phase 1 archives duplicate) | doc-consolidation T1.3 | LOW |
| 2 | DomainChatOwnership framing — T2.4 must say "ADR-0238 prescribed, not yet implemented" (component is vapor per Harness verification) | doc-consolidation T2.4 | MEDIUM |
| 3 | Capability table in T2.6 must list all 29 capability names (currently underspecified) | doc-consolidation T2.6 | MEDIUM |
| 4 | Phase E Task 5 commit-batching guidance — push T3-T5 as one batch to honor R6 ≤1 deploy cycle | Phase E plan §Self-Review | MEDIUM |
| 5 | Phase E Task 5 pre-flight git-log check for B1 merged | Phase E Task 5 Step 0 | HIGH (recommended add) |

---

## PARALLEL DISPATCH MATRIX

| Time | Sortie 1 | Sortie 2 | Sortie 3 |
|---|---|---|---|
| T+0 | **B1** start | **vad-bench** start | — |
| T+30min | B1 merge | vad-bench in progress | **B2** can start |
| T+1h | — | vad-bench in progress | B2 in progress |
| T+1h | — | — | **doc-consolidation Phases 1-3** start (parallel with B2) |
| T+3h | — | — | doc-consolidation Phase 1 merge |
| T+5h | — | vad-bench PASS verified | B2 merge |
| T+8h | **pre-Phase-E** start (4 tracks parallel) | — | doc-consolidation Phases 2-3 in progress |
| T+1d | pre-Phase-E merge | — | doc-consolidation Phases 1-3 merged |
| T+2d | **Phase E** start (gated) | — | — |
| T+3d | Phase E in progress | — | — |
| T+3.5d | doc-consolidation Phase 4 (snapshot) | — | — |
| T+4d | Phase E E6 deletion | — | — |
| T+4.5d | Phase E complete | — | doc-consolidation Phases 5-7 start |
| T+5d | — | — | doc-consolidation complete |

Realistic wall-clock: 5 days with parallel dispatch + PO decision turnaround.

---

## ROLLBACK PATHS

Per `docs/runbooks/RUNBOOK-voice-plane-rollback.md` (created in doc-consolidation Phase 5 T5.4).

Each plan has independent rollback in its own §Rollback section:

- B1: revert 2 commits, no migration to undo
- B2: revert 5 commits, mobile reverts to "brukerdata mangler" (pre-fix state)
- vad-bench: revert all commits, no production impact
- Pre-Phase-E: revert 4 tracks independently
- Phase E: complex — see RUNBOOK
- Doc-consolidation: each phase independently revertable

---

## VERIFICATION COMMANDS (run between phases)

```bash
# Status snapshot
git log --oneline -10 origin/development
git worktree list
git status

# Plan-state inventory
ls -la docs/superpowers/plans/2026-05-08-*.md

# Capability count (truth)
grep -c "Capability,$" packages/ai/src/capabilities/registry.ts

# ADR slot collision check
git log --all --name-only | grep -E 'docs/decisions/[0-9]{4}-' | sort -u | tail -10

# Learning slot collision check
git log --all --name-only | grep -E 'docs/learnings/[0-9]{4}-' | sort -u | tail -10

# Council-log freshness
tail -50 docs/council/COUNCIL-LOG.md

# Doc drift detection (when script lands)
bash infra/scripts/doc-drift-check.sh
echo "exit=$?"  # 0 = clean, 1 = drift detected
```

---

## COUNCIL CAPTURE (already done this session)

✅ Council R1 entry in `docs/council/COUNCIL-LOG.md`
✅ Council R2 entry in `docs/council/COUNCIL-LOG.md`
✅ L-0229 written at `docs/learnings/0229-capability-count-source-of-truth-drift.md`
✅ R-5 patch landed `6a61c1947`
✅ Doc-consolidation 5 blocking patches landed in plan
✅ Pre-Phase-E foundation plan written
✅ This ORCHESTRATION master written

⏳ L-0225-0228 drafts in doc-consolidation plan (will be written as separate files in Phase 7 execution)
⏳ council_meta.md self-improvement entry (Phase 9 — write when starting next session if not already)

---

## QUICK-RESUME CHECKLIST (when you come back)

```bash
# 1. Re-read this orchestration
cat docs/superpowers/plans/2026-05-08-ORCHESTRATION.md

# 2. Verify state hasn't drifted
git log --oneline -10
git status

# 3. Verify capability count (truth check)
grep -c "Capability,$" packages/ai/src/capabilities/registry.ts

# 4. Confirm PO decisions for Track A/B/D + Lise voice
# (Make decisions before dispatching pre-Phase-E)

# 5. Decide which sortie to dispatch first
# Default: B1 + vad-bench parallel

# 6. Run /start-feature <name> for chosen sortie
```

If you see "Phase E patched" commits but NOT "pre-phase-e-foundation" commits, you're between Phase 1 (B1+vad-bench dispatched) and Phase 4 (pre-Phase-E). Dispatch the missing sortie before Phase E.

---

## STATUS LEGEND

- ✅ APPROVE — ready to dispatch
- ⚠️ APPROVE WITH CHANGES — patches landed, ready to dispatch with caveat
- ⛔ REJECT — blocked, need foundation work first
- 🟢 Done
- 🟡 In progress
- 🔴 Blocked

Current state of all 6 plans:
- B1 ✅
- B2 ✅⚠️ (3 light changes)
- vad-bench ✅⚠️ (1 fix decision: exit-code OR JSON verdict-field)
- pre-Phase-E ⚠️ (PO decisions needed)
- Phase E ⛔ (gated on pre-Phase-E)
- doc-consolidation ⚠️ (5 blocking patched, 4 minor deferred)

PO go-signal triggers Phase 1 dispatch.
