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

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, FileText, Loader2, Send } from "lucide-react";

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
  id: string;
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
  const [step, setStep] = useState<Step>("template");
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  // User overrides for placeholder fields — key → value
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Reset all local state when drawer closes
  function handleOpenChange(next: boolean) {
    if (!next) {
      setStep("template");
      setSelectedTemplate(null);
      setOverrides({});
      setShowConfirm(false);
    }
    onOpenChange(next);
  }

  // Merge template defaults with user overrides to get the final field values
  function resolvedFields(): PlaceholderField[] {
    if (!selectedTemplate) return [];
    return selectedTemplate.placeholders.map((f) => ({
      ...f,
      value: overrides[f.key] ?? f.value,
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
          template_id: selectedTemplate.id,
          field_values: resolvedFields().reduce<Record<string, string>>((acc, f) => {
            acc[f.key] = f.value;
            return acc;
          }, {}),
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Kunne ikke opprette kontrakt");
      }

      const { id: contractId, employee_name: employeeName } = (await createRes.json()) as {
        id: string;
        employee_name?: string;
      };

      // Step 2: trigger send (DocuSeal envelope)
      const sendRes = await fetch(`/api/contracts/${contractId}/send`, { method: "POST" });

      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Kunne ikke sende kontrakt");
      }

      toast.success(`Kontrakt sendt til ${employeeName ?? "ansatt"}`);
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Noe gikk galt";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="border-border bg-background w-full p-0 sm:max-w-[500px]">
          <SheetHeader className="border-border border-b px-6 pt-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Send kontrakt
            </SheetTitle>
            <SheetDescription>
              Velg mal, gjennomgå data og send til ansatt for signering.
            </SheetDescription>
          </SheetHeader>

          {/* Step indicator */}
          <StepIndicator current={step} />

          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="px-6 py-5">
              {step === "template" && (
                <TemplateStep
                  workspaceId={workspaceId}
                  selected={selectedTemplate}
                  onSelect={(t) => {
                    setSelectedTemplate(t);
                    setOverrides({});
                  }}
                  onNext={() => setStep("review")}
                />
              )}

              {step === "review" && selectedTemplate && (
                <ReviewStep
                  fields={resolvedFields()}
                  onOverride={(key, value) => setOverrides((prev) => ({ ...prev, [key]: value }))}
                  onBack={() => setStep("template")}
                  onNext={() => setStep("preview")}
                />
              )}

              {step === "preview" && selectedTemplate && (
                <PreviewStep
                  template={selectedTemplate}
                  fields={resolvedFields()}
                  isSending={isSending}
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
            <AlertDialogTitle>Send kontrakt?</AlertDialogTitle>
            <AlertDialogDescription>
              Kontrakten sendes til den ansatte for elektronisk signering via DocuSeal. Du kan ikke
              angre etter sending.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sender...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send kontrakt
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

const STEPS: { id: Step; label: string }[] = [
  { id: "template", label: "Mal" },
  { id: "review", label: "Data" },
  { id: "preview", label: "Send" },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="border-border border-b px-6 py-3">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, i) => {
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
              {i < STEPS.length - 1 && <ChevronRight className="text-muted-foreground h-3 w-3" />}
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
  const [templates, setTemplates] = useState<ContractTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch templates once when this step mounts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/contracts/templates?workspace_id=${workspaceId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Kunne ikke laste maler");
        return res.json() as Promise<ContractTemplate[]>;
      })
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : "Feil ved lasting");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-foreground text-sm font-semibold">Velg kontraktsmal</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Malen avgjør hvilke felter og vilkår som brukes.
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
          <p className="text-muted-foreground text-sm">Ingen maler tilgjengelig</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Opprett en kontraktsmal i innstillingene for å komme i gang.
          </p>
        </div>
      )}

      {/* Card grid for ≤3 templates, radio list for more */}
      {!loading && templates && templates.length > 0 && (
        <>
          {templates.length <= 3 ? (
            <div className="grid grid-cols-1 gap-3">
              {templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isSelected={selected?.id === t.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {templates.map((t) => (
                <TemplateRadioRow
                  key={t.id}
                  template={t}
                  isSelected={selected?.id === t.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!selected}>
          Neste: gjennomgå data
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
            {template.placeholders.length} felter
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
  onOverride: (key: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

function ReviewStep({ fields, onOverride, onBack, onNext }: ReviewStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-foreground text-sm font-semibold">Gjennomgå kontraktsdata</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Feltene er fylt ut automatisk fra profil og arbeidsavtale. Du kan overstyre verdier ved
          behov.
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
                <span className="text-foreground text-sm">{field.value || "—"}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-sm">Ingen felter i denne malen.</p>
      )}

      <Separator />

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack} size="sm">
          Tilbake
        </Button>
        <Button onClick={onNext} size="sm">
          Neste: forhåndsvisning
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── PreviewStep ───────────────────────────────────────────────

type PreviewStepProps = {
  template: ContractTemplate;
  fields: PlaceholderField[];
  isSending: boolean;
  onBack: () => void;
  onSend: () => void;
};

function PreviewStep({ template, fields, isSending, onBack, onSend }: PreviewStepProps) {
  // Find the employee name field if present — used in the summary line
  const employeeName = fields.find(
    (f) => f.key === "employee_name" || f.key === "full_name",
  )?.value;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-foreground text-sm font-semibold">Klar til å sende</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Kontroller oppsummeringen nedenfor før du sender.
        </p>
      </div>

      {/* Summary card */}
      <div className="border-border bg-card space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <FileText className="text-primary h-5 w-5" />
          </div>
          <div>
            <div className="text-foreground text-sm font-semibold">{template.name}</div>
            {employeeName && (
              <div className="text-muted-foreground text-xs">Til: {employeeName}</div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          {fields.slice(0, 6).map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">{f.label}</span>
              <span className="text-foreground truncate font-medium">{f.value || "—"}</span>
            </div>
          ))}
          {fields.length > 6 && (
            <p className="text-muted-foreground pt-1 text-xs">+{fields.length - 6} flere felter</p>
          )}
        </div>
      </div>

      <div className="bg-muted/60 text-muted-foreground rounded-lg border px-4 py-3 text-xs">
        Kontrakten sendes til den ansattes e-post for elektronisk signering. Du mottar en kopi etter
        signering.
      </div>

      <Separator />

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack} size="sm" disabled={isSending}>
          Tilbake
        </Button>
        <Button onClick={onSend} disabled={isSending}>
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sender...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send kontrakt
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
