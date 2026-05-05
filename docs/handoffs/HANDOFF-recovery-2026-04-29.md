---
title: "HANDOFF — Stash Recovery + WIP Triage 2026-04-29"
status: done
updated: 2026-04-29
created: 2026-04-29
module: meta
tags: [recovery, stash, git, dashboard, botsson, contracts, handoff]
---

# HANDOFF — Stash Recovery + WIP Triage 2026-04-29

> Branch: `development`
> Worktree: `/home/sxtnl/dev/smartout.ai`
> Base: `origin/development`

## What Happened

Pontus reported "dashboard reset to very early version, lots of work lost". Investigation revealed three independent issues stacked on top of each other:

1. **Two real commits dropped** via `reset HEAD~1` earlier in the day:
   - `d4c0ce54` — blank-template POST route + platform-admin link fix
   - `e721e5ee` — contract-templates-in-settings test spec (170 lines)
2. **In-progress dashboard work hidden in stash** `WIP-pre-build-test-2026-04-29` (`stash@{0}` at start of session) — 51 files, +4894/-2060 lines. Stash was made before a build sanity check, never popped.
3. **Two parallel WIP streams orphaned** in working tree across branch switches: `feat/orb-as-agent-tool` (LiveKit voice-agent ↔ Botsson Orb bridge) and `feat/botsson-personal-tools` (5 personal capability tools).

No actual mass loss. Recovery applied stash content + sorted orphan WIPs to feature branches.

## Recovery Sequence

### Phase 1 — bulk recovery (auto-committed during stop-hook typecheck loop)

| Commit | Author | Notes |
|---|---|---|
| `b7c5b2df` | parallel Claude session | **39 files, +4894/-2060** — bulk dashboard recovery (DashboardShell, ActivityView, StrategicView, all komm tabs, day-control overhaul, MalerTab, kpi-targets, roster hooks, voice-agent edits). Title says "fix(telemetry,ui)" — **misleading**, see Known Issues. |
| `c963582a` | same | ContractDispatchDrawer envelope fix |
| `0854b37d` | same | Pure setState updater (React purity violation in toggle) |
| `555585876` | same | Contract template HTML preview in dispatch drawer |

### Phase 2 — manual recovery commits (this session)

| Commit | What | Why |
|---|---|---|
| `381aa9ee` | MalerTab `workspace_id` → `workspaceId`, drop dup `togglePublish` | b7c5b2df left snake/camel mismatch + duplicate function |
| `381aa9ee` | schedule/tools.ts schema correctness | `employee_id`/`shift_date` (not `profile_id`/`start_time`) per memory |
| `3e66b08f` | Dashboard nav components (GlobalCreateMenu, PageTabNav, DeviationDetailTab, Day*, KpiAccentTile, MultiStatTile) | Untracked stash content referenced by b7c5b2df |
| `b056c318` | `dashboard/calendar` route (8 components + lib + page) | Stash content |
| `66231db6` | `komm/_actions/access-channel-actions.ts` server action | Stash content |
| `43754946` | 3 migrations + day-timeline seed | Stash content |
| `d58a725d` | `web-start.sh` + `landing-start.sh` | Stash content |
| `fd370d72` | docs (lovsen agent, dashboard-page-pattern, routes) | Stash content |
| `b5b81fc76` | blank-template POST route — recovers dropped `d4c0ce54` | Telemetry guard fix: `contract_template forked` → `contract_template created` (allows `null` source) |
| `907d71f1b` | agent-memory + page-polish artifacts | Untracked `.claude/` content |
| `3e272edca` | `employment_form` required column on 3 contract routes | Last 3 typecheck errors blocking build |

### Phase 3 — WIP isolation

Two parallel streams found orphaned in working tree across branch switches:

#### `feat/orb-as-agent-tool` (+2 commits, pushed)
- `9a43fd3fd` — LiveKit voice-agent ↔ Botsson Orb bridge + `packages/botsson-sdk` package + voice token route + playground
- `0a5042fe1` — Cabinet Grotesk fonts (used by playground)

#### `feat/botsson-personal-tools` (+1 commit, pushed)
- `2c6cd1e49` — Personal capability: 5 utility tools (note, task, reminder, history, setting), voice-OK on all five, authority seeded at `suggest`

## Decisions

### D1 — Do NOT split b7c5b2df

**Decision:** Leave b7c5b2df as-is despite atomicity violation + misleading title.

**Why:** Splitting requires revert + cherry-pick + force-push to development. Force-push blocked by 14 required status checks on development ruleset. Cost > benefit.

**Mitigation:** This HANDOFF documents the mapping b7c5b2df → stash `WIP-pre-build-test-2026-04-29` so future `git blame` confusion has an out.

### D2 — Drop dropped commit `e721e5ee` permanently

**Decision:** Recover only `d4c0ce54` (route), not `e721e5ee` (test spec, 170 lines).

**Why:** Test spec targeted UI flows that have evolved across the recovery. Re-writing fresh tests cleaner than resurrecting stale ones.

**Mitigation:** Tracked as part of contract-templates-in-settings re-test backlog.

### D3 — Default `employment_form: "permanent"` on new contract inserts

**Decision:** New `employment_contract` rows in `POST /api/employment-contracts` and `POST /api/employment-contracts/bulk` default `employment_form: "permanent"`.

**Why:** `employment_form` is NOT NULL after `database.types.ts` regen in stash. Five enum values (`permanent | temporary | apprentice | practice | freelance`). `permanent` matches "fast ansettelse" — most common case for Norwegian SMB hospitality.

**Mitigation:** Composition wizard should expose `employment_form` selector in next iteration so default is overridable. Tracked.

## Learnings

### L1 — Stop hooks can auto-commit during typecheck loops

**What:** When stop-hook runs `pnpm typecheck` in a loop and Claude triggers Edit between iterations, the hook can chain commits autonomously without explicit Claude or user action.

**How seen:** During recovery, three commits (`b7c5b2df`, `c963582a`, `0854b37d`) appeared on development between two `git status` calls — neither I nor Pontus typed `git commit` for them.

**How to apply:** After any typecheck-loop interaction, verify HEAD before assuming staged files persist. `git log --oneline -5` before next operation.

### L2 — `git stash apply -u` silently skips untracked files that exist on disk

**What:** When stash contains untracked snapshot AND working tree has same path with different content, `git stash apply` skips it with `error: could not restore untracked files from stash` but does NOT fail the apply — only logs.

**How seen:** Recovery stash had `apps/web/src/app/dashboard/calendar/_components/BookingSheet.tsx` etc. as untracked snapshots; current working tree had newer versions of same paths. Stash apply succeeded for tracked changes, silently skipped untracked.

**How to apply:** When stash has `-u` flag, `git diff stash@{N} -- <path>` BEFORE apply to compare versions. Decide which to keep.

### L3 — `reset HEAD~1` in panic state risks dropping real work

**What:** Two commits with real content (`d4c0ce54` route + `e721e5ee` test) were dropped via `git reset HEAD~1` in earlier session as if they were noise.

**How seen:** Reflog at start of this session showed `HEAD@{2}: reset: moving to HEAD~1` and `HEAD@{3}: reset: moving to HEAD~1` consecutively, dropping two real commits before committing `f58e9453` ("restore Bindinger") in their place.

**How to apply:** Before `reset HEAD~N`, run `git log --oneline HEAD~N..HEAD` to read what's about to be dropped. If panic-state, prefer `git revert` (creates new commit, preserves history) over `reset` (rewrites history).

### L4 — Lint-staged auto-stash creates phantom WIP-on-X stashes

**What:** `lint-staged` creates a backup stash before running tasks, restores after success. Failed restore leaves orphan `WIP on <branch>` stashes that survive across branch switches.

**How seen:** Stash list during recovery had `stash@{2}: WIP on feat/botsson-personal-tools: fd370d722 docs(recovery): lovsen agent...` — the description references a development commit on a feat-branch label. Confusing because lint-staged was running on development at the time.

**How to apply:** When stash list shows `WIP on X` stashes you don't recognize, cross-check against your commit log. If they match a recent lint-staged run, drop them — they're transactional artifacts, not real WIPs.

## Known Issues

### KI-1 — Send-flow not verified end-to-end

Empty-state, preview, setState-fix, draft-fallback all built (commits `c963582a`, `0854b37d`, `555585876`, `1a39c68e0`). Not tested that sending lands a signed contract for Erik.

**Risk:** DocuSeal in dev-mode (`isContractServiceConfigured()=false`) → only updates status to `'sent'` locally, no real signing.

**Next step:** Manual end-to-end test against staging DocuSeal sandbox after preview-branch deploy. Tracked as part of #9 obligations-progress sortie.

### KI-2 — Commit `b7c5b2df` has misleading title

Title: `fix(telemetry,ui): register channel.access_scope_set + export KpiAccentTile`. Actual scope: 39 files, 7+ domains (telemetry + UI + dashboard + komm + day-control + voice-agent + contracts).

**Risk:** Future `git blame` on `WebDayControl.tsx`, `OverviewTab.tsx`, `CreateChannel.tsx` (+1006 lines) etc. will return this commit with vrang title.

**Mitigation:** This HANDOFF + activity-log entry both reference b7c5b2df → stash `WIP-pre-build-test-2026-04-29` for context. See D1.

### KI-3 — Pre-existing build issues from stash content

Three Botsson playground typecheck warnings from implicit `any` types in `BotssonSdkPlayground.tsx`. Resolved when `feat/orb-as-agent-tool` was committed (TypeScript types now resolve via `packages/botsson-sdk`). No action required on development.

## Deferred Tasks

### #9 — Obligations-progress

Contract obligation tracking + progress UI. Deferred from session, separate sortie. See contract module docs for scope.

### #10 — Bulk-actions

Contract bulk operations beyond bulk-create (bulk-revise, bulk-terminate, bulk-export). Deferred, separate sortie.

### #13 — Commit-split for b7c5b2df

**Closed as "no-action, documented".** See D1.

## Next Steps

1. **Test send-flow** — KI-1 blocker. Either preview-deploy + manual Erik test, or stage-mode toggle for local DocuSeal.
2. **Open PRs** for two pushed feat-branches:
   - `feat/orb-as-agent-tool` → development (LiveKit bridge)
   - `feat/botsson-personal-tools` → development (5 utility tools)
3. **Schedule cleanup sortie** for KI-3 (Botsson playground any-types) once botsson-sdk package matures.

## Related

- Activity log: `~/dev/second-brain-v2/ops/activity-log.md` 2026-04-29 entry
- Stash references: `WIP-pre-build-test-2026-04-29` (now dropped — recovery extracted)
- Memory: claude-mem session digest captures lessons L1–L4
