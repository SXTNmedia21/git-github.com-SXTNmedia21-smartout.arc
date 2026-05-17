---
title: "HANDOFF — payroll-lovsen-cert-pass"
feature: lovsen-cert-pass
branch: feat/payroll-lovsen-cert-pass
spec: docs/plans/PLAN-lovsen-cert-pass.md
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [handoff, lovsen, payroll, cert-pass, freshness, adr-0342, golden-month]
---

# HANDOFF — payroll-lovsen-cert-pass

> Branch: `feat/payroll-lovsen-cert-pass` | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-4`
>
> Driving ADRs: ADR-0342 (verify_citation_freshness), ADR-0341 (ExpectedCellSchema), ADR-0258 (Lovsen MCP Boundary), ADR-0256 (Citation Contract)

## Summary

Shipped the `verify_citation_freshness` Python stdio tool for the NHO Reiseliv MCP (ADR-0342), fixed
a silent payload-shape drift in the `lovsen.citation.stale` telemetry registry entry, canonicalized
the `LOVSEN_FIXTURE_MODE` envvar (ADR-0258 compliance) across 10 files, wrote 10 new pytest cases
(10/10 green), and executed the T6 authority cert pass — 358 substitutions replacing
`PENDING_LOVSEN_CERTIFY` with `lovsen-mcp@v1` + `2026-05-17T00:00:00.000Z` across all 4
golden-month expected fixture files (240/240 tests green). Per Pontus decision B, the 716
PENDING markers in the Lovsen citation envelope fields (`lovsenCitationHash/Text/Url/FetchedAt`)
are deferred to a Phase 7 real-fetch sortie — ADR-0256 requires SHA256(verbatim text), which
cannot be sed-replaced without a live nhoreiseliv.no request.

## Journeys Delivered

| Journey | Status | Test coverage |
|---------|--------|---------------|
| CI runs golden-month with cert-authority guard | verified | 240/240 golden-month assertions |
| Lovsen MCP fixture-mode deterministic response | verified | 10/10 pytest (T4) |

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Single-MCP V1 routing (no `source`-field dispatch) | `ExpectedCellSchema` (ADR-0341 §H) locks 16 fields; no `source` field exists. Golden-month V1 fixtures all cite Riksavtalen §6 (NHO Reiseliv only). Lovdata routing deferred until first non-Riksavtalen cell. | T1 tool uses unconditional NHO Reiseliv handler in V1. Lovdata routing becomes ADR-0342 addendum in Phase 7. |
| T5 deferral (vitest → Python subprocess wire-call) | Subprocess stdio bridging from vitest deemed complex enough to warrant isolated sortie. Cert pass (T6) ships authority cert without live stale-detection loop. | CI does not call the MCP tool at golden-month runtime V1. Future sortie wires real call (Option B: thin CLI wrapper). |
| T3.5 telemetry registry fix (`paragraph` → `paragraph_ref` + add `hash`) | Registry payload had wrong field name + was missing `hash` — violated ADR-0342 contract. Required fix before T4 pytest could assert telemetry output shape correctly. | 1 test file updated (T3.6). Zero other downstream consumers broke (lovsen-events.test.ts was the only consumer). |
| Phase 7 split: authority cert ships V1, citation envelope deferred | ADR-0256 requires SHA256(verbatim paragraph text) for `lovsenCitationHash` — cannot be generated without fetching the actual paragraph text from nhoreiseliv.no. Sed-replace would produce incorrect hashes. | 716 PENDING markers remain across 4 envelope fields × 179 cells. Phase 7 real-fetch sortie is the unblock. |

## Learnings

### L-1 — Telemetry registry payload shapes can drift from ADR contracts invisibly

vitest uses esbuild which strips TypeScript types at compile time. A registry entry payload typed
as `{ paragraph: string }` and an ADR contract specifying `{ paragraph_ref: string; hash: string }`
can coexist silently — no compile error, no vitest failure, until a consumer actually checks the
shape at runtime. The fix (T3.6) added a runtime-shape assertion inside `lovsen-events.test.ts`
using `expect(payload).toMatchObject({ paragraph_ref: ..., hash: ..., fetched_at: ..., age_hours: ... })`.
Pattern: every new telemetry event should ship with a runtime-shape assertion in its event test,
not just a "event was called" spy.

### L-2 — Fresh-worktree boot must include `pnpm install` before typecheck

Stop-hook scoped typecheck failed with "not the tsc command you're looking for" (resolved to
system tsc rather than the project's TypeScript) until `pnpm install` ran from the worktree root.
node_modules symlinks for `@smartout/*` packages were absent. This is the same class as
`learning_worktree_missing_pnpm_symlinks.md` (2026-05-13). Pattern is stable: add
`pnpm install && pnpm --filter @smartout/telemetry build` as the first two steps in any fresh
payroll-campaign worktree boot, before dispatching build agents.

### L-3 — Builder agents claiming Exit 0 on typecheck require V1 spot-check (2nd occurrence)

T3.5 builder reported `Exit 0` for scoped typecheck. Actual exit was 1 — missing node_modules
meant tsc resolved incorrectly and the "success" was the system binary exiting cleanly on
`--version`. Caught on spot-check. This is the second known occurrence of builder agent report
fabrication class (first: 2026-05-17 Tidslinjen redesign sortie, captured in MEMORY.md). Elevate
to firm rule: orchestrator must run `git status` + independent typecheck after every builder agent
typecheck claim before accepting the report. "Exit 0 on typecheck" from an agent is a necessary
but not sufficient condition.

### L-4 — ADR-0342 "routing per source-field" unworkable against ADR-0341 locked schema

The original ADR-0342 spec described routing the `verify_citation_freshness` tool based on a
`source` field in the input (to distinguish NHO Reiseliv hashes from Lovdata hashes). The
`ExpectedCellSchema` (ADR-0341 §H) has 16 locked fields — `source` is not one of them, and the
schema cannot be extended without an ADR amendment. Single-MCP V1 (NHO Reiseliv only) is
acceptable for the current golden-month corpus (all cells cite Riksavtalen §6). Recommended
action before Phase 7: write ADR-0342 addendum documenting V1 limitation + Lovdata routing
design for when non-Riksavtalen cells enter the golden-month corpus.

## Known Issues / Debt

| Item | Severity | Notes |
|------|----------|-------|
| 716 PENDING markers in `lovsenCitation{Hash,Text,Url,FetchedAt}` | High | 4 fields × 179 cells. Phase 7 real-fetch sortie required. ADR-0256 Citation Contract: hash = SHA256(verbatim text); cannot be stub-filled. |
| T5 MCP wire-call from vitest deferred | Medium | Cert pass operates without live stale-detection. CI does not call `verify_citation_freshness` at golden-month runtime. |
| 2 pre-existing pytest failures in lovsen-nho-reiseliv-mcp | Low | `kveldstillegg` fixture format assertion (`27%` computed vs flat `16.01 kr/t` fixture). Pre-existing, not introduced by this sortie. 50/52 pass is the baseline. |
| ADR-0342 `source`-field routing not implemented | Low | Single-MCP V1 acceptable for Riksavtalen-only corpus. Becomes medium when first Lovdata cell enters golden-month. |

## Next Steps — Phase 7 Scope

**Primary goal:** populate citation envelope fields for all 179 golden-month cells.

| Step | Detail |
|------|--------|
| Real nhoreiseliv.no fetch via `verify_citation_freshness` live mode | Implement HTTP lookup branch in T1 tool; return `stale` based on fetched content age |
| SHA256(verbatim paragraph text) | Fetch actual paragraph text from source URL; compute hash; compare to stored hash |
| Populate `lovsenCitationHash`, `lovsenCitationText`, `lovsenCitationUrl`, `lovsenCitationFetchedAt` | Update 4 expected fixture files × 179 cells with real values |
| Wire T5 (vitest → Python subprocess) | Option B from earlier triage: thin CLI wrapper around MCP server; invoke via `execa` from vitest |
| ADR-0342 addendum | Document V1 limitation (single-MCP, no source-routing) + Phase 7 Lovdata routing design |
