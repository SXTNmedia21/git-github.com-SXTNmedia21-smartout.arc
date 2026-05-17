---
title: "Plan — lovsen-phase-7b-lovdata-mcp"
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [plan, payroll, lovsen, lovdata, mcp, taro, riksavtalen, phase-7]
---

# Plan — lovsen-phase-7b-lovdata-mcp

> Branch: `feat/payroll-lovsen-phase-7b-lovdata-mcp` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-5 | Base: `campaign/payroll` | Module: payroll | Started: 2026-05-17

## Goal

Ship MCP infrastructure for live Lovdata access: TARO paragraph fetch + citation freshness verification on lovdata-mcp, extracted shared helper package, and envvar canonicalization — unblocking trust-gate blockers 1, 4, and 5 from the Phase 7a council verdict.

## Tasks

### B1 — Live-curl proof TARO URL (trust-gate blocker 1)
- [x] Curl TARO base URL to prove live connectivity
- [x] Document proof in `docs/audits/2026-05-17-lovdata-taro-live-proof.md` (89 lines)
- [x] Trust-gate blocker 1 RESOLVED

### B2 — lovdata-mcp envvar canonicalization (trust-gate blocker 4)
- [x] Make `LOVSEN_FIXTURE_MODE` primary envvar
- [x] Keep `LOVSEN_MCP_FIXTURE` as backwards-compat alias
- [x] Update 8 files (src + tests + README + pyproject)
- [x] Trust-gate blocker 4 RESOLVED

### B3 — `services/lovsen-shared/` NEW shared package
- [x] Create `lovsen_shared/` Python package (not `src/` — avoids namespace collision)
- [x] Implement `FreshnessResult` TypedDict
- [x] Implement `validate_hashes` helper
- [x] Implement `emit_stale_event_stderr` helper
- [x] Refactor `nho-reiseliv` MCP to consume shared package (244 → 189 lines)
- [x] All 10/10 nho-reiseliv pytest green (no regression)

### B4 — `fetch_riksavtalen_paragraph` tool on lovdata-mcp
- [x] Implement separate TARO URL builder (distinct from NL statute path)
- [x] Implement `fetch_riksavtalen_paragraph(taro_id, paragraph, version, ledd?)` tool
- [x] Version required — no default (per ADR-0258)
- [x] 6 new pytest written + passing
- [x] Fixture `riksavtalen_taro-79_2024-2026_4-3.json` with verbatim text ("kveldstillegg på kr 15,65 pr. time...")
- [x] Note: 15,65 kr/t = Lovdata base rate; 42.41 from worksheet remains unverified (task #63 open)

### B5 — Mirror `verify_citation_freshness` on lovdata-mcp (trust-gate blocker 5)
- [x] Implement `verify_citation_freshness` tool mirroring nho-reiseliv interface
- [x] Add `_SOURCE = "lovdata"` discriminator
- [x] 10 new pytest mirroring nho-reiseliv pattern
- [x] Wire to server
- [x] Trust-gate blocker 5 RESOLVED

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck`
- [x] lovdata-mcp: 58/58 pytest green
- [x] nho-reiseliv: 10/10 verify pytest green (no regression)
- [x] Trust-gate blocker 1 RESOLVED — live-curl proof in audit doc
- [x] Trust-gate blocker 4 RESOLVED — envvar canonicalization shipped
- [x] Trust-gate blocker 5 RESOLVED — verify_citation_freshness mirror live on lovdata-mcp
- [x] Decision log updated
- [x] User journeys written

## Remaining trust-gate blockers (post-7b)

After Phase 7b ship, two blockers remain from the Phase 7a council verdict:

| Blocker | Description | Unblocked by |
|---|---|---|
| #2 | Rate verification — 42.41 kr/t (worksheet) vs 15,65 kr/t (Lovdata base) unresolved | Task #63 — Lovsen verifies |
| #3 | 6 `PENDING-LOVSEN-MAP` rows in riksavtalen-paragraph-mapping.md await Lovsen | Lovsen completes map |

Blockers 1, 4, 5 are RESOLVED. Phase 7c sortie can begin once 2 + 3 are resolved.
