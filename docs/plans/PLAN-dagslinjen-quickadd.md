---
title: "Plan — dagslinjen-quickadd"
feature: dagslinjen-quickadd
spec: docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md
status: draft
updated: 2026-05-15
created: 2026-05-15
module: MODULE_COMMUNICATION
tags: [plan]
---

# Plan — dagslinjen-quickadd

> Branch: `feat/dagslinjen-quickadd` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4` | Base: `development` | Module: MODULE_COMMUNICATION

**Spec:** [Dagslinjen QuickAdd — Slot-popover, filter, targeted note fanout](../superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md)

## Journeys (the contract)

- [JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot](../journeys/JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot.md) — Manager click time on strip → popover → create booking/note/task/deviation/shift-start prefilled with time
- [JOURNEY-dagslinjen-quickadd-manager-filter-timeline](../journeys/JOURNEY-dagslinjen-quickadd-manager-filter-timeline.md) — Manager filter dagslinje by avdeling / team / vakt
- [JOURNEY-dagslinjen-quickadd-manager-target-note-fanout](../journeys/JOURNEY-dagslinjen-quickadd-manager-target-note-fanout.md) — Manager creates note with audience + notify_at; system schedules fanout
- [JOURNEY-dagslinjen-quickadd-employee-receives-targeted-note](../journeys/JOURNEY-dagslinjen-quickadd-employee-receives-targeted-note.md) — Employee on resolved audience receives push at notify_at

## Goal

Turn Dagslinjen from read-only timeline into authoring surface: click-to-create at any slot, filter by avdeling/team/vakt, targeted scheduled note fanout end-to-end.

## Tracks (parallel agent assignments)

- [ ] **Track A — Schema + Migration** (sonnet, build agent, smartout-database-guide skill)
- [ ] **Track B — Architecture Spec Fill-in** (opus, code-architect)
- [ ] **Track C — Slot Popover + Quickadd UI** (sonnet, frontend-designer)
- [ ] **Track D — Filter Hook + UI** (sonnet, build agent)
- [ ] **Track E — Targeted Note Writer** (sonnet, build agent)
- [ ] **Track F — Scheduled Fanout Engine Process** (sonnet, system-agent-coordinator)
- [ ] **Track G — E2E Tests** (sonnet, protocol-writer)
- [ ] **Track H — Review + Verification Gate** (opus, system-steward)

## Dependencies

```
B (spec fill-in) ─┬─→ A (schema) ─→ E (note writer) ─→ F (fanout engine)
                  ├─→ C (popover)
                  └─→ D (filter)
                                    ↓
                          G (E2E) ←── all above
                                    ↓
                          H (review) ←─────
```

## Review gates

- **Gate 1 (after B):** AI Council — audience model (JSONB vs junction)
- **Gate 2 (after A+E):** ADR-contract-audit smoke
- **Gate 3 (after C+D):** Manual UI verification in browser
- **Gate 4 (after F):** End-to-end fanout test (notify_at=now+30s)
- **Gate 5 (after G+H):** All 4 journeys verified, typecheck green, ADRs registered

## Risks + unknowns

- **R1:** Audience JSONB vs junction — RLS + query-perf tradeoff. Council.
- **R2:** Cross-dept targeting authority — C4 gate, not yet specced. Council.
- **R3:** Scheduler cadence — pg_cron / Edge cron / n8n. Council.
- **R4:** Notification dedup + retry storms — `delivered_at` idempotency.
- **R5:** Mobile receive surface — does existing push handle scheduled notes?

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] 3 ADRs registered in `docs/decisions/0000-decision-log.md`
- [ ] All 4 journeys have E2E specs at `apps/web/e2e/dagslinjen-quickadd/`
- [ ] Smoke audit passes (`/audit smoke`)
- [ ] HANDOFF written at closure
