---
title: "Handoff — Billing Engine Fase 1"
status: done
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [handoff, billing, fase-1, closure]
---

# Handoff — Billing Engine Fase 1

> Closure document per CLAUDE.md Mandatory: Feature Closure. Summarises what was built, decisions made, learnings captured, known issues, and Fase 2 scope.

---

## 1. What was built

Smartout's internal invoice engine ("fakturamotor"). 6 batches across 55+ commits:

| Batch | Phases | Scope |
|---|---|---|
| B1 | 0 + 1 | 4 ADRs (0118–0121) + 11 SQL migrations + pgTAP |
| P1.5 | housekeeping | 5 must-fix-before-B2 items + ADR-0122 amendment |
| B2 | 2 + 3 + 5 | Telemetry registry (12 events) + `@smartout/billing` package + `InvoiceStatusBadge` + billing-UI ESLint fence |
| B3 | 4 | `generate-monthly-invoices` Edge Function + n8n runbook |
| B4 | 6 + 7 | Platform-admin list/detail/dialogs + 4 mutation Server Actions |
| B5 | 7 (cont.) + 8 + 10 | markUncollectible/updatePricingTerms/resolveDrift + Dunning kanban + Drift panel + CSV export + workspace-admin read |
| B6 | 11 + 14 | `billing_query` AI capability + 5 tools + authority seed + user journeys + this handoff |

End state at tip of `feat/billing-engine-fase-1`:
- 13 migrations shipped (11 Phase 1 + 1 P1.5 pricing-terms-uniq + 1 B6 authority seed)
- 5 ADRs in `docs/decisions/` (0118, 0119, 0120, 0121, 0125)
- 12 billing events in `packages/telemetry/src/registry.ts`
- 1 Edge Function (cron generator)
- 7 Server Actions (mark_paid, void, credit_note, dunning_note, uncollectible, pricing_terms, drift_resolve)
- 11 UI files in `/platform-admin/billing/**` + 2 in `/dashboard/billing/**`
- 1 new workspace package (`@smartout/billing`)
- 1 AI capability with 5 read-only tools

---

## 2. Decisions (all ADRs)

### ADR-0118 — Invoice Engine as C3 Commercial Consumer

Placed billing at C3 Commercial Control Plane (not D6, not standalone). Rationale: C3 owns the value→cost attribution contract; billing reads cascade-derived coefficients without driving them. Also formalised the `company_id` scoping exception (billing is company-scoped, not workspace-scoped — one billing contract per legal entity even when a company operates multiple workspaces).

### ADR-0119 — Usage Snapshot Reproducibility

Defined the predicate for counting active users:

```sql
count(DISTINCT employee_id)
FROM schedule_shift
WHERE workspace_id = ? AND status = 'completed' AND employee_id IS NOT NULL
  AND shift_date BETWEEN period_from AND period_to
```

`usage_snapshot` stores `counted_profile_ids` (jsonb receipt) and `source_query_hash` (sha256 of query inputs). Makes every billing-period count reproducible from the DB alone; `basis_drift_event` trigger watches for retroactive `schedule_shift` edits that would change a frozen count.

### ADR-0120 — Invoice Immutability + Credit Note Policy

Norwegian bokføringslov §5 compliance: continuous `invoice_number_seq` allocated on draft→issued transition, `AFTER DELETE` triggers prevent row deletion, corrections only via credit notes with `credits_invoice_id` FK. `prevent_nested_credit_notes` trigger blocks a credit note crediting another credit note.

Amended (Phase 1.5) to relax the §5 legality matrix — original spec used pre-rename enum values and didn't permit the realistic dunning flow (`sent + reminder_sent`, `sent + escalated`). New matrix: terminal statuses (draft/paid/void/uncollectible) require `dunning_status IS NULL`; active statuses (issued/sent/overdue) accept any enum value.

### ADR-0121 — pricing_terms Extension for Billing

Added 5 columns to `pricing_terms`: `free_users`, `overage_price_per_user`, `delivery_channel`, `invoice_format`, `agreement_period` (daterange). Extended in P1.5 with `invoice.pricing_terms_id` FK — the cron generator snapshots the exact pricing_terms row used at invoice issue time. `get_invoice_basis()` reads this FK first, falls back to date-range lookup for legacy rows. Protects audit integrity against retroactive `pricing_terms.effective_from` edits.

### ADR-0125 — billing_activity_log as Platform-Scoped Audit

Originally ADR-0122 on this branch; **renumbered to 0125** at merge-prep to avoid collision with main's `0122-governance-telemetry-quad-destination.md` (landed via `45720af1` while this branch was in flight). Supersedes ADR-0118's original claim that dunning audit goes to `activity_trail` — `activity_trail.actor_id` is a FK to `profile` (workspace-scoped) and cannot admit platform admins (who have no workspace profile). Dedicated `billing_activity_log` has `actor_user_id → user_identity` instead + company-scoped RLS via `is_admin_in_company`. Company_id resolution in the telemetry provider is DB-verified (not caller-trusted) — defence against emit-payload spoofing from other cron Edge Functions sharing `WATCHDOG_CRON_SECRET`.

---

## 3. Learnings

### 3.1 Schema-drift preflight is the highest-value step in any multi-migration batch

Logged to `~/dev/second-brain-v2/registry/research/log.md`. Before starting B1, a 5-minute grep of the plan's SQL against `packages/supabase/src/database.types.ts` caught four column-name drifts the plan author had missed:

- `engine_process.process_key` — real PK is `id TEXT`; steps live in separate `engine_step` table
- `activity_trail.actor_user_id` — real column is `actor_id UUID REFERENCES profile` (workspace-scoped)
- `schedule_shift.shift_id` — real PK is `schedule_shift_id`
- (plus `engine_process.definition jsonb` — doesn't exist)

Each would have caused a migration failure at Task 1.7/1.8/1.10. Adding this preflight saved an estimated 2–3 hours of failed-migration cycles and triggered ADR-0125 authoring (the `activity_trail` drift forced a rethink of the dunning audit destination).

**Rule:** before any migration batch of 3+ files, grep `NEW\.|OLD\.|public\.[a-z_]+` in the plan and cross-reference `database.types.ts`.

### 3.2 `npx supabase gen types typescript --local` silently leaks stderr into the output

Caught during B1 typecheck gate. Default invocation writes `npm warn`, `WARN: environment variable`, and `Connecting to db` lines as the first three lines of `database.types.ts`. The file looks fine until `tsc --noEmit` fails with `TS1435` at line 1. Fix: always redirect stderr — `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts`. Added to the repo's research log as a permanent gotcha.

### 3.3 pgTAP location dichotomy: only `supabase/tests/migrations/*.spec.sql` runs under `npx supabase db test`

Legacy `supabase/tests/*.sql` files (api-key-lifecycle, derivation, etc.) use DO-block format and fail with "No plan found in TAP output" under the test runner. New pgTAP tests MUST go in `supabase/tests/migrations/` with `SELECT plan(N); ...; SELECT * FROM finish(); ROLLBACK;` format. Used `20260415_governance_training_mvp_phase0.spec.sql` as the template.

### 3.4 Commit-ordering vs test-dependency atomicity

In P1.5, pgTAP Test 7 (has_column `pricing_terms_id`) was committed in commit N while the column itself arrived in commit N+1. `git checkout <N>` would fail the test in isolation. Shipped together, quality gates pass. Documented as an acceptable imperfection per supervisor's "cohesive single spec file > bisect hygiene" verdict. For future batches: prefer migration-then-test commit order.

### 3.5 ADR number coordination across parallel branches

ADR-0122 was written on this branch in B1 (billing_activity_log) while an unrelated session committed ADR-0122 (governance-telemetry-quad-destination) to `development` at commit `45720af1`. Collision forced a 17-file rename in B6 when we verified via `git ls-tree origin/development`. Supervisor argued "rebase now" was cheaper than "rename at merge" — ~17 refs vs 20+ had we deferred. Future rule: when writing a new ADR on a long-running feature branch, check `origin/development` ADR numbers with `git ls-tree` at the start of each batch, not only at merge.

### 3.6 Actor_id dual-semantics: profile_id vs user_identity.user_id

`BaseEvent.actor_id` is documented as `profile_id` in `packages/telemetry/src/registry.ts`. Billing events reinterpret the field as `user_identity.user_id` because platform admins have no workspace profile. The override is documented inline in the registry comment, the `billing-activity-log.ts` provider, and MODULE_BILLING.md §5, but no formal ADR exists. Steward deemed this acceptable given the inline documentation; a follow-up ADR or a separate `actor_user_id` optional companion field on `BaseEvent` is possible future work.

### 3.7 Security: provider must verify, not trust, `data.company_id`

First cut of `billing-activity-log.ts` trusted the caller-supplied `data.company_id`. B2 final code-reviewer found this — WATCHDOG_CRON_SECRET is shared across multiple cron Edge Functions; any compromised caller could spoof a company_id and write arbitrary audit rows. Hardened to always DB-verify: invoice_id path looks up `invoice.company_id`; no-invoice path verifies the claimed company exists in `company`. Mismatches are logged and rejected.

### 3.8 Money math: round ONCE, not per iteration

B3 code-reviewer found `toMoney(sum + s.billable_users * overage_unit_price)` applied inside the reduce loop. For multi-workspace companies at fractional unit prices this accumulated ±0.01 bias per workspace, making the invoice header disagree with `Σ(line items)`. Fixed: accumulate exact products, round once at the end.

### 3.9 Calendar validity cannot be expressed as a regex

B2 code-reviewer flagged: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` admits `2024-02-30`, `2024-13-01`. Billing period boundaries drift silently into pricing_terms lookups. Fix: `.refine()` round-trip through `Date.UTC(y, m-1, d)` and verify the reconstructed date matches the components.

### 3.10 Time-slice tables need unique partial indexes

B5 code-reviewer found the updatePricingTerms race: two concurrent submits both close the active row and both insert new open-ended rows. Application-layer serialisation is flaky; DB-level prevention is reliable. Added unique partial index `ON pricing_terms (company_id, workspace_id) WHERE effective_until IS NULL`. Also: close the previous row with `effective_from - 1 day` not `today - 1 day` — dovetails exactly and eliminates any zero-coverage gap for future-dated changes.

---

## 4. Known issues + deferred work

### 4.1 Deferred from B4

- **Task 7.7 — `regenerateInvoiceDraft`** Server Action. Useful for admin dev ops when drafts need re-computation. Deferred because drafts are rare (cron runs monthly, cancels on mismatch); no production incident has required this.
- **Task 7.8 — `createOnboardingInvoice`** Server Action. Separate flow triggered from onboarding UI (outside billing hub). Deferred to the onboarding feature.
- **Task 9.1 — Company detail billing tab**. Wraps `updatePricingTerms` in the company-admin surface. Deferred to the company-admin polish pass (not billing-blocking — `updatePricingTerms` is callable from a dev tool).

### 4.2 Deferred from B6

- **Phase 12 — i18n extraction**. The billing UI currently has hardcoded Norwegian strings. Deferred because: (a) the app ships Norwegian-first, (b) every hardcoded string is traceable (platform-admin surface, not customer-facing), (c) the extraction is mechanical churn across 10+ files with low runtime value. Captured as follow-up debt — can land as a single PR when English UI is genuinely needed.
- **Phase 13.1–13.6 — Playwright E2E tests**. Written as journey docs (Journey 1–6 above) instead of runnable specs because: (a) each requires a seeded test workspace + platform-admin login + cron-triggered generator state, which this session could not safely spin up; (b) writing specs that don't run would be fabricated signal. Real E2E runs in apps/e2e/ can be added once the test-harness seeding pattern is agreed. The AI tool (Task 13.7) has real vitest coverage — that part shipped.
- **Actor_id ADR (learning 3.6)**. Documented inline; formal ADR optional.

### 4.3 Ship-blocking-if-Fase-2-starts items (none today)

All Fase 2 prerequisites are in place:
- Telemetry events registered → external dispatchers can consume.
- Invoice immutability + credit note policy → ADR-0120 holds.
- `billing_activity_log` → external-system audit writes route here.
- Provider verifies company_id → safe to grant `WATCHDOG_CRON_SECRET` to new cron callers.

---

## 5. Fase 2 scope (forward pointer)

From the spec's §15 "Fase 2 forward compat" block:

- **External dispatch:** Stripe Connect + EHF/Peppol + email (SendGrid). Each dispatch channel publishes `invoice sent` + updates `invoice.delivery_status` + `invoice.external_reference`.
- **Self-serve payments:** Stripe Checkout for card payments. `mark_paid` Server Action gains a `stripe_payment_intent_id` branch that auto-verifies payment before flipping status.
- **Customer-facing dunning:** email templates, reminder scheduling via n8n, auto-escalation thresholds.
- **Workspace-admin self-serve:** "Mark as paid" from `/dashboard/billing` when Stripe Connect isn't configured — admin self-reports offline payment.
- **Onboarding invoices:** Task 7.8 revival as part of the onboarding flow.
- **EHF compliance:** XML generation for B2B invoicing (required for government contracts).

All of these sit on the Fase 1 foundation without schema changes — the column `external_reference` + `delivery_channel` enum + `billing_activity_log.source` field carry the Fase 2 payloads.

---

## 6. Quality gates snapshot at closure

```
Typecheck:    51/51 packages
Lint:         0 errors (480 pre-existing warnings)
Vitest:       @smartout/telemetry 71/71 (+1 todo) + @smartout/ai 73/73 (+7 new billing-query)
pgTAP:        21/21 billing (13 RLS structure + 8 constraint/trigger/column)
db reset:     clean on 13 migrations
Schema-drift: preflight verified against database.types.ts at every batch boundary
Lint fence:   Phase 5.2 ESLint rule actively blocks raw color scales in billing UI
```

---

## 7. Next steps for merge

1. Review this handoff + `JOURNEY-billing-engine-fase-1.md`.
2. Optionally run a final cross-cutting council via `/run-council` — not mandated; B1/B2/B3/B4/B5/B6 each had their own council.
3. Fast-forward merge `feat/billing-engine-fase-1` → `development`. The branch contains **55+ commits** from 2026-04-17; a fast-forward is possible (branch diverged cleanly, ADR collision pre-resolved).
4. Push `development`.
5. `/close-feature <worktree>` to finalise.

Fase 2 planning picks up from §5 above.

---

**Author:** Claude Opus 4.7 (1M context) — autonomous B1–B6 execution per user instruction.
**Review:** 6 councils across the 6 batches — supervisor + steward + feature-dev:code-reviewer each batch; system-agent-coordinator for B6 Phase 11 AI work optional (skipped — no new architectural primitive, only new capability in existing pattern).
