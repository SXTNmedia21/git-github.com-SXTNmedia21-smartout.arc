---
title: "Plan — lovsen-phase-7c-prep"
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [plan, payroll, lovsen, riksavtalen, rate-verification]
---

# Plan — lovsen-phase-7c-prep

> Branch: `feat/payroll-lovsen-phase-7c-prep` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll` | Module: payroll | Started: 2026-05-17

## Goal

Resolve Phase 7c trust-gate blockers 2 and 3 via WebFetch — verify the Riksavtalen paragraph-mapping translation map (6 PENDING-LOVSEN-MAP rows) and confirm worksheet supplement rates against Lovdata + NHO Reiseliv published satser.

## Tasks

- [x] C1 — Resolve translation map 6 PENDING-LOVSEN-MAP rows via Lovdata WebFetch
- [x] C2 — Rate verification: 42.41 kr/t vs NHO 2026 lønnsoppgjør / Fellesforbundet PDF satser
- [x] Council 2026-05-17 — Phase 7 architectural pivot review (APPROVE WITH CHANGES; Phase 7d sortie follows)

## Acceptance Criteria

- [x] Translation map 6/6 LOVSEN-VERIFIED — all rows resolved with canonical paragraph refs (taro-79 §3-3, §4-2, §4-3, §4-3.3.1, §4-4, §4-5)
- [x] Rate verification audit doc shipped (`docs/audits/2026-05-17-nho-reiseliv-rate-verification.md`) — 110 lines, 3/6 confirmed, 2/6 mislabeled, 1/6 wrong type
- [x] Council triggered and concluded — APPROVE WITH CHANGES on dynamic-MCP-fetch pivot (6th L-0147 chair self-reversal noted)
- [⚠] Phase 7c cell migration DEFERRED — findings reveal architectural pivot needed before migrating 358 stamped cert-cells

## Out of Scope

- ADR drafting (ADRs 0350–0354 belong to Phase 7d)
- Schema migration (active_union column, workspace_framework_binding table, tariff_snapshot table)
- Worksheet correction (depends on Phase 7d authority decisions)
- Phase 7c cell migration (deferred pending Phase 7d ADR foundations)

## Trust-Gate Outcome

| Blocker | Result |
|---------|--------|
| Blocker 2 — Rate verification | PARTIAL — 3/6 confirmed, 2/6 label-swapped, 1/6 wrong type |
| Blocker 3 — Translation map | RESOLVED — 6/6 LOVSEN-VERIFIED |
