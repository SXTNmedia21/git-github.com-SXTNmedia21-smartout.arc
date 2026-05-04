---
title: "Bootstrap-cascade single-writer silent default — provisioning step failure hides in mutation default-permit"
id: LEARNING_0114
status: canonical
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [authority, bootstrap, provisioning, silent-failure, pathway-b, cascade-gate-write, adr-0091, adr-0190]
related: [LEARNING_0107, LEARNING_0112, LEARNING_0113, ADR_0091, ADR_0190]
---

# Learning-0114: Bootstrap-cascade single-writer silent default

## Context

Pathway B (`cascade_gate_write`, ADR-0091) evaluates authority against a three-table policy tree:

1. `workspace_framework_binding` — does this workspace have an active regulatory framework bound?
2. `framework_trigger` — does the bound framework have a trigger matching the entity-type being written?
3. `change_proposal` — if yes to 1+2, propose the change for review.

When step 1 returns NULL (`is_active=true` row absent for the workspace), the RPC enters the `no-active-framework` branch and returns `allow=true, outcome='applied'`. This is documented as intentional MVP behavior (`20260512100000_cascade_gate_write.sql:11-13`) — framework binding is opt-in, and unbound workspaces default to permit.

Phase 3 of the 2026-04-22 Pathway-B Authority Council code-traced the provisioning path to understand when this default fires in practice. The answer was sharper than expected:

- **The sole writer of `workspace_framework_binding` is `supabase/functions/bootstrap-cascade/index.ts:417-427`.** Direct migrations, RPCs, and other Edge Functions do not populate this table.
- **Bootstrap-cascade only creates bindings for workspaces where `regulatory_framework.code='hospitality.no.default.v1'` AND `is_active=true`** (lines 408-413). No seed exists for any other industry.
- **Bootstrap-cascade failures do not block workspace creation.** `finalize-workspace/index.ts:89-105` captures `bootstrapError` and returns success to the caller anyway. The workspace row exists; the binding row does not.

The combined effect: every non-hospitality workspace in production today is silently unbound. Every bootstrap-cascade outage during a workspace-creation window produces permanently-unbound workspaces. Every industry added to the UI without a corresponding framework seed produces a class of silently-unbound workspaces. Pathway B returns `applied` on all of them — with the `gate_evaluation` audit row bearing `reason='no-active-framework'` that no UI, dashboard, or telemetry consumer reads.

## Discovery

**Provisioning step whose failure is observable only at mutation-time, on a branch whose default is permissive, is audit theater in waiting.** This is a generalizable anti-pattern composed of three ingredients:

1. A one-time setup writer that creates a row required for runtime authority decisions.
2. An option for the caller to survive if the setup writer fails.
3. A runtime authority default that permits when the row is missing.

Any system with all three ingredients has a permit-by-default failure mode that cannot be detected by testing the writer (it may succeed intermittently), nor by testing the authority RPC (it correctly returns `applied` per spec), nor by testing the caller (it correctly handles the "writer failed" signal). The defect manifests only at the union of (successful workspace creation) × (failed or skipped setup writer) × (any subsequent mutation).

In this specific case:
- **Ingredient 1:** bootstrap-cascade writing `workspace_framework_binding`.
- **Ingredient 2:** `finalize-workspace/index.ts:89-105` logging the error and returning success.
- **Ingredient 3:** `cascade_gate_write` defaulting to `applied` when no binding exists.

Each ingredient is individually defensible:
- Bootstrap-cascade is non-blocking because we don't want a framework-seed bug to prevent customers from signing up.
- `finalize-workspace` returns success because the workspace is usable for most operations without a binding (reads, authentication, non-cascade writes).
- `cascade_gate_write` permits on no-framework because framework binding is opt-in for MVP and we don't want to require every workspace to have a framework before shipping.

The pathology is compositional, not local. No single file looks broken.

## Impact

**Immediate (addressed by ADR-0190):**
- Control 1 moves binding creation into `finalize_onboarding_workspace` RPC. Binding becomes atomic with workspace creation — ingredients 1 and 2 cease to compose.
- Control 3b adds runtime observability to the default-permit branches. Ingredient 3 becomes visible in real-time via `gate.default_permitted` activity-trail events.
- Backfill of existing unbound workspaces is a prerequisite ops task before Control 3b ships (else alarm fatigue on every mutation against the installed base of silent-default workspaces).

**Generalizable (design-review checklist addition):**

For every new authority surface, ask:
1. What writes the authority configuration? When? Under what failure modes?
2. What happens at runtime if the configuration write failed or was skipped?
3. Is that runtime behavior observable? By whom, through what signal?

If the answers are respectively (a) "a separate setup step that can fail non-fatally", (b) "we default-permit", (c) "there's an audit row that nobody reads" — you are building the same defect.

**Related anti-patterns:**

- L-0107 ("Authority appearance ≠ authority presence") is the umbrella class. This learning documents one specific manifestation: *default-permit on missing configuration row*.
- L-0066 ("default-allow capability authority CVE trap") is the pathway-A analogue: `gate_action` defaulting to allow when `engine_authority_config` row is absent. ADR-0189 addressed it via CI parity-gate. ADR-0190 addresses the pathway-B analogue via different mechanics (atomic binding + runtime emit).
- The pattern is expected to recur. Two manifestations in two different pathways suggest a third will appear when the next authority mechanism ships. Building the design-review checklist (above) before that ships is the prevention move.

## References

- ADR-0091 — `cascade_gate_write` RPC (pathway B).
- ADR-0190 — Authority parity for cascade_gate_write via orthogonal controls (the response to this learning).
- L-0066 — default-allow capability authority CVE trap (pathway-A analogue).
- L-0107 — authority appearance ≠ authority presence (umbrella class).
- L-0112 — two gate pathways — parity gate covers one (the discovery that surfaced this defect).
- `supabase/functions/bootstrap-cascade/index.ts:417-427` — sole binding writer.
- `supabase/functions/finalize-workspace/index.ts:89-105` — non-blocking failure handling.
- `supabase/migrations/20260512100000_cascade_gate_write.sql:49-60` — default-permit branch.
- `supabase/migrations/20260424100000_seed_hospitality_framework.sql` — only seeded framework.

---
