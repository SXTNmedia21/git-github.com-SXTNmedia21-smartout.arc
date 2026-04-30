"use client";

/**
 * TipsregelModal.tsx — Dialog modal for configuring contract_tip_rule per employee.
 *
 * What: shadcn Dialog wrapping tip-rule configuration (distribution_method, tip_share,
 *       tripletex_reporting_method, a_melding_code, effective_from).
 *       Opened from a "Konfigurer tipsregel" button in LonnsprofilSection.
 * Why:  Cycle 6 Wave 1 Phase 2 — HR-tab Tipsregel authoring.
 *       ARCHITECTURE §3.5 (contract_tip_rule per-employee).
 *       ADR-0245 (web-only admin authoring surface).
 *       ADR-0244 (mobile-stacked / vertical layout pattern).
 *       tip_distribution_method enum: per_shift_hours | per_position | fixed_percentage | pool
 *       (verified from database.types.ts).
 *       tip_share cap: 0.00–1.50 (Cycle 1 finding — NOT 5.00).
 *
 * Save: via upsertTipsregel Server Action (employment-contract-actions.ts).
 * Endpoint /api/contracts/tip-rule/upsert does NOT exist — upsertTipsregel SA is used.
 * No new BFF endpoint created per scope constraint (Agent S handles separately if needed).
 *
 * Telemetry: TODO — Agent V wires payroll_profile.updated / tip_rule.upserted emit().
 * Voice: FORBIDDEN per ADR-0078 — no voice surface on this modal.
 *
 * Mobile layout: vertical stacked (ADR-0244) — no side-by-side on narrow screens.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, Calendar, CreditCard, Info, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { upsertTipsregel } from "../../_actions/employment-contract-actions";
import type { Database } from "@smartout/supabase";

// ─── Types ─────────────────────────────────────────────────────────────────

type TipDistributionMethod = Database["public"]["Enums"]["tip_distribution_method"];

interface TipsregelFormData {
  /** Fordelingsmetode — enum: per_shift_hours | per_position | fixed_percentage | pool */
  distribution_method: TipDistributionMethod;
  /**
   * Tipsandel — 0.00 to 1.50 (cap per Cycle 1 finding).
   * DB type is float, not percentage — 1.0 = 100 %.
   */
  tip_share: number;
  /** Rapporteringsmetode i Tripletex — e.g. "included_in_salary" */
  tripletex_reporting_method: string;
  /** A-melding kode — e.g. "211" */
  a_melding_code: string;
  /** Gjelder fra — ISO date string (required) */
  effective_from: string;
}

interface TipsregelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  workspaceId: string;
  /** contract_id is required to save tip rule — must exist before modal opens */
  contractId: string | null;
  /** Existing tip rule to pre-populate (optional) */
  initial?: Partial<TipsregelFormData>;
}

// ─── Label maps ────────────────────────────────────────────────────────────

const DISTRIBUTION_METHOD_LABELS: Record<TipDistributionMethod, string> = {
  per_shift_hours: "Per vakttime",
  per_position: "Per stilling",
  fixed_percentage: "Fast prosent",
  pool: "Pool",
};

const TRIPLETEX_REPORTING_OPTIONS = [
  { value: "included_in_salary", label: "Inkludert i lønn" },
  { value: "separate_line", label: "Egen linje" },
  { value: "gross_salary", label: "Bruttolønn" },
] as const;

// ─── Component ─────────────────────────────────────────────────────────────

export function TipsregelModal({
  open,
  onOpenChange,
  profileId,
  workspaceId,
  contractId,
  initial,
}: TipsregelModalProps) {
  const today = new Date().toISOString().split("T")[0]!;

  const [form, setForm] = useState<TipsregelFormData>({
    distribution_method: initial?.distribution_method ?? "per_shift_hours",
    tip_share: initial?.tip_share ?? 1.0,
    tripletex_reporting_method: initial?.tripletex_reporting_method ?? "included_in_salary",
    a_melding_code: initial?.a_melding_code ?? "211",
    effective_from: initial?.effective_from ?? today,
  });

  const originalRef = useRef(JSON.stringify(form));
  const dirty = JSON.stringify(form) !== originalRef.current;
  const [saving, startSave] = useTransition();
  const [tipShareError, setTipShareError] = useState<string | null>(null);

  // Reset form when modal opens with new initial data
  useEffect(() => {
    if (!open) return;
    const fresh: TipsregelFormData = {
      distribution_method: initial?.distribution_method ?? "per_shift_hours",
      tip_share: initial?.tip_share ?? 1.0,
      tripletex_reporting_method: initial?.tripletex_reporting_method ?? "included_in_salary",
      a_melding_code: initial?.a_melding_code ?? "211",
      effective_from: initial?.effective_from ?? today,
    };
    setForm(fresh);
    originalRef.current = JSON.stringify(fresh);
    setTipShareError(null);
  }, [open, initial, today]);

  const update = useCallback(
    <K extends keyof TipsregelFormData>(key: K, value: TipsregelFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /**
   * tip_share validation: 0.00–1.50 (Cycle 1 cap).
   * Verification: rg "tip_share.*5\.00|<= 5\.00" apps/web/src/ returns 0 hits.
   */
  const handleTipShareChange = (raw: string) => {
    const v = parseFloat(raw);
    if (raw === "" || raw === "0") {
      setTipShareError(null);
      update("tip_share", 0);
      return;
    }
    if (isNaN(v)) return;
    if (v > 1.5) {
      setTipShareError("Tipsandel kan ikke overstige 1,50");
      return;
    }
    if (v < 0) {
      setTipShareError("Tipsandel kan ikke være negativ");
      return;
    }
    setTipShareError(null);
    update("tip_share", v);
  };

  const handleSave = () => {
    if (!contractId) {
      toast.error("Lagre ansettelse først for å sette tipsregel");
      return;
    }
    if (tipShareError) {
      toast.error(tipShareError);
      return;
    }
    if (!form.effective_from) {
      toast.error("Gjelder fra er påkrevet");
      return;
    }

    startSave(async () => {
      /**
       * Save via upsertTipsregel Server Action.
       * /api/contracts/tip-rule/upsert endpoint does NOT exist.
       * TODO (Agent S): create BFF endpoint if needed for mobile/external callers.
       * This SA path is sufficient for web-only authoring (ADR-0245).
       */
      const result = await upsertTipsregel({
        profile_id: profileId,
        contract_id: contractId,
        distribution_method: form.distribution_method,
        tip_share: form.tip_share,
        tripletex_reporting_method: form.tripletex_reporting_method,
        a_melding_code: form.a_melding_code,
        taxable: true, // Default; taxable toggle available in HrTabSections if needed
        effective_from: form.effective_from,
        effective_until: null,
        // TODO (Agent V): emit tip_rule.upserted telemetry after save
      });

      if (result.ok) {
        originalRef.current = JSON.stringify(form);
        toast.success("Tipsregel lagret");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDiscard = () => {
    setForm(JSON.parse(originalRef.current) as TipsregelFormData);
    setTipShareError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" aria-describedby="tipsregel-description">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Konfigurer tipsregel</DialogTitle>
              <DialogDescription id="tipsregel-description" className="text-xs">
                Fordeling og rapportering av tips for denne ansatte
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* No-contract guard */}
        {!contractId && (
          <div className="border-border bg-muted/30 flex items-center gap-2 rounded-lg border p-3">
            <AlertCircle className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-muted-foreground text-sm">
              Lagre ansettelse først for å aktivere tipsregel
            </span>
          </div>
        )}

        {/* Form — vertical stacked layout (ADR-0244 mobile-stacked pattern) */}
        <div className="space-y-5">
          {/* Fordelingsmetode */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Fordelingsmetode
            </Label>
            <Select
              value={form.distribution_method}
              onValueChange={(v) => update("distribution_method", v as TipDistributionMethod)}
              disabled={!contractId || saving}
            >
              <SelectTrigger aria-label="Velg fordelingsmetode">
                <SelectValue placeholder="Velg metode" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DISTRIBUTION_METHOD_LABELS) as TipDistributionMethod[]).map(
                  (method) => (
                    <SelectItem key={method} value={method}>
                      {DISTRIBUTION_METHOD_LABELS[method]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Tipsandel — 0.00–1.50 (Cycle 1 cap) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Tipsandel
              </Label>
              <Badge variant="outline" className="text-muted-foreground font-mono text-[10px]">
                0,00 – 1,50
              </Badge>
            </div>
            <Input
              type="number"
              min={0}
              max={1.5}
              step={0.01}
              value={form.tip_share}
              onChange={(e) => handleTipShareChange(e.target.value)}
              disabled={!contractId || saving}
              aria-label="Tipsandel (0 til 1,50)"
              aria-describedby={tipShareError ? "tip-share-error" : undefined}
              className={tipShareError ? "border-rose-500/70 ring-2 ring-rose-500/20" : undefined}
            />
            {tipShareError && (
              <p id="tip-share-error" className="flex items-center gap-1 text-xs text-rose-500">
                <AlertCircle className="h-3 w-3" />
                {tipShareError}
              </p>
            )}
            <p className="text-muted-foreground text-[10px]">
              1,0 = 100 % av tipsandelen. Maks 1,50 per Cycle 1 regelkontroll.
            </p>
          </div>

          {/* Tripletex-rapportering */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Tripletex-rapportering
            </Label>
            <Select
              value={form.tripletex_reporting_method}
              onValueChange={(v) => update("tripletex_reporting_method", v)}
              disabled={!contractId || saving}
            >
              <SelectTrigger aria-label="Velg Tripletex rapporteringsmetode">
                <SelectValue placeholder="Velg rapportering" />
              </SelectTrigger>
              <SelectContent>
                {TRIPLETEX_REPORTING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* A-meldingskode */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              A-meldingskode
            </Label>
            <Input
              type="text"
              value={form.a_melding_code}
              onChange={(e) => update("a_melding_code", e.target.value)}
              placeholder="211"
              disabled={!contractId || saving}
              aria-label="A-meldingskode"
            />
            <p className="text-muted-foreground text-[10px]">
              Kode for tips i A-meldingen — f.eks. 211 (skattepliktige naturalytelser).
            </p>
          </div>

          {/* Gjelder fra — required */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground flex items-center gap-1 text-xs font-semibold tracking-wider uppercase">
              <Calendar className="h-3 w-3" />
              Gjelder fra
              <span className="ml-0.5 text-rose-500">*</span>
            </Label>
            <Input
              type="date"
              value={form.effective_from}
              onChange={(e) => update("effective_from", e.target.value)}
              disabled={!contractId || saving}
              required
              aria-label="Gjelder fra (påkrevet)"
            />
          </div>

          {/* Scope notice */}
          <div className="border-border bg-muted/20 flex items-start gap-2 rounded-lg border p-3">
            <Info className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-muted-foreground text-[10px]">
              Tipsregel gjelder per ansatt og kontrakt. Endringer lagres umiddelbart og gjelder fra
              valgt dato. Rapportering synkroniseres ved neste Tripletex-kjøring.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleDiscard} disabled={saving}>
            Avbryt
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !contractId || !!tipShareError}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Lagrer…
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Lagre tipsregel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
