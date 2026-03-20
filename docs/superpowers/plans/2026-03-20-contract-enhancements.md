---
title: "Plan: Contract Enhancements — Placeholder Resolve + Per-Contract Attachments"
status: in_progress
updated: 2026-03-20
created: 2026-03-20
module: contracts
tags: [contract, placeholder, attachment, implementation]
---

# Contract Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix placeholder auto-resolution in platform-admin contract creation and add per-contract file attachments with telemetry.

**Architecture:** Extract placeholder logic to shared `@smartout/utils` package (pure functions, no DB deps). Add `contract_attachment` table with Storage uploads. Platform-admin only (service_role access, no RLS policies). Del 3 (DocuSeal multi-doc) is out of scope for this plan — separate branch.

**Tech Stack:** TypeScript, Supabase (PostgreSQL + Storage), Next.js API routes, shadcn/ui, `@smartout/telemetry`

**Spec:** `docs/superpowers/specs/2026-03-20-contract-enhancements-design.md`

---

## File Structure

### New Files

| File                                                                                     | Responsibility                                                   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/utils/src/contract-placeholders.ts`                                            | Pure functions: `buildAutofillMap`, `resolvePlaceholders`, types |
| `supabase/migrations/20260320120000_contract_attachment.sql`                             | Table + trigger for per-contract file attachments                |
| `apps/web/src/app/api/platform-admin/contracts/[id]/attachments/route.ts`                | GET (list) + POST (upload) attachment API                        |
| `apps/web/src/app/api/platform-admin/contracts/[id]/attachments/[attachmentId]/route.ts` | DELETE attachment API                                            |

### Modified Files

| File                                                                 | Change                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/utils/src/index.ts`                                        | Add export for contract-placeholders                       |
| `services/contract-service/package.json`                             | Add `@smartout/utils` dependency                           |
| `services/contract-service/src/lib/placeholders.ts`                  | Replace with thin wrapper importing from `@smartout/utils` |
| `services/contract-service/src/routes/contracts.ts`                  | Pass `smartoutConfig` to `buildAutofillMap`                |
| `apps/web/src/app/api/platform-admin/contracts/route.ts`             | Add placeholder resolution on contract creation            |
| `packages/telemetry/src/registry.ts`                                 | Add `contract_attachment` entity type + 2 events           |
| `supabase/config.toml`                                               | Expand MIME whitelist on contract-attachments bucket       |
| `apps/web/src/app/platform-admin/contracts/[id]/contract-editor.tsx` | Add file attachments collapsible section                   |
| `apps/web/src/app/platform-admin/contracts/[id]/page.tsx`            | Fetch + pass contract attachments                          |

---

## Task 1: Shared Placeholder Utility

**Files:**

- Create: `packages/utils/src/contract-placeholders.ts`
- Modify: `packages/utils/src/index.ts`

- [ ] **Step 1: Create the shared utility**

Create `packages/utils/src/contract-placeholders.ts` with the following content. This is extracted from `services/contract-service/src/lib/placeholders.ts` with all external dependencies removed (pure functions only).

```ts
// ─── Types ────────────────────────────────────────

export type PlaceholderDef = {
  key: string;
  label: string;
  source: string;
  default_value?: string;
  required: boolean;
};

export type SmartoutConfig = {
  companyName: string;
  orgNumber: string;
  contactEmail: string;
  contactName: string;
};

// ─── Public API ───────────────────────────────────

/**
 * Build a flat map of placeholder key -> value from workspace and company data.
 * Pure function — no DB or config dependencies.
 */
export function buildAutofillMap(
  workspace: Record<string, unknown> | null,
  company: Record<string, unknown> | null,
  smartoutConfig: SmartoutConfig,
): Record<string, string> {
  const m: Record<string, string> = {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : "");

  // Company / Kunde fields
  if (company) {
    m.kunde_firma = str(company.name);
    m.kunde_org_nr = str(company.org_number);
    m.kunde_tlf = str(company.phone);
    m.kunde_epost = str(company.email);
    m.kunde_faktura_epost = str(company.invoice_email) || str(company.email);
    m.kunde_daglig_leder = str(company.daglig_leder);
    // Legacy keys
    m.name_company = str(company.name);
    m.client_company_name = str(company.name);
    m.company_org_number = str(company.org_number);
    m.client_org_number = str(company.org_number);
    m.company_phone = str(company.phone);
    m.company_email = str(company.email);
  }

  // Workspace / Arbeidssted fields
  if (workspace) {
    const addr = str(workspace.address_line_1);
    const postal = str(workspace.postal_code);
    const city = str(workspace.city);

    m.kunde_adresse = addr;
    m.kunde_postnr_sted = [postal, city].filter(Boolean).join(", ");
    m.company_street = addr;
    m.client_address = addr;
    m.company_zip_code = postal;
    m.client_postal_code = postal;
    m.workspace_city = city;
    m.client_city = city;
  }

  // Smartout constants
  m.smartout_kontakt = smartoutConfig.contactName;
  m.smartout_tittel = "CEO";
  m.smartout_company_name = smartoutConfig.companyName;
  m.smartout_org_number = smartoutConfig.orgNumber;
  m.smartout_contact_email = smartoutConfig.contactEmail;
  m.smartout_contact_name = smartoutConfig.contactName;

  // Auto-generated
  m.current_date = new Date().toLocaleDateString("no-NO");
  m.contract_date = m.current_date;
  m.effective_date = m.current_date;

  return m;
}

/**
 * Replace placeholder tokens in HTML with resolved values.
 * Supports {{key}} mustache and <span data-type="placeholder-field" data-key="key"> formats.
 */
export function resolvePlaceholders(
  html: string,
  placeholders: PlaceholderDef[],
  autofillMap: Record<string, string>,
  overrides: Record<string, string>,
): { resolved_html: string; resolved_values: Record<string, string> } {
  const values: Record<string, string> = {};

  for (const p of placeholders) {
    if (overrides[p.key]) {
      values[p.key] = overrides[p.key];
    } else if (autofillMap[p.key]) {
      values[p.key] = autofillMap[p.key];
    } else {
      values[p.key] = p.default_value ?? "";
    }
  }

  let resolved = html;
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;

    // Mustache format: {{key}}
    resolved = resolved.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "g"), value);

    // HTML span format: <span data-type="placeholder-field" data-key="key">anything</span>
    resolved = resolved.replace(
      new RegExp(`(<span[^>]*data-key="${escapeRegex(key)}"[^>]*>)[^<]*(</span>)`, "gi"),
      `$1${escapeReplace(value)}$2`,
    );

    resolved = resolved.replace(
      new RegExp(
        `(<span[^>]*data-type="placeholder-field"[^>]*data-key="${escapeRegex(key)}"[^>]*>)[^<]*(</span>)`,
        "gi",
      ),
      `$1${escapeReplace(value)}$2`,
    );
  }

  return { resolved_html: resolved, resolved_values: values };
}

// ─── Internal Helpers ─────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeReplace(str: string): string {
  return str.replace(/\$/g, "$$$$");
}
```

- [ ] **Step 2: Add export to index**

In `packages/utils/src/index.ts`, add at the end:

```ts
export * from "./contract-placeholders";
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @smartout/utils typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add packages/utils/src/contract-placeholders.ts packages/utils/src/index.ts
git commit -m "feat(utils): add shared contract placeholder resolution

Extract buildAutofillMap + resolvePlaceholders from contract-service
as pure functions with no DB/config dependencies.
Fix: company.contact_name -> company.daglig_leder (bug: field doesn't exist on company table).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Refactor Contract-Service to Use Shared Utility

**Files:**

- Modify: `services/contract-service/package.json`
- Modify: `services/contract-service/src/lib/placeholders.ts`
- Modify: `services/contract-service/src/routes/contracts.ts`

- [ ] **Step 1: Add @smartout/utils dependency**

In `services/contract-service/package.json`, add to `dependencies`:

```json
"@smartout/utils": "workspace:*"
```

Run: `pnpm install` (to link the workspace package)

- [ ] **Step 2: Replace local placeholders.ts with thin wrapper**

Replace `services/contract-service/src/lib/placeholders.ts` with:

```ts
import { buildAutofillMap, resolvePlaceholders as resolveCore } from "@smartout/utils";
import type { PlaceholderDef, SmartoutConfig } from "@smartout/utils";
import { supabase } from "./supabase.js";
import { config } from "../config.js";

export type { PlaceholderDef };

const smartoutConfig: SmartoutConfig = {
  companyName: config.SMARTOUT_COMPANY_NAME,
  orgNumber: config.SMARTOUT_ORG_NUMBER,
  contactEmail: config.SMARTOUT_CONTACT_EMAIL,
  contactName: "Pontus S. Lindroth",
};

/**
 * Resolve placeholders by fetching workspace/company data from DB
 * and delegating to the shared pure utility.
 */
export async function resolvePlaceholders(
  html: string,
  placeholders: PlaceholderDef[],
  workspaceId: string,
  overrides: Record<string, string>,
): Promise<{ resolved_html: string; resolved_values: Record<string, string> }> {
  const { data: workspace } = await supabase
    .from("workspace")
    .select("*, company:company_id(*)")
    .eq("workspace_id", workspaceId)
    .single();

  const company = (workspace?.company ?? null) as Record<string, unknown> | null;
  const autofillMap = buildAutofillMap(workspace, company, smartoutConfig);

  return resolveCore(html, placeholders, autofillMap, overrides);
}
```

- [ ] **Step 3: Verify contract-service builds**

Run: `pnpm --filter @smartout/contract-service typecheck`
Expected: 0 errors

If ESM import fails, check that `@smartout/utils` raw TS source resolves correctly. The contract-service uses `tsx` in dev mode which handles raw TS imports.

- [ ] **Step 4: Commit**

```bash
git add services/contract-service/package.json services/contract-service/src/lib/placeholders.ts
git commit -m "refactor(contract-service): use shared placeholder utils from @smartout/utils

Replaces local buildAutofillMap + resolve logic with thin wrapper
around @smartout/utils. Fixes daglig_leder field name bug.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Fix Platform-Admin Contract Creation (Placeholder Resolution)

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/contracts/route.ts`

- [ ] **Step 1: Add placeholder resolution to POST handler**

Read the current file first. Then modify the POST handler. After the template fetch (around line 87-95), add workspace+company fetch and resolve logic. The key changes:

1. After fetching template, fetch workspace + company data
2. Build autofill map using the shared utility
3. Resolve placeholders before INSERT
4. Store `resolved_html` and `resolved_values` on the contract

Replace the contract INSERT section. Current code (around line 97-121):

```ts
// Create the contract record as draft
const contractTitle = body.data.title || `${template.name} - ${body.data.recipient_name}`;
const now = new Date().toISOString();
const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

const { data: contract, error: createError } = await admin
  .from("contract")
  .insert({
    template_id: body.data.template_id,
    company_id: body.data.company_id,
    workspace_id: workspaceId ?? null,
    title: contractTitle,
    contract_type: template.contract_type,
    status: "draft",
    recipient_name: body.data.recipient_name,
    recipient_email: body.data.recipient_email,
    resolved_html: template.content_html,
    expires_at: expiresAt,
    metadata: (body.data.notes ? { internal_notes: body.data.notes } : {}) as unknown as Json,
    created_by: adminId,
    created_at: now,
    updated_at: now,
  })
  .select("contract_id")
  .single();
```

Replace with:

```ts
// Resolve placeholders from workspace/company data
const placeholders =
  (template.placeholders as Array<{
    key: string;
    label: string;
    source: string;
    default_value?: string;
    required: boolean;
  }>) ?? [];

let resolvedHtml = template.content_html ?? "";
let resolvedValues: Record<string, string> = {};

if (workspaceId && placeholders.length > 0) {
  const { data: wsData } = await admin
    .from("workspace")
    .select("*, company:company_id(*)")
    .eq("workspace_id", workspaceId)
    .single();

  const company = (wsData?.company ?? null) as Record<string, unknown> | null;

  const { buildAutofillMap, resolvePlaceholders } = await import("@smartout/utils");
  const autofillMap = buildAutofillMap(wsData, company, {
    companyName: "Smartout AS",
    orgNumber: "929 620 291",
    contactEmail: "pontus@smartout.io",
    contactName: "Pontus S. Lindroth",
  });

  const result = resolvePlaceholders(resolvedHtml, placeholders, autofillMap, {
    recipient_name: body.data.recipient_name,
    recipient_email: body.data.recipient_email,
  });
  resolvedHtml = result.resolved_html;
  resolvedValues = result.resolved_values;
}

// Create the contract record as draft
const contractTitle = body.data.title || `${template.name} - ${body.data.recipient_name}`;
const now = new Date().toISOString();
const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

const { data: contract, error: createError } = await admin
  .from("contract")
  .insert({
    template_id: body.data.template_id,
    company_id: body.data.company_id,
    workspace_id: workspaceId ?? null,
    title: contractTitle,
    contract_type: template.contract_type,
    status: "draft",
    recipient_name: body.data.recipient_name,
    recipient_email: body.data.recipient_email,
    resolved_html: resolvedHtml,
    resolved_values: resolvedValues,
    expires_at: expiresAt,
    metadata: (body.data.notes ? { internal_notes: body.data.notes } : {}) as unknown as Json,
    created_by: adminId,
    created_at: now,
    updated_at: now,
  })
  .select("contract_id")
  .single();
```

Also update the template SELECT to include `placeholders`:

Change line 88-90 from:

```ts
    .select("template_id, name, contract_type, content_html, placeholders")
```

(Already selects placeholders — verify this is correct.)

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/platform-admin/contracts/route.ts
git commit -m "fix(contracts): auto-resolve placeholders in platform-admin contract creation

Previously stored raw template HTML without resolving {{kunde_org_nr}},
{{kunde_navn}} etc. Now fetches workspace+company data and resolves
before INSERT. Uses shared @smartout/utils placeholder utilities.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Database Migration for contract_attachment

**Files:**

- Create: `supabase/migrations/20260320120000_contract_attachment.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260320120000_contract_attachment.sql`:

```sql
-- Per-contract file attachments (PDF, images)
-- Platform-admin only — accessed via service_role (createAdminClient)

CREATE TABLE contract_attachment (
  attachment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID NOT NULL REFERENCES contract(contract_id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_size      INTEGER,
  display_order  SMALLINT DEFAULT 0,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_attachment ENABLE ROW LEVEL SECURITY;

-- No RLS policies — all access is service_role via createAdminClient()

CREATE TRIGGER set_updated_at BEFORE UPDATE ON contract_attachment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260320120000_contract_attachment.sql
```

Expected: `CREATE TABLE`, `ALTER TABLE`, `CREATE TRIGGER`

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Verify `contract_attachment` appears in the generated types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260320120000_contract_attachment.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add contract_attachment table for per-contract file uploads

Supports PDF, PNG, JPEG uploads per contract instance.
Cascade delete via contract_id FK. Platform-admin only (service_role).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Update Storage Bucket MIME Types

**Files:**

- Modify: `supabase/config.toml`

- [ ] **Step 1: Update MIME whitelist**

In `supabase/config.toml`, change line 119 from:

```toml
allowed_mime_types = ["application/pdf"]
```

to:

```toml
allowed_mime_types = ["application/pdf", "image/png", "image/jpeg"]
```

- [ ] **Step 2: Restart Supabase to pick up config change**

```bash
npx supabase stop && npx supabase start
```

- [ ] **Step 3: Commit**

```bash
git add supabase/config.toml
git commit -m "feat(storage): expand contract-attachments bucket to accept PNG and JPEG

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Telemetry Events for Attachments

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add entity type**

In `packages/telemetry/src/registry.ts`, find the `EntityType` union (around line 37-66). Add `"contract_attachment"` after `"contract_template"`:

```ts
  | "contract_template"
  | "contract_attachment"
```

- [ ] **Step 2: Add event types to the SmartoutEvent union**

Find the `SmartoutEvent` discriminated union type (search for `type SmartoutEvent =`). This is a large union of `{ event: "..."; properties: {...} }` types. Find the contract section (after `"contract expired"`), and add:

```ts
  | {
      event: "contract attachment uploaded";
      properties: {
        entity: EntityRef;
        data: { contract_id: string; mime_type: string; file_size: number };
      };
    }
  | {
      event: "contract attachment deleted";
      properties: {
        entity: EntityRef;
        data: { contract_id: string };
      };
    }
```

- [ ] **Step 3: Add routing metadata**

Find the registry object (around line 945-971). After `"contract expired"`, add:

```ts
  "contract attachment uploaded": {
    destinations: ["logger", "activity_trail"],
    category: "contracts",
  },
  "contract attachment deleted": {
    destinations: ["logger", "activity_trail"],
    category: "contracts",
  },
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @smartout/telemetry typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add contract attachment uploaded/deleted events

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Attachment API Routes (GET + POST + DELETE)

**Files:**

- Create: `apps/web/src/app/api/platform-admin/contracts/[id]/attachments/route.ts`
- Create: `apps/web/src/app/api/platform-admin/contracts/[id]/attachments/[attachmentId]/route.ts`

- [ ] **Step 1: Create GET + POST route**

Create `apps/web/src/app/api/platform-admin/contracts/[id]/attachments/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { emit } from "@smartout/telemetry";
import { randomUUID } from "crypto";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("contract_attachment")
    .select("attachment_id, filename, mime_type, file_size, display_order, created_at")
    .eq("contract_id", id)
    .order("display_order")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: contractId } = await params;
  const admin = createAdminClient();

  // Verify contract exists and is draft
  const { data: contract } = await admin
    .from("contract")
    .select("contract_id, status, workspace_id")
    .eq("contract_id", contractId)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "draft") {
    return NextResponse.json(
      { error: "Can only add attachments to draft contracts" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const displayOrder = parseInt(formData.get("display_order") as string, 10) || 0;
  const attachmentId = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `contracts/${contractId}/${attachmentId}_${safeName}`;

  // Upload to Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("contract-attachments")
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Insert DB record
  const { data: attachment, error: insertError } = await admin
    .from("contract_attachment")
    .insert({
      attachment_id: attachmentId,
      contract_id: contractId,
      filename: file.name,
      mime_type: file.type,
      storage_path: storagePath,
      file_size: file.size,
      display_order: displayOrder,
      created_by: adminId,
    })
    .select()
    .single();

  if (insertError) {
    // Rollback storage upload on DB failure
    await admin.storage.from("contract-attachments").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  void emit({
    event: "contract attachment uploaded",
    workspace_id: contract.workspace_id ?? "",
    actor_id: adminId,
    properties: {
      entity: {
        entity_type: "contract_attachment",
        entity_id: attachmentId,
        entity_label: file.name,
      },
      data: { contract_id: contractId, mime_type: file.type, file_size: file.size },
    },
  });

  return NextResponse.json({ data: attachment }, { status: 201 });
}
```

- [ ] **Step 2: Create DELETE route**

Create `apps/web/src/app/api/platform-admin/contracts/[id]/attachments/[attachmentId]/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { emit } from "@smartout/telemetry";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: contractId, attachmentId } = await params;
  const admin = createAdminClient();

  // Verify contract is draft
  const { data: contract } = await admin
    .from("contract")
    .select("contract_id, status, workspace_id")
    .eq("contract_id", contractId)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "draft") {
    return NextResponse.json(
      { error: "Can only delete attachments from draft contracts" },
      { status: 400 },
    );
  }

  // Fetch attachment to get storage path
  const { data: attachment } = await admin
    .from("contract_attachment")
    .select("attachment_id, filename, storage_path")
    .eq("attachment_id", attachmentId)
    .eq("contract_id", contractId)
    .single();

  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  // Delete from Storage + DB
  await admin.storage.from("contract-attachments").remove([attachment.storage_path]);

  const { error: deleteError } = await admin
    .from("contract_attachment")
    .delete()
    .eq("attachment_id", attachmentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  void emit({
    event: "contract attachment deleted",
    workspace_id: contract.workspace_id ?? "",
    actor_id: adminId,
    properties: {
      entity: {
        entity_type: "contract_attachment",
        entity_id: attachmentId,
        entity_label: attachment.filename,
      },
      data: { contract_id: contractId },
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/platform-admin/contracts/\[id\]/attachments/
git commit -m "feat(contracts): add attachment upload/delete API routes

GET/POST at /api/platform-admin/contracts/[id]/attachments
DELETE at /api/platform-admin/contracts/[id]/attachments/[attachmentId]
Platform-admin only. Draft-only mutation guard. Telemetry emit on success.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Attachment UI in Contract Editor

**Files:**

- Modify: `apps/web/src/app/platform-admin/contracts/[id]/page.tsx`
- Modify: `apps/web/src/app/platform-admin/contracts/[id]/contract-editor.tsx`

- [ ] **Step 1: Fetch attachments in server component**

In `apps/web/src/app/platform-admin/contracts/[id]/page.tsx`, add to the `Promise.all` array (after remindersResult):

```ts
    admin
      .from("contract_attachment")
      .select("attachment_id, filename, mime_type, file_size, display_order, created_at")
      .eq("contract_id", id)
      .order("display_order")
      .order("created_at"),
```

Destructure the result:

```ts
  const [contractResult, eventsResult, remindersResult, attachmentsResult] = await Promise.all([...]);
```

Pass to ContractEditor:

```ts
      fileAttachments={
        (attachmentsResult.data ?? []) as Array<{
          attachment_id: string;
          filename: string;
          mime_type: string;
          file_size: number;
          display_order: number;
          created_at: string;
        }>
      }
```

- [ ] **Step 2: Add attachment types and props to contract-editor.tsx**

Read the file first. Add to the Props type:

```ts
type FileAttachment = {
  attachment_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  display_order: number;
  created_at: string;
};
```

Add to Props:

```ts
  fileAttachments: FileAttachment[];
```

- [ ] **Step 3: Add attachment UI section**

In the ContractEditor component, after the template attachments section (around line 545), add a new collapsible for per-contract file attachments:

```tsx
{
  /* Per-contract file attachments */
}
<Collapsible>
  <CollapsibleTrigger asChild>
    <button
      type="button"
      className="border-border hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors"
    >
      <FileText className="text-muted-foreground h-4 w-4" />
      <span className="flex-1">Bilagor</span>
      <span className="text-muted-foreground text-xs">{uploadedFiles.length}</span>
      <ChevronRight className="text-muted-foreground h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
    </button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="border-border space-y-2 rounded-b-lg border border-t-0 px-4 py-3">
      {isDraft && (
        <label className="border-border hover:bg-muted/30 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm transition-colors">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {uploading ? (
            <span className="text-muted-foreground">Laster opp...</span>
          ) : (
            <span className="text-muted-foreground">Klikk for a laste opp fil</span>
          )}
        </label>
      )}
      {uploadedFiles.map((f) => (
        <div key={f.attachment_id} className="flex items-center gap-3 text-sm">
          <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{f.filename}</span>
          <span className="text-muted-foreground text-xs">
            {f.file_size ? `${(f.file_size / 1024).toFixed(0)} KB` : ""}
          </span>
          {isDraft && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleDeleteAttachment(f.attachment_id)}
            >
              <span className="text-xs text-red-400">✕</span>
            </Button>
          )}
        </div>
      ))}
      {uploadedFiles.length === 0 && !isDraft && (
        <p className="text-muted-foreground text-xs">Ingen bilagor</p>
      )}
    </div>
  </CollapsibleContent>
</Collapsible>;
```

- [ ] **Step 4: Add upload/delete state and handlers**

Inside the ContractEditor component, add state and handlers:

```tsx
const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>(fileAttachments);
const [uploading, setUploading] = useState(false);

async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setUploading(true);
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/platform-admin/contracts/${contract.contract_id}/attachments`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Upload feilet");
    }
    const { data } = await res.json();
    setUploadedFiles((prev) => [...prev, data]);
    toast.success("Fil lastet opp");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Noe gikk galt");
  } finally {
    setUploading(false);
    e.target.value = "";
  }
}

async function handleDeleteAttachment(attachmentId: string) {
  try {
    const res = await fetch(
      `/api/platform-admin/contracts/${contract.contract_id}/attachments/${attachmentId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Sletting feilet");
    }
    setUploadedFiles((prev) => prev.filter((f) => f.attachment_id !== attachmentId));
    toast.success("Fil slettet");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Noe gikk galt");
  }
}
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 6: Manual test**

1. Open `http://localhost:3060/platform-admin/contracts` and navigate to a draft contract
2. Verify "Bilagor" section appears
3. Upload a PDF — verify it appears in the list
4. Delete the attachment — verify it disappears
5. Navigate to a non-draft contract — verify upload/delete buttons are hidden

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/platform-admin/contracts/\[id\]/page.tsx apps/web/src/app/platform-admin/contracts/\[id\]/contract-editor.tsx
git commit -m "feat(contracts): add per-contract file attachment UI

Upload/delete files on draft contracts. Collapsible section in
contract editor. Supports PDF, PNG, JPEG.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: All packages pass with 0 errors

- [ ] **Step 2: Lint check**

Run: `pnpm lint`
Expected: No new errors

- [ ] **Step 3: Test placeholder resolution manually**

1. Create a new contract via platform-admin for a company with org_number set
2. Open the contract detail page
3. Expand "Kontraktsdata" — verify `kunde_org_nr`, `kunde_firma`, `kunde_daglig_leder` are pre-filled
4. Check the contract HTML preview — verify placeholders are resolved (no `{{...}}` visible)

- [ ] **Step 4: Test attachment upload manually**

1. On the same draft contract, upload a PDF
2. Upload a PNG image
3. Verify both appear in "Bilagor" section
4. Delete one — verify it's removed
5. Send the contract (if contract-service is running) — verify send still works

- [ ] **Step 5: Verify no regression on existing contracts**

1. Open an existing sent/signed contract
2. Verify it still displays correctly
3. Verify "Bilagor" section shows "Ingen bilagor" (read-only)
