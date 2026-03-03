---
title: "Journey — Platform Admin Polish"
status: done
updated: 2026-03-03
created: 2026-03-03
module: platform-admin
tags: [journey, performance, ui, ux]
---

# Journey — Platform Admin Polish

> Performance fixes and UI/UX improvements across all platform admin pages.

## Journey: Super Admin — Browse Billing Page

**Precondition:** User has `is_godmode = true` and is on `/platform-admin/billing`.

1. User navigates to Billing → System loads max 500 companies (previously unbounded) → Page loads faster
2. User sees the billing table → Table is wrapped in single TooltipProvider (not per-row) → No unnecessary React re-renders
3. User sees MRR chart → Chart data is memoized, only recomputes when `mrrData` changes → Smoother interactions
4. User hovers "View in Stripe" menu item → Tooltip appears from shared provider → Consistent tooltip behavior
5. User resizes window to narrow viewport → Table scrolls horizontally → No layout breakage on mobile/tablet

**Postcondition:** Billing page loads faster with bounded queries and memoized rendering.

**Error paths:**

- If >500 companies exist, only most recent 500 shown (sorted by created_at desc). Count header available for future "load more" UI.

---

## Journey: Super Admin — Browse Dashboard

**Precondition:** User has `is_godmode = true` and is on `/platform-admin/dashboard`.

1. User navigates to Dashboard → Skeleton loader appears (title + 5 KPI cards + table rows) instead of spinner → Professional loading UX
2. Data loads → 5 KPI cards render → Cards are responsive: 1 col on mobile, 2 on sm, 3 on lg, 5 on xl
3. User sees pie chart → Subscription data is memoized and pre-filtered (zero-value slices excluded) → No duplicate `.filter()` calls per render

**Postcondition:** Dashboard renders responsively with memoized chart data.

**Error paths:**

- If no subscription data exists, pie chart section shows "No subscription data yet" message (existing behavior, unchanged).

---

## Journey: Super Admin — Browse Contracts Page

**Precondition:** User has `is_godmode = true` and is on `/platform-admin/contracts`.

1. User navigates to Contracts → System loads max 200 contracts (previously unbounded) → Faster page load
2. User browses table → Contracts sorted by created_at desc → Most recent visible first

**Postcondition:** Contracts page loads with bounded query.

**Error paths:**

- If >200 contracts exist, only most recent 200 shown. Count available via `{ count: "exact" }` for future pagination.

---

## Journey: Super Admin — Browse Users Page

**Precondition:** User has `is_godmode = true` and is on `/platform-admin/users`.

1. User navigates to Users → System loads up to 1000 users (previously 250) → More users visible without pagination
2. User sees user count → Shows total from query → Accurate count
3. User resizes window → Table scrolls horizontally → No layout breakage on narrow viewports

**Postcondition:** Users page shows more users with horizontal scroll support.

**Error paths:**

- If >1000 users exist, only most recent 1000 shown. Count available for future "load more" UI.

---

## Journey: Super Admin — Navigate Sidebar

**Precondition:** User is on any `/platform-admin/*` page.

1. User sees sidebar → 16 nav items grouped into 4 labeled categories → Easier scanning
   - **Overview**: Dashboard, Health, Services
   - **Workspace**: Workspaces, Users, Billing, Contracts, Maler (indented)
   - **Content**: Communications, Content, Landing, Variants (indented), Journey
   - **System**: Keys & Secrets, Guardian, Audit Log
2. User clicks a nav item → Active state highlights with `bg-accent` → Clear current location
3. Indented items (Maler, Variants) show with `pl-8` → Visual hierarchy for sub-pages

**Postcondition:** Sidebar navigation is organized and scannable.

**Error paths:** None — navigation is static.
