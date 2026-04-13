"use client";

/**
 * ContractSendDrawer — right-side Sheet for sending employee contracts.
 *
 * Three-step flow in one scrollable surface:
 *   1. Template selection — fetches from /api/contracts/templates
 *   2. Employee data review — shows auto-filled placeholders, allows overrides
 *   3. Preview & send — summary + confirmation dialog before sending
 *
 * On success: toasts, closes drawer, calls onSuccess callback.
 */

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, FileText, Loader2, Send } from "lucide-react";
import { useTranslation } from "@smartout/i18n";

import { ContractPreviewEditor } from "./contract-preview-editor";
import { resolvePlaceholders } from "@smartout/utils";
import type { PlaceholderDef } from "@smartout/utils";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────

type ContractSendDrawerProps = {
  profileId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

type ContractTemplate = {
  template_id: string;
  name: string;
  description?: string;
  placeholders: PlaceholderField[];
};

type PlaceholderField = {
  key: string;
  label: string;
  value: string;
  // Where the value came from — shown as muted hint to the user
  source?: "Fra profil" | "Fra arbeidsavtale" | "Manuelt";
  editable: boolean;
};

// Three steps in the send flow
type Step = "template" | "review" | "preview";

// ── Component ─────────────────────────────────────────────────

export function ContractSendDrawer({
  profileId,
  workspaceId,
  open,
  onOpenChange,
  onSuccess,
}: ContractSendDrawerProps) {
  const { t } = useTranslation("contracts");
  const [step, setStep] = useState<Step>("template");
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  // User overrides for placeholder fields — key -> value
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // Pre-resolved values from profile/contract/workspace
  const [resolvedMap, setResolvedMap] = useState<Record<string, string>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Template HTML fetched when entering preview step
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  // Tracks the admin's edits in the Tiptap editor
  const editedHtmlRef = useRef<string | null>(null);
  // Tracks whether the admin has modified the document in the preview editor
  const [isDocumentEdited, setIsDocumentEdited] = useState(false);
  const originalHtmlRef = useRef<string | null>(null);

  // Reset all local state when drawer closes
  function handleOpenChange(next: boolean) {
    if (!next) {
      setStep("template");
      setSelectedTemplate(null);
      setOverrides({});
      setResolvedMap({});
      setShowConfirm(false);
      setPreviewHtml(null);
      editedHtmlRef.current = null;
      setIsDocumentEdited(false);
      originalHtmlRef.current = null;
    }
    onOpenChange(next);
  }

  // Fetch resolved placeholder values from profile/contract/workspace,
  // then transition to the review step with pre-filled data.
  async function goToReview() {
    setIsResolving(true);
    try {
      const res = await fetch("/api/contracts/resolve-placeholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, workspace_id: workspaceId }),
      });
      if (res.ok) {
        const map = (await res.json()) as Record<string, string>;
        setResolvedMap(map);
      }
    } catch {
      // Non-blocking — fields will show as empty and admin can fill manually
    } finally {
      setIsResolving(false);
      setStep("review");
    }
  }

  // Fetch template content_html, resolve placeholders, and transition to preview step.
  async function goToPreview() {
    if (!selectedTemplate) return;
    setIsLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/contracts/templates/${selectedTemplate.template_id}?workspace_id=${workspaceId}`,
      );
      if (!res.ok) throw new Error(t("errors.load_template_content"));
      const json = (await res.json()) as {
        data: { content_html: string; placeholders: PlaceholderDef[] };
      };
      const contentHtml = json.data.content_html ?? "";
      const placeholders = json.data.placeholders ?? [];

      // Use canonical resolver that handles both {{key}} and Tiptap span format
      const { resolved_html } = resolvePlaceholders(
        contentHtml,
        placeholders,
        resolvedMap,
        overrides,
      );

      setPreviewHtml(resolved_html);
      editedHtmlRef.current = resolved_html;
      originalHtmlRef.current = resolved_html;
      setIsDocumentEdited(false);
      setStep("preview");
    } catch {
      toast.error(t("errors.load_preview"));
    } finally {
      setIsLoadingPreview(false);
    }
  }

  // Merge template placeholders with resolved values and user overrides
  function resolvedFields(): PlaceholderField[] {
    if (!selectedTemplate) return [];
    return selectedTemplate.placeholders.map((f) => ({
      ...f,
      value: overrides[f.key] ?? resolvedMap[f.key] ?? f.value,
      editable: true,
    }));
  }

  async function handleSend() {
    if (!selectedTemplate) return;
    setIsSending(true);
    setShowConfirm(false);

    try {
      // Step 1: create the contract record
      const createRes = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          profile_id: profileId,
          template_id: selectedTemplate.template_id,
          overrides: resolvedFields().reduce<Record<string, string>>((acc, f) => {
            acc[f.key] = f.value;
            return acc;
          }, {}),
          // Pass the admin-edited HTML from the preview editor
          resolved_html: editedHtmlRef.current ?? undefined,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? t("errors.create_failed"));
      }

      const { contract_id: contractId, recipient_name: employeeName } =
        (await createRes.json()) as {
          contract_id: string;
          recipient_name?: string;
        };

      // Step 2: trigger send (DocuSeal envelope)
      const sendRes = await fetch(`/api/contracts/${contractId}/send`, { method: "POST" });

      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? t("errors.send_failed"));
      }

      const sendResult = (await sendRes.json()) as {
        status: "sent" | "queued";
        message: string;
      };

      if (sendResult.status === "queued") {
        toast.warning(sendResult.message);
      } else {
        toast.success(
          employeeName
            ? t("send_drawer.contract_sent_to", { name: employeeName })
            : t("send_drawer.contract_sent_to_employee"),
        );
      }
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("toast.something_went_wrong");
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="border-border bg-background w-full p-0 sm:max-w-[640px]">
          <SheetHeader className="border-border border-b px-6 pt-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("send_drawer.title")}
            </SheetTitle>
            <SheetDescription>{t("send_drawer.description")}</SheetDescription>
          </SheetHeader>

          {/* Step indicator */}
          <StepIndicator current={step} />

          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="px-6 py-5">
              {step === "template" && (
                <TemplateStep
                  workspaceId={workspaceId}
                  selected={selectedTemplate}
                  onSelect={(tmpl) => {
                    setSelectedTemplate(tmpl);
                    setOverrides({});
                  }}
                  onNext={goToReview}
                />
              )}

              {step === "review" && selectedTemplate && (
                <ReviewStep
                  fields={resolvedFields()}
                  isLoadingPreview={isLoadingPreview}
                  onOverride={(key, value) => setOverrides((prev) => ({ ...prev, [key]: value }))}
                  onBack={() => setStep("template")}
                  onNext={goToPreview}
                />
              )}

              {step === "preview" && selectedTemplate && previewHtml && (
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
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog — shown on top of the Sheet */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("send_drawer.confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("send_drawer.confirm_description")}
              {isDocumentEdited && (
                <span className="mt-1 block text-xs font-medium text-amber-600">
                  {t("send_drawer.confirm_edited_warning")}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>
              {t("send_drawer.confirm_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("send_drawer.sending")}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("send_drawer.send_contract")}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── StepIndicator ─────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const { t } = useTranslation("contracts");
  const steps: { id: Step; label: string }[] = [
    { id: "template", label: t("send_drawer.step_template") },
    { id: "review", label: t("send_drawer.step_data") },
    { id: "preview", label: t("send_drawer.step_review") },
  ];

  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <div className="border-border border-b px-6 py-3">
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const isDone = i < currentIndex;
          const isActive = i === currentIndex;

          return (
            <li key={step.id} className="flex items-center gap-2">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-primary/20 text-primary ring-primary ring-1"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}
              >
                {step.label}
              </span>
              {i < steps.length - 1 && <ChevronRight className="text-muted-foreground h-3 w-3" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── TemplateStep ──────────────────────────────────────────────

type TemplateStepProps = {
  workspaceId: string;
  selected: ContractTemplate | null;
  onSelect: (t: ContractTemplate) => void;
  onNext: () => void;
};

function TemplateStep({ workspaceId, selected, onSelect, onNext }: TemplateStepProps) {
  const { t } = useTranslation("contracts");
  const [templates, setTemplates] = useState<ContractTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch templates once when this step mounts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/contracts/templates?workspace_id=${workspaceId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(t("errors.load_templates"));
        return res.json() as Promise<{ data: ContractTemplate[] }>;
      })
      .then((json) => {
        if (!cancelled) setTemplates(json.data ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : t("errors.load_error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, t]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-foreground text-sm font-semibold">
          {t("send_drawer.select_template")}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {t("send_drawer.select_template_description")}
        </p>
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {fetchError && <p className="text-destructive text-sm">{fetchError}</p>}

      {!loading && templates && templates.length === 0 && (
        <div className="border-border bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-10 text-center">
          <FileText className="text-muted-foreground mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t("send_drawer.no_templates")}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("send_drawer.no_templates_description")}
          </p>
        </div>
      )}

      {/* Card grid for <=3 templates, radio list for more */}
      {!loading && templates && templates.length > 0 && (
        <>
          {templates.length <= 3 ? (
            <div className="grid grid-cols-1 gap-3">
              {templates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.template_id}
                  template={tmpl}
                  isSelected={selected?.template_id === tmpl.template_id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {templates.map((tmpl) => (
                <TemplateRadioRow
                  key={tmpl.template_id}
                  template={tmpl}
                  isSelected={selected?.template_id === tmpl.template_id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!selected}>
          {t("send_drawer.next_review_data")}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: ContractTemplate;
  isSelected: boolean;
  onSelect: (t: ContractTemplate) => void;
}) {
  const { t } = useTranslation("contracts");
  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
        isSelected
          ? "border-primary bg-primary/5 ring-primary ring-1"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-foreground text-sm font-semibold">{template.name}</div>
          {template.description && (
            <div className="text-muted-foreground mt-0.5 text-xs">{template.description}</div>
          )}
          <div className="text-muted-foreground mt-1 text-xs">
            {t("send_drawer.fields_count", { count: String(template.placeholders.length) })}
          </div>
        </div>
        {isSelected && <CheckCircle2 className="text-primary mt-0.5 h-4 w-4 shrink-0" />}
      </div>
    </button>
  );
}

function TemplateRadioRow({
  template,
  isSelected,
  onSelect,
}: {
  template: ContractTemplate;
  isSelected: boolean;
  onSelect: (t: ContractTemplate) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      {/* Radio circle */}
      <div
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          isSelected ? "border-primary" : "border-muted-foreground"
        }`}
      >
        {isSelected && <div className="bg-primary h-1.5 w-1.5 rounded-full" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate text-sm font-medium">{template.name}</div>
        {template.description && (
          <div className="text-muted-foreground truncate text-xs">{template.description}</div>
        )}
      </div>
    </button>
  );
}

// ── ReviewStep ────────────────────────────────────────────────

type ReviewStepProps = {
  fields: PlaceholderField[];
  isLoadingPreview: boolean;
  onOverride: (key: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

function ReviewStep({ fields, isLoadingPreview, onOverride, onBack, onNext }: ReviewStepProps) {
  const { t } = useTranslation("contracts");
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-foreground text-sm font-semibold">{t("send_drawer.review_title")}</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {t("send_drawer.review_description")}
        </p>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor={`field-${field.key}`} className="text-xs font-medium">
                {field.label}
              </Label>
              {field.source && (
                <span className="text-muted-foreground text-[10px]">{field.source}</span>
              )}
            </div>
            {field.editable ? (
              <Input
                id={`field-${field.key}`}
                value={field.value}
                onChange={(e) => onOverride(field.key, e.target.value)}
                className="h-8 text-sm"
              />
            ) : (
              <div className="border-border bg-muted/40 rounded-md border px-3 py-1.5">
                <span className="text-foreground text-sm">{field.value || "\u2014"}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("send_drawer.no_fields")}</p>
      )}

      <Separator />

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack} size="sm">
          {t("send_drawer.back")}
        </Button>
        <Button onClick={onNext} size="sm" disabled={isLoadingPreview}>
          {isLoadingPreview ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("send_drawer.loading")}
            </>
          ) : (
            <>
              {t("send_drawer.next_preview")}
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── PreviewStep ───────────────────────────────────────────────

type PreviewStepProps = {
  /** Resolved HTML with placeholders replaced — ready for Tiptap rendering */
  contentHtml: string;
  isSending: boolean;
  isEdited: boolean;
  onContentChange: (html: string) => void;
  onBack: () => void;
  onSend: () => void;
};

function PreviewStep({
  contentHtml,
  isSending,
  isEdited,
  onContentChange,
  onBack,
  onSend,
}: PreviewStepProps) {
  const { t } = useTranslation("contracts");
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-sm font-semibold">
            {t("send_drawer.preview_title")}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t("send_drawer.preview_description")}
          </p>
        </div>
        {isEdited && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
            {t("send_drawer.edited_badge")}
          </span>
        )}
      </div>

      <ContractPreviewEditor contentHtml={contentHtml} onContentChange={onContentChange} />

      <div className="bg-muted/60 text-muted-foreground rounded-lg border px-4 py-3 text-xs">
        {t("send_drawer.preview_info")}
      </div>

      <Separator />

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack} size="sm" disabled={isSending}>
          {t("send_drawer.back")}
        </Button>
        <Button onClick={onSend} disabled={isSending}>
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("send_drawer.sending")}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              {t("send_drawer.send_contract")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
