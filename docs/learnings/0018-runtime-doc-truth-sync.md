---
title: "Runtime-Doc Truth Sync Before Prioritization"
id: LEARNING_0018
status: canonical
layer: learning
created: 2026-03-28
updated: 2026-03-28
tags: [documentation, operations, governance, council]
---

# Learning-0018: Runtime-Doc Truth Sync Before Prioritization

## Context

During a drift health council review, the team prioritized operational gaps based on
`docs/STATE.md` and `CLAUDE.md`. The council then verified code and found that two
top-priority "gaps" were stale documentation, not current runtime blockers.

## Discovery

Operational prioritization can drift when documentation is not revalidated against
runtime behavior first. In this case:

- `send_notification` was documented as a stub, but runtime already writes to
  `notification_outbox` in engine dispatch.
- `hospitality.ts` tariff values were documented as wrong, but fallback values are
  already corrected and DB-first loading is in place.

## Impact

Before each council or roadmap prioritization pass, run a short truth-sync check:

1. Validate high-risk claims in source docs against runtime code.
2. Update stale claims immediately.
3. Only then prioritize remaining OPEN gaps.

This reduces false urgency, prevents roadmap noise, and improves release decisions.

## References

- `docs/STATE.md`
- `CLAUDE.md`
- `supabase/functions/engine-dispatch/index.ts`
- `packages/ai/src/industry/packages/hospitality.ts`
- `docs/council/COUNCIL-LOG.md`
