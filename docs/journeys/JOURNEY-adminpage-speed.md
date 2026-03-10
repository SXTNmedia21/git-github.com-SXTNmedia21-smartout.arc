---
title: "Journey — Platform Admin Speed Optimization"
status: done
updated: 2026-03-10
created: 2026-03-10
module: platform-admin
tags: [performance, optimization, admin]
---

# Journey — Platform Admin Speed Optimization

## Journey: Godmode Admin navigates platform-admin pages

**Precondition:** User is authenticated with `is_godmode = true`, platform-admin layout loaded.

### Happy Path

1. User navigates to any platform-admin subsection → System shows loading skeleton immediately (loading.tsx) → User sees instant feedback while server fetches data
2. Server page loads → System runs `getSuperAdminId()` (React.cache deduped) + data query in parallel via `Promise.all` → User sees full page with cached data (30-60s TTL)
3. User types in search field (users, workspaces, API registry) → System debounces input by 300ms → No wasted re-renders or queries during typing
4. User views billing page with charts → System lazy-loads Recharts via `next/dynamic` → Initial JS bundle stays small
5. User opens workspace detail → System loads workspace data + notes from `workspace_note` table → User can add/edit/delete notes with full CRUD
6. User stays on guardian/health pages → System does NOT refetch on window focus or in background → No unnecessary network traffic

### Error Paths

- **Cache miss:** Server fetches fresh data from Supabase, caches result, page loads slightly slower (first visit after TTL expiry)
- **Auth failure:** `getSuperAdminId()` returns null → page shows "Unauthorized" or redirects
- **Note CRUD failure:** API route returns error → toast notification shown to user

**Postcondition:** All platform-admin pages load faster with cached data, reduced query volume, and instant loading feedback.

## Journey: Godmode Admin manages workspace notes

**Precondition:** User is on workspace detail page (`/platform-admin/workspaces/[id]`).

1. User clicks "Add note" → System shows input field → User types note and submits
2. System POST to `/api/platform-admin/workspace-notes` → Creates `workspace_note` row + logs to `platform_audit_log` → Note appears in list
3. User clicks edit on existing note → System shows editable field → User modifies and saves
4. System PATCH to `/api/platform-admin/workspace-notes` → Updates `workspace_note` row + logs edit to audit → Updated note shown
5. User clicks delete on note → System confirms → DELETE to API → Note removed + audit logged

### Error Paths

- **Unauthorized:** Non-godmode user hits API → 403 returned
- **Note not found:** PATCH/DELETE with invalid ID → 404 returned

**Postcondition:** Note persisted in `workspace_note` table. All mutations logged in `platform_audit_log` for audit trail.
