---
title: "Journey — Season Agent Capability (5 tools, chat intent)"
status: done
updated: 2026-04-23
created: 2026-04-23
module: year-wheel
tags: [journey, season, agent, capability, chat, m3]
feature: campaign/year-wheel M3 — season agent capability
---

# Journey — Season Agent Capability

> **Feature:** campaign/year-wheel Milestone M3 · **ADR:** ADR-0201
> **Commits:** 699b1c95 (ADR) · 0b067401 (seed) · 0ac7e14f (capability + migrate) · c42f9576 (cleanup)

## Journey: Admin asks Emma via chat to create a season

**Precondition:** User is `admin`. Chat session is active on `/dashboard/year-wheel`. No authority override pending.

1. Admin types: "Lag en sommersesong fra 1. juni til 31. august" in Emma chat.
2. Agent router calls intent classifier → returns `{capability: "season", confidence: 0.85}` — new `"season"` enum member + disambiguation rule routes it correctly.
3. Tool-selector loads `seasonCapability`, selects `season.create` tool based on user intent verb ("lag").
4. Tool `execute()` runs: `callGateAction({capability: "season.create", channel: "chat", actionType: "create"})` → gate allows (admin role, `suggest` level seeded).
5. Tool INSERTs `season` row (status='draft', name='sommersesong', start/end dates) + `season_budget` row + 7 `day_factor` rows + 24 `hour_factor` rows. All filtered by `workspace_id` (RLS bypass via supabaseAdmin safe).
6. Tool returns JSON: `"Season created"` + metadata lines. Emma renders in chat.

**Postcondition:** Draft season exists in DB. Admin can set revenue next turn or navigate to `/dashboard/season/[id]` for UI editing.

## Journey: Admin asks for workforce readiness (read-only, voice-safe)

**Precondition:** Admin, any channel (chat OR voice). Workspace has existing season + protocols.

1. Admin speaks/types "Hva er beredskapen?"
2. Intent classifier → `{capability: "season", confidence: 0.82}`.
3. Tool-selector picks `season.get_readiness`.
4. Tool `execute()`: NO `gateAction` (read-only per Invariant 13 scope). Runs 3 SELECT COUNT queries filtered by workspace_id.
5. Returns multiline string: protocol counts + % complete per employee bucket.
6. Emma renders or reads aloud.

**Postcondition:** No state change. Read telemetry (if any) emits via normal path.

## Journey: Employee tries to create a season (authority denied)

**Precondition:** User has role `employee`, below `admin` floor seeded for `season.create`.

1. Employee types "lag en vintersesong".
2. Intent → `season.create`.
3. Tool `execute()` → `callGateAction` → gate returns `{allow: false, reason: "min_role_not_met"}`.
4. Tool returns `{ok: false, error: "gate_denied"}`.
5. Emma renders denial message.

**Postcondition:** No writes. `engine_event` has gate_denial audit row.

## Journey: Admin tries to create a season by voice (channel not allowed)

**Precondition:** Admin, voice channel. Session has `channel: 'voice'`.

1. Admin speaks "lag en høstsesong".
2. Intent classifier → `season.create`.
3. Tool `execute()` → `callGateAction({capability: "season.create", channel: "voice"})`.
4. `engine_authority_config` row for `season.create` doesn't declare voice channel. Gate returns `channel_allowed: false` OR tool body short-circuits on `ctx.channel === "voice"`.
5. Tool returns `{ok: false, error: "channel_not_allowed"}` or similar.
6. Emma responds: "Sesongopprettelse krever chat-kanal."

**Postcondition:** No writes. Admin switches to chat, retries.

## Journey: Agent calls `season.activate` (orphan authority row, safe)

**Precondition:** Agent router receives "aktiver sommersesongen" somehow routed to `season.*`.

1. Intent classifier → `{capability: "season", confidence: 0.75}`.
2. Tool-selector fetches `seasonCapability.tools` → 5 tools: create, set_revenue, save_playbook, get_readiness, learn_factors. NO `season.activate` tool.
3. Tool-selector does not find a match for "activate" verb. Falls back to general response or suggests UI action.
4. Agent responds: "Aktivering må gjøres fra sesongsiden — åpne /dashboard/season/[id] og klikk Aktiver."

**Postcondition:** No state change. `season.activate` authority row exists (seeded by ADR-0200) but no capability tool routes to it. Low-risk orphan per ADR-0201 Q-D.

## Telemetry (emitPrefix reserved, no events in M3)

M3 sets `emitPrefix: "season"` on the capability. No tool emits events in M3 — domain events (`season activated`, `season operating_hours_generated`, etc. from ADR-0200) continue to be emitted by Server Action / trigger paths. Future M4 may register per-tool events like `season created` or `season playbook_saved` under the reserved prefix.

## Out-of-scope (deferred)

- **Voice bridges for mutation tools.** Season creation is multi-turn — voice wizard UX is M5 scope.
- **Voice bridges for read tools** (`get_readiness`, `learn_factors`). Single-shot queries; candidate for a thin bridge in an M4 sub-sortie.
- **Page-local tool kits** (schedule-voice-tools-bridge equivalent). Year-wheel / season pages get zero voice registration in M3.
- **`season.activate` as agent capability** — remains Server-Action-only.
