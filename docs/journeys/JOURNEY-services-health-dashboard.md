---
title: "User Journeys — Services Health Dashboard"
status: done
updated: 2026-03-03
created: 2026-03-03
module: platform-admin
tags: [services, health, monitoring, godmode, journeys]
---

# User Journeys — Services Health Dashboard

## Journey: Godmode Admin Views Service Health

**Precondition:** User is logged in and has `is_godmode = true` on `user_identity`.

1. User navigates to `/platform-admin/services` via sidebar link
2. Server component checks `getSuperAdminId()` → user is godmode → renders page
3. Client component mounts → `useServiceHealth` fires initial fetch to `/api/platform-admin/services/health`
4. API route verifies godmode again → calls each service's `/health` endpoint with 5s timeout
5. User sees 3 service cards in responsive grid:
   - **Stage Engine** — green dot + "Healthy" badge + response time (e.g., 45ms)
   - **Shift MCP** — green dot + "Healthy" badge + response time
   - **Contract Service** — green dot + "Healthy" badge + response time
6. Auto-refresh is ON by default → cards update every 30 seconds
7. Last check timestamp shown below header

**Postcondition:** Admin has real-time visibility into all microservice health.

## Journey: Godmode Admin Manual Refresh

**Precondition:** User is on `/platform-admin/services`, auto-refresh may be on or off.

1. User clicks "Check All" button
2. Button shows spinning refresh icon while fetching
3. API route re-checks all 3 services
4. Cards update with fresh data (new response times, timestamps)
5. Spinner stops

**Postcondition:** All cards reflect latest health status.

## Journey: Godmode Admin Toggles Auto-Refresh

**Precondition:** User is on `/platform-admin/services`.

1. User toggles the "Auto-refresh (30s)" switch OFF
2. Polling stops — no more automatic fetches
3. User toggles it back ON
4. Polling resumes at 30s intervals

**Postcondition:** User controls whether health checks run automatically.

## Journey: Service Is Down

**Precondition:** One or more services are not running (e.g., Stage Engine stopped).

1. User navigates to `/platform-admin/services`
2. API route attempts to call `http://localhost:3000/health` → connection refused (5s timeout)
3. Stage Engine card shows:
   - Red status dot (no ping animation)
   - "Down" badge in red
   - Error message: "fetch failed" or "Connection refused"
   - No response time shown
4. Other healthy services still show green

**Postcondition:** Admin immediately sees which service is down and the error message.

**Error paths:**

- All 3 services down → all cards red, all show errors
- Service returns non-200 → card shows "Degraded" (yellow) with HTTP status code
- API route itself fails → useQuery error state, no cards rendered

## Journey: Non-Godmode User Attempts Access

**Precondition:** User is logged in but `is_godmode = false`.

1. User navigates to `/platform-admin/services`
2. Server component calls `getSuperAdminId()` → returns null
3. User is redirected to `/dashboard`

**Postcondition:** Non-godmode users cannot access the services page.

**Error paths:**

- Unauthenticated user → `getSuperAdminId()` returns null → redirect to `/dashboard`
- Direct API call to `/api/platform-admin/services/health` without godmode → 403 Forbidden JSON response
