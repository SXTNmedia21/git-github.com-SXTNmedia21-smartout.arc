---
title: "HMS Phase 1: Legibility — Implementation Plan"
status: draft
created: 2026-03-22
updated: 2026-03-22
module: hms
tags: [hms, governance, implementation, phase-1]
---

# HMS Phase 1: Legibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clear `/dashboard/hms` surface without regressing the working governance CRUD flow or the current assignment-based training system.

**Architecture:** Phase 1 is additive, not destructive. `/dashboard/hms` becomes the new legibility shell and sidebar destination, while `/dashboard/governance` stays live as the existing admin CRUD surface until a later phase achieves true parity. New HMS hooks stay inside `apps/web` for now, because the current training and dashboard data layer is still web-coupled and not yet safe to extract into a shared package. Documents and procedure detail are read-first surfaces that only expose training actions when a valid `protocol_assignment` context exists. Phase 1 reuses the current assignment-backed training runtime and existing seeded training process; do not reintroduce `learning-journey-v1` or a second workflow runtime.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui, TanStack Query v5, Tiptap render helpers, Supabase PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-03-22-hms-governance-redesign-design.md`

**Spec override for execution:** If the spec still instructs workers to redirect `/dashboard/governance` to `/dashboard/hms`, this plan overrides that instruction for Phase 1. Keep `/dashboard/governance` live until a later phase delivers real CRUD parity inside HMS.

**Branch:** `feat/hms-phase-1`

---

## Phase 1 Contract

These rules are part of the plan. Do not violate them while implementing:

- Keep `/dashboard/governance` live for the full phase. No redirect in this plan.
- Do not create `packages/hms` yet. All new hooks live in `apps/web/src/app/dashboard/hms/_hooks/`.
- Do not build procedure-only training mutations. Employee progress remains `protocol_assignment`-driven.
- Treat `/dashboard/hms/drift` and `/dashboard/hms/deviations` as legibility placeholders or pointers, not as new source-of-truth modules.
- If the `procedure_step` migration lands, extend the existing `ProcedureBuilder` in the same phase so the new fields can actually be authored.
- Do not introduce a new i18n integration pattern in this phase. Follow the existing dashboard string pattern already used in nearby pages.

## Commit Protocol

Every commit created from this plan must:

- run with normal git hooks enabled
- use the conventional commit subject listed in the task
- include this footer exactly:

`Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

---

## File Structure

### New files

| File                                                                 | Responsibility                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_hms_procedure_step_training.sql` | Add `training_content` + `media_urls` to `procedure_step`                  |
| `apps/web/src/app/dashboard/hms/layout.tsx`                          | HMS route shell with sub-navigation                                        |
| `apps/web/src/app/dashboard/hms/page.tsx`                            | Oversikt entry page                                                        |
| `apps/web/src/app/dashboard/hms/drift/page.tsx`                      | Read-only placeholder that points toward existing operations ownership     |
| `apps/web/src/app/dashboard/hms/training/page.tsx`                   | Admin competence matrix or employee protocol list                          |
| `apps/web/src/app/dashboard/hms/documents/page.tsx`                  | Documents surface with URL-driven selection                                |
| `apps/web/src/app/dashboard/hms/deviations/page.tsx`                 | Read-only placeholder for future avvik surface                             |
| `apps/web/src/app/dashboard/hms/procedure/[id]/page.tsx`             | Procedure detail entry point                                               |
| `apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx`           | Top tab navigation                                                         |
| `apps/web/src/app/dashboard/hms/_components/OversiktDashboard.tsx`   | Admin attention surface                                                    |
| `apps/web/src/app/dashboard/hms/_components/OversiktEmployee.tsx`    | Employee readiness surface                                                 |
| `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`    | Admin matrix view for assignments by employee and protocol                 |
| `apps/web/src/app/dashboard/hms/_components/DocumentBrowser.tsx`     | Left document tree and search                                              |
| `apps/web/src/app/dashboard/hms/_components/DocumentViewer.tsx`      | Right document view with guarded action bar                                |
| `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx` | Admin procedure detail tabs                                                |
| `apps/web/src/app/dashboard/hms/_components/ProcedureExperience.tsx` | Employee/read-only procedure experience wrapper                            |
| `apps/web/src/app/dashboard/hms/_hooks/useHmsGovernanceFiltered.ts`  | HMS-local governance filter hook                                           |
| `apps/web/src/app/dashboard/hms/_hooks/useHmsReadinessScore.ts`      | HMS-local readiness hook preserving current readiness semantics            |
| `apps/web/src/app/dashboard/hms/_hooks/useProcedureTrainingSteps.ts` | Fetch procedure steps with training fields                                 |
| `apps/web/src/app/dashboard/hms/_hooks/useProcedureContext.ts`       | Resolve procedure -> protocol -> optional assignment context               |
| `apps/e2e/tests/hms-legibility-smoke.spec.ts`                        | Automated smoke test for additive routing and assignment-aware HMS actions |

### Modified files

| File                                                                       | Change                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/web/src/components/dashboard/DashboardShell.tsx`                     | Point HMS nav item to `/dashboard/hms`, keep legacy governance route alive |
| `apps/web/src/components/dashboard/GlobalSearchPalette.tsx`                | Retarget front-door HMS search links to `/dashboard/hms`                   |
| `apps/web/src/app/walkAi/_components/walkai-tools.ts`                      | Retarget front-door HMS tool links to `/dashboard/hms`                     |
| `apps/web/src/app/dashboard/governance/_components/ProcedureBuilder.tsx`   | Add authoring controls for new procedure step fields                       |
| `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts` | Persist new step fields when creating procedures                           |
| `packages/supabase/src/database.types.ts`                                  | Regenerate after migration                                                 |

### Reused without ownership changes

| File                                                                      | Reused for                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/web/src/app/dashboard/governance/page.tsx`                          | Existing admin CRUD surface remains live                        |
| `apps/web/src/app/dashboard/handbook/_components/ChapterReader.tsx`       | Tiptap rendering pattern                                        |
| `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts` | Employee training data source                                   |
| `apps/web/src/app/dashboard/my-training/_components/ProtocolList.tsx`     | Employee training page under HMS                                |
| `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts`            | Base governance overview source                                 |
| `apps/web/src/app/dashboard/_hooks/use-my-dashboard.ts`                   | Existing employee readiness semantics (`0 assignments => 100%`) |
| `apps/web/src/app/dashboard/_hooks/use-protocol-journey.ts`               | Proof that progress and evidence are assignment-driven          |

---

## Task 1: Data Foundation — Migration + Existing Authoring Path

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_hms_procedure_step_training.sql`
- Modify: `packages/supabase/src/database.types.ts`
- Modify: `apps/web/src/app/dashboard/governance/_components/ProcedureBuilder.tsx`
- Modify: `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts`

- [ ] **Step 1: Create the migration**

```sql
ALTER TABLE procedure_step ADD COLUMN training_content text;
ALTER TABLE procedure_step ADD COLUMN media_urls jsonb;

COMMENT ON COLUMN procedure_step.training_content IS
  'Extended learning material shown in HMS training/detail surfaces.';

COMMENT ON COLUMN procedure_step.media_urls IS
  'JSON array of media items: [{ type, url, caption }]';
```

Use the next timestamped filename in `supabase/migrations/`.

- [ ] **Step 2: Apply the migration locally**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<filename>.sql`

Expected: two `ALTER TABLE` statements succeed.

- [ ] **Step 3: Regenerate Supabase types**

Run: `pnpm db:gen-types`

Expected: `packages/supabase/src/database.types.ts` now includes `training_content` and `media_urls` on `procedure_step`.

- [ ] **Step 4: Extend the existing governance mutation shape**

In `use-governance-mutations.ts`, extend `ProcedureInput.steps` so each step can carry:

- `training_content?: string`
- `media_urls?: Json`

When inserting into `procedure_step`, pass those fields through alongside the existing `title`, `description`, `step_order`, `is_required`, and `estimated_minutes`.

- [ ] **Step 5: Extend `ProcedureBuilder` with minimal authoring controls**

Do not invent a full media studio in this phase. Add the smallest safe editor:

- A `trainingContent` textarea on each step
- A `mediaUrlsText` textarea on each step where admins can paste a JSON array

Implementation rules:

- Keep `description` as the compact operational copy
- Use `trainingContent` for richer explanatory copy
- Parse `mediaUrlsText` with `JSON.parse` on submit
- If parsing fails, show a toast and abort submit instead of sending malformed JSON

- [ ] **Step 6: Wire the builder payload**

Map the builder draft to the mutation payload:

```ts
steps: steps.map((step, index) => ({
  title: step.title,
  description: step.description || step.title,
  training_content: step.trainingContent.trim() || undefined,
  media_urls: parsedMediaUrls ?? undefined,
  step_order: index + 1,
  is_required: step.isRequired,
  estimated_minutes: step.estimatedMinutes || undefined,
}));
```

- [ ] **Step 7: Verify with the existing governance UI**

Run: `pnpm --filter web dev`

Manual check:

- Open `/dashboard/governance`
- Create a procedure with one step containing `trainingContent`
- If testing media, use a valid JSON array
- Confirm the procedure is created and no client/runtime error occurs

- [ ] **Step 8: Run validation**

Run: `pnpm typecheck`

Expected: 0 errors.

- [ ] **Step 9: Commit**

Stage only:

- `supabase/migrations/<filename>.sql`
- `packages/supabase/src/database.types.ts`
- `apps/web/src/app/dashboard/governance/_components/ProcedureBuilder.tsx`
- `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts`

Commit:

`feat(hms): add training fields to procedure steps`

Use normal hooks and include the required footer from `Commit Protocol`.

---

## Task 2: HMS Shell — Additive Routing, No Redirect

**Files:**

- Create: `apps/web/src/app/dashboard/hms/layout.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx`
- Create: `apps/web/src/app/dashboard/hms/drift/page.tsx`
- Create: `apps/web/src/app/dashboard/hms/deviations/page.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`
- Modify: `apps/web/src/components/dashboard/GlobalSearchPalette.tsx`
- Modify: `apps/web/src/app/walkAi/_components/walkai-tools.ts`

- [ ] **Step 1: Create `HmsSubNav`**

Follow the visual pattern from the season page tabs, but use route navigation:

- `/dashboard/hms` -> `Oversikt`
- `/dashboard/hms/drift` -> `Drift`
- `/dashboard/hms/training` -> `Opplaering`
- `/dashboard/hms/documents` -> `Dokumenter`
- `/dashboard/hms/deviations` -> `Avvik`

Use `Link` + `usePathname()` and CSS variable classes only.

- [ ] **Step 2: Create the HMS layout**

Wrap all HMS pages in a shared shell that renders `HmsSubNav` above `children`.

- [ ] **Step 3: Create safe placeholders for `drift` and `deviations`**

These are not source-of-truth surfaces yet.

Requirements:

- `drift/page.tsx` explains that live operations still live in `/dashboard/operations`
- `deviations/page.tsx` explains that the dedicated avvik workspace is coming later
- Each page should include one obvious CTA button or link to the current owner surface where appropriate

- [ ] **Step 4: Retarget the sidebar HMS item**

In `DashboardShell.tsx`:

- Change the HMS nav item `href` from `/dashboard/governance` to `/dashboard/hms`
- Make the active-nav logic treat both `/dashboard/hms` and legacy `/dashboard/governance` as HMS during the transition
- Update `ROUTE_MISSION_MAP` and any top-bar route-label logic for `/dashboard/hms`, `/dashboard/hms/training`, `/dashboard/hms/documents`, `/dashboard/hms/deviations`, and `/dashboard/hms/procedure/[id]`
- Update walkthrough selector/path references tied to the HMS nav item

Do **not** remove or modify the `/dashboard/governance` page route in this task.

- [ ] **Step 5: Audit other front-door HMS entry points**

Retarget the non-sidebar HMS entry points that are intended as front doors:

- `GlobalSearchPalette.tsx`
- `walkai-tools.ts`

Rules:

- point general HMS or quality-control entry points to `/dashboard/hms`
- keep governance-specific authoring/setup links on `/dashboard/governance` where the user truly needs the legacy CRUD surface

- [ ] **Step 6: Verify route ownership**

Run: `pnpm --filter web dev`

Manual check:

- `/dashboard/hms` resolves to the new shell
- `/dashboard/hms/drift` renders placeholder and points to `/dashboard/operations`
- `/dashboard/hms/deviations` renders placeholder
- `/dashboard/governance` still works exactly as before
- Sidebar HMS button now opens `/dashboard/hms`

- [ ] **Step 7: Run validation**

Run: `pnpm typecheck`

- [ ] **Step 8: Commit**

Stage only the new HMS shell files plus:

- `apps/web/src/components/dashboard/DashboardShell.tsx`
- `apps/web/src/components/dashboard/GlobalSearchPalette.tsx`
- `apps/web/src/app/walkAi/_components/walkai-tools.ts`

Commit:

`feat(hms): add additive route shell for hms`

Use normal hooks and include the required footer from `Commit Protocol`.

---

## Task 3: Oversikt — Attention Surface Without Breaking Admin CRUD

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_hooks/useHmsGovernanceFiltered.ts`
- Create: `apps/web/src/app/dashboard/hms/_hooks/useHmsReadinessScore.ts`
- Create: `apps/web/src/app/dashboard/hms/_components/OversiktDashboard.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/OversiktEmployee.tsx`
- Create: `apps/web/src/app/dashboard/hms/page.tsx`

- [ ] **Step 1: Create `useHmsGovernanceFiltered` in `apps/web`**

Wrap `useGovernanceOverview()` and add an optional local HMS filter for display grouping.

Do not move this hook into `packages/`.

- [ ] **Step 2: Create `useHmsReadinessScore` preserving current semantics**

Base it on existing assignment queries and preserve the current rule:

- `0 assignments => 100% readiness`

Match the semantics already used in `use-my-dashboard.ts` and `use-training-readiness.ts`.

- [ ] **Step 3: Build `OversiktDashboard`**

Admin view should show:

- Status cards
- Attention list
- Action row

Action row requirements:

- Include a clear `Administrer innhold` CTA linking to `/dashboard/governance`
- Include a `Se drift` CTA linking to `/dashboard/operations`
- Include a `Dokumenter` CTA linking to `/dashboard/hms/documents`

This is the bridge that keeps the old governance CRUD accessible while HMS becomes the new front door.

- [ ] **Step 4: Build `OversiktEmployee`**

Employee view should show:

- Readiness ring
- Remaining assignments count
- Next-action CTA linking to `/dashboard/hms/training`

Use existing assignment data and do not invent a second training state model.

- [ ] **Step 5: Wire the page**

`page.tsx` switches on `DashboardContext.isAdminMode` and renders either the admin or employee view.

- [ ] **Step 6: Verify both personas**

Run: `pnpm --filter web dev`

Manual check:

- Admin mode shows status, attention, and CTA bridge to `/dashboard/governance`
- Employee mode shows readiness and next action
- Empty-state readiness still behaves correctly for unassigned employees

- [ ] **Step 7: Run validation**

Run: `pnpm typecheck`

- [ ] **Step 8: Commit**

Commit:

`feat(hms): add oversikt attention surface`

Use normal hooks and include the required footer from `Commit Protocol`.

---

## Task 4: Documents — Read-First With Guarded Actions

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_components/DocumentBrowser.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/DocumentViewer.tsx`
- Create: `apps/web/src/app/dashboard/hms/documents/page.tsx`
- Create: `apps/web/src/app/dashboard/hms/_hooks/useProcedureContext.ts`

- [ ] **Step 1: Build the document browser**

Tree depth:

- Handbook chapter
- Policy
- Protocol
- Procedure

Requirements:

- Search field
- Collapsible groups
- URL-driven selection, not local-only state

Use query parameters:

- `/dashboard/hms/documents?type=policy&id=<uuid>`
- `/dashboard/hms/documents?type=procedure&id=<uuid>`

- [ ] **Step 2: Create `useProcedureContext`**

This hook resolves:

- the selected procedure
- its parent protocol
- the current employee's matching assignment, if any

Return shape:

- `procedure`
- `protocol`
- `assignment`
- `isLoading`

This same hook will later be reused by procedure detail.

- [ ] **Step 3: Build the document viewer**

Rendering rules:

- Handbook -> render with the existing `ChapterReader` pattern
- Policy / protocol -> prose and metadata
- Procedure -> ordered steps, including `training_content` when present

Action bar rules for Phase 1:

- Always safe: `Open procedure detail`
- Admin-only: `Open in governance`
- Assignment-aware: `Continue training` only when `!isAdminMode && assignment`
- Disabled placeholder: AI-related actions
- Do **not** show quiz/sign actions directly from documents in this phase

- [ ] **Step 4: Build the page with URL-synced selection**

The page should:

- read `searchParams`
- pass selected state to the browser and viewer
- update the URL when selection changes

Do not rely on an internal `useState` that loses context on refresh.

- [ ] **Step 5: Verify browse and context mode**

Run: `pnpm --filter web dev`

Manual check:

- `/dashboard/hms/documents` opens with no crash
- selecting a document updates the URL
- pasting a URL with `type` + `id` auto-opens the right document
- procedure documents only show `Continue training` when an assignment exists

- [ ] **Step 6: Run validation**

Run: `pnpm typecheck`

- [ ] **Step 7: Commit**

Commit:

`feat(hms): add read-first documents surface`

Use normal hooks and include the required footer from `Commit Protocol`.

---

## Task 5: Training — HMS Surface Over Existing Assignment Flow

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`
- Create: `apps/web/src/app/dashboard/hms/training/page.tsx`

- [ ] **Step 1: Build `CompetenceMatrix` for admin mode**

Data source:

- `protocol_assignment`
- related `profile`
- related `protocol`

Display:

- employee rows
- protocol columns
- cell states for `completed`, `pending`, `expired`
- row readiness summary

Phase 1 rule:

- do not build assignment editing here
- this is visibility, not a new admin mutation surface

- [ ] **Step 2: Reuse `ProtocolList` for employee mode**

For employee mode, reuse `apps/web/src/app/dashboard/my-training/_components/ProtocolList.tsx`.

Do not replace it with a new learn flow in this phase.

- [ ] **Step 3: Wire the training page**

Behavior:

- admin -> `CompetenceMatrix`
- employee -> existing `ProtocolList`

If a future enhancement needs richer deep links, build it on top of assignment context rather than procedure-only routing.

- [ ] **Step 4: Verify both paths**

Run: `pnpm --filter web dev`

Manual check:

- admin sees competence matrix
- employee sees the same real protocol list they already trust

- [ ] **Step 5: Run validation**

Run: `pnpm typecheck`

- [ ] **Step 6: Commit**

Commit:

`feat(hms): add training surface on top of assignments`

Use normal hooks and include the required footer from `Commit Protocol`.

---

## Task 6: Procedure Detail — Assignment-Aware, Read-First

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_hooks/useProcedureTrainingSteps.ts`
- Create: `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/ProcedureExperience.tsx`
- Create: `apps/web/src/app/dashboard/hms/procedure/[id]/page.tsx`

- [ ] **Step 1: Create `useProcedureTrainingSteps`**

Fetch:

- `step_id`
- `title`
- `description`
- `training_content`
- `media_urls`
- `estimated_minutes`
- `is_required`
- `step_order`

Keep this hook local to `apps/web`.

- [ ] **Step 2: Build the admin detail tabs**

Admin tabs:

- `Oversikt`
- `Steg`
- `Relatert`

Phase 1 rules:

- `Oversikt` shows metadata and related protocol/policy info
- `Steg` shows the step list and training content
- `Relatert` shows links out to `/dashboard/governance` for editing tests/confirmations

Do not embed the old CRUD forms here yet.

- [ ] **Step 3: Build `ProcedureExperience`**

This is the employee/read-only wrapper.

Behavior:

- if `!isAdminMode && assignment`, show read-first procedure content plus `Continue training` CTA
- if no assignment exists, show read-only procedure content with no mutation controls

Do not embed `KnowledgeTestView` or `ConfirmationSign` directly here in Phase 1.

- [ ] **Step 4: Wire the route**

The page should:

- read the route param `id`
- use `DashboardContext.isAdminMode`
- render admin tabs in admin mode
- render `ProcedureExperience` in employee mode

- [ ] **Step 5: Verify with a real procedure**

Run: `pnpm --filter web dev`

Manual check:

- admin can open `/dashboard/hms/procedure/<id>` and inspect metadata + steps
- employee can open the same route and gets a safe read-only or assignment-aware view
- no path in this page creates quiz/sign attempts without assignment context

- [ ] **Step 6: Run validation**

Run: `pnpm typecheck`

- [ ] **Step 7: Commit**

Commit:

`feat(hms): add assignment-aware procedure detail`

Use normal hooks and include the required footer from `Commit Protocol`.

---

## Task 7: Automated Smoke + Final Verification

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`
- Create: `apps/e2e/tests/hms-legibility-smoke.spec.ts`

- [ ] **Step 1: Create HMS smoke regression spec**

Base the file on the login helper pattern already used in:

- `apps/e2e/tests/dashboard.spec.ts`
- `apps/e2e/tests/cascade-ui.spec.ts`

The spec should cover at least these checks:

- `/dashboard/hms` loads after login
- `/dashboard/governance` still loads after the sidebar retarget
- front-door HMS navigation opens `/dashboard/hms` instead of `/dashboard/governance`
- admin-mode documents/procedure routes do **not** expose `Continue training`
- employee-mode `/dashboard/hms/training` still renders the assignment-backed `ProtocolList`

- [ ] **Step 2: Run the targeted smoke spec**

Run: `pnpm --filter e2e test:e2e -- tests/hms-legibility-smoke.spec.ts`

Expected: the HMS smoke spec passes.

- [ ] **Step 3: Full typecheck**

Run: `pnpm typecheck`

Expected: 0 errors.

- [ ] **Step 4: Lint**

Run: `pnpm lint`

Expected: no new errors in changed areas.

- [ ] **Step 5: Manual route walkthrough**

Verify:

- `/dashboard/hms` works for admin and employee
- `/dashboard/hms/documents` supports direct URLs
- `/dashboard/hms/training` preserves the current employee training flow
- `/dashboard/hms/procedure/<id>` is read-first and assignment-aware
- `/dashboard/hms/drift` points toward `/dashboard/operations`
- `/dashboard/governance` still works

- [ ] **Step 6: Run targeted regression checks**

Verify explicitly:

- `/dashboard/hms` loads
- `/dashboard/governance` still loads
- employee-mode `/dashboard/hms/training` still renders the assignment-backed `ProtocolList`
- document and procedure routes never expose `Continue training` unless `!isAdminMode && assignment`

- [ ] **Step 7: Update any remaining HMS walkthrough selectors**

If `DashboardShell.tsx` still contains guidance or autoplay references for the old HMS destination, update them to `/dashboard/hms`.

- [ ] **Step 8: Do not redirect governance**

Before final commit, explicitly confirm that this plan did **not** add a redirect from `/dashboard/governance`.

If someone has already added that redirect on the branch, remove it before closing the phase.

- [ ] **Step 9: Commit**

Stage only HMS-related files touched in this plan.

Commit:

`chore(hms): finish phase 1 legibility verification`

Use normal hooks and include the required footer from `Commit Protocol`.

---

## Summary

| Task                | What it delivers                                                            | Estimated complexity |
| ------------------- | --------------------------------------------------------------------------- | -------------------- |
| 1. Data foundation  | Training fields plus safe authoring path in the existing builder            | Medium               |
| 2. HMS shell        | Additive route shell with sidebar retarget, no destructive redirect         | Medium               |
| 3. Oversikt         | Admin attention surface and employee readiness surface                      | Medium               |
| 4. Documents        | URL-driven, read-first document browser with guarded actions                | Large                |
| 5. Training         | Admin matrix plus existing employee assignment flow                         | Medium               |
| 6. Procedure detail | Assignment-aware, read-first procedure page                                 | Medium               |
| 7. Verification     | E2E smoke, typecheck, lint, route walkthrough, no-governance-redirect check | Medium               |

**Total new files:** ~16

**Critical safety changes vs previous draft:**

- `/dashboard/governance` stays live
- no premature `packages/hms`
- no procedure-only mutation flow
- documents and procedure detail now honor assignment context
