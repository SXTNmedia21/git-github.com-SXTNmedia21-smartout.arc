---
title: Website Factory Builder — Implementation Plan (Phase B1)
status: done
updated: 2026-03-26
created: 2026-03-22
module: website-factory
tags: [website, builder, ui, editor, sections, templates, plan]
---

# Website Factory Builder — Implementation Plan (Phase B1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin-facing builder UI that lets workspace admins create a website from a template, edit section content via structured forms, manage pages, and publish — all within `/dashboard/website`.

**Architecture:** Form-driven section editors backed by Zod schemas from `@smartout/website`. TanStack Query for all data fetching + mutations via server actions. 2-column editor layout with section sidebar. Setup wizard bootstraps site from template manifest. All mutations emit telemetry via `@smartout/telemetry`.

**Tech Stack:** Next.js App Router, React 19, TanStack Query v5, react-hook-form + zodResolver, shadcn/ui, Tailwind v4, Supabase (`websites` schema), sonner toasts, lucide-react icons

**Spec:** `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md`

**Foundation (Plan A):** `docs/superpowers/plans/2026-03-22-website-factory-foundation.md`

**Scope:** Phase B1 (Core Builder MVP) — P0 tasks only, with P1 enhancements as stretch goals.

---

## File Map

### 1. Server Actions (`apps/web/src/app/dashboard/website/_actions/`)

| File                 | Responsibility                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `website-actions.ts` | `createWebsiteFromTemplate()`, `getWebsiteForWorkspace()`, `updateWebsite()`                                   |
| `page-actions.ts`    | `createPage()`, `deletePage()`, `reorderPages()`, `togglePageVisibility()`                                     |
| `section-actions.ts` | `createSection()`, `deleteSection()`, `updateSectionContent()`, `reorderSections()`, `updateSectionSettings()` |
| `preview-actions.ts` | `createPreviewToken()`                                                                                         |
| `publish-actions.ts` | Already exists from Plan A — no changes needed                                                                 |

### 2. TanStack Query Hooks (`apps/web/src/app/dashboard/website/_hooks/`)

| File               | Responsibility                                                             |
| ------------------ | -------------------------------------------------------------------------- |
| `website-keys.ts`  | Query key factory for all website queries                                  |
| `use-website.ts`   | Fetch website for current workspace, update mutation                       |
| `use-pages.ts`     | Fetch pages for website, create/delete/reorder/toggle mutations            |
| `use-sections.ts`  | Fetch sections for a page, CRUD mutations, content update, settings update |
| `use-templates.ts` | Fetch template manifests from `@smartout/website` (client-side, no DB)     |
| `use-autosave.ts`  | Debounced autosave hook (60s dirty interval)                               |

### 3. Pages (`apps/web/src/app/dashboard/website/`)

| File                      | Responsibility                                                   |
| ------------------------- | ---------------------------------------------------------------- |
| `page.tsx`                | Overview — server component, redirects to `/setup` if no website |
| `layout.tsx`              | Website builder layout wrapper                                   |
| `setup/page.tsx`          | Setup wizard — server component shell                            |
| `pages/[pageId]/page.tsx` | Section editor — server component that loads page data           |

### 4. Components (`apps/web/src/app/dashboard/website/_components/`)

| File                       | Responsibility                                                        |
| -------------------------- | --------------------------------------------------------------------- |
| `WebsiteOverview.tsx`      | Overview client component — status, stats, page list, actions         |
| `SetupWizard.tsx`          | 3-step wizard (template → customize → confirm)                        |
| `TemplateGallery.tsx`      | Template card grid with tier badges                                   |
| `TemplatePreview.tsx`      | Full-page template preview overlay (P1)                               |
| `SectionEditor.tsx`        | 2-column editor layout orchestrator                                   |
| `SectionSidebar.tsx`       | Left column — section list with active state                          |
| `SectionForm.tsx`          | Right column — renders form based on section type via editor registry |
| `SectionPicker.tsx`        | Add-section dialog with search and category grid                      |
| `ImageUpload.tsx`          | Image upload widget with preview, alt-text, metadata                  |
| `PageList.tsx`             | Page list with reorder, visibility toggle, add/delete                 |
| `SaveStatus.tsx`           | Save indicator pill ("Lagret" / "Lagrer..." / "Ulagrede endringer")   |
| `SectionSettingsPanel.tsx` | Section settings (background, width, spacing) — P1                    |

### 5. Section Editor Forms (`apps/web/src/app/dashboard/website/_components/editors/`)

| File                     | Responsibility                                                    |
| ------------------------ | ----------------------------------------------------------------- |
| `editor-registry.ts`     | Maps `section_type` → lazy-loaded editor component                |
| `HeroEditor.tsx`         | Hero section form (heading, subheading, button, image, alignment) |
| `RichTextEditor.tsx`     | Rich text form (HTML textarea)                                    |
| `TextImageEditor.tsx`    | Text + image form (heading, body, image, position, button)        |
| `FeatureGridEditor.tsx`  | Feature grid form (heading, columns, repeatable items)            |
| `GalleryEditor.tsx`      | Gallery form (heading, layout, columns, image list)               |
| `TestimonialsEditor.tsx` | Testimonials form (heading, layout, repeatable items)             |
| `CtaEditor.tsx`          | CTA form (heading, body, buttons)                                 |
| `FaqEditor.tsx`          | FAQ form (heading, repeatable Q&A items)                          |
| `FooterEditor.tsx`       | Footer form (toggle blocks, copyright)                            |
| `HoursEditor.tsx`        | Hours display editor (P0 basic — system bridge in B2)             |
| `MapEditor.tsx`          | Map embed editor (P0 basic)                                       |
| `ContactEditor.tsx`      | Contact info editor (P0 basic)                                    |
| `MenuPreviewEditor.tsx`  | Menu preview editor (P0 basic)                                    |
| `MenuFullEditor.tsx`     | Menu full editor (P0 basic)                                       |
| `BookingCtaEditor.tsx`   | Booking CTA editor (P0 basic)                                     |
| `PdfViewerEditor.tsx`    | PDF viewer editor (P0 basic)                                      |

### 6. DashboardShell Modification

| File                                                   | Change                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `apps/web/src/components/dashboard/DashboardShell.tsx` | Add "Nettside" NavItem with Globe icon in Administrasjon group, after Organisasjon |

### 7. Dashboard Keys Extension

| File                                                  | Change                 |
| ----------------------------------------------------- | ---------------------- |
| `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts` | Add website query keys |

---

## Tasks

### Task 1: Server Actions — Website CRUD

**Files to create:**

- `apps/web/src/app/dashboard/website/_actions/website-actions.ts`
- `apps/web/src/app/dashboard/website/_actions/preview-actions.ts`

**Read first:**

- `apps/web/src/app/dashboard/website/_actions/publish-actions.ts` — pattern for `requireAdminForWebsite()`, service-role client, `.schema('websites')` usage
- `apps/web/src/app/dashboard/people/_actions/people-actions.ts` — simpler server action pattern
- `packages/website/src/templates/registry.ts` — `getTemplate()`, `WebsiteTemplate` type
- `packages/website/src/sections/registry.ts` — `getSectionDef()` for defaults
- `packages/website/src/constants.ts` — LIMITS

**Steps:**

- [ ] Create `website-actions.ts` with `getWebsiteForWorkspace(workspaceId)` — queries `websites.website` + joins domain
- [ ] Add `createWebsiteFromTemplate(workspaceId, templateKey, customizations)` — single transaction:
  1. Validate template exists via `getTemplate()`
  2. Insert `websites.website` row with template_key, template_version, merged theme
  3. Insert `websites.website_page` rows from template `defaultPages`
  4. Insert `websites.website_section` rows from template sections with `getSectionDef()` defaults
  5. Insert `websites.website_domain` row for `{slug}.smartout.info`
  6. Insert `websites.website_draft_revision` with `source = 'template_apply'`
  7. Update `public.workspace` set `has_website = true`
  8. Return created website
- [ ] Add `updateWebsite(websiteId, updates)` — updates name, tagline, contact info, social links
- [ ] Create `preview-actions.ts` with `createPreviewToken(websiteId)` — inserts token row with 24h expiry
- [ ] Add telemetry `emit()` calls in each mutation

**Key code — `createWebsiteFromTemplate`:**

```typescript
"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@smartout/supabase/server";
import { getTemplate, getSectionDef } from "@smartout/website";
import { defaultSectionSettings } from "@smartout/website";
import { emit } from "@smartout/telemetry";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type CreateWebsiteInput = {
  workspaceId: string;
  templateKey: string;
  name: string;
  siteSlug: string;
  theme?: Record<string, unknown>;
};

export async function createWebsiteFromTemplate(input: CreateWebsiteInput) {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const template = getTemplate(input.templateKey);
  if (!template) throw new Error(`Template not found: ${input.templateKey}`);

  const admin = getAdminClient();

  // 1. Create website
  const { data: website, error: websiteError } = await admin
    .schema("websites")
    .from("website")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      site_slug: input.siteSlug,
      template_key: template.key,
      template_version: template.version,
      theme: input.theme ?? template.defaultTheme,
      visibility: "draft",
      created_by: user.id,
    })
    .select("website_id, site_slug")
    .single();

  if (websiteError || !website) {
    throw new Error(`Failed to create website: ${websiteError?.message}`);
  }

  const websiteId = (website as { website_id: string }).website_id;
  const siteSlug = (website as { site_slug: string }).site_slug;

  // 2. Create pages from template
  for (let pageIdx = 0; pageIdx < template.defaultPages.length; pageIdx++) {
    const pageDef = template.defaultPages[pageIdx];

    const { data: page, error: pageError } = await admin
      .schema("websites")
      .from("website_page")
      .insert({
        website_id: websiteId,
        workspace_id: input.workspaceId,
        slug: pageDef.slug,
        title: pageDef.title,
        page_type: pageDef.type,
        sort_order: pageIdx,
        is_visible: true,
      })
      .select("website_page_id")
      .single();

    if (pageError || !page) continue;

    const pageId = (page as { website_page_id: string }).website_page_id;

    // 3. Create sections for each page
    for (let secIdx = 0; secIdx < pageDef.sections.length; secIdx++) {
      const sectionType = pageDef.sections[secIdx];
      const sectionDef = getSectionDef(sectionType);

      await admin
        .schema("websites")
        .from("website_section")
        .insert({
          website_page_id: pageId,
          workspace_id: input.workspaceId,
          section_type: sectionType,
          content: sectionDef?.defaults ?? {},
          settings: defaultSectionSettings,
          sort_order: secIdx,
          is_visible: true,
        });
    }
  }

  // 4. Create default domain
  await admin
    .schema("websites")
    .from("website_domain")
    .insert({
      website_id: websiteId,
      workspace_id: input.workspaceId,
      hostname: `${siteSlug}.smartout.info`,
      is_primary: true,
      is_verified: true,
    });

  // 5. Create draft revision
  await admin
    .schema("websites")
    .from("website_draft_revision")
    .insert({
      website_id: websiteId,
      workspace_id: input.workspaceId,
      source: "template_apply",
      changed_by: user.id,
      change_summary: `Created from template: ${template.name}`,
    });

  // 6. Set workspace flag
  await admin.from("workspace").update({ has_website: true }).eq("workspace_id", input.workspaceId);

  await emit({
    event: "website setup completed",
    properties: {
      entity: { type: "website", id: websiteId, workspace_id: input.workspaceId },
      data: { template_key: template.key, page_count: template.defaultPages.length },
    },
  });

  return { websiteId, siteSlug };
}
```

**Verify:** `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): server actions for website and preview CRUD`

---

### Task 2: Server Actions — Page CRUD

**Files to create:**

- `apps/web/src/app/dashboard/website/_actions/page-actions.ts`

**Read first:**

- `apps/web/src/app/dashboard/website/_actions/publish-actions.ts` — `requireAdminForWebsite()` pattern
- `packages/website/src/constants.ts` — `LIMITS.maxPagesPerSite`

**Steps:**

- [ ] Create `createPage(websiteId, title, pageType, slug)` — inserts page row, returns new page
- [ ] Create `deletePage(websiteId, pageId)` — soft-delete (sets `deleted_at`), validates not home page
- [ ] Create `reorderPages(websiteId, orderedPageIds: string[])` — batch update `sort_order`
- [ ] Create `togglePageVisibility(websiteId, pageId, isVisible)` — updates `is_visible`
- [ ] Add `emit()` calls: `website.page_created`, `website.page_deleted`, `website.page_reordered`
- [ ] Validate page count against `LIMITS.maxPagesPerSite` in `createPage`

**Key code — `createPage`:**

```typescript
export async function createPage(websiteId: string, title: string, pageType: string, slug: string) {
  const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

  // Check page count limit
  const { count } = await admin
    .schema("websites")
    .from("website_page")
    .select("*", { count: "exact", head: true })
    .eq("website_id", websiteId)
    .is("deleted_at", null);

  if ((count ?? 0) >= LIMITS.maxPagesPerSite) {
    throw new Error(`Maximum ${LIMITS.maxPagesPerSite} pages per site`);
  }

  const { data, error } = await admin
    .schema("websites")
    .from("website_page")
    .insert({
      website_id: websiteId,
      workspace_id: workspaceId,
      title,
      slug,
      page_type: pageType,
      sort_order: count ?? 0,
      is_visible: true,
    })
    .select("website_page_id, title, slug, page_type, sort_order, is_visible")
    .single();

  if (error) throw new Error(error.message);

  await emit({
    event: "website page created",
    properties: {
      entity: { type: "website_page", id: data.website_page_id, workspace_id: workspaceId },
      data: { title, page_type: pageType },
    },
  });

  return data;
}
```

**Verify:** `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): server actions for page CRUD`

---

### Task 3: Server Actions — Section CRUD

**Files to create:**

- `apps/web/src/app/dashboard/website/_actions/section-actions.ts`

**Read first:**

- `packages/website/src/sections/registry.ts` — `getSectionDef()` for schema validation + defaults
- `packages/website/src/sections/schemas/settings.ts` — `sectionSettingsSchema`, `defaultSectionSettings`
- `packages/website/src/constants.ts` — `LIMITS.maxSectionsPerPage`

**Steps:**

- [ ] Create `createSection(websiteId, pageId, sectionType)` — validates type in registry, inserts with defaults
- [ ] Create `deleteSection(websiteId, sectionId)` — soft-delete
- [ ] Create `updateSectionContent(websiteId, sectionId, content)` — validates content against Zod schema from registry, updates
- [ ] Create `reorderSections(websiteId, pageId, orderedSectionIds)` — batch update `sort_order`
- [ ] Create `updateSectionSettings(websiteId, sectionId, settings)` — validates against `sectionSettingsSchema`
- [ ] Add `emit()` calls for all section events
- [ ] Create draft revision on content/settings updates

**Key code — `updateSectionContent`:**

```typescript
export async function updateSectionContent(
  websiteId: string,
  sectionId: string,
  content: Record<string, unknown>,
  source: "manual" | "autosave" = "manual",
) {
  const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

  // Fetch section to get type for validation
  const { data: section } = await admin
    .schema("websites")
    .from("website_section")
    .select("section_type")
    .eq("website_section_id", sectionId)
    .single();

  if (!section) throw new Error("Section not found");

  const sectionDef = getSectionDef((section as { section_type: string }).section_type);
  if (sectionDef) {
    const result = sectionDef.schema.safeParse(content);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.error.message}`);
    }
  }

  const { error } = await admin
    .schema("websites")
    .from("website_section")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("website_section_id", sectionId);

  if (error) throw new Error(error.message);

  // Track draft revision
  await admin
    .schema("websites")
    .from("website_draft_revision")
    .insert({
      website_id: websiteId,
      workspace_id: workspaceId,
      source,
      changed_by: user.id,
      change_summary: `Updated ${(section as { section_type: string }).section_type} section`,
    });

  await emit({
    event: "website section updated",
    properties: {
      entity: { type: "website_section", id: sectionId, workspace_id: workspaceId },
      data: { section_type: (section as { section_type: string }).section_type, source },
    },
  });
}
```

**Verify:** `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): server actions for section CRUD`

---

### Task 4: TanStack Query Hooks

**Files to create:**

- `apps/web/src/app/dashboard/website/_hooks/website-keys.ts`
- `apps/web/src/app/dashboard/website/_hooks/use-website.ts`
- `apps/web/src/app/dashboard/website/_hooks/use-pages.ts`
- `apps/web/src/app/dashboard/website/_hooks/use-sections.ts`
- `apps/web/src/app/dashboard/website/_hooks/use-templates.ts`
- `apps/web/src/app/dashboard/website/_hooks/use-autosave.ts`

**Files to modify:**

- `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts` — add website keys

**Read first:**

- `apps/web/src/app/dashboard/season/_hooks/use-seasons.ts` — hook pattern with `useWorkspaceOptional`, `DashboardContext`, `emit()`, `toast`
- `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts` — key factory pattern

**Steps:**

- [ ] Create `website-keys.ts` — key factory: `website(wsId)`, `pages(websiteId)`, `sections(pageId)`, `templates()`
- [ ] Add website keys to `dashboard-keys.ts`: `website`, `websitePages`, `websiteSections`
- [ ] Create `use-website.ts` — `useWebsite()` hook: fetches website for workspace, returns `{ website, isLoading, error }`
- [ ] Create `use-pages.ts` — `usePages(websiteId)` hook: fetches pages, mutation hooks for create/delete/reorder/toggle
- [ ] Create `use-sections.ts` — `useSections(pageId)` hook: fetches sections, mutation hooks for CRUD + content + settings
- [ ] Create `use-templates.ts` — `useTemplates()` hook: returns `getAllTemplates()` from `@smartout/website` (synchronous, no DB)
- [ ] Create `use-autosave.ts` — `useAutosave(sectionId, content, isDirty)`: debounced 60s save with dirty tracking

**Key code — `website-keys.ts`:**

```typescript
export const websiteKeys = {
  all: ["website"] as const,
  website: (workspaceId: string) => ["website", "site", workspaceId] as const,
  pages: (websiteId: string) => ["website", "pages", websiteId] as const,
  sections: (pageId: string) => ["website", "sections", pageId] as const,
  templates: () => ["website", "templates"] as const,
};
```

**Key code — `use-website.ts`:**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { websiteKeys } from "./website-keys";
import { toast } from "sonner";

export function useWebsite() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();

  const query = useQuery({
    queryKey: websiteKeys.website(wsId ?? "none"),
    queryFn: async () => {
      // Use service-client-accessible RPC or direct query
      // websites schema requires .schema('websites')
      const { data, error } = await supabase
        .schema("websites" as any)
        .from("website")
        .select(
          `
          website_id, name, site_slug, tagline, template_key, template_version,
          theme, visibility, booking_provider, booking_url,
          social_links, contact_email, contact_phone, contact_address,
          created_at, updated_at
        `,
        )
        .eq("workspace_id", wsId!)
        .is("deleted_at", null)
        .single();

      if (error?.code === "PGRST116") return null; // No website yet
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    website: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    hasWebsite: !!query.data,
  };
}
```

**Key code — `use-autosave.ts`:**

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";

type AutosaveConfig = {
  onSave: (content: Record<string, unknown>) => Promise<void>;
  intervalMs?: number;
};

export function useAutosave(config: AutosaveConfig) {
  const { onSave, intervalMs = 60_000 } = config;
  const isDirtyRef = useRef(false);
  const contentRef = useRef<Record<string, unknown>>({});
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const markDirty = useCallback((content: Record<string, unknown>) => {
    isDirtyRef.current = true;
    contentRef.current = content;
  }, []);

  const markClean = useCallback(() => {
    isDirtyRef.current = false;
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(async () => {
      if (isDirtyRef.current) {
        await onSave(contentRef.current);
        isDirtyRef.current = false;
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onSave, intervalMs]);

  return { markDirty, markClean, isDirty: isDirtyRef };
}
```

**Verify:** `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): TanStack Query hooks for website builder`

---

### Task 5: Sidebar Navigation Entry

**Files to modify:**

- `apps/web/src/components/dashboard/DashboardShell.tsx`

**Read first:**

- `apps/web/src/components/dashboard/DashboardShell.tsx:1310-1350` — Administrasjon group NavItems

**Steps:**

- [ ] Import `Globe` from `lucide-react`
- [ ] Add "Nettside" NavItem after "Organisasjon" and before "Vakt" (around line 1340)
- [ ] Gate visibility with `workspace.has_website` OR always show for admin/owner (setup wizard handles no-website case)

**Code:**

```tsx
<NavItem
  href="/dashboard/website"
  icon={Globe}
  label="Nettside"
  isDark={isDark}
  active={isActive("/dashboard/website")}
  isCollapsed={isSidebarCollapsed}
/>
```

**Verify:** Visual — check sidebar renders with "Nettside" entry. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): add Nettside sidebar navigation entry`

---

### Task 6: Overview Page

**Files to create:**

- `apps/web/src/app/dashboard/website/page.tsx`
- `apps/web/src/app/dashboard/website/layout.tsx`
- `apps/web/src/app/dashboard/website/_components/WebsiteOverview.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 4 (Overview Page)
- `apps/web/src/app/dashboard/season/page.tsx` — server component pattern with redirect

**Steps:**

- [ ] Create `layout.tsx` — minimal wrapper, passes children
- [ ] Create `page.tsx` — server component: check `workspace.has_website`, redirect to `/setup` if false, else render `WebsiteOverview`
- [ ] Create `WebsiteOverview.tsx` — client component with:
  - Top section: site name + status badge + domain URL
  - 4 stat cards (pages, sections, version, domain)
  - Page list (uses `usePages` hook) — each row: title, section count, visibility eye toggle
  - Action bar: Forhåndsvisning, Innstillinger (disabled/P2), Publiser endringer
- [ ] Wire publish button to `publishWebsite()` from existing `publish-actions.ts`
- [ ] Wire preview button to `createPreviewToken()` → opens `{slug}.smartout.info?preview={token}` in new tab

**Key code — `page.tsx`:**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import WebsiteOverview from "./_components/WebsiteOverview";

export default async function WebsitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check for existing website via workspace context
  // Overview component handles data fetching via TanStack Query
  return <WebsiteOverview />;
}
```

**Verify:** Navigate to `/dashboard/website` — see overview or redirect to setup. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): overview page with stats and page list`

---

### Task 7: Setup Wizard

**Files to create:**

- `apps/web/src/app/dashboard/website/setup/page.tsx`
- `apps/web/src/app/dashboard/website/_components/SetupWizard.tsx`
- `apps/web/src/app/dashboard/website/_components/TemplateGallery.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — sections 2-3 (Template System + Setup Wizard)
- `packages/website/src/templates/registry.ts` — `getAllTemplates()`, `WebsiteTemplate` type
- `packages/website/src/templates/restaurant-classic.ts` — template manifest structure

**Steps:**

- [ ] Create `setup/page.tsx` — server component shell, renders `SetupWizard`
- [ ] Create `SetupWizard.tsx` — client component with 3-step state machine:
  - **Step 1 (Velg mal):** Renders `TemplateGallery`, stores selected template key
  - **Step 2 (Tilpass):** Name, logo upload, color pickers (primary, secondary, background), font selector. Pre-fills from workspace data
  - **Step 3 (Ferdig):** Summary card + "Opprett nettside" button
- [ ] Create `TemplateGallery.tsx` — grid of template cards:
  - Uses `useTemplates()` hook (reads from `@smartout/website` manifest)
  - Each card: template name, description, tier badge
  - Click selects template, calls `onSelect(templateKey)`
- [ ] Progress bar at top (step 1/2/3)
- [ ] "Opprett nettside" calls `createWebsiteFromTemplate()` server action
- [ ] On success: redirect to `/dashboard/website`
- [ ] Add `emit()` for `website.template_selected` on step 1 select

**Key code — `SetupWizard.tsx` skeleton:**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createWebsiteFromTemplate } from "../_actions/website-actions";
import TemplateGallery from "./TemplateGallery";
import { toast } from "sonner";
import { Button } from "@smartout/ui/button";

type WizardStep = "template" | "customize" | "confirm";

export default function SetupWizard() {
  const [step, setStep] = useState<WizardStep>("template");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const ctx = useWorkspaceOptional();

  const handleCreate = async () => {
    if (!templateKey || !ctx) return;
    setIsCreating(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await createWebsiteFromTemplate({
        workspaceId: ctx.workspace.workspace_id,
        templateKey,
        name,
        siteSlug: slug,
      });
      toast.success("Nettside opprettet!");
      router.push("/dashboard/website");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke opprette nettside");
    } finally {
      setIsCreating(false);
    }
  };

  // Render step content based on current step...
}
```

**Verify:** Navigate to `/dashboard/website/setup`, complete 3 steps, verify website created in DB. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): setup wizard with template selection and smart bootstrap`

---

### Task 8: Section Editor Layout

**Files to create:**

- `apps/web/src/app/dashboard/website/pages/[pageId]/page.tsx`
- `apps/web/src/app/dashboard/website/_components/SectionEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/SectionSidebar.tsx`
- `apps/web/src/app/dashboard/website/_components/SectionForm.tsx`
- `apps/web/src/app/dashboard/website/_components/SaveStatus.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 5 (Section Editor)

**Steps:**

- [ ] Create `pages/[pageId]/page.tsx` — server component that passes `pageId` to `SectionEditor`
- [ ] Create `SectionEditor.tsx` — 2-column layout orchestrator:
  - Uses `useSections(pageId)` to load sections
  - Tracks `activeSectionId` state
  - Left column: `SectionSidebar`
  - Right column: `SectionForm`
  - Top bar: breadcrumb, `SaveStatus`, preview button, publish button
- [ ] Create `SectionSidebar.tsx` — 280px fixed width:
  - Section list with lucide icons per type
  - Active section highlighted
  - Click selects section → loads form in right column
  - "+" button at bottom for section picker
- [ ] Create `SectionForm.tsx` — form container:
  - Receives active section data
  - Looks up editor component from `editor-registry.ts`
  - Passes `react-hook-form` form instance with `zodResolver`
  - Handles save via `updateSectionContent()` server action
- [ ] Create `SaveStatus.tsx` — pill component: "Lagret" (green dot), "Lagrer..." (yellow dot, spinning), "Ulagrede endringer" (orange dot)

**Key code — `SectionEditor.tsx` skeleton:**

```tsx
"use client";

import { useState } from "react";
import { useSections } from "../_hooks/use-sections";
import SectionSidebar from "./SectionSidebar";
import SectionForm from "./SectionForm";
import SaveStatus from "./SaveStatus";

type Props = { pageId: string; websiteId: string };

export default function SectionEditor({ pageId, websiteId }: Props) {
  const { sections, isLoading } = useSections(pageId);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");

  const activeSection = sections.find((s) => s.website_section_id === activeSectionId);

  return (
    <div className="flex h-full">
      <SectionSidebar
        sections={sections}
        activeSectionId={activeSectionId}
        onSelect={setActiveSectionId}
        pageId={pageId}
        websiteId={websiteId}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-background sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3">
          <SaveStatus state={saveState} />
        </div>
        {activeSection ? (
          <SectionForm
            section={activeSection}
            websiteId={websiteId}
            onSaveStateChange={setSaveState}
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            Velg en seksjon fra sidepanelet
          </div>
        )}
      </div>
    </div>
  );
}
```

**Verify:** Navigate to `/dashboard/website/pages/{id}` — see 2-column layout with section sidebar. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): section editor 2-column layout with sidebar`

---

### Task 9: Section Picker Dialog

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/SectionPicker.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 6 (Section Picker Dialog)
- `packages/website/src/sections/registry.ts` — `getAllSectionDefs()`, `SectionDefinition`

**Steps:**

- [ ] Create `SectionPicker.tsx` — shadcn Dialog:
  - Search input at top (filters by name/description)
  - Grid of section type cards (3 columns)
  - Each card: lucide icon + name + short description
  - System sections marked with blue "System" badge
  - Click card calls `createSection()` server action and closes dialog
- [ ] Map section types to lucide icons (hero → Image, rich_text → Type, etc. per spec)
- [ ] Wire into `SectionSidebar.tsx` "+" button

**Key code — icon map:**

```typescript
import {
  Image,
  Type,
  Columns,
  Grid3x3,
  Images,
  Quote,
  MousePointerClick,
  HelpCircle,
  MapPin,
  PanelBottom,
  UtensilsCrossed,
  Clock,
  UserCircle,
  FileText,
  ExternalLink,
  BookOpen,
} from "lucide-react";

export const sectionIconMap: Record<string, typeof Image> = {
  hero: Image,
  rich_text: Type,
  text_image: Columns,
  feature_grid: Grid3x3,
  gallery: Images,
  testimonials: Quote,
  cta: MousePointerClick,
  faq: HelpCircle,
  map: MapPin,
  footer: PanelBottom,
  menu_full: UtensilsCrossed,
  menu_preview: UtensilsCrossed,
  hours: Clock,
  contact: FileText,
  booking_cta: ExternalLink,
  pdf_viewer: BookOpen,
};
```

**Verify:** Click "+" in section sidebar — dialog opens with section grid, click one adds it. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): section picker dialog with search and type grid`

---

### Task 10: Section Editor Forms — Content Types

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/editors/editor-registry.ts`
- `apps/web/src/app/dashboard/website/_components/editors/HeroEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/RichTextEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/TextImageEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/FeatureGridEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/GalleryEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/TestimonialsEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/CtaEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/FaqEditor.tsx`

**Read first:**

- All Zod schemas in `packages/website/src/sections/schemas/` — each schema defines the form fields
- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 5.3 (Form layout rules)

**Steps:**

- [ ] Create `editor-registry.ts` — maps section type to lazy-loaded editor component via `React.lazy()` + dynamic import
- [ ] Create `HeroEditor.tsx` — form fields: heading (text), subheading (textarea), buttonText (text), buttonUrl (text), imageAssetId (ImageUpload), imagePosition (select: right/below), alignment (select: left/center)
- [ ] Create `RichTextEditor.tsx` — form field: html (textarea, full-width)
- [ ] Create `TextImageEditor.tsx` — form fields: heading (text), body (textarea), imageAssetId (ImageUpload), imageAlt (text), imagePosition (select: left/right), buttonText (text), buttonUrl (text)
- [ ] Create `FeatureGridEditor.tsx` — form fields: heading (text), subheading (text), columns (select: 2/3/4), items (repeatable: icon, title, description)
- [ ] Create `GalleryEditor.tsx` — form fields: heading (text), layout (select: grid/masonry/carousel), columns (select: 2/3/4), images (repeatable: assetId via ImageUpload, caption)
- [ ] Create `TestimonialsEditor.tsx` — form fields: heading (text), layout (select: cards/carousel/list), items (repeatable: quote, author, role, rating, imageAssetId)
- [ ] Create `CtaEditor.tsx` — form fields: heading (text), body (textarea), buttonText (text), buttonUrl (text), secondaryButtonText (text), secondaryButtonUrl (text)
- [ ] Create `FaqEditor.tsx` — form fields: heading (text), items (repeatable: question, answer)

**All editors follow this pattern:**

```tsx
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { heroContentSchema, type HeroContent } from "@smartout/website";
import { Input } from "@smartout/ui/input";
import { Textarea } from "@smartout/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@smartout/ui/select";
import { Button } from "@smartout/ui/button";
import { Label } from "@smartout/ui/label";
import ImageUpload from "../ImageUpload";

type Props = {
  content: HeroContent;
  onChange: (content: HeroContent) => void;
  websiteId: string;
};

export default function HeroEditor({ content, onChange, websiteId }: Props) {
  const form = useForm<HeroContent>({
    resolver: zodResolver(heroContentSchema),
    defaultValues: content,
  });

  // Watch all fields and propagate changes
  const values = form.watch();

  return (
    <form className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Overskrift</Label>
          <Input {...form.register("heading")} />
        </div>
        <div className="col-span-2">
          <Label>Undertittel</Label>
          <Textarea {...form.register("subheading")} />
        </div>
        <div>
          <Label>Knappetekst</Label>
          <Input {...form.register("buttonText")} />
        </div>
        <div>
          <Label>Knapp-URL</Label>
          <Input {...form.register("buttonUrl")} />
        </div>
        <div>
          <Label>Bildeposisjon</Label>
          <Select
            value={form.watch("imagePosition")}
            onValueChange={(v) => form.setValue("imagePosition", v as "right" | "below")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="right">Hoyre</SelectItem>
              <SelectItem value="below">Under</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Justering</Label>
          <Select
            value={form.watch("alignment")}
            onValueChange={(v) => form.setValue("alignment", v as "left" | "center")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Venstre</SelectItem>
              <SelectItem value="center">Sentrert</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Bilde</Label>
        <ImageUpload
          assetId={form.watch("imageAssetId")}
          onAssetChange={(id) => form.setValue("imageAssetId", id)}
          websiteId={websiteId}
        />
      </div>
    </form>
  );
}
```

**Editors with repeatable items** (FAQ, FeatureGrid, Gallery, Testimonials) use `useFieldArray` from react-hook-form:

```tsx
const { fields, append, remove, move } = useFieldArray({
  control: form.control,
  name: "items",
});
```

**Verify:** Select each section type in editor — correct form renders. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): content section editor forms (hero, rich_text, text_image, feature_grid, gallery, testimonials, cta, faq)`

---

### Task 11: Footer Section Editor

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/editors/FooterEditor.tsx`

**Read first:**

- `packages/website/src/sections/schemas/footer.ts` — `footerContentSchema`
- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 9 (Footer Section Editor)

**Steps:**

- [ ] Create `FooterEditor.tsx` — form fields:
  - showLogo (toggle/switch)
  - showSocial (toggle/switch)
  - showContact (toggle/switch)
  - showHours (toggle/switch)
  - copyrightText (text, with placeholder: "© {year} {company.name}")
  - columns (select: 1/2/3/4)
- [ ] Register in `editor-registry.ts`

**Verify:** Select footer section in editor — toggle switches and columns render. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): footer section editor with toggle blocks`

---

### Task 12: Image Upload Widget

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/ImageUpload.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 5.3 (Image upload widget)
- `packages/website/src/constants.ts` — `LIMITS.maxImageUploadBytes`

**Steps:**

- [ ] Create `ImageUpload.tsx` — reusable component:
  - Current image thumbnail preview (fetched from Supabase Storage)
  - "Bytt bilde" button → opens hidden file input
  - "Fjern" button → clears asset reference
  - File metadata: filename, dimensions, file size
  - Alt-text input field (required)
  - Validates file size against `LIMITS.maxImageUploadBytes` (5 MB)
  - On upload: creates `website_asset` row, uploads to `website-assets` storage bucket, returns `assetId`
  - Shows upload progress
- [ ] Add server action `uploadAsset(websiteId, file, altText)` in a new `asset-actions.ts` or inside `section-actions.ts`
- [ ] Emit `website.asset_uploaded` telemetry

**Key code — `ImageUpload.tsx` skeleton:**

```tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@smartout/ui/button";
import { Input } from "@smartout/ui/input";
import { Label } from "@smartout/ui/label";
import { ImagePlus, X, Upload } from "lucide-react";

type Props = {
  assetId?: string;
  onAssetChange: (assetId: string | undefined) => void;
  websiteId: string;
};

export default function ImageUpload({ assetId, onAssetChange, websiteId }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [altText, setAltText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      // toast error: file too large
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Supabase Storage + create website_asset row
      // Return assetId
      // onAssetChange(newAssetId);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      {assetId ? (
        <div className="relative">
          {/* Image preview */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => onAssetChange(undefined)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="text-muted-foreground flex w-full flex-col items-center gap-2 py-8"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-8 w-8" />
          <span>Last opp bilde</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <div>
        <Label>Alt-tekst</Label>
        <Input
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="Beskriv bildet..."
        />
      </div>
    </div>
  );
}
```

**Verify:** Upload image in a section editor — preview shows, asset row created. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): image upload widget with preview and alt-text`

---

### Task 13: Save + Autosave

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/SectionForm.tsx`
- `apps/web/src/app/dashboard/website/_components/SectionEditor.tsx`

**Read first:**

- `apps/web/src/app/dashboard/website/_hooks/use-autosave.ts` (created in Task 4)

**Steps:**

- [ ] Wire `SectionForm.tsx` to call `updateSectionContent()` on explicit save (Cmd+S / save button)
- [ ] Integrate `useAutosave()` hook — marks dirty on form change, auto-saves every 60s with `source = 'autosave'`
- [ ] Update `SaveStatus.tsx` state based on:
  - Form pristine → "Lagret" (green dot)
  - Autosave/manual save in progress → "Lagrer..." (yellow spinning)
  - Form dirty → "Ulagrede endringer" (orange dot)
- [ ] Add keyboard shortcut: Cmd/Ctrl+S triggers manual save (prevent default)
- [ ] On successful save: invalidate sections query, mark clean

**Key code — keyboard save:**

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [handleSave]);
```

**Verify:** Edit a section → "Ulagrede endringer" shows → wait 60s → auto-saves → "Lagret". Ctrl+S saves immediately. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): manual save with Cmd+S and 60s autosave`

---

### Task 14: Page Management

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/WebsiteOverview.tsx`

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/PageList.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 4 (Page list in Overview)

**Steps:**

- [ ] Create `PageList.tsx` — page list component:
  - Each row: page title, section count badge, visibility toggle (eye icon)
  - Click row → navigates to `/dashboard/website/pages/{pageId}`
  - Visibility toggle calls `togglePageVisibility()` with optimistic update
  - Delete button (trash icon) — confirms, then calls `deletePage()`. Home page cannot be deleted.
  - "Legg til side" button at bottom — opens dialog with title + page type + slug inputs, calls `createPage()`
- [ ] Extract page list from `WebsiteOverview.tsx` into `PageList.tsx`
- [ ] Add page type selector in create dialog: hjem, meny, om-oss, kontakt, custom

**Verify:** Add page, toggle visibility, delete non-home page. Navigate to page editor. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): page management with add, delete, visibility toggle`

---

### Task 15: Remaining Section Editors (Basic Shells)

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/editors/HoursEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/MapEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/ContactEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/MenuPreviewEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/MenuFullEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/BookingCtaEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/PdfViewerEditor.tsx`

**Read first:**

- `packages/website/src/sections/schemas/hours.ts`
- `packages/website/src/sections/schemas/map.ts`
- `packages/website/src/sections/schemas/contact.ts`
- `packages/website/src/sections/schemas/menu-preview.ts`
- `packages/website/src/sections/schemas/menu-full.ts`
- `packages/website/src/sections/schemas/booking-cta.ts`
- `packages/website/src/sections/schemas/pdf-viewer.ts`

**Steps:**

- [ ] Create basic form editors for all remaining section types
- [ ] Each editor renders fields from its Zod schema
- [ ] System-connected sections (hours, menu_full, menu_preview) show info banner: "Denne seksjonen kobles til Smartout-data i en fremtidig oppdatering"
- [ ] Register all in `editor-registry.ts`

These are P0 basic shells — the system bridge pattern (bidirectional data sync) comes in Phase B2.

**Verify:** All 16 section types have an editor that renders without errors. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): remaining section editors (hours, map, contact, menu, booking, pdf)`

---

## P1 Stretch Tasks

### Task 16 (P1): Template Gallery Improvements

- Full-page template preview overlay with device switcher
- Tier badges (Gratis/Pro/Premium)
- Category filter bar
- Keyboard navigation (arrow keys)

### Task 17 (P1): Drag-to-Reorder

- `@dnd-kit/core` + `@dnd-kit/sortable` for sections and pages
- Optimistic sort_order updates via `reorderSections()` / `reorderPages()`

### Task 18 (P1): Section Settings Panel

- Background variant selector (Default, Muted, Accent, Dark, Image)
- Container width (Narrow, Default, Wide, Full)
- Spacing (None, SM, MD, LG, XL)
- Wire to `updateSectionSettings()` server action

### Task 19 (P1): Responsive Mobile Admin

- Stacked layout below `lg` breakpoint
- Horizontal scrollable section tabs
- Full-width form fields

---

## Verification Checklist

Before declaring B1 complete:

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] Setup wizard creates website from template with all pages/sections
- [ ] Overview page shows correct stats and page list
- [ ] Section editor loads correct form for each section type
- [ ] Save and autosave both persist content to DB
- [ ] Publish button creates snapshot from current draft data
- [ ] Preview button opens public site in new tab
- [ ] All mutations emit telemetry events
- [ ] Sidebar "Nettside" entry visible for admin/owner roles

---

## Dependencies

| Dependency                  | Status             | Notes                                       |
| --------------------------- | ------------------ | ------------------------------------------- |
| `@smartout/website` package | Done (Plan A)      | Section registry, schemas, templates, types |
| `websites` database schema  | Done (Plan A)      | 12 tables, RLS, RPCs                        |
| Publish pipeline            | Done (Plan A)      | `publish-actions.ts`                        |
| Public site rendering       | Done (Plan A)      | Middleware, renderers, ISR                  |
| `react-hook-form`           | Check if installed | Needed for all section editors              |
| `@hookform/resolvers`       | Check if installed | zodResolver for form validation             |

---

## Changelog

| Date       | Change                                         |
| ---------- | ---------------------------------------------- |
| 2026-03-22 | Initial plan — 15 P0 tasks, 4 P1 stretch tasks |
