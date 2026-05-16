---
slice: capability-tools
agent: system-agent-coordinator
run_id: 2026-05-16-adr-contract-validation
status: complete
findings: 3
---

# Capability Tools Audit — 2026-05-16

## Summary

Traced bodies (not docstrings, per L-0176) across 33 `tools.ts` files in `packages/ai/src/capabilities/`. No CRITICAL violations. One HIGH (ADR-0204 §SS-5 unfinished migration affecting 14 gate.ts files), one MEDIUM (ADR-0151 body-supplied workspace_id in a read-only billing tool), one LOW (legacy two-call gate pattern in 8+ tools — recognized exception until SS-5). Recently shipped `timeline-template/tools.ts` verified per-tool: all 4 tools properly compose via `mutateWithGate`. No L-0177 silent fallback patterns found. No ADR-0240 cross-namespace violations found. No ADR-0238 ownership violations in tool surface (enforced at UI layer).

## Findings

### F-CT-01 — 14 capability gate.ts files bypass `gatedMutation` orchestrator (ADR-0204 §SS-5 unfinished)

- **Severity:** HIGH
- **File:line:** `packages/ai/src/capabilities/{task,tips,season,operations,guardian,availability,operations-intelligence,communication,helpdesk_query,legal,contract,personal,payroll,shift-swap}/gate.ts` (line ~44-63 each)
- **ADR violated:** ADR-0204 §3 (composition site mandate); SS-5 incomplete
- **Evidence:** Each of these 14 files contains `await supabaseAdmin.rpc("gate_action", { p_capability: ..., ... })` as a direct RPC call. Example `task/gate.ts:53`. Compare to migrated wrappers in `journey/gate.ts:71`, `shift-lifecycle/gate.ts`, `contract-intake/gate.ts:71`, `onboarding/gate.ts`, `memory/gate.ts` — these delegate to `gatedMutation()` with sentinel entity_type. Five capabilities migrated; 14 did not. Result: tools using these gates fire `gate_action` audit row but do NOT atomically wrap the downstream write in `gatedMutation.execute` callback — the two-call pattern remains in place. ADR-0204 §SS-5 marks unification as a deferred task; this is in-progress drift, not regression.
- **Remediation:** Track SS-5 completion. Until then, audit treats this as known-deferred. Each gate.ts file should at least document the SS-5 follow-up in its header (only `task/gate.ts` lacks the SS-4 reference).

### F-CT-02 — `billing_query.get_usage_snapshot` uses body-supplied workspace_id as filter (ADR-0151 weakening, read-only)

- **Severity:** MEDIUM
- **File:line:** `packages/ai/src/capabilities/billing-query/tools.ts:255,270`
- **ADR violated:** ADR-0151 (server-derived workspace_id)
- **Evidence:** Schema declares `workspace_id: z.string().uuid()` (line 255). Execute body filters `.eq("workspace_id", params.workspace_id)` (line 270) WITHOUT first checking `params.workspace_id === ctx.workspaceId`. Compare to `availability/tools.ts:263` which performs that exact reject-cross-workspace check before any DB call. Tool is read-only (no writes), and `usage_snapshot` RLS should defend at the database layer, and the surrounding `company_id` filter from `resolveCompanyId(ctx)` provides company isolation. Risk is low but the pattern is exactly the class L-0177 warns about — body-supplied tenant key as primary filter without server-derived equality check. Capability `defaultAuthority: "read_only"` so no mutation pathway exposed.
- **Remediation:** Add `if (params.workspace_id !== ctx.workspaceId) return JSON.stringify({ ok: false, reason: "workspace_mismatch" });` before the query (mirror availability/tools.ts:263 pattern), OR remove `workspace_id` from schema and use `ctx.workspaceId` directly.

### F-CT-03 — Legacy two-call gate pattern still active in onboarding, payroll, helpdesk_query, guardian, journey, contract-intake (8+ tools)

- **Severity:** LOW (recognized-deferred)
- **File:line:** `packages/ai/src/capabilities/onboarding/tools.ts:232+254` (gate then INSERT season+season_budget OUTSIDE execute); `payroll/tools.ts:1175+1197` (force_timebank_payout); `helpdesk_query/tools.ts:57+133`; `guardian/tools.ts:71+106+120`; `journey/tools.ts:116+194+239` (run_dev); `contract-intake/tools.ts` (via gate.ts shim)
- **ADR violated:** ADR-0204 §3 strict reading (single-call composition). ADR-0204 §SS-4 explicitly tolerates the legacy `callGateAction` shim until SS-5.
- **Evidence:** Pattern is `gate = await callGateAction(...); if (!gate.allow) return; await supabase.from(X).insert(...)`. Writes occur OUTSIDE `gatedMutation().execute` callback. Atomic composition (gate-row + domain-write in same transactional thunk) is not achieved — the gate evaluation row is written, then a separate awaited write happens. ADR-0204 §SS-4 (Council 2026-04-23) preserves this shape "until SS-5 unifies all per-cap gates." All callers documented in F-CT-01 inherit this.
- **Remediation:** SS-5 (per-cap gate.ts unification). No per-tool action; track the campaign.

## Theme analysis

ADR-0204 §SS-5 unfinished migration is the dominant theme. The orchestrator (`gatedMutation()`) is shipped and adopted by 5 capabilities + every fresh capability (`timeline-template`, `scheduler`, `pos_account_management`, `journey-authoring`). The 14 legacy gate.ts files that direct-rpc are documented as deferred. No new regressions detected. `timeline-template/tools.ts` (shipped a858c1270/d811d1a9d) is fully compliant — 4/4 tools route via `mutateWithGate`, voice-reject on three writes, per-tool table in file header.

ADR-0151 surface largely clean. Only `billing-query.get_usage_snapshot` accepts body-supplied workspace_id; all other inspected tools resolve workspace_id from `ctx.workspaceId` server-side. ADR-0238 (domain-chat ownership) is enforced at the UI layer (BotssonShell), not at tool surface — no in-scope finding.

ADR-0173 frozen-4 boundaries: journey-authoring writes to `journey`/`journey_version` — verified this IS the owning capability for authoring (different from journey.publish_mission). No cross-namespace violation.

L-0177 silent workspace_id fallback: zero hits. Defensive checks `if (!ctx.workspaceId || !ctx.profileId)` present in 12+ tools. Search returned no occurrences of `if (row?.workspace_id) effectiveWorkspaceId = row.workspace_id` without else-branch.

L-0176 docstring/body drift: zero hits. Spot-checked `journey/tools.ts:run_dev` (claims `gate_action` RPC at docstring line 69, body invokes `callGateAction` line 116 — matches), `timeline-template/tools.ts` (per-tool table in header matches body), `payroll/tools.ts:force_timebank_payout` (matches), `scheduler/tools.ts:apply_change_proposal` (claims SINGLE mutateWithGate, body confirms).

## Coverage

- Tools inspected: 33 `tools.ts` files, ~120+ tool definitions
- Surface covered: every `tools.ts` in `packages/ai/src/capabilities/*/`
- Surface deferred (active campaign): SS-5 gate-unification work (tracked in F-CT-01, not re-flagged per-capability)

### Timeline-template per-tool table (L-0175 mandate — freshly shipped)

| Tool             | gate_action               | gatedMutation   | emit()                     | Verdict |
|------------------|---------------------------|-----------------|----------------------------|---------|
| save_template    | timeline_template.save    | mutateWithGate  | timeline_template.saved    | PASS    |
| list_templates   | (read-only, no gate)      | n/a             | n/a                        | PASS    |
| apply_template   | timeline_template.apply   | mutateWithGate  | timeline_template.applied  | PASS    |
| archive_template | timeline_template.archive | mutateWithGate  | timeline_template.archived | PASS    |
