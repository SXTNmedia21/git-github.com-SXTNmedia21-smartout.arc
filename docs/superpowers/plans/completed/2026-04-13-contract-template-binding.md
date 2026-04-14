# Contract Phase 2 — Template Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the K1b template binding layer so workspaces can bind contract templates to employee groups (lonnsgrupper), with automatic 3-layer cascade resolution during composition.

**Architecture:** New `contract_template_binding` table links workspace-owned templates to `payroll.employee_group` + `employment_category` pairs. A `resolveTemplate()` function in `packages/utils/src/resolve-composition.ts` implements 3-layer fallback: group+category binding → category-only binding → system template. Settings UI nests template binding management inside the existing employee groups settings tab.

**Tech Stack:** PostgreSQL (migration), TypeScript, Supabase client, TanStack Query, shadcn/ui (Sheet, Select, Badge), Next.js API routes

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/YYYYMMDDHHMMSS_contract_template_binding.sql` | Table, indexes, RLS, unique constraint |
| Modify | `packages/utils/src/resolve-composition.ts` | Add `resolveTemplate()`, update `resolveComposition()` return type to include template_id |
| Create | `apps/web/src/app/api/contract-template-bindings/route.ts` | GET (list) + POST (create/update) bindings |
| Create | `apps/web/src/app/api/contract-template-bindings/[id]/route.ts` | DELETE binding |
| Create | `apps/web/src/app/api/contract-templates/copy/route.ts` | POST copy system template to workspace |
| Create | `apps/web/src/app/dashboard/settings/_hooks/use-template-bindings.ts` | TanStack Query hooks for bindings CRUD + template copy |
| Create | `apps/web/src/app/dashboard/settings/_components/template-bindings-settings.tsx` | UI: binding list per group, bind/unbind actions |
| Modify | `apps/web/src/app/dashboard/settings/_components/employee-groups-settings.tsx` | Add "Maler" tab/section inside expanded group card |
| Modify | `apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx` | Show template source GhostValueCard in Step 3 |
| Modify | `apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts` | Pass template_id through compose result |

---

### Task 1: Database Migration — `contract_template_binding` table

**Files:**
- Create: `supabase/migrations/20260414100000_contract_template_binding.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================
-- Migration: Contract Template Binding (K1b)
-- Purpose: Workspace-level binding of contract templates to
--          employee groups + employment categories.
--          Enables 3-layer template resolution in composition engine.
-- =============================================================

-- 1. Create binding table
CREATE TABLE public.contract_template_binding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES public.contract_template(template_id) ON DELETE CASCADE,
  employment_category TEXT NOT NULL CHECK (employment_category IN ('fast', 'deltid', 'tilkalling')),
  employee_group_id UUID REFERENCES payroll.employee_group(id) ON DELETE SET NULL,
  priority        INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A workspace can only bind one template per (category, group) pair
  UNIQUE (workspace_id, employment_category, employee_group_id)
);

COMMENT ON TABLE public.contract_template_binding IS
  'K1b layer: workspace-level binding of contract templates to employee groups and employment categories';

-- 2. Indexes
CREATE INDEX idx_binding_lookup
  ON contract_template_binding(workspace_id, employment_category, is_active)
  WHERE is_active = true;

CREATE INDEX idx_binding_group
  ON contract_template_binding(employee_group_id)
  WHERE employee_group_id IS NOT NULL;

-- 3. Updated_at trigger
CREATE TRIGGER set_contract_template_binding_updated_at
  BEFORE UPDATE ON contract_template_binding
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');

-- 4. RLS
ALTER TABLE contract_template_binding ENABLE ROW LEVEL SECURITY;

-- Admin read
CREATE POLICY "workspace_admin_read_bindings"
  ON contract_template_binding FOR SELECT
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- Admin write
CREATE POLICY "workspace_admin_manage_bindings"
  ON contract_template_binding FOR ALL
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
```

- [ ] **Step 2: Apply migration and regenerate types**

Run: `npx supabase db reset && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: Migration applies cleanly, types include `contract_template_binding` table.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260414100000_contract_template_binding.sql packages/supabase/src/database.types.ts
git commit -m "feat(contracts): add contract_template_binding table for K1b template resolution"
```

---

### Task 2: Template Resolution Function in Composition Engine

**Files:**
- Modify: `packages/utils/src/resolve-composition.ts`

- [ ] **Step 1: Add `ResolvedTemplate` type and extend `ContractDraftProposal`**

At the top of the types section (after line 67, before `EmploymentCategory`), add:

```typescript
export type ResolvedTemplate = {
  template_id: string;
  template_name: string;
  source: "workspace_group" | "workspace_category" | "system";
  employee_group_name?: string;
};
```

Then extend `ContractDraftProposal` by adding a field after `placeholder_status`:

```typescript
  resolved_template: ResolvedTemplate | null;
```

- [ ] **Step 2: Write `resolveTemplate()` function**

Add this function between `computePlaceholderStatus` and `resolveComposition`:

```typescript
async function resolveTemplate(
  supabase: SupabaseClient,
  workspaceId: string,
  employmentCategory: EmploymentCategory,
  employeeGroupId?: string,
): Promise<ResolvedTemplate | null> {
  // Layer 1: workspace binding for specific group + category
  if (employeeGroupId) {
    const { data: groupBinding } = await supabase
      .from("contract_template_binding")
      .select("template_id, contract_template(name)")
      .eq("workspace_id", workspaceId)
      .eq("employment_category", employmentCategory)
      .eq("employee_group_id", employeeGroupId)
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (groupBinding) {
      const tmpl = groupBinding.contract_template as unknown as { name: string } | null;
      // Fetch group name for UI display
      const { data: group } = await supabase
        .schema("payroll")
        .from("employee_group")
        .select("name")
        .eq("id", employeeGroupId)
        .single();

      return {
        template_id: groupBinding.template_id,
        template_name: tmpl?.name ?? "Unknown",
        source: "workspace_group",
        employee_group_name: group?.name ?? undefined,
      };
    }
  }

  // Layer 2: workspace binding for category only (no specific group)
  const { data: categoryBinding } = await supabase
    .from("contract_template_binding")
    .select("template_id, contract_template(name)")
    .eq("workspace_id", workspaceId)
    .eq("employment_category", employmentCategory)
    .is("employee_group_id", null)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (categoryBinding) {
    const tmpl = categoryBinding.contract_template as unknown as { name: string } | null;
    return {
      template_id: categoryBinding.template_id,
      template_name: tmpl?.name ?? "Unknown",
      source: "workspace_category",
    };
  }

  // Layer 3: system template fallback
  const { data: systemTemplate } = await supabase
    .from("contract_template")
    .select("template_id, name")
    .eq("is_system", true)
    .eq("is_active", true)
    .eq("contract_type", "employee")
    .eq("employment_category", employmentCategory)
    .limit(1)
    .maybeSingle();

  if (systemTemplate) {
    return {
      template_id: systemTemplate.template_id,
      template_name: systemTemplate.name,
      source: "system",
    };
  }

  return null;
}
```

- [ ] **Step 3: Wire `resolveTemplate` into `resolveComposition`**

Inside `resolveComposition`, after the placeholder_status computation (line ~261) and before the final `return`, add:

```typescript
  // ---- Step 8: Resolve contract template via K1b binding cascade ----
  const resolvedTemplate = await resolveTemplate(
    supabase,
    workspaceId,
    input.employment_category,
    input.employee_group_id,
  );
```

Then add `resolved_template: resolvedTemplate` to the returned object, after `placeholder_status`:

```typescript
    placeholder_status: placeholderStatus,
    resolved_template: resolvedTemplate,
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/utils`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/utils/src/resolve-composition.ts
git commit -m "feat(contracts): add 3-layer template resolution to composition engine"
```

---

### Task 3: Copy System Template API

**Files:**
- Create: `apps/web/src/app/api/contract-templates/copy/route.ts`

- [ ] **Step 1: Write the route**

```typescript
/**
 * POST /api/contract-templates/copy — Clone a system template to workspace.
 *
 * Creates a workspace-owned copy of an immutable system template.
 * The copy gets is_system=false and the caller's workspace_id.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { emit } from "@smartout/telemetry";

const copySchema = z.object({
  workspace_id: z.string().uuid(),
  system_template_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = copySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace_id, system_template_id, name, description } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role gate
    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load source template
    const { data: source, error: sourceError } = await supabase
      .from("contract_template")
      .select("*")
      .eq("template_id", system_template_id)
      .eq("is_system", true)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: "System template not found" }, { status: 404 });
    }

    // Insert workspace copy
    const { data: copy, error: copyError } = await supabase
      .from("contract_template")
      .insert({
        name,
        description: description ?? source.description,
        workspace_id,
        contract_type: source.contract_type,
        language: source.language,
        content_html: source.content_html,
        content_css: source.content_css,
        header_html: source.header_html,
        footer_html: source.footer_html,
        placeholders: source.placeholders,
        employment_category: source.employment_category,
        is_system: false,
        is_active: true,
        version: 1,
        created_by: actorProfile.profile_id,
      })
      .select("template_id, name")
      .single();

    if (copyError || !copy) {
      return NextResponse.json(
        { error: `Failed to copy: ${copyError?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    await emit({
      event: "contract_template copied",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "contract_template", entity_id: copy.template_id },
        data: { source_template_id: system_template_id, name: copy.name },
      },
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/contract-templates/copy/route.ts
git commit -m "feat(contracts): add POST /api/contract-templates/copy for workspace template cloning"
```

---

### Task 4: Template Binding CRUD API

**Files:**
- Create: `apps/web/src/app/api/contract-template-bindings/route.ts`
- Create: `apps/web/src/app/api/contract-template-bindings/[id]/route.ts`

- [ ] **Step 1: Write GET + POST route**

`apps/web/src/app/api/contract-template-bindings/route.ts`:

```typescript
/**
 * GET  /api/contract-template-bindings?workspace_id=...&employee_group_id=...
 * POST /api/contract-template-bindings — Create a new binding.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { emit } from "@smartout/telemetry";

const createSchema = z.object({
  workspace_id: z.string().uuid(),
  template_id: z.string().uuid(),
  employment_category: z.enum(["fast", "deltid", "tilkalling"]),
  employee_group_id: z.string().uuid().nullable().optional().default(null),
  priority: z.number().int().min(0).optional().default(0),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("contract_template_binding")
    .select("*, contract_template(template_id, name, employment_category, is_system)")
    .eq("workspace_id", workspaceId)
    .order("priority", { ascending: false });

  const employeeGroupId = searchParams.get("employee_group_id");
  if (employeeGroupId) {
    query = query.eq("employee_group_id", employeeGroupId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace_id, template_id, employment_category, employee_group_id, priority } =
      parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Upsert: if binding for same (workspace, category, group) exists, update template
    const { data, error } = await supabase
      .from("contract_template_binding")
      .upsert(
        {
          workspace_id,
          template_id,
          employment_category,
          employee_group_id: employee_group_id ?? null,
          priority,
          is_active: true,
        },
        { onConflict: "workspace_id,employment_category,employee_group_id" },
      )
      .select("id, template_id, employment_category, employee_group_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await emit({
      event: "template_binding created",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "contract_template_binding", entity_id: data.id },
        data: { template_id, employment_category, employee_group_id },
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write DELETE route**

`apps/web/src/app/api/contract-template-bindings/[id]/route.ts`:

```typescript
/**
 * DELETE /api/contract-template-bindings/[id] — Remove a binding.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load binding to get workspace_id for role check
  const { data: binding, error: fetchError } = await supabase
    .from("contract_template_binding")
    .select("id, workspace_id, template_id, employment_category, employee_group_id")
    .eq("id", id)
    .single();

  if (fetchError || !binding) {
    return NextResponse.json({ error: "Binding not found" }, { status: 404 });
  }

  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, role")
    .eq("user_id", user.id)
    .eq("workspace_id", binding.workspace_id)
    .single();

  if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("contract_template_binding")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await emit({
    event: "template_binding deleted",
    workspace_id: binding.workspace_id,
    actor_id: actorProfile.profile_id,
    properties: {
      entity: { entity_type: "contract_template_binding", entity_id: id },
      data: {
        template_id: binding.template_id,
        employment_category: binding.employment_category,
        employee_group_id: binding.employee_group_id,
      },
    },
  });

  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/contract-template-bindings/
git commit -m "feat(contracts): add template binding CRUD API routes"
```

---

### Task 5: TanStack Query Hooks for Bindings + Template Copy

**Files:**
- Create: `apps/web/src/app/dashboard/settings/_hooks/use-template-bindings.ts`

- [ ] **Step 1: Write the hooks file**

```typescript
/**
 * TanStack Query hooks for contract template bindings and template copy.
 *
 * Used by the template bindings settings UI inside employee group cards.
 * Workspace-scoped via DashboardContext.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateBindingRow = {
  id: string;
  workspace_id: string;
  template_id: string;
  employment_category: string;
  employee_group_id: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  contract_template: {
    template_id: string;
    name: string;
    employment_category: string | null;
    is_system: boolean;
  } | null;
};

export type WorkspaceTemplate = {
  template_id: string;
  name: string;
  employment_category: string | null;
  is_system: boolean;
  is_active: boolean;
};

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

function bindingsKey(workspaceId: string, groupId?: string) {
  return ["template-bindings", workspaceId, groupId ?? "all"] as const;
}

function workspaceTemplatesKey(workspaceId: string) {
  return ["workspace-templates", workspaceId] as const;
}

// ---------------------------------------------------------------------------
// Read: bindings for a group
// ---------------------------------------------------------------------------

export function useTemplateBindings(employeeGroupId?: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: bindingsKey(wsId ?? "none", employeeGroupId),
    queryFn: async (): Promise<TemplateBindingRow[]> => {
      const params = new URLSearchParams({ workspace_id: wsId! });
      if (employeeGroupId) params.set("employee_group_id", employeeGroupId);

      const res = await fetch(`/api/contract-template-bindings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bindings");
      const json = (await res.json()) as { data: TemplateBindingRow[] };
      return json.data;
    },
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Read: workspace + system templates (for binding selector)
// ---------------------------------------------------------------------------

export function useWorkspaceTemplates() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: workspaceTemplatesKey(wsId ?? "none"),
    queryFn: async (): Promise<WorkspaceTemplate[]> => {
      const { data, error } = await supabase
        .from("contract_template")
        .select("template_id, name, employment_category, is_system, is_active")
        .eq("contract_type", "employee")
        .eq("is_active", true)
        .or(`workspace_id.eq.${wsId},is_system.eq.true`)
        .order("is_system", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as WorkspaceTemplate[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create/update binding
// ---------------------------------------------------------------------------

type CreateBindingInput = {
  template_id: string;
  employment_category: string;
  employee_group_id?: string | null;
  priority?: number;
};

export function useCreateTemplateBinding() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBindingInput) => {
      const res = await fetch("/api/contract-template-bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: wsId, ...input }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to create binding");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "template_binding created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            template_id: variables.template_id,
            employment_category: variables.employment_category,
            employee_group_id: variables.employee_group_id ?? null,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: bindingsKey(wsId!, variables.employee_group_id ?? undefined),
      });
      toast.success("Mal knyttet til gruppe");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: delete binding
// ---------------------------------------------------------------------------

export function useDeleteTemplateBinding() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId?: string }) => {
      const res = await fetch(`/api/contract-template-bindings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to delete binding");
      }
      return { id, groupId };
    },
    onSuccess: (data) => {
      void emit({
        event: "template_binding deleted",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: { data: { binding_id: data.id } },
      });
      void queryClient.invalidateQueries({
        queryKey: bindingsKey(wsId!, data.groupId),
      });
      toast.success("Maltilknytning fjernet");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: copy system template to workspace
// ---------------------------------------------------------------------------

type CopyTemplateInput = {
  system_template_id: string;
  name: string;
  description?: string;
};

export function useCopySystemTemplate() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CopyTemplateInput) => {
      const res = await fetch("/api/contract-templates/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: wsId, ...input }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to copy template");
      }
      return res.json() as Promise<{ template_id: string; name: string }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceTemplatesKey(wsId!) });
      toast.success("Mal kopiert til arbeidsområdet");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_hooks/use-template-bindings.ts
git commit -m "feat(contracts): add TanStack Query hooks for template bindings and template copy"
```

---

### Task 6: Template Bindings Settings UI Component

**Files:**
- Create: `apps/web/src/app/dashboard/settings/_components/template-bindings-settings.tsx`

- [ ] **Step 1: Write the component**

This component renders inside the expanded group card. It shows:
- Current bindings for this group (one per employment_category)
- "Knytt mal" button → Sheet with template selector
- Unbind action per row

```typescript
"use client";

/**
 * TemplateBindingsPanel — Displays and manages contract template bindings
 * for a specific employee group. Rendered inside expanded GroupCard.
 *
 * Shows one binding per employment_category. Admin picks a template from
 * workspace or system templates and binds it to the group.
 */

import { useState } from "react";
import { FileText, Plus, Trash2, Loader2, Copy } from "lucide-react";
import { Button, Badge, Label, Input } from "@smartout/ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTemplateBindings,
  useWorkspaceTemplates,
  useCreateTemplateBinding,
  useDeleteTemplateBinding,
  useCopySystemTemplate,
  type TemplateBindingRow,
  type WorkspaceTemplate,
} from "../_hooks/use-template-bindings";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  fast: "Fast ansatt",
  deltid: "Deltid",
  tilkalling: "Tilkalling",
};

const CATEGORIES = ["fast", "deltid", "tilkalling"] as const;

// ---------------------------------------------------------------------------
// Bind Sheet
// ---------------------------------------------------------------------------

type BindSheetProps = {
  open: boolean;
  onClose: () => void;
  groupId: string;
  templates: WorkspaceTemplate[];
  existingCategories: Set<string>;
};

function BindSheet({ open, onClose, groupId, templates, existingCategories }: BindSheetProps) {
  const createBinding = useCreateTemplateBinding();
  const [category, setCategory] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");

  const availableCategories = CATEGORIES.filter((c) => !existingCategories.has(c));
  const filteredTemplates = templates.filter(
    (t) => !category || !t.employment_category || t.employment_category === category,
  );

  function handleSubmit() {
    if (!category || !templateId) return;
    createBinding.mutate(
      { template_id: templateId, employment_category: category, employee_group_id: groupId },
      {
        onSuccess: () => {
          setCategory("");
          setTemplateId("");
          onClose();
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Knytt kontraktmal</SheetTitle>
          <SheetDescription>
            Velg ansettelsesform og kontraktmal for denne lønnsgruppen.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Ansettelsesform</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Velg..." />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Kontraktmal</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Velg mal..." />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.map((t) => (
                  <SelectItem key={t.template_id} value={t.template_id}>
                    {t.name}
                    {t.is_system && " (system)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={!category || !templateId || createBinding.isPending}>
            {createBinding.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            Knytt mal
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Copy Template Sheet
// ---------------------------------------------------------------------------

type CopySheetProps = {
  open: boolean;
  onClose: () => void;
  template: WorkspaceTemplate | null;
};

function CopyTemplateSheet({ open, onClose, template }: CopySheetProps) {
  const copyTemplate = useCopySystemTemplate();
  const [name, setName] = useState("");

  function handleCopy() {
    if (!template || !name) return;
    copyTemplate.mutate(
      { system_template_id: template.template_id, name },
      {
        onSuccess: () => {
          setName("");
          onClose();
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Kopier systemmal</SheetTitle>
          <SheetDescription>
            Lag en redigerbar kopi av «{template?.name}» for arbeidsområdet ditt.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Navn på kopi</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={template ? `${template.name} (kopi)` : ""}
            />
          </div>
        </div>
        <SheetFooter className="flex-row gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleCopy} disabled={!name || copyTemplate.isPending}>
            {copyTemplate.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Kopier
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

type TemplateBindingsPanelProps = {
  groupId: string;
};

export function TemplateBindingsPanel({ groupId }: TemplateBindingsPanelProps) {
  const { data: bindings = [], isLoading } = useTemplateBindings(groupId);
  const { data: templates = [] } = useWorkspaceTemplates();
  const deleteBinding = useDeleteTemplateBinding();
  const [bindSheetOpen, setBindSheetOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<WorkspaceTemplate | null>(null);

  const existingCategories = new Set(bindings.map((b) => b.employment_category));
  const systemTemplates = templates.filter((t) => t.is_system);

  if (isLoading) {
    return <div className="px-4 py-3 text-sm text-muted-foreground">Laster maler...</div>;
  }

  return (
    <div className="border-t px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Kontraktmaler</span>
        </div>
        <div className="flex gap-1.5">
          {systemTemplates.length > 0 && (
            <Select onValueChange={(id) => setCopyTarget(systemTemplates.find((t) => t.template_id === id) ?? null)}>
              <SelectTrigger className="h-7 w-auto gap-1.5 text-xs">
                <Copy className="h-3 w-3" />
                <SelectValue placeholder="Kopier systemmal" />
              </SelectTrigger>
              <SelectContent>
                {systemTemplates.map((t) => (
                  <SelectItem key={t.template_id} value={t.template_id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBindSheetOpen(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Knytt mal
          </Button>
        </div>
      </div>

      {bindings.length === 0 ? (
        <p className="text-muted-foreground py-2 text-xs">
          Ingen maler knyttet. Kontrakten vil bruke systemmalen basert på ansettelsesform.
        </p>
      ) : (
        <div className="space-y-1.5">
          {bindings.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {CATEGORY_LABELS[b.employment_category] ?? b.employment_category}
                </Badge>
                <span className="text-sm">{b.contract_template?.name ?? "Ukjent mal"}</span>
                {b.contract_template?.is_system && (
                  <Badge variant="outline" className="text-xs">
                    System
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => deleteBinding.mutate({ id: b.id, groupId })}
                disabled={deleteBinding.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <BindSheet
        open={bindSheetOpen}
        onClose={() => setBindSheetOpen(false)}
        groupId={groupId}
        templates={templates}
        existingCategories={existingCategories}
      />

      <CopyTemplateSheet
        open={!!copyTarget}
        onClose={() => setCopyTarget(null)}
        template={copyTarget}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/template-bindings-settings.tsx
git commit -m "feat(contracts): add TemplateBindingsPanel UI for managing template bindings per group"
```

---

### Task 7: Wire TemplateBindingsPanel into Employee Groups Settings

**Files:**
- Modify: `apps/web/src/app/dashboard/settings/_components/employee-groups-settings.tsx`

- [ ] **Step 1: Import TemplateBindingsPanel**

Add import at the top of the file, after the existing imports from `../\_hooks/use-employee-groups`:

```typescript
import { TemplateBindingsPanel } from "./template-bindings-settings";
```

- [ ] **Step 2: Add TemplateBindingsPanel inside GroupCard's CollapsibleContent**

In the `GroupCard` component, the `CollapsibleContent` currently contains only `MemberTable`. Add `TemplateBindingsPanel` below it.

Find this block (around line 750-755):

```typescript
        <CollapsibleContent>
          <MemberTable groupId={group.id} onAddMember={onAddMember} onEditMember={onEditMember} />
        </CollapsibleContent>
```

Replace with:

```typescript
        <CollapsibleContent>
          <MemberTable groupId={group.id} onAddMember={onAddMember} onEditMember={onEditMember} />
          <TemplateBindingsPanel groupId={group.id} />
        </CollapsibleContent>
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/employee-groups-settings.tsx
git commit -m "feat(contracts): wire TemplateBindingsPanel into employee group cards"
```

---

### Task 8: Show Template Source in Composition Wizard Step 3

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx`
- Modify: `apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts`

- [ ] **Step 1: Update hooks ComposeResult type**

In `use-employment-contracts.ts`, update the `ComposeResult` type to include the resolved template:

Find:

```typescript
type ComposeResult = ContractDraftProposal & {
  contract_id?: string;
  persisted?: boolean;
};
```

Replace with:

```typescript
type ComposeResult = ContractDraftProposal & {
  contract_id?: string;
  persisted?: boolean;
  resolved_template?: {
    template_id: string;
    template_name: string;
    source: "workspace_group" | "workspace_category" | "system";
    employee_group_name?: string;
  } | null;
};
```

- [ ] **Step 2: Add template GhostValueCard in GjennomgangStep**

In `CompositionWizard.tsx`, inside the `GjennomgangStep` component, after the existing GhostValueCards for rate/percentage/category (find the section that renders GhostValueCards — it's in the return statement of `GjennomgangStep`), add a template card.

Find the code section that maps over ghost value cards and add after the last `GhostValueCard`:

```typescript
          {/* Template source */}
          {state.proposal?.resolved_template && (
            <GhostValueCard
              label={t("ghost_value.template")}
              value={state.proposal.resolved_template.template_name}
              source={
                state.proposal.resolved_template.source === "workspace_group"
                  ? t("ghost_value.source_workspace_group", {
                      group: state.proposal.resolved_template.employee_group_name ?? "",
                    })
                  : state.proposal.resolved_template.source === "workspace_category"
                    ? t("ghost_value.source_workspace_category")
                    : t("ghost_value.source_system")
              }
              acknowledged={state.acknowledgedBlocks.has("template")}
              onAcknowledge={() =>
                updateState({
                  acknowledgedBlocks: new Set([...state.acknowledgedBlocks, "template"]),
                })
              }
              onClickExplain={() => {
                setDrawerField("template");
                setDrawerOpen(true);
              }}
            />
          )}
```

- [ ] **Step 3: Add i18n keys**

Add these keys to the contracts i18n namespace (find the contracts JSON file and add):

```json
"ghost_value.template": "Kontraktmal",
"ghost_value.source_workspace_group": "Fra lønnsgruppe: {{group}}",
"ghost_value.source_workspace_category": "Tilpasset mal for arbeidsområdet",
"ghost_value.source_system": "Standard systemmal"
```

Locate the i18n file:

Run: `find packages/i18n -name "*.json" | grep contracts | head -5`

Then add the keys to the Norwegian (`no`) file.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts packages/i18n/
git commit -m "feat(contracts): show resolved template source in composition wizard step 3"
```

---

### Task 9: Register Telemetry Events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add template binding events to telemetry registry**

Find the telemetry registry file and add these events to the appropriate section:

```typescript
"contract_template copied": {
  entity: { entity_type: "contract_template", entity_id: "" },
  data: { source_template_id: "", name: "" },
},
"template_binding created": {
  entity: { entity_type: "contract_template_binding", entity_id: "" },
  data: { template_id: "", employment_category: "", employee_group_id: "" },
},
"template_binding deleted": {
  entity: { entity_type: "contract_template_binding", entity_id: "" },
  data: { template_id: "", employment_category: "", employee_group_id: "" },
},
```

Run: `grep -n "contract" packages/telemetry/src/registry.ts | head -10` to find the right section.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/telemetry`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register contract template binding events"
```

---

### Task 10: Type Regeneration + Final Typecheck

**Files:**
- Modify: `packages/supabase/src/database.types.ts` (generated)

- [ ] **Step 1: Regenerate types (if not done in Task 1)**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File regenerated with `contract_template_binding` table types.

- [ ] **Step 2: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: All packages pass (29/29 or similar).

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore: regenerate database types with contract_template_binding"
```

---

## Scope Check

This plan covers one coherent subsystem: template binding layer. It does NOT include:
- Template content editor UI (admin edits template HTML) — separate feature
- PII encryption (G9) — separate ADR
- Contract Phase 3 agent-based template wiring — future phase
- Template versioning/diff — future enhancement

These are intentionally out of scope and should be separate plans.
