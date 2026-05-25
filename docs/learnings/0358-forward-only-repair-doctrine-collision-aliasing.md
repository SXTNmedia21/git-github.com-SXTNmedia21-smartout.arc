---
title: "Forward-only repair doctrine extends to timestamp-collision aliasing"
id: LEARNING_0358
status: canonical
layer: learning
created: 2026-05-25
updated: 2026-05-25
tags: [migrations, ghost-class, ADR-0361, ADR-0427, doctrine]
---

# Learning-0358: Forward-only repair doctrine extends to timestamp-collision aliasing

## Context

Sortie `feat/godmode-button-web` cherry-picked ADR-0410 godmode RPC from cloud/main into development. Re-stamped the cherry-picked migration from `20260625130000` (to avoid local-staged `channel_is_active_column` collision) → `20260626000000`. Authored 3 constraint-extension migrations at `20260626000100/0200/0300`. All passed local /verify + headed-browser Playwright click + DB assertion. Merged to development.

Then MCP prod-DB query revealed: prod ledger recorded `20260626000100` + `0200` as applied, but constraint defs unchanged. Initial diagnosis treated this as L-0302 ghost class (ledger-without-DDL). Council convened.

Phase 2.5 fact-check verified the briefing. Council Phase 3 reviewers found the deeper truth via code-trace: `origin/development` was 44 commits BEHIND `origin/main`. Main's recent hotfix flurry (PR #451-461) had shipped migrations at the SAME timestamps mine collided with — `invitation_pending_unique_per_phone` at `20260626000100`, `channel_is_active_column` at `20260626000200`, `capability_default_registry_communication` at `20260626000000`, `workspace_fk_cascade_sweep` at `20260626000001`. Prod ledger correctly reflected MAIN's migrations under those timestamps; my dev migrations had never deployed.

## Discovery

**Timestamp-collision-aliasing is a distinct sub-class from L-0302's ghost-DDL.**

- L-0302 ghost: same migration recorded as applied + actual DDL never ran (operator action with `migration repair --status applied` or partial-failure path)
- This (L-0358) collision-aliasing: ledger truthfully records *a* migration applied under timestamp T, but a different branch has a different migration at the same timestamp T → `supabase db push --include-all` matches by timestamp, sees "applied", skips the dev-branch file forever

The repair doctrine is the same: forward-only migration at a NEW unique timestamp with idempotent `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` body (ADR-0361 §Design 2). Manual ledger mutation or direct DDL via MCP `execute_sql` are rejected (would violate ADR-0265 and normalize manual prod touches).

**Operator detection signal:** when local migration tip ≤ origin/main migration tip, or when local has migrations under timestamps that origin/main also has, the dev branch is in a collision state. Pre-flight check in `close-feature.sh` should grep for this before allowing PR-merge:

```bash
local_max=$(ls supabase/migrations/*.sql | grep -oE '^[0-9]{14}' | sort -u | tail -1)
main_max=$(git ls-tree -r origin/main -- supabase/migrations/ | awk '{print $NF}' | grep -oE '[0-9]{14}' | sort -u | tail -1)
[ "$local_max" -le "$main_max" ] && echo "WARN: dev branch behind main migration tip — likely collision-state"
```

## Impact

- ADR-0427 codifies the repair doctrine for this sub-class (extends ADR-0361 §Design 2)
- Sortie `feat/godmode-button-web` migrations 0000/0100/0200/0300 deleted post-sync (5 files removed); single bundled `20260626000300_repair_godmode_constraints_collision_recovery.sql` placed at unique timestamp
- Pre-merge gate proposed for `close-feature.sh` — not yet implemented (separate sortie required)
- Council Phase 8 captures this as 2nd occurrence in 8 days (L-0302 was 1st, 2026-05-17). 3rd occurrence triggers SKILL.md promotion of the pre-merge timestamp-collision check.

## References

- ADR-0427 — Forward-only repair for timestamp-collision class (extends ADR-0361 §Design 2)
- ADR-0361 — CI Migration Coherence Check (sibling doctrine: forward-only)
- ADR-0265 — Enforced Deployment Pipeline (the rule preserved)
- ADR-0410 — Godmode Workspace Auto-Join (originating sortie)
- L-0302 — Ghost migration from reconciliation (sibling root-cause)
- L-0042 — Migration timestamp ordering (related)
- Council session 2026-05-25 — Phase 5 synthesis adopting Option D
- Commits: `b9e9a2dd0` (initial merge backup), `776aa8dfc` (canonical merge for PR #464), `613b7b09f` (collision cleanup)
- PR #464 (main → development sync, MERGED 2026-05-25)
