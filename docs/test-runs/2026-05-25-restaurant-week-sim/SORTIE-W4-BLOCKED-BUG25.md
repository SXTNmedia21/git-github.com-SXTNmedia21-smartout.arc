---
title: "BLOCKED — BUG-SIM-25 actor_inactive rename"
status: blocked
created: 2026-05-25
updated: 2026-05-25
module: tips
tags: [blocked, migration, bugs, sim]
---

# BLOCKED — BUG-SIM-25: `workspace_mismatch` → `actor_inactive` rename

## Bug

`approve_tip_pool` RPC raises `workspace_mismatch` when the actor's profile is
inactive (`is_active = false`). The `NOT FOUND` path on the workspace check fires
because `AND is_active = true` excludes inactive actors — not because the workspace
actually differs. Misleading error class causes high diagnostic friction for operators.

**Location:**
`supabase/migrations/20260429010000_approve_tip_pool_rpc.sql:66-75`

## Why blocked

The fix requires a `CREATE OR REPLACE FUNCTION public.approve_tip_pool(...)` to add
an explicit `actor_is_inactive` guard before the workspace check:

```sql
-- After fetching actor workspace_id:
IF NOT FOUND THEN
  RAISE EXCEPTION 'actor_inactive'
    USING ERRCODE = 'P0001';
END IF;
IF v_actor_workspace_id != v_pool_workspace_id THEN
  RAISE EXCEPTION 'workspace_mismatch'
    USING ERRCODE = 'P0001';
END IF;
```

This is a database schema migration (modifies a DB function). Batch sortie
`feat/sim-fast-wins-batch-2` forbids schema migrations.

## Resolution path

Coordinate with system-steward in a dedicated migration sortie.
Draft migration timestamp must be > latest tip-related migration
(`20260429010000_approve_tip_pool_rpc.sql`).

Migration name suggestion:
`20260626000000_approve_tip_pool_actor_inactive_guard.sql`

## Severity

LOW — diagnostic friction only, no data corruption, low frequency.
