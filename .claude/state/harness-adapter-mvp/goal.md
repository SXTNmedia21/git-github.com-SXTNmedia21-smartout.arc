---
goal_id: harness-adapter-mvp
status: pending_user_confirm
created: 2026-05-14
worktree: /home/sxtnl/dev/smartout.ai-wt-1
branch: feat/harness-adapter-mvp
base: development
predecessor_adr: ADR-0327
predecessor_council: 2026-05-14 (Page-Polish Skill Audit + Harness Integration E2E)
predecessor_learning: L-0264 (skill-claim-trace-trap)
---

# Goal — harness-adapter-mvp

## Outcome (technical, source of truth)

Ship the unified `HarnessAdapter` Phase 1 (interface) + Phase 2 (registry sources: capabilities, site-map, authority). Adapter lives at `packages/ai/src/harness/`. ADR-0327 body completes + status flips proposed → accepted. No LLM consumer wiring (Phase 3 chat / Phase 4 voice deferred to separate sortie).

## Acceptance criteria (binary, testable)

1. ADR-0327 body sections written: Alternatives Considered, Consequences (positive/negative/neutral), Phases 1-6 detailed, Test Strategy, Migration Path, Open Questions. Status: `accepted`.
2. `packages/ai/src/harness/types.ts` defines `HarnessAdapter` interface + `Channel`, `UserContext`, `ToolBundle`, `SiteMap`, `AuthorityConfig` types. Compiles under `pnpm --filter @smartout/ai typecheck`.
3. `packages/ai/src/harness/sources/capabilities-source.ts` exists; reads from `packages/ai/src/capabilities/` registry; filters by channel + role + workspace authority.
4. `packages/ai/src/harness/sources/site-map-source.ts` exists; reads `apps/web/.botsson/site-map.json`; filters by user role.
5. `packages/ai/src/harness/authority.ts` exists; enforces ADR-0078 (PII chat-only), ADR-0151 (server-derived workspace_id), ADR-0244 (financial-mutation block on voice/passive).
6. `packages/ai/src/harness/factory.ts` composes the 3 sources + authority into a `HarnessAdapter` instance.
7. Unit tests for all 3 sources + authority + factory pass: `pnpm --filter @smartout/ai test src/harness/`.
8. Repo-wide typecheck passes: `pnpm turbo typecheck`.
9. Journey doc `docs/journeys/JOURNEY-harness-adapter-mvp.md` has `verified: true`; 3 verification protocols pass.
10. HANDOFF written.

## Out of scope (explicitly deferred)

- Phase 3: wire chat consumer (`/api/botsson/chat` schema + stage-engine `/agent/chat` accept `client_tools`). Separate sortie.
- Phase 4: wire voice consumer (fill `LiveKitVoiceSession.registerTool()` stub at `packages/agent-sdk/src/providers/livekit.ts:38-40`). Separate sortie.
- Removing `DEAD-PIPE-2026-05-14` markers from 42 `_tools/` files. Phase 3 closes those.
- Touching `useRegisterTools` calls in any of the 42 `_tools/` files. Phase 7 client registry stays intact for Phase 3 wiring.
- Updating `/api/wizard/start` to read `body.selected_tools`. Phase 4 fixes that.

## Affected missions

- **botsson-chat-mission** (downstream — Phase 3 will consume adapter)
- **botsson-voice-mission** (downstream — Phase 4 will consume adapter)
- **query_smartout capability** (downstream — eventually reads adapter's site-map for route discovery)

## Contracts created (this sortie defines them)

- `HarnessAdapter.getToolsForChannel(channel, pageRoute, userContext) → ToolBundle`
- `HarnessAdapter.getSiteMap(userContext) → SiteMap`
- `HarnessAdapter.subscribeToRouteChange(callback) → Unsubscribe`
- `AuthorityConfig` — server-derived authority state per session

## Risks

- **R1:** Capability registry shape doesn't match adapter's expected input. Mitigation: Task 3 step 3.1 inspects registry before writing source.
- **R2:** site-map.json schema drifts (it's edited by the page-polish skill). Mitigation: Zod validation in SiteMapSource constructor.
- **R3:** Authority enforcement may surface ADR-0078 tool-classification gaps (some PII tools may not be tagged). Mitigation: defer tag-audit to follow-up; ship MVP with conservative deny-list (manual).

## Plain-language version (4 sentences, ELI10)

This sortie builds a single phone-book in code that any Smartout AI helper (chat, voice, future Slack-bot, future email-bot) can ask: "what can the user do on the page they're on right now?" Today the phone-book is broken in three different places, so the helpers don't actually know — they were given fake instructions in the skill manual. This sortie writes the phone-book + the rules for who is allowed to see which entries; it does NOT yet hook any helper up to the phone-book (that's the next sortie). We'll know it works when a test pretends to be a chat helper, asks the phone-book, and gets back the right list of tools matching what each page registered.

## Status

`pending_user_confirm` — awaiting Pontus's explicit "yes, build that" before proceeding to step 4 of Lead-Orchestrator flow.
