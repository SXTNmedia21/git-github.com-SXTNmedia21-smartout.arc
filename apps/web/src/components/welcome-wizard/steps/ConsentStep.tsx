"use client";

/**
 * ConsentStep.tsx — Consent / Samtykke step
 *
 * Collects three consent checkboxes:
 *   1. Handbook — always required.
 *   2. GDPR privacy notice — always required.
 *   3. Tariff (Riksavtalen / NHO Reiseliv) — only when tariffBound=true.
 *
 * "Neste" is disabled until all required boxes are checked.
 * Persisted via saveConsent() server action (T10).
 *
 * tariffBound MUST be resolved by the caller from
 * payroll.workspace_settings.is_tariff_bound — this component never
 * fetches workspace data itself.
 */

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { ChevronLeft, FileText, Loader2 } from "lucide-react";
import { saveConsent } from "@/app/dashboard/_actions/welcome-wizard-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  onNext: () => void;
  onBack: () => void;
  /** True when workspace.is_tariff_bound — adds tariff checkbox.
   *  Caller resolves this from payroll.workspace_settings before render. */
  tariffBound?: boolean;
};

export function ConsentStep({ onNext, onBack, tariffBound = false }: Props) {
  const [handbook, setHandbook] = React.useState(false);
  const [gdpr, setGdpr] = React.useState(false);
  const [tariff, setTariff] = React.useState(false);
  const [isPending, startTransition] = useTransition();

  const canSubmit = handbook && gdpr && (!tariffBound || tariff);

  const handleNext = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      const r = await saveConsent({
        handbook: true,
        gdpr: true,
        ...(tariffBound ? { tariff: true } : {}),
      });
      if (!r.ok) {
        toast.error("Kunne ikke lagre samtykke", { description: r.error });
        return;
      }
      onNext();
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header>
        <h2 className="font-heading text-3xl">Samtykke</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Bekreft at du har lest personalhåndboken og personvernerklæringen.
        </p>
      </header>

      <ul className="space-y-3">
        <li className="border-border bg-card rounded border p-4">
          <label className="flex items-start gap-3">
            <Checkbox checked={handbook} onCheckedChange={(v) => setHandbook(v === true)} />
            <span className="flex-1 text-sm">
              Jeg har lest{" "}
              <a
                href="/dashboard/handbook"
                target="_blank"
                className="text-primary inline-flex items-center gap-1 underline"
              >
                personalhåndboken <FileText className="h-3 w-3" />
              </a>
              .
            </span>
          </label>
        </li>

        <li className="border-border bg-card rounded border p-4">
          <label className="flex items-start gap-3">
            <Checkbox checked={gdpr} onCheckedChange={(v) => setGdpr(v === true)} />
            <span className="flex-1 text-sm">
              Jeg samtykker til at Smartout behandler mine personopplysninger som beskrevet i{" "}
              <a href="/legal/privacy" target="_blank" className="text-primary underline">
                personvernerklæringen
              </a>
              .
            </span>
          </label>
        </li>

        {tariffBound && (
          <li className="border-border bg-card rounded border p-4">
            <label className="flex items-start gap-3">
              <Checkbox checked={tariff} onCheckedChange={(v) => setTariff(v === true)} />
              <span className="flex-1 text-sm">
                Jeg er kjent med at min arbeidsplass er bundet av Riksavtalen (NHO Reiseliv).
              </span>
            </label>
          </li>
        )}
      </ul>

      <div className="mt-auto flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={isPending}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Tilbake
        </Button>
        <Button
          onClick={handleNext}
          disabled={isPending || !canSubmit}
          className="bg-foreground text-background hover:bg-foreground/90 min-w-[90px] disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Lagrer…
            </>
          ) : (
            "Neste"
          )}
        </Button>
      </div>
    </div>
  );
}
