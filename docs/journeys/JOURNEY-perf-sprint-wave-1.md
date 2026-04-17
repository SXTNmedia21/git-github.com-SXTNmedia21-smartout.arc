---
title: User Journeys — perf-sprint-wave-1
status: done
updated: 2026-04-17
created: 2026-04-17
module: performance
tags: [performance, rsc, dashboard-context, gate-client, adr-0091, adr-0114, adr-0115, journeys]
---

# User Journeys — perf-sprint-wave-1

This sprint is plumbing, not a feature. It exposes no new UI surface to
end users. The journeys below document the developer-, admin-, and
end-user-facing effects of the new infrastructure.

---

## Journey 1: Developer writes a new mutation

**Precondition:** A developer is adding a mutation (INSERT, UPDATE, or
DELETE) to a dashboard page or a Server Action. ESLint is running via
`pnpm lint` or the IDE plugin.

1. Developer writes `supabase.from("table").insert({...})` in a new file.
2. ESLint `smartout/no-direct-supabase-write` rule fires a warning:
   "Direct Supabase write blocked. Use gatedInsert/gatedUpdate/gatedDelete
   from @smartout/supabase (ADR-0091 WP3, ADR-0114)."
3. Developer imports the helper:
   `import { gatedInsert } from "@smartout/supabase";`
4. Developer replaces the call: `await gatedInsert(supabase, "table", row, { actorId, workspaceId })`.
5. `gatedInsert` calls the `cascade_gate_write` Postgres RPC
   (SECURITY DEFINER) before executing the write. Gate enforces RLS +
   C4 authority + regulatory framework rules.
6. On success, developer adds `emit()` call to record the mutation in
   `activity_trail` + `engine_event` + PostHog + logger (required by
   ADR-0114 — every mutation emits).
7. PR passes lint + typecheck → merges.

**Postcondition:** The mutation routes through the governance gate and
emits telemetry. Agent capabilities, Server Actions, and TanStack
mutations all share the same write path.

**Error paths:**

- Gate RPC rejects the write (RLS, C4 authority, framework rule) →
  `gatedInsert` throws a `GateRejectionError` with the gate's reason
  code. UI surfaces the reason via a toast, not a generic failure.
- Developer bypasses the gate by using `supabaseAdmin` directly → ESLint
  rule still fires the warning (rule matches all `.from(...).insert` call
  sites regardless of client). Reviewer catches it in PR review.
- Developer uses `// eslint-disable-next-line smartout/no-direct-supabase-write`
  → visible in code review; must be justified in the PR description.
  (When the rule is escalated to `error` in a later sprint, the disable
  comment becomes a governance marker that triggers extra review.)

---

## Journey 2: End user loads a migrated dashboard route

**Precondition:** User is authenticated, inside a workspace, and clicks
a link to `/dashboard/billing` (or any of the 10 routes migrated in this
sprint: billing, cost, year-wheel, my-salary, reconciliation, my-cv,
komm, website, close, onboarding-assistant, ai).

1. Browser navigates; Next.js App Router starts streaming the response.
2. Server Component (`page.tsx`) begins executing: reads auth, resolves
   workspace, kicks off data fetches in parallel (`Promise.all` per
   ADR-0115).
3. While server work runs, the client sees the `loading.tsx` file's
   Nordic Split skeleton: warm-OKLCH shimmer cards matching the final
   layout. No "loading…" text, no layout shift.
4. As each server data fetch resolves, React streams the hydrated
   fragment into the page. User sees content appear region-by-region
   rather than one big flash.
5. Client-side `*-page-client.tsx` takes over for interactive
   subsystems (forms, charts, drawers). TanStack Query hydrates from
   the server-fetched seed data — no duplicate round-trip.
6. User sees a fully interactive page. First-byte-to-interactive is
   measurably faster than the pre-sprint baseline because the server
   no longer waits on a client-side data fetch before rendering.

**Postcondition:** Page is rendered, interactive, and emitting
`page_viewed` telemetry. Server-side emit (ADR-0114) means the
telemetry event lands in `activity_trail` without a `/api/telemetry`
round-trip.

**Error paths:**

- Server data fetch throws → Next.js error boundary renders
  `error.tsx` (or the nearest parent boundary). User sees a Nordic
  Split error card, not a white screen.
- User is unauthenticated → Server Component redirects before any
  skeleton is sent. No flash of loading state.
- User is authenticated but has no workspace access → redirect to
  onboarding or workspace picker; no data leak in the skeleton.
- Slow network → user sees the skeleton for longer but the page never
  shows stale data from a previous route (React transitions handle
  the swap).

---

## Journey 3: Admin reviews the decision log

**Precondition:** Admin (or any developer) is deciding whether to start
a new mutation pattern and needs to know which approaches are
`accepted` vs `proposed`.

1. Admin opens `docs/decisions/0000-decision-log.md`.
2. Admin searches for `ADR-0114` → sees status `accepted`.
3. Admin opens `docs/decisions/0114-server-actions-canonical-mutation-primitive.md`
   and reads:
   - Context: 193 useQuery + roughly equal useMutation call sites
   - Decision: Server Actions as canonical primitive, with capability
     authority relation
   - Consequences: gate RPC applied to both write paths; telemetry
     emits server-side
4. Admin sees `accepted_on: 2026-04-17` in frontmatter and the
   commit `57e52d63` in git blame, confirming the promotion happened
   as part of this sprint.
5. Admin proceeds to implement using Server Actions + gatedWrite +
   emit(), confident the pattern is sanctioned.

**Postcondition:** Admin has authoritative guidance and can proceed
without re-litigating the decision. The ADR becomes the citation in
future PRs that touch the same domain.

**Error paths:**

- Admin finds a conflicting `proposed` ADR → must resolve before
  implementing. Flag in the next council review.
- Admin finds no ADR for their intended change → they must write one
  (template: `docs/templates/decision.md`) before the change merges,
  per the knowledge protocol.

---

## Cross-cutting notes

- **No UI copy changes.** i18n files were not touched. This sprint is
  invisible to non-technical users except for perceived speed.
- **No schema changes.** No migrations ran. The `cascade_gate_write` RPC
  used by the gate helpers was already in place (ADR-0091 WP1/WP2).
- **No mobile surface changes.** `apps/mobile` was untouched. This
  sprint respects the mobile mutation trust freeze (CLAUDE.md, active
  2026-04-17 → ~2026-05-01).
