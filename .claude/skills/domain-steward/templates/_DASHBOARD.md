---
title: "Domains — Status Dashboard"
status: in_progress
updated: {YYYY-MM-DD}
created: {YYYY-MM-DD}
domain: _index
tags: [domain, dashboard, status, source-of-truth]
---

# Domains — Status Dashboard

> Honest map of every domain. Maintained by `domain-steward`. NOT git-state (see `docs/DASHBOARD.md` for that, ADR-0075).
> Legend: ✅ done · 🟡 partial · 🔴 not built · — n/a

## Domains
| Domain | Spine | Build state | Tested | mirror | last_verified | Open gaps |
|---|---|---|---|---|---|---|
| [billing](./billing/) | 8/8 | 🟡 | 🟡 | mixed | {date} | {n} |
| [daytimeline](./daytimeline/) | 8/8 | 🟡 | 🟡 | mixed | {date} | {n} |
| {…} | | | | | | |

## Overlap edges (consolidate / split watch)
| Domain A | Domain B | Shared surface | Recommendation | Status |
|---|---|---|---|---|
| daytimeline | procedure-engine | session_task / day_line / D6 | {consolidate/split/keep} | open |

## Migration backlog (pre-domain sources to absorb)
| Legacy source | → Domain | Done? |
|---|---|---|
| `docs/architecture/modules/SMARTOUT_MODULE_*` | various | 🔴 |
| `docs/modules/MODULE_*.md` (flat) | billing/communication/contracts/year-wheel | 🔴 |
