---
title: "Journey Portal — Hardening & Feature Completion"
id: PLAN_JOURNEY_PORTAL
status: in_progress
layer: plan
created: 2026-03-01
updated: 2026-03-03
depends_on:
  - ADR_0031
  - ADR_0038
---

# Journey Portal — Hardening & Feature Completion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close security gaps, add missing UX guardrails, and enable journey editing — making the Journey Portal production-ready for daily use by platform admins.

**Architecture:** All work is within `apps/web/` (API routes + UI components) with one shared helper refactor. No new database tables. One possible new API route for CRUD operations. Follows existing platform-admin patterns: server components fetch data, client components handle interaction.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (CSS vars), shadcn/ui (new-york), Supabase PostgreSQL 17, Zod, sonner, react-markdown, Lucide icons.

**Source documents:**

- `docs/decisions/0031-journey-portal-system.md` — Journey Portal architecture
- `docs/decisions/0038-journey-agent-output-generators.md` — Wizard + output generators
- `docs/plans/2026-03-01-journey-portal-hardening.md` — Detailed hardening spec (not yet implemented)

---

## Current State (Audit)

**Phase 1 — Tracking (DONE, merged):**

- 4 database tables + 7 enums + RLS policies
- TypeScript types + Zod schemas in `packages/types`
- Status transition state machine (13 statuses)
- Journey list page with pipeline header, filters, TanStack Table
- Journey detail page with steps, event timeline, output tabs
- 68 journeys seeded from registry

**Phase 2 — AI Wizard + Outputs (DONE, merged):**

- `wizard_session` table + enums
- Wizard launcher + chat UI (6-phase)
- Journey agent (`packages/ai/src/agents/journey.ts`)
- 4 output generators (E2E, doc, Linear, Botsson)
- Generate API route + output tabs on detail page

**Hardening (NOT DONE — 7 tasks from hardening plan):**

- ❌ Server-side status transition API route
- ❌ Client refactor to use API route (still direct Supabase writes)
- ❌ Code generation race condition fix
- ❌ Auth dedup (5 routes still use inline godmode check)
- ❌ Confirmation dialog on status transitions
- ❌ Confirmation dialog on wizard complete
- ❌ Markdown rendering in wizard chat

**Not yet built:**

- ❌ Journey editing (edit metadata, steps)
- ❌ Journey deletion / archival
- ❌ Pagination on list / event log

---

## Plan: 4 Tracks

```
Track A: Security & Validation     Track B: UX Guardrails
  A1: Status transition API          B1: Confirmation dialog (status)
  A2: Refactor client                B2: Confirmation dialog (wizard)
  A3: Race condition fix             B3: Markdown rendering in wizard
  A4: Auth dedup (5 routes)

Track C: Journey Editing            Track D: Verification
  C1: Edit journey metadata          D1: Full typecheck + lint
  C2: Edit journey steps             D2: Build verification
  C3: Delete/archive journeys        D3: Manual smoke test
```

**Dependency chain:**

- Track A and B are independent — run in parallel
- Track C depends on A4 (uses the same auth pattern)
- Track D runs last

---

## Track A: Security & Validation

### Task A1: Create server-side status transition API route

**What:** Status transitions currently go directly from the browser to Supabase. A crafted request can bypass the state machine. Create a proper API route that validates transitions server-side.

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts`

**Implementation:**

- `POST /api/platform-admin/journeys/[id]/transition` with body `{ newStatus: string }`
- Auth: `getSuperAdminId()` — 403 if not godmode
- Load journey from DB, verify current status
- Validate transition via `isValidTransition(currentStatus, newStatus)` — 422 if invalid
- Update journey status + insert `journey_event` (status_change)
- Return `{ journey_id, from_status, to_status }`

**Acceptance:** `curl -X POST .../transition -d '{"newStatus":"wizard"}' -H "Cookie: ..."` returns 200 for valid transition, 422 for invalid.

---

### Task A2: Refactor JourneyStatusChanger to use API route

**What:** Replace direct `createClient()` Supabase writes with `fetch()` to the new API route. Remove `workspaceId` prop (API route reads it from DB).

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx` (remove workspaceId prop)
- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx` (remove workspaceId prop)

**Implementation:**

- Remove `createClient` import from status changer
- Replace `handleTransition()` body: `fetch(/api/platform-admin/journeys/${journeyId}/transition, { method: 'POST', body: JSON.stringify({ newStatus }) })`
- Handle 422 (invalid transition) with specific toast
- Remove `workspaceId` from Props type and all call sites

**Acceptance:** Status change works from list page and detail page. No direct Supabase client calls in the component.

---

### Task A3: Fix journey code generation race condition

**What:** The wizard complete route uses SELECT-max-then-INSERT for code generation. Two concurrent completions can get the same J-XXX code. Fix with retry loop using UNIQUE constraint.

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/complete/route.ts`

**Implementation:**

- Replace SELECT→INSERT with a 3-attempt retry loop
- On each attempt: find highest code, increment (+ attempt offset), INSERT
- Catch UNIQUE violation (Postgres error 23505) → retry with next number
- Append code to slug for slug uniqueness
- Use `.maybeSingle()` for the lastJourney query (handles 0 journeys)

**Acceptance:** Two concurrent wizard completions produce unique codes (J-069, J-070).

---

### Task A4: Deduplicate auth checks across journey API routes

**What:** 5 journey API routes have 10-line inline godmode auth checks. Replace with the shared `getSuperAdminId()` helper that other platform-admin routes already use.

**Files:**

- Modify: `apps/web/src/app/api/journey-agent/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/complete/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/[id]/generate/route.ts`

**Implementation:**

- Replace inline auth pattern (createClient → getUser → check identity.is_godmode) with:
  ```typescript
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  ```
- Use `adminId` where `user.id` was used before
- Remove unused `createClient` imports

**Acceptance:** `pnpm typecheck` passes. All 5 routes use `getSuperAdminId()`.

---

## Track B: UX Guardrails

### Task B1: Add confirmation dialog to status transitions

**What:** Status changes are currently one-click with no confirmation. Add an AlertDialog step so accidental transitions are prevented.

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx`

**Implementation:**

- Add `pendingTransition` state (`JourneyStatus | null`)
- Popover buttons set `pendingTransition` instead of calling `handleTransition` directly
- AlertDialog opens when `pendingTransition !== null`
- Shows: "Move from **{current}** to **{target}**. This will be logged."
- Confirm → calls `handleTransition(pendingTransition)` then resets
- Cancel → resets `pendingTransition`
- Ensure AlertDialog is installed (`npx shadcn@latest add alert-dialog` if needed)

**Acceptance:** Click status → popover → select target → confirmation dialog → confirm → status changes. Cancel works.

---

### Task B2: Add confirmation dialog to wizard complete

**What:** The "Complete Journey" button in the wizard chat creates a permanent journey record. Add confirmation to prevent accidental creation.

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx`

**Implementation:**

- Wrap the "Complete Journey" button with AlertDialog (trigger pattern)
- Dialog text: "This will create a new journey with status 'Defined'. The wizard session will be marked as completed."
- Confirm → calls existing `handleComplete()` handler
- Cancel → closes dialog

**Acceptance:** Click "Complete Journey" → confirmation dialog → confirm → journey created.

---

### Task B3: Render markdown in wizard chat messages

**What:** AI wizard responses contain markdown (bold, lists, code blocks) that currently render as raw text. Use react-markdown for assistant messages.

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx`

**Prerequisites:**

- `pnpm --filter web add react-markdown`

**Implementation:**

- Import `ReactMarkdown` from `react-markdown`
- For assistant messages: wrap content in `<ReactMarkdown>` with `prose prose-sm dark:prose-invert max-w-none` classes
- For user messages: keep existing `whitespace-pre-wrap text-sm` rendering

**Acceptance:** Wizard AI responses show formatted markdown (headers, lists, bold, code blocks).

---

## Track C: Journey Editing

### Task C1: Journey metadata editing API route

**What:** Currently there is no way to edit a journey's metadata after creation. Create an API route for updating journey fields.

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/[id]/route.ts`

**Implementation:**

- `PATCH /api/platform-admin/journeys/[id]` — update journey fields
- Auth: `getSuperAdminId()` — godmode only
- Zod schema for allowed editable fields: `title`, `module`, `actor`, `platform`, `priority`, `tags`, `trigger_description`, `preconditions`, `test_assertion`, `doc_title`, `outcomes_success`, `outcomes_empty`, `outcomes_error`
- NOT editable via this route: `code`, `slug`, `status` (use transition API), `workspace_id`
- Update journey + insert `journey_event` (type: 'edit', metadata: changed fields)
- `GET /api/platform-admin/journeys/[id]` — return journey + steps + recent events (for client-side refresh)

**Acceptance:** PATCH with `{ title: "New Title" }` → journey updated, event logged.

---

### Task C2: Journey metadata editing UI

**What:** Add an edit mode to the journey detail page for updating metadata fields.

**Files:**

- Create: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-edit-form.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Implementation:**

- Add "Edit" button to journey detail header → toggles edit mode
- `JourneyEditForm`: form with fields for all editable metadata
  - Title (text input)
  - Module, Actor, Platform, Priority (select dropdowns)
  - Tags (tag input — comma-separated or pill UI)
  - Trigger description, preconditions, test assertion, doc title, outcomes (textareas)
- Save → PATCH to `/api/platform-admin/journeys/[id]` → refresh data → exit edit mode
- Cancel → discard changes → exit edit mode
- Use Zod for client-side validation before submit

**Acceptance:** Navigate to journey detail → click Edit → modify fields → Save → changes persisted. Event appears in timeline.

---

### Task C3: Journey step editing

**What:** Add ability to add, edit, reorder, and delete journey steps from the detail page.

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/[id]/steps/route.ts`
- Create: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-steps-editor.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Implementation:**

API route:

- `PUT /api/platform-admin/journeys/[id]/steps` — replaces all steps (bulk overwrite)
- Auth: godmode only
- Body: `{ steps: Array<{ title, action, expects?, screen?, component?, data_reads?, data_writes?, notes? }> }`
- Delete existing steps → insert new steps with correct `step_order`
- Insert `journey_event` (type: 'edit', metadata: { changed: 'steps' })

UI component (`journey-steps-editor.tsx`):

- Renders steps in editable list
- Each step: title + action (required), expects + screen + component + notes (optional)
- Add step button at bottom
- Delete step button (with confirmation) per row
- Drag-to-reorder (using native drag or `@dnd-kit/sortable`)
- Save → PUT to API → refresh → exit edit mode
- Cancel → discard

**Acceptance:** Open journey detail → edit steps → add new step → reorder → save → steps updated in DB. Step order correct.

---

### Task C4: Delete / archive journey

**What:** Allow deleting or archiving journeys that are no longer needed.

**Files:**

- Add to: `apps/web/src/app/api/platform-admin/journeys/[id]/route.ts` (DELETE handler)
- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Implementation:**

- `DELETE /api/platform-admin/journeys/[id]` — hard delete (cascade deletes steps, events, test runs)
- Auth: godmode only
- AlertDialog confirmation: "Delete journey J-XXX permanently? This cannot be undone."
- On success → redirect to `/platform-admin/journeys` with toast
- Alternative: soft delete via `status = 'archived'` if we add that enum value. Hard delete is simpler for now — all journeys are seeded and can be re-seeded.

**Acceptance:** Delete journey → confirmation → journey gone from list → DB cascade cleaned up.

---

## Track D: Verification

### Task D1: Full typecheck + lint

**What:** Run monorepo-wide type checking and linting.

```bash
pnpm typecheck
pnpm lint
```

**Acceptance:** Both pass with zero new errors.

---

### Task D2: Build verification

**What:** Verify the web app builds successfully.

```bash
pnpm --filter web build 2>&1 | tail -20
```

**Acceptance:** Build succeeds without errors.

---

### Task D3: Manual smoke test

**What:** End-to-end manual verification of all changes.

Checklist:

- [ ] Navigate to `/platform-admin/journeys` — list loads
- [ ] Pipeline header shows correct counts
- [ ] Filters work (module, status, actor, priority, search)
- [ ] Click status badge → popover → select → **confirmation dialog** → confirm → status changes
- [ ] Click journey row → detail page loads
- [ ] Edit journey metadata → save → changes persist
- [ ] Edit steps (add, reorder, delete) → save → order correct
- [ ] Delete journey → confirmation → redirected to list
- [ ] Navigate to wizard → start new session → AI responds with markdown rendering
- [ ] Complete wizard → **confirmation dialog** → confirm → journey created

---

## Summary Table

| Track | Task | What                        | Files        | Complexity |
| ----- | ---- | --------------------------- | ------------ | ---------- |
| A     | A1   | Status transition API route | 1 new        | Medium     |
| A     | A2   | Refactor client to use API  | 3 modify     | Small      |
| A     | A3   | Race condition fix          | 1 modify     | Small      |
| A     | A4   | Auth dedup (5 routes)       | 5 modify     | Small      |
| B     | B1   | Status confirmation dialog  | 1 modify     | Small      |
| B     | B2   | Wizard confirmation dialog  | 1 modify     | Small      |
| B     | B3   | Markdown rendering          | 1 modify     | Small      |
| C     | C1   | Journey metadata API        | 1 new        | Medium     |
| C     | C2   | Journey edit form UI        | 2 new/modify | Medium     |
| C     | C3   | Journey step editor         | 3 new/modify | Large      |
| C     | C4   | Delete / archive            | 2 modify     | Small      |
| D     | D1-3 | Verification                | 0            | —          |

**Total:** ~7 new files, ~13 modified files

**Parallel execution strategy:**

- Track A + Track B in parallel (independent)
- Track C after A4 (uses same auth pattern)
- Track D after all

---

## Out of Scope (Future)

- **Linear sync** — auto-create Linear issues from journeys (Phase 3, ADR-0031)
- **Automated test runs** — trigger Playwright from the portal (Phase 3)
- **Auto-generation triggers** — generate outputs on status change (Phase 3)
- **Pagination** — not needed with 68 journeys, revisit if journey count grows significantly
- **Bulk operations** — bulk status change, bulk delete
- **Responsive/mobile** — platform-admin is desktop-only
