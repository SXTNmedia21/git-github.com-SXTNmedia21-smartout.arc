---
title: "Journey — Contract Preview Editor"
status: verified
updated: 2026-04-22
created: 2026-04-09
module: contracts
tags: [contracts, preview, tiptap, composition-drawer]
verified_by: council-gate-3 2026-04-22
verified_note: Preview editor lives in step 4 (Bekreft) of the unified CompositionDrawer. E2E spec exists (apps/e2e/tests/contracts/preview-editor.spec.ts).
---

# Journey: Contract Preview Editor

> **Redesign note (2026-04-22):** Preview is now step 4 (Bekreft) inside the unified `CompositionDrawer`, not a separate `ContractSendDrawer` launched from People. The 5 drawer steps are Ansatt (1) → Stilling (2) → Gjennomgang (3) → Bekreft (4) → Send (5); the Tiptap preview renders in Bekreft after data is resolved in Gjennomgang. Entry points are the `Kontrakter` tab hub CTA, the `Maler` tab bulk-send flow, and the employee detail reverse-flow button. Preview behavior below is unchanged; only the surrounding navigation changed.

## Journey: Admin Sends Contract with Preview

**Precondition:** Admin is on `/dashboard/contracts` hub OR on an employee detail page, employee has a profile with email.

1. Admin clicks "Lag kontrakt" on the `Kontrakter` tab (or "Send kontrakt" reverse-flow button on `/dashboard/employees/[id]`)
   -> System opens `CompositionDrawer` (Sheet, 640px, glass surface)
   -> Step indicator shows: Ansatt > Stilling > Gjennomgang > Bekreft > Send

2. Admin selects a contract template
   -> System fetches templates from /api/contracts/templates
   -> Cards or radio list displayed based on template count
   -> Admin clicks a template card

3. Admin clicks "Neste: gjennomga data"
   -> System fetches resolved placeholder values from profile/contract/workspace
   -> Step transitions to "Data" with pre-filled fields
   -> Admin reviews and optionally overrides values

4. Admin clicks "Neste: forhandsvisning"
   -> System fetches template content_html from /api/contracts/templates/[id]
   -> Admin role verified server-side (403 if not admin/owner)
   -> Placeholders resolved using canonical @smartout/utils (both {{key}} and Tiptap spans)
   -> Tiptap editor renders the full contract document

5. Admin reviews the rendered contract
   -> Preview toolbar shows text formatting only (bold, italic, underline, headings, lists, undo/redo)
   -> Section/field insertion dropdowns are hidden (mode="preview")
   -> Admin can edit text directly if needed

6. If admin edits the document:
   -> "Redigert" badge appears in step header
   -> editedHtmlRef tracks the current HTML

7. Admin clicks "Send kontrakt"
   -> Confirmation dialog appears
   -> If document was edited, warning shown: "Du har gjort endringer i dokumentet."
   -> Admin confirms

8. System creates contract:
   -> POST /api/contracts with resolved_html override (sanitized server-side with sanitize-html)
   -> was_edited: true/false logged in telemetry event
   -> Contract draft created in Supabase
   -> DocuSeal signing triggered
   -> Toast: "Kontrakt sendt til [name]"
   -> Drawer closes

**Postcondition:** Contract created with status "draft", signing envelope dispatched, employee receives email.

## Error Paths

### Template fetch fails
- Step 1: "Kunne ikke laste maler" error shown
- Admin can retry by closing and reopening drawer

### Preview content fetch fails
- Step 4: Toast error "Kunne ikke laste forhandsvisning"
- Admin stays on Data step, can retry

### Employee has no email
- Step 8: API returns 400 "Employee has no email address"
- Toast error shown, drawer stays open

### Contract creation fails
- Step 8: Toast error with server message
- Admin can retry sending

### Employee is not admin/owner
- Step 4: Template content endpoint returns 403
- Preview cannot load (should not happen — drawer only accessible to admins)

## Journey: Admin Reviews Without Editing

**Precondition:** Same as above.

1-4. Same as above
5. Admin reads the document, verifies all values are correct
6. Admin clicks "Send kontrakt" directly (no edits)
   -> No "Redigert" badge shown
   -> Confirmation dialog has no edit warning
   -> was_edited: false in telemetry

**Postcondition:** Contract sent with server-resolved HTML (identical to template + placeholders).

## Journey: Admin Goes Back to Fix Data

**Precondition:** Admin is on Bekreft step (preview) and notices wrong data rendered in the document.

1. Admin clicks "Tilbake"
   -> Returns to Gjennomgang (Data) step
   -> Field values preserved (overrides state maintained)
2. Admin corrects a field value
3. Admin clicks "Neste: forhandsvisning" again
   -> Template re-fetched, placeholders re-resolved with new values
   -> Previous edits to document text are lost (fresh resolution)
   -> isDocumentEdited reset to false

**Postcondition:** Preview shows updated values, previous text edits discarded.
