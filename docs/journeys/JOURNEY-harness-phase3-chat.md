---
title: HarnessAdapter Phase 3 — Chat Consumer Wiring — User Journeys
status: verified
verified: true
updated: 2026-05-14
created: 2026-05-14
feature: harness-phase3-chat
module: harness
tags: [journey, harness, botsson, adr-0327, phase3, chat]
---

# JOURNEY-harness-phase3-chat

> ADR: `docs/decisions/0327-harness-adapter-unified-llm-consumer.md`
> Goal: `.claude/state/harness-phase3-chat/goal.md`
> Predecessor: `docs/journeys/JOURNEY-harness-adapter-mvp.md`

Phase 3 wires the chat consumer to the HarnessAdapter built in Phase 1+2. The BFF `/api/botsson/chat` now accepts and forwards `client_tools`; stage-engine `/agent/chat` gates HarnessAdapter behind `HARNESS_ADAPTER_CHAT`; the chat-tool-resolver composes the adapter (capabilities + client tools merged + authority applied). 42 DEAD-PIPE markers removed after smoke-test.

The "users" in these journeys are SERVER-SIDE consumers and integration test harnesses. End-user flows (manager asking for deviations, employee checking schedule) are covered by the acceptance criteria smoke test (AC7) and are verified manually.

---

## Journey 1: BFF accepts client_tools and forwards to stage-engine

**Role:** Browser (BotssonProvider) POSTs to `/api/botsson/chat` with body including `client_tools` array.
**Surface:** `apps/web/src/app/api/botsson/chat/route.ts`
**Phase:** 3

**Precondition:**
- BotssonProvider.botssonTools aggregates page-scope tools via `useRegisterTools` (existing Phase 7 client registry)
- Browser serializes tool definitions into `client_tools: ClientToolDefinition[]`
- BFF route handler is deployed with updated `RequestSchema`

**Steps:**

1. Browser POSTs `/api/botsson/chat` with body `{ message, page_route, client_tools: [...] }`.
2. BFF `RequestSchema` (Zod) validates `client_tools` field — optional array of `ClientToolDefinition` shape.
3. Malformed `client_tools` items → 400 response with Zod validation error detail.
4. BFF constructs forwarding payload, includes `client_tools` field intact.
5. BFF POSTs to stage-engine `/agent/chat` with full body including `client_tools`.
6. Stage-engine receives `client_tools` array; proceeds to resolver pipeline (Journey 2).

**Postcondition:**
- Stage-engine receives `client_tools` array with client-side tool definitions.
- Resolver pipeline can merge them with capability tools.

**Error paths:**

| Condition | Behavior |
|---|---|
| `client_tools` field absent | Forwarded as `undefined`; resolver treats as empty array |
| `client_tools` is empty array | Forwarded as `[]`; resolver proceeds capability-only |
| Malformed `client_tools` item (missing `name` field) | BFF returns 400 with Zod error detail |
| `client_tools` present but stage-engine unreachable | BFF returns 502; client shows generic error |

**Verification protocol:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter web test apps/web/src/app/api/botsson/chat/__tests__/route.test.ts
```

**Verified:** 2026-05-14 — 5/5 tests pass. BFF forwards `client_tools` intact; empty array forwarded correctly; malformed item returns 400; `RequestSchema` Zod-validates shape.

---

## Journey 2: Stage-engine resolves tool bundle via HarnessAdapter

**Role:** Stage-engine `/agent/chat` handler.
**Surface:** `services/stage-engine/src/routes/agent/chat.ts` + `services/stage-engine/src/core/chat-tool-resolver.ts`
**Phase:** 3

**Precondition:**
- `HARNESS_ADAPTER_CHAT=true` environment variable set
- Request body includes `page_route` (required by resolver) and optional `client_tools`
- `packages/ai/src/harness/` exists (Phase 1+2 adapter)
- `apps/web/.botsson/site-map.json` exists (Phase 8 page-polish artifact)

**Steps:**

1. Stage-engine validates request body; derives `userContext` from JWT auth (`workspace_id` server-derived per ADR-0151 — NOT taken from request body).
2. Route handler calls `harnessAdapterChatEnabled()` → returns `true`.
3. Route handler calls `resolveChatTools({ pageRoute, userContext, clientTools })`.
4. Resolver constructs HarnessAdapter (or retrieves from workspace-keyed cache — R3 mitigation).
5. Resolver calls `adapter.getToolsForChannel("chat", pageRoute, userContext)` → capability `ToolBundle`.
6. Resolver merges `clientTools` into bundle: client-tool-wins on name collision (capability tool with same `modelToolName` is replaced; collision recorded in `clientToolCollisions`).
7. Resolver calls authority re-application on merged bundle (R4 mitigation — client-shipped tools also pass through ADR-0078/0244 filters).
8. Returns `{ bundle, viaHarnessAdapter: true, clientToolCollisions }`.
9. Route handler passes bundle definitions + implementations to `generateText` call.

**Postcondition:**
- LLM receives merged tool list: capability tools + client-shipped tools (minus authority-stripped).
- `viaHarnessAdapter: true` logged for observability.
- `clientToolCollisions` array captures any name collisions for audit.

**Error paths:**

| Condition | Behavior |
|---|---|
| `HARNESS_ADAPTER_CHAT=false` (or unset) | Route falls back to existing `toVercelTools` chain; no resolver called |
| `ResolverNotImplementedError` thrown | Route catches, falls back to `toVercelTools`, logs warning |
| Generic resolver `Error` | Route catches, falls back to `toVercelTools`, logs error |
| Both fallback paths return 200 | Graceful degradation — existing chat still works |
| `pageRoute` absent in body | Resolver uses `null`; capability tools only (no page-scope filtering) |

**Verification protocol:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter @smartout/stage-engine test src/routes/agent/__tests__/chat-harness-pipeline.test.ts
pnpm --filter @smartout/stage-engine test src/core/__tests__/chat-tool-resolver.test.ts
```

**Verified:** 2026-05-14 — 6/6 route pipeline tests + 10/10 resolver tests pass. Feature-flag gate confirmed; fallback path confirmed; client-tool merge confirmed; `viaHarnessAdapter: true` in response; `clientToolCollisions` populated on collision.

---

## Journey 3: Authority re-application prevents client-tool PII bypass

**Role:** Malicious or accidental client shipping a tool with PII-tier name.
**Surface:** `services/stage-engine/src/core/chat-tool-resolver.ts` (authority re-application step)
**Phase:** 3

**Precondition:**
- `HARNESS_ADAPTER_CHAT=true`
- Client sends `client_tools` array that includes a tool named `revealPersonnummer` (PII deny-listed in `authority.ts` per ADR-0078)
- The tool would not normally appear in capability bundle for this user

**Steps:**

1. Browser ships `client_tools: [{ name: "revealPersonnummer", ... }]` in request body.
2. BFF forwards body to stage-engine (Journey 1 — BFF does NOT filter by tool name).
3. Resolver merges `client_tools` into bundle after capability resolution.
4. Resolver calls `authority.apply` on merged bundle (same authority instance, same rules).
5. `AuthorityEnforcer` applies ADR-0078 PII deny-list: `revealPersonnummer` matches deny-list entry.
6. Tool stripped from `bundle.definitions` AND `bundle.implementations`.
7. Strip recorded in `bundle.authority.blockedTools` with `AuthorityRuleName` value.
8. LLM never sees `revealPersonnummer` in tool list.

**Postcondition:**
- Bundle does NOT contain `revealPersonnummer` or any other PII-deny-listed tool regardless of source.
- `bundle.authority.blockedTools` contains the strip record (audit trail).
- `clientToolCollisions` also updated if a capability tool with same name existed.

**Error paths:**

| Condition | Behavior |
|---|---|
| Client ships tool that is NOT on deny-list | Merged successfully; LLM can use it |
| Client ships tool that collides with capability tool (non-PII) | Client-tool-wins; collision recorded |
| Client ships empty `client_tools: []` | Resolver proceeds; no collisions; capability-only bundle |

**Verification protocol:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter @smartout/stage-engine test src/core/__tests__/chat-tool-resolver.test.ts
# Must include: "Authority re-applied after client-tool merge"
```

**Verified:** 2026-05-14 — 1/1 case "Authority re-applied after client-tool merge" passes. PII-deny-listed client tool stripped; recorded in `authority.blockedTools`; implementation also removed from bundle.

---

## Closure gate

Before flipping `verified: true` and running `close-feature.sh`:

- [x] All 3 journeys match production code paths
- [x] All verification protocols pass locally: BFF 5/5 + route pipeline 6/6 + resolver 10/10 = 21/21
- [x] ADR-0327 Phase 3 status updated (IN PROGRESS — operator flips to SHIPPED after live smoke)
- [x] DEAD-PIPE-2026-05-14 markers removed from 42 files (commit `5d8a89331`)
- [x] HANDOFF-harness-phase3-chat.md written
- [x] Repo-wide `pnpm turbo typecheck` passes (52/52 packages)
- [ ] Operator action post-merge: flip `HARNESS_ADAPTER_CHAT=true` in production env (via deploy-conductor) to activate new path

**Deferred to Phase 4 sortie (explicitly NOT in scope here):**
- Voice consumer wiring (`LiveKitVoiceSession.registerTool` stub fill)
- Client tool invocation routing back through BFF for browser-side execution (client tools currently appear in LLM tool list but invocation returns placeholder string)
- Capability tagging (`risk_tier` metadata) replacing hardcoded deny-list
