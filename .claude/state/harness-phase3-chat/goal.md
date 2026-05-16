---
goal_id: harness-phase3-chat
status: pending_user_confirm
created: 2026-05-14
worktree: /home/sxtnl/dev/smartout.ai-wt-1
branch: feat/harness-phase3-chat
base: development
predecessor_adr: ADR-0327 (Phase 1+2 shipped — harness-adapter-mvp sortie)
predecessor_handoff: docs/HANDOFF-harness-adapter-mvp.md
predecessor_council: 2026-05-14 (L-0264 dead-pipe finding)
---

# Goal — harness-phase3-chat

## Outcome (technical, source of truth)

Wire chat consumer to `HarnessAdapter` per ADR-0327 Phase 3. BFF `/api/botsson/chat` accepts `client_tools` field, forwards to stage-engine `/agent/chat`. Stage-engine resolves tools via HarnessAdapter (capabilities source + client-shipped tools merged + authority applied) instead of bare `toVercelTools`. `toVercelTools` becomes the fallback path (kept, not removed). Feature flag `HARNESS_ADAPTER_CHAT` gates the new path. After verified live, remove DEAD-PIPE-2026-05-14 markers from 42 `_tools/use-*-tools.ts` files.

## Acceptance criteria (binary, testable)

1. `apps/web/src/app/api/botsson/chat/route.ts` RequestSchema accepts `client_tools` field (Zod-validated). When present, BFF forwards to stage-engine in request body.
2. `services/stage-engine/src/routes/agent/chat.ts` request schema accepts `client_tools` field (Zod-validated). When `HARNESS_ADAPTER_CHAT=true`, stage-engine uses HarnessAdapter pipeline. Otherwise, falls back to existing `toVercelTools` chain.
3. New module `services/stage-engine/src/core/chat-tool-resolver.ts` (or similar) composes HarnessAdapter from CapabilitiesSource + SiteMapSource + AuthorityEnforcer, calls `getToolsForChannel("chat", pageRoute, userContext)`, returns merged definitions + implementations for Vercel AI SDK.
4. Merge logic: capability tools from CapabilitiesSource + client tools from request body's `client_tools` field. Naming collisions resolved by client-tool-wins (page-specific overrides capability) — record in authority audit.
5. Integration test: stage-engine `/agent/chat` request with `client_tools: [...]` populated returns response where LLM had access to BOTH capability tools AND the shipped client tools. Use mocked LLM that asserts tool list.
6. BFF integration test: POST `/api/botsson/chat` with body including `client_tools` forwards to stage-engine with field intact.
7. End-to-end smoke test (manual or scripted): from `apps/web/src/app/dashboard/hms/deviations/` page, send a chat message asking for deviations count → response uses `listOpenDeviations` (one of the shipped client tools, currently dead-pipe).
8. After all tests green, remove `DEAD-PIPE-2026-05-14` marker line + adjacent blank line from all 42 `apps/web/src/app/dashboard/**/_tools/use-*-tools.ts` files.
9. ADR-0327 Phase 3 status section updated: phase 3 marked `shipped` (or equivalent) with commit SHA.
10. Repo-wide `pnpm turbo typecheck` passes.
11. JOURNEY-harness-phase3-chat.md has `verified: true`.
12. HANDOFF written.

## Out of scope (explicitly deferred)

- **Phase 4** — voice consumer wiring (LiveKit `registerTool` stub fill). Separate sortie.
- **Removing `toVercelTools`** entirely. Stays as fallback (per ADR Migration Path).
- **Capability tagging** (`risk_tier` metadata on tool definitions). Authority enforcer still uses hardcoded deny-list — separate sortie when tagging shipped.
- **Hot-swap on route change.** Chat doesn't need it (each request fresh-resolves route from `pageRoute` body param). Voice (Phase 4) needs it.
- **Slack/email/API consumers.** Phase 6.
- **`subscribeToRouteChange` implementation** in adapter. MVP stub returns no-op `Unsubscribe`.
- **Refactoring existing capability registry shape.** Adapter consumes existing registry as-is.

## Affected missions

- **botsson-chat-mission** — primary consumer; this sortie wires it
- **botsson-voice-mission** — downstream; Phase 4 uses same pattern
- **query_smartout capability** — downstream; eventually uses adapter's getSiteMap

## Contracts modified

- BFF `/api/botsson/chat` RequestSchema: add optional `client_tools` field (array of ClientToolDefinition)
- Stage-engine `/agent/chat` request schema: add optional `client_tools` field (same shape)
- HarnessAdapter contract unchanged (Phase 1/2 surface stays stable)
- Feature flag `HARNESS_ADAPTER_CHAT` (env var; defaults to `false` until Phase 3 verified in production)

## Risks

- **R1: Tool-name collision between client-shipped and capability.** Resolved at adapter-merge level; client-tool-wins documented in authority audit. Mitigation: enumerate collision count during verification; if >5 unexpected collisions, council.
- **R2: Token budget blowout** if BFF forwards full client tool definitions on every request. Mitigation: BFF transmits only `selected_tools` from current page scope (already correct shape via existing `useAgent` serialization). Verify request-size doesn't double.
- **R3: Stage-engine cold-start latency** if HarnessAdapter construction is per-request. Mitigation: cache adapter instance per workspace_id; lazy-init on first request, reuse for session lifetime.
- **R4: Authority bypass via client-tools** — malicious client could ship "fake" tool definitions claiming PII access. Mitigation: authority layer strips by tool NAME, not just by source. Client-shipped tools also pass through ADR-0078/0244 filters. Document in authority.ts.
- **R5: Existing chat consumers break** during cutover. Mitigation: feature flag default OFF; flip to ON only after live verification. Fallback path stays.
- **R6: DEAD-PIPE marker removal** done before live verification = false-clean state. Mitigation: marker removal is the LAST commit, gated on smoke test passing.

## Plain-language version (4 sentences, ELI10)

Last sortie built the phone-book (HarnessAdapter). This sortie plugs the chat-Botsson INTO the phone-book so it can finally see the 75 page-specific tools that have been registered-but-invisible all along. We add a small feature-flag switch so we can flip the new pipe on without breaking the existing chat helpers, and we keep the old code as a safety fallback. We'll know it works when a chat from the HMS-deviations page actually uses the deviations-listing tool instead of guessing.

## Status

`pending_user_confirm` — awaiting Pontus's explicit "go" before proceeding to Wave 1 dispatch.
