---
title: "Worklog — adminpage-speed"
status: done
updated: 2026-03-10
created: 2026-03-10
module: platform-admin
tags: [performance, optimization, pagination]
---

# Worklog — adminpage-speed

## Status: ✅ Done

## Done

- [x] Performance audit of all platform-admin pages
- [x] Created `useDebounce` hook (`apps/web/src/hooks/use-debounce.ts`)
- [x] Added 300ms debounce to users search + workspace search
- [x] Added `unstable_cache` to ALL server pages: users (30s), billing (60s), contracts (60s), audit (30s), communications (60s), workspaces (30s), landing (30s)
- [x] Landing page: consolidated 11 queries → 8 (merged 3 count queries + session_id query into single todayEvents query)
- [x] Landing page: used 7d sessions for unique session count (removed separate event query)
- [x] Reduced query limits: users 1000→200, billing 500→200, contracts 200→100, events 200→100, sessions 200→100, leads 200→100, communications 100→50
- [x] Added loading.tsx skeletons for all 7 subsections (users, billing, landing, workspaces, contracts, audit, communications)
- [x] Guardian polling: added `refetchOnWindowFocus: false` + `refetchIntervalInBackground: false` to both hooks
- [x] Typecheck passes (0 errors)
- [x] Round 2: Parallelliserad auth + data på ALLA sidor (Promise.all)
- [x] Round 2: React.cache wrapper på getSuperAdminId (deduplicering per request)
- [x] Round 2: Dynamic import Recharts i billing-client (tungt JS-paket)
- [x] Round 2: Dynamic import ComposeEmailSheet i users-client + workspace-list
- [x] Round 2: Cache + parallell auth på health, content, journeys
- [x] Round 2: Typecheck passes (0 errors)
- [x] Round 3: Dynamic import ApiRegistryTable + SystemSpeedTestCard in health-page-client
- [x] Round 3: Added 300ms debounce to API registry table search
- [x] Round 3: Service health hook: added `refetchOnWindowFocus: false` + `refetchIntervalInBackground: false`
- [x] Round 3: Added loading.tsx skeletons for health + services pages
- [x] Round 3: Created `platformAdminRoutes` template (`apps/web/src/lib/platform-admin-routes.ts`)
- [x] Round 3: Template-ized all URLs in service-card, service-detail-client, setup-banner, speed-test-card
- [x] Round 3: Typecheck passes (0 errors)
- [x] Round 4: Created `workspace_note` table (migration 20260310150000)
- [x] Round 4: New API route `/api/platform-admin/workspace-notes` (POST/PATCH/DELETE)
- [x] Round 4: Migrated workspace notes from `platform_audit_log` to `workspace_note` table
- [x] Round 4: Added edit/delete UI for workspace notes
- [x] Round 4: Audit trail preserved — CRUD ops still log to `platform_audit_log`
- [x] Round 4: Typecheck passes (0 errors)
- [x] Round 5: Regenerated `database.types.ts` — all tables now typed
- [x] Round 5: Removed ALL `as never` casts (9 files across platform-admin)
- [x] Round 5: Removed ALL `as any` casts (5 landing variant files, 19 instances)
- [x] Round 5: Added `loading.tsx` for guardian + content pages
- [x] Round 5: Removed unused `useTransition` imports (users-client, workspace-list-enhanced)
- [x] Round 5: Typecheck passes (0 errors), 0 unsafe casts remaining

## Remaining

- [ ] None — all optimizations complete

## Decisions

| Date       | Decision                                                                                                                 | Reason                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 2026-03-10 | Cache TTL: 30s for real-time pages (users, audit, workspaces, landing), 60s for stable pages (billing, contracts, comms) | Balance between freshness and speed                                                             |
| 2026-03-10 | Reduce limits to 100-200 instead of implementing server-side pagination                                                  | Platform-admin has low data volume; pagination adds complexity without benefit at current scale |
| 2026-03-10 | Consolidate landing queries from 11→8 instead of full rewrite                                                            | Maximum impact with minimal risk                                                                |
| 2026-03-10 | Centralized URL templates in `platform-admin-routes.ts`                                                                  | Production safety — no hardcoded paths scattered across components                              |
| 2026-03-10 | Notes moved from `platform_audit_log` to own `workspace_note` table                                                      | Audit trail is immutable; notes need edit/delete. Separation of concerns.                       |

## Log

| Date       | Time  | Event                                                                                                                                                |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-10 | —     | Started: performance audit complete, 11 issues identified                                                                                            |
| 2026-03-10 | —     | Implemented all optimizations. Typecheck green.                                                                                                      |
| 2026-03-10 | —     | Round 3: Health + Services optimization. URL templates, debounce, dynamic imports, loading skeletons. Typecheck green.                               |
| 2026-03-10 | —     | Round 4: workspace_note table + CRUD API + edit/delete UI. Notes decoupled from audit log. Typecheck green.                                          |
| 2026-03-10 | —     | Round 5: Type safety sweep — regenerated DB types, removed all 28 unsafe casts, added missing loading states, cleaned dead imports. Typecheck green. |
| 2026-03-10 | 16:18 | Feature closed and merged to development                                                                                                             |
