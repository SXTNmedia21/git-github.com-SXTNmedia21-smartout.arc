---
title: "Handoff — Billing Engine Fase 2"
status: done
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [handoff, billing, fase-2, closure]
---

# Handoff — Billing Engine Fase 2

> Closure document per CLAUDE.md Mandatory: Feature Closure. Summarises what was built, decisions made, learnings captured, known issues, and Fase 2.5 / Fase 3 scope.

---

## 1. Summary — what was built + why

Billing Engine Fase 2 ("dispatch-, integrasjon- og editeringsrunden"). Where Fase 1 put the monthly invoice generator on the rails, Fase 2 gives platform + workspace admins control over **where invoices go** (dispatch), **which systems they sync to** (integration), and **what they contain after generation** (editing + ad-hoc).

40+ commits across 6 batches on `feat/billing-engine-fase-2`:

| Batch | Scope | Commits |
|---|---|---|
| B1 | Schema + RLS + canonical_json + engine_process + telemetry | 5 |
| B2 | Dispatch types/adapters/handler/actions/tests | 5 |
| B3 | Dispatch UI platform + workspace + per-invoice | 8 |
| B4 | Integration types/handler/actions/UI/tests | 6 |
| B5 | Invoice editing (line items + ad-hoc + mark-paid) | 6 |
| B6 | list_invoice_dispatches AI tool + sync_integration wiring + journeys + handoff | 4 |

End state at tip of `feat/billing-engine-fase-2`:

- 9 new SQL migrations (dispatch + integration tables + enums + RLS + canonical_json + effective_dispatch_rules + engine_process seeds)
- 5 ADRs in `docs/decisions/` (0126, 0127, 0128, 0129, 0130)
- 20+ new telemetry events on `packages/telemetry/src/registry.ts`
- 2 new engine action handlers (`dispatch_invoice`, `sync_integration`) wired into `engine-dispatch`
- ~12 Server Actions (createPlatformRule / createWorkspaceRule / suppress / retry / ad-hoc invoice / mark-paid-by-workspace / createIntegration / toggleIntegration / testConnection / retriggerSync / line-item add/update/remove)
- 10+ UI files across `/platform-admin/billing/**` + `/dashboard/billing/**` (settings pages, dispatch sections on invoice detail, integrations page, ad-hoc sheet, workspace mark-paid)
- 1 new AI tool (`list_invoice_dispatches`) on the existing `billing_query` capability
- Tests: 98 billing, 181 telemetry, 79 ai (6 new)

---

## 2. Decisions made (ADRs registered in 0000-decision-log.md)

### ADR-0126 — Integration sync via engine_process (not parallel motor)
Integration sync runs on the same `engine_process` / `engine_state` / `engine_state_step` tables that dispatch uses. Council rejected a dedicated `billing_integration_sync` table — the engine already has retry, backoff, audit, and authority hooks. Trade-off: query efficiency for history UI relies on `engine_state.entity_type = 'billing_integration'` + index; acceptable for small volumes, reconsider at scale.

### ADR-0127 — Dispatch rule 2-level with suppress semantics
Two storage levels (platform defaults = `workspace_id IS NULL`, workspace rules = scoped). Workspace rules can UNION new recipients OR SUPPRESS a matching platform rule. Resolution lives in the `effective_dispatch_rules(invoice_id, trigger_event)` SQL function — server actions + engine fan-out both consume it; **never hand-roll a UNION query**. CHECK constraint rejects platform rules with `action = 'suppress'` (they can't suppress themselves).

### ADR-0128 — invoice.delivery_\* deprecation lifecycle
`invoice_dispatch` is the new source of truth for delivery. During Fase 2 B2+ we dual-write `invoice.delivery_status` + `invoice.delivery_attempted_at` for backwards compat. **Hard drop scheduled 2026-07-01 OR at Fase 3 close**, whichever comes first. After that date: `invoice.delivery_*` columns are dropped, all readers must use `invoice_dispatch`.

### ADR-0129 — Adapter pattern with is_placeholder audit-safety
`billing_integration.is_placeholder` is the audit gate. Fase 2 ships exactly one adapter: `PlaceholderAdapter`, which returns `{status: 'mocked'}`. The `sync_integration` handler enforces bidirectional invariants:
- placeholder row + reported status = `succeeded` → audit violation + fail state
- non-placeholder row + reported status = `mocked` → audit violation + fail state

Violations emit `integration audit violation` → PostHog + billing_activity_log + Sentry alert. Prevents Fase 3 real adapters from silently regressing to mock behavior (or vice versa).

### ADR-0130 — Contract onboarding extracted to Fase 2.5
Original Fase 2 scope included "kick off onboarding when a contract is signed". Council verdict: this is its own feature with its own designer review, not a billing concern. Extracted to a future Fase 2.5 (spec not yet written). DocuSeal webhook in `contract-service` was **not touched** in Fase 2.

---

## 3. Learnings (candidates for registry/research/log.md)

### L — Parallel subagent dispatch works if file-boundaries are strict
B3 + B4 + B5 ran concurrent subagents on disjoint file trees (platform settings page vs workspace settings page vs integration UI) — zero merge conflicts. Key pattern: each subagent owned a directory, not "a feature". When two batches had to edit the same file (`packages/billing/src/index.ts` barrel, `packages/telemetry/src/registry.ts`), we sequenced them.

### L — Comment markers `{/* B3: ... */}` essential for multi-batch edits to same file
The `/platform-admin/billing/invoices/[id]` detail page gained sections in B3, B4, and B5. Explicit `{/* B3 dispatches */}` / `{/* B5 edit line items */}` markers let subagents locate their insertion points without re-reading the whole page. Without markers: three-way merge pain.

### L — Budget-checkpoint discipline (commit per step) saved work when agents hit usage limits
Every batch broke into 5–8 small commits. When an agent hit its context/usage limit mid-batch (happened twice), we resumed from the last commit — never lost more than one commit's worth of work. Monolithic commits would have forced rework.

### L — Docker-unavailable agents = pgTAP gate blocked
Agent sessions run in WSL2 with Docker Desktop integration disabled. `supabase db reset` + `supabase db test` never ran locally during Fase 2. Schema migrations were type-checked via `database.types.ts` regen (manual step) + vitest for adapter logic. **Real pgTAP validation runs in CI or on Pontus's local machine.** This must not be the rule for Fase 3 — agent environment needs Docker or a Supabase Cloud branch for schema tests.

### L — Nordic Split motion specs require explicit values in spec before implementation
Designer council in B3 caught a generic "sheet slides in" implementation — spec didn't give duration/easing, so we defaulted to Tailwind's 150ms which violated the Nordic Split 240ms convention. Lesson: specs for UI must cite Nordic Split tokens (motion.drawer.duration) not "slides in". Added to smartout-nordic-split skill as a reminder.

### L — Trust Gate discipline for AI tools that read "eventually-complete" data
`list_invoice_dispatches` couldn't ship in B4 because Fase 2 invoices didn't exist yet — empty responses would train the LLM to say "no dispatches" for every invoice. Held back to B6, after B3 completed dispatch UI + B2 telemetry put real rows in place. Tool description explicitly tells the LLM the Fase 2 cutover date so pre-Fase-2 invoices don't give false-negatives.

---

## 4. Known issues / debt

### pgTAP not executed locally (Docker blocked in agent sessions)
All 9 new migrations have pgTAP tests but none were run in the agent's WSL2 environment. **Before merging to `development`**: run `npx supabase db reset && npx supabase db test` on Pontus's local machine or via Supabase Preview. Any regression there blocks merge.

### `invoice.delivery_*` in dual-write phase
Columns remain writable until 2026-07-01 or Fase 3 close. Any code that reads these columns is on borrowed time. Grep on closure day:

```bash
rg "delivery_status|delivery_attempted_at" --type ts --type tsx
```

Expected non-test hits after deprecation: 0.

### Fase 2.5 spec not yet written
Contract onboarding (trigger engine_process from `contract.signed` webhook) extracted to Fase 2.5 per ADR-0130. No spec, no ADRs, no work. Next time someone asks "what happens after a contract is signed?", they'll find the gap.

### billing_integration_sync history UI reads engine_state
Query pattern: `SELECT * FROM engine_state WHERE entity_type='billing_integration' AND entity_id=$1 ORDER BY started_at DESC LIMIT 20`. Uses `idx_engine_state_entity` (exists). At 10k+ sync rows per integration this will still be fast; at 1M+ we'd want a dedicated index or snapshot table. Revisit at Fase 3 scale.

### Workspace-admin integration CRUD deferred to Fase 3
Platform admins can create/toggle/test integrations. Workspace admins cannot — Fase 2 kept integration config platform-owned. Self-service workspace integrations (especially for own Fiken/Tripletex) is Fase 3 scope. UI hints ("Ta kontakt med support") are present but no action buttons.

### Ad-hoc invoice type column not yet filtered in platform list
`invoice_type IN ('recurring','ad_hoc','credit_note')` but the platform invoice list shows all types undifferentiated. Low-priority UI polish — admins can filter by status today. Added to billing backlog.

### `deno check` not wired into CI for Edge Functions
Agent couldn't run `deno check` locally (node_modules resolution fails without `deno install`). Relied on structural type safety between Node-side + Deno-side types. Supabase deploy CI will surface drift — but there's no pre-merge check. Fase 3 TODO: run `deno check` on all `supabase/functions/**` in the web CI pipeline.

---

## 5. Next steps

### Immediate (before merge to `development`)

1. Run full pgTAP suite locally: `npx supabase db reset && npx supabase db test`.
2. Sanity: open `/platform-admin/billing/settings/dispatch` + `/platform-admin/billing/integrations` + `/dashboard/billing/dispatch` end-to-end on preview.
3. Spot-check Botsson: "Ble faktura X sendt ut?" on a paid workspace with Fase 2 invoices — confirm `list_invoice_dispatches` narration.
4. Decide merge strategy: fast-forward to `development` (clean linear history) or open PR `feat/billing-engine-fase-2 → development` for CI validation.

### Fase 2.5 (contract onboarding)

Scope: listen for `contract.signed` from DocuSeal webhook → spawn an onboarding `engine_process` (new blueprint) → assign onboarding tasks to the newly-bound workspace admin → track completion. Separate spec + designer council + new ADRs.

### Fase 3 (real adapters + self-service)

- Stripe Connect adapter (real HTTP adapter, not placeholder)
- EHF XML generation + delivery (Norwegian e-invoice standard)
- Automated dunning (reminders + escalation — Fase 1 shipped the dunning_status state machine, Fase 3 automates transitions)
- Bidirectional integration sync (inbound webhooks from Fiken/Tripletex for payment events)
- Workspace-admin integration CRUD (self-service)
- Drop `invoice.delivery_*` (ADR-0128 hard drop)
- `deno check` in CI for Edge Functions
- Revisit integration history UI at scale

---

## 6. Files worth knowing about

### New (Fase 2)

- `packages/billing/src/dispatch/` — adapter interface + 4 adapters (sendgrid, http-api, email-internal, email-customer)
- `packages/billing/src/integrations/` — PlaceholderAdapter + tests
- `packages/billing/src/actions/dispatch/` — enqueue / createAdHoc / retry
- `packages/billing/src/actions/dispatch-rules/` — create / update / suppress
- `packages/billing/src/actions/integrations/` — create / toggle / test-connection / retrigger-sync
- `packages/billing/src/actions/invoice-editing/` — add/update/remove line item
- `packages/billing/src/actions/workspace-mark-paid/` — workspace-scoped mark-paid
- `apps/web/src/app/platform-admin/billing/settings/dispatch/` — platform dispatch rule page
- `apps/web/src/app/platform-admin/billing/integrations/` — integrations page
- `apps/web/src/app/dashboard/billing/dispatch/` — workspace dispatch settings
- `apps/web/src/app/dashboard/billing/invoices/[id]/` — workspace detail with mark-paid
- `supabase/functions/engine-dispatch/handlers/sync-integration.ts` — integration sync handler
- `packages/ai/src/capabilities/billing-query/tools.ts` — +1 tool (`list_invoice_dispatches`)

### Migrations (supabase/migrations/20260511200***)

- `200000_billing_fase2_enums.sql`
- `200001_canonical_json.sql`
- `200002_billing_dispatch_rule_table.sql`
- `200003_invoice_dispatch_table.sql`
- `200004_billing_integration_table.sql`
- `200005_invoice_line_item_immutability.sql`
- `200006_billing_fase2_rls_policies.sql`
- `200007_billing_dispatch_rule_evaluation.sql` (effective_dispatch_rules function)
- `200008_billing_fase2_engine_processes.sql` (seeds)

### ADRs
- `docs/decisions/ADR-0126-integration-sync-engine-process.md`
- `docs/decisions/ADR-0127-dispatch-rule-two-level-suppress.md`
- `docs/decisions/ADR-0128-invoice-delivery-deprecation.md`
- `docs/decisions/ADR-0129-adapter-placeholder-audit.md`
- `docs/decisions/ADR-0130-contract-onboarding-fase-2-5.md`

### Spec
- `docs/superpowers/specs/2026-04-17-billing-engine-fase-2-design.md`
