---
title: "Pipeline cutover — fresh-head session pickup (HOP B + DB push)"
status: ready
created: 2026-05-04
updated: 2026-05-04
module: deployment
tags: [handoff, deploy, pipeline, hop-b, db-push, allow-unrelated-histories, dag-split]
---

# Pipeline Cutover — Fresh-Head Session Pickup

> **For Pontus next session:** HOP A landed 2026-05-04 06:30. HOP B + DB push deferred. This is the pickup brief. Read first, then `docs/handoffs/HANDOFF-2026-05-04-pipeline-cutover-divergence.md` for full divergence anatomy.

## State at pickup

| Item | Value |
|---|---|
| `main` | `1f5bf4807` (untouched since 2026-05-03) |
| `preview` | `f51b1f55f` (= dev, post-HOP-A 2026-05-04 06:30) |
| `development` | `f51b1f55f` |
| LKG preview tag | `lkg-preview-f51b1f55` |
| Vercel preview | READY (web + landing + pwa) |
| Smoke preview | GREEN 4/4 |
| Production smoke | last green 2026-05-03 (not re-run since HOP B not yet executed) |
| PR #309 (preview→main) | OPEN, CONFLICTING/DIRTY (DAG-split, NOT squash-ghost) |

## What was done last session

1. ✅ Phase A repo-cleanup → `cff8c5066`
2. ✅ Phase B L-0197 ruleset Path A1 → `3f30e09ce` + operator PUT + `4a8d28244`
3. ✅ Phase C 12 learnings filed → `450197187`
4. ✅ Phase D closure docs → `295f88d33`
5. ✅ HOP A: preview FF to dev `f51b1f55f`, smoke green, lkg-tagged
6. ✅ Bug fix: `smoke-probe.sh:56` hardcoded fallback `cibmhhgsrdmpnmcikalu` (deleted) → `rrjfrisxvrrhyzzitlxd`

## What's blocking HOP B + prod DB push

### Blocker 1 — DAG-split (disjoint histories)

`git merge-base origin/main origin/preview` exits 1. Three branches share **zero commits**. PR #309 CONFLICTING is structural, not content.

**Resolution**: local `git merge --allow-unrelated-histories -X theirs` by Pontus, then push directly to main. NOT through GitHub PR UI.

### Blocker 2 — 22 missing version-records in prod `supabase_migrations.schema_migrations`

Production has applied these migrations but the version-records were never recorded (squash/reset pipeline history). On next merge-to-main, Supabase Cloud will re-attempt them → 16 non-idempotent ones will fail.

**Resolution**: SQL prep BEFORE merge. INSERT 22 version-records into `schema_migrations`. List in `HANDOFF-2026-05-04-pipeline-cutover-divergence.md` Section 2 (deploy-conductor agent's diagnosis).

### Blocker 3 — 16 non-idempotent migrations in delta

Verification-agent confirmed: 94 unapplied migrations, 16 lack idempotency markers. Risk class: SAFE for first-time linear apply (Supabase `db push` skips already-applied versions per `schema_migrations`). Risk vector: mid-flight interruption causes partial-record state.

**Resolution**: pg_dump snapshot before push. Run during off-peak. `supabase db push --dry-run` first if possible.

## Exact operator command sequence (fresh head, ~60-90 min)

### Step 1: SQL prep — INSERT 22 missing version-records

Per `HANDOFF-2026-05-04-pipeline-cutover-divergence.md` Section 2 — full list of 22 versions. Use Supabase MCP `execute_sql` on project `yljaglomadbhyqpcigff`:

```sql
INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  ('20260413000000'),  -- engine_authority_config_updated_by_nullable (= dev's 20260414225000)
  -- ... [21 more from divergence handoff Section 2]
ON CONFLICT (version) DO NOTHING;
```

Verify via:
```sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 30;
```

### Step 2: pg_dump snapshot (belt-and-suspenders)

```bash
op run --env-file=.env.template -- bash -c \
  'pg_dump "$DATABASE_URL" --schema-only -f /tmp/prod-schema-snapshot-$(date +%Y%m%d-%H%M%S).sql'
```

(If `DATABASE_URL` not in env-template, use Supabase MCP `get_project` for connection string.)

### Step 3: HOP B — local merge with `--allow-unrelated-histories`

```bash
cd ~/dev/smartout.ai
git fetch origin main preview
git checkout main
git merge origin/preview --allow-unrelated-histories -X theirs \
  -m "release: preview → main [deploy] (DAG-merge post Scenario K reset)"
git push origin main
```

⚠️ This BYPASSES the PR template. ADR-0265 hard rule "main only accepts PRs from preview" is broken once. Document as one-time exception.

After push, GitHub Actions main-deploy CI runs. Wait for `gh run list --branch main --limit 5` to show all green.

### Step 4: Production migration apply

```bash
op run --env-file=.env.template -- supabase db push --linked
```

Watch for errors. If any migration fails mid-flight, STOP. Don't retry blindly.

Verify post-push:
```sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
-- Expected tail: 20260523000100_compute_period_aggregates_company_join
```

### Step 5: Production smoke

```bash
op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh production
```

### Step 6: Tag prod LKG + close PR #309

```bash
MAIN_SHA=$(git rev-parse origin/main)
git tag "lkg-prod-${MAIN_SHA:0:8}" origin/main
git push origin "lkg-prod-${MAIN_SHA:0:8}"

gh pr close 309 --comment "Resolved via local --allow-unrelated-histories merge tonight. DAG-split prevented PR-UI merge."
```

### Step 7: Activity log + closure

```bash
~/.claude/scripts/log-activity.sh git pontus \
  "HOP B + DB push complete on smartout.ai. main → ${MAIN_SHA:0:8}. 94 migrations applied. lkg-prod-${MAIN_SHA:0:8} tagged. PR #309 closed (DAG-merge bypass)."
```

## Decision gates fresh head should re-verify

Before Step 1 — confirm with fresh eyes:

1. Is preview still at `f51b1f55f`? (`git rev-parse origin/preview`)
2. Is prod smoke still green? (`./infra/scripts/smoke-probe.sh production`)
3. Has anyone pushed new migrations to dev/preview overnight? (`ls supabase/migrations/ | sort | tail -5`)
4. Is the 22-version-records list in the divergence HANDOFF still accurate? Re-query prod schema_migrations.

If any of these surface drift, recalibrate before SQL prep.

## Risk classes (fresh-head reminder)

| Step | Risk | Reversible | Notes |
|---|---|---|---|
| 1 SQL prep | LOW | yes (DELETE FROM schema_migrations WHERE version IN...) | Idempotent if ON CONFLICT DO NOTHING |
| 2 pg_dump | LOW | n/a (read-only snapshot) | Provides rollback rope |
| 3 HOP B merge + push | MEDIUM | no (push to main) | DAG-merge irreversible without force-push (forbidden) |
| 4 db push | HIGH | NO | 94 migrations applied, 16 non-idempotent in linear order |
| 5 smoke | LOW | n/a | Read-only |
| 6 tag + close PR | LOW | yes (delete tag) | n/a |

## Sources of truth

1. `docs/handoffs/HANDOFF-2026-05-04-pipeline-cutover-divergence.md` — full divergence diagnosis, 22 version-record list, 16 non-idempotent classification
2. `.claude/agents/deploy-conductor/STATE.md` — verified state at session-end
3. `.claude/agents/deploy-conductor/RUNS.md` — last 2 entries (HOP A execution + diagnosis)
4. `docs/decisions/0265-enforced-deployment-pipeline.md` — base enforcement law (broken once tonight, document one-time exception)
5. ADR backlog candidate: post-Scenario-K HOP B always requires `--allow-unrelated-histories`. New ADR draft after this cutover succeeds.

## Mantra (fresh head)

**Pipe is correct. DAG is split. SQL prep first, dump second, merge third, push fourth, smoke fifth, tag sixth.** No skipping. No shortcuts. If smoke red post-push, rollback Vercel traffic NOT git revert (per ADR-0271 §5).
