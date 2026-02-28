# ADR-0019: Performance and Build Governance System

**Status:** Accepted  
**Date:** 2026-02-28

## Context and Problem Statement

The repository had baseline quality gates (lint, typecheck, format, build) but lacked a durable, route-level performance governance loop. Regressions in client-heavy routes and expensive UI patterns could merge without measurable controls.

We need a system that:

- works in CI for all `web` and `landing` routes,
- supports phased enforcement (warn first, then fail),
- creates clear ownership and escalation paths.

## Decision Drivers (Why we must make a decision)

- Reduce dashboard and landing slowness systematically, not ad hoc.
- Prevent bad builds and runtime drift from recurring.
- Keep CI deterministic and maintainable in a monorepo.
- Introduce governance without blocking all PRs immediately.

## Considered Options

- Option 1: Keep existing checks only (lint/typecheck/build).
- Option 2: Add Lighthouse-only checks as hard fail immediately.
- Option 3: Add route budget checks + build health checks with phased warn-to-fail enforcement.

## Decision Outcome

Chosen option: "Option 3", because it provides measurable controls immediately while reducing rollout risk through warn mode before hard gating.

## Rules & Consequences enforced for Agents

- **Good, because** route performance and build-health regressions become visible on every PR with artifacts.
- **Bad, because** teams must maintain budget files and respond to warnings/exemptions actively.
- **Agent Impact:** agents must update route budgets, governance docs, and CI checks when changing route complexity or build constraints.

## Implementation Notes

- Governance docs:
  - `docs/cross-cutting/performance-governance.md`
  - `docs/cross-cutting/performance-checklist.md`
- Architecture doc:
  - `docs/architecture/PERFORMANCE_BUILD_GOVERNANCE.md`
- Route budgets:
  - `apps/web/perf-budgets.json`
  - `apps/landing/perf-budgets.json`
- CI jobs:
  - `perf-budgets` (warn mode initially)
  - `build-health`
- Enforcement switch:
  - CI env `PERF_ENFORCEMENT=warn|fail`
  - Move to `fail` after baseline stabilization period.

## Learnings Captured

- Budget governance is only effective when attached to route ownership and PR checklist behavior.
- Deterministic CI metrics (response/payload checks) are better first-line gates than high-flake browser benchmarks.
- Warn-to-fail rollout reduces adoption friction while still preventing long-term regression drift.
- Avoid broad top-level client boundaries; lazy-load heavy islands in shells whenever possible.
