---
title: "Announcements Domain — Entry"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: announcements
tags: [announcements, nyheter, channel_message, publish, broadcast, wave-a, wave-b]
mirror: verified
last_verified: 2026-05-23
---

# Announcements Domain

> Entry point and agent rules. If code contradicts this folder → **CODE wins**, update these docs.
>
> Supersedes: `docs/modules/announcments/` (archived 2026-05-23, typo folder retained for history).

## Build state

- **Wave A (engagement):** shipped. Audience picker + pin/unpin + PinnedStrip + notification priority branching all live.
- **Wave B v1:** REJECTED by council 2026-05-18 (6 blockers + 7 must-fixes).
- **Wave B v2 (`kind`/`tier`/`entity_link`):** spec `status: accepted` (`council_verdict: APPROVED-PENDING-CODE`). **Migrations 140100–141700 applied** — `announcement_meta` table, `publish_announcement_atomic` RPC, `fn_publish_announcement_notifications`, trigger guard, `get_channel_messages` extended, celebration branch. **UI pickers (AnnouncementKindPicker, AnnouncementTierPicker, EntityLinkPicker) deferred** (spec Track E).

## Reading order

| # | File | Purpose |
|---|---|---|
| 1 | `OVERVIEW.md` | What + why; cascade placement; surface identity |
| 2 | `DATA-MODEL.md` | Tables, enums, RLS, migrations, telemetry |
| 3 | `ARCHITECTURE.md` | L1–L5 code map with file:line anchors |
| 4 | `USER-FLOWS.md` | Journey index linked to `docs/journeys/` |
| 5 | `ROADMAP.md` | Forward plan; ADR + spec + handoff references |
| 6 | `GAPS-AND-DEBT.md` | Built-vs-planned delta; overlap edges; Wave B gaps |
| 7 | `E2E-COVERAGE.md` | Playwright + DB spec coverage matrix |

## Agent Guardrails

**Read before touching any announcement code.**

1. **Never INSERT `channel_message` with `message_type='announcement'` directly.** The only authorized write path is `publish_announcement_atomic` SECURITY DEFINER RPC (ADR-0369). Migration `20260620140500_channel_message_trigger_announcement_guard.sql` guards the trigger path.

2. **Never call `fn_publish_announcement_notifications` directly from application code.** It is invoked by `publish_announcement_atomic` RPC body only (ADR-0369 Option B). Direct call bypasses the atomicity contract (sidecar `announcement_meta` must exist at fan-out time).

3. **Capability key is `communication`, not `broadcast.send`.** Agent path: `callGateAction(..., { capability: 'communication', actionType: 'publish_announcement_atomic' })` at `packages/ai/src/capabilities/communication/publish-announcement.ts` (ADR-0370 Option B). Day-Control server action uses `broadcast.send` — that's a different gate at a different layer.

4. **Tool API contract: `{title, body}` not `{content}`.** The capability tool schema at `publish-announcement.ts` preserves `title: string(1-120)` + `body: string(1-1600)` (ADR-0371 Option A). The RPC receives `p_content` (pre-concatenated by the tool). **Never collapse to `{content}` without an explicit ADR + consumer survey.**

5. **Wave B v1 rejection learnings are live debt:**
   - L-0312: `SET CONSTRAINTS ALL DEFERRED` does not defer plain `AFTER INSERT` triggers.
   - L-0313: grep for `ALTER TYPE ... ADD VALUE` when checking enum presence, not just `CREATE TYPE`.
   - L-0314: Capability key in spec pseudocode ≠ capability key in production body — verify code, not spec.
   - L-0315: `callGateAction` signature is positional, not callback — match exactly.

6. **`announcement_kind = 'celebration'` branch:** service-role only. JWT-authenticated callers receive `CELEBRATION_SERVICE_ROLE_ONLY` error. Agents cannot initiate celebrations (ADR-0372).

7. **Mobile is read-only** for announcements per ADR-0133. No composer, no pin, no delete on mobile. `TierBadge` and `EntityLinkCTA` components exist at `apps/mobile/src/components/news/`; mount is read-side only.

8. **Cross-module boundary:** `channel_message` table is owned by **communication** domain. Any schema change to `channel_message` columns requires coordination with the communication domain owner. Announcements own `announcement_meta` sidecar only.
