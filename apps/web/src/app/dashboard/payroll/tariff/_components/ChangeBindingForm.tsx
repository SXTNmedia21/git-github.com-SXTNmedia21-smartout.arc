/**
 * ChangeBindingForm — admin-only form for changing the workspace tariff binding.
 *
 * Calls POST /api/payroll/tariff/change (if is_bound) or /api/payroll/tariff/setup
 * (if not yet bound). The BFF derives workspace_id from the JWT — not in the body
 * (ADR-0151).
 *
 * Error handling (ADR-0152):
 *   - SUPPLEMENT_BELOW_TARIFF_FLOOR → shows floor + proposed + aml_ref inline
 *   - All other errors → sonner toast.error
 *
 * Authority: admin-only (ADR-0356 — payroll capability delegation requires admin role).
 * The server enforces this; the UI disables the form when role !== "admin".
 *
 * Mutation invalidates tariff query on success.
 */
"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { tariffKeys } from "@/hooks/payroll/use-current-tariff";
import type {
  ChangeTariffRequest,
  SetupTariffRequest,
  ChangeTariffResponse,
  SetupTariffResponse,
  PayrollTariffError,
  UnionId,
} from "@smartout/types";
import { PAYROLL_TARIFF_BFF_ROUTES, unionIdSchema } from "@smartout/types";

/** Human-readable labels for union binding options */
const UNION_OPTIONS: Array<{ value: UnionId; label: string }> = [
  { value: "taro-79", label: "Fellesforbundet (Riksavtalen)" },
  { value: "taro-226", label: "Parat overenskomst" },
  { value: "non-bound", label: "Ikke tariffbundet" },
];

type Props = {
  isBound: boolean;
  isAdmin: boolean;
};

type FloorError = {
  floor: number;
  proposed: number;
  aml_ref?: string;
};

export function ChangeBindingForm({ isBound, isAdmin }: Props) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";
  const queryClient = useQueryClient();

  const [unionId, setUnionId] = useState<UnionId>("taro-79");
  const [lawVersion, setLawVersion] = useState("");
  const [officialDate, setOfficialDate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [floorError, setFloorError] = useState<FloorError | null>(null);

  const isDisabled = !isAdmin || !workspaceId;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isDisabled) return;

    setFloorError(null);
    setSubmitting(true);

    try {
      const endpoint = isBound ? PAYROLL_TARIFF_BFF_ROUTES.change : PAYROLL_TARIFF_BFF_ROUTES.setup;

      const body: ChangeTariffRequest | SetupTariffRequest = isBound
        ? {
            new_union_id: unionId,
            new_law_version: lawVersion,
            official_effective_date: officialDate,
            effective_from: effectiveFrom || undefined,
            reason: reason || undefined,
          }
        : {
            union_id: unionId,
            law_version: lawVersion,
            official_effective_date: officialDate,
            effective_from: effectiveFrom || undefined,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as ChangeTariffResponse | SetupTariffResponse;

      if (!data.ok) {
        const err = data.error as PayrollTariffError;
        if (
          err.code === "SUPPLEMENT_BELOW_TARIFF_FLOOR" &&
          err.floor !== undefined &&
          err.proposed !== undefined
        ) {
          setFloorError({
            floor: err.floor,
            proposed: err.proposed,
            aml_ref: err.aml_ref,
          });
          return;
        }
        toast.error(err.message ?? "Kunne ikke endre tariffbinding");
        return;
      }

      toast.success(isBound ? "Tariffbinding oppdatert" : "Tariffbinding opprettet");
      // Reset form
      setUnionId("taro-79");
      setLawVersion("");
      setOfficialDate("");
      setEffectiveFrom("");
      setReason("");
      // Invalidate current tariff query
      void queryClient.invalidateQueries({ queryKey: tariffKeys.current(workspaceId) });
    } catch (err) {
      toast.error(`Nettverksfeil: ${err instanceof Error ? err.message : "Ukjent feil"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      {!isAdmin && (
        <div className="border-border bg-muted/30 flex items-center gap-2 rounded-lg border p-3 text-xs">
          <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground">Kun admin kan endre tariffbinding</span>
        </div>
      )}

      <fieldset disabled={isDisabled} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="union-id">Tariffavtale</Label>
          <select
            id="union-id"
            value={unionId}
            onChange={(e) => setUnionId(unionIdSchema.parse(e.target.value))}
            className="border-input bg-background text-foreground focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            required
          >
            {UNION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="law-version">Avtaleversjon</Label>
          <Input
            id="law-version"
            type="text"
            placeholder="2025"
            value={lawVersion}
            onChange={(e) => setLawVersion(e.target.value)}
            required
            aria-describedby="law-version-hint"
          />
          <p id="law-version-hint" className="text-muted-foreground text-xs">
            F.eks. «2025» eller «2024». Bestemmer hvilke satser som slår inn.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="official-date">Offisiell ikrafttredelse</Label>
          <Input
            id="official-date"
            type="date"
            value={officialDate}
            onChange={(e) => setOfficialDate(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="effective-from">
            Gjelder fra (for denne arbeidsplassen){" "}
            <span className="text-muted-foreground font-normal">(valgfri)</span>
          </Label>
          <Input
            id="effective-from"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">Tom = fra i dag</p>
        </div>

        {isBound && (
          <div className="grid gap-2">
            <Label htmlFor="reason">
              Årsak til endring <span className="text-muted-foreground font-normal">(valgfri)</span>
            </Label>
            <Input
              id="reason"
              type="text"
              placeholder="F.eks. lønnsoppgjør 2025"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </div>
        )}
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
            <strong className="tabular-nums">kr {floorError.proposed.toFixed(2)}</strong> er under
            tariffens minimumssats{" "}
            <strong className="tabular-nums">kr {floorError.floor.toFixed(2)}</strong>.
          </p>
          {floorError.aml_ref && (
            <p className="text-muted-foreground mt-1">Ref: {floorError.aml_ref}</p>
          )}
        </div>
      )}

      <Button type="submit" disabled={isDisabled || submitting} className="self-start">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {isBound ? "Endre tariffbinding" : "Sett opp tariffbinding"}
      </Button>
    </form>
  );
}
