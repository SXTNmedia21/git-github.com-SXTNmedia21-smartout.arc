---
title: Employee Contract Management Implementation Plan
status: draft
updated: 2026-04-06
created: 2026-04-06
module: contracts
tags: [contracts, docuseal, botsson, dashboard, implementation]
---

# Employee Contract Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use `ui-ux-pro-max` and `frontend-design` skills for all UI tasks.

**Goal:** Enable workspace admins to create, send, and track employee contracts with DocuSeal e-signing, plus Botsson AI tools for contract management.

**Architecture:** Dashboard API routes (`/api/contracts/`) proxy to existing contract service (port 5012) for DocuSeal operations. Webhook branches on `contract_type` to sync signed contracts to `employment_contract` table. Botsson gets a new `contract` capability with 5 tools.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), shadcn/ui, Fastify contract service, DocuSeal, Zod, TanStack Query, Framer Motion

**Spec:** `docs/superpowers/specs/2026-04-06-employee-contract-management-design.md`

**Council verdict:** APPROVE (3 rounds, all agents aligned)

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260428210000_employee_contract_signing.sql` | FK, RLS, seed templates |
| `packages/utils/src/employee-contract-placeholders.ts` | Employee placeholder resolver |
| `apps/web/src/app/api/contracts/route.ts` | GET list + POST create |
| `apps/web/src/app/api/contracts/templates/route.ts` | GET employee templates |
| `apps/web/src/app/api/contracts/[id]/route.ts` | GET detail |
| `apps/web/src/app/api/contracts/[id]/send/route.ts` | POST send |
| `apps/web/src/app/api/contracts/[id]/cancel/route.ts` | POST cancel |
| `packages/ai/src/capabilities/contract/index.ts` | Capability definition |
| `packages/ai/src/capabilities/contract/tools.ts` | 5 Botsson tools |
| `apps/web/src/app/dashboard/contracts/page.tsx` | Contracts overview page |
| `apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx` | DataTable client |
| `apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx` | Send drawer |
| `apps/web/src/app/dashboard/contracts/_components/contract-detail-sheet.tsx` | Detail view |
| `packages/ui/src/contract-timeline.tsx` | Reusable timeline component |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/app/api/webhooks/docuseal/route.ts` | Add contract_type branching (lines 78-82, 199-215) |
| `packages/ai/src/capabilities/types.ts` | Add `"contract"` to CapabilityName (line 5-15) |
| `packages/ai/src/capabilities/registry.ts` | Register contractCapability |
| `packages/ai/src/router/intent-classifier.ts` | Add `"contract"` to z.enum + description (lines 27-39, 56-73) |
| `apps/web/src/app/dashboard/people/_components/people-row-actions.tsx` | Add "Send kontrakt" action |
| `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx` | Add contract tab |

---

## Phase 1: Database Migration

### Task 1: Migration — FK, RLS, and Seed Templates

**Files:**
- Create: `supabase/migrations/20260428210000_employee_contract_signing.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 1. Add signing_contract_id FK to employment_contract
ALTER TABLE employment_contract
  ADD COLUMN signing_contract_id UUID REFERENCES contract(contract_id);

CREATE INDEX idx_employment_contract_signing
  ON employment_contract(signing_contract_id)
  WHERE signing_contract_id IS NOT NULL;

COMMENT ON COLUMN employment_contract.signing_contract_id IS
  'FK to contract table — links this HR record to the DocuSeal signing entity';

-- 2. RLS policies for workspace-scoped contract access
-- Admin read
CREATE POLICY "workspace_admin_read_employee_contracts"
  ON contract FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Admin insert
CREATE POLICY "workspace_admin_insert_employee_contracts"
  ON contract FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Admin update drafts
CREATE POLICY "workspace_admin_update_employee_contracts"
  ON contract FOR UPDATE
  USING (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND status = 'draft'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Employee read own contracts via FK join
CREATE POLICY "employee_read_own_contracts"
  ON contract FOR SELECT
  USING (
    contract_type = 'employee'
    AND contract_id IN (
      SELECT signing_contract_id FROM employment_contract ec
      JOIN profile p ON p.profile_id = ec.profile_id
      WHERE p.user_id = auth.uid()
      AND ec.signing_contract_id IS NOT NULL
    )
  );

-- 3. Seed standard employee contract templates
INSERT INTO contract_template (
  template_id, name, description, contract_type, language,
  content_html, placeholders, is_system, is_active, workspace_id
) VALUES
(
  gen_random_uuid(),
  'Arbeidsavtale — Fast ansatt',
  'Standard arbeidsavtale for fast ansatte med månedslønn',
  'employee', 'no',
  '<h1>Arbeidsavtale</h1>
<section data-clause-id="parties">
<h2>Parter</h2>
<p>Denne avtalen er inngått mellom:</p>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, org.nr. {{arbeidsgiver_org_nr}}, {{arbeidsgiver_adresse}}</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, personnr. {{ansatt_personnummer}}, {{ansatt_adresse}}</p>
</section>
<section data-clause-id="position">
<h2>Stilling og arbeidssted</h2>
<p>Arbeidstaker tiltrer stillingen som <strong>{{stilling}}</strong> i avdeling <strong>{{avdeling}}</strong> ved <strong>{{arbeidssted}}</strong>.</p>
<p>Tiltredelsesdato: {{startdato}}</p>
</section>
<section data-clause-id="compensation">
<h2>Lønn</h2>
<p>Månedslønn: <strong>{{maanedslonn}} NOK</strong> (brutto)</p>
<p>Stillingsprosent: <strong>{{stillingsprosent}}%</strong></p>
<p>Lønn utbetales den 15. hver måned.</p>
</section>
<section data-clause-id="hours">
<h2>Arbeidstid</h2>
<p>Normal arbeidstid er i henhold til gjeldende tariffavtale og arbeidsmiljøloven.</p>
</section>
<section data-clause-id="termination">
<h2>Oppsigelse</h2>
<p>Gjensidig oppsigelsestid er 1 måned i prøvetiden, deretter 3 måneder.</p>
</section>
<section data-clause-id="gdpr">
<h2>Personvern</h2>
<p>Arbeidsgiver behandler personopplysninger i henhold til personopplysningsloven og GDPR. Se personvernerklæring for detaljer.</p>
</section>
<section data-clause-id="signature">
<h2>Underskrift</h2>
<p>Sted og dato: {{kontraktdato}}</p>
<p>Arbeidsgiver: ____________________</p>
<p>Arbeidstaker: ____________________</p>
</section>',
  '[
    {"key":"arbeidsgiver_navn","label":"Arbeidsgiver","source":"company","required":true},
    {"key":"arbeidsgiver_org_nr","label":"Org.nr.","source":"company","required":true},
    {"key":"arbeidsgiver_adresse","label":"Adresse arbeidsgiver","source":"workspace","required":true},
    {"key":"ansatt_navn","label":"Ansatt navn","source":"profile","required":true},
    {"key":"ansatt_personnummer","label":"Personnummer","source":"profile","required":true},
    {"key":"ansatt_adresse","label":"Adresse ansatt","source":"profile","required":false},
    {"key":"stilling","label":"Stilling","source":"employment_contract","required":true},
    {"key":"avdeling","label":"Avdeling","source":"department","required":false},
    {"key":"arbeidssted","label":"Arbeidssted","source":"workspace","required":true},
    {"key":"startdato","label":"Startdato","source":"employment_contract","required":true},
    {"key":"maanedslonn","label":"Månedslønn","source":"employment_contract","required":true},
    {"key":"stillingsprosent","label":"Stillingsprosent","source":"employment_contract","required":true},
    {"key":"kontraktdato","label":"Dato","source":"auto","required":true}
  ]'::jsonb,
  true, true, NULL
),
(
  gen_random_uuid(),
  'Arbeidsavtale — Deltid',
  'Standard arbeidsavtale for deltidsansatte med timelønn',
  'employee', 'no',
  '<h1>Arbeidsavtale — Deltid</h1>
<section data-clause-id="parties">
<h2>Parter</h2>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, org.nr. {{arbeidsgiver_org_nr}}</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, personnr. {{ansatt_personnummer}}</p>
</section>
<section data-clause-id="position">
<h2>Stilling</h2>
<p>Stilling: <strong>{{stilling}}</strong>, avdeling: <strong>{{avdeling}}</strong></p>
<p>Tiltredelse: {{startdato}}</p>
</section>
<section data-clause-id="compensation">
<h2>Lønn og arbeidstid</h2>
<p>Timelønn: <strong>{{timelonn}} NOK</strong> (brutto)</p>
<p>Stillingsprosent: <strong>{{stillingsprosent}}%</strong></p>
<p>Avtalt ukentlig arbeidstid: <strong>{{avtalt_timer_uke}} timer</strong></p>
</section>
<section data-clause-id="termination">
<h2>Oppsigelse</h2>
<p>Gjensidig oppsigelsestid: 1 måned.</p>
</section>
<section data-clause-id="signature">
<h2>Underskrift</h2>
<p>Dato: {{kontraktdato}}</p>
</section>',
  '[
    {"key":"arbeidsgiver_navn","label":"Arbeidsgiver","source":"company","required":true},
    {"key":"arbeidsgiver_org_nr","label":"Org.nr.","source":"company","required":true},
    {"key":"ansatt_navn","label":"Ansatt navn","source":"profile","required":true},
    {"key":"ansatt_personnummer","label":"Personnummer","source":"profile","required":true},
    {"key":"stilling","label":"Stilling","source":"employment_contract","required":true},
    {"key":"avdeling","label":"Avdeling","source":"department","required":false},
    {"key":"startdato","label":"Startdato","source":"employment_contract","required":true},
    {"key":"timelonn","label":"Timelønn","source":"employment_contract","required":true},
    {"key":"stillingsprosent","label":"Stillingsprosent","source":"employment_contract","required":true},
    {"key":"avtalt_timer_uke","label":"Timer per uke","source":"employment_contract","required":true},
    {"key":"kontraktdato","label":"Dato","source":"auto","required":true}
  ]'::jsonb,
  true, true, NULL
),
(
  gen_random_uuid(),
  'Arbeidsavtale — Tilkallingsvikar',
  'Avtale for tilkallingsvikarer uten fast arbeidstid',
  'employee', 'no',
  '<h1>Tilkallingsavtale</h1>
<section data-clause-id="parties">
<h2>Parter</h2>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, org.nr. {{arbeidsgiver_org_nr}}</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, personnr. {{ansatt_personnummer}}</p>
</section>
<section data-clause-id="position">
<h2>Stilling</h2>
<p>Stilling: <strong>{{stilling}}</strong>, avdeling: <strong>{{avdeling}}</strong></p>
<p>Tilgjengelig fra: {{startdato}}</p>
</section>
<section data-clause-id="compensation">
<h2>Lønn</h2>
<p>Timelønn: <strong>{{timelonn}} NOK</strong> (brutto)</p>
<p>Arbeidstaker tilkalles etter behov og er ikke garantert et minimum antall timer.</p>
</section>
<section data-clause-id="signature">
<h2>Underskrift</h2>
<p>Dato: {{kontraktdato}}</p>
</section>',
  '[
    {"key":"arbeidsgiver_navn","label":"Arbeidsgiver","source":"company","required":true},
    {"key":"arbeidsgiver_org_nr","label":"Org.nr.","source":"company","required":true},
    {"key":"ansatt_navn","label":"Ansatt navn","source":"profile","required":true},
    {"key":"ansatt_personnummer","label":"Personnummer","source":"profile","required":true},
    {"key":"stilling","label":"Stilling","source":"employment_contract","required":true},
    {"key":"avdeling","label":"Avdeling","source":"department","required":false},
    {"key":"startdato","label":"Startdato","source":"employment_contract","required":true},
    {"key":"timelonn","label":"Timelønn","source":"employment_contract","required":true},
    {"key":"kontraktdato","label":"Dato","source":"auto","required":true}
  ]'::jsonb,
  true, true, NULL
);
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset`
Expected: Migration applies without errors. Verify with:
```bash
npx supabase db diff --use-migra
```
Expected: No diff (migration is in sync).

- [ ] **Step 3: Verify schema**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `employment_contract` type now includes `signing_contract_id: string | null`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428210000_employee_contract_signing.sql packages/supabase/src/database.types.ts
git commit -m "feat(contracts): add signing_contract_id FK, RLS policies, and employee templates"
```

---

## Phase 2: Placeholder Resolver + API Routes

### Task 2: Employee Placeholder Resolver

**Files:**
- Create: `packages/utils/src/employee-contract-placeholders.ts`
- Modify: `packages/utils/src/index.ts` (add export)

- [ ] **Step 1: Create the resolver**

```typescript
// packages/utils/src/employee-contract-placeholders.ts
import type { SupabaseClient } from "@supabase/supabase-js";

type EmployeePlaceholderMap = Record<string, string>;

/**
 * Builds a flat key->value map of employee placeholders for contract templates.
 * Sources: profile, employment_contract, department, workspace, company.
 * Called at dashboard API layer with user JWT for RLS scoping.
 */
export async function buildEmployeePlaceholderMap(
  supabase: SupabaseClient,
  profileId: string,
  workspaceId: string,
): Promise<EmployeePlaceholderMap> {
  const [profileResult, contractResult, workspaceResult] = await Promise.all([
    supabase
      .from("profile")
      .select(
        "display_name, personal_number, address_line_1, postal_code, city, department:department_id(name)",
      )
      .eq("profile_id", profileId)
      .single(),
    supabase
      .from("employment_contract")
      .select(
        "position_title, start_date, end_date, monthly_salary, hourly_rate, employment_percentage, agreed_weekly_hours",
      )
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("workspace")
      .select("name, address_line_1, postal_code, city, company:company_id(name, organization_number)")
      .eq("workspace_id", workspaceId)
      .single(),
  ]);

  const profile = profileResult.data;
  const contract = contractResult.data;
  const workspace = workspaceResult.data;
  const company = workspace?.company as { name: string; organization_number: string } | null;
  const department = profile?.department as { name: string } | null;

  const addressParts = [profile?.address_line_1, profile?.postal_code, profile?.city].filter(Boolean);
  const employerAddress = [workspace?.address_line_1, workspace?.postal_code, workspace?.city].filter(Boolean);

  const map: EmployeePlaceholderMap = {
    ansatt_navn: profile?.display_name ?? "",
    ansatt_personnummer: profile?.personal_number ?? "",
    ansatt_adresse: addressParts.join(", "),
    ansatt_epost: "", // resolved separately from user_identity if needed
    stilling: contract?.position_title ?? "",
    avdeling: department?.name ?? "",
    startdato: contract?.start_date ?? "",
    sluttdato: contract?.end_date ?? "",
    maanedslonn: contract?.monthly_salary?.toString() ?? "",
    timelonn: contract?.hourly_rate?.toString() ?? "",
    stillingsprosent: contract?.employment_percentage?.toString() ?? "",
    avtalt_timer_uke: contract?.agreed_weekly_hours?.toString() ?? "",
    arbeidsgiver_navn: company?.name ?? "",
    arbeidsgiver_org_nr: company?.organization_number ?? "",
    arbeidsgiver_adresse: employerAddress.join(", "),
    arbeidssted: workspace?.name ?? "",
    kontraktdato: new Date().toISOString().split("T")[0],
  };

  return map;
}
```

- [ ] **Step 2: Export from package index**

Add to `packages/utils/src/index.ts`:
```typescript
export { buildEmployeePlaceholderMap } from "./employee-contract-placeholders";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/utils typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/utils/src/employee-contract-placeholders.ts packages/utils/src/index.ts
git commit -m "feat(contracts): add employee placeholder resolver for contract templates"
```

### Task 3: API Route — GET Templates

**Files:**
- Create: `apps/web/src/app/api/contracts/templates/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// apps/web/src/app/api/contracts/templates/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");
  if (!workspaceId) return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  // RLS handles admin check. Query system templates + workspace templates.
  const { data, error } = await supabase
    .from("contract_template")
    .select("template_id, name, description, contract_type, language, placeholders")
    .eq("contract_type", "employee")
    .eq("is_active", true)
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/contracts/templates/route.ts
git commit -m "feat(contracts): add GET /api/contracts/templates for employee templates"
```

### Task 4: API Route — POST Create + GET List

**Files:**
- Create: `apps/web/src/app/api/contracts/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// apps/web/src/app/api/contracts/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createServiceClient } from "@smartout/supabase/server";
import { buildEmployeePlaceholderMap } from "@smartout/utils";
import { z } from "zod";

const createSchema = z.object({
  template_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  overrides: z.record(z.string()).optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");
  if (!workspaceId) return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = 20;

  let query = supabase
    .from("contract")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("contract_type", "employee")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, page, pageSize });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { template_id, profile_id, workspace_id, overrides } = parsed.data;

  // Build employee placeholder map (uses user JWT for RLS)
  const placeholderMap = await buildEmployeePlaceholderMap(supabase, profile_id, workspace_id);
  const resolvedValues = { ...placeholderMap, ...overrides };

  // Get recipient email from user_identity via profile
  const { data: profileData } = await supabase
    .from("profile")
    .select("display_name, user_identity:user_id(email)")
    .eq("profile_id", profile_id)
    .single();

  const userIdentity = profileData?.user_identity as { email: string } | null;
  const recipientEmail = userIdentity?.email ?? "";
  const recipientName = profileData?.display_name ?? "";

  if (!recipientEmail) {
    return NextResponse.json({ error: "Employee has no email address" }, { status: 400 });
  }

  // Call contract service to create draft
  const serviceUrl = process.env.CONTRACT_SERVICE_URL;
  const serviceKey = process.env.CONTRACT_SERVICE_KEY;

  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ error: "Contract service not configured" }, { status: 503 });
  }

  const serviceResponse = await fetch(`${serviceUrl}/contracts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": serviceKey,
    },
    body: JSON.stringify({
      template_id,
      workspace_id,
      contract_type: "employee",
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      resolved_values: resolvedValues,
    }),
  });

  if (!serviceResponse.ok) {
    const err = await serviceResponse.json().catch(() => ({ error: "Service error" }));
    return NextResponse.json(err, { status: serviceResponse.status });
  }

  const contract = await serviceResponse.json();

  // Link to employment_contract
  const admin = createServiceClient();
  await admin
    .from("employment_contract")
    .update({ signing_contract_id: contract.contract_id })
    .eq("profile_id", profile_id)
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json(contract, { status: 201 });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/contracts/route.ts
git commit -m "feat(contracts): add GET/POST /api/contracts for employee contract CRUD"
```

### Task 5: API Routes — Detail, Send, Cancel

**Files:**
- Create: `apps/web/src/app/api/contracts/[id]/route.ts`
- Create: `apps/web/src/app/api/contracts/[id]/send/route.ts`
- Create: `apps/web/src/app/api/contracts/[id]/cancel/route.ts`

- [ ] **Step 1: Create detail route**

```typescript
// apps/web/src/app/api/contracts/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS handles access control
  const [contractResult, eventsResult] = await Promise.all([
    supabase.from("contract").select("*").eq("contract_id", id).single(),
    supabase.from("contract_event").select("*").eq("contract_id", id).order("created_at"),
  ]);

  if (contractResult.error) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...contractResult.data,
    events: eventsResult.data ?? [],
  });
}
```

- [ ] **Step 2: Create send route**

```typescript
// apps/web/src/app/api/contracts/[id]/send/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify contract exists and user has access (RLS)
  const { data: contract } = await supabase
    .from("contract")
    .select("contract_id, status, workspace_id")
    .eq("contract_id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Only draft contracts can be sent" }, { status: 400 });
  }

  const serviceUrl = process.env.CONTRACT_SERVICE_URL;
  const serviceKey = process.env.CONTRACT_SERVICE_KEY;
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ error: "Contract service not configured" }, { status: 503 });
  }

  const response = await fetch(`${serviceUrl}/contracts/${id}/send`, {
    method: "POST",
    headers: { "X-Service-Key": serviceKey },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Send failed" }));
    return NextResponse.json(err, { status: response.status });
  }

  const result = await response.json();

  emit({
    event: "contract sent",
    properties: {
      contract_id: id,
      workspace_id: contract.workspace_id,
      contract_type: "employee",
    },
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Create cancel route**

```typescript
// apps/web/src/app/api/contracts/[id]/cancel/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceUrl = process.env.CONTRACT_SERVICE_URL;
  const serviceKey = process.env.CONTRACT_SERVICE_KEY;
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ error: "Contract service not configured" }, { status: 503 });
  }

  const response = await fetch(`${serviceUrl}/contracts/${id}/cancel`, {
    method: "POST",
    headers: { "X-Service-Key": serviceKey },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Cancel failed" }));
    return NextResponse.json(err, { status: response.status });
  }

  const result = await response.json();

  emit({
    event: "contract cancelled",
    properties: { contract_id: id, contract_type: "employee" },
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/contracts/\[id\]/
git commit -m "feat(contracts): add detail, send, and cancel API routes for employee contracts"
```

---

## Phase 3: Webhook Extension

### Task 6: Branch Webhook on contract_type

**Files:**
- Modify: `apps/web/src/app/api/webhooks/docuseal/route.ts`

- [ ] **Step 1: Add contract_type to initial query (line ~79)**

Change the select from:
```typescript
.select("contract_id, status, workspace_id")
```
to:
```typescript
.select("contract_id, status, workspace_id, contract_type")
```

- [ ] **Step 2: Move workspace update into else branch (lines ~199-215)**

Replace the existing block:
```typescript
if (newStatus === "signed" && contract.workspace_id) {
  await Promise.all([
    admin
      .from("contract_reminder")
      ...
    admin
      .from("workspace")
      .update({
        contract_status: "active",
        ...
      })
      .eq("workspace_id", contract.workspace_id),
  ]);
}
```

With branched logic:
```typescript
if (newStatus === "signed" && contract.workspace_id) {
  // Cancel reminders for all contract types
  await admin
    .from("contract_reminder")
    .update({ status: "skipped", skip_reason: "contract_signed" })
    .eq("contract_id", contract.contract_id)
    .eq("status", "scheduled");

  if (contract.contract_type === "employee") {
    // Sync signing status to employment_contract
    await admin
      .from("employment_contract")
      .update({
        status: "signed" as never,
        document_url: contract.signed_pdf_url ?? null,
        signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("signing_contract_id", contract.contract_id);
  } else {
    // SaaS contracts: update workspace contract status (existing behavior)
    await admin
      .from("workspace")
      .update({
        contract_status: "active",
        active_contract_id: contract.contract_id,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", contract.workspace_id);
  }
}
```

- [ ] **Step 3: Also handle declined/expired for employee contracts**

Find the existing declined/expired handling and add similar branching. For employee contracts, update `employment_contract.status` instead of workspace status.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/webhooks/docuseal/route.ts
git commit -m "fix(contracts): branch webhook on contract_type — employee vs SaaS contracts"
```

---

## Phase 4: Botsson Capability (can run parallel with Phase 5)

### Task 7: Register Contract Capability Type

**Files:**
- Modify: `packages/ai/src/capabilities/types.ts` (line 5-15)
- Modify: `packages/ai/src/router/intent-classifier.ts` (lines 27-39, 56-73)

- [ ] **Step 1: Add "contract" to CapabilityName union**

In `packages/ai/src/capabilities/types.ts`, add `| "contract"` to the union type (after `"guardian"`).

- [ ] **Step 2: Add "contract" to intent classifier z.enum**

In `packages/ai/src/router/intent-classifier.ts`, add `"contract"` to the `z.enum` array (line ~37, before `"general"`).

- [ ] **Step 3: Add contract description to system prompt**

In the same file, add to the capability descriptions block (~line 70):
```
- contract: Creating, sending, tracking, and managing employment contracts and agreements for employees in the workspace
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/types.ts packages/ai/src/router/intent-classifier.ts
git commit -m "feat(contracts): register contract capability in type system and intent classifier"
```

### Task 8: Implement Contract Capability + Tools

**Files:**
- Create: `packages/ai/src/capabilities/contract/index.ts`
- Create: `packages/ai/src/capabilities/contract/tools.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`

- [ ] **Step 1: Create tools.ts**

```typescript
// packages/ai/src/capabilities/contract/tools.ts
import { z } from "zod";
import { defineTool } from "../types.js";
import type { AgentToolContext } from "../../tools/types.js";

export const listEmployeeTemplates = defineTool({
  name: "list-employee-templates",
  description: "List available employee contract templates for the current workspace",
  parameters: z.object({}),
  execute: async (_input: Record<string, never>, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("contract_template")
      .select("template_id, name, description, contract_type, language")
      .eq("contract_type", "employee")
      .eq("is_active", true)
      .or(`workspace_id.eq.${ctx.workspaceId},workspace_id.is.null`)
      .order("name");

    if (error) return `Error fetching templates: ${error.message}`;
    if (!data?.length) return "No employee contract templates available.";

    return data
      .map((t) => `- **${t.name}** (${t.template_id}): ${t.description ?? "No description"}`)
      .join("\n");
  },
});

export const listEmployeeContracts = defineTool({
  name: "list-employee-contracts",
  description: "List employee contracts in the current workspace with optional status filter",
  parameters: z.object({
    status: z.enum(["draft", "sent", "viewed", "signed", "expired", "cancelled"]).optional(),
  }),
  execute: async (input: { status?: string }, ctx: AgentToolContext) => {
    let query = ctx.supabaseAdmin
      .from("contract")
      .select("contract_id, recipient_name, status, contract_type, sent_at, signed_at, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("contract_type", "employee")
      .order("created_at", { ascending: false })
      .limit(20);

    if (input.status) query = query.eq("status", input.status);

    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No employee contracts found.";

    return data
      .map((c) => `- ${c.recipient_name}: **${c.status}** (${c.contract_id}) — created ${c.created_at}`)
      .join("\n");
  },
});

export const checkContractStatus = defineTool({
  name: "check-contract-status",
  description: "Check the signing status of a specific contract by ID",
  parameters: z.object({
    contract_id: z.string().uuid().describe("The contract ID to check"),
  }),
  execute: async (input: { contract_id: string }, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("contract")
      .select("contract_id, recipient_name, recipient_email, status, sent_at, viewed_at, signed_at")
      .eq("contract_id", input.contract_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error || !data) return "Contract not found or you don't have access.";

    return `Contract for **${data.recipient_name}** (${data.recipient_email}):
- Status: **${data.status}**
- Sent: ${data.sent_at ?? "Not sent"}
- Viewed: ${data.viewed_at ?? "Not viewed"}
- Signed: ${data.signed_at ?? "Not signed"}`;
  },
});

export const createEmployeeContract = defineTool({
  name: "create-employee-contract",
  description: "Create a draft employee contract from a template for a specific employee. Requires admin role.",
  parameters: z.object({
    template_id: z.string().uuid().describe("Template ID to use"),
    profile_id: z.string().uuid().describe("Employee profile ID"),
  }),
  execute: async (input: { template_id: string; profile_id: string }, ctx: AgentToolContext) => {
    // Role check
    const { data: profile } = await ctx.supabaseAdmin
      .from("profile")
      .select("role")
      .eq("profile_id", ctx.profileId)
      .single();

    if (!profile || !["admin", "owner"].includes(profile.role)) {
      return "You don't have permission to create contracts. Admin or owner role required.";
    }

    const serviceUrl = process.env.CONTRACT_SERVICE_URL;
    const serviceKey = process.env.CONTRACT_SERVICE_KEY;
    if (!serviceUrl || !serviceKey) return "Contract service is not configured.";

    // Build placeholders
    const { buildEmployeePlaceholderMap } = await import("@smartout/utils");
    const placeholders = await buildEmployeePlaceholderMap(
      ctx.supabaseAdmin,
      input.profile_id,
      ctx.workspaceId,
    );

    // Get recipient info
    const { data: employeeProfile } = await ctx.supabaseAdmin
      .from("profile")
      .select("display_name, user_identity:user_id(email)")
      .eq("profile_id", input.profile_id)
      .single();

    const userIdentity = employeeProfile?.user_identity as { email: string } | null;
    if (!userIdentity?.email) return "Employee has no email address.";

    const response = await fetch(`${serviceUrl}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Key": serviceKey },
      body: JSON.stringify({
        template_id: input.template_id,
        workspace_id: ctx.workspaceId,
        contract_type: "employee",
        recipient_name: employeeProfile?.display_name ?? "",
        recipient_email: userIdentity.email,
        resolved_values: placeholders,
      }),
    });

    if (!response.ok) return `Failed to create contract: ${response.statusText}`;
    const contract = await response.json();

    // Link to employment_contract
    await ctx.supabaseAdmin
      .from("employment_contract")
      .update({ signing_contract_id: contract.contract_id })
      .eq("profile_id", input.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1);

    return `Draft contract created for **${employeeProfile?.display_name}** (${contract.contract_id}). Use send-employee-contract to send it for signing.`;
  },
});

export const sendEmployeeContract = defineTool({
  name: "send-employee-contract",
  description: "Send a draft employee contract for DocuSeal e-signing. IRREVERSIBLE — sends email to employee. Requires admin role.",
  parameters: z.object({
    contract_id: z.string().uuid().describe("The draft contract ID to send"),
  }),
  execute: async (input: { contract_id: string }, ctx: AgentToolContext) => {
    // Role check
    const { data: profile } = await ctx.supabaseAdmin
      .from("profile")
      .select("role")
      .eq("profile_id", ctx.profileId)
      .single();

    if (!profile || !["admin", "owner"].includes(profile.role)) {
      return "You don't have permission to send contracts. Admin or owner role required.";
    }

    // Verify contract is draft and in this workspace
    const { data: contract } = await ctx.supabaseAdmin
      .from("contract")
      .select("status, workspace_id, recipient_name")
      .eq("contract_id", input.contract_id)
      .single();

    if (!contract) return "Contract not found.";
    if (contract.workspace_id !== ctx.workspaceId) return "Contract not in your workspace.";
    if (contract.status !== "draft") return `Contract is already ${contract.status}, cannot send.`;

    const serviceUrl = process.env.CONTRACT_SERVICE_URL;
    const serviceKey = process.env.CONTRACT_SERVICE_KEY;
    if (!serviceUrl || !serviceKey) return "Contract service is not configured.";

    const response = await fetch(`${serviceUrl}/contracts/${input.contract_id}/send`, {
      method: "POST",
      headers: { "X-Service-Key": serviceKey },
    });

    if (!response.ok) return `Failed to send contract: ${response.statusText}`;

    return `Contract sent to **${contract.recipient_name}** for e-signing. They will receive an email with a signing link.`;
  },
});
```

- [ ] **Step 2: Create index.ts**

```typescript
// packages/ai/src/capabilities/contract/index.ts
import type { CapabilityDefinition } from "../types.js";
import {
  listEmployeeTemplates,
  listEmployeeContracts,
  checkContractStatus,
  createEmployeeContract,
  sendEmployeeContract,
} from "./tools.js";

export const contractCapability: CapabilityDefinition = {
  name: "contract",
  description: "Manage employee contracts — create, send for signing, and track status",
  readOnlyTools: [
    listEmployeeTemplates as never,
    listEmployeeContracts as never,
    checkContractStatus as never,
  ],
  suggestTools: [createEmployeeContract as never],
  tools: [sendEmployeeContract as never],
};
```

- [ ] **Step 3: Register in registry.ts**

In `packages/ai/src/capabilities/registry.ts`, add:
```typescript
import { contractCapability } from "./contract/index.js";
```
And add to the capabilities map:
```typescript
contract: contractCapability,
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/contract/ packages/ai/src/capabilities/registry.ts
git commit -m "feat(contracts): add Botsson contract capability with 5 tools"
```

---

## Phase 5: UI (can run parallel with Phase 4)

### Task 9: ContractTimeline Component

**Files:**
- Create: `packages/ui/src/contract-timeline.tsx`

- [ ] **Step 1: Create the component**

Build `ContractTimeline` as a reusable horizontal timeline component. Use `ui-ux-pro-max` and `frontend-design` skills for implementation. Requirements:

- Props: `status: string`, `events: Array<{ event_type: string; created_at: string }>`
- Steps: draft → sent → viewed → signed (horizontal dots connected by lines)
- Completed steps: filled dot with Lucide Check icon, warm OKLCH color
- Active step: pulsing opacity (CSS animation, 2s cycle)
- Future steps: outline only (`border-border`)
- Timestamps below in Geist Mono, labels above in Geist Sans
- `role="list"` + `aria-current="step"` for accessibility
- Dot size: 8px, line width: 1px `border-border`

- [ ] **Step 2: Export from package**

Add export to `packages/ui/src/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/contract-timeline.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add ContractTimeline reusable component"
```

### Task 10: Contract Send Drawer

**Files:**
- Create: `apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx`

- [ ] **Step 1: Create the drawer component**

Use `ui-ux-pro-max` and `frontend-design` skills. Requirements:

- shadcn Sheet component, slides from right, `w-[540px]`
- Spring animation: stiffness 35, damping 22, mass 2.2
- Three sections in one scrollable surface:
  1. **Template selection**: Card grid (<4) or radio list. Skeleton loading (3 items). Empty state with ghost card + "Ingen maler tilgjengelig". Error state with retry.
  2. **Employee data review**: Auto-filled fields with editable overrides. Source labels ("Fra profil", "Fra arbeidsavtale") as muted helper text.
  3. **Preview & send**: Sandboxed iframe (`srcdoc`). "Forstorr" button expands to full-screen Sheet. Summary line. Confirmation dialog on send.
- Props: `profileId: string`, `workspaceId: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `onSuccess: () => void`
- Dismiss confirmation if template selected or fields edited
- On send success: toast "Kontrakt sendt til {name}", close drawer, call onSuccess
- On send error: toast with error, drawer stays open

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx
git commit -m "feat(contracts): add contract send drawer with template selection and preview"
```

### Task 11: Contracts Overview Page

**Files:**
- Create: `apps/web/src/app/dashboard/contracts/page.tsx`
- Create: `apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx`

- [ ] **Step 1: Create the DataTable client component**

Use `ui-ux-pro-max` and `frontend-design` skills. Requirements:

- Server-side pagination (page size 20, default sort by `sent_at` desc)
- Columns: employee name, template name, status badge, sent date, signed date, actions dropdown
- Status badges with warm OKLCH tokens (draft=muted, sent=primary, viewed=teal, signed=green, expired=destructive, cancelled=muted+strikethrough)
- Filters: status dropdown, department dropdown
- Empty state (zero contracts): ghost card + "Ingen kontrakter ennå" + "Send ditt første kontrakt" CTA
- Empty after filter: "Ingen resultater" + clear filter button
- Row click opens detail sheet
- Actions: view detail, resend, cancel

- [ ] **Step 2: Create the page component**

```typescript
// apps/web/src/app/dashboard/contracts/page.tsx
"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ContractsDataTable } from "./_components/contracts-data-table";

export default function ContractsPage() {
  const { workspaceData } = useContext(DashboardContext);

  if (!workspaceData?.workspace_id) return null;

  return (
    <ContractsDataTable workspaceId={workspaceData.workspace_id} />
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/
git commit -m "feat(contracts): add /dashboard/contracts overview page with DataTable"
```

### Task 12: People Integration — Row Action + Profile Tab

**Files:**
- Modify: `apps/web/src/app/dashboard/people/_components/people-row-actions.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`

- [ ] **Step 1: Add "Send kontrakt" to row actions**

In `people-row-actions.tsx`, add a new menu item after the existing admin actions (around line 133, after the department submenu):

```typescript
import { FileSignature } from "lucide-react";

// Inside the isActionable && isAdmin block, after department submenu:
<DropdownMenuSeparator />
<DropdownMenuItem
  onClick={() => onSendContract(employee.profileId!)}
>
  <FileSignature className="mr-2 h-4 w-4" />
  Send kontrakt
</DropdownMenuItem>
```

Add `onSendContract: (profileId: string) => void` to `PeopleRowActionsProps`.

- [ ] **Step 2: Wire up drawer in people-data-table.tsx**

Import `ContractSendDrawer` and add state:
```typescript
const [contractProfileId, setContractProfileId] = useState<string | null>(null);
```

Add drawer at end of component:
```typescript
<ContractSendDrawer
  profileId={contractProfileId ?? ""}
  workspaceId={workspaceData?.workspace_id ?? ""}
  open={!!contractProfileId}
  onOpenChange={(open) => { if (!open) setContractProfileId(null); }}
  onSuccess={() => { setContractProfileId(null); onRefresh(); }}
/>
```

Pass `onSendContract={setContractProfileId}` to `PeopleRowActions`.

- [ ] **Step 3: Add contract tab to employee profile card**

In `employee-profile-card.tsx`, add a "Kontrakt" tab to the existing tab set. Show contract history for this employee using the `/api/contracts?workspace_id=X&profile_id=Y` endpoint (add profile_id filter to GET route if needed). Admin/owner sees "Send nytt kontrakt" button. Managers see read-only history.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/
git commit -m "feat(contracts): integrate contract sending in people list and profile card"
```

---

## Phase 6: Final Verification

### Task 13: Full Typecheck + Manual Test

- [ ] **Step 1: Run full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all packages.

- [ ] **Step 2: Manual test — create and send contract**

1. Start local Supabase: `npx supabase start`
2. Start web app: `pnpm --filter web dev`
3. Log in as workspace admin
4. Navigate to /dashboard/people
5. Click "..." on an employee → "Send kontrakt"
6. Verify drawer opens with templates
7. Select a template, verify auto-fill
8. Preview contract
9. Send → verify DocuSeal receives submission (check contract service logs)

- [ ] **Step 3: Verify webhook branching**

Simulate a DocuSeal `form.completed` webhook for an employee contract. Verify:
- `employment_contract.status` updates to `signed`
- `workspace.contract_status` does NOT change

- [ ] **Step 4: Test Botsson capability**

Open WalkAi and test:
- "Vis meg tilgjengelige kontraktmaler"
- "Lag en kontrakt for [employee name]"
- "Sjekk status på kontrakt [id]"

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(contracts): address issues found during manual testing"
```
