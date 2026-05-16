---
title: "Journey — channel_admin seed migration applies clean to fresh DB"
feature: channel-admin-capability-registration
status: draft
updated: 2026-05-16
created: 2026-05-16
module: ai
tags: [journey, ai, supabase, migration, adr-0189, channel-admin]
---

# Journey: Seed migration inserts channel_admin authority config per workspace

**Precondition:** Fresh Supabase Local DB (or Branch DB) with all migrations applied up to HEAD. `engine_authority_config` table has zero rows for capability='channel_admin'.

1. Migration `<TS>_seed_channel_admin_authority.sql` applies.
2. For each existing workspace, one row inserted into `engine_authority_config`:
   - capability = 'channel_admin'
   - default level = 'confirm'
   - default min_role = 'admin'
   - per-tool overrides for mute_channel + leave_channel (autonomous/employee)
   - per-tool override for invite_to_channel (confirm/manager)
3. Migration is idempotent — re-running applies no duplicate rows (ON CONFLICT or upsert).
4. New workspaces created after migration get the channel_admin authority config row through bootstrap path (per ADR-0189 capability-seed-on-bootstrap pattern).

**Postcondition:** Every workspace has channel_admin authority configured. Tool calls can resolve gate evaluation against engine_authority_config without 404 / null lookups.

**Error paths:**
- Migration timestamp NOT strictly greater than HEAD → conflict at apply time.
- Missing FK to capability registry (if FK exists in schema) → seed fails until capability name registered (T1 must land before T2 in same merge).
- Bootstrap path not patched for new workspaces → workspaces created after migration lack the seed row; tracked as follow-up if not addressed by existing capability-bootstrap mechanism.
