---
goal_id: harness-adapter-e2e
status: pending_user_confirm
created: 2026-05-15
worktree: /home/sxtnl/dev/smartout.ai-wt-2
branch: feat/harness-adapter-e2e
base: development
predecessor_adr: ADR-0327
predecessor_sortie: harness-phase4-voice (full HarnessAdapter pipe complete, unit-tested per phase, no end-to-end browser ↔ stage-engine ↔ DB Playwright coverage of the new chat client-tool pipe)
predecessor_pattern: apps/e2e/tests/botsson-harness-e2e.spec.ts (existing chat memory pipe E2E — extend the model, do not rewrite)
---

# Goal — harness-adapter-e2e

## Outcome (technical, source of truth)

Add Playwright E2E coverage that exercises the HarnessAdapter chat pipe end-to-end when `HARNESS_ADAPTER_CHAT=true`. Spec opens a dashboard page that registers page-scope tools, sends a chat message that triggers one of those tools, verifies the browser executes the implementation, the result reaches the LLM, the LLM emits a follow-up assistant turn, and the activity_trail records the tool call. Voice client-tool E2E remains deferred (audio infra — per Phase 4 plan).

## Acceptance criteria (binary, testable)

1. New spec `apps/e2e/tests/harness-adapter-chat-client-tool.spec.ts` exists.
2. Spec asserts `process.env.HARNESS_ADAPTER_CHAT === "true"` in stage-engine container at startup. Skips test with explicit `test.skip("HARNESS_ADAPTER_CHAT not enabled — skipping HarnessAdapter E2E")` when flag is off.
3. Test loads a dashboard page that registers at least one page-scope tool (e.g. `/dashboard/schedule` or `/dashboard/people`).
4. Test verifies BotssonProvider has aggregated tools via `useRegisteredTools()` (DOM data-attribute or window-level debug bridge).
5. Test sends a chat message via Botsson chat surface that prompts the LLM to call the page-scope tool.
6. Test asserts:
   - BFF `/api/botsson/chat` request includes `client_tools[]` in body
   - Stage-engine response includes `client_tool_calls[]` (intercepted via test-instrumented BFF mode OR via inspection of subsequent re-request body)
   - Browser-side client-tool implementation actually runs (assertion via tool-side fixture or DOM mutation)
   - Final assistant message references the tool result
   - activity_trail row: `botsson.tool_invoked` with `tool_name` = registered tool name AND `outcome = "applied"`
7. Test covers feature-flag fallback path: when `HARNESS_ADAPTER_CHAT=false`, same dashboard page + same chat message → does NOT include `client_tools` in BFF → legacy `buildAllBotssonTools` path runs → no `botsson.tool_invoked` for page-scope tool. (Single test with two stage-engine container runs OR conditional skip if flag flip not feasible in CI.)
8. Spec follows existing `botsson-harness-e2e.spec.ts` conventions: stage-engine freshness check, recorder flush polling, 15s timeout on DB assertions.
9. JOURNEY-harness-adapter-e2e.md written documenting: who runs E2E + how + which env vars + which container restart required + pass/fail interpretation.
10. JOURNEY frontmatter `status: verified` after spec passes locally against running stage-engine container with `HARNESS_ADAPTER_CHAT=true`.
11. HANDOFF-harness-adapter-e2e.md written documenting: decisions taken, learnings (especially around stage-engine container env-flag flip pattern for E2E), deferred items (voice E2E, multi-step client-tool chains).
12. Repo-wide `pnpm turbo typecheck` passes (52/52).
13. New spec passes locally: `pnpm --filter e2e test:e2e harness-adapter-chat-client-tool` against running stage-engine with flag ON.

## Out of scope (explicitly deferred)

- **Voice client-tool E2E** — requires LiveKit audio infra in Playwright. Deferred per Phase 4 plan. Voice unit tests already cover RPC roundtrip (7/7 client-tool-rpc + 7/7 voice-tool-resolver + 6/6 LiveKitVoiceSession).
- **Multi-step client-tool chains** — Phase 3.5 caps at 3 rounds. MVP E2E tests single roundtrip.
- **Real LiveKit data channel test for voice** — same reason as voice E2E.
- **Performance benchmarking** — separate sortie if needed.
- **Cross-page navigation client-tool hot-swap** — Phase 4 voice handles this, but E2E for chat-side navigation is deferred (chat is request/response, less stateful).
- **Capability tagging migration** (`risk_tier`) — still hardcoded deny-list (deferred from all HarnessAdapter phases).

## Affected missions / files

- `apps/e2e/tests/harness-adapter-chat-client-tool.spec.ts` — NEW spec
- `apps/e2e/helpers/botsson-harness.ts` — possibly extend with helper for `client_tools` request inspection
- `docs/journeys/JOURNEY-harness-adapter-e2e.md` — NEW journey
- `docs/HANDOFF-harness-adapter-e2e.md` — NEW handoff (closure)

NO production code changes. NO migrations. NO new env vars beyond existing `HARNESS_ADAPTER_CHAT`.

## Contracts modified / new

- None. Pure test addition.

## Risks

- **R1: Stage-engine container env flip in CI** — currently CI runs stage-engine with whatever env it boots with. Flipping `HARNESS_ADAPTER_CHAT` mid-run requires container restart. Mitigation: spec asserts current state, runs only the matching branch; HANDOFF documents the restart pattern; if both branches required in one CI run, separate spec files OR spec-level container restart helper.
- **R2: Page-scope tool needs deterministic LLM invocation** — LLMs are probabilistic; test could be flaky if prompt doesn't reliably trigger tool call. Mitigation: prompt explicitly names the tool (e.g. "use the listTodayShifts tool now"), use lowest-temperature setting, or stub the LLM via OpenRouter fixture if deterministic test required.
- **R3: activity_trail flush timing** — same as existing botsson-harness-e2e spec (15s poll). Mitigation: reuse the existing pattern.
- **R4: Page-scope tool fixture needs to exist + be small** — picking `/dashboard/schedule` requires loading the full schedule view + may have auth gates. Mitigation: pick the simplest page with the fewest dependencies (`/dashboard/people` or `/dashboard/notifications`); document in HANDOFF why that page chosen.
- **R5: Test-only debug bridge for tool inspection** — spec needs to assert tool was actually invoked browser-side. Adding window-level debug bridge purely for tests is debt. Mitigation: prefer DOM mutation (tool result rendered in chat) or activity_trail row over window-bridge; only add bridge if no other observable signal exists.
- **R6: HARNESS_ADAPTER_CHAT default is false** — existing tests run with flag off, this new spec needs flag on. Mitigation: spec includes its own env-flip helper OR explicit operator instruction in JOURNEY (run E2E in dedicated container).

## Plain-language version (4 sentences, ELI10)

Vi har bygd hele HarnessAdapter-rørledningen (chat + voice) men har bare unit-tester per fase. Trenger én Playwright-test som åpner en ekte dashboard-side, skriver inn melding til Botsson, ser at AI-en bruker side-knappen, sjekker at knappen faktisk gjorde noe, og verifiserer at det havnet i loggen. Stemmesiden venter — Playwright kan ikke lett spille av audio. Når denne testen er grønn er hele kjeden bevist fra knapp til logg.

## Status

`pending_user_confirm` — awaiting "go".
