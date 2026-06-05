---
title: HANDOFF — HarnessAdapter chat E2E sortie
status: done
updated: 2026-05-15
created: 2026-05-15
module: harness
tags: [e2e, playwright, adr-0327, handoff]
predecessor: harness-phase4-voice
---

# HANDOFF — harness-adapter-e2e

## Summary

Added end-to-end Playwright coverage for the HarnessAdapter chat client-tool roundtrip (ADR-0327 Phase 3+3.5). Before this sortie the pipe had 93 unit/integration tests but zero Playwright assertion that the full chain (BotssonProvider → BFF → stage-engine → LLM → client tool execution → activity_trail) wires up correctly at runtime.

The new spec exercises `/dashboard/notifications` + the `getUnreadCount` client tool: simplest available page-scope tool (read-only, 0 args, deterministic JSON response). Verifies HARNESS_ADAPTER_CHAT flag-gated tool resolution, request body shape, response body shape, browser-side execution, and telemetry emission.

## What shipped

| Artefact | Path | Status |
|---|---|---|
| Playwright spec | `apps/e2e/tests/harness-adapter-chat-client-tool.spec.ts` | 10 test blocks (A1-A8 positive + N1 negative + 1 setup) |
| Journey | `docs/journeys/JOURNEY-harness-adapter-e2e.md` | `status: in_progress` (flips to `verified` after Pontus confirms local run green) |
| Goal | `.claude/state/harness-adapter-e2e/goal.md` | written |

ZERO production code changes. ZERO new helpers (extended none — inline pattern fit fine). ZERO new env vars (uses existing `HARNESS_ADAPTER_CHAT`).

## Decisions

| Decision | Reason |
|---|---|
| Pick `/dashboard/notifications` + `getUnreadCount` | Read-only, 0 args, deterministic JSON response, no journey-tool overlap (keeps ADR-0327 separate from ADR-0173) |
| Mirror `botsson-harness-e2e.spec.ts` conventions | Existing precedent — freshness check, 15s DB poll, A1/A2 naming, ADR header refs |
| Route intercept (not direct API POST) | API POST bypasses BotssonProvider → client_tools[] never populated. DOM interaction triggers BotssonChat.tsx submit handler which assembles the array. |
| N1 fallback path = separate guarded describe | Container env-flip not possible in single Playwright run. N1 skips when flag ON. Dual-run pattern documented in JOURNEY. |
| `route: Route` + `page: Page` explicit annotations | TS strict required — `async (route) =>` loses type inference, `page: any` rejected by eslint |
| Drop `Object.fromEntries(response.headers())` | response.headers() returns dict, not iterable. Route.fulfill accepts dict directly. |

## Learnings

| L | Discovery |
|---|---|
| L-0267 | Playwright `route.fulfill({ headers })` accepts the dict shape `response.headers()` returns directly. Wrapping with `Object.fromEntries(...)` causes TS2769 because `headers()` already returns `{ [k: string]: string }`, not iterable entries. |
| L-0268 | `async (route) => ...` in `page.route()` callback loses type inference. Explicit `route: Route` annotation required under TS strict. Sync callbacks `(route) => ...` infer correctly because async wrapping creates a different overload context. |
| L-0269 | Fresh worktree typecheck requires building the @smartout/types → telemetry → ai → journey-ir chain first (`pnpm turbo build --filter=...`). Stop-hook will block commits until dist files exist for cross-package subpath imports. |
| L-0270 | Commitlint scope-case enforced kebab-case strictly. `harness-e2e` rejected — must be `harness`. Subjects/bodies must stay under 100 chars per line. |

## Known issues / debt

- N1 fallback path requires manual second Playwright run with `HARNESS_ADAPTER_CHAT=false` container restart. CI integration deferred.
- Container env-flip helper for E2E (single-run dual-flag coverage) deferred — would need stage-engine restart hook in apps/e2e fixtures.
- Voice client-tool E2E deferred per Phase 4 plan (audio infra in Playwright).
- Multi-step client-tool chain E2E deferred (Phase 3.5 caps at 3 rounds; this spec exercises single roundtrip).

## Next steps

1. **Pontus runs spec locally** with `HARNESS_ADAPTER_CHAT=true` stage-engine container + Supabase Local + Next.js dev:3060
2. If green → flip JOURNEY frontmatter `status: verified` + amend journey commit
3. Optional: run N1 with flag OFF in second container session
4. **Operator action (deferred from Phase 4 close):** flip `HarnessAdapter/chat_enabled` + `voice_enabled` to `true` in vault after preview smoke green

## Commits

| SHA | Subject |
|---|---|
| `22c6471e4` | `test(harness-e2e): chat HarnessAdapter client-tool roundtrip Playwright spec` |
| `d5e5ce387` | `docs(harness-e2e): JOURNEY for HarnessAdapter chat E2E sortie` |
| `64155d9d5` | `fix(harness): TS strict typecheck on Playwright handlers` |

## ADR refs

- ADR-0327 — HarnessAdapter unified LLM consumer (the system this spec verifies)
- ADR-0184 — Agent session recorder (telemetry layer asserted in A8)
- ADR-0134 — Telemetry contract (every mutation emits)
- ADR-0151 — Server-side profile_id derivation

## Sortie metadata

- Worktree: `/home/sxtnl/wsl/smartout.ai-wt-2`
- Branch: `feat/harness-adapter-e2e`
- Base: `development` (c5f911bc2)
- Predecessor: `harness-phase4-voice` (fc8f8570f)
- Duration: single session, Lead-Orchestrator pattern (Wave 0 research + Wave 1 parallel spec + journey + Wave 2 lead-driven verify/close)
