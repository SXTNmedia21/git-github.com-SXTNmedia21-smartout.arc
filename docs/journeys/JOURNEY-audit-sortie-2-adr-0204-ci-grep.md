---
title: JOURNEY — Audit Sortie 2, ADR-0204 §3 CI Enforcement
status: draft
created: 2026-05-06
updated: 2026-05-06
module: ci
tags: [audit, security, ci, adr-0204, journey]
sortie: feat/audit-sortie-2-adr-0204-ci-grep
---

# User Journeys: Audit Sortie 2 — ADR-0204 §3 CI Enforcement

CI/dev-process journeys. No end-user surface — fixes prevent a class of architectural regression by mechanizing ADR-0204 §3 enforcement.

---

## Journey: Developer pushes PR with inline gate_action RPC

**Precondition:** Developer adds a new Server Action / route handler that calls `supabase.rpc("gate_action", ...)` directly instead of routing through `gate-client.ts` or `gatedMutation`.

1. Developer commits + pushes branch → PR opened against development (or preview/main) → CI workflow triggers → `no-inline-gate-rpc` job runs `bash scripts/ci/no-inline-gate-rpc.sh` → Script greps for direct `gate_action` RPC calls outside the allowlist → Script finds the new violation, prints `file:line` location → Script exits 1 → CI job fails → PR shows red check "ADR-0204 § 3 — no inline gate_action RPC" → Developer sees failure + violation file:line in CI logs → Developer refactors to use `gate-client.ts`'s `callGateAction()` helper → Pushes fix → CI rerun green → PR merges.

**Postcondition:** No new inline `gate_action` RPC calls land in the codebase. Architectural invariant enforced.

**Error paths:**
- Allowlist file (gate-client.ts itself, gatedMutation orchestrator) gets a legitimate `gate_action` RPC call → Script's exclude list lets it pass → CI green.
- Script bug produces false positive → Developer adds the file to the allowlist via PR with rationale + ADR reference if architectural change.
- CI workflow not triggered (e.g. draft PR) → Script doesn't run → falls back to PR review human-eyeball check.

---

## Journey: Developer refactors existing _shared.ts gateAction call

**Precondition:** `apps/web/src/app/dashboard/_actions/_shared.ts:gateAction()` currently calls `admin.rpc("gate_action", ...)` directly. Developer (or sortie agent) migrates it.

1. Developer reads `gate-client.ts` to understand canonical helper API → reads `gatedMutation` orchestrator → picks the right target for `_shared.ts` (Server Actions consume this → `gate-client.ts`) → rewrites `gateAction()` to delegate to `callGateAction()` → preserves return shape so 14+ call sites in season-actions / people-actions don't change → runs `pnpm turbo typecheck` → sees 0 errors → runs `bash scripts/ci/no-inline-gate-rpc.sh` locally → script returns clean → commits.

**Postcondition:** `_shared.ts:101` no longer contains direct RPC. Helper signature unchanged. All 14+ Server Action call sites work unmodified.

**Error paths:**
- `gate-client.ts` API doesn't expose what `_shared.ts:gateAction()` needs (e.g. a specific error shape, idempotency token) → Developer extends `gate-client.ts` with documented addition → if the change is load-bearing, drafts ADR before merging.
- Typecheck breaks at consumer site → Investigate which consumer is tightly coupled to the old return shape → Either preserve the old shape via adapter, or update consumer.
- Migration changes runtime behavior subtly (e.g. error logging differs) → Catch via E2E test or smoke probe → Adjust.

---

## Journey: Operator inspects CI gate output

**Precondition:** Operator (Pontus / on-call) wants to verify the gate is enforcing.

1. Operator runs locally `bash scripts/ci/no-inline-gate-rpc.sh` from repo root → Script outputs nothing + exits 0 → Operator confirms clean tree.

   OR

2. Operator deliberately introduces a test violation in a scratch file → runs the script → Script outputs `<path>:<line>: direct gate_action RPC outside orchestrator (ADR-0204 §3)` → Operator confirms script catches violations.

3. Operator opens GitHub Actions run for the latest PR → finds `no-inline-gate-rpc` job → reads job log → sees green tick + "No inline gate_action RPC violations." → Confirms gate is wired and running.

**Postcondition:** Operator has confidence the regression-class is closed.

**Error paths:**
- Script never appears in CI run output → Workflow file misconfigured → Inspect `.github/workflows/ci.yml` for the job; confirm trigger conditions match PR events.
- Script outputs false-positive on legitimate orchestrator code → Allowlist exclusion needs widening; PR with diff + rationale.
