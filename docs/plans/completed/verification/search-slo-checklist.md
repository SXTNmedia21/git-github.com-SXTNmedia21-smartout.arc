---
title: Search SLO Verification Checklist
status: active
updated: 2026-03-07
created: 2026-03-06
module: search
tags: [slo, performance, search]
---

# Search SLO Verification Checklist

Practical checklist for validating `/api/search` latency and stability before merge/release.

## 1) SLO targets

| Metric      | Target    | Pass/Fail rule          |
| ----------- | --------- | ----------------------- |
| p50 latency | <= 100ms  | Fails if above target   |
| p95 latency | <= 500ms  | Fails if above target   |
| p99 latency | <= 1000ms | Warn if above target    |
| Error rate  | < 1%      | Warn if at/above target |

## 2) Pre-flight checks

- [ ] App is running (`pnpm --filter web dev`)
- [ ] Database is reachable and migrations are applied
- [ ] Test workspace has searchable data (profiles/policies/protocols)
- [ ] Optional: vector chunks available for semantic mode

## 3) Execute load script

Command:

```bash
node scripts/perf/search-load.mjs http://localhost:3050 5 20 <workspace-id>
```

Arguments:

- `base_url` default: `http://localhost:3050`
- `concurrency` default: `5`
- `iterations` default: `20`
- `workspace_id` default: zero UUID fallback

## 4) Record verification result

Fill after each run:

- Date/time:
- Commit/branch:
- Dataset notes (rows/chunks):
- Total requests:
- Success count:
- Error rate:
- p50 / p95 / p99:
- Decision: PASS / FAIL / WARN

## 5) Interpretation notes

- Semantic search currently returns empty (pending embedding wiring)
- Instance + dependency modes are SQL-based and should remain low latency
- Vector latency scales with embedding volume and HNSW index health
- If p95 regresses, check DB query plans and route/orchestrator changes first
