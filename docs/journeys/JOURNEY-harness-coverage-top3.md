---
title: "Journey — harness-coverage-top3"
feature: harness-coverage-top3
branch: feat/harness-coverage-top3
created: 2026-05-11
updated: 2026-05-11
module: ai
status: verified
tags: [e2e, harness, coverage, schedule, governance, payroll]
---

# Journey — harness-coverage-top3

## Why

Botsson harness E2E previously covered exactly one capability (memory) out of 119 registered tools across 20+ capabilities. Today's bug (stale stage-engine container hiding silent save_memory failure) proved that single-capability coverage is insufficient. This sortie adds three more capability E2E specs as the canonical pattern for ongoing coverage expansion.

## Journey 1 — Engineer adds capability E2E coverage

**Precondition:** Stage-engine running, local Supabase healthy, seed admin profile present.

1. Engineer picks a capability without E2E coverage from `apps/e2e/coverage` matrix
2. Copies `apps/e2e/tests/botsson-harness-e2e.spec.ts` as template
3. Adapts intent queries to capability-specific tool routing
4. Reuses `apps/e2e/helpers/botsson-harness.ts` for shared infra (freshness check, cleanup, BFF caller)
5. Adds capability-specific helper in `apps/e2e/helpers/<capability>-harness.ts` if dedup makes sense
6. Runs `pnpm --filter e2e test:e2e -- tests/<capability>-harness-e2e.spec.ts`
7. Asserts all positive pass, documents skipped negative paths

**Postcondition:** Capability has end-to-end pipe coverage from L1 BFF call through L5 DB persistence.

**Error paths:** Stage-engine container stale → freshness check fails fast with explicit rebuild message. Workspace package dist missing → `pnpm --filter @smartout/<pkg> build` resolves.

## Journey 2 — CI runs harness coverage

**Precondition:** PR merged to development, stage-engine rebuilt, Supabase fresh.

1. CI workflow invokes `pnpm --filter e2e test:e2e`
2. All `*-harness-e2e.spec.ts` specs run sequentially (serial mode per spec)
3. Failure surfaces specific capability + assertion
4. Failure includes last 200 stage-engine logs in test output

**Postcondition:** Green = harness pipe verified per capability. Red = LOUD failure with actionable trace.

## Journey 3 — Coverage drift detection

**Precondition:** New capability registered in `packages/ai/src/capabilities/`.

1. Heartbeat job scans capability registry vs `apps/e2e/tests/*-harness-e2e.spec.ts` filenames
2. Capability without matching spec = drift
3. Telegram alert + Linear OPS-ticket auto-created

**Postcondition:** Coverage gaps cannot accumulate silently.

**Error paths:** Heartbeat job offline → manual quarterly review via `/audit smoke`.
