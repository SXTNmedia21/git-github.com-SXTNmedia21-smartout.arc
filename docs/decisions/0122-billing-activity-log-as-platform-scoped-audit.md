---
title: "billing_activity_log as platform-scoped audit trail for billing"
id: ADR_0122
status: accepted
layer: decision
created: 2026-04-17
updated: 2026-04-17
module: billing
tags: [adr, billing, audit, activity-trail, platform-admin, supersedes]
---

# ADR-0122: billing_activity_log as platform-scoped audit trail for billing

## Context and Problem Statement

ADR-0118 decided that dunning notes and other platform-admin billing actions would be recorded via `activity_trail` rather than a dedicated table, to preserve cascade invariant #2 ("all mutations emit through the shared trail").

Implementation attempt (Billing Engine Fase 1, Phase 1, Task 1.8) exposed two structural conflicts with that decision:

1. **Actor model mismatch.** `activity_trail.actor_id` is `NOT NULL REFERENCES public.profile(profile_id) ON DELETE RESTRICT`, and the telemetry provider (`packages/telemetry/src/providers/activity-trail.ts`) rejects any event whose `actor_id` cannot be resolved to a profile row. Platform-admin actors (identified by `user_identity.is_godmode`) have no workspace profile — they operate on the Smartout platform itself, not inside a customer workspace. Routing their actions through `activity_trail` would require either (a) falsifying a profile record, (b) making `actor_id` nullable platform-wide (ripples through every existing trail reader), or (c) silently dropping audit writes (dangerous).

2. **Scope mismatch.** Every `activity_trail` row carries `workspace_id NOT NULL` and assumes workspace-scoped reasoning. Billing operates at the **company** level — a company with three workspaces still receives one invoice. Rows with an arbitrary workspace_id would produce incorrect cross-join queries for any consumer that groups audit by workspace.

These are not bugs to be patched — they are the cascade invariants working as designed. The question is where platform-scoped audit goes.

## Decision Drivers

- **Cascade invariant #2** (all mutations emit) must hold — can be satisfied without forcing every mutation into the same table, as `basis_drift_event` already demonstrates
- **bokføringslov §5** — billing audit must be immutable, numbered/ordered, retained ≥5 years
- **Platform-admin identity** — platform-admin actions must be attributable to a `user_identity`, not a per-workspace profile
- **Company-level scoping** — invoices and pricing are company-scoped; audit must join cleanly to invoice/company, not workspace
- **RLS posture** — company admins must be able to read their own company's billing audit; platform admins (service role) have full access
- **Existing pattern** — `basis_drift_event` is already a dedicated audit table for a billing-adjacent signal; a second dedicated table is consistent, not novel

## Considered Options

1. **Smartout-as-internal-workspace** — create a Smartout-owned workspace, give each platform admin a profile there, write platform-admin actions to `activity_trail` with `workspace_id = smartout_internal`. Customer `company_id` goes in `data jsonb`.
2. **Schema change on activity_trail** — make `workspace_id` + `actor_id` nullable, document the billing carve-out in the trail provider.
3. **Dedicated `billing_activity_log` table** — new table, company-scoped, platform-admin-friendly FKs. Supersedes ADR-0118's activity_trail routing for billing.

## Decision Outcome

Chosen: **Option 3 — dedicated `billing_activity_log` table**.

### Rejected options — why

- **Option 1 (fake Smartout workspace)** conflates "Smartout as the platform operator" with "Smartout as a customer". The Smartout workspace would need pricing_terms, which it doesn't have. Pontus would need a workspace profile for administrative actions, which breaks the semantic that `profile` represents a person's role at a customer workspace. Concretely: a query like "list all platform admins" would have to grep `profile.workspace_id = smartout_internal` — that's not how the authority model (`is_godmode`) works today, and extending the profile model to carry platform-admin identity duplicates `user_identity` responsibilities.
- **Option 2 (schema change on activity_trail)** ripples through every existing audit consumer. Current readers assume `workspace_id NOT NULL` and `actor_id` resolves to a profile. Making both nullable breaks the type contract, forces every consumer to handle the null case, and offers no benefit to non-billing use cases — billing would be the only caller using the nullable path.

### Decision shape

Create a new table:

```sql
CREATE TABLE public.billing_activity_log (
  id              bigserial PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES public.company(company_id),
  invoice_id      uuid REFERENCES public.invoice(invoice_id),
  event           text NOT NULL,            -- "invoice issued", "invoice marked_paid",
                                            -- "dunning_note added", "invoice voided"
  entity_type     text NOT NULL,            -- "invoice", "invoice_line_item",
                                            -- "pricing_terms", "credit_note"
  entity_id       uuid NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}',
  changes         jsonb NOT NULL DEFAULT '{}',
  actor_user_id   uuid REFERENCES public.user_identity(user_id),  -- NULL for cron/system
  source          text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web','mobile','api','cron','system')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_log_invoice ON public.billing_activity_log(invoice_id, created_at DESC);
CREATE INDEX idx_billing_log_company ON public.billing_activity_log(company_id, created_at DESC);
CREATE INDEX idx_billing_log_event ON public.billing_activity_log(event, created_at DESC);

ALTER TABLE public.billing_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_log_company_admin_read ON public.billing_activity_log
  FOR SELECT TO authenticated
  USING (public.is_admin_in_company(auth.uid(), company_id));

-- Writes via service role only (Server Actions + cron). No authenticated write policy.
-- No UPDATE or DELETE policies — append-only by design (bokføringslov §5).
```

### Semantic rules

1. **Actor:** `actor_user_id` references `user_identity(user_id)` directly — no profile indirection. Platform admins are a natural fit. Nullable to admit cron/system writers (monthly invoice generator writes with `actor_user_id = NULL, source = 'cron'`).
2. **Scope:** `company_id NOT NULL`. No `workspace_id`. A company-with-two-workspaces shows one audit stream for the billing relationship.
3. **Immutability:** No UPDATE, no DELETE. Service role bypasses RLS but the table has no write policies for authenticated. This mirrors `activity_trail`'s immutability posture.
4. **Retention:** ≥5 years per bokføringslov §5. Operational concern (archive strategy), not schema concern.
5. **Dunning notes live here:** a dunning note is `event = 'dunning_note added'` with `entity_type = 'invoice'`, `entity_id = <invoice_id>`, `data = {"note": "...", "contact_channel": "..."}`. Supersedes ADR-0118's "via activity_trail" wording for this event class.

### Telemetry routing

Add a new `EventDestination` value `"billing_activity_log"` in `packages/telemetry/src/registry.ts`. Create provider `packages/telemetry/src/providers/billing-activity-log.ts` that interprets `event.actor_id` as `user_identity.user_id` (overriding the default `profile_id` semantics of `BaseEvent.actor_id`). Billing event types (prefix `invoice.*`, `pricing_terms.*`, `dunning.*`) route to this destination, NOT to `activity_trail`.

This preserves cascade invariant #2 (every mutation emits through the shared `emit()` primitive) while splitting the persistence layer.

## Rules & Consequences

- **Good, because** platform-admin actor model works without schema-wide ripple changes.
- **Good, because** company-scoped queries on billing audit become trivial (single FK join to `company`).
- **Good, because** bokføringslov §5 immutability is preserved via RLS posture matching `activity_trail`.
- **Good, because** `user_identity` FK means platform admins are fully identified in audit — no "anonymous service role" rows.
- **Bad, because** there are now two audit tables to query for a complete customer history (`activity_trail` for workspace events + `billing_activity_log` for billing events). Consumers that need unified view must UNION across both.
- **Bad, because** `emit()` callers must be careful: an event typed as "billing" but emitted with a profile_id in `actor_id` will succeed against `billing_activity_log` (FK to user_identity won't match → row fails to write, logged as warning). Mitigation: capability-layer authors use `getSuperAdminId()` for platform-admin actions and the telemetry provider validates.
- **Agent Impact:**
  - Server Actions in `apps/web/src/lib/billing/*` populate `actor_id` via `getSuperAdminId()` (returns `user_identity.user_id`), not `getProfileId()`.
  - The cron generator writes with `actor_id = NULL, source = 'cron'`.
  - Company-admin read-only UIs query `billing_activity_log` directly via RLS policy.
  - Any future billing mutation **must** declare `"billing_activity_log"` in its event's routing destinations; reviewers check this at PR time.

## Supersedes

This ADR **supersedes the specific claim in ADR-0118 §Rationale**:

> "Dunning notes via activity_trail (no dunning_note table) preserves cascade invariant #2."

Replace with: "Dunning notes and all platform-admin billing audit via `billing_activity_log` (ADR-0122). Cascade invariant #2 is preserved by routing through the shared `emit()` primitive; the persistence destination is billing-specific."

ADR-0118 otherwise remains `accepted`. The C3 Commercial consumer framing, the workspace_id exception, the reads-from-D6+K1b architecture, and the consequences on ADR-0119/0120/MODULE_BILLING stand unchanged.

## Related

- ADR-0118 — Invoice engine as C3 Commercial consumer (this ADR supersedes its activity_trail claim only)
- ADR-0119 — Usage snapshot reproducibility (unaffected)
- ADR-0120 — Invoice immutability + credit note policy (RLS posture inspired by bokføringslov §5 applies here too)
- ADR-0004 — Unified Telemetry & Audit Trail Engine (emit() primitive referenced; destinations are extensible)
- Plan tasks affected: 1.7.5 (new — create billing_activity_log), 1.8 (rewrite view to source from billing_activity_log), 2.1 (add destination + provider)
