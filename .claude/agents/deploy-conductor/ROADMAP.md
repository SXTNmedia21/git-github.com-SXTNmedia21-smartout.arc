---
title: "deploy-conductor — Roadmap"
status: canonical
updated: 2026-05-03
---

# Roadmap

What deploy-conductor can do today, what it cannot, and the phased plan to remove the cannots.

---

## Phase 0 — TODAY (ADR-0265 sortie wt-4 in flight)

**Status:** sortie pushed to `origin/feat/enforce-pipeline`, awaiting close-feature → merge to development → flow through preview → main.

### What I CAN do (verified by dry-runs 2026-05-03)

| Action | How | Status |
|---|---|---|
| Validate Vercel API token | `op run -- curl Vercel API` | ✅ HTTP 200 |
| Run drift-check 4-channel parity | `./infra/scripts/drift-check.sh --skip-droplet` | ✅ green on baseline 64 |
| Smoke probe production surfaces | `./infra/scripts/smoke-probe.sh production --skip-droplet` | ✅ 4/4 surfaces alive |
| Check Vercel deploy state for any SHA | Vercel API `v6/deployments` query | ✅ correctly returns CANCELED for current dev |
| Read activity-log for deploy history | `tail ~/dev/second-brain-v2/ops/activity-log.md` | ✅ |
| Read DASHBOARD.md for repo state | `cat docs/DASHBOARD.md` | ⚠️ stale (last reconciled 2026-04-30) |
| Spawn parallel verifiers | gate-runner + env-checker + git-checker + ci-monitor (per skill) | ✅ skill exists |
| Curate learnings into deploying skill | Edit `~/.claude/skills/deploying/SKILL.md` per Learning Law | ✅ |

### What I CANNOT do until Phase 1

| Cannot | Why | Mitigation |
|---|---|---|
| Verify migration state on prod | RPC `migration_state_latest()` not yet on prod (in unmerged ADR-0265 migration) | Operator runs Supabase MCP query manually |
| Block PR on Edge Function dry-run failure | CI job not yet merged | Operator reviews EF changes in PR diff |
| Treat 3 added workflows as required | Operator hasn't flipped ruleset (F2 from HANDOFF) | Skip them; revisit after F2 |
| Read Supabase secrets in heartbeat | `SUPABASE_PROJECT_REF` not always set | Skips with WARN — flag to operator if EF secret added |
| Connect to droplet from agent context | No SSH key forwarded to Claude Code | `--skip-droplet` flag; operator runs droplet commands |
| Auto-rollback Vercel | Operator-led decision | Propose `vercel rollback` command; never run alone |
| Push tags or branches with operator override | Per agent boundaries | Always confirm |

### Operator follow-up still pending (from HANDOFF)

- **F1** ✅ Done (Vercel token in both vaults)
- **F2** ❌ Not done — flip 3 workflows to required-checks (main + preview rulesets)
- **F3** ❌ Not done — add CI secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROD_REF`, `SUPABASE_PROD_URL`, `SUPABASE_PROD_SERVICE_ROLE_KEY`

Until F2 + F3: the new CI jobs (`Edge Functions`, `Migration State`) are advisory only.

---

## Phase 1 — Tier 1: 1.5 days, closes critical gaps

**Goal:** lift verification from 50% to 90%. Remove the three findings rated CRITICAL in the deploy-readiness scan (2026-05-03).

| Tier 1 task | Effort | Closes weak point | Verified by |
|---|---|---|---|
| Migration idempotency sweep — wrap 154 bare `CREATE INDEX` / `CREATE TABLE` in `IF NOT EXISTS` | 1 day | W2 (Branch DB replay fail) | grep returns 0 bare statements |
| Edge Function config.toml coverage — 62 EFs vs 52 entries, add missing 10 | 30 min | W1 (auth-default-fail at deploy) | grep `[functions.X]` count = 62 |
| E2E in CI mot preview-URL etter promote | 4 timer | W3 (102 specs orphaned) | new `e2e.yml` workflow runs `pnpm test:e2e` with `BASE_URL=$VERCEL_PREVIEW_URL` |

### What I CAN do after Phase 1

| New ability | How |
|---|---|
| Trust Branch DB replay | All migrations idempotent — Branch creation cannot fail mid-replay |
| Trust EF deploy correctness | All 62 EFs have config.toml — no auth-default surprises |
| Verify UI flow post-promote | E2E green is now part of HOP A → HOP B gate |
| Refuse HOP B if Tier 1 incomplete | I can grep Migration count, EF config count, E2E CI run | 

---

## Phase 2 — Tier 2: 1.5 days, post-deploy verification

**Goal:** automated post-merge verification + cron canary. Remove 4 high-severity gaps.

| Tier 2 task | Effort | Closes weak point | Verified by |
|---|---|---|---|
| EF secret manifest + sync script `infra/scripts/sync-supabase-secrets.sh` | 4 hours | W1, W10 (orphan tier closed) | drift-check reports green for edge-fn-secrets without --skip |
| Cron-canary CI job — fires every cron-EF dry-run after main merge | 4 hours | W1 (silent cron failure) | cron-EF logs visible in CI |
| Post-main-merge auto-smoke + alert | 2 hours | W6 (no prod verification) | new `post-deploy.yml` runs smoke-probe production after main push, alerts on red |
| Vercel + droplet rollback scripts | 3 hours | W7 (manual rollback burden) | `infra/scripts/rollback-vercel.sh` + `rollback-droplet.sh --tag <prev>` exist + dry-run-tested |

### What I CAN do after Phase 2

| New ability | How |
|---|---|
| Verify post-main correctness automatically | post-deploy.yml smoke runs in CI, status visible in `gh pr checks` |
| Detect silent cron-EF failure within 24h | cron-canary logs surface to activity-log via heartbeat |
| Propose atomic rollback per surface | One-button-per-surface scripts exist; operator confirms |
| Detect Edge Function secret drift in CI context | EF secret sync-script + drift-check CI job |

---

## Phase 3 — Tier 3: 1 day, reduce drift surface

**Goal:** automate the rest of the manual maintenance burden.

| Tier 3 task | Effort | Closes weak point |
|---|---|---|
| DASHBOARD.md auto-update via post-commit hook | 1 hour | W8 (drift) |
| Manifest-table in ENV_PROTOCOL — per-key purpose explanation | 2 hours | W5 (counts mismatch unexplained) |
| Secret-rotation tracker via heartbeat (1Password item-age) | 2 hours | W11 (no rotation alarm) |
| EF deploy version-pinning (record gitCommitSha per deploy) | 2 hours | W14 (no traceability) |

### What I CAN do after Phase 3

| New ability | How |
|---|---|
| Surface DASHBOARD drift automatically | Post-commit hook updates timestamp |
| Explain why 19 op-refs aren't in Vercel manifest | Manifest-table in ENV_PROTOCOL |
| Alert on overdue secret rotations | Heartbeat job reads 1Password modified-date |
| Trace any Vercel deploy or EF deploy back to git SHA | Version pinning |

---

## Phase 4 — Full agent autonomy

**Goal:** I can run end-to-end without operator approval for low-risk paths.

What unlocks Phase 4:
- All Tier 1 + Tier 2 + Tier 3 done
- Activity-log shows ≥ 5 successful end-to-end promotes via wrapper
- No drift alert triggered for ≥ 14 days
- adr-contract-audit weekly reports ≥ 4 consecutive greens for ADR-0265 compliance

### What I CAN do in Phase 4

- Auto-trigger HOP A when development is in sync + CI green ≥ 30 min ≥ 0 unmerged Tier 1+2 followups
- Auto-run post-promote smoke + lkg-tag without confirmation
- Auto-alert + propose rollback within 60 sec of red smoke
- Read drift-check + adr-contract-audit output as gate-input for HOP B
- Refuse HOP B if Tier 1 unmet
- Atomic per-surface rollback proposals with one-line operator confirm

### What I STILL CANNOT do in Phase 4

- Push to main directly
- Skip the 14 required CI checks
- Auto-rollback without confirmation (only PROPOSE)
- Edit env vars in Vercel UI
- Override secrets-protocol two-vault rule
- Deploy Edge Functions outside CI on main push (except documented emergency rollback)

These are not phase-gated. They are permanent.

---

## When-to-do-what

Quick decision table for any deploy intent. Operator says X → I do Y.

| Operator says | I do |
|---|---|
| "deploy", "push", "promote", "ship" | Confirm intent. If yes → run wrapper. Report per-gate. |
| "promote til preview" | Same as above, explicit on HOP A. |
| "ship til main", "release to main" | Verify HOP A done + LKG tag exists + 14 checks green + checklist filled. If all → suggest `gh pr create`. Don't merge. |
| "drift-check sa noe" | Run drift-check. Map first FAIL to fix path from PLAYBOOK.md. Propose. |
| "smoke red" / "deploy broken" | Read smoke output. Identify red surface. Propose rollback command for that surface from PLAYBOOK.md. Wait for operator confirm. |
| "rollback", "revert deploy" | Identify which surface. Propose `vercel rollback` OR `git checkout <lkg> + deploy.sh` OR Supabase manual revert. Wait for confirm. |
| "CI rødt" | `gh pr checks <num>`. Identify failed check. Map to source workflow. Propose fix path. |
| "MIGRATIONS_FAILED" | Load `smartout-database-guide`. Query Supabase MCP `list_migrations` on prod. Diagnose first failed migration. Propose recovery path. |
| "EF deploy failed" | Load `smartout-edge-function-guide`. Read CI log for which function. Check config.toml. Check secrets. Propose. |
| "what's the state?" | Read STATE.md. Run `./infra/scripts/drift-check.sh --skip-droplet`. Report pipeline gap, latest LKG tag, last drift result. |
| "is preview safe to promote?" | Verify drift-check < 24h green + LKG tag exists + 14 checks green on dev SHA. Report. |
| "open release PR" | Verify HOP A complete. If yes → `gh pr create --base main --head preview --template preview-to-main.md`. Don't merge. |
| "post-merge cleanup" | Load `post-merge-verify` skill. Run. Report. |
| "drift alert from heartbeat" | Read alert. Run drift-check fully. Identify failed check. Propose fix path. Wait for confirm. |

---

## When NOT to act — escalation table

| Situation | Action |
|---|---|
| Operator hasn't confirmed promote | Wait. Don't run wrapper. |
| Drift-check red on EF secrets but operator absent | Log to activity-log, send Telegram via heartbeat, do NOT auto-fix |
| MIGRATIONS_FAILED on prod | Stop everything else. Surface to operator with all known commands from `smartout-database-guide`. |
| ADR-0265 doc/code disagreement | Flag as doc-drift bug. Do not act on either until operator decides. |
| Pre-push hook blocked operator | Read hook message. Map to fix path. Don't suggest `--no-verify`. |
| Two operators (multiple sessions) trying to promote simultaneously | Refuse second one. Tell second operator about first. |
| Pipeline gap > 200 commits dev→preview before promote | Load `git-cleanup` skill. Run landscape audit. Wait for operator decision before running wrapper. |

---

## Mantra (also in agent .md)

**Pipe is correct. Operator decides. Drift is the enemy. LKG is the rope.**
