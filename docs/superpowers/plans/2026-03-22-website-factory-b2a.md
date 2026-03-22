---
title: Website Factory B2a — Polish + System Bridges
status: draft
updated: 2026-03-22
created: 2026-03-22
module: website-factory
tags: [website, builder, dnd, template-preview, system-bridge, responsive]
---

# Website Factory B2a — Polish + System Bridges

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the B1 builder MVP with template preview overlay, drag-to-reorder, section settings panel, responsive mobile admin, and system bridges for menu/hours sections.

**Architecture:** Extends existing B1 components. dnd-kit for sortable lists. System bridges fetch live data from `public` schema tables via dedicated server actions and render it inline in editors. Hours editor is bidirectional (updates `company_opening_hours`). Menu editor is read-only from menu module.

**Tech Stack:** @dnd-kit/core + @dnd-kit/sortable (already installed), shadcn/ui, Tailwind v4 responsive, TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — sections 2.3, 5.2, 7.1-7.2, 13

**Foundation:** Plan B1 complete — all editors, hooks, actions exist.

**Scope:** B2a only — template preview, DnD, settings panel, responsive, menu/hours bridges. NO spokesperson flow (B2b).

---

## File Map

### 1. New Components

| File                                   | Responsibility                                                         |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `_components/TemplatePreview.tsx`      | Full-page template preview overlay with device switcher and navigation |
| `_components/SectionSettingsPanel.tsx` | Section settings (background, width, spacing) in sidebar               |
| `_components/SortableSectionItem.tsx`  | dnd-kit sortable wrapper for section sidebar items                     |
| `_components/SortablePageItem.tsx`     | dnd-kit sortable wrapper for page list items                           |

### 2. Modified Components

| File                                        | Change                                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| `_components/TemplateGallery.tsx`           | Add tier badges, category filter, preview button               |
| `_components/SectionSidebar.tsx`            | Wrap items in DndContext + SortableContext, add settings panel |
| `_components/SectionEditor.tsx`             | Add responsive breakpoint (stacked on mobile)                  |
| `_components/PageList.tsx`                  | Wrap items in DndContext + SortableContext                     |
| `_components/WebsiteOverview.tsx`           | Responsive card layout                                         |
| `_components/editors/HoursEditor.tsx`       | Replace stub with system bridge to company_opening_hours       |
| `_components/editors/MenuFullEditor.tsx`    | Replace stub with system bridge to menu module data            |
| `_components/editors/MenuPreviewEditor.tsx` | Replace stub with system bridge to menu module data            |

### 3. New Server Actions / Hooks

| File                          | Responsibility                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `_actions/bridge-actions.ts`  | `getCompanyHours()`, `updateCompanyHours()`, `getMenusForWorkspace()`, `getMenuCategories()`, `getMenuItems()` |
| `_hooks/use-company-hours.ts` | TanStack Query hook for company_opening_hours                                                                  |
| `_hooks/use-menus.ts`         | TanStack Query hook for workspace menus (read-only)                                                            |

---

## Tasks

### Task 1: Template Preview Overlay

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/TemplatePreview.tsx`

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/TemplateGallery.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 2.3
- `apps/web/src/app/dashboard/website/_components/TemplateGallery.tsx` — current implementation
- `packages/website/src/templates/registry.ts` — `getAllTemplates()`, `WebsiteTemplate` type

**Steps:**

- [ ] Create `TemplatePreview.tsx` — fixed full-screen overlay (`inset-0 z-50`):
  - Sticky top toolbar: back button, template name + tier badge, "3 / 20" counter, device switcher (Desktop/Tablet/Mobile), "Velg denne malen" CTA
  - Left/right navigation arrows fixed on viewport edges
  - Center: scrollable preview area with device-responsive width (100% / 768px / 375px)
  - Preview renders template `defaultPages[0].sections` using placeholder content from section defaults
  - Keyboard: ArrowLeft/ArrowRight navigate, Escape closes
  - Props: `templates: WebsiteTemplate[]`, `initialIndex: number`, `onSelect: (key: string) => void`, `onClose: () => void`

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { WebsiteTemplate } from "@smartout/website";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, Monitor, Tablet, Smartphone } from "lucide-react";

type DeviceMode = "desktop" | "tablet" | "mobile";
const deviceWidths: Record<DeviceMode, string> = {
  desktop: "w-full",
  tablet: "w-[768px]",
  mobile: "w-[375px]",
};

type Props = {
  templates: WebsiteTemplate[];
  initialIndex: number;
  onSelect: (key: string) => void;
  onClose: () => void;
};

export default function TemplatePreview({ templates, initialIndex, onSelect, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [device, setDevice] = useState<DeviceMode>("desktop");

  const template = templates[index];
  const hasPrev = index > 0;
  const hasNext = index < templates.length - 1;

  const goNext = useCallback(() => {
    if (hasNext) setIndex((i) => i + 1);
  }, [hasNext]);
  const goPrev = useCallback(() => {
    if (hasPrev) setIndex((i) => i - 1);
  }, [hasPrev]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  return (
    <div className="bg-background/95 fixed inset-0 z-50 flex flex-col backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Tilbake til maler
          </Button>
          <span className="font-medium">{template.name}</span>
          <Badge variant="outline">
            {index + 1} / {templates.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {(
              [
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ] as const
            ).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setDevice(mode)}
                className={`rounded-md p-1.5 ${device === mode ? "bg-accent" : ""}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Button onClick={() => onSelect(template.key)}>Velg denne malen</Button>
        </div>
      </div>

      {/* Preview area */}
      <div className="relative flex-1 overflow-y-auto">
        {hasPrev && (
          <button
            onClick={goPrev}
            className="bg-background/80 hover:bg-accent absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full border p-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={goNext}
            className="bg-background/80 hover:bg-accent absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full border p-2"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div className={`mx-auto ${deviceWidths[device]} border-x`}>
          {/* Placeholder preview — renders section type names as colored blocks */}
          <div className="space-y-0">
            {template.defaultPages[0]?.sections.map((sectionType, i) => (
              <div
                key={i}
                className="bg-muted/50 flex items-center justify-center border-b py-16 text-sm"
              >
                {sectionType}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Extend `WebsiteTemplate` type in `packages/website/src/templates/registry.ts` — add `tier: "basic" | "pro" | "premium"` and `category: string` fields. Update `restaurant-classic.ts` and `cafe-modern.ts` with tier/category values.

- [ ] Modify `TemplateGallery.tsx`:
  - Add tier badges: green "Gratis", blue "Pro", purple "Premium" — read from `template.tier`
  - Add category filter bar at top: "Alle", "Restaurant", "Kafe & Bar", "Fine Dining", etc. — filter by `template.category`
  - Add "Forhåndsvisning" button on card hover → opens TemplatePreview overlay
  - Track `previewIndex` state, render TemplatePreview when set

**Verify:** Click preview on template card → overlay opens with navigation. Device switcher changes width. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): template preview overlay with device switcher and navigation`

---

### Task 2: Drag-to-Reorder — Sections

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/SortableSectionItem.tsx`

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/SectionSidebar.tsx`

**Read first:**

- `apps/web/src/app/dashboard/website/_components/SectionSidebar.tsx` — current implementation
- Check existing dnd-kit usage: `grep -r "@dnd-kit" apps/web/src/ -l`

**Steps:**

- [ ] Create `SortableSectionItem.tsx` — useSortable wrapper:

```tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  id: string;
  children: ReactNode;
};

export default function SortableSectionItem({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab p-1 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] Modify `SectionSidebar.tsx`:
  - Import `DndContext`, `closestCenter`, `PointerSensor`, `useSensor`, `useSensors` from `@dnd-kit/core`
  - Import `SortableContext`, `verticalListSortingStrategy` from `@dnd-kit/sortable`
  - Wrap section list in `<DndContext>` + `<SortableContext>`
  - Each section item wrapped in `<SortableSectionItem>`
  - `onDragEnd` handler: compute new order, call `reorderSections()` mutation with optimistic update
  - Add `emit()` call for `"website sections reordered"` in `use-sections.ts` reorder mutation `onSuccess` (if missing)
  - Add `group` class to each item for hover-reveal of grip handle

**Verify:** Drag section items in sidebar → order updates. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): drag-to-reorder sections with dnd-kit`

---

### Task 3: Drag-to-Reorder — Pages

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/SortablePageItem.tsx`

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/PageList.tsx`

**Read first:**

- `apps/web/src/app/dashboard/website/_components/PageList.tsx` — current implementation

**Steps:**

- [ ] Create `SortablePageItem.tsx` — same useSortable pattern as SortableSectionItem
- [ ] Modify `PageList.tsx`:
  - Wrap page rows in `DndContext` + `SortableContext`
  - `onDragEnd` calls `reorderPages()` mutation
  - Add `emit()` call for `"website pages reordered"` in `use-pages.ts` reorder mutation `onSuccess` (if missing)
  - Grip handle visible on hover
  - Home page (index 0) is NOT draggable — always stays first

**Verify:** Drag page rows → order updates, home page stays pinned. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): drag-to-reorder pages with dnd-kit`

---

### Task 4: Section Settings Panel

**Files to create:**

- `apps/web/src/app/dashboard/website/_components/SectionSettingsPanel.tsx`

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/SectionSidebar.tsx`

**Read first:**

- `packages/website/src/sections/schemas/settings.ts` — `sectionSettingsSchema`, settings fields
- `apps/web/src/app/dashboard/website/_hooks/use-sections.ts` — `updateSettings` mutation

**Steps:**

- [ ] Create `SectionSettingsPanel.tsx`:
  - Renders below section list in sidebar when a section is active
  - Collapsible with "Innstillinger" header
  - Fields from `sectionSettingsSchema`:
    - Background: select (Standard, Dempet, Aksent, Mork, Bilde)
    - Container: select (Smal, Standard, Bred, Full)
    - Spacing: select (Ingen, SM, MD, LG, XL)
  - Uses `updateSectionSettings()` mutation on change (debounced 500ms)
  - Props: `sectionId: string`, `websiteId: string`, `settings: SectionSettingsFromSchema`

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import type { SectionSettingsFromSchema } from "@smartout/website";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";

const bgOptions = [
  { value: "default", label: "Standard" },
  { value: "muted", label: "Dempet" },
  { value: "accent", label: "Aksent" },
  { value: "dark", label: "Mork" },
  { value: "image", label: "Bilde" },
] as const;

const widthOptions = [
  { value: "narrow", label: "Smal" },
  { value: "default", label: "Standard" },
  { value: "wide", label: "Bred" },
  { value: "full", label: "Full bredde" },
] as const;

const spacingOptions = [
  { value: "none", label: "Ingen" },
  { value: "sm", label: "Liten" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Stor" },
  { value: "xl", label: "Ekstra stor" },
] as const;

type Props = {
  settings: SectionSettingsFromSchema;
  onChange: (settings: SectionSettingsFromSchema) => void;
};

export default function SectionSettingsPanel({ settings, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [local, setLocal] = useState(settings);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const handleChange = (key: keyof SectionSettingsFromSchema, value: string) => {
    const next = { ...local, [key]: value } as SectionSettingsFromSchema;
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), 500);
  };

  return (
    <div className="border-t">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-sm font-medium"
      >
        <Settings2 className="h-4 w-4" />
        Innstillinger
        {isOpen ? (
          <ChevronDown className="ml-auto h-4 w-4" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <div className="space-y-3 px-3 pb-3">
          <div>
            <Label className="text-xs">Bakgrunn</Label>
            <Select
              value={local.backgroundVariant}
              onValueChange={(v) => handleChange("backgroundVariant", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bgOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Bredde</Label>
            <Select
              value={local.containerWidth}
              onValueChange={(v) => handleChange("containerWidth", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {widthOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mellomrom</Label>
            <Select value={local.spacing} onValueChange={(v) => handleChange("spacing", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {spacingOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] Modify `SectionSidebar.tsx` — render `SectionSettingsPanel` below section list when `activeSectionId` is set, pass settings from active section, wire `onChange` to `updateSettings` mutation

**Verify:** Select section → settings panel appears in sidebar, change background → persists. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): section settings panel (background, width, spacing)`

---

### Task 5: Responsive Mobile Admin

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/SectionEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/WebsiteOverview.tsx`
- `apps/web/src/app/dashboard/website/_components/SectionSidebar.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 13
- Current implementations of SectionEditor, WebsiteOverview, SectionSidebar

**Steps:**

- [ ] Modify `SectionEditor.tsx`:
  - Below `lg` breakpoint: stacked layout (sidebar on top as horizontal scrollable tabs, form below)
  - Add mobile section tab bar: horizontal scroll of section type icons, active tab highlighted
  - Form area takes full width on mobile
  - Use Tailwind responsive: `lg:flex-row flex-col`

- [ ] Modify `WebsiteOverview.tsx`:
  - Replace all hardcoded `zinc-*` colors with CSS variable classes (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`)
  - Stat cards: `grid-cols-2` on mobile, `grid-cols-4` on desktop
  - Action bar: stack vertically on mobile, horizontal on desktop
  - Page list cards: full-width on mobile

- [ ] Modify `SectionSidebar.tsx`:
  - On mobile (`< lg`): render as horizontal scrollable tab bar instead of vertical sidebar
  - Use `lg:w-[280px] lg:flex-col lg:border-r` vs `flex-row overflow-x-auto border-b` pattern
  - Section name truncated on mobile, show only icon + short name

**Verify:** Resize browser to mobile width → editor stacks, sections become horizontal tabs. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): responsive mobile admin layout`

---

### Task 6: Bridge Actions + Hooks (Menu & Hours)

**Files to create:**

- `apps/web/src/app/dashboard/website/_actions/bridge-actions.ts`
- `apps/web/src/app/dashboard/website/_hooks/use-company-hours.ts`
- `apps/web/src/app/dashboard/website/_hooks/use-menus.ts`

**Read first:**

- `supabase/migrations/20260310140000_signup_tables.sql` — company_opening_hours schema
- `apps/web/src/app/dashboard/website/_actions/publish-actions.ts` — auth pattern
- Existing menu tables: `grep -n "menu_category\|menu_item\|website_menu" supabase/migrations/ -r`

**Steps:**

- [ ] Create `bridge-actions.ts`:

```typescript
"use server";

import { createClient as createServerClient } from "@smartout/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type DayHours = {
  day: string;
  open: string;
  close: string;
  closed: boolean;
};

export async function getCompanyHours(workspaceId: string): Promise<DayHours[]> {
  // Use user-scoped client — RLS enforces workspace membership
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("company_opening_hours")
    .select("day_of_week, open_time, close_time, is_closed")
    .eq("workspace_id", workspaceId)
    .order("day_of_week");

  if (error) throw new Error(error.message);

  const dayNames = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

  return dayNames.map((day, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (data as any[])?.find((r) => r.day_of_week === i);
    return {
      day,
      open: row?.open_time ?? "",
      close: row?.close_time ?? "",
      closed: row?.is_closed ?? true,
    };
  });
}

export async function updateCompanyHours(workspaceId: string, hours: DayHours[]) {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = getAdminClient();

  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    await admin.from("company_opening_hours").upsert(
      {
        workspace_id: workspaceId,
        day_of_week: i,
        open_time: h.open,
        close_time: h.close,
        is_closed: h.closed,
      },
      { onConflict: "workspace_id,day_of_week" },
    );
  }

  await emit({
    event: "website hours_updated" as any, // Will be registered in telemetry
    workspace_id: workspaceId,
    actor_id: user.id,
    properties: {
      entity: { entity_type: "website" as const, entity_id: workspaceId },
      data: { days_updated: hours.length },
    },
  });

  return { success: true };
}

export type MenuForBridge = {
  id: string;
  name: string;
  categories: {
    id: string;
    name: string;
    sort_order: number;
    items: {
      id: string;
      name: string;
      description: string;
      price: number;
      allergens: string[];
      dietary_tags: string[];
      is_available: boolean;
    }[];
  }[];
};

export async function getMenusForWorkspace(workspaceId: string): Promise<MenuForBridge[]> {
  const admin = getAdminClient();

  // Fetch menus with nested categories and items
  // Adjust table/column names based on actual schema
  const { data: menus, error } = await admin
    .schema("websites")
    .from("website_menu")
    .select("website_menu_id, name, menu_type")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error) return []; // No menus configured yet

  const result: MenuForBridge[] = [];
  for (const menu of (menus ?? []) as { website_menu_id: string; name: string }[]) {
    const { data: cats } = await admin
      .schema("websites")
      .from("website_menu_category")
      .select("website_menu_category_id, name, sort_order")
      .eq("website_menu_id", menu.website_menu_id)
      .order("sort_order");

    const categories = [];
    for (const cat of (cats ?? []) as {
      website_menu_category_id: string;
      name: string;
      sort_order: number;
    }[]) {
      const { data: items } = await admin
        .schema("websites")
        .from("website_menu_item")
        .select(
          "website_menu_item_id, name, description, price, allergens, dietary_tags, is_available",
        )
        .eq("website_menu_category_id", cat.website_menu_category_id)
        .order("sort_order");

      categories.push({
        id: cat.website_menu_category_id,
        name: cat.name,
        sort_order: cat.sort_order,
        items: ((items ?? []) as Record<string, unknown>[]).map((item) => ({
          id: item.website_menu_item_id as string,
          name: item.name as string,
          description: (item.description as string) ?? "",
          price: (item.price as number) ?? 0,
          allergens: (item.allergens as string[]) ?? [],
          dietary_tags: (item.dietary_tags as string[]) ?? [],
          is_available: (item.is_available as boolean) ?? true,
        })),
      });
    }

    result.push({
      id: menu.website_menu_id,
      name: menu.name,
      categories,
    });
  }

  return result;
}
```

- [ ] Create `use-company-hours.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { getCompanyHours, updateCompanyHours } from "../_actions/bridge-actions";
import { websiteKeys } from "./website-keys";
import { toast } from "sonner";

export function useCompanyHours() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...websiteKeys.all, "company-hours", wsId],
    queryFn: () => getCompanyHours(wsId!),
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });

  const update = useMutation({
    mutationFn: (hours: { day: string; open: string; close: string; closed: boolean }[]) =>
      updateCompanyHours(wsId!, hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...websiteKeys.all, "company-hours"] });
      toast.success("Apningstider oppdatert");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { hours: query.data ?? [], isLoading: query.isLoading, update };
}
```

- [ ] Create `use-menus.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { getMenusForWorkspace } from "../_actions/bridge-actions";
import { websiteKeys } from "./website-keys";

export function useMenus() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  const query = useQuery({
    queryKey: [...websiteKeys.all, "menus", wsId],
    queryFn: () => getMenusForWorkspace(wsId!),
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });

  return { menus: query.data ?? [], isLoading: query.isLoading };
}
```

**Verify:** `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): bridge actions and hooks for menu and hours`

---

### Task 7: Hours Editor — System Bridge

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/editors/HoursEditor.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 7.2
- `apps/web/src/app/dashboard/website/_hooks/use-company-hours.ts` (created in Task 6)

**Steps:**

- [ ] Rewrite `HoursEditor.tsx` — replace stub with system bridge:
  - Blue info banner: "Disse er firmaets offisielle apningstider fra Smartout."
  - 7-row grid (Mandag-Sondag): day name, open time input, close time input, open/closed toggle
  - Load current hours via `useCompanyHours()` hook
  - Yellow warning banner: "Endringer her oppdaterer firmaets offisielle apningstider i hele Smartout."
  - On save: confirmation dialog ("Er du sikker? Dette pavirker alle systemer."), then `updateCompanyHours()`
  - Keep `heading`, `description`, `specialNote` fields from current schema (website-local, not bridged)

**Verify:** Hours editor loads company hours, editing + save updates them. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): hours editor system bridge (bidirectional company_opening_hours)`

---

### Task 8: Menu Editor — System Bridge

**Files to modify:**

- `apps/web/src/app/dashboard/website/_components/editors/MenuFullEditor.tsx`
- `apps/web/src/app/dashboard/website/_components/editors/MenuPreviewEditor.tsx`

**Read first:**

- `docs/superpowers/specs/2026-03-22-website-factory-builder-design.md` — section 7.1
- `apps/web/src/app/dashboard/website/_hooks/use-menus.ts` (created in Task 6)

**Steps:**

- [ ] Rewrite `MenuFullEditor.tsx`:
  - Blue info banner: "Denne seksjonen henter data fra Menymodulen i Smartout."
  - If no menus: empty state with "Opprett en meny i Menymodulen for a vise den her" + link to `/dashboard/menu`
  - If menus exist: tab selector for each menu (Hovedmeny, Lunsjmeny, etc.)
  - Category list with checkboxes (include/exclude on website)
  - Item list per category: name, description, price
  - Yellow warning: "Endringer i menymodulen pavirker hele systemet."
  - Keep display toggles (showPrices, showDescriptions, etc.) — these are website-local
  - Menu data is READ-ONLY — no editing prices/names here

- [ ] Rewrite `MenuPreviewEditor.tsx`:
  - Same bridge banner
  - Select which menu to show preview items from
  - Max items selector (3, 6, 9)
  - "Se full meny" button text field

**Verify:** Menu editors load workspace menus, display categories/items. `pnpm turbo typecheck --filter=web`

**Commit:** `feat(website-factory): menu editors system bridge (read-only from menu module)`

---

### Task 9: Register New Telemetry Events

**Files to modify:**

- `packages/telemetry/src/registry.ts`

**Steps:**

- [ ] Add new event interfaces:
  - `WebsiteHoursUpdated` — `event: "website hours_updated"`, data: `{ days_updated: number }`
  - `WebsiteMenuSynced` — `event: "website menu_synced"`, data: `{ menu_count: number }`
  - `WebsiteSystemSectionAdded` — `event: "website system_section_added"`, data: `{ section_type: string }`
- [ ] Add to `SmartoutEvent` union
- [ ] Add to `EVENT_ROUTING` map

**Verify:** `pnpm turbo typecheck`

**Commit:** `feat(website-factory): register system bridge telemetry events`

---

## Verification Checklist

Before declaring B2a complete:

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] Template preview overlay opens from gallery with ← → navigation
- [ ] Device switcher constrains preview width
- [ ] Sections drag-to-reorder in sidebar
- [ ] Pages drag-to-reorder in page list (home pinned)
- [ ] Section settings panel shows in sidebar for active section
- [ ] Background/width/spacing settings persist to DB
- [ ] Mobile layout stacks editor, sections become horizontal tabs
- [ ] Hours editor loads and saves company_opening_hours
- [ ] Menu editor displays workspace menus (read-only)
- [ ] All mutations emit telemetry

---

## Dependencies

| Dependency                          | Status          | Notes                                             |
| ----------------------------------- | --------------- | ------------------------------------------------- |
| B1 complete                         | Done            | All editors, hooks, actions exist                 |
| @dnd-kit                            | Installed       | `@dnd-kit/core` + `@dnd-kit/sortable` in apps/web |
| `company_opening_hours` table       | Exists          | From signup migration                             |
| `website_menu` tables               | Exists (Plan A) | In websites schema                                |
| `@smartout/website` settings schema | Exists          | `sectionSettingsSchema` with 5 fields             |

---

## Changelog

| Date       | Change                                                   |
| ---------- | -------------------------------------------------------- |
| 2026-03-22 | Initial plan — 9 tasks for B2a (polish + system bridges) |
