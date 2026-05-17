---
title: "Journey — payroll-lovsen-cert-pass"
feature: payroll-lovsen-cert-pass
journey: lovsen-cert-pass
status: verified
verified_at: 2026-05-17
e2e_test: null
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [journey, payroll, lovsen, cert-pass, golden-month, freshness, mcp, fixture-mode]
---

# Journey — payroll-lovsen-cert-pass

Covers two developer/CI journeys introduced by the cert-pass sortie:

1. CI runs golden-month suite with authority-cert guard active
2. Lovsen MCP returns deterministic FreshnessResult in fixture mode

---

## Journey 1 — CI / developer runs golden-month with cert-authority guard

**Role:** CI pipeline / developer

**Precondition:**
- T6 cert pass applied: all 4 `expected/*.json` fixture files contain `verifiedBy: "lovsen-mcp@v1"` and `verifiedAt: "2026-05-17T00:00:00.000Z"` in every cell's authority block
- `LOVSEN_FIXTURE_MODE=true` set in the CI environment (ADR-0258)
- `pnpm install` run from payroll worktree root (no stale node_modules symlinks)

### Happy Path

1. CI (or developer) runs `pnpm test:golden-month` from the payroll campaign root.
2. Vitest picks up the 4 `expected/*.json` fixture files (covering 179 cells × 4 files = 240 cell assertions).
3. For each cell, the schema validator (`ExpectedCellSchema`, ADR-0341 §H) asserts the `authority` block:
   - `verifiedBy` must equal `"lovsen-mcp@v1"` (not `"PENDING_LOVSEN_CERTIFY"`)
   - `verifiedAt` must be a valid ISO-8601 datetime string
4. F6 cents-exact gate runs: computed payroll output ↔ expected fixture must match to the øre.
5. All 240 assertions pass. Vitest exits 0.

**Postcondition:**
- Golden-month suite green: 240/240 pass
- Authority cert active across all Riksavtalen §6 cells
- CI pipeline proceeds to next gate without manual intervention

### Error Paths

**PENDING_LOVSEN_CERTIFY in any cell:**
- `ExpectedCellSchema` validation fails on `verifiedBy` — value does not match `"lovsen-mcp@v1"` pattern
- Vitest exits non-zero, test name shows which fixture file + cell index
- Resolution: run T6 cert pass script again, or identify the cell that was not substituted

**Fixture file missing / malformed JSON:**
- Vitest import fails at parse time with JSON syntax error
- Resolution: check the 4 expected files under `packages/payroll/src/__tests__/golden-month/expected/`

**Stale dist in `@smartout/telemetry`:**
- Typecheck (not golden-month) fails with TS2307 on telemetry types
- Resolution: `pnpm --filter @smartout/telemetry build` from worktree root, then re-run typecheck
- See L-2 in HANDOFF for the fresh-worktree boot sequence

---

## Journey 2 — Lovsen MCP fixture-mode deterministic response

**Role:** developer / CI (calling the NHO Reiseliv stdio MCP)

**Precondition:**
- `LOVSEN_FIXTURE_MODE=true` (or backward-compat `LOVSEN_MCP_FIXTURE=true`) set in environment
- `services/lovsen-nho-reiseliv-mcp` Python service is running (or called as stdio subprocess via `python3 -m src.server`)
- Input hashes are hex64 strings (SHA256 format), between 1 and 100 in the batch

### Happy Path

1. Caller sends a `verify_citation_freshness` tool invocation with 1–100 hex64 hash strings, e.g.:
   ```json
   {
     "hashes": ["a1b2c3...64chars", "d4e5f6...64chars"]
   }
   ```
2. MCP handler validates each hash: must be exactly 64 lowercase hex characters.
3. `LOVSEN_FIXTURE_MODE=true` branch executes — no network I/O to nhoreiseliv.no.
4. Handler returns a `FreshnessResult[]` array with one entry per input hash:
   ```json
   [
     {
       "hash": "a1b2c3...64chars",
       "stale": false,
       "checked_at": "2026-05-17T10:23:45.123456",
       "source": "nho-reiseliv"
     }
   ]
   ```
   - `stale: false` for all hashes (fixture-mode deterministic)
   - `checked_at`: ISO-8601 of NOW (real timestamp, not fixed)
   - `source: "nho-reiseliv"` constant
5. A JSON telemetry line is emitted to stderr:
   ```json
   {"event": "lovsen.citation.stale", "hash": "...", "stale": false, "source": "nho-reiseliv"}
   ```
   (One line per hash; stderr is the telemetry stub surface in V1)

**Postcondition:**
- Caller receives deterministic-shape `FreshnessResult[]` with no network calls
- `stale: false` for every hash — caller treats all citations as fresh
- CI can run offline without nhoreiseliv.no availability

### Error Paths

**Invalid hash format (not 64 hex chars):**
- Handler raises `ValueError: invalid hash format` before any fixture-mode branch
- MCP returns error response with the offending hash identified
- Resolution: caller must validate SHA256 hex format before invoking the tool

**Batch too large (>100 hashes):**
- Handler raises `ValueError: batch size exceeds maximum of 100`
- Resolution: caller must split into batches of ≤100

**Live mode (`LOVSEN_FIXTURE_MODE` not set or false):**
- Handler enters live-V1 branch: treats all hashes as unknown (no nhoreiseliv.no fetch implemented in V1)
- Returns `stale: true` for all hashes (unknown = stale, conservative)
- Phase 7 real-fetch sortie will implement actual HTTP lookup

**`LOVSEN_MCP_FIXTURE` set but `LOVSEN_FIXTURE_MODE` not set:**
- Backward-compat shim activates: `LOVSEN_MCP_FIXTURE=true` → treated as `LOVSEN_FIXTURE_MODE=true`
- Warning line emitted to stderr: `"LOVSEN_MCP_FIXTURE is deprecated — use LOVSEN_FIXTURE_MODE per ADR-0258"`
- Behavior identical to fixture mode
