---
title: "workspace_id filter read-side parity — ADR-0151 extension"
id: ADR-0423
status: accepted
layer: decision
created: 2026-05-25
updated: 2026-05-25
---

# ADR-0423: workspace_id Filter Read-Side Parity (ADR-0151 Extension)

## Context and Problem Statement

[[ADR-0151]] established server-derived `workspace_id` on all WRITE paths to defend against
forgery via request body. The read-side equivalent was never codified. Sim council
2026-05-25 found `packages/ai/src/capabilities/communication/audience-resolver.ts:59-73`
querying `timesheet.time_entry WHERE punch_out IS NULL LIMIT 500` under service-role with
**no `workspace_id` filter**. The `all` branch at line 50-54 of the same file DOES filter
`.eq("workspace_id", workspaceId)` — asymmetric within one file.

The same pattern at `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts:46-61`
(browser-side, anon-key, but service-role-equivalent for the read scope).

Impact: a `publish_announcement` capability call from workspace A may include `time_entry`
rows from workspaces B/C/D in the `on_duty` audience set. Cross-tenant audience leak.
ADR-0151 sibling on the read axis.

L-0177 (silent fallback) is the write-side variant of this exact class. Per ADR-0151 the
attack vector is "body-supplied identifier"; here the attack vector is "missing filter under
elevated privilege."

## Decision Drivers

- Multi-tenant SaaS: cross-tenant data exposure = GDPR class-A finding
- Service-role bypasses RLS — the SQL clause is the ONLY defense
- ADR-0151 logic generalizes to reads: server MUST derive `workspace_id` from authenticated
  context, not from request body OR from absence of filter
- L-0177 sibling — same root cause pattern, opposite axis

## Considered Options

1. **A** — Fix audience-resolver in-place, no rule
2. **B** — Codify rule: every service-role read on workspace-scoped table MUST filter
   `workspace_id` OR explicitly emit cross-workspace audit event
3. **C** — Disable service-role on read paths, force JWT context everywhere

## Decision Outcome

**Chosen: Option B.**

**Rule:** Any database read using `service_role` (or `serviceClient`) against a
workspace-scoped table MUST include either:

(a) `.eq("workspace_id", ctx.workspaceId)` filter where `ctx.workspaceId` is server-derived
    per ADR-0151, OR
(b) Explicit `emit('platform.cross_workspace_read', { table, reason, ... })` registered audit
    event documenting the cross-workspace deferral rationale

Detection: pre-merge audit rule. AST scan for service-role clients calling `.from()` on
workspace-scoped tables (allowlist of table names from `database.types.ts` filtered to those
with `workspace_id` column). Each call must have a `.eq("workspace_id", ...)` chain OR a
sibling `emit` call referencing `platform.cross_workspace_read`.

## Rules & Consequences

- **Good:** Closes BUG-SIM-11 + 2 similar resolvers found in the same audit (use-broadcast-
  recipients pattern same defect propagated)
- **Good:** Extends ADR-0151 invariant symmetrically — write + read protected equally
- **Good:** Audit rule prevents re-emergence
- **Bad:** Some legitimate cross-workspace reads exist (platform-admin queries, billing
  reconciliation) — escape hatch via registered audit event must work cleanly
- **Bad:** `timesheet.time_entry` doesn't carry `workspace_id` directly — fix requires JOIN
  to `public.profile` for workspace resolution; needs view or function

## Agent Impact

When writing any capability tool, Server Action, BFF route, or EF that reads from a
workspace-scoped table using `serviceClient` / service_role:

1. Add `.eq("workspace_id", ctx.workspaceId)` filter where `ctx.workspaceId` derives from
   JWT or upstream-resolved context, NOT from request body (ADR-0151)
2. If cross-workspace read is intentional, emit `platform.cross_workspace_read` with reason
3. Tables without `workspace_id` column (e.g. `timesheet.time_entry`) require JOIN-based
   filter via `public.profile` — see `audience-resolver.ts` post-Sortie-D for the pattern

## References

- 11-agent restaurant-week sim council 2026-05-25
- BUG-SIM-11 — audience-resolver workspace bleed
- [[ADR-0151]] — server-derived workspace_id (write-side parent)
- L-0177 — silent fallback (write-side sibling)
