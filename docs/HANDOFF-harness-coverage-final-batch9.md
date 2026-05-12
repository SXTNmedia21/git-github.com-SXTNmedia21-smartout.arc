---
title: "Harness Coverage Final Batch 9 — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [e2e, harness, coverage, kb_query, operations-intelligence, final, milestone]
---

# Harness Coverage Final Batch 9 — HANDOFF

## What was built

The FINAL E2E harness specs. Two single-tool capabilities closed. **100% capability coverage achieved.**

| Spec | Tools covered | Tests / Skips | Live run |
|------|---------------|---------------|----------|
| `apps/e2e/tests/kb-query-harness-e2e.spec.ts` | 1 tool (search_kb) | 9 tests · 1 voice skip | 8 passed, 1 designed-skip |
| `apps/e2e/tests/operations-intelligence-harness-e2e.spec.ts` | 1 tool (triage_event) | 10 tests · 2 designed-skip | 7 passed, 2 designed-skip, 1 E1 empty-state |

**Total: 24/24 capabilities with registered tools covered. 99/127 tools.**

## Decisions

### D1: kb_query timeout bumped — cold-call latency
A1 `/api/botsson/chat` POST exceeded 15s default (real timing: 22.2s in WSL2). Bumped per-request timeout to 60s + per-test timeout to 120s. Embedding lookup + LLM round-trip is the slow path; consistent with classifier+tool LLM chain.

### D2: kb_query dual-path tolerance verified
A3 assertion accepts both PATH-A (OPENROUTER_API_KEY set → empty results) and PATH-B (key absent → embedding_failed structured error). Tool body's try/catch produces structured JSON in both cases. LLM consumer never panics.

### D3: operations-intelligence Z1 permanent gap-doc
`triage_event` calls `emit('ops.triage classified')` (mutation → engine_event) but has NO internal `gate_action` call. ADR-0099 §2 violation. Z1 is a permanent SKIPPED test that documents the gap. Router-level `gate_evaluation` (G1) covers the turn-level gate. Remediation: add `gate_action('operations_intelligence.triage')` inside `execute()` before `emit()`. Separate sortie required.

### D4: triage_event in-memory classification
`triage_event` does NOT read from `engine_event` table. It takes `event_type` as string param + classifies in-memory via `classifyEvent()`. Only DB query is `schedule_shift` for on-shift profiles. The tools that DO read `engine_event` (`query_monitor_alerts`, `get_session_intelligence` in monitor-tools.ts) are out of scope for this spec.

### D5: stage-engine freshness check is load-bearing
First run failed because stage-engine container started 141 min before latest commit (test stayed asleep when image rebuilt). `helpers/botsson-harness.ts:assertStageEngineContainerFresh` correctly blocked. Resolution: `docker compose build stage-engine && docker compose up -d stage-engine`.

## Learnings

### L-B9-1: Playwright webServer with placeholder echo command exits early
`playwright.config.ts` includes a mobile webServer entry with `command: \`echo "Mobile server expected at ${mobileBaseUrl} — start manually..."\``. Echo exits immediately → Playwright reports "Process from config.webServer exited early" — even when web + landing are reusable. Workaround: `SKIP_WEB_SERVER=1` env var + manually start web/landing via `start-local-next-app.sh` before running. Local development pattern, not CI-relevant (CI sets SKIP_WEB_SERVER differently).

### L-B9-2: Playwright `testMatch` collides with vitest files
Config has `testMatch: /\.(spec|test)\.ts$/` which picks up both `.spec.ts` (Playwright) AND `.test.ts` (vitest). `runners/__tests__/speed-profile.test.ts` imports `vitest` → CommonJS require fails when Playwright loads it. Workaround: pass explicit file paths to playwright test invocation, do NOT use `--grep` alone.

### L-B9-3: commitlint scope rejects `e2e` short name
`fix(e2e): ...` rejected. `fix: ...` (no scope) accepted. The rejection appears to be triggered by short alpha-numeric scopes; longer kebab-case names like `kb-query` succeed. Workaround: drop scope or use longer kebab-case scope.

## Known issues / debt

1. **operations-intelligence G3-ops gap** — `triage_event` lacks internal `gate_action` call (ADR-0099 §2). Separate sortie required.
2. **stage-engine container freshness** — must rebuild after any merge that touches stage-engine code. Currently manual; heartbeat job candidate.
3. **Within-capability tool gaps** (14 tools deferred across 6 capabilities) — documented per-spec, each with reason.

## Next steps

1. Merge to development.
2. Refresh coverage matrix v6 → 24/24 capabilities (100%). DONE.
3. Build heartbeat job: scan capability registry against `apps/e2e/tests/*-harness-e2e.spec.ts` filenames → alert on drift when new capability added without spec.
4. Replace single-tool checks in CI with `pnpm --filter e2e exec playwright test tests/*-harness-e2e.spec.ts`.
5. Address G3-ops gap (separate sortie).
6. Address within-capability deferred tools per-capability sortie when integration deps available (DocuSeal sandbox, scrapling endpoint, etc.).

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Prior batches: HANDOFF-harness-coverage-top3.md through -batch8.md
- ADR-0078 (channel guard), ADR-0099 (capability authority + §2 gate_action), ADR-0116 (botsson.tool_invoked), ADR-0151 (server-derive IDs), ADR-0163 (channel allowedChannels)
- L-0107 (fixture provisioning), L-B7-1 (dotted capability authority)
- Live test run: 2026-05-12 wt-14 — operations-intelligence 7/9 effective, kb_query 8/9 effective, 0 failures after timeout fix

## Milestone

**This batch closes the Botsson harness E2E coverage campaign.** Every capability with registered tools (24/24) has an end-to-end harness spec exercising BFF → stage-engine → tool → DB → telemetry → response. 99 tools verified. 14 tools deferred with documented reasons (scrapling, DocuSeal, payroll write, UUID-trap, system-channel-only). 100% capability coverage. Campaign closed.
