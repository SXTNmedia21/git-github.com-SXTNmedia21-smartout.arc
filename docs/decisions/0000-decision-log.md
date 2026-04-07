---
title: Decision Log
status: in_progress
updated: 2026-04-06
created: 2026-04-06
module: ai-agent
tags: [decisions]
---

# Decision Log — agent-harness

| # | Date | Decision | Status |
|---|------|----------|--------|
| ADR-0072 | 2026-04-06 | Two-layer eval harness for `packages/ai`: unit tests (mocked, every CI) + gated evals (real LLM, `RUN_EVALS=1`, nightly). Vitest with separate config per layer. Fixture format is TS+Zod. See `0072-ai-eval-harness.md`. | accepted |
