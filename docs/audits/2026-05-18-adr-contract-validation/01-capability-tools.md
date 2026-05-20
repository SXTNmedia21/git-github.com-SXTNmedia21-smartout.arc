---
title: Slice 01 — capability-tools
run: 2026-05-18 (smoke)
adrs: [0151, 0173, 0186, 0204, 0238, 0240]
---

# capability-tools — 2026-05-18 (smoke)

## Findings

### CRITICAL
none

### HIGH

- **`billing-query/tools.ts:270`** — ADR-0151: `params.workspace_id` used as `.eq("workspace_id", params.workspace_id)` filter in `get_usage_snapshot` with no cross-check against `ctx.workspaceId`. `resolveCompanyId(ctx)` anchors the company but an actor from workspace A could query billing records for sibling workspace B if both share the same company. Write-safe (read-only tool) but cross-workspace data leak risk.

- **`journey-authoring/tools.ts:483–509`** — ADR-0240: `publish_draft` tool writes to `journey` and `journey_version` tables directly inside `gatedMutation`. `journey/tools.ts` also owns and writes both tables (lines 196, 384, 503). No delegation to a `journey` capability tool. The docstring at line 452–457 acknowledges this as tracked debt ("cross-namespace refactor tracked separately"), but the write boundary is live and unfixed.

### MEDIUM

- **`billing-query/tools.ts:255`** — ADR-0151 (related): `workspace_id` is a top-level Zod param (`z.string().uuid()`), not derived from `ctx`. Applies to all three tools using `params.workspace_id` as a DB scope column without equality check against `ctx.workspaceId`. Remediation: add `if (params.workspace_id !== ctx.workspaceId) return "workspace_mismatch"` guard, matching the pattern already used in `availability/tools.ts:263`.

### LOW

- **`helpdesk_query/tools.ts:352–390`** — ADR-0173 marginal: `open_query` and `resolve_ticket` write directly to `engine_event` and `engine_delayed_trigger` (engine domain tables) without delegation. Currently accepted by the codebase pattern (multiple capabilities write engine_event for dispatch triggering), but no ADR explicitly authorises helpdesk as a writer to these tables. Flag for future ADR-0161 boundary clarification if engine_event ownership is tightened.

- **`journey-authoring/tools.ts:325`** — ADR-0240 marginal: `check_duplicates` reads `journey` table directly (read-only, no gatedMutation required). Not a mutation boundary violation, but same cross-namespace read that may become a concern when `journey` capability adds finer-grained RLS.

## Coverage

- 37 files audited
- ~180 tools checked (across all `defineTool` calls)
- Skipped: ADR-0238 (BotssonShell/DomainChatOwnership — UI layer, not in scope for this slice)

## Notes

**Gate pattern survey:** 37 capability files use four gate patterns:
1. `mutateWithGate()` — wraps `gatedMutation`, ADR-0287 ergonomic default (shift_marketplace, pos_account_management)
2. `gatedMutation()` directly — ADR-0204 canonical (journey-authoring, memory, cascade)
3. `callGateAction()` + direct write — pre-ADR-0287 legacy pattern, still ADR-0287 compliant per §50 ("directly or via mutateWithGate()") (availability, personal, contract, helpdesk_query, org, day-line, shift-lifecycle, scheduler, communication, task via `gateTaskAction`)
4. No gate — read-only capabilities only (billing-query reads, kb_query, engine-world reads)

Pattern 3 is compliant per ADR-0287 §50 but does NOT satisfy ADR-0204 §165 ("MUST compose via gatedMutation"). ADR-0287 accepted 2026-04-23 supersedes ADR-0204's SS-5 migration requirement for pre-existing capabilities. New capabilities post-2026-04-23 using pattern 3 (e.g. task, day-line, helpdesk_query) are still ADR-0204 non-compliant but ADR-0287 compliant — the two ADRs are in mild tension. This is not flagged as a finding but is noted as a clarification opportunity.

**L-0177 check:** No `?.workspace_id` or `?.profile_id` silent fallback patterns found across all 37 files. `mutateWithGate` wrapper throws `MutateWithGateError` on empty IDs (fail-fast enforced at wrapper level for pattern 1).

**ADR-0194 authorisation:** `journey/tools.ts` writes `engine_missions` + `engine_stages` directly — explicitly authorised by ADR-0194. Not a violation.

**In-flight (council-approved, not re-flagged):** `day-line/tools.ts` and `task/tools.ts` wiring confirmed by 2/2 council APPROVE on campaign/ui-shell.
