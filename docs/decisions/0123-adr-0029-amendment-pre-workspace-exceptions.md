---
title: ADR-0123 — ADR-0029 Amendment: Pre-Workspace Edge Function Exceptions
id: ADR_0123
status: proposed
layer: decision
created: 2026-04-17
updated: 2026-04-17
module: edge-functions
tags: [adr, amendment, adr-0029, workspace-api, invitations, identity-boundary]
supersedes: none
amends: ADR_0029
---

# ADR-0123 — ADR-0029 Amendment: Pre-Workspace Edge Function Exceptions

## Context and Problem Statement

ADR-0029 (Workspace API Gateway) requires workspace-scoped data endpoints to route through the `workspace-api` Edge Function. A 2026-04-17 audit flagged `accept-invitation` and `create-invitation` as potential drift because both are invoked directly from `apps/web` via `supabase.functions.invoke()`.

Code-trace revealed neither is a drift:

- **`accept-invitation`** sets `verify_jwt=false` and uses the invitation token (URL parameter) as the auth surface. The `invitation` table has RLS allowing read by token. The invitee has no workspace context at call time — `auth.workspaceId` cannot be resolved. `workspace-api`'s `resolveAuth` (line 102 of `supabase/functions/workspace-api/index.ts`) hard-requires `auth.workspaceId`; routing through the gateway is architecturally impossible without inventing a new auth strategy.
- **`create-invitation`** is a JWT-authenticated write with side effects (SendGrid + Twilio dispatch). ADR-0029 already permits webhook and external-dispatch endpoints to remain standalone.

Steward (Council 2026-04-17) initially proposed a new `identity-api` gateway tier. Supervisor's code-trace showed this would be L effort with high regression risk and currently only two consumers. YAGNI until the 3rd pre-workspace endpoint lands.

## Decision Drivers

- The pre-workspace flow set is **two endpoints** today. A gateway tier for two endpoints is speculative overhead.
- The invitation token is a strong auth surface (UUID with RLS guard), not a bypass.
- Forcing the endpoints through `workspace-api` would require changing `resolveAuth` to accept "token-as-auth" — a wider change than the drift it claims to fix.
- The ontology concern (identity-boundary is real) is best captured as a named exception with a tripwire clause, not as implementation.

## Considered Options

1. **Build `identity-api` gateway tier** — new Edge Function peer of `workspace-api`, owns all pre-workspace flows. L effort, high risk, speculative.
2. **Amend ADR-0029 with explicit exceptions list + tripwire clause.** Documents the pattern, prevents future audit false-positives, sets a named threshold for revisiting.
3. **Do nothing.** Audit will flag the same drift repeatedly; no canonical answer exists.

## Decision Outcome

Chosen option: **Option 2 — amend ADR-0029 with an explicit exceptions list and a tripwire clause.**

The amendment adds two sections to ADR-0029:

### Section: Permitted Exceptions to the Gateway

The following Edge Functions MAY remain standalone (not routed through `workspace-api`) because of structural constraints:

| Function | Reason | Auth Surface |
|---|---|---|
| `accept-invitation` | Pre-workspace — invitee has no `auth.workspaceId` | Invitation token (UUID) with RLS guard on `invitation` table |
| `create-invitation` | Write-with-external-dispatch (SendGrid + Twilio); already permitted by ADR-0029 webhook exception | JWT + `admin/owner` role check via `resolveInviterProfile` |

### Section: Identity-Boundary Tripwire

When a **third** pre-workspace Edge Function is proposed (company creation, magic-link verify, social-signup callback, or similar), open a new ADR proposing the `identity-api` gateway tier. Three pre-workspace endpoints is the threshold at which a dedicated gateway amortizes its own complexity. Two does not.

The `smartout-edge-function-guide` skill is updated to include a checklist item:

> **Pre-workspace?** If the endpoint's caller has no active workspace (invite tokens, signup flows, identity-link callbacks), it MAY stay standalone per ADR-0123. Count the current pre-workspace set; if this would be the 3rd, open an identity-api gateway ADR.

## Rules & Consequences

- **Good, because** no speculative infrastructure; the current two endpoints keep their working auth contracts.
- **Good, because** future audits have a canonical answer — these exceptions are known and registered.
- **Good, because** the tripwire clause provides a named escalation point; future me / future Claude / future engineer sees the rule.
- **Bad, because** the tripwire depends on future contributors remembering to count pre-workspace endpoints. Mitigation: checklist in `smartout-edge-function-guide`.
- **Agent Impact:** No agent capability currently invokes either exception endpoint. Adding one in the future requires the capability to handle pre-workspace auth (token-based or session-bootstrap).

---

> Registered in `docs/decisions/0000-decision-log.md`. Amends ADR-0029. Updates `smartout-edge-function-guide` skill (pre-workspace checklist).
