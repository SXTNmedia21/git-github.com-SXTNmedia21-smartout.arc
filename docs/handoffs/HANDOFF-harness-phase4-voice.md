---
title: HarnessAdapter Phase 4 (Voice) — Handoff
status: complete
verified: true
updated: 2026-05-14
created: 2026-05-14
feature: harness-phase4-voice
module: harness
tags: [handoff, harness, adr-0327, phase4, voice, livekit, dead-pipe-closed]
---

# HANDOFF — harness-phase4-voice

## Summary

Phase 4 closes the voice-surface dead pipe introduced when HarnessAdapter (ADR-0327) shipped Phases 1–3. Phase 3.5 gave chat-Botsson the ability to invoke client-shipped page tools via HTTP roundtrip; voice-Botsson was left on the original static `buildAllBotssonTools()` path with a no-op `registerTool` stub. This sortie replaces that stub with a real implementation and wires a full bidirectional RPC protocol over the LiveKit data channel.

`LiveKitVoiceSession` (browser-side, `packages/agent-sdk/src/providers/livekit.ts`) now stores `name → impl` in an instance Map, publishes registered tool DEFINITIONS at session start via a new topic `botsson-tools-register` (reliable=true), and listens for `botsson-tool-call` packets to invoke the matching implementation and publish `botsson-tool-result` back. Voice-agent worker receives definitions in its existing `RoomEvent.DataReceived` handler, builds async `llm.tool()` stubs via `buildClientToolStub` (new `client-tool-rpc.ts`) — each stub's `execute` body does the RPC roundtrip inline (publish call, await result Promise, 10s timeout fallback) — and registers the merged set via `agent.updateTools()` (LiveKit Agents 1.3 API confirmed in Wave 0). `voice-tool-resolver.ts` mirrors the `chat-tool-resolver.ts` pattern: capability tools via HarnessAdapter + PII strip (ADR-0078) + audit logging. Three new topics wire the protocol with zero topic collision against existing `botsson-activity` (L-0234) and `botsson-context` (L-0233).

The 75 page-scope tools registered via `useRegisterTools` are now reachable from voice-Botsson once the operator flips `HARNESS_ADAPTER_VOICE=true` in the voice-agent production env.

---

## Decisions

All novel decisions below. Items already in ADR-0327 body are NOT re-registered here.

- **`agent.updateTools()` called post-construction (vs delay-boot tool injection).** Wave 0 confirmed the API exists at `@livekit/agents/dist/voice/agent.d.ts:103` — parallel to `agent.updateChatCtx()` already used in production. Cleaner than registering tools before `Agent` construction (which would require session-start sequencing and a blocking handshake before audio begins). Post-construction call issued on first `botsson-tools-register` receipt; no boot-timing fragility.

- **Async execute body does RPC inline (vs Agent-level pre-execution callback hook).** Wave 0 finding F: no pre-execution hook exists on `voice.Agent`. Only `FunctionToolsExecuted` event fires AFTER all tool calls complete. The execute body itself is the correct interception point. Pattern: `async execute(args) { publish RPC; await promise; return result }`. Tool body owns the full roundtrip; LLM blocks on the Promise until result arrives.

- **Three distinct topics with no-collision naming.** `botsson-tools-register`, `botsson-tool-call`, `botsson-tool-result` — none overlap with `botsson-activity` (L-0234 voice mirror tools) or `botsson-context` (L-0233 workforce snapshot). Topic namespace documented in `investigation-findings.md` for future reference.

- **10-second RPC timeout hardcoded.** Longer hangs the Realtime LLM turn; shorter risks slow networks or heavy tool implementations (e.g. DB queries). 10s matches the chat-side roundtrip heuristic. Timeout string sent to LLM: `"Tool execution timed out (10s)."` — LLM can acknowledge and continue. Configurable-per-tool-definition deferred.

- **Hot-swap via useEffect on `registeredTools.definitions` change — full replacement, not delta.** Re-publishes full definitions array on each route change. Voice-agent's `buildClientToolStub` loop is idempotent on repeated definitions — `agent.updateTools()` replaces the entire client-stub map. No diff/delta logic needed for MVP; full replace is simpler and avoids stale-stub edge cases.

- **`voice-tool-resolver.ts` is audit-logging only for MVP (active capability set stays `buildAllBotssonTools()`).** HarnessAdapter authority pass runs and records `blockedTools`, but the active tool set used for the voice bundle is still the static capability registry — same as Phase 3.5 deferral pattern. Capability-tagging sortie (Phase 5) activates the metadata-driven filter path. Decision: ship the resolver wiring now (authority + audit trail correct) but keep the active path unchanged until Phase 5 validates risk_tier metadata on all 75 tools.

- **LiveKit `Room` instance stored on `LiveKitVoiceSession` instance (vs module-scope ref).** Module-scope `_activeLkRoom` ref in `adapter-internal.ts` is the existing pattern for the voice-agent server side. Browser-side `LiveKitVoiceSession` uses an instance pattern — `room` passed to constructor (or acquired via `useVoiceSession` hook). Instance pattern is cleaner for browser context where multiple room lifecycles are possible; also avoids the module-scope singleton issue that caused `docker compose -f bypass override.yml` bugs in the past.

---

## Learnings

L-NNNN candidates (promote to `docs/learnings/0000-learning-log.md` at 3rd occurrence):

- **Investigation-first sortie pattern (Wave 0 read-only before Wave 1 parallel build) materially reduces retries in uncertain API territory.** Phase 4 had two genuine unknowns: whether `agent.updateTools()` existed (R1) and whether a pre-execution hook was available for tool-call interception (R2). 10 minutes of `.d.ts` reading in Wave 0 resolved both, confirmed the recommended implementation pattern, and let Wave 1 agents execute as single-shot successes. Contrast with earlier phase work where build agents hit API shape mismatches mid-implementation. First sortie where this was run deliberately as a named phase rather than ad-hoc. Estimate: saved 30–60 min of retry-and-fix cycles across 3 parallel agents. Candidate: promote to `smartout-agent-dev` skill as "Wave 0 investigation ritual before uncertain API territory".

- **Stale `@smartout/ai` dist blocks agent-sdk and stage-engine consumers mid-wave.** Fresh worktree boot does not automatically build dependency dist files. When Phase 3 prep added `./harness` subpath export to `@smartout/ai`, agents that consumed the subpath hit TS2307 during their own typecheck even after successfully implementing their target file. Pattern: before dispatching Wave 1 agents to any surface that imports `@smartout/ai` (or `@smartout/telemetry`, `@smartout/supabase`), run `pnpm --filter @smartout/ai build` (and sibling packages if changed). Third occurrence of stale-dist-blocks-wave pattern — already in MEMORY.md, reinforced here. Consider encoding as a pre-Wave-1 step in the agent-dev skill.

- **Fresh worktree boot ritual now established: `pnpm install` + build dep chain before Wave 1 dispatch.** Combined with the stale-dist learning above, the sequence `pnpm install && pnpm --filter @smartout/ai build && pnpm --filter @smartout/telemetry build` before dispatching parallel Wave 1 agents is now the default pattern for any worktree that hasn't had agents run in it yet. No-op-looking `pnpm install` output (nothing new) still populates `node_modules/@smartout/*` symlinks in the worktree. Second occurrence — first was `voice-agent TS2307 @smartout/ai/missions` memory entry.

---

## Known issues / debt

- **Hot-swap E2E test deferred.** Journey 5 (hot-swap on browser route change) verified via code-trace only. Runtime verification would require a Playwright test with a mocked LiveKit room or a real audio session — neither is practical in the current test infrastructure. Deferred; low risk because the pattern is identical to the existing `useEffect`-on-def-change + `publishData` in `BotssonOrbVoiceMount`.

- **`voice-tool-resolver.ts` is audit-logging only.** Active capability tool set for voice MVP is still `buildAllBotssonTools()`. Metadata-driven `risk_tier` filter (full HarnessAdapter authority for voice) requires Phase 5 capability-tagging sortie to complete. Until then, PII strip is enforced by hardcoded deny-list (inherited from Phase 1+2).

- **10s RPC timeout hardcoded.** Could be configurable per tool definition (e.g. a tool that fires a slow DB aggregate might warrant 20s). Deferred pending a real-world use case requiring a different limit. Low priority — current `_tools/use-*-tools.ts` implementations are fast queries.

- **Real LiveKit room integration test missing.** Unit tests use a mock `Room` object. No test exercises the full WebRTC data-channel path with a live LiveKit server. Integration test deferred; practical verification is the operator smoke test after `HARNESS_ADAPTER_VOICE=true` flip.

- **`@livekit/agents` minor version sensitivity.** `agent.updateTools()` used from `@livekit/agents@1.3` type surface. If LiveKit removes or renames this method in a future minor (unlikely given semver), this path breaks silently at runtime. Mitigation: pin version in voice-agent `package.json`; review on upgrade.

- **Capability tagging still hardcoded PII deny-list.** Inherited debt from Phase 1+2 + Phase 3 + Phase 3.5. Metadata-driven `risk_tier` field on capability definitions is Phase 5.

---

## Next steps

- **Operator action (immediate post-merge).** Flip `HARNESS_ADAPTER_VOICE=true` in voice-agent production env via deploy-conductor sortie. Smoke test: active voice session on a page with `useRegisterTools` hooks, speak a command that triggers a page tool, verify result is read back. Log to activity-log. Note: `HARNESS_ADAPTER_CHAT=true` (Phase 3.5) should already be flipped or queued; both flags together complete the full dead-pipe closure for all Botsson surfaces.

- **Capability tagging sortie (Phase 5).** Full tag-audit of 75 `_tools/use-*-tools.ts` files. Add `risk_tier` metadata. Replace hardcoded PII deny-list in `authority.ts` with metadata-driven filter for both chat and voice channels. Prerequisite: Phase 3.5 + Phase 4 live in production (real enforcement exercised before refactor).

- **Hot-swap E2E test.** Playwright test with LiveKit audio mock for the multi-page navigation pattern. Low priority — code-trace verified; pursue when LiveKit test infra matures.

- **Phase 4.5 streaming.** If Realtime LLM API grows tool-streaming support, multi-step client-tool chains within a single LLM turn become possible (voice says "checking now... done"). Would extend the async execute body pattern. Defer until concrete product need and Realtime LLM API growth.

- **Promote Wave 0 investigation-first pattern to skill.** First deliberate use as named phase. Add "Wave 0 investigation ritual" procedure to `~/.claude/skills/smartout-agent-dev/SKILL.md` before next sortie with uncertain API territory.

---

## Commits this sortie

All commits on `feat/harness-phase4-voice` since base `development`:

| SHA | Summary |
|---|---|
| `414610614` | chore(harness): phase 4 prep — goal + Wave 0 investigation findings |
| `2c8343819` | feat(harness): voice-agent client-tool RPC roundtrip + dynamic tool registration |
| `4f2295f29` | feat(harness): browser LiveKitVoiceSession — registerTool + RPC roundtrip |
| `a76d442e8` | feat(harness): voice-tool-resolver + agent.ts audit-logging integration |

---

## Test results at close

| Suite | Command | Result |
|---|---|---|
| agent-sdk LiveKitVoiceSession | `pnpm --filter @smartout/agent-sdk test packages/agent-sdk/src/providers/__tests__/livekit-voice-session.test.ts` | **6/6 pass** |
| voice-agent client-tool-rpc | `pnpm --filter @smartout/voice-agent test services/voice-agent/__tests__/client-tool-rpc.test.ts` | **7/7 pass** |
| voice-agent voice-tool-resolver | `pnpm --filter @smartout/voice-agent test services/voice-agent/__tests__/voice-tool-resolver.test.ts` | **7/7 pass** |
| Repo-wide typecheck | `pnpm turbo typecheck` | **52/52 pass** |

**Total sortie unit/integration: 20/20**

---

## Closure readiness

- [x] DEAD-PIPE for voice surface closed — `LiveKitVoiceSession.registerTool` stub replaced, three-topic bidirectional RPC protocol wired
- [x] All 14 acceptance criteria from `goal.md` met (AC1–AC9 code; AC10–AC12 tests; AC13–AC14 docs)
- [x] 5 journeys verified (4 unit-tested, 1 code-traced)
- [x] HANDOFF written (this document)
- [ ] `close-feature.sh` — handled by lead orchestrator
