---
title: Learning 0040 — Identity-Boundary Ontology: Pre-Workspace Flows Are a Distinct Class
id: LEARNING_0040
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [ontology, identity, workspace-api, gateway, adr-0029, adr-0123]
---

# Learning 0040 — Identity-Boundary Ontology: Pre-Workspace Flows Are a Distinct Class

## Context

During the 2026-04-17 post-audit remediation council, an audit flagged `accept-invitation` and `create-invitation` Edge Functions as drift from ADR-0029 (Workspace API Gateway). On the surface they looked like workspace-scoped data endpoints called outside the gateway — a clean audit bullet.

Steward initially proposed building a new `identity-api` gateway tier. Supervisor's code-trace of `workspace-api`'s `resolveAuth` (line 102) showed the gateway hard-requires `auth.workspaceId` — the invitee has no workspace context at call time, so gateway routing is architecturally impossible without changing the auth contract.

## Discovery

**Pre-workspace flows are a distinct architectural class from workspace-scoped flows.** They share the cascade/identity namespace but cannot pass through a gateway that assumes workspace context. The invitation token is a strong auth surface (UUID with RLS on the `invitation` table), not an absence of auth.

The audit's "missing gateway" framing obscured the real ontology: identity-boundary is a thing. It is not an ADR-0029 violation — it is the boundary at which ADR-0029 stops applying. Three sibling flows are latent:

1. `accept-invitation` (exists)
2. `create-invitation` (exists — technically workspace-scoped, but already permitted by ADR-0029 webhook/dispatch exception)
3. Future: company-creation, magic-link verify, social-signup callback, profile-link

Two flows is not enough to justify a gateway tier. Three is the threshold at which a dedicated `identity-api` gateway would amortize its own complexity.

## Impact

- **ADR-0123** (this session) amends ADR-0029 with an explicit exceptions list AND a **tripwire clause**: when a 3rd pre-workspace endpoint is proposed, open an `identity-api` gateway ADR. This prevents both speculative overbuilding (building a gateway for two endpoints) and silent drift (accumulating five identity endpoints without a unifying tier).
- The `smartout-edge-function-guide` skill gains a **"Pre-workspace?" checklist item** — when creating a new Edge Function, first ask whether it has workspace context; if not, declare it as an ADR-0123 exception or (if it's the 3rd) trigger the gateway ADR.
- Future councils reviewing Edge Function work should check this learning before classifying pre-workspace flows as gateway drift.

## References

- ADR-0029 (Workspace API Gateway) — now amended by ADR-0123
- ADR-0123 (this session) — explicit exceptions + tripwire clause
- `supabase/functions/workspace-api/index.ts:82-107` — `resolveAuth` contract requiring `auth.workspaceId`
- `supabase/functions/accept-invitation/index.ts` — token-as-auth surface, `verify_jwt=false`
- Council log 2026-04-17 — semantic conflict resolution (Steward gateway vs Supervisor exceptions)
