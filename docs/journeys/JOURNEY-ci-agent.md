---
title: "Journey — pipeline-autonomy-ci-agent"
feature: ci-agent
status: verified
updated: 2026-05-04
created: 2026-05-04
module: deployment
tags: [journey, ci, automation, adr-0275]
---

# Journey — Autonomous CI Incident-Response Agent

> Sub-sortie of `campaign/pipeline-autonomy`. Branch: `feat/pipeline-autonomy-ci-agent`. ADR: 0275.

## Context

Pontus has scope-granted full ownership of CI/CD mechanics to a new agent (`ci-incident-conductor`). This sub-sortie scaffolds the agent bundle, GitHub Actions workflow, triage scripts, escalation channels, ops landing zone, and protocol document. Phase 0 (log-only, 14 days) ships on first merge. Subsequent phases (comment+escalate, auto-fix, ADR-drafting, skill-emission) progress autonomously based on metrics.

## Personas

- **Pontus (operator)** — builds features, pushes to development, decides HOP B (`preview → main`) jointly with the agent. Otherwise hands-off.
- **CI Incident Conductor (`ci-incident-conductor`)** — autonomous agent, first responder for failed CI on every branch except `main`/`preview`.
- **Build agents (other Claude instances)** — push commits that may trigger CI failures. Read incident-log diagnoses to learn what to fix.
- **Migration authors** — humans who write `supabase/migrations/*` files; receive PR-comments with L-0042 references when timestamps drift.

## Journey 1: CI fails on a feature branch (auto-fix path)

**Precondition:** A `feat/*` branch has CI red on a class within the auto-fix allowlist (e.g. stale `.next/types`, action sha-pin drift).

1. Build agent pushes commit → System runs CI workflows → CI workflow fails with TS2307 phantom imports → Build agent sees red status.
2. `workflow_run` event fires `completed` with `conclusion: failure` → System triggers `ci-agent.yml` workflow → CI agent runs `collect.sh` → System pulls run-context, log-excerpt, recurrence count, parent-commit regression status.
3. CI agent runs `triage.sh` → System calls OpenRouter Sonnet → Model returns `{class: "stale-artifact", confidence: 0.92, action: "auto-fix", severity: "info", is_known_pattern: true, memory_ref: "learning_stale_next_types_blocks_typecheck.md"}`.
4. CI agent runs `apply-fix.sh` → System creates branch `ci-fix/<incident-id>`, adds purge-step to `ci.yml`, opens PR to `development` with label `ci-auto-fix` → Build agent sees PR in inbox.
5. Auto-fix PR's own CI runs green → CI agent's self-merge path enabled in Phase 2 → System auto-merges to `development` (Phase 0/1: comment-only, no merge).
6. CI agent runs `log.sh` → System appends incident to `ops/ci-incidents/log.jsonl` and pushes the log file to `development`.

**Postcondition:** CI green on `development`. Incident logged with `validation: pass`. Build agent unblocked.

**Error paths:**
- Auto-fix PR's own CI fails → CI agent reverts the PR creation, downgrades confidence in log, escalates to severity `medium`, opens GitHub Issue.
- OpenRouter API down → triage exits non-zero → log entry written with `action: skipped, root_cause: triage-api-down` → no escalation (already a system-level alert via Telegram drift-check).

## Journey 2: Supabase migration fails on PR (escalation path, no auto-fix)

**Precondition:** A PR opens with a new migration whose timestamp predates a referenced table's creation (L-0042).

1. Author opens PR → System runs `pgtap.yml` + Supabase GitHub App preview → Supabase App reports `FAILURE` with unique preview-branch ref → Author sees red status.
2. `check_suite` event fires → CI agent runs `collect.sh` → System inspects URL fingerprint: `/<unique-ref>` (not `/settings/integrations`) → classify as real fail, not supersession.
3. CI agent runs `triage.sh` → Model returns `{class: "supabase-app", subclass: "migration", confidence: 0.88, action: "escalate", severity: "high", suggested_fix: "re-timestamp file to YYYYMMDDHHMMSS > <repo-tip>"}`.
4. CI agent runs `escalate.sh` (severity high) → System posts PR-comment with diagnosis + L-0042 reference + exact suggested timestamp → System opens Linear OPS-ticket with 👀 emoji, severity `high` label, mentions PR author → System sends Telegram alert.
5. Author reads PR-comment → Author renames migration file with new timestamp → Author force-pushes to PR → System re-runs CI → Supabase App green.
6. CI agent observes resolution via `workflow_run` success event → Updates incident in `log.jsonl` with `ts_resolved` + `validation: pass-by-author-fix` → Closes Linear ticket with ✅ emoji + final summary.

**Postcondition:** PR mergeable. Migration timestamp correct. Author + Pontus both informed via channels they're already on.

**Error paths:**
- Author re-pushes with same wrong timestamp → CI agent observes recurrence (`recurrence_count_30d > 1` for same head) → escalates to severity `critical`, mentions Pontus.
- Migration is part of a larger campaign with unresolvable cross-branch ordering → CI agent flags `confidence < 0.6` → escalates to `deploy-conductor` for human consult.

## Journey 3: Pontus pauses the agent

**Precondition:** Pontus wants to run a manual experiment without the agent reacting (e.g. intentionally pushing a broken state to test something).

1. Pontus opens an Issue in repo with label `ci-agent-pause` (no body needed) → System fires `issues.labeled` event → CI agent's next triage cycle reads the open `ci-agent-pause` issue → CI agent demotes to read-only Phase 0 within next event.
2. Pontus runs the experiment → CI fails → CI agent runs `collect.sh` + `triage.sh` (read-only) → `apply-fix.sh` skipped, `escalate.sh` skipped, `log.sh` records `action: paused-by-operator` → No noise.
3. Pontus closes the `ci-agent-pause` Issue (or opens a new one with label `ci-agent-resume`) → CI agent's next triage cycle observes the resume signal → CI agent resumes its prior phase.

**Postcondition:** Pontus has temporary control without interference. Audit trail shows the pause window.

**Error paths:**
- Pontus forgets to close the pause Issue → CI agent stays paused indefinitely → No auto-recovery (intentional; agent must not override operator).
- CI agent's metric-watcher detects pause > 7 days → Posts a single comment on the pause-Issue: "Still paused after N days — confirm intentional?" Then waits for operator. No further nag.

## Journey 4: Pontus reviews HOP B preview → main

**Precondition:** All 6 HOP A gates green on `preview`. CI agent has run `promote-preview.sh` autonomously and tagged `lkg-preview-<sha>`.

1. CI agent observes HOP A success → System opens PR `preview → main` using `preview-to-main.md` template → System assigns Pontus as reviewer + posts a Telegram alert: "HOP B ready, lkg-tag <sha>, 14 checks running."
2. CI agent waits for 14 required checks → System reports per-check status to PR → Pontus opens PR on mobile/desktop.
3. Pontus reviews 6-item operator checklist → Pontus either checks all boxes + merges, OR comments with concerns.
4. Pontus merges → System fires `push` event on `main` → CI agent observes → CI agent runs `smoke-probe.sh production` → System reports smoke status to Telegram → On red, CI agent proposes (does not execute) rollback command per surface.

**Postcondition:** Production deploy verified. Pontus retains final say on every preview→main merge.

**Error paths:**
- 14 checks include a flaky → CI agent re-runs the flaky job once (within Phase 2 allowlist) → if green, continues; if red, escalates to Pontus before merge.
- Smoke red → CI agent proposes rollback in Telegram with exact command per affected surface → Pontus confirms or denies → CI agent executes confirmed rollback only.

## Acceptance criteria

- [x] ADR-0275 written and registered in decision log (commit `1b468de32`)
- [x] `feedback_ci_domain_full_autonomy.md` memory file written
- [x] Agent bundle scaffolded (commit `38f2e029a`)
- [x] Workflow + triage scripts + ops + protocol scaffolded (commit `08fde16a3`)
- [x] Journey doc written (this file)
- [ ] Typecheck passes — verified by `/close-feature` script
- [ ] Handoff doc written by `/close-feature`

## Known limitations (documented in ROADMAP)

- Phase 0 is log-only — no comments, no fixes, no escalation. 14 days minimum.
- YAML-structural auto-fix (concurrency, timeout) deferred to Phase 2 — needs YAML-aware tool, not sed.
- OpenRouter model slug requires manual verification (`anthropic/claude-sonnet-4-5` vs `4-6` — confirmed at first triage run).
- `TELEGRAM_CHAT_ID` + `LINEAR_OPS_PROJECT_ID` must be set as repo variables (not secrets) before Phase 1 unlock.

## Next sub-sorties (queued under `campaign/pipeline-autonomy`)

1. `feat/pipeline-autonomy-git-cleanup-tier1` — heartbeat-integrate git-cleanup Tier 1 + Tier 2 (ci-agent calls git-cleanup before HOP A when pipeline-gap > 200).
2. `feat/pipeline-autonomy-drift-auto-fix` — auto-PR for drift-check FAILs on env-template / env.ts when fix is mechanical.
3. `feat/pipeline-autonomy-cron-canary` — synthetic CI runs on cron to detect silent regressions.
4. `feat/pipeline-autonomy-skill-emission` — promote curated knowledge to `ci-incident` skill once Phase 4 threshold hit.
