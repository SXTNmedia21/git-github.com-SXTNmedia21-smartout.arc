---
title: "Handoff — Mobile AddSheet Server Action Migration"
status: done
updated: 2026-05-04
created: 2026-05-04
module: hms, schedule
tags: [handoff, server-action, adr-0114, deviation, day-info, mobile-bff]
---

# Handoff — Mobile AddSheet Server Action Migration

> Branch: `feat/mobile-addsheet-server-action-migration`
> Worktree: `~/dev/smartout.ai-mobile-wt-5`
> Base: `campaign/mobile`
> ADR: ADR-0273

## What Was Built

Two ADR-0114 violations closed: `useCreateDeviation` and `useCreateDayInfo` were direct client-side `useMutation` hooks calling `supabase.from(...).insert(...)` without authority gate, with `void` (fire-and-forget) telemetry emit.

### Server Actions (new)

- `apps/web/src/app/dashboard/_actions/report-deviation-action.ts` — `reportDeviationAction(input, actor?)`. Resolves identity from SSR cookie (web) or pre-resolved actor (BFF mobile). Gates on `hms.report_deviation_manual`. Admin insert. `await emit("deviation reported")`.
- `apps/web/src/app/dashboard/_actions/create-day-info-action.ts` — `createDayInfoAction(input, actor?)`. Same pattern. Gates on `schedule.add_day_info_manual`. Admin insert. `await emit("day_info created")`.

### BFF Routes (new)

- `apps/web/src/app/api/mobile/deviations/route.ts` — POST, Bearer-auth, JWT-derive actor, delegates to `reportDeviationAction` with `channel: "system"`. ADR-0132 compliant.
- `apps/web/src/app/api/mobile/day-info/route.ts` — POST, Bearer-auth, JWT-derive actor, delegates to `createDayInfoAction`. ADR-0132 compliant.

### Refactored Web Hooks (modified)

- `apps/web/src/app/dashboard/hms/_hooks/use-create-deviation.ts` — now a thin TanStack Query wrapper. `mutationFn` calls `reportDeviationAction({ ...input, channel: "chat" })`. No supabase insert. No client-side emit.
- `apps/web/src/app/dashboard/schedule/_hooks/use-day-info.ts:useCreateDayInfo` — thin wrapper. `mutationFn` calls `createDayInfoAction({ ..., channel: "chat" })`. No supabase insert. No client-side emit.

### Action Map (modified)

- `apps/mobile/src/lib/sync/action-map.ts` — `actionMap.report_deviation` routes to BFF via `fetch("/api/mobile/deviations", { Bearer })`. `actionMap.create_day_info` routes to `/api/mobile/day-info`. Neither does direct supabase insert.

### Authority Seeds (new migrations)

- `supabase/migrations/20260525100000_seed_deviation_authority.sql` — `hms.report_deviation_manual`: `confirm`, `employee` min_role. All workspaces.
- `supabase/migrations/20260525100100_seed_day_info_authority.sql` — `schedule.add_day_info_manual`: `confirm`, `manager` min_role. All workspaces.

## Decisions Made

### ADR-0273: Deviation + Day-Info Server Action Migration

Both `useCreateDeviation` + `useCreateDayInfo` replaced with Server Actions. Closes ADR-0114 violations. Authority seeded per ADR-0189 (default-allow silent fire is CVE-class per L-0107). Mobile routes through BFF per ADR-0132.

Key design choices:
1. **Thin hook wrappers retained** — preserves call-site ergonomics (TanStack Query interface). Callers need zero changes.
2. **`channel` pinned at hook level** — web hooks pass `channel: "chat"`, BFF passes `channel: "system"`. Server Action schema has `.optional().default("chat")` but callers always be explicit to avoid Zod v3 type inference issues (see Learnings).
3. **`actor?` optional param on Server Actions** — allows BFF to inject pre-resolved identity without a second cookie lookup. Web path uses cookie (SSR). Mobile path uses Bearer + pre-resolved actor.
4. **`create_day_info` scope_type defaults to "workspace"** — mobile hook payload always uses `scope_type: "workspace"` for now. Full scope UI (department/team) is web-only authoring (ADR-0133).

## Learnings

### L-wt5-01: Zod v3 `.default()` without `.optional()` keeps field required in TypeScript

`z.enum([...]).default("chat")` in Zod v3 makes the field required in `z.infer<>` output type, even though Zod will apply the default at runtime. Adding `.optional()` (`.optional().default("chat")`) makes it optional in the input type. But even then, callers should explicitly pass the value to avoid Zod v3 type inference surprises — particularly when the type is re-exported and used in `Omit<>` chains across packages. Explicit `channel: "chat"` at the hook level is clearer than relying on schema defaults.

### L-wt5-02: Mobile hooks still pass workspace_id / actor identity from caller

The mobile hooks `use-report-deviation.ts` and `use-create-day-info.ts` accept `workspace_id` and `reported_by`/`created_by` as caller props and include them in the enqueue payload. This is technically safe because:
- The BFF route ignores these body fields (Zod strips unknown fields when parsing the Server Action InputSchema)
- The Server Action re-derives identity from JWT regardless

However, the pattern is inconsistent with ADR-0134's `getProfileContext()` recommendation. The enqueue payload body sends identity fields that are subsequently ignored — this creates misleading data in the offline queue. A follow-up should refactor the mobile hooks to use `getProfileContext()` directly and omit `workspace_id`/`reported_by` from the enqueue payload. Tracked as known debt below.

## Known Issues / Debt

1. **Mobile hook identity in enqueue payload** — `use-report-deviation.ts` and `use-create-day-info.ts` still accept and enqueue `workspace_id`/`reported_by`/`created_by` from the caller. Body fields are ignored by BFF (Zod strips them), but the offline queue row contains these values. Should refactor to use `getProfileContext()` at enqueue time and omit identity from payload. Low urgency (BFF is safe), but ADR-0134 and ADR-0151 full compliance requires the fix.

2. **Authority gap for new workspaces created after migration** — the seed migrations use `DO $$ ... SELECT FROM workspace ...` to insert for all current workspaces. Workspaces created after migration run won't have these rows. Default-allow fires silently (L-0107 risk). Long-term fix: I1 bootstrap should include both capability seeds. Tracked in ADR-0273 known-gaps.

3. **Mobile `DeviationForm.tsx` still receives `profileId` + `workspaceId` as props** — component accepts caller-supplied identity for constructing the payload. The enqueue flow ultimately ignores these via BFF, but the component signature is non-standard. Should be refactored to call `getProfileContext()` internally. Deferred: no user-visible bug, BFF is the enforcement layer.

4. **E2E test coverage for BFF routes** — `hms-avvik.spec.ts` covers the web UI path (Server Action via form submit). No E2E spec exists for the mobile BFF endpoints (`/api/mobile/deviations`, `/api/mobile/day-info`). These are API-only routes; Playwright can hit them with `request.post()`. Deferred to a follow-up.

## Next Steps

1. Refactor mobile hooks to use `getProfileContext()` and omit identity from enqueue payload (ADR-0134 full closure)
2. Add I1 bootstrap entries for `hms.report_deviation_manual` + `schedule.add_day_info_manual` so new workspaces are covered
3. Add Playwright API test for both BFF routes (Bearer auth mock)
4. Consider using `z.input<typeof InputSchema>` for exported types to cleanly represent optional-with-default fields in Zod v3
