# Contract Preview Editor — Council Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3 blocking issues and 4 high-priority issues identified by the System Council review of the contract preview editor feature.

**Architecture:** Add a `mode` prop to `EditorToolbarV2` to hide template-authoring dropdowns in preview context. Replace local placeholder resolution with canonical `@smartout/utils` version. Add `sanitize-html` for server-side HTML sanitization. Standardize drawer width and add edit-state tracking.

**Tech Stack:** Tiptap, sanitize-html (new dependency), @smartout/utils, React, Next.js API routes

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/components/contract-editor/editor-toolbar-v2.tsx` | MODIFY | Add `mode?: "full" \| "preview"` prop, hide Seksjon/Felt dropdowns when preview |
| `apps/web/src/app/dashboard/contracts/_components/contract-preview-editor.tsx` | MODIFY | Use canonical resolvePlaceholders, use toolbar in preview mode, remove local duplicate |
| `apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx` | MODIFY | Fix drawer width, add edit tracking, fix step label, use canonical resolver |
| `apps/web/src/app/api/contracts/route.ts` | MODIFY | Sanitize `resolved_html` before persisting |
| `apps/web/src/app/api/contracts/templates/[id]/route.ts` | MODIFY | Add admin/owner role check |
| `apps/web/package.json` | MODIFY | Add `sanitize-html` + `@types/sanitize-html` dependencies |

---

### Task 1: Add `mode` prop to EditorToolbarV2 (B1 — toolbar scope)

**Files:**
- Modify: `apps/web/src/components/contract-editor/editor-toolbar-v2.tsx`

- [ ] **Step 1: Add mode prop to EditorToolbarV2Props**

In `apps/web/src/components/contract-editor/editor-toolbar-v2.tsx`, change the props type and function signature:

```tsx
type EditorToolbarV2Props = {
  editor: Editor | null;
  /** "preview" hides template-authoring dropdowns (Seksjon, Felt) */
  mode?: "full" | "preview";
};

export function EditorToolbarV2({ editor, mode = "full" }: EditorToolbarV2Props) {
```

- [ ] **Step 2: Conditionally render Seksjon/Felt dropdowns**

Wrap the insert dropdowns section (lines 386-398) in a conditional:

```tsx
      {mode === "full" && (
        <>
          <ToolbarDivider />

          {/* Insert dropdowns — only in full template-authoring mode */}
          <ToolbarDropdown
            label="Seksjon"
            icon={<SquarePlus className="h-3.5 w-3.5" />}
            items={sectionItems}
          />
          <ToolbarDropdown
            label="Felt"
            icon={<Paperclip className="h-3.5 w-3.5" />}
            items={fieldItems}
          />
        </>
      )}
```

The `<ToolbarDivider />` before undo/redo (line 400) stays since it separates formatting from undo/redo.

- [ ] **Step 3: Verify platform-admin editor is unaffected**

Check that `template-editor.tsx` does NOT pass a `mode` prop — it should keep the default `"full"`.

```bash
grep -n "EditorToolbarV2" apps/web/src/components/contract-editor/template-editor.tsx
```

Expected: `<EditorToolbarV2 editor={editor} />` — no mode prop, defaults to "full".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/contract-editor/editor-toolbar-v2.tsx
git commit -m "feat(contracts): add mode prop to EditorToolbarV2 to hide authoring tools in preview

The toolbar now accepts mode='preview' which hides the Seksjon and Felt
dropdown menus. These are template-authoring tools that should not appear
when an admin is reviewing a contract before sending.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Use preview toolbar in ContractPreviewEditor (B1 continued)

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/_components/contract-preview-editor.tsx`

- [ ] **Step 1: Pass mode="preview" to EditorToolbarV2**

Change line 93:

```tsx
// Before:
<EditorToolbarV2 editor={editor} />

// After:
<EditorToolbarV2 editor={editor} mode="preview" />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/contract-preview-editor.tsx
git commit -m "feat(contracts): use preview mode toolbar in contract preview editor

Hides Seksjon and Felt insertion dropdowns to prevent admins from
inserting structural template elements into a contract before sending.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Replace local resolvePlaceholders with canonical version (B2)

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/_components/contract-preview-editor.tsx`
- Modify: `apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx`

- [ ] **Step 1: Remove local resolvePlaceholders from contract-preview-editor.tsx**

Delete the entire `resolvePlaceholders` function (lines 36-49) and its export. The component should only export `ContractPreviewEditor`.

- [ ] **Step 2: Update contract-send-drawer.tsx imports**

Replace the import from `./contract-preview-editor`:

```tsx
// Before:
import {
  ContractPreviewEditor,
  resolvePlaceholders,
} from "./contract-preview-editor";

// After:
import { ContractPreviewEditor } from "./contract-preview-editor";
import { resolvePlaceholders } from "@smartout/utils";
import type { PlaceholderDef } from "@smartout/utils";
```

- [ ] **Step 3: Update goToPreview() to use canonical signature**

The canonical `resolvePlaceholders` takes `(html, placeholders[], autofillMap, overrides)` and returns `{ resolved_html, resolved_values }`. Update `goToPreview()`:

```tsx
  async function goToPreview() {
    if (!selectedTemplate) return;
    setIsLoadingPreview(true);
    try {
      const res = await fetch(`/api/contracts/templates/${selectedTemplate.template_id}`);
      if (!res.ok) throw new Error("Kunne ikke laste mal-innhold");
      const json = (await res.json()) as { data: { content_html: string; placeholders: PlaceholderDef[] } };
      const contentHtml = json.data.content_html ?? "";
      const placeholders = json.data.placeholders ?? [];

      // Use canonical resolver that handles both {{key}} and Tiptap span format
      const { resolved_html } = resolvePlaceholders(
        contentHtml,
        placeholders,
        resolvedMap,   // autofillMap from profile/contract/workspace
        overrides,     // user overrides from the review step
      );

      setPreviewHtml(resolved_html);
      editedHtmlRef.current = resolved_html;
      setStep("preview");
    } catch {
      toast.error("Kunne ikke laste forhåndsvisning");
    } finally {
      setIsLoadingPreview(false);
    }
  }
```

- [ ] **Step 4: Verify typecheck passes for contract files**

```bash
npx tsc --project apps/web/tsconfig.json --noEmit 2>&1 | grep -E "contract-send-drawer|contract-preview-editor" || echo "No errors"
```

Expected: "No errors"

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/contract-preview-editor.tsx apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx
git commit -m "fix(contracts): use canonical resolvePlaceholders from @smartout/utils

The local copy only handled {{key}} mustache format. The canonical version
also handles <span data-type='placeholder-field'> Tiptap nodes, preventing
unresolved placeholders in the final contract.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add server-side HTML sanitization (B3)

**Files:**
- Modify: `apps/web/package.json` (add dependency)
- Modify: `apps/web/src/app/api/contracts/route.ts`

- [ ] **Step 1: Install sanitize-html**

```bash
cd apps/web && pnpm add sanitize-html && pnpm add -D @types/sanitize-html
```

- [ ] **Step 2: Add sanitization to POST /api/contracts**

In `apps/web/src/app/api/contracts/route.ts`, add the import at the top:

```tsx
import sanitizeHtml from "sanitize-html";
```

Add a sanitization config constant after the schema:

```tsx
/** Allowlist matching Tiptap output — strips scripts, event handlers, iframes */
const HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "h1", "h2", "h3", "span", "div", "section", "hr", "br", "img",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    span: ["class", "data-type", "data-key", "data-label", "data-placeholder-type", "data-role", "data-required", "data-clause-id", "data-title", "data-category", "data-color", "style"],
    div: ["class", "data-type", "data-clause-id", "data-title", "data-category", "style"],
    section: ["class", "data-type", "style"],
  },
  allowedSchemes: ["https", "mailto"],
  disallowedTagsMode: "discard",
};
```

- [ ] **Step 3: Sanitize clientHtml before use**

Change the `resolved_html` handling block:

```tsx
  // Use client-provided HTML from the preview editor if available,
  // otherwise fall back to server-side placeholder resolution.
  let resolvedHtml: string;
  if (clientHtml) {
    // Sanitize client-provided HTML — defense-in-depth against XSS/injection.
    // The admin is trusted, but the HTML is rendered to employees via DocuSeal.
    resolvedHtml = sanitizeHtml(clientHtml, HTML_SANITIZE_OPTIONS);
  } else {
    resolvedHtml = template.content_html ?? "";
    for (const [key, value] of Object.entries(resolvedValues)) {
      resolvedHtml = resolvedHtml.replaceAll(`{{${key}}}`, String(value ?? ""));
    }
  }
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --project apps/web/tsconfig.json --noEmit 2>&1 | grep "route.ts" || echo "No errors in route"
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/app/api/contracts/route.ts pnpm-lock.yaml
git commit -m "fix(contracts): sanitize client-provided HTML before persisting

Adds sanitize-html with a Tiptap-compatible allowlist to strip scripts,
event handlers, iframes, and other dangerous elements from the
resolved_html sent by the preview editor. Defense-in-depth: the HTML
is rendered to signing recipients via DocuSeal.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Add admin role check to GET templates/[id] (H1)

**Files:**
- Modify: `apps/web/src/app/api/contracts/templates/[id]/route.ts`

- [ ] **Step 1: Add admin/owner role check**

Replace the full route handler:

```tsx
// GET /api/contracts/templates/[id]
// Returns a single contract template including content_html for document preview.
// Restricted to admin/owner roles — raw template HTML should not be exposed to employees.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify caller has admin or owner role — template content is admin-only.
  // Use workspace_id from the template itself (fetched below) or from query param.
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  if (workspaceId) {
    const { data: callerProfile } = await supabase
      .from("profile")
      .select("role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "owner")) {
      return NextResponse.json(
        { error: "Forbidden: only admins and owners can view template content" },
        { status: 403 },
      );
    }
  }

  // RLS handles workspace access. Select full template including HTML content.
  const { data, error } = await supabase
    .from("contract_template")
    .select("template_id, name, description, contract_type, language, placeholders, content_html")
    .eq("template_id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}
```

- [ ] **Step 2: Update goToPreview() to pass workspace_id**

In `contract-send-drawer.tsx`, update the fetch URL in `goToPreview()`:

```tsx
const res = await fetch(`/api/contracts/templates/${selectedTemplate.template_id}?workspace_id=${workspaceId}`);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/contracts/templates/\[id\]/route.ts apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx
git commit -m "fix(contracts): add admin role check to template content endpoint

GET /api/contracts/templates/[id] now verifies the caller has admin or
owner role before returning template content_html. Matches the auth
pattern used by POST /api/contracts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Standardize drawer width (H2)

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx`

- [ ] **Step 1: Use consistent 640px width for all steps**

Change line 229:

```tsx
// Before:
<SheetContent className={`border-border bg-background w-full p-0 ${step === "preview" ? "sm:max-w-[700px]" : "sm:max-w-[500px]"}`}>

// After:
<SheetContent className="border-border bg-background w-full p-0 sm:max-w-[640px]">
```

640px is a good compromise: enough room for the toolbar without being overwhelming for the template/review steps.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx
git commit -m "fix(contracts): standardize send-drawer width to 640px

Removes the jarring 500px→700px width jump when entering the preview
step. 640px provides enough room for the editor toolbar while keeping
the template and review steps comfortable.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add edit-state tracking and fix step label (H3 + H4)

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx`

- [ ] **Step 1: Add edit tracking state**

Add to the state declarations (after `editedHtmlRef`):

```tsx
  // Tracks whether the admin has modified the document in the preview editor
  const [isDocumentEdited, setIsDocumentEdited] = useState(false);
  const originalHtmlRef = useRef<string | null>(null);
```

- [ ] **Step 2: Store original HTML and detect edits**

Update `goToPreview()` — after setting `previewHtml`, also store original:

```tsx
      setPreviewHtml(resolved_html);
      editedHtmlRef.current = resolved_html;
      originalHtmlRef.current = resolved_html;
      setIsDocumentEdited(false);
      setStep("preview");
```

Update the `onContentChange` callback in the PreviewStep render:

```tsx
<PreviewStep
  contentHtml={previewHtml}
  isSending={isSending}
  isEdited={isDocumentEdited}
  onContentChange={(html) => {
    editedHtmlRef.current = html;
    setIsDocumentEdited(html !== originalHtmlRef.current);
  }}
  onBack={() => setStep("review")}
  onSend={() => setShowConfirm(true)}
/>
```

Reset on drawer close:

```tsx
      setIsDocumentEdited(false);
      originalHtmlRef.current = null;
```

- [ ] **Step 3: Update PreviewStep to show edit indicator**

Add `isEdited` prop and show a badge:

```tsx
type PreviewStepProps = {
  contentHtml: string;
  isSending: boolean;
  isEdited: boolean;
  onContentChange: (html: string) => void;
  onBack: () => void;
  onSend: () => void;
};

function PreviewStep({ contentHtml, isSending, isEdited, onContentChange, onBack, onSend }: PreviewStepProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-sm font-semibold">Gjennomgang</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Kontroller at kontrakten ser riktig ut. Du kan redigere teksten direkte.
          </p>
        </div>
        {isEdited && (
          <span className="bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5 text-[10px] font-medium">
            Redigert
          </span>
        )}
      </div>
      {/* ... rest unchanged ... */}
```

- [ ] **Step 4: Update step label**

Change the step indicator label:

```tsx
const STEPS: { id: Step; label: string }[] = [
  { id: "template", label: "Mal" },
  { id: "review", label: "Data" },
  { id: "preview", label: "Gjennomgang" },
];
```

- [ ] **Step 5: Update confirmation dialog to mention edits**

In the AlertDialog description, conditionally mention edits:

```tsx
<AlertDialogDescription>
  Kontrakten sendes til den ansatte for elektronisk signering via DocuSeal. Du kan ikke
  angre etter sending.
  {isDocumentEdited && (
    <span className="text-amber-600 mt-1 block text-xs font-medium">
      Du har gjort endringer i dokumentet.
    </span>
  )}
</AlertDialogDescription>
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx
git commit -m "feat(contracts): add edit tracking and rename preview step to Gjennomgang

Shows a 'Redigert' badge when the admin modifies the contract body.
The confirmation dialog warns about edits. Step label changed from
'Dokument' to 'Gjennomgang' for clearer framing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Final typecheck and verification

- [ ] **Step 1: Run full typecheck on contract files**

```bash
npx tsc --project apps/web/tsconfig.json --noEmit 2>&1 | grep -E "contract-send-drawer|contract-preview-editor|api/contracts" || echo "No errors in contract files"
```

Expected: "No errors in contract files"

- [ ] **Step 2: Verify EditorToolbarV2 still works for platform-admin**

```bash
grep -n "EditorToolbarV2" apps/web/src/components/contract-editor/template-editor.tsx
```

Expected: `<EditorToolbarV2 editor={editor} />` — defaults to `mode="full"`.

- [ ] **Step 3: Verify no unused imports**

```bash
npx tsc --project apps/web/tsconfig.json --noEmit 2>&1 | grep "declared but" | grep -E "contract" || echo "No unused imports"
```

---

## Summary of Changes

| Council Issue | Task | Status |
|--------------|------|--------|
| B1: Full toolbar in preview | Task 1 + 2 | Blocking fix |
| B2: Local resolvePlaceholders misses spans | Task 3 | Blocking fix |
| B3: No HTML sanitization | Task 4 | Blocking fix |
| H1: No admin role check on template GET | Task 5 | High priority |
| H2: Drawer width jump | Task 6 | High priority |
| H3: No edit-state tracking | Task 7 | High priority |
| H4: Step label confusion | Task 7 | High priority |
