---
title: HarnessAdapter MVP — Handoff
status: complete
verified: true
updated: 2026-05-14
created: 2026-05-14
feature: harness-adapter-mvp
module: harness
tags: [handoff, harness, adr-0327, dead-pipe-fix]
---

# HANDOFF — harness-adapter-mvp

## Summary

This sortie delivered **HarnessAdapter Phase 1 (interface) + Phase 2 (registry sources + authority)** per ADR-0327. The trigger was a council finding (2026-05-14) that the page-polish wave's Phase 7 (`useRegisterTools`) and Phase 8 (`site-map.json`) artifacts were runtime-unconsumed — roughly 75 page-scope tools registered client-side but invisible to every LLM consumer due to three independent broken pipes in the BFF stack.

The adapter lives at `packages/ai/src/harness/` and exposes a single `HarnessAdapter` interface. Any LLM consumer (chat, voice, future Slack/email/API agents) calls `adapter.getToolsForChannel(channel, route, ctx)` and receives a `ToolBundle` with authority already enforced (ADR-0078 PII stripping, ADR-0244 financial-mutation blocking, ADR-0151 workspace_id server-derivation). The `getSiteMap()` method turns the previously dead `apps/web/.botsson/site-map.json` artifact into a live callable. `subscribeToRouteChange()` is a no-op stub for Phase 4 voice hot-swap wiring.

**What is NOT wired in this sortie:** no LLM consumer calls the adapter yet. The chat BFF (`/api/botsson/chat`), stage-engine (`/agent/chat` schema), and the LiveKit voice-agent (`LiveKitVoiceSession.registerTool`) are explicitly deferred to Phase 3 and Phase 4 sorties. The 42 `DEAD-PIPE-2026-05-14` markers on the `_tools/use-*-tools.ts` files remain until Phase 3 closes the chat pipe. The adapter is a fully-functional library in the correct package location, verified by 40 passing tests, but not yet called in production paths.

---

## Decisions

All of the following are registered or referenced in `docs/decisions/0000-decision-log.md` under ADR-0327.

- **ADR-0327 body completed + status flipped `proposed` → `accepted`** (commit `4141d1b4b`). Alternatives A (per-consumer integration) and B (server-side capability-only adapter) were formally documented and rejected. Alternative C (unified HarnessAdapter) chosen for closing the council's primary finding without creating N independent repair tracks.

- **`ClientToolDefinition` types re-declared locally in `harness/types.ts`** (commit `3e27b8fa5`). `@smartout/agent-sdk` and `@smartout/ai` are in a circular dependency cycle (agent-sdk imports `@smartout/ai/missions`). Re-declaring structurally-compatible types in `harness/types.ts` with an explicit compatibility comment avoids the cycle. Phase 3 consumer wiring will assert structural compatibility at the boundary in `__tests__/types.test.ts`.

- **Channel filtering for PII deferred from `CapabilitiesSource` to `AuthorityEnforcer` layer**. This was an explicit design decision documented in `capabilities-source.ts` top-of-file comment. The source returns the full eligible set for a given role; authority applies ADR-0078/0244 rules after. This keeps source responsibilities narrow (who can use a tool) and authority responsibilities narrow (what surface can a tool appear on).

- **`AuthorityRuleName` is a closed string union** (`types.ts:126-132`) rather than an open `string`. This allows grep-based audit of all enforcement sites — adding a new rule requires touching the type definition, making the change visible in PR diffs.

- **`subscribeToRouteChange` is a no-op stub returning a no-op unsubscribe**. Phase 4 will wire this via LiveKit data channel (the view-tools mirror pattern from ADR-0234 / L-0234 is the most natural precedent, per council recommendation). The stub satisfies the interface contract without committing to a transport.

- **3 test suites use stubs + inline fixtures, not real registry/site-map.json**. `createSiteMapSource` accepts parsed JSON directly (not a filesystem path) to remove cwd ambiguity between test runners, Next.js server actions, and CLI scripts. `createCapabilitiesSource` accepts a `minRoleConfig` map so role filtering is testable without mocking the registry. Deterministic, no Supabase required.

---

## Learnings

- **L-NNNN candidate — Worktree-fresh `node_modules` requires sibling build chain before `@smartout/ai` typecheck succeeds.** A fresh worktree has no `dist/` for `@smartout/telemetry`, `@smartout/types`, `@smartout/journey-ir`, `@smartout/agent-sdk`, `@smartout/utils`, `@smartout/payroll-export`. Order: `pnpm install` → build each package in dependency order → `pnpm --filter @smartout/ai typecheck`. Skipping any build step in the chain produces TS2307 `Module not found` on subpath imports. Same class as L-0190 (stale telemetry dist blocks typecheck) and the `stage-engine subpath imports require @smartout/ai dist` entry in MEMORY.md.

- **L-NNNN candidate — `@smartout/agent-sdk` ↔ `@smartout/ai/missions` circular dependency forces type re-declaration in any new sibling package needing tool types.** The cycle is load-bearing and pre-existing. The workaround pattern (re-declare the types locally with a structural-compat comment + note pointing at the canonical source) is now established in `harness/types.ts`. If agent-sdk's `ClientToolDefinition` diverges from the re-declaration, the divergence will surface at Phase 3 consumer wiring in `__tests__/types.test.ts`. The pattern should be promoted to the project CLAUDE.md under "Known circular deps" if it recurs in a third package.

- **`CapabilitiesSource` role-filtering design:** The `minRoleConfig` injection pattern (optional factory argument, empty map = full access by default) was chosen over modifying `CapabilityDefinition` with a `minRole` field. This avoids touching 40+ existing capability definitions and keeps the harness non-invasive toward the existing capability registry. Phase 3 consumer can inject a concrete `minRoleConfig` based on workspace `engine_authority_config` rows.

---

## Known issues / debt

- **Phase 3 (chat consumer wiring) NOT done.** `/api/botsson/chat/route.ts:38-59` `RequestSchema` still has no `client_tools` field. `services/stage-engine/src/routes/agent/chat.ts` schema unchanged. The `selected_tools` serialization already exists in `packages/agent-sdk/src/context/session-context.ts:28-29` — only the receiving end is missing.

- **Phase 4 (voice consumer wiring) NOT done.** `LiveKitVoiceSession.registerTool` at `packages/agent-sdk/src/providers/livekit.ts:38-40` still a stub (returns early with log message). Voice-agent `services/voice-agent/src/agent.ts:200` still calls `buildAllBotssonTools()` statically.

- **`DEAD-PIPE-2026-05-14` markers on 42 `_tools/use-*-tools.ts` files NOT removed.** Markers stay until Phase 3 smoke-test confirms tools reach the LLM. Removing them early would misrepresent the production state.

- **`AuthorityEnforcer` PII deny-list is hardcoded** (`authority.ts:32-38`). Five exact tool names + one regex pattern cover the council's identified examples. A systematic tag-audit of all 42 `_tools/` files for `pii_tier: restricted` and `risk_tier: financial` is Phase 5 scope. Until then, authority enforcement is conservative (catches known PII names + pattern-matched futures) but not exhaustive.

- **`CapabilitiesSource` implementations wrap `execute` without `AgentToolContext`** (`capabilities-source.ts`). Callers that need context must supply it via closure before passing to the harness. This matches the Phase 3 wiring plan where chat + voice consumers close over their context, but it means MVP-era implementations return stub "requires agent context" strings for context-dependent tools. This is intentional and documented in the source file header.

- **`gateActionMisses` array in `AuthorityConfig` is always empty** at Phase 2. `CapabilitiesSource` does not yet query `engine_authority_config` `gate_action` columns. Phase 3 consumer wiring is the natural point to inject the authority config and populate this field.

---

## Next steps

- **Phase 3 sortie — chat consumer wiring.** Files: `apps/web/src/app/api/botsson/chat/route.ts`, `services/stage-engine/src/routes/agent/chat.ts`. Entry: add `client_tools?: ClientToolDefinition[]` to `RequestSchema` in both. Merge adapter output with `toVercelTools` chain in `generateText` call. Gate behind `HARNESS_ADAPTER_CHAT=true` env flag (default false) for safe rollout. Remove `DEAD-PIPE-2026-05-14` markers after smoke-test confirms tools reach LLM. Dependencies: Phase 2 adapter (done).

- **Phase 4 sortie — voice consumer wiring.** Fill `LiveKitVoiceSession.registerTool` stub at `packages/agent-sdk/src/providers/livekit.ts:38-40`. Replace `buildAllBotssonTools()` call at `services/voice-agent/src/agent.ts:200` with `adapter.getToolsForChannel("voice", route, ctx)`. Spike on LiveKit tool-delivery transport before implementation (data channel vs RPC — see ADR-0327 Open Questions Q1). Dependencies: Phase 2 adapter (done). Phase 3 recommended first (validate adapter with simpler consumer before tackling LiveKit).

- **Phase 5 sortie — capability tagging.** Full tag-audit of 42 `_tools/` files. Add `pii_tier: "restricted"` and `risk_tier: "financial"` metadata to applicable tool definitions. Replace `authority.ts` hardcoded deny-list with metadata-driven filter. Dependencies: Phase 3 chat consumer live in production (so authority is exercised observably).

---

## Commits this sortie

All commits on `feat/harness-adapter-mvp` since base `e3b65e758`:

| SHA | Summary |
|---|---|
| `82c77fe73` | docs(harness-adapter-mvp): plan + journey stubs for sortie |
| `1ad55ea39` | docs(harness-adapter-mvp): wire close-feature plan pointer to canonical plan |
| `3e27b8fa5` | chore(harness-adapter-mvp): prep — interface stubs + state files + dep graph |
| `710f4aa95` | feat(harness): site-map-source (Phase 2) — reads apps/web/.botsson/site-map.json |
| `a3adf695` | feat(harness): authority enforcement (Phase 2) — ADR-0078/0151/0244 server-side |
| `4141d1b4b` | docs(adr): ADR-0327 body complete — accepted |
| `3a71e1a61` | feat(harness): capabilities-source (Phase 2) — reads existing capability registry |
| `1cce96dbc` | feat(harness): factory + integration tests (Phase 2 close) |

---

## Test results at close

- `pnpm --filter @smartout/ai test src/harness/__tests__/factory.test.ts`: **6/6 pass**
- `pnpm --filter @smartout/ai test src/harness/__tests__/site-map-source.test.ts`: **16/16 pass**
- `pnpm --filter @smartout/ai test src/harness/__tests__/authority.test.ts`: **10/10 pass**
- `pnpm --filter @smartout/ai test src/harness/` (combined, all 4 suites): **40/40 pass**
- `pnpm --filter @smartout/ai typecheck`: exit 0 (verified by implementing agent)
- `pnpm turbo typecheck` (repo-wide): to be confirmed by close-feature gate

---

## Closure readiness

- [x] ADR-0327 accepted (commit `4141d1b4b`)
- [x] All 8 plan tasks complete (Phase 1 + Phase 2 fully implemented)
- [x] 3 journeys verified (40/40 tests, all protocols pass 2026-05-14)
- [x] HANDOFF written (this document)
- [ ] `close-feature.sh` — handled by lead orchestrator
