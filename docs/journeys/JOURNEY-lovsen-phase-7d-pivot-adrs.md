---
title: "Journey — lovsen-phase-7d-pivot-adrs"
feature: lovsen-phase-7d-pivot-adrs
status: verified
verified_at: 2026-05-17
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [journey, payroll, lovsen, dynamic-mcp-fetch, adrs]
---

# Journey — lovsen-phase-7d-pivot-adrs

## Journey 1 — Phase 7e developer reads ADR foundation before code

**Precondition:** Phase 7e sortie opens for bridge implementation. 5 ADRs (0350–0354) are merged to `campaign/payroll`. Developer has no prior context on the dynamic-MCP-fetch pivot.

1. Developer opens ADR-0350 → understands bridge transport decision: HTTP-via-BFF is the approved channel, capability HTTP client is the implementation pattern, direct Python MCP socket from browser is forbidden.
2. Developer opens ADR-0351 → understands tariff floor enforcement: UP adjustments (employer supplements above Riksavtalen floor) are allowed; DOWN adjustments (paying below tariff minimum) are forbidden and must be rejected with a DB CHECK constraint violation, not a soft warning. Aml. §14-15 is cited as the statutory basis.
3. Developer opens ADR-0352 → understands `derive_supplement_set` MCP contract: Python-owned synthesis, inputs are `workspace_id + period_start + period_end`, output is a deterministic supplement set, the capability layer calls this tool and surfaces the result — it does not reimplement the logic.
4. Developer opens ADR-0353 → understands `workspace_framework_binding` lifecycle: a workspace binds to exactly one regulatory framework per period; binding is immutable after the first payroll period is locked; re-binding requires a new binding row with a future `effective_from`, not an update to the existing row.
5. Developer opens ADR-0354 → understands freshness ops: a heartbeat cron job runs every 24 h and calls `derive_supplement_set` to detect drift between stored and live Riksavtalen rates; the drift detector emits a `payroll.tariff_drift_detected` telemetry event if delta exceeds threshold; no auto-apply — operator must confirm via capability tool.
6. Developer reads 4 amendments to ADR-0341/0342/0348/0349 → understands role-shifts: ADR-0341 (calc-engine authority) narrowed to exclude rate derivation, ADR-0342 (supplement rule storage) amended to reference `workspace_framework_binding` as the authoritative source, ADR-0348 (payroll period lock) extended with tariff-snapshot requirement before lock, ADR-0349 (export format) amended to include `tariff_source` provenance column.

**Postcondition:** Developer has full pivot context — transport, floor enforcement, MCP contract, binding lifecycle, freshness ops, and role-shifts — before a single line of Phase 7e code is written.

**Error paths:**
- If ADR-0350 is missing: developer falls back to direct-socket pattern, which is forbidden. Symptom: BFF routes do not exist, capability bypasses HTTP layer.
- If ADR-0351 is missing: developer implements DOWN adjustments as warnings, not hard rejections. Symptom: payroll lines below tariff floor pass typecheck but violate Aml. §14-15.
- If amendments are not read: developer implements against superseded role boundaries. Symptom: calc-engine derives rates instead of delegating to MCP; supplement rules stored without `workspace_framework_binding_id` FK.

---

## Journey 2 — Council Phase 8 doc-tutor verifies ADR cross-references

**Precondition:** 5 ADRs (0350–0354) are proposed. Council Phase 8 runs a doc-tutor pass to verify the ADR graph is self-consistent before recommending a Phase 7e green light.

1. Doc-tutor greps `related_adrs` field in ADR-0350 through ADR-0354 → confirms each ADR cites at least two of the others, forming a closed reference cycle. No ADR stands alone without cross-reference to the tariff floor (0351) or binding lifecycle (0353).
2. Doc-tutor opens `docs/decisions/0000-decision-log.md` → confirms exactly 5 new rows added in correct numeric order: ADR-0350 before ADR-0354, no gaps, all `status: proposed`, all `updated: 2026-05-17`.
3. Doc-tutor opens `docs/council/` council log → confirms new section appended for the 2026-05-17 dynamic-MCP-fetch pivot session: APPROVE WITH CHANGES + DEGRADED-MODE verdict present, Chair Phase 3 self-reversal on ADR-0250 misread documented, 6th L-0147 precedent noted.
4. Doc-tutor reads L-0289, L-0290, L-0291 → confirms each learning cites a specific falsifying event: L-0289 cites the ADR-0250 misread in council, L-0290 cites the NHO cirkulær primary-date discovery, L-0291 cites the capability-boundary-follows-schema-fk code-trace. No learning is ungrounded.

**Postcondition:** ADR graph is verified self-consistent. Cross-references form a closed cycle. Decision log and council log are in sync. All 3 learnings have falsifying evidence. Doc-tutor issues Phase 7e green light.

**Error paths:**
- If `related_adrs` are missing or dangling: graph check fails. Doc-tutor flags missing cross-reference and blocks Phase 7e until ADR is amended.
- If decision log rows are out of order or missing: numeric audit fails. Doc-tutor flags the gap.
- If council log has no self-reversal note: Chair Phase 3 precedent is lost. Future councils lack the L-0147 record.
- If a learning has no falsifying event citation: learning is treated as opinion, not evidence. Doc-tutor flags it for revision.
