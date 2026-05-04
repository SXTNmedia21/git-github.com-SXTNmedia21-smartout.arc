---
title: "Journey — Fix Authority seed CVE remediation"
feature: contract-hub-fix-forward
journey: fix-authority-seed-cve
status: verified
verified_at: 2026-04-22
e2e_test: null
created: 2026-04-22
updated: 2026-04-22
module: contracts
tags: [journey, fix-forward, p0]
---

# Journey: Fix Authority seed CVE remediation (UPSERT + bootstrap trigger)

**Role:** system (migration + trigger) / workspace-admin (downstream effect)

**Precondition:** Fresh database (or freshly created workspace) where the seed migration silently no-ops because target rows already exist or workspace was created after seed ran. Result: `engine_authority_config` has no row for contract capabilities → C4 default-allow CVE: any actor can invoke contract mutations without authority enforcement.

## Happy Path

1. Operator runs new migration → seed converts to `INSERT ... ON CONFLICT (workspace_id, capability) DO UPDATE SET ... COALESCE(...)` mirroring the helpdesk_query pattern → existing rows preserved, missing rows inserted, no silent skip.
2. Migration creates a `capability_default_registry` table (registry-driven) and installs an `AFTER INSERT ON workspace` trigger that auto-seeds `engine_authority_config` rows for every registered contract capability whenever a new workspace is created → no future workspace can launch without authority rows. AFTER INSERT (not BEFORE) chosen so FK constraints are satisfied without DEFERRABLE; rationale documented in migration header.
3. Backfill block iterates existing workspaces lacking contract authority rows and inserts the canonical default-deny config → CVE window closed for all live tenants.
4. pgTAP test asserts: after `db reset` + seed, every workspace in `workspace` table has `engine_authority_config` rows for `contract.publish`, `contract.deprecate`, `contract.fork`, `contract.bulk_send` → green.

**Postcondition:** No workspace can exist without contract-capability authority rows. C4 governance enforces correctly. Default-allow CVE eliminated.

## Error Paths

- **Scenario (pre-fix):** Workspace created after seed migration ran → `engine_authority_config` empty for that workspace → contract capability invoked → C4 default-allows → unaudited mutation → **Now:** Trigger auto-seeds rows on workspace insert; even if trigger missed, backfill catches it; capability invoke finds explicit row and enforces deny/allow per config.
- **Scenario (pre-fix):** Re-running seed migration on existing DB → INSERT silently skips conflicting rows → no error, no warning, no detection → **Now:** UPSERT explicitly preserves+merges; pgTAP parity test fails CI if any workspace lacks rows.

## Verification

- [x] Implementation matches Council Gate 4 R2 fix specification (commit `b7ce8bf8`)
- [ ] E2E test exists (deferred to P1 follow-up sortie)
- [x] pgTAP `contract_authority_seed_parity.sql` (12 assertions) covers registry shape, default level/min_role, trigger existence, fresh-workspace bootstrap, idempotency under replay, and end-to-end gate_action enforcement

**Status flipped to `verified` 2026-04-22 — implementation verified against `b7ce8bf8`.**
