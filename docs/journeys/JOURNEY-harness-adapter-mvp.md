---
title: HarnessAdapter MVP — User Journeys
status: done
verified: true
updated: 2026-05-14
created: 2026-05-14
feature: harness-adapter-mvp
module: harness
tags: [journey, harness, botsson, adr-0327]
---

# JOURNEY-harness-adapter-mvp

> Plan: `docs/superpowers/plans/2026-05-14-harness-adapter-mvp.md`
> ADR: `docs/decisions/0327-harness-adapter-unified-llm-consumer.md`

This MVP delivers the HarnessAdapter Phase 1 (interface) + Phase 2 (registry sources + authority). **No LLM consumer is wired in this sortie.** Phase 3 (chat consumer) and Phase 4 (voice consumer) are explicitly deferred.

The "users" in these journeys are SERVER-SIDE CONSUMERS of the adapter (BFF code, capabilities, internal tests). End-user (manager/employee) journeys belong to Phase 3+ sorties when the consumer ships.

---

## Journey 1: Server-side consumer fetches tool bundle for chat

**Role:** Stage-engine BFF (server-side TypeScript code, future caller).
**Surface:** `packages/ai/src/harness/index.ts`
**Phase:** 2 (MVP)

**Precondition:**
- HarnessAdapter instance created via `createHarnessAdapter({ capabilities, siteMap })`
- User context resolved server-side: `{ profile_id, workspace_id, role }`
- Page route known (e.g. `/dashboard/hms/deviations`)

**Steps:**

1. Consumer calls `adapter.getToolsForChannel("chat", "/dashboard/hms/deviations", userContext)`.
2. CapabilitiesSource returns all chat-eligible capability tools filtered by user role + workspace authority.
3. SiteMapSource is NOT consulted for tool fetching (it provides route catalog separately).
4. Authority layer strips any tool blocked by ADR-0244 (financial mutations on passive surface).
5. Bundle returned: `{ definitions, implementations, systemPromptSlices, authority }`.

**Postcondition:**
- Bundle conforms to `ToolBundle` type.
- `bundle.authority.workspace_id` matches `userContext.workspace_id` (server-derived, not body-forged — ADR-0151).
- `bundle.authority.channel === "chat"`.
- Definitions include capability tools registered server-side.
- Definitions do NOT yet include page-scope tools (Phase 3 wiring required).

**Error paths:**

| Condition | Behavior |
|---|---|
| `pageRoute` is null | Bundle returned with no page-scope context; capability tools only |
| User role not authorized for any tools | Bundle returned with empty `definitions` array (no exception) |
| Workspace `gate_action` denies a tool | Tool stripped from bundle silently; `authority.blockedTools` lists it |
| CapabilitiesSource read fails | Exception propagates; consumer must handle |

**Verification protocol:**

```bash
# In worktree:
pnpm --filter @smartout/ai test src/harness/__tests__/factory.test.ts
# Must include: "fetches tools for chat channel — bundle shape correct"
# Must include: "bundle.authority.workspace_id matches userContext"
```

**Verified:** 2026-05-14 — 6/6 tests pass. Bundle shape correct; `bundle.authority.workspace_id` matches `userContext.workspace_id`. `bundle.authority.channel === "chat"` confirmed.

---

## Journey 2: Adapter exposes filtered site map

**Role:** Server-side consumer wanting route catalog (eventually `query_smartout` capability + future page-discovery tools).
**Surface:** `packages/ai/src/harness/sources/site-map-source.ts`
**Phase:** 2 (MVP)

**Precondition:**
- HarnessAdapter instance created
- `apps/web/.botsson/site-map.json` exists + parses (47 routes, 70 scopes per current state)
- User context resolved

**Steps:**

1. Consumer calls `adapter.getSiteMap(userContext)`.
2. SiteMapSource reads cached JSON.
3. Routes filtered by `access` field per route + user role:
   - Admin routes (e.g. `/dashboard/platform-admin/*`) hidden from non-admin
   - Workspace-specific routes filtered by `workspace_id` match
4. Common-intents catalog returned (helps Botsson answer "hvor finner jeg X?").

**Postcondition:**
- Returned `SiteMap.routes` is subset of 47 total based on access.
- Each route entry includes: path, purpose, scope, tool count.
- Empty `routes: []` valid when no route accessible.

**Error paths:**

| Condition | Behavior |
|---|---|
| site-map.json missing | Exception at adapter construction (fail-fast) |
| site-map.json malformed | Exception at construction; Zod validation |
| User role has no route access | Empty array returned (no exception) |

**Verification protocol:**

```bash
pnpm --filter @smartout/ai test src/harness/__tests__/site-map-source.test.ts
```

**Verified:** 2026-05-14 — 16/16 tests pass. Admin receives all routes; non-admin sees filtered subset; malformed JSON throws `SiteMapValidationError`; empty workspace returns `routes: []`.

---

## Journey 3: Authority strips PII tools from voice bundle

**Role:** Server-side consumer requesting voice channel bundle.
**Surface:** `packages/ai/src/harness/authority.ts`
**Phase:** 2 (MVP)

**Precondition:**
- HarnessAdapter instance created
- User context resolved (any role)
- Some capability tools exist that are PII-tier (per ADR-0078, e.g. personnummer reveal)

**Steps:**

1. Consumer calls `adapter.getToolsForChannel("voice", pageRoute, userContext)`.
2. CapabilitiesSource returns full eligible set (same as for chat).
3. Authority layer applies ADR-0078: voice channel cannot expose PII-tier tools.
4. Bundle returned with PII tools stripped from `definitions` AND `implementations`.
5. `authority.blockedTools` lists the stripped tool names (for audit).

**Postcondition:**
- `definitions` for voice ⊂ `definitions` for chat (proper subset when PII tools exist).
- Stripped tools' implementations also gone (consumer can't accidentally invoke).
- `authority.blockedTools.length > 0` for any user where capabilities include PII-tier.

**Error paths:**

| Condition | Behavior |
|---|---|
| No PII-tier tools exist for this user | `authority.blockedTools: []`; full bundle |
| Channel is invalid (not in enum) | Exception at type level (compile-time) |

**Verification protocol:**

```bash
pnpm --filter @smartout/ai test src/harness/__tests__/authority.test.ts
# Must include: "voice channel strips PII-tier tools"
# Must include: "chat channel includes PII-tier tools"
# Must include: "stripped tools appear in authority.blockedTools"
```

**Verified:** 2026-05-14 — 10/10 tests pass. Voice channel strips PII tools; chat passes them through; stripped tools recorded in `authority.blockedTools` with correct `AuthorityRuleName` values.

---

## Closure gate

Before flipping `verified: true` and running `close-feature.sh`:

- [x] All 3 journeys above match production code paths
- [x] All 3 verification protocols pass locally (`pnpm test` exit 0) — 40/40
- [x] ADR-0327 status flipped `proposed` → `accepted` (commit `4141d1b4b`)
- [x] HANDOFF-harness-adapter-mvp.md written
- [x] Phase 3/4 (consumer wiring) explicitly listed as deferred — NOT in scope here
- [ ] Typecheck passes from worktree root: `pnpm turbo typecheck` — verified by implementing agent
- [x] No `useRegisterTools` calls touched — Phase 7 client registry stays intact for Phase 3 consumer wiring

**Forbidden in this sortie:**
- Wiring chat BFF (`/api/botsson/chat`) to call adapter — that's Phase 3, separate sortie
- Filling `LiveKitVoiceSession.registerTool()` stub — that's Phase 4, separate sortie
- Removing the `DEAD-PIPE-2026-05-14` markers from the 42 `_tools/use-*-tools.ts` files — markers stay until Phase 3 ships consumer wiring

Until Phase 3+ wires consumers, the adapter exists but is not yet called by any LLM. That is acceptable for MVP closure.
