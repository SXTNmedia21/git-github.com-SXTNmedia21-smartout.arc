---
title: "HANDOFF — deploy-conductor session 2026-05-03"
status: active
created: 2026-05-03
updated: 2026-05-03
module: cross-cutting
tags: [handoff, deploy-conductor, session, enforce-pipeline]
---

# HANDOFF — deploy-conductor session 2026-05-03

For the next agent picking up this thread. Read top-to-bottom.

---

## What the operator wants

Pontus is building enforced deployment pipeline so deploys stop breaking. The
work has 3 layers, in order:

1. **Pipeline enforcement (DONE)** — wrapper, drift-check, smoke-probe, CI
   jobs, PR template, ADR-0265. Merged to development as commit
   `d13542620` + dry-run-A findings as `5bf765020`.
2. **deploy-conductor agent (DONE)** — 5 files in
   `.claude/agents/deploy-conductor/` with self-learning loop (RUNS.md +
   Reflection Protocol). Bundled knowledge, roadmap, state, playbook.
3. **In flight RIGHT NOW** — preview-branch divergence recovery + scoped CI
   strategy. Operator pushed back on whole-repo format-write blast radius
   and wants industry-standard scoped checks instead.

---

## State snapshot

| Item | Status |
|---|---|
| Working tree | clean — `git status` empty on development |
| Branch | development @ `5bf765020` |
| feat/enforce-pipeline | merged + deleted |
| ADR-0262 collision | resolved → renumbered to ADR-0265 |
| Pipeline gap dev→preview | 734 commits |
| **Preview branch state** | **DIVERGED** — 3543 ahead, 734 behind. squash-merge ghost pattern. operator-led recovery pending |
| Vercel deploy state for d13542620 | CANCELED |
| CI on d13542620 | last check: 1 green + 1 pending |
| drift-check | green (manifest 64/64 baseline holds) |
| Production smoke | green (web, landing, Supabase, EFs) |
| Operator F1 (Vercel token) | done |
| Operator F2 (3 workflows → required) | not done |
| Operator F3 (CI secrets for new jobs) | not done |

---

## What blocked first promote attempt

Three things, all caught correctly by the wrapper:

1. **Preview branch divergent.** Recovery needs operator action: temp-disable
   preview ruleset (15290760), `git reset --hard origin/development` on
   preview, force-push, re-enable. Documented in PLAYBOOK Scenario K.
2. **Vercel CANCELED for dev SHA.** Re-deploy via Vercel dashboard or
   push no-op commit.
3. **CI pending.** Wait it out.

---

## What just got pushed back on

Operator caught a blast-radius mistake. Sequence:

1. Agent ran `pnpm format:check` whole-repo → 20 prettier failures (5 mine,
   15 pre-existing from agent-memory + other agents' files).
2. Agent ran `pnpm prettier --write` whole-repo to auto-fix → 1002 files
   modified across the entire monorepo.
3. Operator caught it: "you do this on development?" → STOP.
4. Agent ran `git checkout -- .` → all 1002 changes reverted.
5. Targeted re-check on agent's own 6 deploy-conductor files: **all
   prettier-clean already**. No format-fix needed for in-scope work.
6. Operator stated the pattern: "Vi skal bare kjøre på de partier som er
   påvirket eller endret. Det har vi kontroll på." Industry-standard
   monorepo CI = scoped to PR diff, not whole-repo.

The 1003 pre-existing prettier failures are tech-debt that will fail GitHub
CI Format Check on every push regardless of any sortie. They are NOT this
session's scope.

---

## What the operator wants next

A separate sortie/recommendation: **scope CI Format Check to PR diff**, the
way professional monorepos do it (Turborepo + pnpm + Vercel + Supabase
standard pattern). Plan-doc OR sortie, operator's choice.

Not yet written. The next agent should write it.

---

## Files the next agent should read first

In this order:

1. `.claude/agents/deploy-conductor.md` — agent identity, boundaries,
   reflection protocol, confirmation model
2. `.claude/agents/deploy-conductor/STATE.md` — verified counts (re-run
   verification commands at top of file before quoting)
3. `.claude/agents/deploy-conductor/RUNS.md` — bootstrap entry +
   dry-run-A entry. Format for new entries documented at top.
4. `.claude/agents/deploy-conductor/PLAYBOOK.md` — 11 scenarios A–K with
   diagnose + action + escalation. Scenario K is preview-divergence-recovery.
5. `.claude/agents/deploy-conductor/ROADMAP.md` — Phase 0–4 with
   can/cannot tables + when-to-do-what
6. `.claude/agents/deploy-conductor/KNOWLEDGE.md` — skills + scripts +
   commands + ADRs map
7. `docs/decisions/0265-enforced-deployment-pipeline.md` — the ADR
8. `docs/protocols/DEPLOYMENT.md` — static topology + 13 hard rules
9. `docs/HANDOFF-enforce-pipeline.md` — original sortie handoff with
   operator follow-up F1/F2/F3
10. This file

---

## What NOT to do

- ⛔ Never run `pnpm format:check` or `pnpm prettier --write` whole-repo
  on development. Use targeted file paths only. CI Format Check job is
  the place that needs scope-fix, not your local run.
- ⛔ Never auto-fix files outside the current sortie's scope. Pre-existing
  format-debt has owners; respect them.
- ⛔ Never push directly to preview. Only the wrapper FF-pushes after
  operator confirms. Recovery (force-push to preview) is operator-led.
- ⛔ Never invoke the global `~/.claude/scripts/promote-preview.sh`
  directly. Always the repo wrapper `./infra/scripts/promote-preview.sh`.
- ⛔ Never bypass the 14 required CI checks (after operator F2 flip).
- ⛔ Never type `op run` to the operator — agent invokes it itself per
  Confirmation Model.

---

## What to do next

Sequence:

1. **Verify state.** Run STATE.md verification commands. Re-verify counts
   if older than 24h.
2. **Decide on CI Format Check scoping.** Either:
   - (a) Write `docs/plans/PLAN-scope-ci-format-to-diff.md` as a plan-only
     deliverable, no code change, operator decides when to execute.
   - (b) Open sortie `chore/scope-ci-format-to-diff` and ship the change
     (modify `.github/workflows/ci.yml` Format Check job to use
     `prettier --check $(git diff --name-only origin/main...HEAD)`).
   Operator hasn't decided which — last message asked agent to recommend.
3. **Wait for operator on preview-recovery.** Until preview is reset, no
   real promote can succeed. Operator action only.
4. **When preview is reset → run dry-run-B.** All 6 wrapper gates against
   the new preview state. Append to RUNS.md per Reflection Protocol.

---

## Open questions for operator

These are unresolved:

1. **Format Check scope-fix**: plan-doc only, or full sortie now?
2. **Pre-existing format-debt (1003 files)**: leave as-is until owners
   touch their files, or commission a one-time `chore/format-sweep` sortie?
3. **Operator F2 (required-checks flip)**: when?
4. **Operator F3 (CI secrets for new jobs)**: when?
5. **Preview-branch reset**: when? Required before any first real promote.

---

## Self-learning loop status

The deploy-conductor agent's self-learning loop fired once successfully
(dry-run-A → RUNS.md entry + STATE.md update + PLAYBOOK Scenario K added +
activity-log entry). Pattern detection threshold (≥ 5 RUNS entries) not
reached. Continue appending entries per Reflection Protocol.

---

## Activity-log entries from this session

```
2026-05-03 — agent created (4 files in .claude/agents/deploy-conductor/), dry-runs validated
2026-05-03 — sortie/enforce-pipeline closed, merged to development, ADR-0265
2026-05-03 — deploy-conductor dry-run-A: 6 gates against d13542620 — Gate 4 RED (preview diverged 3543/734), Gate 5 RED, Gate 2 PENDING. Pipe correctly blocks. Scenario K added.
```

---

## Mantra

**Pipe is correct. Operator decides. Drift is the enemy. LKG is the rope.**
