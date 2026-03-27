---
title: Website Factory B2b — Spokesperson Flow + Content Tasks
status: draft
updated: 2026-03-22
created: 2026-03-22
module: website-factory
tags: [website, spokesperson, approval, content-tasks, mobile, engine]
---

# Website Factory B2b — Spokesperson Flow + Content Tasks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spokesperson assignment with GDPR-compliant approval flow, recurring content tasks with AI writing assist, and mobile app screens for employee interaction.

**Architecture:** Spokesperson data stored in section content JSONB (validated by Zod schema). Approval flow tracks status via `website_spokesperson` table (new migration). Engine integration creates recurring tasks on approval. Mobile app gets new approval + content creation screens. AI writing uses existing `@smartout/ai` infrastructure.

**Tech Stack:** Next.js App Router (web), React Native + Expo (mobile), Supabase (DB + push), Engine process/state for task scheduling, @smartout/ai for writing assist

**Spec:** `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — sections 7.3, 10, 11, 12

**Scope:** Spokesperson editor, approval flow (admin + mobile), recurring content tasks, AI writing panel.

---

## File Map

### 1. Database Migration

| File                                            | Responsibility                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `supabase/migrations/YYYYMMDD_spokesperson.sql` | `website_spokesperson` table, `spokesperson` section type, status enum |

### 2. Package Extension

| File                                                    | Responsibility                              |
| ------------------------------------------------------- | ------------------------------------------- |
| `packages/website/src/sections/schemas/spokesperson.ts` | Zod schema for spokesperson section content |
| `packages/website/src/sections/registry.ts`             | Register spokesperson section               |

### 3. Web Dashboard (Server Actions + Components)

| File                                         | Responsibility                                                |
| -------------------------------------------- | ------------------------------------------------------------- |
| `_actions/spokesperson-actions.ts`           | assignSpokesperson, revokeSpokesperson, getSpokespersonStatus |
| `_hooks/use-spokesperson.ts`                 | TanStack Query hook for spokesperson data                     |
| `_components/editors/SpokespersonEditor.tsx` | Spokesperson section editor with employee picker              |
| `_components/SpokespersonApprovalCard.tsx`   | Admin view of approval status + timeline                      |
| `_components/EmployeePicker.tsx`             | Searchable employee dropdown                                  |
| `_components/ContentTaskConfig.tsx`          | Recurring task configuration per spokesperson                 |

### 4. Mobile App

| File                                                          | Responsibility                   |
| ------------------------------------------------------------- | -------------------------------- |
| `apps/mobile/app/(app)/(home)/spokesperson-approval.tsx`      | Approval screen route            |
| `apps/mobile/src/components/spokesperson/ApprovalCard.tsx`    | Approval request card            |
| `apps/mobile/src/components/spokesperson/ContentTaskList.tsx` | Task list after approval         |
| `apps/mobile/src/components/spokesperson/ContentCreator.tsx`  | Photo upload + text editor       |
| `apps/mobile/src/components/spokesperson/AiWritingPanel.tsx`  | 3 AI suggestions + custom prompt |

### 5. Telemetry

| File                                 | Responsibility        |
| ------------------------------------ | --------------------- |
| `packages/telemetry/src/registry.ts` | 5 spokesperson events |

---

## Tasks

### Task 1: Database Migration — Spokesperson Table

**Files to create:**

- `supabase/migrations/20260322200000_website_spokesperson.sql`

**Read first:**

- `supabase/migrations/20260322100000_create_websites_schema.sql` — existing websites schema pattern
- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — sections 10, 15

**Steps:**

- [ ] Create migration with:

```sql
-- Add spokesperson to section_type CHECK constraint
ALTER TABLE websites.website_section
  DROP CONSTRAINT website_section_section_type_check,
  ADD CONSTRAINT website_section_section_type_check
    CHECK (section_type IN (
      'hero', 'rich_text', 'text_image', 'feature_grid', 'gallery',
      'testimonials', 'cta', 'hours', 'map', 'contact',
      'menu_preview', 'menu_full', 'faq', 'booking_cta',
      'pdf_viewer', 'footer', 'spokesperson'
    ));

-- Spokesperson approval status
CREATE TYPE websites.spokesperson_status AS ENUM (
  'pending',    -- assigned, notification sent
  'approved',   -- employee accepted
  'declined',   -- employee declined
  'revoked'     -- admin removed
);

-- Spokesperson assignment tracking
CREATE TABLE websites.website_spokesperson (
  website_spokesperson_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites.website(website_id),
  website_section_id UUID NOT NULL REFERENCES websites.website_section(website_section_id),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id),
  profile_id UUID NOT NULL REFERENCES public.profile(profile_id),
  role_title TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  status websites.spokesperson_status NOT NULL DEFAULT 'pending',
  decline_reason TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  content_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(website_section_id)
);

-- Indexes
CREATE INDEX idx_spokesperson_website ON websites.website_spokesperson(website_id);
CREATE INDEX idx_spokesperson_profile ON websites.website_spokesperson(profile_id);
CREATE INDEX idx_spokesperson_status ON websites.website_spokesperson(status);

-- Trigger
CREATE TRIGGER set_website_spokesperson_updated_at
  BEFORE UPDATE ON websites.website_spokesperson
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE websites.website_spokesperson ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_spokesperson"
  ON websites.website_spokesperson
  FOR ALL
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Employee can read their own assignments
CREATE POLICY "employee_read_own_spokesperson"
  ON websites.website_spokesperson
  FOR SELECT
  USING (profile_id IN (
    SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
  ));

-- Employee can update status on own assignment (approve/decline)
CREATE POLICY "employee_update_own_spokesperson"
  ON websites.website_spokesperson
  FOR UPDATE
  USING (profile_id IN (
    SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
  ));
```

- [ ] Run migration via docker exec

**Verify:** `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT * FROM websites.website_spokesperson LIMIT 0;"`

**Commit:** `feat(website-factory): spokesperson table, status enum, and RLS policies`

---

### Task 2: Spokesperson Zod Schema + Section Registration

**Files to create:**

- `packages/website/src/sections/schemas/spokesperson.ts`

**Files to modify:**

- `packages/website/src/sections/registry.ts`
- `packages/website/src/sections/schemas/index.ts`

**Steps:**

- [ ] Create `spokesperson.ts`:

```typescript
import { z } from "zod";

const contentTaskSchema = z.object({
  type: z.enum(["upload_photo", "write_post", "update_quote", "custom"]),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  deadlineDay: z.number().min(0).max(6).default(4), // 0=Mon, 4=Fri
  instructions: z.string().default(""),
  enabled: z.boolean().default(true),
});

export const spokespersonContentSchema = z.object({
  profileId: z.string().uuid().optional(),
  roleTitle: z.string().default(""),
  quote: z.string().default(""),
  bio: z.string().default(""),
  imageAssetId: z.string().uuid().optional(),
  contentTasks: z.array(contentTaskSchema).default([]),
});

export type SpokespersonContent = z.infer<typeof spokespersonContentSchema>;
export type ContentTask = z.infer<typeof contentTaskSchema>;

export const spokespersonDefaults: SpokespersonContent = {
  roleTitle: "",
  quote: "",
  bio: "",
  contentTasks: [],
};
```

- [ ] Register in `registry.ts`:

```typescript
import { spokespersonContentSchema, spokespersonDefaults } from "./schemas/spokesperson";

registerSection({
  type: "spokesperson",
  name: "Talsperson",
  description: "Fremhev en ansatt som talsperson for virksomheten",
  schema: spokespersonContentSchema,
  defaults: spokespersonDefaults,
  maxPerPage: 1,
});
```

- [ ] Export from `schemas/index.ts`

**Verify:** `pnpm turbo typecheck --filter=website`

**Commit:** `feat(website-factory): spokesperson Zod schema and section registration`

---

### Task 3: Spokesperson Server Actions + Hook

**Files to create:**

- `apps/web/src/app/dashboard/website/_actions/spokesperson-actions.ts`
- `apps/web/src/app/dashboard/website/_hooks/use-spokesperson.ts`

**Read first:**

- `apps/web/src/app/dashboard/website/_actions/publish-actions.ts` — auth pattern
- Migration from Task 1 — table schema

**Steps:**

- [ ] Create `spokesperson-actions.ts`:
  - `assignSpokesperson(websiteId, sectionId, profileId, roleTitle, contentTasks[])` — insert into website_spokesperson, emit event
  - `revokeSpokesperson(websiteId, spokespersonId)` — set status='revoked', emit event
  - `getSpokespersonForSection(sectionId)` — fetch spokesperson record with profile data join
  - `respondToSpokesperson(spokespersonId, approve: boolean, declineReason?)` — update status, set responded_at, emit event

- [ ] Create `use-spokesperson.ts`:
  - `useSpokesperson(sectionId)` — fetch spokesperson with profile data
  - Mutations: assign, revoke, respond

**Verify:** `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): spokesperson server actions and TanStack Query hook`

---

### Task 4: Employee Picker Component

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/EmployeePicker.tsx`

**Read first:**

- Existing employee/profile selection patterns: `grep -r "profile" apps/web/src/app/dashboard/ -l --include="*.tsx" | head -10`

**Steps:**

- [ ] Create `EmployeePicker.tsx`:
  - Searchable combobox (shadcn Command component)
  - Fetches workspace profiles via user-scoped Supabase client
  - Shows avatar (from profile or initials), name, role
  - Filter by search text (name match)
  - Props: `workspaceId: string`, `selectedProfileId?: string`, `onSelect: (profileId: string, profile: { name: string; avatar_url?: string }) => void`
  - Excludes profiles already assigned as spokesperson (optional filter)

**Verify:** Opens, searches, selects employee. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): employee picker combobox for spokesperson assignment`

---

### Task 5: Spokesperson Editor + Approval Card

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/editors/SpokespersonEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/SpokespersonApprovalCard.tsx`
- `apps/web/src/app/dashboard/website/_components/ContentTaskConfig.tsx`

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/editors/editor-registry.ts` — add spokesperson

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — sections 7.3, 10, 12
- `packages/website/src/sections/schemas/spokesperson.ts` (from Task 2)

**Steps:**

- [ ] Create `SpokespersonEditor.tsx`:
  - If no spokesperson assigned: EmployeePicker + "Tilordne talsperson" button
  - If assigned: SpokespersonApprovalCard + form fields (roleTitle, quote, bio, image)
  - ContentTaskConfig section below
  - On assign: calls `assignSpokesperson()`, triggers approval flow

- [ ] Create `SpokespersonApprovalCard.tsx`:
  - Person card: avatar, name, role
  - Status badge: Venter (yellow), Aktiv (green), Avvist (red), Tilbakekalt (gray)
  - Timeline: assigned_at, responded_at
  - If declined: shows decline_reason
  - "Bytt person" button → re-opens picker
  - "Tilbakekall" button → revokes

- [ ] Create `ContentTaskConfig.tsx`:
  - Repeatable task list with:
    - Type selector: Upload bilde, Skriv innlegg, Oppdater sitat, Egendefinert
    - Frequency: Ukentlig, Annenhver uke, Manedlig
    - Deadline day selector
    - Instructions textarea
    - Enable/disable toggle
  - "Legg til oppgave" button
  - Changes propagate to parent form via onChange

- [ ] Register spokesperson in `editor-registry.ts`

**Verify:** Select spokesperson section → editor shows picker or approval card. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): spokesperson editor with approval card and content task config`

---

### Task 6: Spokesperson Telemetry Events

**Files to modify:**

- `packages/telemetry/src/registry.ts`

**Steps:**

- [ ] Add 5 spokesperson events:
  - `WebsiteSpokespersonAssigned` — `"website spokesperson_assigned"`, data: `{ profile_id: string; role_title: string }`
  - `WebsiteSpokespersonApproved` — `"website spokesperson_approved"`, data: `{ profile_id: string }`
  - `WebsiteSpokespersonDeclined` — `"website spokesperson_declined"`, data: `{ profile_id: string; reason?: string }`
  - `WebsiteSpokespersonContentSubmitted` — `"website spokesperson_content_submitted"`, data: `{ task_type: string }`
  - `WebsiteSpokespersonTaskOverdue` — `"website spokesperson_task_overdue"`, data: `{ task_type: string; profile_id: string }`
- [ ] Add to union + routing (spokesperson_assigned/approved/declined → posthog + activity_trail + engine_event + notifications)

**Verify:** `pnpm turbo typecheck`

**Commit:** `feat(website-factory): spokesperson telemetry events (5 events, 5 destinations)`

---

### Task 7: Mobile App — Approval Screen

**Files to create:**

- `apps/mobile/app/(app)/(home)/spokesperson-approval.tsx` — route
- `apps/mobile/src/components/spokesperson/ApprovalCard.tsx` — approval request UI

**Read first:**

- `apps/mobile/app/(app)/(home)/` — existing home routes
- `apps/mobile/src/components/task/TaskModal.tsx` — existing bottom sheet pattern
- `apps/mobile/src/components/ui/` — existing UI primitives

**Steps:**

- [ ] Create `ApprovalCard.tsx` — React Native component:
  - Restaurant name + "Talsperson-forespørsel" header
  - Employee's avatar and name
  - Role on website
  - "Hva blir synlig" list (name, image, role, quote, description)
  - "Dine oppgaver" list (configured content tasks)
  - Response deadline
  - "Godta" button (green) + "Avslå" button (red outline)
  - On decline: optional reason TextInput + confirmation
  - Calls `respondToSpokesperson()` via Supabase client

- [ ] Create route `spokesperson-approval.tsx`:
  - Receives `spokespersonId` param
  - Fetches spokesperson record + workspace data
  - Renders ApprovalCard
  - On response: navigates back to home

**Verify:** Mobile app compiles, route renders. `pnpm turbo typecheck --filter=mobile`

**Commit:** `feat(website-factory): mobile spokesperson approval screen`

---

### Task 8: Mobile App — Content Creation + AI Writing

**Files to create:**

- `apps/mobile/src/components/spokesperson/ContentTaskList.tsx`
- `apps/mobile/src/components/spokesperson/ContentCreator.tsx`
- `apps/mobile/src/components/spokesperson/AiWritingPanel.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — sections 11.4, 12
- `apps/mobile/src/components/task/TaskFeed.tsx` — existing task list pattern
- `packages/ai/` — existing AI infrastructure

**Steps:**

- [ ] Create `ContentTaskList.tsx`:
  - Lists spokesperson's recurring tasks
  - Status badges: overdue (red), upcoming (yellow), completed (green)
  - Tap task → opens ContentCreator

- [ ] Create `ContentCreator.tsx`:
  - Photo upload (multi-image via Expo ImagePicker)
  - Text editor (TextInput multiline)
  - "AI-hjelp" button → opens AiWritingPanel
  - "Send inn" button → submits content, emits telemetry

- [ ] Create `AiWritingPanel.tsx`:
  - 3 AI-generated suggestions based on uploaded image + restaurant profile
  - Custom prompt TextInput for specific direction
  - Tap suggestion → fills text editor
  - Uses edge function or API call for generation (stub if AI infra not ready)

**Verify:** Mobile app compiles. `pnpm turbo typecheck --filter=mobile`

**Commit:** `feat(website-factory): mobile content creation with AI writing assist`

---

## Verification Checklist

- [ ] `pnpm turbo typecheck` passes (web + mobile)
- [ ] Spokesperson section appears in section picker
- [ ] Employee picker searches and selects profiles
- [ ] Assigning spokesperson creates website_spokesperson record
- [ ] Approval card shows correct status (pending/approved/declined)
- [ ] Content task config saves to spokesperson content
- [ ] Mobile approval screen renders with accept/decline
- [ ] Mobile content creator opens with photo upload + text
- [ ] AI writing panel shows 3 suggestions (or stub)
- [ ] All mutations emit telemetry

---

## Dependencies

| Dependency             | Status             | Notes                                                |
| ---------------------- | ------------------ | ---------------------------------------------------- |
| B1 + B2a complete      | Done               | All editors, bridges, DnD exist                      |
| `profile` table        | Exists             | Employee data for picker                             |
| `@smartout/ai`         | Exists             | AI generation infrastructure                         |
| `@gorhom/bottom-sheet` | Installed (mobile) | Bottom sheet pattern                                 |
| Expo ImagePicker       | Check              | May need install for mobile                          |
| Push notifications     | Partial            | `packages/notifications` exists, push may need setup |

---

## Changelog

| Date       | Change                                                        |
| ---------- | ------------------------------------------------------------- |
| 2026-03-22 | Initial plan — 8 tasks for B2b (spokesperson + content tasks) |

---

## Council Verdict — 2026-03-26

**Verdict: APPROVED_WITH_CONDITIONS**

**Implementation status:** All 8 tasks are complete. Migration, Zod schema, web components, server actions, mobile screens, and telemetry are all in place.

### Issues — must fix before merge

**1. RLS policy too broad (Security — HIGH)**
`admin_all_spokesperson` policy uses `get_workspace_ids_for_user()` which grants `FOR ALL` access to every workspace member, not just admins. Any employee in the workspace can read and modify all spokesperson records via the JWT path — including records for colleagues.

Fix: Replace with `is_admin_in_workspace()` check, or split into separate admin/member policies. The employee-specific policies (`employee_read_own_spokesperson`, `employee_update_own_spokesperson`) are correct and cover the employee path.

**2. `getSpokespersonForSection` bypasses workspace authorization (Security — HIGH)**
The function checks only that the caller is authenticated (`if (!user)`), then uses a service-role admin client to query. No workspace-level authorization is verified. Any authenticated user can call this with any `sectionId` and retrieve spokesperson data from an arbitrary workspace.

Fix: Add admin role check (e.g. call `requireAdminForWebsite` or verify workspace membership via RLS-scoped client).

**3. Missing telemetry event `website spokesperson_revoked` (Type safety — MEDIUM)**
`revokeSpokesperson()` emits `"website spokesperson_revoked" as any` — this event is not registered in `packages/telemetry/src/registry.ts`. The plan listed only 5 events but this is a 6th that was implemented.

Fix: Add `WebsiteSpokespersonRevoked` event to telemetry registry with routing to `posthog + activity_trail`.

### Notes — non-blocking

- **AI writing is stubbed:** Acceptable per plan. TODO comments are clear with real implementation path noted.
- **`expo-image-picker` confirmed installed** at `^55.0.13`. No action needed.
- **editor-registry.ts** correctly registers the spokesperson section.

**Reviewer:** council-reviewer agent | 2026-03-26
