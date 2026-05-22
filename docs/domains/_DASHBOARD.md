---
title: "Domains — Status Dashboard"
status: in_progress
updated: 2026-05-22
created: 2026-05-22
domain: _index
tags: [domain, dashboard, status, source-of-truth]
---

# Domains — Status Dashboard

> Honest map of every domain. Maintained by `domain-steward`. NOT git-state (see `docs/DASHBOARD.md` for that, ADR-0075).
> Legend: ✅ done · 🟡 partial · 🔴 not built · — n/a

## Domains

| Domain | Spine | Build state | Tested | mirror | last_verified | Open gaps |
|---|---|---|---|---|---|---|
| [billing](./billing/) | 8/8 | 🟡 partial (Fase 1-3B built; peppol adapter + auto-dunning live + PlatformAdminToolContext missing) | 🟡 partial (schema pgTAP + Vitest strong; Playwright weak) | mixed | 2026-05-22 | 9 |

## Overlap edges (consolidate / split watch)

| Domain A | Domain B | Shared surface | Recommendation | Status |
|---|---|---|---|---|
| billing | settlement (future domain) | `billing.settlement_period`, `billing.settlement_run`, `billing.settlement_artifact` — workspace-internal cash/revenue reconciliation | **split** — create `docs/domains/settlement/` when settlement gets feature investment; these are a different concept from Smartout billing its customers | open |
| billing | accountant-portal (future) | `billing.accountant_company_grant` | **keep** for now — promote to own domain when ADR-0269 is accepted + portal UI grows | open |

## Migration backlog (pre-domain sources to absorb)

| Legacy source | → Domain | Done? |
|---|---|---|
| `docs/modules/MODULE_BILLING.md` | billing | ✅ absorbed + archived (2026-05-22) |
| `docs/architecture/modules/SMARTOUT_MODULE_*` | various | 🔴 pending |
| `docs/modules/MODULE_*.md` (flat, non-billing) | communication / contracts / year-wheel / etc. | 🔴 pending |
