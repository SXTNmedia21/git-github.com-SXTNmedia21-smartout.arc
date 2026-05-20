---
title: "Plan — billing-polish"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [plan, ui-shell, billing, polish, campaign-ui-shell]
---

# Plan — billing-polish

> Branch: `feat/ui-shell-billing-polish` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-17

## Goal

Close S12 step 7 (`/dashboard/billing` cluster — 3 routes). M4 third + final sub-sortie. Surface is mostly clean (Nordic Split compliant, ADR-0244 finance read-only enforced, 14 tools clean per T0). Polish 6 gaps + verify.

## Scope

**In scope (6 gaps from T0 recon):**
- 3 new `error.tsx` (root billing, [invoice_id], settings)
- 2 new `loading.tsx` ([invoice_id], settings — root already has one)
- Add `emit()` to `updateCompanyEhfSettings.ts` (audit-trail completeness)
- Standardize root `/dashboard/billing` header to PageHeader pattern (font-heading + page instructions)

**Out of scope:**
- Stripe SDK changes (server-side, untouched — PayNowButton correctly delegates to Server Action + StripeRedirectInterstitial per ADR-0039)
- Tool description sweep (T0 says tools clean, descriptions non-trivial — defer to optional follow-up if Pontus prioritizes)
- Dispatch-rule emit signature changes (already complete — 4 CRUD events emit)
- New capabilities, ADRs, or finance logic
- Component refactors beyond root page header

## Recon (done — see T0 haiku report)

- 3 routes, all server components
- 14 tools across 3 bridges, all read-only (ADR-0244 finance compliant), no direct DB writes in tool bodies (ADR-0204)
- 7 existing emit() calls — strong write-side coverage (markInvoicePaid x2, initiatePayment, dispatch CRUD x4)
- Loading.tsx exists on root, missing on [invoice_id] + settings
- Stripe integration server-only via Server Action + Interstitial pattern
- All mutations gated via auth (company_member role + workspace_id checks)

## Tasks

- [ ] **Track A** — Create 3 error.tsx + 2 loading.tsx (5 files total)
  - `apps/web/src/app/dashboard/billing/error.tsx`
  - `apps/web/src/app/dashboard/billing/[invoice_id]/loading.tsx`
  - `apps/web/src/app/dashboard/billing/[invoice_id]/error.tsx`
  - `apps/web/src/app/dashboard/billing/settings/loading.tsx`
  - `apps/web/src/app/dashboard/billing/settings/error.tsx`
- [ ] **Track B** — Add `emit()` to `updateCompanyEhfSettings.ts` for `company.ehf_updated` (or similar — read existing emit pattern + registry to choose event name). Add event to telemetry registry.
- [ ] **Track D** — Refactor root `/dashboard/billing/page.tsx` header: `font-heading` h1 + page instructions paragraph (Norwegian)
- [ ] **Track F** — Verify site-map.json — 3 routes registered (likely yes per contracts-polish precedent)
- [ ] **G4** — Sonnet code-reviewer pass on diff
- [ ] **H** — 2 secondary journeys (invoice-detail, settings) + HANDOFF. Primary journey covers overview.
- [ ] **Close** — `close-feature.sh` from inside worktree

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] 3/3 routes have `error.tsx`
- [ ] 3/3 routes have `loading.tsx`
- [ ] `updateCompanyEhfSettings` emits telemetry event
- [ ] Root billing page uses `font-heading` h1 + page instructions
- [ ] 3 journeys verified (overview, invoice-detail, settings) — feature: billing-polish, status: verified
- [ ] HANDOFF written
- [ ] G4 APPROVE (or APPROVE WITH MINOR ISSUES + blocker fixed)

## Risks

- **EHF emit event-name choice** — does telemetry registry have a `"company"` or `"billing"` category that fits? Build agent should grep + match existing pattern; council if no clean fit.
- **L-2026-05-04 SIGTERM noise** — 4 parallel agents on Phase 1 will trip stop-hook cascade. Known noise.
- **Registry `Record<K, V>` shape recurrence** — Track B will hit same pattern as cost-polish — build agent must extend SmartoutEvent union + EVENT_ROUTING entry (mirror cost-polish precedent).

## Next

T0 done. Dispatch Phase 1 parallel: A + B + D + F (4 sonnet agents, non-overlapping file boundaries).
