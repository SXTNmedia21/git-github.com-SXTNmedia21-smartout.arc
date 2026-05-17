---
title: "Handoff — lovsen-phase-7b-lovdata-mcp"
feature: lovsen-phase-7b-lovdata-mcp
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [handoff, payroll, lovsen, lovdata, mcp, taro, riksavtalen, phase-7]
---

# Handoff — lovsen-phase-7b-lovdata-mcp

## Summary

Phase 7b ships the MCP infrastructure layer for live Lovdata access: `fetch_riksavtalen_paragraph` + mirrored `verify_citation_freshness` on lovdata-mcp, extracted `lovsen-shared` helper package (consumed by both MCPs), and envvar canonicalization — resolving trust-gate blockers 1, 4, and 5 from the Phase 7a council verdict. lovdata-mcp finishes at 58/58 pytest green; nho-reiseliv verify pytest remains at 10/10 with no regression.

## Decisions made

| Decision | Rationale | ADR |
|---|---|---|
| `lovsen_shared/` package directory — NOT `src/` | Each MCP service already has its own `src/` package directory on `sys.path`; using `src/` for the shared package would cause import shadowing between sibling services. Package directory name matches the Python package name (`lovsen_shared`) to avoid any ambiguity. | — |
| TARO URL path separate from NL statute path | Riksavtalen lives under a different TARO base URL than NL (Norsk Lovtidend) statutes. Overloading `fetch_paragraph` would require conditional URL dispatch and break the ADR-0258 contract that `version` is always required; a distinct tool is cleaner. | ADR-0258 |
| Fixture rate 15,65 kr/t preserved (NOT 42,41) | Lovdata base text for Riksavtalen §4-3 reads 15,65 kr/t. The 42,41 figure in the worksheet is unverified and may reflect a later tariff period or a separate supplement calculation. Using the verbatim Lovdata text prevents fabrication; task #63 carries the verification. | — |
| `source` discriminator on `FreshnessResult` | Coordinator review identified the need to distinguish NHO-routed vs Lovdata-routed freshness results at the CI aggregation layer. Added `source: 'lovdata' \| 'nho-reiseliv'` field. Cell schema (16 fields) unchanged. | ADR-0256 |
| `LOVSEN_FIXTURE_MODE` as primary, `LOVSEN_MCP_FIXTURE` backwards-compat alias | Standardizes envvar naming across all Lovsen MCPs; existing deployments using the old name continue to work without changes. | — |

## Learnings discovered

### L-NEW — Python `src/` namespace collision in sibling MCP packages

When two sibling Python packages each contain a `src/` directory and both are added to `sys.path` (e.g. via editable install or `sys.path.insert`), imports from one package's `src/` can shadow or be shadowed by the other. The symptom is a seemingly correct import resolving to the wrong module, with no error at import time — only wrong behavior.

**Fix:** Name the shared package directory to match the Python package name (`lovsen_shared/`) rather than using the generic `src/` convention. This makes the package importable as `from lovsen_shared import ...` without path manipulation, and avoids all shadowing.

**Class:** import namespace collision — applicable to any monorepo with multiple Python services in `services/`.

### L-NEW — MCP venv vs system Python pytest divergence

Running `pytest` from the worktree root using system `python3` reported 27 failures for lovdata-mcp (bs4 not found). The same tests ran 58/58 green when invoked via `.venv/bin/python -m pytest` inside the MCP directory. System Python lacks packages installed into the MCP's `.venv`.

**Fix:** Always run MCP pytest via `.venv/bin/python -m pytest` (or activate the venv first). The false-failure count from system Python is not the true test state.

**Class:** environment isolation — same class as L-stale-telemetry-dist (wrong runtime context → misleading error).

## Known issues / debt

| Issue | Severity | Owner |
|---|---|---|
| Task #63 — rate verification open: 42,41 kr/t (worksheet) vs 15,65 kr/t (Lovdata base) unresolved | High — blocks Phase 7c full correctness | Lovsen |
| 6 `PENDING-LOVSEN-MAP` rows in `riksavtalen-paragraph-mapping.md` | High — blocks Phase 7c re-cert for those paragraphs | Lovsen |
| 358 cells stamped `lovsen-mcp@v1` (NHO-routed) await re-cert in Phase 7c | Medium — legacy cells not yet Lovdata-verified | Phase 7c sortie |

## Next steps

Phase 7c sortie — re-cert tool that:

1. Reads `riksavtalen-paragraph-mapping.md` to resolve `paragrafRef` → TARO ID + paragraph + version
2. Calls `lovdata-mcp.fetch_riksavtalen_paragraph` per resolved cell
3. Populates citation envelope fields per ADR-0256 (and ADR-0348 if adopted)
4. Stamps `verifiedBy: "lovsen-mcp@v1-lovdata"` + `verifiedAt: ISO`
5. Updates expected/*.json golden files

**Gate before Phase 7c sortie starts:** trust-gate blockers #2 (rate, task #63) and #3 (map rows) must be resolved by Lovsen. Phase 7c is blocked until then.
