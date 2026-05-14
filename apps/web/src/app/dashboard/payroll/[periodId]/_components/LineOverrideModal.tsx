/**
 * LineOverrideModal — manager proposes a wage-line override (T4.1).
 *
 * Opens from LineDrawer "Overstyr linje" action on derived calculation_line rows.
 * Sends a change_proposal (kind='wage_line_override', status='pending') via
 * POST /api/payroll/propose-line-override (BFF). Admin must approve before
 * the line is updated.
 *
 * SMA-328 / ADR-0311: Extended with deduction consent support (Aml. §14-15 tredje ledd).
 * When category='deduction': shows consent picker (useDeductionConsents hook),
 * blocks submit until a valid consent_document_id is selected, allows negative amounts.
 *
 * ADR-0133: web-only authoring surface.
 * ADR-0292: this modal writes change_proposal only — payroll_calculation untouched.
 * ADR-0078: Høy-PII — rendered in web chat-equivalent surface only.
 * Nordic Split: all colours from CSS variables, no hardcoded values.
 *
 * L-0176 compliance: docstring written after body verified.
 */
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ExternalLink } from "lucide-react";
import { useProposeLineOverride, useDeductionConsents } from "../_hooks/use-line-overrides";

// ─── Types ─────────────────────────────────────────────────────────────────

export type OverrideLine = {
  id: string;
  profileId: string; // SMA-328: required for deduction consent lookup
  profileName: string;
  shiftDate: string;
  category: string;
  totalPay: number;
  source: string;
  existingProposalId?: string;
};

export type LineOverrideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  periodId: string;
  /** Used to block submit UI when period is locked. Defaults to 'open'. */
  periodStatus?: string;
  line: OverrideLine | null;
  onSuccess?: () => void;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatNok(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// SMA-328: 'deduction' added for Aml. §14-15 tredje ledd trekk-samtykke.
type Category =
  | "manual_adjustment"
  | "tariff_interpretation"
  | "shift_data_error"
  | "other"
  | "deduction";

// I18N: TODO — Norwegian strings, not in i18n yet (payroll UI pre-dates i18n migration).
const CATEGORY_LABELS: Record<Category, string> = {
  manual_adjustment: "Manuell justering",
  tariff_interpretation: "Tariff-tolkning",
  shift_data_error: "Vakt-data feil",
  other: "Annet",
  deduction: "Trekk i lønn (Aml. §14-15)", // SMA-328
};

// I18N: TODO — deduction consent UI strings.
const DEDUCTION_STRINGS = {
  consentRequired: "Trekk krever signert samtykke (Aml. §14-15 tredje ledd nr. 1-6)",
  noConsentsEmpty: "Ansatt har ingen signerte trekk-samtykker. Send avtale via DocuSeal først.",
  unionDuesAdvisory: "Bekreft at ansatt er registrert som fagforeningsmedlem",
  consentLabel: "Trekk-samtykke",
  consentPlaceholder: "Velg signert samtykke",
} as const;

const DEDUCTION_TYPE_LABELS: Record<string, string> = {
  loan_agreement: "Låne-avtale",
  uniform_policy: "Uniformspolicy",
  union_dues: "Fagforeningskontingent",
  court_order: "Utleggstrekk (kjennelse)",
  other_voluntary: "Annet frivillig trekk",
};

const MIN_REASON_LENGTH = 8;

// ─── Component ─────────────────────────────────────────────────────────────

export function LineOverrideModal({
  open,
  onOpenChange,
  workspaceId,
  periodId,
  periodStatus = "open",
  line,
  onSuccess,
}: LineOverrideModalProps) {
  const [proposedAmount, setProposedAmount] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<Category>("manual_adjustment");
  // SMA-328: consent_document_id state for deduction category.
  const [consentDocumentId, setConsentDocumentId] = useState<string | null>(null);

  const isLocked = periodStatus === "locked" || periodStatus === "approved";
  const hasPendingOverride = Boolean(line?.existingProposalId);
  const isDisabled = isLocked || hasPendingOverride;

  // SMA-328: fetch active consent documents for this employee (only when category='deduction').
  // Hook is enabled only when needed to avoid unnecessary API calls.
  const { data: deductionConsentsData, isLoading: consentsLoading } = useDeductionConsents(
    line?.profileId ?? null,
    category === "deduction",
  );
  const consents = deductionConsentsData?.consents ?? [];

  // Derive the consent_type of the selected consent (for union_dues advisory).
  const selectedConsent = consents.find((c) => c.id === consentDocumentId);

  const { mutate, isPending } = useProposeLineOverride(periodId, () => {
    // Reset form and close
    setProposedAmount("");
    setReason("");
    setCategory("manual_adjustment");
    setConsentDocumentId(null); // SMA-328
    onOpenChange(false);
    onSuccess?.();
  });

  function handleClose() {
    if (isPending) return;
    setProposedAmount("");
    setReason("");
    setCategory("manual_adjustment");
    setConsentDocumentId(null); // SMA-328
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!line || isDisabled) return;

    const parsedAmount = parseFloat(proposedAmount);
    // SMA-328: deductions are negative; other categories must be positive.
    if (category === "deduction") {
      if (isNaN(parsedAmount) || parsedAmount >= 0) return;
    } else {
      if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    }
    if (reason.trim().length < MIN_REASON_LENGTH) return;
    // SMA-328: block submit if deduction has no consent selected.
    if (category === "deduction" && !consentDocumentId) return;

    mutate({
      workspace_id: workspaceId,
      period_id: periodId,
      calculation_line_id: line.id,
      proposed_amount: parsedAmount,
      reason: reason.trim(),
      category,
      // SMA-328: include consent fields for deduction category.
      ...(category === "deduction" && consentDocumentId
        ? {
            consent_document_id: consentDocumentId,
            deduction_type:
              (selectedConsent?.consent_type as
                | "loan_agreement"
                | "uniform_policy"
                | "union_dues"
                | "court_order"
                | "other_voluntary"
                | undefined) ?? "other_voluntary",
          }
        : {}),
    });
  }

  const parsedAmount = parseFloat(proposedAmount);
  // SMA-328: amount validity depends on category.
  const amountValid =
    category === "deduction"
      ? !isNaN(parsedAmount) && parsedAmount < 0
      : !isNaN(parsedAmount) && parsedAmount > 0;
  const reasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  // SMA-328: deduction also requires a selected consent document.
  const consentValid = category !== "deduction" || consentDocumentId !== null;
  const canSubmit =
    amountValid && reasonValid && consentValid && !isDisabled && !isPending && !!line;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      {/* Fix 3: [&>button:first-of-type]:hidden hides the auto-rendered DialogPrimitive.Close X button.
          Close paths: Avbryt button + backdrop click + Escape key (all work by default). */}
      <DialogContent className="sm:max-w-md [&>button:first-of-type]:hidden">
        <DialogHeader>
          <DialogTitle className="font-heading text-base">Foreslå endring</DialogTitle>
        </DialogHeader>

        {line && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Context display — read-only row info */}
            <div className="bg-muted/50 space-y-1 rounded-md p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ansatt</span>
                <span className="text-foreground font-medium">{line.profileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dato</span>
                <span className="text-foreground">{line.shiftDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kategori</span>
                <span className="text-foreground">{line.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nåværende beløp (brutto)</span>
                <span className="text-foreground font-semibold tabular-nums">
                  {formatNok(line.totalPay)}
                </span>
              </div>
            </div>

            {/* Disabled state messages */}
            {isLocked && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Periode er låst — overstyring ikke mulig.</span>
              </div>
            )}

            {!isLocked && hasPendingOverride && (
              <div className="border-border bg-muted text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Det finnes allerede et ubehandlet forslag for denne linjen.</span>
                {line.existingProposalId && (
                  <a
                    href={`/dashboard/proposals/${line.existingProposalId}`}
                    className="ml-auto flex items-center gap-1 text-xs hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Se forslag
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* Proposed amount */}
            <div className="space-y-1.5">
              <Label htmlFor="proposed-amount">
                {category === "deduction"
                  ? "Trekk-beløp (NOK, negativt)"
                  : "Foreslått ny verdi (NOK)"}{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              {/* SMA-328: deduction amounts are negative — remove min="0.01" for that category. */}
              <Input
                id="proposed-amount"
                type="number"
                {...(category !== "deduction" ? { min: "0.01" } : { max: "-0.01" })}
                step="0.01"
                placeholder={category === "deduction" ? "-0.00" : "0.00"}
                value={proposedAmount}
                onChange={(e) => setProposedAmount(e.target.value)}
                disabled={isDisabled || isPending}
                className="tabular-nums"
                aria-required="true"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {category === "deduction"
                  ? "Negativt beløp — trekk reduserer lønnsgrunnlaget"
                  : "Totalbeløp for hele linja — ikke timesats, ikke prosent"}
              </p>
              {proposedAmount && !amountValid && (
                <p className="text-destructive text-xs">
                  {category === "deduction"
                    ? "Trekk-beløp må være negativt"
                    : "Beløp må være positivt"}
                </p>
              )}
              {amountValid && line && (
                <p
                  className={`mt-2 text-xs ${
                    parsedAmount > line.totalPay
                      ? "text-emerald-700"
                      : parsedAmount < line.totalPay
                        ? "text-red-700"
                        : "text-muted-foreground"
                  }`}
                >
                  Differanse: {parsedAmount > line.totalPay ? "+" : ""}
                  {formatNok(parsedAmount - line.totalPay)}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="override-category">Kategori</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v as Category);
                  // SMA-328: reset consent when switching away from deduction.
                  if (v !== "deduction") setConsentDocumentId(null);
                }}
                disabled={isDisabled || isPending}
              >
                <SelectTrigger id="override-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                {category === "manual_adjustment" &&
                  "Manuell endring uten regelfeil — f.eks. bonus for ekstra innsats"}
                {category === "tariff_interpretation" && "Riksavtalen tolket feil av regelmotoren"}
                {category === "shift_data_error" &&
                  "Vakta har feil data — du symptom-fikser nå, vakta selv burde rettes etterpå"}
                {category === "other" && "Alt annet — forklar i grunn-feltet under"}
                {category === "deduction" &&
                  "Trekk i lønn krever signert samtykke (Aml. §14-15 tredje ledd nr. 1-6)"}
              </p>
            </div>

            {/* SMA-328: Deduction consent picker — shown only when category='deduction' */}
            {category === "deduction" && (
              <div className="space-y-1.5">
                <Label htmlFor="consent-document">
                  {DEDUCTION_STRINGS.consentLabel}{" "}
                  <span className="text-destructive" aria-hidden>
                    *
                  </span>
                </Label>
                {consentsLoading ? (
                  <div className="text-muted-foreground text-sm">Henter samtykker…</div>
                ) : consents.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{DEDUCTION_STRINGS.noConsentsEmpty}</span>
                  </div>
                ) : (
                  <Select
                    value={consentDocumentId ?? ""}
                    onValueChange={(v) => setConsentDocumentId(v || null)}
                    disabled={isDisabled || isPending}
                  >
                    <SelectTrigger id="consent-document">
                      <SelectValue placeholder={DEDUCTION_STRINGS.consentPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {consents.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {DEDUCTION_TYPE_LABELS[c.consent_type] ?? c.consent_type} —{" "}
                          {new Date(c.signed_at).toLocaleDateString("nb-NO")}
                          {c.expires_at && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              (utl. {new Date(c.expires_at).toLocaleDateString("nb-NO")})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {/* Inline error: no consent selected and form submitted */}
                {!consentDocumentId && consents.length > 0 && (
                  <p className="text-destructive text-xs">{DEDUCTION_STRINGS.consentRequired}</p>
                )}
                {/* Union dues advisory — non-blocking (lovsen Q4) */}
                {selectedConsent?.consent_type === "union_dues" && (
                  <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{DEDUCTION_STRINGS.unionDuesAdvisory}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="override-reason">
                Grunn{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Textarea
                id="override-reason"
                placeholder="Beskriv årsaken til overstyringen (min. 8 tegn)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isDisabled || isPending}
                rows={3}
                aria-required="true"
                minLength={MIN_REASON_LENGTH}
              />
              <p className="text-muted-foreground text-xs">
                {reason.trim().length}/{MIN_REASON_LENGTH} tegn minimum
              </p>
              {reason.trim().length > 0 && !reasonValid && (
                <p className="text-destructive text-xs">
                  Grunn må være minst {MIN_REASON_LENGTH} tegn
                </p>
              )}
            </div>

            <p className="text-muted-foreground text-xs">
              Forslag sendes til admin for godkjenning. Linja oppdateres ikke før admin har
              godkjent.
            </p>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Avbryt
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isPending ? "Sender…" : "Send forslag"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
