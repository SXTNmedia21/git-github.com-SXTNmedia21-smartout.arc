---
goal_id: harness-phase3-chat
created: 2026-05-14
---

# Dependency Graph

```
ARCH (analysis)        AI/BFF                 AI/STAGE-ENGINE       AI/RESOLVER       QA               DOCS
 Task A1               Task B1                Task C1               Task D1           Task E1          Task F1+F2
 ADR-0327 §Phase3 ──→  BFF schema  ────────→  stage-engine schema ──→ resolver impl ──→ integration ──→ JOURNEY + HANDOFF
 flip status            client_tools field    client_tools field      (HarnessAdapter      tests + smoke    + DEAD-PIPE removal
                       forward                                        compose + merge)
```

Phases:

| Phase | Team | Tasks | Agents | Depends on |
|---|---|---|---|---|
| P1 | ARCH | A1 — ADR-0327 Phase 3 status flip + analysis notes | 1 | none |
| P2 | AI/BFF + AI/STAGE-ENGINE + AI/RESOLVER | B1 (BFF schema) + C1 (stage-engine schema) + D1 (resolver impl) | 3 parallel | none (schemas + impl on disjoint files) |
| P3 | QA | E1 — integration + smoke tests | 1 | P2 |
| P4 | AI/CLEANUP | DEAD-PIPE marker removal on 42 files (mechanical) | 1 | P3 green |
| P5 | DOCS | F1 (JOURNEY verify) + F2 (HANDOFF) | 1 | P4 |

Total: 5 phases, 7 agent dispatches.

Wave 1: ARCH(P1) — can run parallel with P2 since ADR update is documentation, doesn't affect code-impl decisions (everything decided in P1's pre-shipped ADR-0327 body).

Wave 2: P2 (BFF + stage-engine + resolver — 3 parallel agents — disjoint files).

Wave 3: P3 (integration + smoke).

Wave 4: P4 (cleanup — 42 file marker removal — single mechanical agent).

Wave 5: P5 (docs).

## Logical teams in shared worktree (continued from Phase 1+2 sortie pattern)

Single worktree `wt-1` (`feat/harness-phase3-chat`). Per-team worktrees premature for ~12-15 commit feature.

## Council budget

| Phase | Used | Budget |
|---|---|---|
| P1 | 0 | 2 |
| P2 | 0 | 2 |
| P3 | 0 | 2 |
| P4 | 0 | 2 |
| P5 | 0 | 2 |

## Retry policy

Per directive: failure → 1 retry → shrink+retry → council.

Anticipated retries (low probability):
- R3 cold-start: resolver impl may need adapter caching layer — if first agent doesn't add it, retry with explicit "cache instance per workspace_id" hint
- R4 authority bypass: agent may forget to apply authority on client-tool path; spec-review will catch

## Estimated time

- P1 ADR update: 15 min
- P2 parallel (3 agents): 45 min (max of three)
- P3 tests: 30 min
- P4 cleanup: 10 min
- P5 docs: 25 min
- close-feature: 5 min

**Total ~2.5h wall clock** if no retries.

## Cross-cutting (run in parallel with P1-P2)

None. ARCH analysis is read-only; doesn't block AI work.

Actually re-evaluating: P1 ADR update IS independent of P2 impl work. Both can be Wave 1 parallel:

```
Wave 1 (4 parallel agents): ARCH (P1) + BFF (P2.B1) + Stage-engine (P2.C1) + Resolver (P2.D1)
Wave 2 (1 agent): QA (P3)
Wave 3 (1 agent): Cleanup (P4) — gated on P3 green
Wave 4 (1 agent): DOCS (P5)
```

Revised total: ~2h wall clock.
