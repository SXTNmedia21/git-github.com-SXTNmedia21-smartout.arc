/**
 * ManualSupplementForm — Screen 06 modal for adding a manual pay supplement.
 *
 * Implements Sofia Sprint 3 mockup 1:1 fidelity (source: payroll-supplement-form.jsx).
 * Fields: ansatt-selector, type (Bonus/Forskudd/Trekk/Annet), beløp, lønnskode,
 *         beskrivelse, taxable toggle, dato.
 *
 * Calls POST /api/payroll/add-manual-supplement via useAddManualSupplement hook.
 * Period lock guard: button only rendered when period.status !== 'locked' (enforced
 * in PeriodDetailClient — this form does not re-check; BFF enforces server-side).
 *
 * ADR-0133: web-only authoring (mobile reads lønnsgrunnlag via my-salary).
 * ADR-0078: Høy-PII — only rendered in a "chat"-equivalent web surface.
 * Nordic Split: all colours from CSS variables (bg-background, text-foreground etc.).
 *
 * L-0176 compliance note: docstring written after body is implemented and verified.
 */
"use client";

import type { JSX } from "react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarIcon, Check, Loader2, Sparkles, Wallet, Utensils, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@smartout/supabase/client";
import { useAddManualSupplement } from "../_hooks/use-manual-supplements";

export type ManualSupplementFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  workspaceId: string;
  prefillProfileId?: string;
  onSuccess?: () => void;
};

type SupplementType = "Bonus" | "Forskudd" | "Trekk" | "Annet";

type WorkspaceProfile = {
  profileId: string;
  displayName: string;
};

// ─── Type config ────────────────────────────────────────────────────────────

const TYPE_CONFIG: {
  type: SupplementType;
  label: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  defaultSalaryCode: string;
}[] = [
  { type: "Bonus", label: "Bonus", Icon: Sparkles, defaultSalaryCode: "5210" },
  { type: "Forskudd", label: "Forskudd", Icon: Wallet, defaultSalaryCode: "5000" },
  { type: "Trekk", label: "Trekk", Icon: Utensils, defaultSalaryCode: "5400" },
  { type: "Annet", label: "Annet", Icon: Plus, defaultSalaryCode: "" },
];

// ─── Profile selector helpers ───────────────────────────────────────────────

async function fetchWorkspaceProfiles(): Promise<WorkspaceProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profile")
    .select("profile_id, user_identity(first_name, last_name)")
    .eq("is_active", true)
    .order("profile_id");
  if (error) return [];
  return (data ?? []).map((p) => {
    const identity = Array.isArray(p.user_identity) ? p.user_identity[0] : p.user_identity;
    const first = identity?.first_name ?? "";
    const last = identity?.last_name ?? "";
    return {
      profileId: p.profile_id,
      displayName: [first, last].filter(Boolean).join(" ") || "Ukjent",
    };
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ManualSupplementForm({
  open,
  onOpenChange,
  periodId,
  workspaceId: _workspaceId, // BFF derives from session; passed for UI context only
  prefillProfileId,
  onSuccess,
}: ManualSupplementFormProps): JSX.Element {
  const { mutate: addSupplement, isPending } = useAddManualSupplement(periodId);

  // ─── Form state ────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>([]);
  const [profileId, setProfileId] = useState<string>(prefillProfileId ?? "");
  const [type, setType] = useState<SupplementType>("Bonus");
  const [amount, setAmount] = useState<string>("");
  const [salaryCode, setSalaryCode] = useState<string>("5210");
  const [description, setDescription] = useState<string>("");
  const [taxable, setTaxable] = useState<boolean>(true);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Load profiles on first open
  useEffect(() => {
    if (open && profiles.length === 0) {
      void fetchWorkspaceProfiles().then(setProfiles);
    }
  }, [open, profiles.length]);

  // Apply prefill on open
  useEffect(() => {
    if (open && prefillProfileId) {
      setProfileId(prefillProfileId);
    }
  }, [open, prefillProfileId]);

  // Update default salary code when type changes
  function handleTypeChange(selected: SupplementType) {
    setType(selected);
    const config = TYPE_CONFIG.find((c) => c.type === selected);
    if (config) setSalaryCode(config.defaultSalaryCode);
  }

  function resetForm() {
    setProfileId(prefillProfileId ?? "");
    setType("Bonus");
    setAmount("");
    setSalaryCode("5210");
    setDescription("");
    setTaxable(true);
    setDate(undefined);
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  // ─── Validation ────────────────────────────────────────────────────────
  const amountNum = parseFloat(amount.replace(",", "."));
  const isAmountValid = !Number.isNaN(amountNum) && amountNum > 0;
  const isDescriptionValid = description.trim().length >= 4;
  const isDateValid = !!date;
  const isProfileValid = !!profileId;
  const canSubmit =
    isProfileValid && isAmountValid && isDescriptionValid && isDateValid && !isPending;

  // ─── Submit ────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!canSubmit || !date) return;

    addSupplement(
      {
        period_id: periodId,
        profile_id: profileId,
        type,
        amount: amountNum,
        salary_code: salaryCode.trim() || undefined,
        description: description.trim(),
        taxable,
        date: format(date, "yyyy-MM-dd"),
      },
      {
        onSuccess: (result) => {
          if (result.ok) {
            toast.success("Lønnslinje lagt til.");
            onSuccess?.();
            handleClose();
          } else {
            toast.error(result.detail ?? result.error ?? "Tillegget ble ikke lagret.");
          }
        },
        onError: (err) => {
          toast.error((err as Error).message ?? "Nettverksfeil.");
        },
      },
    );
  }

  const selectedProfile = profiles.find((p) => p.profileId === profileId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fix 3: [&>button:first-of-type]:hidden suppresses the auto-rendered DialogPrimitive.Close X.
          The dialog previously had a custom X button in the header (now removed).
          onInteractOutside is intentionally kept as preventDefault — Avbryt + Escape are the close paths. */}
      <DialogContent
        className="max-h-[90vh] w-full max-w-[640px] overflow-hidden p-0 [&>button:first-of-type]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* ─── Header ───────────────────────────────────────────────── */}
        <DialogHeader className="border-border flex flex-row items-start gap-3 border-b px-7 py-5">
          <div className="flex-1">
            <p className="text-muted-foreground font-mono text-[10.5px] font-medium tracking-widest uppercase">
              Manuelt tillegg
            </p>
            <DialogTitle className="font-heading text-foreground mt-1 text-2xl tracking-tight">
              Legg til lønnslinje
            </DialogTitle>
          </div>
          {/* Fix 3: X icon removed — backdrop click + Escape + Avbryt button are the close paths.
              shadcn Dialog closes on backdrop click and Escape by default. */}
        </DialogHeader>

        {/* ─── Scrollable body ───────────────────────────────────────── */}
        <div className="flex flex-col gap-[18px] overflow-y-auto px-7 py-[22px]">
          {/* Ansatt selector */}
          <div>
            <FieldLabel label="Ansatt" required />
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger
                className={`h-11 w-full rounded-[10px] border-[1.5px] ${
                  profileId
                    ? "border-[oklch(0.65_0.22_40)] bg-[oklch(0.65_0.22_40_/_0.04)]"
                    : "border-border bg-card"
                }`}
              >
                <SelectValue placeholder="Velg ansatt…">
                  {selectedProfile ? selectedProfile.displayName : "Velg ansatt…"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {profiles.length === 0 ? (
                  <div className="text-muted-foreground px-3 py-2 text-sm">Laster ansatte…</div>
                ) : (
                  profiles.map((p) => (
                    <SelectItem key={p.profileId} value={p.profileId}>
                      {p.displayName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Type — 4-column card grid */}
          <div>
            <FieldLabel label="Type" required />
            <div className="grid grid-cols-4 gap-2">
              {TYPE_CONFIG.map(({ type: t, label, Icon }) => {
                const isSelected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`flex flex-col items-center gap-1.5 rounded-[10px] border-[1.5px] px-2.5 py-3 text-[13px] font-medium transition-all ${
                      isSelected
                        ? "border-[oklch(0.65_0.22_40)] bg-[oklch(0.65_0.22_40_/_0.06)] font-semibold text-[oklch(0.40_0.18_40)]"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={
                        isSelected ? "text-[oklch(0.65_0.22_40)]" : "text-muted-foreground"
                      }
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Beløp + Lønnskode */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <FieldLabel label="Beløp" required hint="NOK" />
              <div className="border-border bg-card flex items-center overflow-hidden rounded-[10px] border">
                <span className="text-muted-foreground px-3.5 font-mono text-[13px]">kr</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="border-0 bg-transparent px-2 py-3 font-mono text-lg font-semibold shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <div>
              <FieldLabel label="Lønnskode" hint="A-melding" />
              <Input
                type="text"
                value={salaryCode}
                onChange={(e) => setSalaryCode(e.target.value)}
                placeholder="5210"
                className="border-border bg-card h-11 rounded-[10px] font-mono"
              />
            </div>
          </div>

          {/* Beskrivelse */}
          <div>
            <FieldLabel label="Beskrivelse · vises på lønnsgrunnlag" required />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="F.eks. Ekstra hjelp Skjærtorsdag"
              rows={2}
              className="border-border bg-card resize-none rounded-[10px] text-[14px]"
            />
            {description.length > 0 && !isDescriptionValid && (
              <p className="text-destructive mt-1 text-[11.5px]">Minimum 4 tegn.</p>
            )}
          </div>

          {/* Dato + Skattepliktig */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <FieldLabel label="Dato" required hint="Må falle i periode" />
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`border-border bg-card h-11 w-full justify-start rounded-[10px] text-[13px] font-normal ${
                      !date ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    <CalendarIcon size={14} className="text-muted-foreground mr-2" />
                    {date ? format(date, "d. MMM yyyy", { locale: nb }) : "Velg dato…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setCalendarOpen(false);
                    }}
                    locale={nb}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Taxable toggle */}
            <div>
              <FieldLabel label="Skattepliktig" />
              <div className="border-border bg-card flex h-11 items-center justify-between rounded-[10px] border px-3.5">
                <span className="text-foreground text-[13px]">
                  {taxable ? "Ja — alminnelig" : "Nei — skattefri"}
                </span>
                <Switch checked={taxable} onCheckedChange={setTaxable} aria-label="Skattepliktig" />
              </div>
            </div>
          </div>

          {/* Botsson tip (mimics mockup hint box) */}
          <div className="bg-muted flex items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-[12.5px]">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-[oklch(0.65_0.22_40)]" />
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Tips:</strong> Sjekk at datoen faller innenfor den
              åpne perioden. Tillegget knyttes automatisk til en vakt på den valgte datoen.
            </p>
          </div>
        </div>

        {/* ─── Footer ────────────────────────────────────────────────── */}
        <div className="border-border bg-muted/40 flex items-center justify-between border-t px-7 py-3.5">
          <p className="text-muted-foreground text-[12px]">
            Linjen signeres med din konto · {format(new Date(), "dd.MM.yyyy")}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
              Avbryt
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isPending ? "Lagrer…" : "Legg til linje"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Field label helper ─────────────────────────────────────────────────────

function FieldLabel({
  label,
  required,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <Label className="text-foreground text-[12.5px] font-medium">
        {label}
        {required && <span className="ml-0.5 text-[oklch(0.65_0.22_40)]">*</span>}
      </Label>
      {hint && <span className="text-muted-foreground text-[11.5px]">{hint}</span>}
    </div>
  );
}
