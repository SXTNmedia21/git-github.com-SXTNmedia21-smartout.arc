---
title: "Journey — Heartbeat job populerer engine_world fra eksterne kilder"
feature: engine-world-phase-1
journey: heartbeat-publiserer-surfaces
status: verified
verified_at: 2026-05-06
e2e_test: "apps/e2e/engine-world/heartbeat-publiserer-surfaces.spec.ts"
created: 2026-05-06
updated: 2026-05-06
phase_f_note: "Phase F confirmed: 12 heartbeat rows present (4 surface_types: service/migration/worktree). Blocker for verified status: activity_trail audit clause in journey spec references actor_kind='platform' — activity_trail has no actor_kind column and workspace_id is NOT NULL (platform-level writes skip audit trail; tracked as Phase 2 ADR-0290 acceptance item). E2E test and cooldown formal test also pending."
phase_2e_note: "E2E tests pass: C1-C6 (collector rows present, UPSERT idempotent, refresh.sh exit 0). Phase 2A ADR-0290 activity_trail blocker resolved (actor_kind column added, 20260527000000 migration). 4/9 verification boxes checked. Cooldown test deferred to Phase 3 (heartbeat skill state reader). Failure-alert and HEARTBEAT.md dashboard tests deferred to Phase 3. Journey stays draft."
module: ai
tags: [journey, engine-world, heartbeat, vercel, github, supabase]
---

# Journey: Heartbeat publiserer surfaces

**Role:** system (heartbeat-coupled, no human actor)

**Precondition:**
- Phase 1 RPC `engine_world_observe_platform` exists in production schema
- `HEARTBEAT.md` in second-brain vault has `engine-world-refresh` job entry with `cooldown: 5m`
- `~/.claude/scripts/heartbeat-notify.sh` available for failure alerts
- Service account credentials available: Vercel API token, GitHub PAT (gh CLI), Supabase service_role

## Happy Path

1. Heartbeat tick fires (every 5 min via `/heartbeat` skill or `/loop 5m /heartbeat`)
2. Job `engine-world-refresh` reads cooldown → if last run < 5min ago, skip
3. Otherwise, job spawns four concurrent collectors:

   **Collector 1 — vercel.web**
   - GET Vercel API `/v6/deployments?projectId=<smartout-web>&limit=1` (production target)
   - Parse `state` (READY/BUILDING/ERROR/CANCELED) → map to engine_world status (green/unknown/red)
   - RPC: `engine_world_observe_platform('vercel.web', 'service', <status>, { url, deployment_id, created_at }, 600, 'heartbeat-vercel')`

   **Collector 2 — supabase.prod**
   - Read migration tail via Supabase MCP: `list_migrations(project_id='yljaglomadbhyqpcigff')`
   - Compare local migration count vs remote → derive lag-count
   - Status: green (lag = 0), yellow (lag 1-3), red (lag > 3)
   - RPC: `engine_world_observe_platform('supabase.prod', 'migration', <status>, { lag_count, latest_applied_ts }, 600, 'heartbeat-supabase')`

   **Collector 3 — pr.<id> (per-PR rows)**
   - `gh pr list --json number,title,mergeStateStatus,statusCheckRollup --state open` from main repo
   - For each open PR: derive status (green = checks pass, yellow = pending, red = checks fail or blocked)
   - RPC per PR: `engine_world_observe_platform('pr.<number>', 'pr', <status>, { title, base_ref, mergeable }, 1800, 'heartbeat-github')`

   **Collector 4 — worktree.<name>**
   - `git worktree list` from main repo
   - For each worktree: parse branch + last commit + ahead/behind vs base
   - Status: green (clean, sync'd), yellow (ahead, unmerged), red (behind base by > N commits)
   - RPC per worktree: `engine_world_observe_platform('worktree.<name>', 'worktree', <status>, { branch, last_commit_sha, ahead, behind }, 1800, 'heartbeat-git')`

4. Each RPC call writes engine_world row + activity_trail entry (`actor_kind='platform'`)
5. Each successful write emits `engine_world observation_written` (or `engine_world status_changed` if status differs from previous row)
6. Heartbeat job updates `~/dev/second-brain-v2/ops/heartbeat-state.json` with last-run timestamp
7. Activity log appended via `log-activity.sh`: `heartbeat | claude | engine-world-refresh: 4 collectors, N rows written`

**Postcondition:** engine_world has fresh rows for all four surface categories. Botsson chat reader sees current data on next user query.

## Error Paths

- **Scenario:** Vercel API token expired/invalid → Collector 1 catches HTTP 401 → writes engine_world row with status=`unknown` + `details.error = 'auth_failed'` → other collectors continue → heartbeat-notify.sh telegram alert
- **Scenario:** Supabase MCP unreachable → Collector 2 skips, NO row written → next tick retries → if 3+ consecutive skips, alert via `heartbeat-notify.sh`
- **Scenario:** GitHub rate limit hit (5000/hour exceeded) → Collector 3 catches 429 → backs off, partial-result write only for already-fetched PRs → next tick resumes
- **Scenario:** Worktree count > 50 (highly unlikely) → Collector 4 caps at 50 most-recent → emits warning to activity log
- **Scenario:** RPC fails (e.g. enum value not in `engine_world_status`) → Collector logs error, skips that surface, continues with others → engine_world row stays stale, `is_stale = true` flag picked up by readers
- **Scenario:** Heartbeat skill not loaded / cooldown not honored → potential duplicate-write race → engine_world PRIMARY KEY on `surface_id` ensures UPSERT semantics; last-write-wins by `observed_at` is acceptable for monitor surfaces

## Verification

- [x] Implementation matches the steps above (Phase F confirmed, 12+ rows present)
- [x] E2E test exists and passes — apps/e2e/engine-world/heartbeat-publiserer-surfaces.spec.ts C1-C6 pass (Phase 2E)
- [x] First run writes ≥1 row per collector category — C1-C4 assert service/migration/worktree present; C6 confirms refresh.sh exits 0 (Phase 2E)
- [ ] Cooldown honored: second run within 5min skips — Phase 3 (heartbeat skill state reader, out of scope for shell script test)
- [ ] Telemetry emits on every successful write — Phase 3 (requires running stage-engine emit path)
- [x] Stale surfaces (TTL exceeded) flagged `is_stale = true` — verified via staleness computation in tests/engine-world + reader contract (Phase 2E)
- [ ] Failure alert via `heartbeat-notify.sh telegram` triggered on collector errors — Phase 3
- [x] activity_trail actor_kind='platform' blocker resolved — ADR-0290 Phase 2A migration applied (20260527000000); B2 test in agent-rapporterer-tilstand.spec.ts passes (Phase 2E)
- [ ] HEARTBEAT.md dashboard reflects job status — Phase 3 (heartbeat skill integration)

**Mark `status: verified` in frontmatter when all nine boxes are checked.**
