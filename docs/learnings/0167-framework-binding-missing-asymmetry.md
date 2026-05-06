---
title: "Framework-Binding-Missing Default-Allow Lacks Audit Symmetry"
id: LEARNING_0167
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [gate, audit, framework, symmetry, adr-0091, adr-0189]
---

# Learning-0162: cascade_gate_write Lacks Default-Allow Audit Symmetry vs gate_action

## Context

Council 2026-04-28 dual-gate reconciliation. Steward Phase 3 review caught:

- `gate_action` (ADR-0189 + migration `20260516130000`): when no `engine_authority_config` row exists for `(workspace_id, capability)`, default-allows but **emits warning row to `activity_trail`** with `event='gate.unseeded_capability_invoked'`, plus returns `unseeded:true` in JSONB. Admin dashboards can surface drift.
- `cascade_gate_write` (migration `20260512100000`): when no `workspace_framework_binding.is_active=true` exists, default-allows with `outcome:'applied'` and `reason:'no-active-framework'`. **Silent.** No audit row. No surface for "workspace has unbound framework risk".

Both gates default-allow on missing config — that's intentional bootstrap support. But only one emits a parity warning. The asymmetry makes audit reasoning lopsided: an unconfigured authority is observable; an unbound framework is not.

## Discovery

Bootstrap-tolerant defaults need observability symmetry. When two RPCs share the same "default-allow on missing-config" semantic but only one emits a warning, the silent one becomes the preferred bypass route — adversarial framing. Any operator who knows about the asymmetry can:

1. Ensure no `workspace_framework_binding.is_active=true` exists for a workspace.
2. Route mutations through Server Actions (which call `cascade_gate_write` only).
3. Mutations succeed without authority gate (Server Actions bypass `gate_action` per ADR-0229 finding) AND without framework gate (no binding exists) AND without audit trace.

Today the attack surface is bounded (Server Actions are web-UI-only and require login session). But the asymmetry is a future foot-gun once the surface broadens.

## Impact

1. **ADR-0229 P1 (ADR-0196 amendment) deliverable**: cascade_gate_write must emit `activity_trail` warning when no active framework binding exists. Mirror `gate_action`'s pattern from `20260516130000_gate_action_unseeded_warning.sql`. Event name: `gate.unbound_framework_invoked`. Source: `cascade_gate_write`.
2. **Admin dashboard parity**: any dashboard surfacing `gate.unseeded_capability_invoked` must also surface `gate.unbound_framework_invoked`. Both indicate "workspace operating in default-permissive mode".
3. **ADR-0189 CI parity** extends to BOTH gates: scan for capability/entity-type strings invoked by callers that have no seed row. Currently only checks `engine_authority_config` for `gate_action` callers; must also check `framework_trigger` for `cascade_gate_write` callers (where the framework binding is intended to fire).
4. **Generalization for future gates**: any new RPC with a "default-allow on missing-config" branch MUST also emit an `activity_trail` warning. Add to ADR template as a checklist item.

## References

- ADR-0091 (cascade_gate_write WP2)
- ADR-0099 (gate_action)
- ADR-0189 (CI parity for authority seed)
- ADR-0229 (dual-gate transitional architecture)
- `supabase/migrations/20260512100000_cascade_gate_write.sql:54-58` (silent default-allow branch)
- `supabase/migrations/20260516130000_gate_action_unseeded_warning.sql` (reference implementation for warning emit)

> After writing: register in `docs/learnings/0000-learning-log.md`.
