---
title: "Handoff — avstemming-pages (M7c)"
status: done
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [handoff, billing, avstemming, accountant, apps-admin, m7c]
---

# Handoff — avstemming-pages (M7c)

Sub-sortie on campaign/order-system. Branch: `feat/order-system-avstemming-pages`.
Base: `campaign/order-system @ d07063750`.
Typecheck: `pnpm turbo typecheck` — exit 0, full repo.

---

## 1. Summary

M7c builds the UI layer for the admin-app settlement workflow ("avstemming"). The campaign builds `apps/admin` (admin.smartout.ai) — a separate Next.js app for accountant Erik, distinct from the main dashboard. M7b delivered the settlement engine and server-action; M7c surfaces it as four navigable pages.

**Why it matters:** Erik runs end-of-month settlement once per accounting period. He selects workspaces and a date range, the engine produces four artifacts (Sammendrag PDF, Detalj-linjer CSV, Faktura-bunke PDF, Avvik-liste PDF), and those become a permanent audit snapshot. Smartout produces base invoices only — Erik builds real invoices in his accounting system on top of the artifact data.

**What was built:**

| Surface | Type | Purpose |
|---|---|---|
| `/` (Dashboard) | Server Component | 3-card overview: period summary + Kjør button, pending invoices, last succeeded run |
| `/avstemming/run` | Server Component + Client form | Workspace checkboxes, date pickers, `runSettlement` server-action call, redirect on success |
| `/avstemming/[run_id]` | Server Component | Parallel-fetch run + artifacts, ownership re-check, `SettlementSummaryView` + `ArtifactDownloads` |
| `/avstemming/historikk` | Server Component | Last 50 runs, `HistoryTable` |
| `AdminSidebarNav` | Extension | Dashboard + Historikk entries added |
| `/api/avstemming/[run_id]/artifact/[type]` | Route Handler | Auth + RLS + ownership + 60s signed URL + fire-and-forget telemetry + 302 redirect |
| `apps/admin/src/lib/avstemming/fetchers.ts` | Data layer | 6 read-side fetchers |
| `apps/e2e/admin/avstemming.spec.ts` | E2E scaffold | 11 tests across 4 journey describes, all skipped pending M8 infra |

Scope: 5 original commits + 3 surgical follow-up fixes (R1 telemetry event names, emit-await removal on download route, Journey 3 skip-pattern alignment). 15 production files, +1697 lines.

---

## 2. Decisions Made

Both ADRs are registered in `docs/decisions/0000-decision-log.md`.

### ADR-0262 — Admin file downloads via 302-redirect to short-TTL signed Storage URLs

**Pattern:** Route Handler → `getAccountantUserId` auth → RLS-scoped query → explicit ownership re-check → `serviceRoleClient.storage.createSignedUrl(60s)` → fire-and-forget `emit()` → `NextResponse.redirect(signedUrl, 302)`.

**Rationale:** Server Actions cannot return a `Response` or redirect — they return data only. Direct public Storage URLs skip authentication entirely. Streaming files through Next.js wastes bandwidth and adds latency for multi-MB PDFs. Edge Functions are not applicable here because `apps/admin` is not a workspace-scoped tenant (ADR-0039 boundary). The 60-second TTL limits signed URL abuse without user-visible friction.

**Mandates:** Fire-and-forget telemetry on every download route — do NOT `await emit()` before redirecting, as it blocks the 302 and defeats the UX.

### ADR-0263 — Defense-in-depth ownership re-check on owner-scoped admin pages

**Pattern:** On every owner-scoped detail page and API route in `apps/admin`:
```ts
if (!entity) notFound();                          // row missing
if (entity.owner_id !== userId) notFound();       // row exists but wrong owner
```

**Rationale:** The billing schema is not yet in `database.types.ts` — every fetcher uses `as any` casts that bypass TypeScript's type-safety. RLS is the primary gate, but an `as any`-cast fetch that silently returns wrong-owner data would be invisible to the type-checker. In the single-tenant accountant model, a data leak across accountant boundaries is a GDPR catastrophe. The code-level re-check is secondary deterministic enforcement. Survives RLS regressions.

---

## 3. Learnings Discovered

Learning numbers 0186–0188 (next available after 0185 in `docs/learnings/`).

### L-0186 — Council "partial unskip" path requires per-test auth-gate analysis

**Context:** Council proposed unskipping the Journey 3 "run not found → 404" test on grounds that it was seedless. In reality, `requireAccountant()` runs before `notFound()` can fire — an unauthenticated user is redirected to `/auth/login` before ever reaching the 404 branch. Only the explicit unauth-redirect test at `/avstemming/run` is genuinely seedless and safe to unskip.

**Lesson:** When a council picks "partial unskip" path, verify each candidate test reaches its assertion under the proposed environment. Any auth gate ahead of the assertion point changes the semantics from "404 test" to "redirect test". Skipped tests that appear seedless may have an implicit auth dependency.

### L-0187 — Registry events have semantic shape beyond their TypeScript type signature

**Context:** The first telemetry pass reused the existing `kartotek viewed` event for admin dashboard page visits and artifact download tracking. That event has a `data.workspace_id` slot typed as `string`, but its semantic contract is a UUID. Passing "dashboard", "historikk", or a `run_id` as `workspace_id` silently corrupts the `activity_trail` routing and PostHog analytics. TypeScript does not catch this because `string` ⊇ UUID.

**Lesson:** Registry events are contracts, not just types. Before reusing an existing event on a new surface, verify the semantic shape of every field — not just its TypeScript type. New surface types (accountant-scoped, cross-workspace, admin-only) need new event registrations even when an existing event looks type-compatible. Fix: R1 follow-up introduced `admin.page_viewed` and `admin.artifact_downloaded` events.

### L-0188 — `billing` schema absent from `database.types.ts` creates suppression debt at scale

**Context:** `database.types.ts` does not include the `billing` schema. Every query against billing tables requires an `as any` cast on the Supabase client call. M7c introduced 6 such suppression sites in `fetchers.ts`, `actions.ts`, and `route.ts`. Each site is a correctness gap: wrong field names, wrong return shapes, and wrong nullability are all invisible to the compiler.

**Lesson:** Schema gaps in `database.types.ts` compound with feature scope. A single untyped schema used across 6 files in one sub-sortie means the debt grows proportionally with billing feature surface. Fix-plan: regenerate types with billing schema included (`supabase gen types typescript --schema billing`) and remove all `as any` casts. Tracked as M8 prerequisite.

---

## 4. Known Issues / Debt

| # | Area | Description | Severity |
|---|---|---|---|
| 1 | **billing schema typing** | 6 `as any` suppression sites in `fetchers.ts`, `actions.ts`, `route.ts`. TypeScript cannot catch field-name mismatches or shape errors in billing queries. Fix: `supabase gen types typescript --schema billing` + cast removal. | Medium — workaround pattern, not a correctness bug, but silently hides schema drift |
| 2 | **`compute_period_aggregates` RPC silent fallback** | `fetchers.ts:167` returns zeros if the RPC is missing (local-dev convenience). Production must ensure the RPC migration runs before billing features are exercised. RPC param naming has been verified to match the SQL signature — no silent-bug masking. | Low — acceptable as local-dev guard; document in migration runbook |
| 3 | **Telemetry import path inconsistency** | `@/lib/telemetry` (thin wrapper, pure pass-through) vs `@smartout/telemetry` (direct package import). 14 sites split across the two paths in `apps/admin`. Style debt, not behavioral. | Low — M8 cleanup pass |
| 4 | **E2E scaffold deferred to M8** | 11 tests scaffolded, all skipped. Requires: (a) Supabase local fixture provisioning, (b) `accountant_company_grant` seed rows, (c) accountant auth helper, (d) `admin` webServer entry in `playwright.config.ts` (currently only `web` + `landing` auto-start), (e) `admin` Playwright project entry (spec currently runs under `web` project but `BASE_URL` targets port 3070). | Medium — coverage gap until M8 |

---

## 5. Next Steps (M8 Contract)

1. **Add `admin` project + webServer** — `apps/e2e/playwright.config.ts`: add port 3070 webServer entry and `admin` project block (parallel to existing `web` project).
2. **Accountant auth helper** — implement in `apps/e2e/helpers/` (parallel to existing seed helpers). Provisions and returns an authenticated accountant session.
3. **Seed `accountant_company_grant` rows** — add Erik test-user grant to M4 production seed (parallel to existing workspace seed pattern).
4. **Unskip tests progressively** — Journey 1 (happy-path run) → Journey 2 (artifact downloads) → Journey 3 (not-found, with correct auth-gate analysis per L-0186) → Journey 4 (historikk list) as helpers land.
5. **Implement cross-accountant isolation test** — `avstemming.spec.ts:132`, currently an empty stub with 3 TODO comments. Critical GDPR boundary test.
6. **Erik UAT** — Pontus + Erik run a live end-of-month avstemming. Capture friction-points, feed back as M8 scope.
7. **billing schema type-regen** — prerequisite for removing 6 `as any` casts (L-0188 / debt item 1). Run once billing schema migrations stabilize.
8. **Telemetry import consolidation** — pick one path (`@smartout/telemetry` direct is preferred per monorepo convention) and standardize all 14 `apps/admin` sites (debt item 3).
