---
title: "Journey — lovsen-phase-7b-lovdata-mcp"
feature: lovsen-phase-7b-lovdata-mcp
journey: phase-7b-lovdata-mcp
status: verified
verified_at: 2026-05-17
e2e_test: null
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [journey, payroll, lovsen, lovdata, mcp, taro, riksavtalen, phase-7]
---

# Journey — lovsen-phase-7b-lovdata-mcp

## Journey 1 — Phase 7c re-cert tool fetches Riksavtalen paragraph from Lovdata

**Precondition:** Phase 7b shipped — `fetch_riksavtalen_paragraph` + mirrored `verify_citation_freshness` are live on lovdata-mcp. `riksavtalen-paragraph-mapping.md` has at least the verified rows (blockers #2 and #3 resolved before Phase 7c sortie starts). Re-cert tool has lovdata-mcp client wired.

1. Re-cert tool reads a worksheet cell's `paragrafRef` field (e.g. `"Riksavtalen §6"`) → System looks up the canonical paragraph identifier in `docs/reference/riksavtalen-paragraph-mapping.md`
2. Map returns canonical ref (e.g. `"§4-3"`) for the kveldstillegg row → Re-cert tool resolves TARO ID (`taro-79`), paragraph (`§4-3`), and version (`2024-2026`) from the map row
3. Re-cert tool calls `lovdata-mcp.fetch_riksavtalen_paragraph(taro_id="taro-79", paragraph="§4-3", version="2024-2026")` → System returns ADR-0256 Citation envelope: `verbatim_text`, `hash`, `fetched_at`, `source_url`
4. Re-cert tool populates cell fields: `lovsenCitationHash`, `lovsenCitationText`, `lovsenCitationUrl`, `lovsenCitationFetchedAt` (or new 2-hash fields per ADR-0348 if adopted before Phase 7c) → Cell schema updated in expected/*.json
5. Re-cert tool writes `verifiedBy: "lovsen-mcp@v1-lovdata"` and `verifiedAt: <ISO timestamp>` on the cell → Cell is stamped as Lovdata-routed, distinct from legacy NHO-routed cells (`lovsen-mcp@v1`)
6. Golden-month CI re-runs → All Lovdata-stamped cells pass citation hash verification → Green

**Postcondition:** Cell has a live-verified Lovdata-sourced citation envelope. `verifiedBy` discriminator distinguishes it from legacy NHO-routed cells.

**Error paths:**
- `paragrafRef` not found in map → CI fails with `golden-month.paragrafref_map_missing`; Lovsen adds missing row before next run
- `fetch_riksavtalen_paragraph` raises (network down, TARO unreachable) → Re-cert tool catches, logs, retries with backoff; if persists beyond retry budget, escalates to Pontus as manual blocker
- Hash mismatch on re-cert (Lovdata source text changed) → `verify_citation_freshness` returns `stale: true`; cell flagged for manual review; `emit_stale_event_stderr` fires to CI log

---

## Journey 2 — CI runs golden-month with stale-detection across both MCPs

**Precondition:** Phase 7c migration partial — some cells are stamped `verifiedBy: "lovsen-mcp@v1"` (NHO-routed, legacy), others stamped `verifiedBy: "lovsen-mcp@v1-lovdata"` (post-Phase 7c Lovdata-routed). Both MCP servers are running. `FreshnessResult.source` discriminator is present on all results.

1. CI loads all cell hashes from `expected/*.json` → System classifies each cell by `verifiedBy` suffix: `@v1` → NHO-routed, `@v1-lovdata` → Lovdata-routed
2. For NHO-routed cells: CI calls `nho-reiseliv-mcp.verify_citation_freshness(hashes=[...])` → System returns `FreshnessResult` with `source: "nho-reiseliv"`, `stale: bool`, per-hash status
3. For Lovdata-routed cells: CI calls `lovdata-mcp.verify_citation_freshness(hashes=[...])` → System returns `FreshnessResult` with `source: "lovdata"`, `stale: bool`, per-hash status
4. CI aggregates results from both calls → Reports staleness per source in test output: "NHO: N/M stale", "Lovdata: N/M stale"
5. If any cell is stale → CI emits `emit_stale_event_stderr` for that cell; test fails with clear per-source staleness summary

**Postcondition:** Dual-lineage is transparently handled. CI report distinguishes staleness by source. Neither MCP is called for cells it does not own.

**Error paths:**
- `validate_hashes` raises `ValueError` (malformed hash format) → Error surfaces at test runner level with hash index and expected format; CI fails fast before making network calls
- One MCP server unreachable → CI partial fail with clear per-source error: "lovdata-mcp unreachable — N Lovdata-routed cells not verified"; operator restarts container
- All cells are NHO-routed (pre-Phase 7c workspace) → Lovdata MCP call skipped; no error
