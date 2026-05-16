---
title: "Journey — Fix Authority Seed Parity"
feature: fix-authority-seed-parity
status: verified
verified_at: 2026-05-16
created: 2026-05-16
updated: 2026-05-16
module: governance
tags: [journey, authority, seed, gate]
---

# Journey — Fix Authority Seed Parity

Companion to `docs/plans/PLAN-fix-authority-seed-parity.md`. ADR: `docs/decisions/0343-authority-seed-parity-backlog-hybrid.md`.

This sortie has no end-user journeys — pure governance-plane fix. Journeys here track **system invariants** verified at closure.

## Verification summary (2026-05-16)

| Journey | Method | Result |
|---|---|---|
| J1 — fresh DB graceful exit | Code-read of `DO $$` block + RAISE NOTICE path (mirrors `20260516100000_seed_reconciliation_authority.sql` proven pattern) | ✅ verified |
| J2 — populated DB cross-join idempotent | Code-read of CROSS JOIN + ON CONFLICT clause matching reconciliation reference | ✅ verified |
| J3 — parity script FAIL → PASS | Automated: `pnpm exec tsx scripts/authority-seed-parity.ts` exit 0 (post-commit `a203cc8a4`) | ✅ verified |
| J4 — UI flows unaffected | Code-read: (confirm, manager) floor matches `/dashboard/governance` layout guard at manager+ level | ⚠ verified-via-code-read; runtime smoke deferred to post-deploy |

## Journey 1: Migration applies cleanly on fresh DB

**Precondition:** Fresh Supabase Local with 0 workspaces, 0 godmode users.

1. Operator runs `npx supabase db reset` → all migrations apply in order
2. Backlog seed migration runs → DO $$ block detects no godmode user → emits `RAISE NOTICE` → exits gracefully
3. No rows inserted (no workspace to cross-join against)
4. Operator creates first workspace + first godmode user via subsequent seed
5. Operator re-runs migration manually OR next deploy applies it → seeds populate

**Postcondition:** Migration is safe on fresh DB. Replays without error.

**Error paths:**
- Workspace exists but no godmode user → RAISE NOTICE, no rows inserted, exit 0
- Multiple godmode users → use earliest (ORDER BY created_at ASC LIMIT 1) — matches reconciliation pattern

---

## Journey 2: Migration applies on populated DB

**Precondition:** Local DB with N workspaces, ≥1 godmode user, no prior backlog seeds.

1. Operator applies migration
2. DO $$ block finds godmode user
3. CROSS JOIN inserts 9 rows × N workspaces = 9N new rows
4. ON CONFLICT (workspace_id, capability) DO NOTHING — safe on re-apply
5. Operator re-runs migration → 0 new rows, no error

**Postcondition:** `SELECT count(*) FROM engine_authority_config WHERE capability IN (9-list) GROUP BY capability` returns 9 rows, each = N workspaces.

**Error paths:**
- Pre-existing partial seeds (e.g. `payroll` already seeded by other ADR) → ON CONFLICT skips, no error
- Future workspace added → next migration tick OR per-workspace bootstrap fills gap

---

## Journey 3: Auth-seed-parity gate transitions FAIL → PASS

**Precondition:** Branch `feat/fix-authority-seed-parity` checked out, migration applied locally.

1. Developer runs `pnpm exec tsx scripts/authority-seed-parity.ts`
2. Script walks `apps/`, `packages/`, `supabase/functions/` — collects gateAction call-site literals
3. Script parses `supabase/migrations/*.sql` for `INSERT INTO engine_authority_config` — collects seeded set
4. Diff: required ⊆ seeded
5. Script prints `PASS`, exits 0

**Postcondition:** CI gate green. F-CT-01 line in next audit dropped from HIGH backlog.

**Error paths:**
- Missed capability in migration → script prints capability + call sites → developer adds row → re-run

---

## Journey 4: Pre-existing UI flows unaffected by floor

**Precondition:** Migration applied. Live UI invokes one of 9 newly-seeded capabilities.

1. Manager opens `/dashboard/contracts` and clicks "Send" on employment_contract
2. BFF route calls `gateAction({ capability: "contract", actorProfileId: manager.id, ... })`
3. `gate_action()` resolves config row → checks `manager` role meets `min_role` floor for `contract`
4. If decision = `accept-as-proposed (admin)`: manager BLOCKED — feature regression
5. If decision = `lower-floor (manager)`: manager allowed — no regression

**Postcondition:** Each capability's floor matches the actual role that uses it in production today. **Council must verify before T1 ADR writes the floor.**

**Error paths:**
- Wrong floor → 403 in UI → operator escalates → hotfix migration lowers floor

---

## Manual test cases (v1)

| ID | Test | Expected | Status |
|---|---|---|---|
| AS-01 | Apply migration on fresh `supabase db reset` | RAISE NOTICE on missing godmode; exit 0 | Manual |
| AS-02 | Apply migration with godmode + 1 workspace | 9 new rows | Manual |
| AS-03 | Re-apply migration | 0 new rows, no error | Manual |
| AS-04 | `pnpm exec tsx scripts/authority-seed-parity.ts` | exits 0, no missing | **Automated** (CI gate `authority-seed-parity` workflow) |
| AS-05 | UI smoke: manager sends contract | Allowed (if floor = manager) | Manual |
| AS-06 | UI smoke: manager updates policy | Allowed (if floor = manager) | Manual |
| AS-07 | UI smoke: employee creates helpdesk_query ticket | Allowed (if floor = employee, level = autonomous) | Manual |
