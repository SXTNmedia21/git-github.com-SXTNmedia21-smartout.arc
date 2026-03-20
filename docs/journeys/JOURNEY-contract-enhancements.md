---
title: "User Journeys — contract-enhancements"
status: done
updated: 2026-03-20
created: 2026-03-20
module: contracts
tags: [journey, contract, placeholder, attachment]
---

# User Journeys — Contract Enhancements

## Journey: Platform Admin Creates Contract with Auto-Resolved Placeholders

**Precondition:** Admin is logged in with godmode. A contract template with placeholders (`{{kunde_org_nr}}`, `{{kunde_firma}}`, etc.) exists. Target company has a workspace with company data filled in.

1. Admin navigates to `/platform-admin/contracts` → System shows contract list
2. Admin clicks "Ny kontrakt" → System shows creation form
3. Admin selects template, company, workspace, enters recipient name/email → System validates input
4. Admin submits the form → System fetches workspace + company data, calls `buildAutofillMap` + `resolvePlaceholders`, stores resolved HTML and values, creates contract as draft
5. Admin is redirected to contract detail page → System shows resolved contract with all `{{...}}` placeholders replaced with actual values
6. Admin expands "Kontraktsdata" section → System shows resolved values (kunde_org_nr, kunde_firma, kunde_daglig_leder, etc.)

**Postcondition:** Contract created with all placeholders auto-filled. No manual editing needed for standard fields.

**Error paths:**

- Template not found → 404 error
- Workspace has no company data → Placeholders left empty (graceful degradation)
- Contract without workspace_id → Placeholder resolution skipped entirely, raw template stored

---

## Journey: Platform Admin Uploads File Attachment to Draft Contract

**Precondition:** Admin is on a draft contract detail page. The "Bilagor" collapsible section is visible.

1. Admin expands "Bilagor" section → System shows upload area + existing attachments (if any)
2. Admin clicks the dashed upload zone → System opens file picker (PDF, PNG, JPEG allowed)
3. Admin selects a file → System shows "Laster opp..." indicator
4. System uploads file to Supabase Storage → System inserts `contract_attachment` row → System emits `contract attachment uploaded` telemetry
5. File appears in the attachment list with filename + file size → Toast: "Fil lastet opp"

**Postcondition:** File stored in `contract-attachments` bucket, row in `contract_attachment` table, visible in UI.

**Error paths:**

- File type not allowed (bucket rejects) → Error toast with Storage error message
- Contract is not draft → Upload zone hidden, no mutation possible
- DB insert fails after upload → Storage file rolled back (deleted), error toast shown

---

## Journey: Platform Admin Deletes File Attachment from Draft Contract

**Precondition:** Admin is on a draft contract with at least one file attachment.

1. Admin expands "Bilagor" section → System shows list of uploaded files
2. Admin clicks the ✕ button on an attachment → System sends DELETE request
3. System deletes file from Storage → System deletes `contract_attachment` row → System emits `contract attachment deleted` telemetry
4. Attachment disappears from the list → Toast: "Fil slettet"

**Postcondition:** File removed from Storage and database.

**Error paths:**

- Contract is not draft → Delete button hidden
- Attachment not found → 404 error
- Storage deletion fails → DB row still deleted (orphaned storage is acceptable)

---

## Journey: Platform Admin Views Non-Draft Contract Attachments (Read-Only)

**Precondition:** Admin is viewing a sent/signed/expired contract that has attachments.

1. Admin expands "Bilagor" section → System shows list of attachments (filename + size)
2. Upload zone is NOT shown (not draft) → Delete buttons are NOT shown
3. If no attachments exist → System shows "Ingen bilagor" text

**Postcondition:** Admin can see what was attached but cannot modify.
