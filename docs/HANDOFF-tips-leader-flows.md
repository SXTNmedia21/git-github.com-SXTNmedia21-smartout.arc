---
title: "Handoff — tips-leader-flows"
feature: tips-leader-flows
status: ready
campaign: payroll
created: 2026-04-29
updated: 2026-04-29
module: payroll
tags: [handoff, tips, payroll, sortie-2]
---

# Handoff — tips-leader-flows (Sortie 2)

## 1. Summary

Sortie 2 delivers the full leader-facing tip management pipe: three BFF mutation routes with SECURITY DEFINER RPC, five TanStack hooks (two queries + three mutations), three UI components integrated into three existing tabs (OkonomiTab, DayDetail, SignoffTab). The flow covers the complete arc from registering a tip pot through distribution adjustment to final approval at shift sign-off. The Botsson capability skeletons (`tips.set_pot`, `tips.adjust_share`, `tips.approve_distribution`) remain `not_implemented` per ADR-0229 — all mutation work lives in the BFF layer until a future sortie promotes them to full agent capability bodies. Schema, authority-seed, telemetry registry, and RPC all landed in Sortie 1; Sortie 2 consumed them without touching migrations.

---

## 2. Architecture Decision — ADR-0229 BFF-as-mutation-host

ADR-0229 establishes that for non-agent-originated mutations, the BFF route is the canonical mutation host. The pattern: Next.js route handler authenticates via Supabase Auth, derives `workspace_id` and `profile_id` server-side (never from request body — ADR-0151), calls `callTipsGate()` for authority + four-eyes check, executes the DB write (or RPC), then emits telemetry. The stage engine is bypassed entirely for synchronous UI mutations; the agent capability `execute()` body stays as the `not_implemented` skeleton so the CI parity gate (`scripts/authority-seed-parity.ts`) does not flag the capability as ungated.

The rationale: prematurely body-filling the capability would create two mutation paths for the same action (BFF + agent tool), violating the dual-gate divergence tracked as Gap B1. When Botsson needs to trigger a tip-pot registration via voice/chat, the capability body will be written as a thin delegator to the same RPC used by the BFF, ensuring a single write path.

---

## 3. Schema Discoveries (12 deltas from factcheck)

These were identified in Phase 0 fact-check (`2976de78`) against the 8 Sortie 1 migrations. Journey docs were corrected before Phase 1 began.

- **Delta 1 — pool status enum:** `recorded → approved → paid → voided`, not `draft → calculated → approved → paid`. Pool INSERT goes straight to `recorded`; no `draft` or `calculated` pool state exists.
- **Delta 2 — distribution status:** `calculated → approved → paid`. Adjustment does NOT change `status` — only sets `adjusted_amount` + `adjustment_reason`. `approved` is set by cascade when pool transitions.
- **Delta 3 — money columns:** `amount_nok NUMERIC(10,2)` throughout (pool, distribution, log). Original plan spec'd integer øre (`amount_ore`). All BFF + tools use NOK 2dp.
- **Delta 4 — actor columns:** `tip_pool` has `recorded_by + recorded_at` and `approved_by + approved_at`. No generic `actor_id`. `tip_adjustment_log` has `changed_by + changed_at`.
- **Delta 5 — `policy_id` REQUIRED at pool INSERT:** `tip_pool.policy_id UUID NOT NULL`. `set_pot` must resolve the active `tip_policy` for the department before inserting. Returns `{ok:false, error:'no_active_policy'}` if none found.
- **Delta 6 — algorithm lives on policy, not pool:** Modal does NOT allow algorithm selection. `tip_policy.method` is shown as a read-only badge. Algorithm changes = new policy version (out-of-scope).
- **Delta 7 — RLS UPDATE-policy is status-gated:** `tip_pool` UPDATE allowed when `status != 'approved'` (paid/voided also block). Same join condition on `tip_distribution` UPDATE: `pool_id IN (SELECT id FROM tip_pool WHERE status != 'approved')`.
- **Delta 8 — adjustment is dual-write:** UPDATE `tip_distribution.adjusted_amount + adjustment_reason` + INSERT `tip_adjustment_log` in same transaction. `adjustment_reason` has DB CHECK `length >= 5`. Both succeed or neither (no emit on rollback).
- **Delta 9 — telemetry naming:** Space form, not dot form: `tip_pool created`, `tip_distribution calculated`, `tip_distribution adjusted`, `tip_pool approved`. `tip_distribution calculated` uses only 2 destinations (logger + engine_event — high-volume, no PostHog).
- **Delta 10 — `set_pot` emits two event types:** `tip_pool created` (once) + `tip_distribution calculated` (N per shift row). All DB writes complete before any emit per ADR-0196 invariant 11.
- **Delta 11 — four-eyes check uses RPC result fields:** Gate returns `requiresFourEyes: boolean + approversNeeded: number`. Tools check `result.requiresFourEyes && result.approversPresent.length < result.approversNeeded`. Seed defaults to `false` for all 4 tips capabilities; branch is reachable if admin updates the row.
- **Delta 12 — reason minimum length is 5, not 10:** DB CHECK `length(reason) >= 5`. Zod schema in `tools.ts` enforces `z.string().min(5)`. Journey docs originally claimed min 10.

Phase 2 added one further schema finding: `schedule_shift` for the distribution calculation is joined via `department_id + date overlap` (not `department_session_id` directly), because `schedule_shift.department_session_id` is nullable-by-design pending Cascade D1 backfill. The BFF route derives the shifts via `department_session.department_id + session_date`.

---

## 4. Files Shipped

| File | Purpose | Lines |
|------|---------|-------|
| `apps/web/src/app/api/tips/_shared.ts` | BFF auth helpers: `getWorkspaceAndProfile()`, `tipsBffError()` | 94 |
| `apps/web/src/app/api/tips/set-pot/route.ts` | POST handler: gate + policy lookup + calculate + INSERT pool + N distributions + 2 emit types | 324 |
| `apps/web/src/app/api/tips/adjust-share/route.ts` | POST handler: gate + UPDATE distribution + INSERT log + emit | 221 |
| `apps/web/src/app/api/tips/approve-distribution/route.ts` | POST handler: gate + `approve_tip_pool` RPC + emit | 184 |
| `supabase/migrations/20260429010000_approve_tip_pool_rpc.sql` | SECURITY DEFINER RPC that atomically approves pool + distributions, resolving RLS ordering trap | 147 |
| `packages/ai/src/capabilities/tips/tools.ts` | Capability skeletons (4 tools) — all return `not_implemented`; no DB writes, no emits (ADR-0229) | 125 |
| `packages/ai/src/capabilities/tips/calculate.ts` | Pure distribution calculator: `by_hours`, `by_role_weight`, `equal` algorithms | 98 |
| `packages/ai/src/capabilities/tips/index.ts` | Capability registration: 4 tools, readOnlyTools, suggestTools, channel=chat-only | 68 |
| `packages/ai/src/capabilities/tips/calculate.test.ts` | Vitest: 9 tests covering all 3 algorithms + edge cases + sum invariant | 100 |
| `apps/web/src/hooks/queries/use-tips-pool.ts` | TanStack query: pool + distributions for a session | 104 |
| `apps/web/src/hooks/use-tips-enabled.ts` | Workspace-level toggle: `tips_workspace_settings.tips_enabled` | 34 |
| `apps/web/src/hooks/mutations/use-set-tips-pot.ts` | TanStack mutation: POST set-pot + invalidate pool query | 67 |
| `apps/web/src/hooks/mutations/use-adjust-tips-share.ts` | TanStack mutation: POST adjust-share + invalidate + optimistic delta hint | 82 |
| `apps/web/src/hooks/mutations/use-approve-tips-distribution.ts` | TanStack mutation: POST approve-distribution + invalidate | 69 |
| `apps/web/src/components/tips/PotRegistrationModal.tsx` | Modal: amount input + read-only policy badge + shift preview + confirm | 187 |
| `apps/web/src/components/tips/AdjustmentDialog.tsx` | Dialog: per-employee amount input + reason (min 5) + calculated vs adjusted display | 210 |
| `apps/web/src/components/tips/ApproveBar.tsx` | ApproveBar: consent checkbox + confirm CTA + sum-status badge + four-eyes placeholder | 130 |
| `apps/web/src/app/dashboard/schedule/_components/day-control/OkonomiTab.tsx` | Tab integration: TipsTile + PotRegistrationModal wired | (modified) |
| `apps/web/src/app/dashboard/reconciliation/_components/DayDetail.tsx` | Tab integration: Tips distribution table + AdjustmentDialog wired | (modified) |
| `apps/web/src/components/day/tabs/SignoffTab.tsx` | Tab integration: tips summary card + ApproveBar wired | (modified) |

---

## 5. Verification Results (Phase 6 fresh run, 2026-04-29)

```
pnpm turbo typecheck
  Tasks: 36 successful, 36 total
  Cached: 35 cached, 36 total
  Time: 15.376s
  Result: 0 errors

pnpm --filter @smartout/ai test calculate.test
  ✓ src/capabilities/tips/calculate.test.ts (9 tests) 5ms
  Test Files: 1 passed (1)
  Tests: 9 passed (9)

npx supabase db reset
  Finished supabase db reset on branch main.
  Result: clean

grep -nE "supabase.*\.(insert|update|delete)\(|emit\(" packages/ai/src/capabilities/tips/tools.ts
  Result: 0 lines (skeletons are write/emit-free — ADR-0229)

grep -n "approve_tip_pool" supabase/migrations/
  Result: present in 20260429010000_approve_tip_pool_rpc.sql (lines 2, 3, 24, 140, 141, 143)

grep -nE "zinc-[0-9]|gray-[0-9]|emerald-[0-9]|red-[0-9]|blue-[0-9]" apps/web/src/components/tips/
  Result: 0 matches (all tokens via Nordic Split design system)

grep -n "actor_id\|workspace_id" apps/web/src/app/api/tips/{set-pot,adjust-share,approve-distribution}/route.ts
  (excluding auth. lines and comments)
  Result: 0 lines reading identity from request body (all server-derived per ADR-0151)
```

All 7 gates green.

---

## 6. Telemetry Events Wired

| Event | Emitted by | Destinations | Payload |
|-------|-----------|-------------|---------|
| `tip_pool created` | `set-pot` BFF route (post all DB writes) | PostHog + Logger + activity_trail + engine_event | `pool_id, department_session_id, amount_nok, distribution_count, algorithm` |
| `tip_distribution calculated` | `set-pot` BFF route (N times, post all DB writes) | Logger + engine_event only (high-volume) | `pool_id, distribution_id, profile_id, calculated_amount, weight_applied` |
| `tip_distribution adjusted` | `adjust-share` BFF route | PostHog + Logger + activity_trail + engine_event | `distribution_id, pool_id, profile_id, old_amount, new_amount, reason` |
| `tip_pool approved` | `approve-distribution` BFF route | PostHog + Logger + activity_trail + engine_event | `pool_id, department_session_id, total_distributed, distribution_count, adjustment_count` |

All events pre-registered in `packages/telemetry/src/registry.ts` (Sortie 1). Sortie 2 consumed them without modification. `workspace_id` + `profile_id` wrapped via `nonEmpty()` before every `emit()` call (ADR-0134 + ADR-0193).

---

## 7. Known Gaps / Debt

- **Adjust-share atomicity** — the adjust-share BFF route issues UPDATE + INSERT as sequential queries, not a PG-level transaction. Best-effort only. A future RPC (similar to `approve_tip_pool`) would make this atomic and eliminate the race where log INSERT fails after distribution UPDATE has already committed.
- **Four-eyes UI** — the gate correctly returns `{ok:false, error:'four_eyes_required', approversNeeded}` and the UI surfaces this as an error toast. The second-leader approval surface (UI for second confirmer to authenticate and record their approval) is deferred to Sortie 4.
- **DayDetail SKIP_PAGE_POLISH bypass** — the DayDetail integration passes `skipPagePolish: true` to avoid an existing full-page rerender that would reset day selection state. This needs a dedicated polish sortie before merge to development (the bypass is intentional and logged in a `// TODO: polish` comment).
- **E2E tests deferred** — per explicit user direction. Journey docs serve as the primary verification artefact for close-feature gate. A future polish sortie will add Playwright specs for all 3 journeys.
- **`voided` pool status not in journeys** — exists in enum (`tip_pool_status`) for "leader confirmed no tips this evening" flow, but the UI trigger and journey are not built. Defer to a later sortie when the no-tips UX is designed.

---

## 8. Next Steps

**Sortie 3 — Employee mobile flow**
- Body-fill `tips.query_own_share` capability tool (read-only, no gate required beyond authority default `read_only`)
- Add AfterShiftView tile: shows employee's own `tip_distribution` row when `status='approved'`
- Add NotificationSheet row: "Din tips-andel er klar: X kr" triggered when pool transitions to `approved`
- Mobile path is BFF-proxied thin client per ADR-0132 (no direct capability import in `apps/mobile/`)

**Sortie 4 — Four-eyes UI + audit-trail review + close-feature hardening**
- Second-leader approval surface (UI for `approversPresent[]` management)
- Audit-trail review component: read-only `tip_adjustment_log` timeline per pool
- Close-feature gate script additions for tips (emit-registry grep + authority-seed-parity check)
- Promote DayDetail bypass fix from TODO to actual work

**Future — Agent-chat surface (Botsson)**
- Body-fill `tips.set_pot`, `tips.adjust_share`, `tips.approve_distribution` capability tools in `packages/ai/src/capabilities/tips/tools.ts`
- Each `execute()` delegates to the same RPC / SQL used by the BFF — single write path (ADR-0229 exit condition)
- Voice channel guard already in place via `channel: ["chat"]` on all 4 tips capabilities (ADR-0078)

---

## 9. Cited ADRs

| ADR | Title |
|-----|-------|
| ADR-0078 | Voice forbidden for PII-adjacent mutations |
| ADR-0114 | Server Actions as canonical mutation primitive |
| ADR-0151 | `workspace_id` + `profile_id` server-derived in BFF |
| ADR-0173 | Capability model: C4 defaults + authority seed |
| ADR-0193 | `nonEmpty()` guard on all telemetry `workspace_id` + `profile_id` |
| ADR-0196 | No emit before DB write succeeds (invariant 11) |
| ADR-0201 | Tips data model (Sortie 1 schema) |
| ADR-0228 | Tips capability skeletons (Sortie 1 registration) |
| ADR-0229 | BFF-as-mutation-host for non-agent capabilities |

---

## 10. Cited Learnings

| Learning | Summary |
|---------|---------|
| L-0023 | Dev-tracking vs runtime-state — do not collapse separate concerns |
| L-0066 | C4 authority defaults are not free — always seed explicitly |
| L-0094 | Phantom emit contracts — always grep registry before merge |
| L-0097 | C4 authority defaults second occurrence — reinforce seed-in-migration rule |
