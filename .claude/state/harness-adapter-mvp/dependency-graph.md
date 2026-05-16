---
goal_id: harness-adapter-mvp
created: 2026-05-14
---

# Dependency Graph

```
ARCHITECTURE          AI (interface)       AI (sources × 3 parallel)    AI (factory)        DOCS
 Task 1                Task 2               Tasks 3, 4, 5                Task 6              Tasks 7, 8
 ADR-0327 body  ───→  types.ts      ───→  capabilities    + ─────→     factory.ts ───→    JOURNEY verify
 status accepted      types-test           site-map        +            integration         HANDOFF
                                           authority       +            test                close-feature
```

Sequential phases (no parallelism within phase except Phase 3):

| Phase | Team | Tasks | Agents | Depends on |
|---|---|---|---|---|
| P1 | ARCHITECTURE | Task 1 | 1 | none |
| P2 | AI | Task 2 (types interface) | 1 | P1 (ADR's final type signatures) |
| P3 | AI | Tasks 3, 4, 5 (sources + authority) | 3 parallel | P2 (types) |
| P4 | AI | Task 6 (factory + integration test) | 1 | P3 |
| P5 | DOCS | Tasks 7, 8 (journey verify + HANDOFF) | 1 | P4 |

Total: 5 phases, 7 agent dispatches, all within budget (≤3 agents/phase, ≤5 teams).

## Per-team state files

- `.claude/state/harness-adapter-mvp/architecture.md` — Task 1 tracking
- `.claude/state/harness-adapter-mvp/ai.md` — Tasks 2-6 tracking
- `.claude/state/harness-adapter-mvp/docs.md` — Tasks 7-8 tracking

## Logical teams in shared worktree

Pragmatic deviation from Lead-Orchestrator directive step 7: this sortie uses one physical worktree (`wt-1`) for all teams because:
- 8 tasks total → small scale; per-team worktrees + 3 merges = overhead > benefit
- Sequential dependency (P1 → P2 → P3 → P4 → P5) prevents parallel commits from colliding
- Phase 3 has 3 parallel agents touching SEPARATE files (capabilities-source / site-map-source / authority); no conflict
- Final merge is single `feat/harness-adapter-mvp → development` via `close-feature.sh`

If a real coordination problem emerges, can split into per-team worktrees retroactively.

## Council budget

| Phase | Used | Budget |
|---|---|---|
| P1 | 0 | 2 |
| P2 | 0 | 2 |
| P3 | 0 | 2 |
| P4 | 0 | 2 |
| P5 | 0 | 2 |

Council calls reserved for: contract conflict, retry exhaustion, no-precedent decision in ADR body.

## Retry policy

Per directive: failure → 1 retry → shrink+retry → `/run-council`.

Shrink-retry rule: if Phase 3 source-implementation agent fails twice, shrink scope (drop optional features) and retry once more. Beyond that = council.
