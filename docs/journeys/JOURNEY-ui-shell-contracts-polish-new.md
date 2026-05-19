---
title: "Journey — /contracts/new redirect to composition hub"
status: verified
feature: contracts-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, contracts, polish, campaign-ui-shell]
---

# Journey — /contracts/new redirect to composition hub

> Sub-sortie: `ui-shell-contracts-polish`. Journey covering `/dashboard/contracts/new` (thin redirect — minimal surface).

## Journey: Bookmark or legacy link to /contracts/new resolves without 404

**Precondition:** A user (admin, manager, or an external link such as "Lag kontrakt" from an employee profile) navigates to `/dashboard/contracts/new` — either from a saved bookmark, a shared link, or a programmatic `router.push` from legacy code. The Phase 2 composition flow now lives as a drawer on the hub at `/dashboard/contracts?open=compose`.

1. Browser loads `/dashboard/contracts/new` — `loading.tsx` renders briefly (`bg-muted` skeleton pulse)
2. Client component boots; `useEffect` fires immediately on mount
3. Redirect constructed: `router.replace("/dashboard/contracts?open=compose")`
4. If `profileId` query param is present on the incoming URL (e.g. from "Lag kontrakt" button on `/dashboard/people/<id>`): `params.set("profileId", profileId)` appended so the composition drawer can prefill the recipient
5. Browser replaces history entry — user lands on `/dashboard/contracts?open=compose[&profileId=<uuid>]` without a back-navigation loop to `/new`
6. Component returns `null` — no UI rendered while redirect is in flight (user sees loading skeleton for a frame or two only)

**Postcondition:** User is on `/dashboard/contracts?open=compose`. Back button navigates to wherever they were before `/new`, not to `/new` itself (replace, not push). No 404. No broken bookmark experience.

**Error paths:**
- `router.replace` is called with a malformed `profileId` (not a UUID) → forwarded as-is; the hub page validates input before prefilling, so no crash
- JavaScript disabled → redirect does not fire; user sees a blank page (no SSR fallback for this stub); acceptable tradeoff for a deprecated route
- `error.tsx` boundary catches any unhandled throw on this page (unlikely given the near-empty component body)

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `grep "router.replace" apps/web/src/app/dashboard/contracts/new/page.tsx` → 1 hit
- `grep "open=compose" apps/web/src/app/dashboard/contracts/new/page.tsx` → 1 hit
- `grep "profileId" apps/web/src/app/dashboard/contracts/new/page.tsx` → query-param forwarding present
- Dev server: navigating to `/dashboard/contracts/new` → immediately redirects to `/dashboard/contracts?open=compose`, no console errors

## E2E (recommended)

S12 protocol already verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright spec deferred (not in M2 scope; covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` step 5).
