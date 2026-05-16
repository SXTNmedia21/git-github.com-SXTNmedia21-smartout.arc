---
title: "ADR + Contract Audit Smoke Summary — 2026-05-16"
status: complete
created: 2026-05-16
updated: 2026-05-16
mode: smoke
run_id: 2026-05-16-adr-contract-validation
slices_run: 3
baseline: 2026-05-15-adr-contract-validation
tags: [audit, smoke, adr, contract-validation]
---

# ADR + Contract Audit Smoke — 2026-05-16

## Executive Summary

Triggered after `feat/timeline-templates` merged to `development` at `d811d1a9d`. Smoke covers 3 highest-risk slices for capability surface, Edge Function boundary, and DB/telemetry — exactly where the new feature landed.

**Verdict: 0 CRITICAL, 1 HIGH, 2 MEDIUM, 2 LOW.** Timeline-templates feature ships CLEAN across all three specialist domains. Net audit delta vs 2026-05-15: **4 findings CLOSED** (F-DB-14, F-DB-20, F-DB-21, F-DB-22 — WITH CHECK sweep). No regressions introduced by timeline-templates.

## Timeline-templates compliance (independently verified by 3 specialists)

| Slice | Verdict | Evidence |
|---|---|---|
| capability-tools (01) | PASS | 4 tools: save/list/apply/archive — all via `mutateWithGate`, all chat-only, all emit() per ADR-0116, 0 L-0176 docstring drift, 0 L-0177 silent fallback |
| edge-functions (03) | PASS | Feature uses Next.js BFF route handlers only; no new EFs introduced. Confirmed in `apps/web/src/app/api/timeline-template/*` |
| db-rls-telemetry (07) | PASS | `timeline_template` table: workspace_id NOT NULL, RLS+WITH CHECK on 3 policies (SELECT/INSERT/UPDATE), no DELETE policy (soft-delete only). 5 telemetry events all in SmartoutEvent + EVENT_ROUTING. database.types.ts in sync. ADR-0189 authority seed + capability_default_registry both shipped idempotently |

## Top findings (all pre-existing — none from timeline-templates)

| # | ID | Sev | Theme | Source | ADR |
|---|---|---|---|---|---|
| 1 | F-CT-01 | HIGH | 14 legacy capability `gate.ts` files bypass `gatedMutation` orchestrator | capability-tools | ADR-0204 §SS-5 |
| 2 | F-CT-02 | MEDIUM | `billing_query.get_usage_snapshot` body-supplied workspace_id without server equality check | capability-tools | ADR-0151 |
| 3 | F-EF-01 | MEDIUM | 3 EFs (`finalize-workspace`, `activate-workspace`, `call-command`) have `verify_jwt=false` with manual in-body JWT validation but rationale undocumented in config.toml | edge-functions | ADR-0029 (docs gap) |
| 4 | F-CT-03 | LOW | Legacy two-call gate pattern in 8+ tools (deferred-known per ADR-0204 §SS-4) | capability-tools | ADR-0204 §SS-4 |
| 5 | F-EF-02 | LOW | ADR-0163 Layer 1 silence for `engine-dispatch` ad-hoc agent-router paths (known gap, follow-up filed) | edge-functions | ADR-0163 |

## Delta vs 2026-05-15

- **New CRITICAL:** 0
- **New HIGH:** 0 (F-CT-01 is the same SS-5 backlog flagged in 2026-05-15)
- **Regressed:** 0
- **Closed:** 4 (F-DB-14, F-DB-20, F-DB-21, F-DB-22 — WITH CHECK sweep migrations confirmed in production DB)
- **Unchanged open:** F-CT-01 (HIGH, SS-5), F-CT-03 (LOW), F-EF-02 (LOW)

## Coverage

- Slices run: 01-capability-tools, 03-edge-functions, 07-db-rls-telemetry
- Slices deferred (smoke mode): 02 stage-engine-bff, 04 schedule-cascade, 05 mobile-surface, 06 contracts-payroll-lovsen, 08 journeys, 09 adr-coverage-gaps, 10 onboarding-wizard, 11 performance-design, 12 i18n-frontmatter, 13 webhook-integration, 14 missions-e2e
- Files newly covered: `timeline_template` migration + seed, 4 capability tools, 3 BFF routes, 5 telemetry events

## Promote-preview implication

Audit gates **PASS for timeline-templates shipment.** No code-side blockers. Preview-promotion blocker remains GitHub Actions budget exhaustion (separate from this audit) — `gh run list --branch development --limit 5` shows all CI failed with "Actions budget preventing further use". Resolve billing before HOP A.

## Reports

- [01-capability-tools.md](01-capability-tools.md)
- [03-edge-functions.md](03-edge-functions.md)
- [07-db-rls-telemetry.md](07-db-rls-telemetry.md)
