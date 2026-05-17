---
title: "Plan — lovsen-phase-7a-adrs"
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [plan, payroll, lovsen, adr, phase-7, riksavtalen, lovdata, council]
---

# Plan — lovsen-phase-7a-adrs

> Branch: `feat/payroll-lovsen-phase-7a-adrs` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll` | Module: payroll | Started: 2026-05-17

## Goal

Ship all council-derived documentation deliverables for Phase 7a: 3 new ADRs (0347/0348/0349), amendment to ADR-0342, council audit log, 3 learnings, and the Riksavtalen paragraph translation map — establishing the complete ADR foundation before any code lands in Phase 7b.

## Tasks

### Track A1 — Lovdata canonical source ADR

- [x] Draft `docs/decisions/0347-lovdata-canonical-source-for-riksavtalen.md` (135 lines)
  - Lovdata MCP becomes Riksavtalen canonical source
  - NHO MCP repurposed to non-rate fact-finding only
  - Amends ADR-0258 + ADR-0342
  - Registered in decision log

### Track A2 — Two-hash citation model ADR

- [x] Draft `docs/decisions/0348-two-hash-model-for-citation-envelopes.md` (173 lines)
  - `structureHash` + `rateHash` supersedes ADR-0341 §H single-hash model
  - Enables independent invalidation of structure vs rate content
  - Registered in decision log

### Track A3 — Paragraph-ref translation map ADR + reference file

- [x] Draft `docs/decisions/0349-paragraph-ref-translation-map.md` (105 lines)
  - Defines shorthand→canonical §-ref mapping governance
  - References `docs/reference/riksavtalen-paragraph-mapping.md`
  - Registered in decision log
- [x] Create `docs/reference/riksavtalen-paragraph-mapping.md` (66 lines)
  - 7 rows: 1 LOVSEN-VERIFIED + 6 PENDING-LOVSEN-MAP
  - Supplement types: kveldstillegg, nattillegg (categories A/B/C), helgetillegg, helligdagstillegg

### Track A4 — Council audit, learnings, ADR amendment

- [x] Create `docs/audits/2026-05-17-phase-7-lovdata-reframe-council.md` (163 lines)
  - 4 reviewers: system-steward (chair), system-agent-coordinator, supervisor, lovsen
  - Verdict: APPROVE WITH CHANGES + 5-blocker trust gate
  - Chair Phase 3 SELF-REVERSAL on Q2 (no new schema field — ZERO capability consumers confirmed)
- [x] Append council session to council log
- [x] Create `docs/learnings/L-0286-*.md` (47 lines) — MCP routing identity drift
- [x] Create `docs/learnings/L-0287-*.md` (55 lines) — Council chair self-reversal pattern
- [x] Create `docs/learnings/L-0288-*.md` (53 lines) — Schema field demand-proof gate
- [x] Amend `docs/decisions/0342-*.md` with 2026-05-17 amendment section (NHO→Lovdata routing history)

### Track A5 — Closure docs (this sortie)

- [x] Update `docs/plans/PLAN-lovsen-phase-7a-adrs.md` → status: done
- [x] Create `docs/journeys/JOURNEY-lovsen-phase-7a-adrs.md`
- [x] Create `docs/handoffs/HANDOFF-lovsen-phase-7a-adrs.md`

## Acceptance Criteria

- [x] 3 ADRs proposed: 0347, 0348, 0349
- [x] Council audit log appended (2026-05-17 session)
- [x] 3 learnings created: L-0286, L-0287, L-0288
- [x] ADR-0342 amended with 2026-05-17 routing history
- [x] Translation map drafted (7 rows, 1 LOVSEN-VERIFIED, 6 PENDING)
- [x] Decision log updated with 3 new rows
- [x] Typecheck passes — no code touched; should pass clean
- [x] User journeys written (JOURNEY-lovsen-phase-7a-adrs.md)
- [x] Handoff written (HANDOFF-lovsen-phase-7a-adrs.md)

## Out of Scope

- **Phase 7b (code):** lovdata-mcp envvar canonicalization, shared helper extraction, `fetch_riksavtalen_paragraph` tool, `verify_citation_freshness` mirror with source-discriminator, 4-path pytest suite
- **Phase 7c (data):** re-certification of 358 cells stamped `lovsen-mcp@v1` via NHO routing
- **Lovsen rate-verification (task #63):** 42.41 kr/t kveldstillegg vs 2026 lønnsoppgjør protokoll

## 5 Trust-Gate Blockers (tracked — belong to Phase 7b/c)

1. Live curl proof: Lovdata TARO URL returns 200 + parseable (Phase 7b)
2. Lovsen rate-verification: 42.41 kr/t vs NHO 2026 lønnsoppgjør protokoll (task #63)
3. ADR-0349 translation map: remaining 6 PENDING rows verified by Lovsen
4. lovdata-mcp envvar canonicalization (Phase 7b)
5. `verify_citation_freshness` mirror on lovdata-mcp with 4-path pytest (Phase 7b)
