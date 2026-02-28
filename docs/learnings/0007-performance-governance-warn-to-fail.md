---
id: 0007
title: Warn-to-fail Performance and Build Governance scales better than immediate hard-fail
date: 2026-02-28
tags: [performance, ci, governance, architecture]
---

# Learning-0007: Warn-to-fail Performance and Build Governance scales better than immediate hard-fail

## Context

We introduced route-level performance budgets and build-health checks across `apps/web` and `apps/landing`.

The key rollout decision was whether to fail builds immediately or phase enforcement.

## Discovery

A phased model (warn on PRs, fail on integration branch) provides better adoption while still enforcing standards:

- Teams receive immediate visibility from CI artifacts.
- Low-confidence thresholds can be tuned before becoming blockers.
- The system avoids introducing friction spikes while governance is still calibrating.

## Impact

- CI now supports a predictable transition from visibility to enforcement.
- Performance and Build Governance is embedded in PR workflow through checklist + budgets + artifacts.
- Architecture decisions around client boundaries become easier to govern over time.

## References

- ADR: `docs/decisions/0019-performance-build-governance.md`
- Architecture: `docs/architecture/PERFORMANCE_BUILD_GOVERNANCE.md`
- Governance policy: `docs/cross-cutting/performance-governance.md`
