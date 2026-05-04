---
title: "ci-incident-conductor — Playbook"
status: canonical
updated: 2026-05-04
---

# Playbook

Concrete triage scripts for each failure class. Every scenario maps a signal to: (a) classification steps, (b) action selection, (c) escalation criteria, (d) RUNS.md log-jsonl entry shape.

---

## Scenario A — CI config failure

**Trigger signal:** Workflow YAML lint error; action version pin drift; missing `concurrency:` causing queue pile-up; missing `timeout-minutes` on runaway job; unexpected workflow trigger config.

**Classify:**
```bash
gh run view <run-id> --log-failed | head -100
# Look for: "Invalid workflow file", "action `uses:` reference", YAML parse error, exceeded timeout
```

Check for action version drift:
```bash
grep -rE 'uses: .*@v[0-9]' .github/workflows/
# Pinned to semver tag vs sha — sha-pin is preferred per ADR-0265
```

**Action selection (Phase 2+):**

| Symptom | Auto-fix | PR content |
|---|---|---|
| Missing `concurrency:` | YES | Add `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }` |
| Missing `timeout-minutes` | YES | Add `timeout-minutes: 30` (or 60 for docker-build jobs) |
| Workflow YAML whitespace/key-order lint | YES | Fix lint; no semantic change |
| Action version semver tag → sha-pin | YES (confidence 0.90, last 7 days upstream stable) | `gh api /repos/<owner>/<action>/commits/v<version> --jq .sha` then replace |
| Action version behind by major | NO | PR comment with proposed sha-pin; operator decides |

**Phase 0 action:** Log to `log.jsonl`, append RUNS.md. No PR, no comment.

**Phase 1+ escalation:** PR comment on the failing branch's open PR (or create GitHub Issue if no open PR). Severity: medium. Telegram if medium+.

**Reflection:** Append RUNS.md entry. Classification `A`, action `log-only` (P0) or `auto-fix` (P2+). Write activity-log.

**log.jsonl entry shape:**
```json
{
  "failure_class": "A",
  "root_cause": "missing concurrency group in ci.yml causing queue pile-up on parallel pushes",
  "confidence": 0.92,
  "action": "auto-fix",
  "action_detail": "PR #NNN ci-auto-fix/ci-YYYYMMDD-NNN: add concurrency group to ci.yml jobs"
}
```

---

## Scenario B — Dependency / cache regression

**Trigger signal:** `pnpm install` exits non-zero; `EINTEGRITY` or `ENOENT` in pnpm output; Turbo cache miss rate spike; lockfile conflict between branches.

**Classify:**
```bash
gh run view <run-id> --log-failed | grep -E 'EINTEGRITY|ENOENT|lockfile|cache hit|cache miss|ERR_PNPM'
# EINTEGRITY = corrupted cache or network artifact
# lockfile mismatch = upstream branch diverged pnpm-lock.yaml
# Cache miss spike = Turbo cache key drift (node version change, pnpm version change, env var added to turbo cache inputs)
```

Check cache hit rate (Phase 3+ metrics baseline):
```bash
gh run view <run-id> --log | grep -E 'cache (hit|miss)' | wc -l
# Cross-reference against STATE.md cache_hit_rate baseline
```

**Action selection (Phase 2+):**

| Symptom | Auto-fix | PR content |
|---|---|---|
| pnpm install EINTEGRITY | YES | Retry with `--frozen-lockfile` + clear pnpm store; if still fails → escalate |
| Turbo cache miss > 30% for 3 consecutive days | YES | Bust cache key: add `"${{ hashFiles('.nvmrc', '.node-version') }}"` to turbo inputs |
| Lockfile divergence between branches | NO | PR comment: "pnpm-lock.yaml conflict detected. Author must rebase and run `pnpm install` to regenerate." |
| pnpm major version mismatch | NO | Linear ticket + operator decision |

**Phase 0 action:** Log to `log.jsonl`, append RUNS.md. No PR, no comment.

**Reflection:** Append RUNS.md. Write activity-log.

**log.jsonl entry shape:**
```json
{
  "failure_class": "B",
  "root_cause": "Turbo cache key drift after node version bump in .nvmrc — cache miss rate 67% for 3 days",
  "confidence": 0.91,
  "action": "auto-fix",
  "action_detail": "PR #NNN: add .nvmrc to turbo cache inputs hash"
}
```

---

## Scenario C — Flaky test

**Trigger signal:** `run_attempt > 1` with success after retry; intermittent test failure without code change; same test file fails in < 20% of runs.

**Classify:**
```bash
gh run list --branch <branch> --limit 20 --json name,runAttempt,conclusion --jq '.[] | select(.runAttempt > 1)'
# Multiple run_attempt > 1 for same workflow = flaky pattern
```

Check if it's a known pattern:
```bash
cat ops/ci-incidents/log.jsonl | jq 'select(.failure_class == "C") | .root_cause' | sort | uniq -c | sort -rn
```

**Action selection:**

| Attempt | Action |
|---|---|
| First flaky detection, `run_attempt == 1` | Log + classify. Phase 2+: trigger one rerun. |
| After one rerun: green | Log as CONFIRMED flaky. Update recurrence_count_30d. |
| After one rerun: still red | Phase 2+: open skip-list PR + Linear ticket with `ci-quarantine` label. |
| ≥ 3 flaky occurrences in 30 days | Phase 3: draft ADR for test stabilization. |

**Quarantine PR format (Phase 2+):**
- Branch: `ci-fix/quarantine-<test-name>-<incident-id>`
- File: `apps/e2e/tests/<suite>.spec.ts` — add `.skip` to the failing test
- Label: `ci-quarantine`
- Title: `ci(e2e): quarantine flaky test <test-name> [ci-20XXXXXX-NNN]`
- Body: incident_id, last 5 run_attempt results, link to RUNS.md entry

**Phase 0 action:** Log only. No rerun, no quarantine.

**Reflection:** Append RUNS.md. Write activity-log.

**log.jsonl entry shape:**
```json
{
  "failure_class": "C",
  "root_cause": "e2e test 'dashboard navigation > opens shift drawer' fails intermittently — likely race condition on SSE connection",
  "confidence": 0.88,
  "action": "quarantine",
  "action_detail": "PR #NNN: skip flaky test + Linear OPS-123 opened"
}
```

---

## Scenario D — Stale build artifact

**Trigger signal:** TS2307 "Cannot find module" on a file that was deleted via `git rm`; `.next/types` stale after cherry-pick; typecheck passing locally but failing in CI on same SHA.

**Known pattern (L-stale-types, memory `learning_stale_next_types_blocks_typecheck.md`):**

`tsconfig.json` includes `.next/types/**/*.ts`. After `git rm` on any `page.tsx` or `route.ts`, the `.next/types` directory still references the deleted file path. `tsc --noEmit` fails with TS2307 because `.next/types/validator.ts` imports the phantom file. `next dev` or `next build` regenerates `validator.ts`; bare `tsc` does not.

**Classify:**
```bash
gh run view <run-id> --log-failed | grep "TS2307"
# If TS2307 + ".next/types" in path → D-class stale artifact
# Check: was a page.tsx or route.ts deleted in recent commits on this branch?
git log --diff-filter=D --name-only --pretty=format:'' -5 | grep -E 'page\.tsx|route\.ts'
```

**Action selection (Phase 2+):**

Auto-fix: add `.next/types` purge step to `typecheck` job in `ci.yml`:
```yaml
- name: Purge stale Next.js types
  run: rm -rf apps/web/.next/types apps/web/.next/dev/types
  working-directory: .
```

This is a whitespace-safe YAML addition, confidence 0.95.

**Phase 0 action:** Log to `log.jsonl`, append RUNS.md. Comment on PR with L-stale-types reference and local repro command (Phase 1+).

**PR comment format (Phase 1+):**
```
ci-incident-conductor: This is the L-stale-types pattern (memory: `learning_stale_next_types_blocks_typecheck.md`).

Root cause: `.next/types/validator.ts` references a deleted `page.tsx`/`route.ts`. TypeScript CI fails but local dev passes because `next dev` regenerates validator.ts.

Local fix:
```bash
rm -rf apps/web/.next/types apps/web/.next/dev/types && pnpm --filter web typecheck
```

Incident: ci-YYYYMMDD-NNN
```

**log.jsonl entry shape:**
```json
{
  "failure_class": "D",
  "root_cause": "stale .next/types after git rm on apps/web/src/app/dashboard/old-page/page.tsx",
  "confidence": 0.97,
  "is_known_pattern": true,
  "memory_ref": "learning_stale_next_types_blocks_typecheck.md",
  "action": "auto-fix",
  "action_detail": "PR #NNN: add .next/types purge step to ci.yml typecheck job"
}
```

---

## Scenario E — Supabase App supersession (no-op)

**Trigger signal:** Supabase GitHub App check-run shows CANCELLED; `detailsUrl` contains `/settings/integrations` (no unique preview-branch ref).

**Classify:**
```bash
gh api repos/SXTNmedia21/smartout.ai/commits/<sha>/check-runs --jq '.check_runs[] | select(.app.slug == "supabase") | {conclusion: .conclusion, details_url: .details_url}'
# If conclusion == "cancelled" AND details_url contains "/settings/integrations" → E
```

**Action:** No-op. This is expected Supabase App behavior when a newer preview-branch deploy supersedes an older one. Log as CONFIRMED if seen before, NEW if first time.

**Phase 0+ action:** Log to `log.jsonl` only. Severity: low. No escalation.

**Reflection:** Append RUNS.md (brief). Write activity-log.

**log.jsonl entry shape:**
```json
{
  "failure_class": "E",
  "root_cause": "Supabase App preview supersession — CANCELLED state with /settings/integrations detailsUrl",
  "confidence": 0.98,
  "is_known_pattern": true,
  "action": "no-op"
}
```

---

## Scenario F — Supabase App migration failure

**Trigger signal:** Supabase GitHub App check-run shows FAILURE; `detailsUrl` contains unique preview-branch ref (e.g. `/branches/feat-xxx`).

**Classify:**
```bash
gh api repos/SXTNmedia21/smartout.ai/commits/<sha>/check-runs --jq '.check_runs[] | select(.app.slug == "supabase") | {conclusion: .conclusion, details_url: .details_url}'
# conclusion == "failure" AND unique preview-branch ref in details_url → F
```

**Load `smartout-database-guide` skill first.**

**Reproduce locally (Supabase Local only):**
```bash
git checkout <branch-sha>
npx supabase db reset          # NEVER against Cloud
# Read error output for: timestamp ordering, NOT NULL without default, IF NOT EXISTS missing, return type change
```

**Diagnose:**
```bash
# Check migration timestamp ordering
ls supabase/migrations/*.sql | sort | tail -5
# Cross-reference against known dependencies (e.g. if migration M adds column that migration M-1 still reads)
git log --oneline supabase/migrations/ | head -10
```

**L-0042 rule:** Migration ordering is author-responsibility. The CI agent:
1. Identifies the offending migration filename.
2. Computes the correct re-timestamp (between its dependency and its dependent).
3. Posts the exact rename command on the PR comment.
4. Stops. Never edits the file.

**PR comment format (Phase 1+):**
```
ci-incident-conductor: Supabase preview migration failure (F-class incident ci-YYYYMMDD-NNN).

Root cause: Migration timestamp ordering issue. Migration `<filename>` depends on `<dependency>` but is ordered before it.

Per L-0042 (author-responsibility): please rename:
```
mv supabase/migrations/<old-timestamp>_<desc>.sql supabase/migrations/<new-timestamp>_<desc>.sql
```

New timestamp should be: `<YYYYMMDDHHMMSS>` (after `<dependency-timestamp>`).

Reproduction: `npx supabase db reset` locally, error at line <N>.
```

**Severity:** High. Open GitHub Issue (ci-incident-urgent) + Telegram + Linear ticket (Phase 1+).

**log.jsonl entry shape:**
```json
{
  "failure_class": "F",
  "root_cause": "Migration 20260504120000_add_ci_table.sql ordered before its dependency 20260504130000_add_ci_index.sql",
  "confidence": 0.94,
  "action": "escalate",
  "action_detail": "PR comment with re-timestamp command. Linear OPS-NNN opened.",
  "escalated_to": "operator"
}
```

---

## Scenario G — Application bug test failure

**Trigger signal:** Lint / typecheck / vitest / E2E failure attributable to application logic regression (not CI config, not flaky, not stale artifact). Developer changed code that broke existing tests or type contracts.

**Classify:**
```bash
gh run view <run-id> --log-failed | head -200
# If error is in apps/, packages/, services/ code path AND not known CI-config pattern → G
```

**Action:** This is a diagnostic-only class. The CI agent does NOT write application code fixes.

Steps:
1. Identify exact failing test file and error message.
2. Identify the commit on the branch that introduced the regression (`git bisect` if non-obvious).
3. Post PR comment with diagnosis.
4. Open Linear OPS ticket (severity ≥ high if on main critical path; medium otherwise).
5. Stop. Wait for author to fix.

**PR comment format (Phase 1+):**
```
ci-incident-conductor: Application test regression detected (G-class incident ci-YYYYMMDD-NNN).

Failing: `<workflow>/<job>` → `<test file>:<line>`
Error: `<error message>`
Introduced by: `<commit SHA> — <commit subject>` (git bisect result or manual identification)

This is an application bug — CI agent does not patch application code. Please fix in this branch.

Linear ticket: OPS-NNN
```

**Severity:** Medium (standard regression) → High (regression on core path like typecheck, build, or vitest failing all tests). Telegram on medium+.

**log.jsonl entry shape:**
```json
{
  "failure_class": "G",
  "root_cause": "vitest schedule package: missing mock for new supabase method added in packages/ai/src/capabilities/schedule/tools.ts",
  "confidence": 0.87,
  "action": "escalate",
  "action_detail": "PR comment with failing test + introducing commit. Linear OPS-NNN.",
  "escalated_to": "operator"
}
```

---

## Scenario H — Deploy handoff

**Trigger signal:** Branch is `main` or `preview`; OR failure class is `deploy` (failure in promote-preview.sh, smoke-probe.sh, drift-check.sh, HOP A/B gate); OR operator asks CI agent to act on main/preview CI state.

**Action:** Immediate handoff. No triage beyond initial classification.

Steps:
1. Identify the incident and write a structured handoff note.
2. Append to `ops/ci-incidents/log.jsonl` with `escalated_to: "deploy-conductor"`.
3. Send Telegram alert via `heartbeat-notify.sh` with severity `deploy-handoff`.
4. Stop. Do not perform any auto-fix attempts on this incident.

**Handoff note in log.jsonl:**
```json
{
  "failure_class": "H",
  "root_cause": "failure on preview branch — out of CI agent scope",
  "confidence": 1.0,
  "action": "handoff",
  "action_detail": "Escalated to deploy-conductor per ADR-0275 §Boundary 1. Telegram alert sent.",
  "escalated_to": "deploy-conductor"
}
```

**Telegram message:**
```
CI-incident [deploy-handoff] <incident_id>: failure on <branch> detected. Scope: deploy-conductor (ADR-0275 §1). CI agent has stopped. deploy-conductor: read ops/ci-incidents/log.jsonl for incident context.
```

**Reflection:** Append RUNS.md, write activity-log. No further action.

---

## Scenario I — Security warning

**Trigger signal:** Dependabot security alert; secret detected in commit diff by pre-commit hook or CI scanner; SAST finding; trufflehog / detect-secrets output in CI logs.

**Action:** Escalate to operator immediately. Never act autonomously on security findings.

Steps:
1. Classify as I (security).
2. Do NOT quote or log the raw secret value — only reference the file path and pattern name.
3. Open GitHub Issue with label `ci-incident-urgent` (Phase 1+).
4. Send Telegram alert (any phase).
5. Open Linear OPS ticket marked 🔥 urgent (Phase 1+).
6. Stop. Wait for operator.

**Telegram message:**
```
CI-incident [SECURITY/urgent] <incident_id>: <alert-type> detected on <branch>. DO NOT QUOTE secret. Issue #NNN opened. Operator action required.
```

**log.jsonl entry shape:**
```json
{
  "failure_class": "I",
  "root_cause": "Dependabot: GHSA-XXXX in @supabase/supabase-js <2.x — high severity",
  "confidence": 1.0,
  "action": "escalate",
  "action_detail": "GitHub Issue #NNN (ci-incident-urgent). Linear OPS-NNN 🔥. Telegram sent.",
  "escalated_to": "operator"
}
```

---

## Scenario J — Read-only status query

**Trigger signal:** "What failed?", "CI status?", "How many incidents?", "Any patterns?", "Where are we on CI?" — no active incident triggering.

**Action:** Read-only. No triage, no RUNS.md entry, no activity-log. Just answer.

```bash
# Recent failures
cat ops/ci-incidents/log.jsonl | jq -s 'sort_by(.ts_detected) | reverse | .[0:10]'

# Failure class distribution last 30 days
cat ops/ci-incidents/log.jsonl | jq -s '[.[] | select(.ts_detected > "YYYY-MM-01")] | group_by(.failure_class) | map({class: .[0].failure_class, count: length})'

# Latest weekly summary
ls ops/ci-incidents/YYYY-WW-summary.md | sort | tail -1 | xargs cat

# Current phase
cat .claude/agents/ci-incident-conductor/STATE.md | grep "current_phase"
```

**Output format:**
```
CI state — <date> <time>:

Phase: <N> (<phase name>)
Incidents (last 30d): <N> — <breakdown by class>
Top pattern: <class> (<count>×) — <root cause summary>
Last incident: <incident_id> <date> — <class> — <action taken>
Known patterns: <N> in STATE.md

Open issues: <list of open ci-incident GitHub Issues>
```

---

## Scenario K — Pause / resume

**Trigger signal:** Issue labeled `ci-agent-pause` detected; comment `@ci-incident-conductor stop` on an agent-PR; operator says "pause the CI agent"; inverse for resume.

**Pause action:**
1. Write to STATE.md: `active_override: paused` + timestamp + reason (from issue body or comment).
2. Log to `log.jsonl`: `failure_class: K`, `action: mode-change`, `action_detail: "paused via <trigger>"`.
3. Until `ci-agent-resume` or `@ci-incident-conductor resume`: agent is read-only (Phase 0 equivalent regardless of actual phase).
4. All triage runs: log to `log.jsonl` but no comments, no PRs, no escalation.

**Resume action:**
1. Write to STATE.md: `active_override: null`.
2. Log to `log.jsonl`: `failure_class: K`, `action: mode-change`, `action_detail: "resumed via <trigger>"`.
3. Resume operation at prior phase.

**log.jsonl entry shape:**
```json
{
  "failure_class": "K",
  "root_cause": "operator pause via ci-agent-pause label on issue #NNN",
  "confidence": 1.0,
  "action": "mode-change",
  "action_detail": "paused — read-only mode active until ci-agent-resume"
}
```

---

## Common operator phrases — quick map

| Operator says | Scenario |
|---|---|
| "CI rødt", "build failed", "PR check failing" | A, B, D, or G — triage first |
| "flaky", "intermittent", "rerun" | C |
| "Supabase preview red", "supabase check failed" | E or F — read detailsUrl first |
| "migration failed on preview" | F |
| "security alert", "dependabot", "secret found" | I |
| "what failed?", "CI status?", "where are we?" | J |
| "pause the agent", "stop" | K |
| "resume", "unpause" | K (resume) |
| "failed on main" / "preview branch failing" | H — hand off to deploy-conductor |
| "action version drift", "workflow yaml" | A |
| "pnpm install failed", "cache miss" | B |
| "stale types", ".next/types", "TS2307" | D |
| "app bug", "test regression", "vitest failing" | G |
