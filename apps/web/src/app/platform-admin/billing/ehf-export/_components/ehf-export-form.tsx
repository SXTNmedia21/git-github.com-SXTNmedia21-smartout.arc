"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Fase 3B B5 — EHF-eksport form.
//
// Platform-admin velger periode + grouping + format. v1 lar bare
// bundled+CSV gå til nedlasting; per-workspace og PDF er vist men
// rapporterer "kommer snart" når de velges alene. Når begge groupings
// eller begge format er valgt, faller nedlasting tilbake til
// bundled+CSV og viser en info-toast om hva som blir levert.

type Grouping = "bundled" | "per_workspace";
type Format = "csv" | "pdf";

export function EhfExportForm() {
  const today = new Date();
  const defaultToDate = today.toISOString().split("T")[0] as string;
  const defaultFromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0] as string;

  const [periodFrom, setPeriodFrom] = useState(defaultFromDate);
  const [periodTo, setPeriodTo] = useState(defaultToDate);
  const [grouping, setGrouping] = useState<Set<Grouping>>(new Set(["bundled"]));
  const [format, setFormat] = useState<Set<Format>>(new Set(["csv"]));
  const [includeExported, setIncludeExported] = useState(false);

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const submit = () => {
    if (!periodFrom || !periodTo || periodFrom > periodTo) {
      toast.error("Ugyldig periode");
      return;
    }
    if (grouping.size === 0) {
      toast.error("Velg minst én grouping");
      return;
    }
    if (format.size === 0) {
      toast.error("Velg minst ett format");
      return;
    }

    if (grouping.has("per_workspace") && !grouping.has("bundled")) {
      toast.info("Per-workspace-pakke kommer snart. Velg 'Samlet' i tillegg for å laste ned nå.");
      return;
    }
    if (format.has("pdf") && !format.has("csv")) {
      toast.info("PDF-eksport kommer snart. Velg 'CSV' for å laste ned nå.");
      return;
    }

    const params = new URLSearchParams({
      period_from: periodFrom,
      period_to: periodTo,
    });
    params.append("grouping", "bundled");
    params.append("format", "csv");
    if (includeExported) params.set("include_exported", "1");

    if (grouping.has("per_workspace") || format.has("pdf")) {
      toast.info("Leverer samlet CSV i v1. Per-workspace og PDF ruller ut i neste versjon.");
    }

    window.location.assign(`/platform-admin/billing/ehf-export/download?${params.toString()}`);
  };

  const disabled = !periodFrom || !periodTo || periodFrom > periodTo;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="period-from">Periode fra</Label>
          <Input
            id="period-from"
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period-to">Periode til</Label>
          <Input
            id="period-to"
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            required
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Grouping</legend>
        <div className="flex items-center gap-3">
          <Checkbox
            id="grouping-bundled"
            checked={grouping.has("bundled")}
            onCheckedChange={() => setGrouping((s) => toggle(s, "bundled"))}
          />
          <Label htmlFor="grouping-bundled" className="cursor-pointer font-normal">
            Samlet (alle workspaces i én fil)
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            id="grouping-per-workspace"
            checked={grouping.has("per_workspace")}
            onCheckedChange={() => setGrouping((s) => toggle(s, "per_workspace"))}
          />
          <Label htmlFor="grouping-per-workspace" className="cursor-pointer font-normal">
            Per workspace (zip med én fil per kunde){" "}
            <span className="text-muted-foreground text-xs">— kommer snart</span>
          </Label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Format</legend>
        <div className="flex items-center gap-3">
          <Checkbox
            id="format-csv"
            checked={format.has("csv")}
            onCheckedChange={() => setFormat((s) => toggle(s, "csv"))}
          />
          <Label htmlFor="format-csv" className="cursor-pointer font-normal">
            CSV (for regnskapssystem-import)
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            id="format-pdf"
            checked={format.has("pdf")}
            onCheckedChange={() => setFormat((s) => toggle(s, "pdf"))}
          />
          <Label htmlFor="format-pdf" className="cursor-pointer font-normal">
            PDF (for arkiv) <span className="text-muted-foreground text-xs">— kommer snart</span>
          </Label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Filter</legend>
        <div className="flex items-center gap-3">
          <Checkbox
            id="include-exported"
            checked={includeExported}
            onCheckedChange={(v) => setIncludeExported(v === true)}
          />
          <Label htmlFor="include-exported" className="cursor-pointer font-normal">
            Inkluder allerede eksporterte fakturaer (re-eksport)
          </Label>
        </div>
      </fieldset>

      <Button type="submit" disabled={disabled}>
        Generer og last ned
      </Button>
    </form>
  );
}
