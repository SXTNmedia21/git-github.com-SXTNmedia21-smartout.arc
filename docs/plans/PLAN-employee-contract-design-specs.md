---
title: "Design Specs — employee-contract fixes"
status: draft
updated: 2026-04-28
created: 2026-04-28
module: other
tags: [design, specs, contracts]
---

# Design Specs — employee-contract fixes

> Source: frontend-designer agent pass 2026-04-28. Audit pass 2026-04-28 found 6 gaps + 7 UX smells in `/dashboard/contracts/*`. This doc captures the agreed design for each fix shipping in this sub-sortie.

## Cross-cutting components (extract first)

All in `apps/web/src/components/`:

| Component | Used by |
|---|---|
| `DestructiveConfirmDialog.tsx` | Fix 4 (cancel) — wraps AlertDialog with destructive variant + loading + prevent-close-while-pending + error-banner slot |
| `MutationButton.tsx` | Generic submit button with pending state, icon swap, label swap |
| `MutationDropdownMenuItem.tsx` | Fix 7 — DropdownMenuItem with spinner + disabled + label swap on async |
| `UnsavedChangesGuard.tsx` | Fix 9 — AlertDialog interrupts onOpenChange when isDirty |
| `DisabledHintButton.tsx` | (later) wraps disabled Button with Tooltip |

## Fix 1 — MalerTab read-only

**File:** `apps/web/src/app/dashboard/contracts/_components/MalerTab.tsx:730`

**Decision:** Read-only at workspace level (matches "edit in admin" comment). Make read-only feel deliberate, not broken.

**Pattern:** Lock badge pill at top of editor pane. Replace edit toolbar with View / Copy / Open-in-admin button row. Tiptap `editable: false`.

**Component:**
```tsx
<TemplatePreviewPane>
  <PaneHeader> {/* sticky top */}
    <div>
      <h3 className="font-heading text-lg">{template.name}</h3>
      <p className="text-sm text-muted-foreground">{template.framework_name} • v{template.version}</p>
    </div>
    <Badge variant="outline" className="gap-1.5">
      <Lock className="size-3" /> {t("contracts.maler.readOnly")}
    </Badge>
  </PaneHeader>
  <PaneToolbar>
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copyState === "copying" ? <Loader2 className="size-4 animate-spin" /> :
       copyState === "success" ? <Check className="size-4" /> :
       <Copy className="size-4" />}
      {t("contracts.maler.copyHtml")}
    </Button>
    <Button variant="ghost" size="sm" asChild>
      <Link href={`/platform-admin/templates/${template.id}`} target="_blank">
        <ExternalLink className="size-4" /> {t("contracts.maler.openInAdmin")}
      </Link>
    </Button>
  </PaneToolbar>
  <ContractPreviewEditor content={template.content_html} mode="preview" onContentChange={undefined} />
  <PaneFooter>
    <p className="text-xs text-muted-foreground">{t("contracts.maler.readOnlyExplain")}</p>
  </PaneFooter>
</TemplatePreviewPane>
```

**i18n keys (NB / EN):**
- `contracts.maler.readOnly` — "Skrivebeskyttet" / "Read only"
- `contracts.maler.copyHtml` — "Kopier HTML" / "Copy HTML"
- `contracts.maler.openInAdmin` — "Åpne i admin" / "Open in admin"
- `contracts.maler.readOnlyExplain` — "Maler er skrivebeskyttet her. Rediger i platform admin for å endre masterkilden." / "Workspace templates are read-only here. Edit in platform admin to change the master template."
- `contracts.maler.copySuccess` / `contracts.maler.copyError`

**Telemetry:**
- `contracts.template.viewed` — `{ template_id, framework_id, version, has_drift }`
- `contracts.template.html_copied` — `{ template_id, source: "maler_tab" }`
- `contracts.template.opened_in_admin` — `{ template_id }`

**Side-fix:** Convert drift dot from `span[role=button]` to `<button>` (a11y).

---

## Fix 4 — Cancel contract confirmation

**Files:**
- `apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx:353` (dropdown)
- `apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx:475` (sheet detail)

**Pattern:** New `CancelContractDialog` component (uses `DestructiveConfirmDialog`). Both call sites delegate.

**State machine:**
- `idle` — closed
- `confirming` — open, "Behold kontrakt" focused (safe default)
- `pending` — destructive button spinner + "Avbryter...", AlertDialogCancel disabled, backdrop + escape disabled
- `success` — close, toast, table optimistic-invalidate
- `error` — stays open, inline error banner

**Component:**
```tsx
<AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
  <AlertDialogContent
    onPointerDownOutside={(e) => isPending && e.preventDefault()}
    onEscapeKeyDown={(e) => isPending && e.preventDefault()}
  >
    <AlertDialogHeader>
      <AlertDialogTitle className="font-heading">
        {t("contracts.cancel.title", { employee: contract.employee_name })}
      </AlertDialogTitle>
      <AlertDialogDescription>{t("contracts.cancel.body")}</AlertDialogDescription>
    </AlertDialogHeader>
    {error && (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="mr-2 inline size-4" /> {error.message}
      </div>
    )}
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isPending}>{t("contracts.cancel.keep")}</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        disabled={isPending}
        onClick={(e) => { e.preventDefault(); cancelMutation.mutate(); }}
      >
        {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {isPending ? t("contracts.cancel.pending") : t("contracts.cancel.confirm")}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**i18n keys (NB / EN):**
- `contracts.cancel.title` — "Avbryt kontrakt for {employee}?" / "Cancel contract for {employee}?"
- `contracts.cancel.body` — "Kontrakten blir markert som avbrutt. Ingen flere handlinger er mulige. Den ansatte varsles dersom den allerede er sendt. Loggføres." / "The contract will be marked cancelled. No further actions possible. The employee will be notified if it was already sent. Audit-trailed."
- `contracts.cancel.keep` — "Behold kontrakt" / "Keep contract"
- `contracts.cancel.confirm` — "Avbryt kontrakt" / "Cancel contract"
- `contracts.cancel.pending` — "Avbryter..." / "Cancelling..."
- `contracts.cancel.success` / `contracts.cancel.error`

**Telemetry:**
- `contracts.cancel.dialog_opened` — `{ contract_id, source: "table_dropdown" | "detail_sheet", contract_status }`
- `contracts.cancel.confirmed` — `{ contract_id, employee_id, was_sent: boolean }` (in onSuccess)
- `contracts.cancel.aborted` — `{ contract_id, reason: "user_cancelled" | "escape" }`
- `contracts.cancel.failed` — `{ contract_id, error_code }`

**New file:** `apps/web/src/app/dashboard/contracts/_components/CancelContractDialog.tsx`

---

## Fix 5 — CompositionDrawer manual edits plumbed through

**File:** `apps/web/src/app/dashboard/contracts/_components/CompositionDrawer.tsx:984` (`handleSubmit` in SendStep)

**Bug:** `state.editedHtml` set by BekreftStep editor onContentChange but `handleSubmit` ignores it — manual edits silently dropped.

**Fix:**
```tsx
const handleSubmit = () => {
  composeMutation.mutate({
    ...state,
    contract_html: state.editedHtml ?? state.generatedHtml,
    has_manual_edits: state.editedHtml !== undefined && state.editedHtml !== state.generatedHtml,
  });
};
```

**Plus** affordance in SendStep above recipient list:
```tsx
{hasManualEdits && (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
    <div className="rounded-full bg-primary/10 p-1.5">
      <Pencil className="size-3.5 text-primary" />
    </div>
    <div className="flex-1 text-sm">
      <p className="font-medium">{t("contracts.compose.manualEditsApplied")}</p>
      <p className="text-xs text-muted-foreground">{t("contracts.compose.manualEditsHint")}</p>
    </div>
    <Button variant="ghost" size="sm" onClick={handleRevert} disabled={isReverting}>
      <RotateCcw className="size-3.5" /> {t("contracts.compose.revertToGenerated")}
    </Button>
  </div>
)}
```

**Plus** strip debug `console.log` calls at L172, L185, L196, L208, L221, L938 (`[bekreft-render] HMR-MARKER-v2`, `[preview-hydrate] *`).

**i18n keys (NB / EN):**
- `contracts.compose.manualEditsApplied` — "Manuelle endringer brukt" / "Manual edits applied"
- `contracts.compose.manualEditsHint` — "Endringene dine overstyrer den genererte malen og sendes som de er." / "Your edits override the generated template. They'll be sent as-is."
- `contracts.compose.revertToGenerated` — "Gå tilbake til generert" / "Revert to generated"
- `contracts.compose.revertConfirm.title` / `body`

**Telemetry:**
- `contracts.compose.manual_edit_made` — `{ template_id, char_diff: number }` (once when first diverges)
- `contracts.compose.manual_edit_reverted` — `{ template_id }`
- `contracts.compose.submitted` — extend existing payload with `has_manual_edits: boolean`

**Backend dep:** API must accept `contract_html` override + `has_manual_edits` flag. Out of scope for this PR — flag and confirm with API owner before merging frontend changes.

**Edge case:** Template change clears `editedHtml`, toast warns "Mal endret — manuelle endringer fjernet".

---

## Fix 6 — contract-preview-editor enforces editable: false

**File:** `apps/web/src/app/dashboard/contracts/_components/contract-preview-editor.tsx:77`

**Bug:** `mode="preview"` only affects toolbar — Tiptap editor still editable.

**Fix:**
```tsx
const editor = useEditor({
  extensions: [...],
  content,
  editable: mode !== "preview",
  immediatelyRender: false,
  editorProps: {
    attributes: {
      class: cn(
        "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
        mode === "preview" && "cursor-default select-text caret-transparent",
        mode === "preview" && "bg-muted/20",
      ),
    },
  },
  onUpdate: mode === "preview" ? undefined : ({ editor }) => onContentChange?.(editor.getHTML()),
});

useEffect(() => {
  editor?.setEditable(mode !== "preview");
}, [editor, mode]);
```

No i18n. No telemetry.

---

## Fix 7 — Resend / Cancel loading states

**Files:** `contracts-data-table.tsx:347` (Resend), `:353` (Cancel)

**Pattern:** Replace inline `DropdownMenuItem` with `MutationDropdownMenuItem` wrapper.

```tsx
<MutationDropdownMenuItem
  icon={Send}
  label={t("contracts.actions.resend")}
  pendingLabel={t("contracts.actions.resending")}
  onMutate={() => resendMutation.mutateAsync(contract.id)}
/>
<MutationDropdownMenuItem
  icon={XCircle}
  label={t("contracts.actions.cancel")}
  pendingLabel={t("contracts.actions.cancelling")}
  onMutate={() => setCancelOpen(true)}
  destructive
/>
```

Wrapper internals:
```tsx
function MutationDropdownMenuItem({ icon: Icon, label, pendingLabel, onMutate, destructive }) {
  const [pending, setPending] = useState(false);
  return (
    <DropdownMenuItem
      disabled={pending}
      onSelect={async (e) => {
        e.preventDefault();
        setPending(true);
        try { await onMutate(); } finally { setPending(false); }
      }}
      className={destructive ? "text-destructive focus:text-destructive" : ""}
    >
      {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Icon className="mr-2 size-4" />}
      {pending ? pendingLabel : label}
    </DropdownMenuItem>
  );
}
```

**i18n keys (NB / EN):**
- `contracts.actions.resend` / `resending` — "Send på nytt" / "Sender..." / "Resend" / "Resending..."
- `contracts.actions.cancel` / `cancelling` — "Avbryt" / "Avbryter..." / "Cancel" / "Cancelling..."

**Telemetry:** Existing events keep payloads.

**New file:** `apps/web/src/components/MutationDropdownMenuItem.tsx`

---

## Fix 9 — UnsavedChangesGuard

**Files affected:**
- `apps/web/src/components/contracts/contract-send-drawer.tsx:115` (handleOpenChange reset)
- `apps/web/src/app/dashboard/contracts/_components/CompositionDrawer.tsx`
- `apps/web/src/components/contracts/BulkSendDrawer.tsx`

**Pattern:**
```tsx
const [guardOpen, setGuardOpen] = useState(false);
const handleDrawerClose = (open: boolean) => {
  if (!open && isDirty) { setGuardOpen(true); return; }
  if (!open) reset();
  setOpen(open);
};
```

**Component (extract):**
```tsx
// apps/web/src/components/UnsavedChangesGuard.tsx
type Props = {
  isDirty: boolean;
  onConfirmDiscard: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UnsavedChangesGuard({ isDirty, onConfirmDiscard, open, onOpenChange }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.unsaved.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("common.unsaved.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.unsaved.keep")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground"
            onClick={onConfirmDiscard}
          >
            {t("common.unsaved.discard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**i18n keys (NB / EN, file: common.json):**
- `common.unsaved.title` — "Forkast endringene?" / "Discard your changes?"
- `common.unsaved.body` — "Du har endringer som ikke er lagret. Lukker du, mistes de." / "You have unsaved changes. Closing will discard them."
- `common.unsaved.keep` — "Fortsett å redigere" / "Keep editing"
- `common.unsaved.discard` — "Forkast" / "Discard"

**Telemetry:**
- `forms.unsaved_guard.shown` — `{ form: "contract_send_drawer" | "composition_drawer" | "bulk_send_drawer" }`
- `forms.unsaved_guard.discarded` — `{ form }`
- `forms.unsaved_guard.kept` — `{ form }`

---

## Telemetry holes to plug (independent of fixes)

CLAUDE.md rule: "no mutation without `emit()`".

| Action | File:Line | What to emit |
|---|---|---|
| Template cloned (POST `/api/contract-templates/copy`) | `MalerTab.tsx:171` (clone success) | `contracts.template.cloned` `{ source_template_id, new_template_id }` |
| Resend | `contracts-data-table.tsx:219` | `contracts.resend.submitted` `{ contract_id, employee_id }` |
| Cancel (separate from Fix 4 dialog events) | `contracts-data-table.tsx:230` | covered by Fix 4 telemetry |
| Detail viewed | `contracts-data-table.tsx:215` | `contracts.detail.viewed` `{ contract_id, status }` |
| Bulk send submitted | `BulkSendDrawer.tsx:119` | `contracts.bulk.submitted` `{ template_id, recipient_count, success_count, fail_count }` |
| Composition drawer opened | `page.tsx:128` | `contracts.compose.opened` `{ source: "hub_cta" }` |
| Send in contract-send-drawer | `contract-send-drawer.tsx:197` | `contracts.send.submitted` `{ contract_id, template_id }` (raw fetch — replace with mutation hook + emit) |

## Critical bug — actor_id misuse

**File:** `apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts:97`

**Current:** `actor_id: nonEmpty(variables.profile_id, "actor_id")` — uses subject employee's profile_id.
**Should be:** `actor_id` = admin's profile_id from auth context (use `useProfileContext()` or equivalent).

Audit-trail attribution is wrong on every compose mutation until fixed. Routes engine_event to wrong workspace_id consumer too if subject is cross-workspace (rare but possible).
