/**
 * AddSupplementForm — form for adding a workspace-level supplement override.
 *
 * Calls POST /api/payroll/tariff/supplement. Workspace_id is server-derived
 * from JWT (ADR-0151) — not sent in body.
 *
 * Authority: admin OR manager (broader than ChangeBindingForm — managers can
 * add supplements within the tariff floor, only admins can change the binding
 * itself). The server enforces role; the form is enabled for admin + manager.
 *
 * Error handling (ADR-0152):
 *   - SUPPLEMENT_BELOW_TARIFF_FLOOR → inline error with floor + proposed + aml_ref
 *   - Other errors → sonner toast.error
 *
 * Mutation invalidates the tariff query on success.
 */
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { tariffKeys } from "@/hooks/payroll/use-current-tariff";
import type {
  AddSupplementResponse,
  PayrollTariffError,
  SupplementType,
  RateType,
} from "@smartout/types";
import { PAYROLL_TARIFF_BFF_ROUTES, supplementTypeSchema, rateTypeSchema } from "@smartout/types";

type Props = {
  /** When false the form is locked — server will reject but UX prevents attempt */
  canSubmit: boolean;
};

type FloorError = {
  floor: number;
  proposed: number;
  aml_ref?: string;
};

// Human-readable supplement type labels in Norwegian (Phase 7g: DB taxonomy keys)
const SUPPLEMENT_TYPE_LABELS: Record<SupplementType, string> = {
  normal: "Normalt tillegg (per skift / time)",
  week_based: "Ukebasert tillegg (helg/kveld per uke)",
  day_based: "Dagsbasert tillegg (kveld/natt per dag)",
  manual: "Manuelt diskresjonært tillegg",
  holiday: "Helligdagstillegg",
  contract_rule: "Kontraktsregel-basert tillegg",
};

const RATE_TYPE_LABELS: Record<RateType, string> = {
  fixed_per_hour: "Fast timesats (kr/t)",
  percentage: "Prosentsats (%)",
  fixed_per_shift: "Fast vaktsats (kr per vakt)",
};

export function AddSupplementForm({ canSubmit }: Props) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";
  const queryClient = useQueryClient();

  const supplementTypes = supplementTypeSchema.options;
  const rateTypes = rateTypeSchema.options;

  const [name, setName] = useState("");
  const [supplementType, setSupplementType] = useState<SupplementType>("normal");
  const [rateValue, setRateValue] = useState("");
  const [rateType, setRateType] = useState<RateType>("percentage");
  const [paragrafRef, setParagrafRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [floorError, setFloorError] = useState<FloorError | null>(null);

  const isDisabled = !canSubmit || !workspaceId;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isDisabled) return;

    const parsedRate = parseFloat(rateValue);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      toast.error("Satsverdi må være et positivt tall");
      return;
    }

    setFloorError(null);
    setSubmitting(true);

    try {
      const res = await fetch(PAYROLL_TARIFF_BFF_ROUTES.supplement, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          supplement_type: supplementType,
          rate_value: parsedRate,
          rate_type: rateType,
          paragraf_ref: paragrafRef || undefined,
          // match_predicate: left as empty object — agent-authored in capability tools
          match_predicate: {},
        }),
      });

      const data = (await res.json()) as AddSupplementResponse;

      if (!data.ok) {
        const err = data.error as PayrollTariffError;
        if (
          err.code === "SUPPLEMENT_BELOW_TARIFF_FLOOR" &&
          err.floor !== undefined &&
          err.proposed !== undefined
        ) {
          setFloorError({ floor: err.floor, proposed: err.proposed, aml_ref: err.aml_ref });
          return;
        }
        toast.error(err.message ?? "Kunne ikke legge til tillegg");
        return;
      }

      toast.success(`Tillegg «${data.data.name}» lagt til`);
      // Reset form
      setName("");
      setRateValue("");
      setParagrafRef("");
      setSupplementType("normal");
      setRateType("percentage");
      // Invalidate tariff query so SupplementOverridesList refreshes
      void queryClient.invalidateQueries({ queryKey: tariffKeys.current(workspaceId) });
    } catch (err) {
      toast.error(`Nettverksfeil: ${err instanceof Error ? err.message : "Ukjent feil"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      <fieldset disabled={isDisabled} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="supp-name">Navn</Label>
          <Input
            id="supp-name"
            type="text"
            placeholder="F.eks. Kveldstillegg etter 20:00"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="supp-type">Tilleggstype</Label>
          <select
            id="supp-type"
            value={supplementType}
            onChange={(e) => setSupplementType(e.target.value as SupplementType)}
            className="border-input bg-background text-foreground focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            required
          >
            {supplementTypes.map((type) => (
              <option key={type} value={type}>
                {SUPPLEMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="rate-value">Satsverdi</Label>
            <Input
              id="rate-value"
              type="number"
              placeholder={rateType === "percentage" ? "15" : "28.50"}
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              required
              min="0.01"
              step="0.01"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rate-type">Satstype</Label>
            <select
              id="rate-type"
              value={rateType}
              onChange={(e) => setRateType(e.target.value as RateType)}
              className="border-input bg-background text-foreground focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {rateTypes.map((type) => (
                <option key={type} value={type}>
                  {RATE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="paragraf-ref">
            Paragraf-referanse <span className="text-muted-foreground font-normal">(valgfri)</span>
          </Label>
          <Input
            id="paragraf-ref"
            type="text"
            placeholder="Riksavtalen §6"
            value={paragrafRef}
            onChange={(e) => setParagrafRef(e.target.value)}
          />
        </div>
      </fieldset>

      {/* SUPPLEMENT_BELOW_TARIFF_FLOOR inline error */}
      {floorError && (
        <div
          className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-xs"
          role="alert"
        >
          <p className="text-destructive font-medium">Tillegg under tariffgulv</p>
          <p className="text-destructive/80 mt-1">
            Foreslått sats{" "}
            <strong className="tabular-nums">
              {rateType === "percentage"
                ? `${floorError.proposed}%`
                : `kr ${floorError.proposed.toFixed(2)}`}
            </strong>{" "}
            er under tariffens minimumssats{" "}
            <strong className="tabular-nums">
              {rateType === "percentage"
                ? `${floorError.floor}%`
                : `kr ${floorError.floor.toFixed(2)}`}
            </strong>
            .
          </p>
          {floorError.aml_ref && (
            <p className="text-muted-foreground mt-1">Ref: {floorError.aml_ref}</p>
          )}
        </div>
      )}

      <Button type="submit" disabled={isDisabled || submitting} className="self-start">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Legg til tillegg
      </Button>
    </form>
  );
}
