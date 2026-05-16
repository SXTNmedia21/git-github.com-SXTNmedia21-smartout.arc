---
title: "HarnessAdapter prod-readiness fixes"
status: verified
updated: 2026-05-15
created: 2026-05-15
module: harness
tags: [adr-0327, prod-readiness, hotfix, telemetry]
predecessor: harness-adapter-e2e
---

# JOURNEY-harness-adapter-prod-readiness

Spor B audit (system-agent-coordinator opus) found 3 silent bugs/gaps in chat path of ADR-0327 HarnessAdapter before production rollout. This sortie closes them.

## Journey: Operator flips `HARNESS_ADAPTER_CHAT=true` in production

**Precondition:**
- All 3 fixes merged to `development` (commits 7098b7b11, 2f25f4128, 1e33f56a7)
- HOP A complete: development → preview, smoke green
- HOP B complete: preview → main, deployed via ADR-0265 pipeline

### Step-by-step

| # | User does | System does | User sees |
|---|---|---|---|
| 1 | Edits production stage-engine env to set `HARNESS_ADAPTER_CHAT=true` | Container restart | Logs: "harness adapter chat enabled" |
| 2 | Opens Botsson chat on any `/dashboard/*` page (e.g. `/dashboard/notifications`) | BotssonProvider collects 75 page-scope tools | Chat opens normally |
| 3 | Sends message that triggers a page-scope tool ("how many ulest har jeg?") | (Fix 1) `bundle.systemPromptSlices` injected into LLM system prompt → LLM knows page context | LLM invokes `getUnreadCount` |
| 4 | (LLM invocation triggers tool authority check) | (Fix 2) If any tools blocked by authority → `botsson.authority_filtered` telemetry emitted → activity_trail row written → recorder turn captured | (transparent to user) |
| 5 | Browser executes tool, re-submits result, LLM continues | Roundtrip per Phase 3.5 spec | Final assistant message with unreadCount |

**Postcondition:**
- `activity_trail` table: `botsson.authority_filtered` event present when blocking occurred (else absent — non-emission is fine)
- `agent_session_recording`: `authority_filtered` turn phase recorded
- LLM response quality includes page-specific context from slices

### Error paths

| Symptom | Likely cause | Fix |
|---|---|---|
| LLM responds without page-context | Fix 1 not applied — `agent-router.ts:577` missing slice injection | Verify commit 7098b7b11 in production deploy |
| Tools silently blocked, no audit trail | Fix 2 not applied — telemetry event not registered or not emitted | Check `botsson.authority_filtered` in `packages/telemetry/src/registry.ts` |
| LLM quality regressed after slice injection | System prompt length grew too large | Trim slices or move ordering — slices last, default context first |

## Journey: Operator audits authority filtering in production

1. Open PostHog dashboard, filter `botsson.authority_filtered`
2. Group by `workspace_id` + `blocked_tools` array
3. Investigate any workspace with unexpected high block counts — likely misconfigured authority

## Relationship to existing tests

- Unit tests for chat-tool-resolver + agent-router cover the bundle flow already
- Fix 1: bundle.systemPromptSlices was passed through — now reads at sink
- Fix 2: new telemetry event added to registry — existing emit() tests cover shape contract
- Fix 3: pure docstring correction — no test impact

## Audit reference

Read-only audit by `system-agent-coordinator` (opus) on HEAD `e09452769`. 5-question audit found:
- Q1 systemPromptSlices: 🔴 silent bug → FIX 1
- Q2 authority audit: 🔴 silent bug → FIX 2
- Q3 mission integration: 🟡 docstring lies → FIX 3
- Q4 voice mission compat: ✅ safe (observational MVP)
- Q5 fallback path: 🟡 no regression

## Why this sortie was created

The first 4 HarnessAdapter sorties (Phase 1+2 / Phase 3 / Phase 3.5 / Phase 4) plus the E2E sortie all shipped without these gaps surfaced. Audit ran AFTER the E2E sortie when Pontus asked for full verification. The gaps were genuinely silent — typecheck + unit tests green throughout. Only end-to-end-trace + integration-audit found them.

Lesson captured in HANDOFF as L-0271.
