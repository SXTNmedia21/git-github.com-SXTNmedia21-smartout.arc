---
title: "Handoff — channel-admin-capability-registration"
feature: channel-admin-capability-registration
branch: feat/channel-admin-capability-registration
closed: 2026-05-16
module: ai
status: ready_for_close
updated: 2026-05-16
created: 2026-05-16
tags: [handoff, ai, capability, adr-0336, channel-admin]
---

# Handoff — channel-admin-capability-registration

## Summary

Ships ADR-0336 channel_admin capability registration scaffold: capability
definition, 6 skeleton tools, registry wire, types union update, seed
migration for engine_authority_config. Skeleton bodies fail-fast with
sortie-tracking strings per ADR-0196 Invariant 11. Unblocks Trust Gate D
so `campaign/chat-admin` can ship tool bodies one at a time.

## Journeys Delivered

| Journey | Status | Verification |
|---|---|---|
| trust-gate-d | verified | T3 steward: 6 tools match ADR-0336 table, emitPrefix unique, typecheck clean |
| seed-applies | verified | T3 steward: migration idempotent, ts strictly > HEAD, all 6 rows match design |

## Decisions Made

| Decision | Reason | Impact |
|---|---|---|
| Use ADR-0336 exact tool names (mute/leave/invite_to/rename/archive/change_member_role) | T0 explore initially suggested generic CRUD names — overridden because ADR-0336 names are load-bearing | Tool names match ADR doc + future capability tests |
| `emitPrefix: "channel_admin"` (not "channel") | `communication` capability already holds `"channel"` | No collision in registry self-check |
| `readOnlyTools: []` empty array | All 6 tools mutate; shape test accepts empty array | No fake read-only tool invented |
| Skeleton bodies return `{ ok: false, error: "not_implemented", note: "..." }` (not throw) | ADR-0196 Invariant 11 — throw bypasses telemetry contract | Phantom-emit prevented; tool calls fail loud at routing layer |
| 6 dotted-tool rows in seed migration (not 1 capability-level row) | ADR-0287 — per-tool authority key in engine_authority_config | Authority resolution per-tool, capability-level is fallback |
| Migration ts `20260616120000` | HEAD max was `20260616110100`; +59 seconds strictly > | No ordering conflict |
| Defer ADR-0336 prose amendment to separate dev commit | T3 steward advisory — ADR §49-50 + §107 prose suggests `archive=manager` and `rename=confirm` without min_role; implementation correctly admin-floor per design table | Tracked as known follow-up; not blocking this sortie merge |

## Learnings

| Learning | Context |
|---|---|
| Trust ADR design tables over ADR prose for authority assignments | ADR-0336 has internal contradiction between prose (§49-50/§107) and design table — T3 caught the prose drift. Future ADRs should make the table authoritative. |
| T0 Explore can hallucinate tool names | Explore agent suggested generic CRUD (create/delete/list/update) instead of ADR-0336's domain-action names (mute/leave/invite_to/rename/archive/change_member_role). Coordinator must explicitly cite ADR table in T1 dispatch prompt. |
| Skeleton-return convention beats throw | ADR-0196 Invariant 11: tool bodies that fail must return `{ ok: false, error: "..." }` JSON, not throw — throw bypasses telemetry/emit contract. Skeleton sorties must follow this even when "not yet implemented." |
| Stale dist trap recurs | T1 typecheck initially failed on stale dist files (`@smartout/telemetry`, `@smartout/types`, `@smartout/utils`, `@smartout/journey-ir`, `@smartout/payroll-export`). Recurring pattern (L-stale-telemetry-dist class). Sortie agents should run dist rebuild before typecheck. |

## Known Issues / Debt

1. **6 tool bodies pending** — Each skeleton must be replaced with a real implementation in its own sub-sortie under `campaign/chat-admin`:
   - `feat/channel-admin-mute-channel-body`
   - `feat/channel-admin-leave-channel-body`
   - `feat/channel-admin-invite-to-channel-body` (ADR-0339 invite-as-mission path determined here)
   - `feat/channel-admin-rename-channel-body`
   - `feat/channel-admin-archive-channel-body`
   - `feat/channel-admin-change-member-role-body`
2. **ADR-0336 prose drift** — T3 steward advisory: §49-50 + §107 prose contradicts design table. Recommend small amendment commit on development post-merge to align prose with implementation.
3. **Bootstrap path for new workspaces** — Existing capability-bootstrap mechanism should pick up new capability automatically. If new workspaces created after merge lack the channel_admin authority row, follow-up sortie needed.

## Files Changed

```
packages/ai/src/capabilities/channel-admin/index.ts                       CREATE
packages/ai/src/capabilities/channel-admin/tools/mute_channel.ts          CREATE
packages/ai/src/capabilities/channel-admin/tools/leave_channel.ts         CREATE
packages/ai/src/capabilities/channel-admin/tools/invite_to_channel.ts     CREATE
packages/ai/src/capabilities/channel-admin/tools/rename_channel.ts        CREATE
packages/ai/src/capabilities/channel-admin/tools/archive_channel.ts       CREATE
packages/ai/src/capabilities/channel-admin/tools/change_member_role.ts    CREATE
packages/ai/src/capabilities/registry.ts                                  MODIFY (+import +entry)
packages/ai/src/capabilities/types.ts                                     MODIFY (+7 union entries)
supabase/migrations/20260616120000_seed_channel_admin_authority.sql       CREATE
docs/plans/PLAN-channel-admin-capability-registration.md                  CREATE
docs/journeys/JOURNEY-channel-admin-capability-registration-*.md (×2)     CREATE
```

## Commits

```
98505fe8d  docs(channel-admin): plan + 2 journeys
dfcfac0e1  feat(channel-admin): T1 — capability + 6 skeleton tools + registry wire
83c46da3e  feat(channel-admin): T2 — seed engine_authority_config for 6 tools
```

## Review History

- **T3 code-reviewer:** CLEAN — zero high-confidence issues. Skeleton patterns consistent, schemas realistic, emitPrefix unique, types.ts entries match tool constants, seed CROSS JOIN form correct, all NOT NULL columns populated.
- **T3 system-steward:** APPROVE — all 6 tools match ADR-0336 design table (per-tool authority + min_role + channel). Namespace boundary preserved per ADR-0240. ADR-0339 invite path stays open. Seed idempotent. ts valid. 1 advisory (not blocking): amend ADR-0336 prose post-merge.

## Next Steps

After merge to development:

1. **Optional post-merge cleanup:** small commit amending ADR-0336 prose (§49-50 + §107) to match implemented admin-floor — prevents future plan drift.
2. **Start `campaign/chat-admin`:** long-lived campaign for the 6 tool-body sub-sorties + ADR-0339 invite path decision.
3. **First sub-sortie recommendation:** `mute_channel` body — simplest (self-act, autonomous, no PII, no role check) — proves the tool-body pattern before tackling invite (which forces ADR-0339 decision).

## Related Documents

- Plan: `docs/plans/PLAN-channel-admin-capability-registration.md`
- ADRs: `docs/decisions/0336-channel-admin-capability-split.md` (accepted), `docs/decisions/0339-invite-as-mission-conditional.md` (proposed, awaits invite body sortie)
- 2 journeys: `docs/journeys/JOURNEY-channel-admin-capability-registration-{trust-gate-d,seed-applies}.md`
- Predecessor sortie: ADR-0336 acceptance commit `b2060888e` (design-only flip)
