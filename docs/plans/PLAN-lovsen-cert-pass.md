---
title: "Plan — lovsen-cert-pass"
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [plan, lovsen, mcp, payroll, adr-0342]
---

# Plan — lovsen-cert-pass

> Branch: `feat/payroll-lovsen-cert-pass` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll` | Module: payroll | Started: 2026-05-17 | Closed: 2026-05-17

## Goal

Implement ADR-0342 `verify_citation_freshness` MCP tool + run authority-cert pass (358 PENDING_LOVSEN_CERTIFY → `lovsen-mcp@v1`) across golden-month fixture envelope so ADR-0341 §F6 stale-detection gate becomes operative.

## Tasks

- [x] **T1** — Add `verify_citation_freshness` to NHO Reiseliv MCP (Python stdio handler, fixture-mode deterministic, telemetry stub)
- [x] **T3** — Verify `lovsen.citation.stale` telemetry payload shape (read-only audit; found FAIL)
- [x] **T3.5** — Fix telemetry registry: rename `paragraph` → `paragraph_ref`, ADD `hash` field
- [x] **T3.6** — Update dependent test fixture `lovsen-events.test.ts` to new shape
- [x] **T2** — Resolve envvar drift `LOVSEN_FIXTURE_MODE` (canonical per ADR-0258) + backwards-compat for `LOVSEN_MCP_FIXTURE`
- [x] **T4** — Write pytest 4-path coverage for verify (10 tests, 10 green)
- [DEFERRED] **T5** — Wire `pnpm test:golden-month` to call MCP via stdio (option C chosen — defer Python-from-vitest to separate sortie)
- [x] **T6** — Cert pass: 358 substitutions (verifiedBy + verifiedAt) across 4 expected/*.json files
- [x] **T7** — Closure docs (this PLAN + JOURNEY + HANDOFF)
- [DEFERRED to Phase 7] — Real Lovsen MCP fetch for citation envelope (716 PENDING markers remain in `lovsenCitationHash/Text/Url/FetchedAt` per Pontus decision B — requires real nhoreiseliv.no fetch)

## Acceptance Criteria

- [x] Typecheck passes (focused: telemetry + payroll-calculate green; full-repo turbo had unrelated web#typecheck SIGTERM 143 — pre-existing or OOM, not introduced by this sortie)
- [x] 240/240 golden-month tests green after cert pass
- [x] 60/62 NHO Reiseliv MCP pytest (50 existing + 10 new; 2 pre-existing kveldstillegg-rate failures unrelated)
- [x] 48/48 telemetry vitest green after T3.5 + T3.6
- [x] Decision log: ADR-0342 already accepted; no new ADRs needed (single-MCP V1 routing finding documented in HANDOFF as ADR-0342 addendum candidate)
- [x] User journey written (JOURNEY-payroll-lovsen-cert-pass.md, 2 journeys)
- [x] HANDOFF written (HANDOFF-payroll-lovsen-cert-pass.md, 4 decisions + 4 learnings + Phase 7 next-steps)

## Out of scope (deferred)

- T5 wire (vitest → MCP stdio call) — separate sortie, option B (thin Python CLI wrapper) recommended
- Phase 7 real-fetch — 716 PENDING markers in citation envelope; requires nhoreiseliv.no scraping infra
- Lovdata MCP `verify_citation_freshness` parity — out of scope; first non-Riksavtalen cell will trigger
- ADR-0342 addendum documenting single-MCP V1 routing (locked 16-field schema has no `source` field) — write at Phase 7 sortie kickoff

## Scope boundary — what V1 cert pass IS and IS NOT

**IS:** Authority cert (`verifiedBy: "lovsen-mcp@v1"`, `verifiedAt: ISO`). Each cell now bears Lovsen-authority signature.

**IS NOT:** Citation envelope cert (`lovsenCitationHash/Text/Url/FetchedAt`). Those fields still hold `PENDING_LOVSEN_CERTIFY` and await Phase 7 real fetch — ADR-0256 mandates `hash = SHA256(verbatim text)` which can't be sed-replaced.
