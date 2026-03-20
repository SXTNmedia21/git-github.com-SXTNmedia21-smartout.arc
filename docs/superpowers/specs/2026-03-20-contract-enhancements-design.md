---
title: "Design: Contract Enhancements — Placeholder Resolve + Per-Contract Attachments + DocuSeal Delivery"
status: review
updated: 2026-03-20
created: 2026-03-20
module: contracts
tags: [contract, placeholder, attachment, docuseal, platform-admin]
---

# Design: Contract Enhancements

## Problem Statement

Three gaps in the contract system:

1. **Placeholders not resolved at creation via platform-admin.** The Next.js API route (`POST /api/platform-admin/contracts`) stores raw template HTML without resolving `{{kunde_org_nr}}`, `{{kunde_navn}}`, etc. The contract-service microservice resolves correctly, but platform-admin bypasses it.

2. **No per-contract file attachments.** Attachments exist only on templates (JSONB HTML). Users need to attach custom files (PDF roadmaps, onboarding instructions) to individual contracts.

3. **Template attachments never delivered via DocuSeal.** The send flow creates a DocuSeal template from HTML but ignores the template's attachment array entirely. Recipients never see them.

### Additional Bug

`services/contract-service/src/lib/placeholders.ts:90` maps `kunde_daglig_leder` to `company.contact_name`, but the column is `daglig_leder` on the company table. This placeholder has never worked.

---

## Scope

| Del | Description                                                                       | Risk   | Dependency                                             |
| --- | --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| 1   | Shared placeholder utility + fix Next.js route + field name bug                   | Low    | None                                                   |
| 2   | `contract_attachment` table + upload UI + API routes                              | Low    | None (independent from Del 1)                          |
| 3   | DocuSeal delivery rewrite: `createSubmissionFromHtml` with multi-document support | Medium | Del 1 (placeholder utils) + Del 2 (attachment storage) |

Del 1 + 2 can be implemented in the same branch. Del 3 in separate branch with manual DocuSeal testing.

---

## Del 1: Shared Placeholder Resolution

### Current State

Two creation paths exist:

| Path                       | File                                                     | Resolves placeholders?            |
| -------------------------- | -------------------------------------------------------- | --------------------------------- |
| Platform-admin (Next.js)   | `apps/web/src/app/api/platform-admin/contracts/route.ts` | No — stores raw HTML              |
| Contract-service (Fastify) | `services/contract-service/src/routes/contracts.ts`      | Yes — calls `resolvePlaceholders` |

### Design

**New shared utility:** `packages/utils/src/contract-placeholders.ts`

Extract from `services/contract-service/src/lib/placeholders.ts`:

- `buildAutofillMap(workspace, company)` — pure function, takes data as arguments (no DB dependency)
- `resolvePlaceholders(html, placeholders, autofillMap, overrides)` — pure function, string replacement only
- `escapeRegex(str)` and `escapeReplace(str)` — helpers

The DB-fetching stays in the caller. Each creation path fetches workspace + company data and passes it to the pure functions.

**Contract-service refactor:**

- Import from `@smartout/utils` instead of local `./lib/placeholders.ts`
- Remove local file after migration
- DB fetch stays in route handler

**Next.js API route fix (`apps/web/src/app/api/platform-admin/contracts/route.ts`):**

- After fetching template, also fetch workspace + company data
- Call `resolvePlaceholders` before INSERT
- Store both `resolved_html` and `resolved_values` on contract

**Bug fix:**

- `company.contact_name` → `company.daglig_leder` in `buildAutofillMap`

### Files Changed

| File                                                     | Action                                                 |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `packages/utils/src/contract-placeholders.ts`            | Create — shared pure functions                         |
| `packages/utils/src/index.ts`                            | Add `export * from "./contract-placeholders"`          |
| `packages/utils/package.json`                            | No change expected (already a package)                 |
| `services/contract-service/src/lib/placeholders.ts`      | Refactor — import from shared, remove duplicated logic |
| `services/contract-service/src/routes/contracts.ts`      | Update import path                                     |
| `apps/web/src/app/api/platform-admin/contracts/route.ts` | Add workspace/company fetch + resolve call             |

---

## Del 2: Per-Contract File Attachments

### Schema

```sql
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

-- Platform-admin only (no workspace_id, accessed via service_role)
-- No RLS policies needed — all access is service_role via createAdminClient()

CREATE TRIGGER set_updated_at BEFORE UPDATE ON contract_attachment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- No `workspace_id` — ownership cascades through `contract_id`
- Cascade delete: removing a contract removes all attachments
- Storage: reuse existing `contract-attachments` bucket in Supabase Storage

### Storage

Bucket `contract-attachments` already exists in `supabase/config.toml`:

- Private (not public)
- 10MB file size limit
- Currently PDF-only MIME restriction

**Change needed:** Update MIME whitelist to include PDF + PNG + JPEG:

```toml
[storage.buckets.contract-attachments]
allowed_mime_types = ["application/pdf", "image/png", "image/jpeg"]
```

**Path convention:** `contracts/{contract_id}/{attachment_id}_{safe_filename}`

### API Routes

All under `/api/platform-admin/contracts/[id]/attachments/`:

**Permission check:** All routes call `getSuperAdminId()` first — returns 403 if not platform admin. Same pattern as existing contract routes.

**`GET`** — List attachments for a contract

- Returns array of `{ attachment_id, filename, mime_type, file_size, display_order, created_at }`

**`POST`** — Upload attachment (multipart/form-data)

- Accepts file + optional `display_order`
- Uploads to Storage, inserts row in `contract_attachment`
- Returns created attachment record

**`DELETE`** (with `attachmentId` param) — Remove attachment

- Deletes from Storage + DB
- Only allowed in draft status

### UI: Contract Detail Page

New collapsible section in `contract-editor.tsx`, placed after the template attachments section:

```
[Bilagor] (collapsible)
  ┌──────────────────────────────────────────┐
  │ [Drop files here or click to upload]     │
  │                                          │
  │ roadmap-medium.pdf          2.1 MB  [x]  │
  │ onboarding-instruktioner.pdf 840 KB [x]  │
  └──────────────────────────────────────────┘
```

- Drag-and-drop or click-to-select
- Shows filename, size, delete button
- Upload/delete disabled when contract is not draft
- Separate from template attachments (which are read-only HTML)

### Files Changed

| File                                                                                     | Action                   |
| ---------------------------------------------------------------------------------------- | ------------------------ |
| `supabase/migrations/YYYYMMDDHHMMSS_contract_attachment.sql`                             | Create — table + trigger |
| `supabase/config.toml`                                                                   | Update — MIME whitelist  |
| `apps/web/src/app/api/platform-admin/contracts/[id]/attachments/route.ts`                | Create — GET + POST      |
| `apps/web/src/app/api/platform-admin/contracts/[id]/attachments/[attachmentId]/route.ts` | Create — DELETE          |
| `apps/web/src/app/platform-admin/contracts/[id]/contract-editor.tsx`                     | Add attachments section  |
| `apps/web/src/app/platform-admin/contracts/[id]/page.tsx`                                | Fetch + pass attachments |

---

## Del 3: DocuSeal Multi-Document Delivery

### Current Flow (broken for attachments)

```
1. Resolve placeholders
2. Build fullHtml (contract body + header/footer + CSS)
3. createTemplateFromHtml({ html: fullHtml })     ← single HTML, no attachments
4. createSubmission({ template_id, submitters })   ← two API calls
```

Template-level attachments (JSONB HTML on contract_template) and per-contract file attachments are both ignored.

### New Flow

Switch from `createTemplateFromHtml` + `createSubmission` to `createSubmissionFromHtml` (single API call, supports multiple documents):

```
1. Resolve placeholders (unchanged)
2. Build fullHtml (unchanged)
3. Fetch template attachments (JSONB HTML) → convert to document entries
4. Fetch contract_attachment rows → download files from Storage → base64
5. createSubmissionFromHtml({
     documents: [
       { name: "Kontrakt", html: fullHtml },
       { name: "Vedlegg 1 - Prisliste", html: templateAttachment1Html },
       { name: "Roadmap", file: base64Pdf }     // per-contract attachment
     ],
     submitters: [
       { role: "Leverandor", email: senderEmail, completed: true },
       { role: "Kunde", email: recipientEmail }
     ],
     send_email: true,
     completed_redirect_url: "..."
   })
```

### DocuSeal API Support

Verified against `@docuseal/api@1.0.21`:

| Method                     | Multi-document      | Supports PDF | Supports HTML |
| -------------------------- | ------------------- | ------------ | ------------- |
| `createTemplateFromHtml`   | No                  | No           | Yes (single)  |
| `createSubmissionFromHtml` | Yes (`documents[]`) | No           | Yes           |
| `createSubmissionFromPdf`  | Yes (`documents[]`) | Yes          | No            |

**Challenge:** `createSubmissionFromHtml` supports HTML documents but not PDF. For PDF attachments, we may need to either:

- Convert PDF to base64 and use `createSubmissionFromPdf` with all documents as PDF (render contract HTML to PDF first)
- Use a hybrid approach: HTML contract via `createSubmissionFromHtml` + separate PDF download links

**Recommended approach:** Start with `createSubmissionFromHtml` for contract + HTML template attachments. PDF per-contract attachments rendered as a final HTML page with download links (Storage signed URLs, 7-day expiry). If DocuSeal later supports mixed document types in a single call, upgrade.

### Edge Case: Contract Without workspace_id

Platform-admin can create contracts without a workspace (e.g. pre-sales). In this case:

- Placeholder resolution skipped (no workspace/company to resolve from)
- `completed_redirect_url` falls back to `${APP_URL}/sign/success?token=${signingToken}` (no workspace slug)
- Attachments still work (they're per-contract, not per-workspace)

### Risk Mitigation

This change affects ALL contract sending. Safety measures:

- Implement in separate branch (`feat/docuseal-multi-doc`)
- Test with actual DocuSeal instance before merge
- Keep old send flow as fallback (feature flag or env var `DOCUSEAL_USE_MULTI_DOC=true`)
- Verify signing URL, redirect, and webhook behavior unchanged

### Files Changed

| File                                                | Action                              |
| --------------------------------------------------- | ----------------------------------- |
| `services/contract-service/src/routes/contracts.ts` | Rewrite send route                  |
| `services/contract-service/src/lib/docuseal.ts`     | Add helper for multi-doc submission |
| `services/contract-service/src/lib/supabase.ts`     | Add Storage download helper         |

---

## Sequencing

```
Del 1 (placeholder fix)  ──→  merge to development
         │
Del 2 (attachments)  ─────→  merge to development
         │
Del 3 (DocuSeal rewrite)  →  separate branch, manual test, then merge
```

Del 1 and Del 2 can be implemented in the same branch. Del 3 is independent and riskier — separate branch.

---

## Out of Scope

- Subscription editing on existing workspaces (separate feature)
- Lead management concept
- Onboarding package definition (what small/medium/large includes)
- Contract template editor changes
