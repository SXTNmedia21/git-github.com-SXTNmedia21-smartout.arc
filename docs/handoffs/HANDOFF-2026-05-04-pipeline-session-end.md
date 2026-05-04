---
title: "HANDOFF — Pipeline session end 2026-05-04 (next-agent pickup)"
status: ready
created: 2026-05-04
updated: 2026-05-04
module: deployment
tags: [handoff, deploy, pipeline, council, plan-v2, scenario-k, vercel-sync]
---

# HANDOFF — Pipeline session end 2026-05-04

> **For next agent:** Pontus dispatching new agent in fresh session to continue this work. Read this first. Then read `docs/plans/2026-05-04-pipeline-consolidation-v2.md` § "Done 2026-05-04 evening session" + § "Open operator-action items" before any action.

## What landed this session (chronological)

| # | Item | Reference |
|---|---|---|
| 1 | Pipeline-consolidation-v2 council (4 reviewers) → APPROVE Strategi C with amendments | `docs/council/COUNCIL-LOG.md` 2026-05-04 entry, commit `8d239b614` |
| 2 | Plan v2 council rework (21 fixes P0+P1+P2) | Commit `2946f0cab` (status: `dispatch_ready`) |
| 3 | P0 git-handling rewrite (10 atomic commits direct development) | Commits `cc193fcb4` → `dcf0ebf1c` |
| 4 | Vercel env-var sync (NUKE-AND-REPLACE 62/64 keys) | Operator-led 2026-05-04 |
| 5 | Persistent preview Supabase branch RECREATED — new ID `rrjfrisxvrrhyzzitlxd` | Operator-led via Supabase Dashboard 2026-05-04 |
| 6 | Scenario K — preview hard-reset to dev HEAD | Operator-led via API ruleset-disable + force-push + re-enable |
| 7 | Deploy-conductor Reflection Protocol — STATE.md + RUNS.md + activity-log | Commit `b85a011e0` |

## Current branch state (verified 2026-05-04 post-K)

```
main         1f5bf4807  (prod, untouched since 2026-05-03)
development  b85a011e0  (P0 git-handling rewrite + K reflection landed)
preview      dcf0ebf1c  (post-K = dev pre-K-reflection commit; CONVERGED with dev)
```

- preview ahead of dev: **0**
- dev ahead of preview: **1** (the K-reflection commit `b85a011e0`)
- FF possible (preview ancestor of dev): **YES**

## Current pipeline state

| Surface | State |
|---|---|
| `[deploy]` stop-phrase gate | ✅ live (3 vercel.json + ci.yml:258) |
| Vercel env-var sync | ✅ fresh 2026-05-04, 62/64 keys |
| Vercel auth | ✅ token in `op://smartout_ai/Vercel/credential` (60-char, HTTP 200) |
| Supabase preview branch | ✅ persistent `rrjfrisxvrrhyzzitlxd` (recreated 2026-05-04) |
| Supabase prod | ✅ `yljaglomadbhyqpcigff` |
| F1 Vercel API token both vaults | ✅ done |
| F2 Required-checks ruleset PATCH (3 workflows) | ✅ done (rulesets 14797822 + 15290760, 14/14 contexts) |
| F3 CI secrets seeded (4 secrets) | ✅ done |
| Production smoke | ✅ green (4/4 surfaces, 2026-05-03 last-verified) |
| Preview smoke | not re-run post-K (Vercel build skipped — no `[deploy]` tag in `dcf0ebf1c`) |
| Scenario K (preview hard-reset) | ✅ done — preview = dev HEAD |

## Open operator-action items (BLOCKERS for plan v2 Phase 4-5)

See `docs/plans/2026-05-04-pipeline-consolidation-v2.md` § "Open operator-action items" — full table with priority + reference. Summary:

1. **`ruleset-required-checks-cleanup`** (L-0197) — ~30 min. Highest priority. Blocks ALL future Scenario K + direct preview pushes
2. `PREVIEW_E2E_KEY` provisioning — Phase 4 blocker
3. `DEPLOY_TAP_WEBHOOK_URL` n8n setup — Phase 5 / ADR-0271 blocker
4. Sentry DSN in `smartout_ai_prod` vault — low priority (error reporting only)
5. `branch-db.sh` live test — Phase 3 blocker (only after `branch-db.sh` written)
6. User-home items per `HANDOFF-git-handling-user-home-changes.md` — low priority

## What next agent should dispatch

### Option A — `ruleset-required-checks-cleanup` (highest ROI, ~30 min)

L-0197 documented in deploy-conductor RUNS.md 2026-05-04 Scenario K entry. Architecture inconsistency: ruleset 15290760 lists `pgTAP Suites` + `Enforce branch flow` as required checks, but those workflows trigger on `pull_request` only (paths `supabase/**` + main/preview). Direct push to preview never fires them → ruleset blocks force-push forever as "2 expected".

Two fix paths (operator decision required):

1. **Path A1:** Remove `pgTAP Suites` + `Enforce branch flow` from preview ruleset's `required_status_checks`. Lose enforcement on the (rare) PR-to-preview path. Simpler.
2. **Path A2:** Add `push: branches: [preview]` trigger to those two workflows. Fire on direct push too. Preserves enforcement everywhere.

Recommend **A2** if `Enforce branch flow` semantically applies to direct push (it validates head/base — likely no-op on direct push, easy to skip). pgTAP Suites can run on push.

### Option B — Plan v2 Phase 2 dispatch (pre-push hooks tiered)

Phase 2 = scripts `pre-push-fast.sh` + `pre-push-full.sh` + `.husky/pre-push` wiring. ~2-3h. Independent of operator-items. Does NOT need PREVIEW_E2E_KEY or DEPLOY_TAP_WEBHOOK_URL.

Note: Pontus has not started this. Plan v2 Tasks 2.1-2.4 enumerate scripts.

### Option C — Plan v2 Phase 3 dispatch (Branching ephemeral lifecycle)

Phase 3 = `branch-db.sh` + `sync-branch-db-env.sh` + ADR-0270 (proposed). ~3-4h. Does NOT need PREVIEW_E2E_KEY or DEPLOY_TAP_WEBHOOK_URL. Needs Pontus to confirm Branching available on Pro plan (already verified per memory — true).

CAVEAT: persistent preview branch `rrjfrisxvrrhyzzitlxd` exists now. Phase 3 introduces ephemeral lifecycle. Decision needed: keep persistent branch as fallback, OR replace persistent with ephemeral. Plan v2 currently assumes ephemeral-only — but operator just recreated persistent. Council before dispatch recommended.

## Knowledge captured this session

In `docs/learnings/` (file structure pending; learnings drafted in council log):

- **L-0186** (proposed) — Vercel build pinning
- **L-0187** (proposed) — preview FF requires explicit tag
- **L-0188** (DEMOTED) — asymmetric reviewer coverage was anecdotal
- **L-0189** (proposed) — drift-check needs alerter to be useful
- **L-0190** (proposed) — `[deploy]` tag does not propagate through `gh pr merge --merge` default subject — must explicit `--subject "[deploy]"`. Cross-link ADR-0265
- **L-0191** (proposed) — slash-command workflows >10min require external state machine. Cross-link ADR-0271
- **L-0192** (proposed) — 5th chair self-reversal — chair-meta + code-tracer-mechanics both required. Cross-link L-0147
- **L-0193** (NEW, in council-meta) — pre-commit hook #7 myth (audit claimed dev-block; hook reads falsified)
- **L-0194** (NEW, in council-meta) — agents drift on own knowledge bundles
- **L-0195** (NEW, in council-meta) — KNOWLEDGE.md staleness creates confusion vectors today, not 6 months
- **L-0196** (NEW, in deploy-conductor RUNS.md 2026-05-04) — ruleset UI-disable unreliable; canonical = API PUT enforcement=disabled
- **L-0197** (NEW, in deploy-conductor RUNS.md 2026-05-04) — required-status-checks contains PR-only-trigger workflows; blocks direct preview push forever; Linear ticket queued

Next agent should formalize L-0186 through L-0197 into `docs/learnings/` files per template (`docs/templates/learning.md`).

## ADRs in flight

- **ADR-0269** (proposed in plan v2) — Pre-PR Quality Gate Tier 0-3. Body in plan v2 Task 6.2
- **ADR-0270** (proposed in plan v2) — Ephemeral preview branch lifecycle. Body in plan v2 Task 3.4. **Tension with current state:** persistent branch `rrjfrisxvrrhyzzitlxd` exists. Council before write
- **ADR-0271** (status `pending`) — Autonomous /deploy + Telegram-tap. 6 sub-specs added per council. Body in plan v2 Task 5.2. Needs DEPLOY_TAP_WEBHOOK_URL to validate

## Files to read first (in order)

1. `docs/handoffs/HANDOFF-2026-05-04-pipeline-session-end.md` — this file
2. `docs/plans/2026-05-04-pipeline-consolidation-v2.md` — § "Done 2026-05-04 evening session" + § "Open operator-action items"
3. `docs/council/COUNCIL-LOG.md` — last 2 entries (2026-05-04 plan v2 + git-handling council)
4. `.claude/agents/deploy-conductor/STATE.md` — verified state, dev SHA, gap counts, env-sync status
5. `.claude/agents/deploy-conductor/RUNS.md` — last 2 entries (P0 doc-rewrite + Scenario K)
6. `docs/decisions/0265-enforced-deployment-pipeline.md` — master enforcement ADR
7. `docs/handoffs/HANDOFF-git-handling-user-home-changes.md` — user-home action items

## Running deploy-conductor agent

If next session work involves deploy/promote/CI/scenarios → load `deploy-conductor` agent (sonnet, model in frontmatter). It reads its own bundle (KNOWLEDGE/PLAYBOOK/ROADMAP/STATE/RUNS) — no need to re-brief on basics.

For brand new specs/architecture decisions → run council via `run-council` skill. For doc-coherence audit → use `adr-contract-audit` skill.

## Mantra

**Pipe is correct. Operator decides. Drift is the enemy. LKG is the rope.**

Pontus does NOT take operation lead between sessions. Agent executes; operator confirms via explicit yes. Per ADR-0265 hard rules.
