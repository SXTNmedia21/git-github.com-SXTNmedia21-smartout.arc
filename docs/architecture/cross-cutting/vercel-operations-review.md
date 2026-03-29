---
title: "Vercel Operations Review"
id: XCUT_VERCEL_OPS
version: "1.0"
status: canonical
layer: cross-cutting
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags:
  - vercel
  - operations
  - monitoring
  - web-vitals
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Vercel Operations Review

## Weekly Review (per project: smartout-web, smartout-landing)

### Speed Insights (Core Web Vitals — real user data)

- [ ] LCP < 2.5s (good), flag > 4.0s (poor)
- [ ] INP < 200ms (good), flag > 500ms (poor)
- [ ] CLS < 0.1 (good), flag > 0.25 (poor)
- [ ] Identify route outliers (slowest 3 routes)
- [ ] Compare with previous week — flag regressions > 10%

### Web Analytics

- [ ] Top 10 pages by views
- [ ] Bounce rate by route (flag > 70% on key pages)
- [ ] Referrer distribution
- [ ] Geographic distribution (Norway should be dominant)

### Observability

- [ ] Error rate trend (flag > 1% of requests)
- [ ] Slowest serverless functions (flag > 3s p95)
- [ ] Middleware latency (web app Edge functions)
- [ ] External API latency (Supabase, Stripe, PostHog)
- [ ] Failed deployment count

### Cross-Reference with Existing Tools

- [ ] Compare Vercel error rate with Sentry error volume (web app)
- [ ] Compare Vercel page views with PostHog events (web app)
- [ ] Verify CI perf budgets align with real-user Speed Insights data

## Monthly Optimization Pass

- [ ] Review route-level perf budgets vs. real-user Speed Insights data
- [ ] Update `perf-budgets.json` if budgets are consistently too loose or tight
- [ ] Identify top 3 routes for optimization
- [ ] Cross-reference with PostHog feature usage — optimize high-traffic routes first
- [ ] Update CI enforcement thresholds if needed
- [ ] Review Vercel function duration and memory — right-size if needed

## Escalation Triggers

| Metric                   | Threshold          | Action                                      |
| ------------------------ | ------------------ | ------------------------------------------- |
| LCP p75                  | > 4.0s for 3+ days | Investigate and create Linear issue         |
| Error rate               | > 2% for 1+ day    | Immediate investigation                     |
| Function cold start      | > 5s               | Review bundle size, consider edge runtime   |
| Middleware latency       | > 100ms p95        | Review middleware logic, consider splitting |
| Deployment failure       | 2+ consecutive     | Check build logs, rollback if needed        |
| Sentry unresolved errors | > 10 new in 24h    | Triage and prioritize                       |
