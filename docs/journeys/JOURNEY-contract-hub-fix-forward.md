---
title: "Journey — contract-hub-fix-forward (P0 fix-forward sortie aggregate)"
feature: contract-hub-fix-forward
journey: contract-hub-fix-forward
status: verified
verified_at: 2026-04-22
e2e_test: null
created: 2026-04-27
updated: 2026-04-27
module: contracts
tags: [journey, fix-forward, p0, cve, council-gate-4-r2, aggregate]
---

# Journey: contract-hub-fix-forward (P0 fix-forward aggregate)

This is an **aggregate journey** linking the four P0 defect-fix sub-journeys that compose the `contract-hub-fix-forward` sortie. Each sub-journey is independently verifiable; this aggregate captures the campaign-level intent and merge-gate criteria.

## Context

PR #234 (`contract-hub-redesign`) merged 2026-04-22 with Council Gate 4 R1 verdict "PASS WITH CONDITIONS" — but R2 post-merge code-trace surfaced 4 P0 defects the prior gates missed. This sortie closes those defects in a single fix-forward branch, with each fix discrete enough to revert independently.

Decision context: ADR-0191 (per-capability auth-passing pattern) + ADR-0192 (authority seed bootstrap-trigger) + Council Gate 4 R2 (2026-04-22) → APPROVE WITH FIX-FORWARD SORTIE.

## Sub-journeys (composed by this aggregate)

| # | Sub-journey | Defect class | Verification |
|---|---|---|---|
| 1 | [JOURNEY-fix-authority-seed-cve.md](JOURNEY-fix-authority-seed-cve.md) | CVE — default-allow window on fresh workspaces | 12-assertion pgTAP suite |
| 2 | [JOURNEY-fix-fork-template-auth.md](JOURNEY-fix-fork-template-auth.md) | Capability tool 401 silent failure (forkTemplate) | Manual fork from MalerTab + agent path code-trace |
| 3 | [JOURNEY-fix-fork-triple-emit.md](JOURNEY-fix-fork-triple-emit.md) | Telemetry inflation (3× emit per fork) | activity_trail row count = 1 per fork |
| 4 | [JOURNEY-fix-bulk-gate-action.md](JOURNEY-fix-bulk-gate-action.md) | C4 governance bypass on bulk endpoint | gate_evaluation row appears for batch |

## Aggregate happy path

**Role:** workspace-admin (downstream user) / system (governance + telemetry) / agent (Mr. Botsson invoking capability tools)

**Precondition:** Production database in post-PR-#234 state — 4 P0 defects active. Workspace owners can fork templates manually but agent path returns silent 401; bulk operations bypass C4 governance; fresh workspaces have no `engine_authority_config` rows for contract capabilities (CVE); fork operations inflate audit_trail by 3×.

1. Operator deploys this sortie's 4 commits to development → migrations land in order: authority seed UPSERT + bootstrap trigger first (closes CVE), telemetry registry entry for `contract.bulk_send_initiated`, capability tool refactor for forkTemplate, route emit dedup. → 0 prod users impacted (preview branch only).
2. New workspace created post-deploy → `AFTER INSERT ON workspace` trigger fires → 19 contract capabilities auto-seeded into `engine_authority_config` → fresh workspace has authority enforcement from creation. → CVE window closed.
3. Workspace-admin opens MalerTab → "Ny fra systemmal" button now enabled (was disabled at MalerTab.tsx:236-245) → click → SystemTemplatePicker → select K1a template → POST `/api/contract-templates/copy` → 200 → new workspace template appears immediately. → exactly 1 `contract_template forked` emit lands in `activity_trail`.
4. Mr. Botsson invoked from contract surface with fork intent → capability tool `packages/ai/src/capabilities/contract/tools.ts:fork` writes via `ctx.supabaseAdmin` (Option A per ADR-0191) → upstream `gate_action` enforced by agent dispatcher (ADR-0099) → new workspace template returned to agent → exactly 1 `contract_template forked` emit (sibling tools `publishWorkspaceTemplate` / `deprecateWorkspaceTemplate` pattern preserved). → No 401. No triple-emit.
5. Workspace-admin initiates bulk-send via dashboard → POST `/api/employment-contracts/bulk` with N profile IDs → endpoint calls `gate_action` ONCE per batch with `capability="contract"`, `action_type="bulk_send"` (not per profile) → on `gate_denied` → 403 + reason + min_role → on pass → emits `contract.bulk_send_initiated` with `{batch_id, template_id, profile_count}` BEFORE per-profile loop → per-profile `contract.created` events correlate back via `batch_id`. → 1 gate_evaluation row + 1 batch-init event + N profile events, all linked by `batch_id`.

**Postcondition:** 4 P0 defects closed across 19 registered contract capabilities. CVE class permanently sealed (auto-seed at workspace creation). Telemetry integrity restored. Capability auth pattern uniform per sibling-tool convention (ADR-0191). C4 governance applies to bulk and single-contract paths equally.

## Error paths

**E1 — gate_denied on bulk** (Sub-journey 4)
- Workspace-admin attempts bulk-send without authority → `gate_action` returns `gate_denied` → endpoint returns 403 with `{reason, min_role}` → UI shows authorization message → no per-profile mutations occur → no `contract.bulk_send_initiated` event → audit_trail records the gate decision.

**E2 — capability_default_registry row missing** (Sub-journey 1)
- New contract capability added to `CapabilityName` union without registry row → workspace creation trigger does NOT seed authority for it → next gate_action call for that capability would default-deny (closed-fail) → caller sees authorization error → engineer adds registry row + re-runs migration → trigger re-seeds. (Out of CVE class because default-deny is safe; only missing-row UX issue.)

**E3 — forkTemplate write fails downstream** (Sub-journey 2)
- `ctx.supabaseAdmin.insert` fails (FK constraint, RLS, malformed payload) → tool returns error → agent dispatcher surfaces error via `gate_action` audit → no partial state in workspace_template (insert is atomic per row) → no `contract_template forked` emit → no audit_trail row.

**E4 — telemetry registry mismatch** (Sub-journey 3)
- New emit added without registry entry → CI emit-registry coverage check fails → merge blocked (per L-0094 phantom emit contracts) → engineer adds registry entry → re-runs CI.

## Verification (pre-merge)

- ✅ pgTAP `contract_authority_seed_parity.sql` — 12 assertions green (registry shape, default level/min_role, trigger existence, fresh-workspace bootstrap, idempotency under replay, end-to-end gate enforcement)
- ✅ `pnpm turbo typecheck` — 35/35 workspaces clean
- ✅ Lint — 0 errors (942 pre-existing warnings unchanged)
- ✅ Decision log registers ADR-0191 + ADR-0192 + ADR-0193
- ✅ HANDOFF-contract-hub-fix-forward.md complete
- ⚠️ E2E specs deferred to P1 follow-up sortie (not blocking — fix-forward scope limited to merge-target P0 defects)

## Defects deferred (P1+ follow-up sortie — out of scope for this aggregate)

- Empty-string `actor_id` at 5 emit sites (needs ADR-0193 NonEmptyString brand implementation)
- "Ny fra bunnen" MalerTab button still disabled (needs schema relaxation for null `source_template_id`)
- Read-only tools (5) lack role guard
- CHECK constraint `(NOT (is_system AND workspace_id))` not added on contract_template
- SelectEmployeeStep listbox a11y
- 3 drawers missing `SheetTitle`
- `useReducedMotion` missing on 4 components
- Legacy `contract_template copied` event registry comment deprecation

## References

- ADR-0191 — Per-capability auth-passing pattern (Option A direct admin chosen for forkTemplate)
- ADR-0192 — Authority seed bootstrap-trigger pattern (CVE remediation)
- ADR-0193 — NonEmptyString brand for telemetry IDs (deferred to P1)
- ADR-0099 — Unified authority gate (gate_action contract)
- ADR-0101 — Per-entity authority scope
- ADR-0134 — Mobile telemetry contract (actor_id + workspace_id derivation)
- L-0094 — Phantom emit contracts (registry coverage requirement)
- L-0115 — Ontology PASS does not imply runtime PASS
- L-0116 — Sibling-tool architectural inconsistency = Trust Gate failure
- L-0117 — Grep-based structural claims must be code-traced
- L-0118 — Every capability tool requires E2E Trust Gate test
- HANDOFF-contract-hub-fix-forward.md — closure deliverable
- Council 2026-04-22 (Gate 4 R2 post-merge audit)

---

> Aggregates 4 sub-journeys. Each is independently verifiable. Close-feature gate uses this filename to map branch → journey.
