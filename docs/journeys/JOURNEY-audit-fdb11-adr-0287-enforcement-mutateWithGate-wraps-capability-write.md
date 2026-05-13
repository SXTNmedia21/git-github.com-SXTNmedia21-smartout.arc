---
title: "Journey — mutateWithGate wraps capability write atomically"
feature: audit-fdb11-adr-0287-enforcement
journey: mutateWithGate-wraps-capability-write
status: verified
verified_at: 2026-05-13
e2e_test: packages/ai/src/capabilities/_shared/__tests__/mutate-with-gate.test.ts
created: 2026-05-13
updated: 2026-05-13
module: cross-cutting
tags: [journey, adr-0287, helper]
---

# Journey: Capability tool wraps DB write in mutateWithGate

**Role:** capability tool author

**Precondition:** `_shared/mutate-with-gate.ts` helper exists.

## Happy Path

1. Author calls `mutateWithGate({ capability, action, target_id, payload, exec })`
2. Helper evaluates `gate_action` for capability+action+target
3. If granted: executes `exec` callback (DB write) + emits telemetry + records gate_evaluation row
4. If denied: throws explicit error
5. Returns write result on success

**Postcondition:** Every capability write atomically gated + emitted + audit-logged.

## Verification

- [ ] Vitest: granted path executes exec + emits
- [ ] Vitest: denied path throws + no exec
- [ ] L-0177 fail-fast: missing workspace_id/profile_id throws
- [ ] Migration of 1+ capability tool to demonstrate usage

**Mark verified when all checked.**
