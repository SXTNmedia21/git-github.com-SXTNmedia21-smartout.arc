---
title: "Journey — Mobile AddSheet Server Action Migration"
feature: addsheet-server-action-migration
status: verified
updated: 2026-05-05
created: 2026-05-04
module: hms, schedule
tags: [journey, server-action, adr-0114, deviation, day-info, mobile-bff]
---

# Journey — Mobile AddSheet Server Action Migration

> Feature: `feat/mobile-addsheet-server-action-migration`
> ADR: ADR-0273

## Journey 1: Employee Reports a Deviation (Web)

**Precondition:** Employee is authenticated on the web dashboard, workspace has authority seed for `hms.report_deviation_manual`.

1. Employee navigates to `/dashboard/hms/deviations` → System renders DeviationForm component
2. Employee fills in title, domain, severity, optional description → System validates client-side required fields
3. Employee clicks "Meld avvik" → System calls `useCreateDeviation()` mutationFn
4. mutationFn invokes `reportDeviationAction({ ...input, channel: "chat" })` (Server Action) → System validates input via Zod on server
5. Server Action calls `resolveCurrentProfile()` from SSR cookie → System derives `profileId` + `workspaceId` (never from body, ADR-0151)
6. Server Action calls `gate_action()` RPC with `hms.report_deviation_manual` → System checks authority config; default `confirm` level
7. Gate passes → Server Action inserts into `deviation` table via admin client (bypasses RLS) → System generates `deviation_id`
8. Server Action calls `await emit("deviation reported", ...)` with server-derived actor_id → System writes to PostHog + Logger + activity_trail + engine_event
9. Server Action returns `{ ok: true, deviationId }` → System: mutationFn resolves, TanStack Query invalidates `["hms", "deviations"]`
10. Toast "Avvik meldt" appears → Employee sees confirmation

**Postcondition:** Deviation row exists in `public.deviation` with `workspace_id` derived server-side. Telemetry emitted server-side with `await`. Authority gate checked.

**Error paths:**
- Zod validation fails → returns `{ ok: false, error: "Ugyldig input." }` → Toast "Kunne ikke melde avvik: ..."
- Profile not resolvable (session expired) → returns `{ ok: false, error: "Ikke autentisert." }` → Toast error
- Authority gate blocks → returns `{ ok: false, error: "Ikke autorisert." }` → Toast error
- DB insert fails → returns `{ ok: false, error: insertError.message }` → Toast error

---

## Journey 2: Employee Reports a Deviation (Mobile — offline-capable)

**Precondition:** Employee is authenticated on mobile, device may be offline. Sync queue operational.

1. Employee opens AddSheet → CreateDayInfoSheet or deviation form component rendered
2. Employee fills deviation form → `useReportDeviation()` hook called with payload including domain, severity, title
3. Hook calls `enqueue("report_deviation", payload)` → System writes offline queue row with Zod-validated schema (schemas.ts: `reportDeviationSchema`)
4. Hook fires `void emit(...)` client-side optimistically (non-blocking) → telemetry best-effort while offline
5. When online: sync worker processes queue → calls `actionMap.report_deviation(payload)`
6. `actionMap.report_deviation` fetches Bearer token via `supabase.auth.getSession()` → System extracts `access_token`
7. Worker POSTs to `/api/mobile/deviations` with Bearer header + payload body → BFF route receives request
8. BFF calls `resolveBearerActor(request)` → derives profileId + workspaceId from JWT (never from body, ADR-0151)
9. BFF calls `reportDeviationAction(input, actor)` with `channel: "system"` → Server Action runs gate + insert + emit (same path as web, Journey 1 steps 6-8)
10. BFF returns `{ deviationId }` → sync worker marks queue row complete

**Postcondition:** Deviation inserted server-side with gated authority. Identity derived from JWT, not body.

**Error paths:**
- No Bearer token → BFF returns 401 → sync worker throws, queues retry
- Gate blocks → BFF returns 422 with `{ error }` → sync worker throws
- Device offline → queue row stays unprocessed until reconnection
- Zod schema validation at enqueue fails → throw at call site (ADR-0134 contract), no corrupt telemetry

---

## Journey 3: Manager Creates Day Info Note (Web)

**Precondition:** Manager is authenticated on the web dashboard. Authority seed for `schedule.add_day_info_manual` at `confirm` level for `manager` role.

1. Manager navigates to `/dashboard/schedule` → Day-info dialog available (DayInfoDialog component)
2. Manager clicks "Legg til daginfo" for a date → Dialog opens with title/content/category fields
3. Manager fills form and submits → `useCreateDayInfo(weekStart)` mutationFn called
4. mutationFn calls `createDayInfoAction({ date, title, content, scopeType, scopeId, category, channel: "chat" })` → Server Action validates Zod schema server-side
5. Server Action calls `resolveCurrentProfile()` → derives `profileId` + `workspaceId` (ADR-0151)
6. Server Action calls `gate_action()` with `schedule.add_day_info_manual` → checks authority; `manager` min_role required
7. Gate passes → admin insert into `schedule_day_info` → returns `{ id }`
8. Server Action calls `await emit("day_info created", ...)` → four destinations, server-side, reliable
9. Returns `{ ok: true, id }` → TanStack Query invalidates day-info query for weekStart → UI refreshes
10. Toast "Daginfo opprettet" shown

**Postcondition:** `schedule_day_info` row created with server-derived `workspace_id`. Emit awaited. Employee attempting this action gets 422 (gate blocks at `manager` min_role).

**Error paths:**
- Employee role (< manager) → gate blocks → `{ ok: false, error: "Ikke autorisert." }` → Toast error
- Date string invalid → Zod fails → `{ ok: false, error: "Dato er påkrevd." }` → Toast error
- DB insert fails → `{ ok: false, error: "Kunne ikke lagre daginfo." }` → Toast error

---

## Journey 4: Manager Creates Day Info Note (Mobile — offline-capable)

**Precondition:** Manager authenticated on mobile.

1. Manager opens AddSheet → CreateDayInfoSheet component renders
2. Manager fills title, content, category, date → `useCreateDayInfo()` hook called
3. Hook calls `enqueue("create_day_info", payload)` → Zod schema validates at enqueue; throws on malformed payload (ADR-0134)
4. Hook fires `void emit(...)` optimistically client-side
5. Sync worker online: calls `actionMap.create_day_info(payload)`
6. Worker fetches Bearer token → POSTs to `/api/mobile/day-info`
7. BFF resolves actor from JWT → calls `createDayInfoAction(input, actor)` with `channel: "system"`
8. Server Action: gate check (`manager` min_role) + admin insert + `await emit()`
9. BFF returns `{ id }` → sync worker marks complete

**Postcondition:** Day-info created with gated authority. Identity never from body.

**Error paths:**
- Employee on mobile → BFF 422 (gate blocks at manager min_role)
- Offline → queue pending until reconnect
- Malformed payload → Zod throws at enqueue (fail fast, no corrupt telemetry)

---

## Journey 5: Authority Resolution for Both Capabilities

**Precondition:** Fresh workspace (I1 bootstrap run). Migrations applied.

1. Migration `20260525100000_seed_deviation_authority.sql` runs → inserts `hms.report_deviation_manual` with `confirm` + `employee` min_role for all workspaces
2. Migration `20260525100100_seed_day_info_authority.sql` runs → inserts `schedule.add_day_info_manual` with `confirm` + `manager` min_role for all workspaces
3. No seed row conflict (ON CONFLICT DO NOTHING) → existing overrides preserved

**Postcondition:** All workspaces have explicit authority config rows. No default-allow silent fire (L-0107 mitigated).

**Error paths:**
- No godmode user found at migration time → NOTICE logged, seed skipped; must re-run after first admin created
- Workspace created after migration → bootstrap I1 must apply authority seed retroactively (known gap — tracked in ADR-0273)
