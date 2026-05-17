---
title: "Polish PRs gild half-converted patterns when prereq mutation closure is skipped"
id: LEARNING_0286
status: canonical
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [polish, mutations, gate_action, ADR-0114, ADR-0204, L-0260-sibling]
---

# Learning-0286: Polish PRs gild half-converted patterns when prereq mutation closure is skipped

## Context

M5 HMS council (2026-05-17). Council Phase 3 chair recommended Option B (2 sorties: hms-cluster + policies-handbook) treating `policies/_actions/policy-actions.ts` audit as a precondition. Three code-tracers (Supervisor + Agent-coord + Harness) reversed via concrete file:line evidence:

- `apps/web/src/app/dashboard/hms/_hooks/use-update-deviation.ts:26-67` — direct `supabase.from("deviation").update(...)` from browser, NO `gate_action`, NO `gatedMutation`, fire-and-forget `void emit()`, client-context workspace_id.
- `apps/web/src/app/dashboard/hms/_hooks/use-complete-task.ts:25-33` — same pattern.
- `apps/web/src/app/dashboard/policies/_actions/policy-actions.ts:74-120` — Server Action with role-string check at line 77, NO `gate_action()` RPC, unregistered `"policy created"` emit at line 111.

These pre-existing ADR-0099 / ADR-0114 / ADR-0204 violations are mounted on bridges already promising "Botsson tools" — agent calls would inherit the gap.

## Discovery

A polish sortie that adds error.tsx + loading.tsx + tokens + tool descriptions over a surface containing direct-browser-write hooks does NOT close the security violation — it makes the violation more discoverable (cleaner UI → more user → more agent traffic) while leaving the gate gap intact. The polish PR LOOKS complete (typecheck green, tokens clean, journeys verified) while the L-0260 amplifier sits one layer beneath.

**The smell:** polish-pattern checklist (loading + error + telemetry + Nordic Split + bridge descriptions) passes without any ADR-0204 / ADR-0099 verification step. The 8-phase polish workflow has no gate that reads mutation hooks.

## Impact

For any polish sortie touching a surface with mutation hooks or Server Actions:

- **Prereq gate before Phase 1 of `smartout-page-polish`:** grep `_hooks/use-*.ts` for `supabase.from(...).update|insert|delete` + grep `_actions/*.ts` for Server Actions without `gate_action()` RPC. Any hit = open prereq sortie BEFORE polish, not concurrent.
- **Council convention:** when Phase 3 chair lists "audit X as precondition", that wording is too soft — code-tracers will find ADR violations and the audit becomes remediation. Phase 5 chair should reclassify as "prereq closure sortie" with sequencing constraint.
- **Polish workflow amendment:** Add Phase 0 "mutation-surface audit" to `smartout-page-polish` skill — runs same greps automatically, blocks Phase 1 if hits found.

## Sibling pattern

- **L-0260** (2026-05-14): Polish-wave amplifies pre-existing debt (EditDepartmentDialog ungated mutation amplified by openDepartmentEdit bridge tool).
- This learning extends L-0260 from "bridge mounting amplifies" to "polish PR LOOKS complete while amplifier sits beneath".

## References

- ADR-0099 (gate_action RPC mandatory for all mutations)
- ADR-0114 (Server Actions for mutations, not direct browser writes)
- ADR-0204 (gatedMutation wrapper)
- L-0260, L-0177, L-0083 (sibling)
- Council 2026-05-17 M5 HMS scoping verdict
