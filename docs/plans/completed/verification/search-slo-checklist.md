---
title: Search SLO Verification Checklist
status: draft
updated: 2026-03-06
created: 2026-03-06
module: search
tags: [slo, performance, search]
---

# Search SLO Verification Checklist

## Targets

| Metric      | Target   | Measured |
| ----------- | -------- | -------- |
| p50 latency | < 100ms  | TBD      |
| p95 latency | < 500ms  | TBD      |
| p99 latency | < 1000ms | TBD      |
| Error rate  | < 1%     | TBD      |

## Test Conditions

- [ ] Run with local Supabase
- [ ] Run with 100+ workspace_doc_chunks
- [ ] Run with 5 concurrent users
- [ ] Run with mixed query modes (instance + semantic + dependency)

## Load Script

```bash
node scripts/perf/search-load.mjs http://localhost:3050 5 20
```

## Notes

- Semantic search currently returns empty (pending embedding wiring)
- Instance + dependency search should be fast (SQL-only)
- Vector search latency depends on HNSW index size
