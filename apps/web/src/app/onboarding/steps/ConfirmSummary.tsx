"use client";

/**
 * ConfirmSummary — Step 5 (final) of onboarding confirmation wizard.
 *
 * Read-only summary of everything the user confirmed.
 * Shows counts and highlights for departments, locations, procedures.
 * The "Finalize" action calls next() which triggers onComplete in the definition.
 */

import { useState } from "react";
import { Building2, Layers, MapPin, ClipboardCheck, Loader2, CheckCircle } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmSummary({ state, next, goTo, t }: WizardStepProps<OnboardingConfirmState>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDepts = state.departments.filter((d) => d.selected);
  const selectedProcs = state.procedures.filter((p) => p.selected);
  const totalZones = state.locations.reduce((sum, loc) => sum + loc.zones.length, 0);

  async function handleFinalize() {
    setIsSubmitting(true);
    setError(null);

    try {
      await next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
      setIsSubmitting(false);
    }
  }

  const summaryCards = [
    {
      icon: Building2,
      title: state.business.name || "Bedrift",
      detail: [state.business.industry, state.business.city].filter(Boolean).join(" · "),
      editStep: "confirm-business",
    },
    {
      icon: Layers,
      title: `${selectedDepts.length} avdelinger`,
      detail: selectedDepts.map((d) => d.name).join(", "),
      editStep: "confirm-departments",
    },
    {
      icon: MapPin,
      title: `${state.locations.length} lokasjon${state.locations.length !== 1 ? "er" : ""}`,
      detail:
        totalZones > 0
          ? `${totalZones} sone${totalZones !== 1 ? "r" : ""}`
          : state.locations.map((l) => l.name).join(", "),
      editStep: "confirm-locations",
    },
    {
      icon: ClipboardCheck,
      title: `${selectedProcs.length} prosedyrer`,
      detail:
        selectedProcs.length > 0
          ? selectedProcs
              .slice(0, 3)
              .map((p) => p.name)
              .join(", ") + (selectedProcs.length > 3 ? ` +${selectedProcs.length - 3}` : "")
          : "Ingen valgt",
      editStep: "confirm-procedures",
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h2 className="font-heading text-foreground text-3xl tracking-tight">
          {t("confirm.summary_title")}
        </h2>
        <p className="text-muted-foreground mt-2 text-base">{t("confirm.summary_description")}</p>
      </div>

      {/* Summary cards */}
      <div className="flex flex-col gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.editStep}
              className="border-border bg-card flex items-center justify-between rounded-2xl border p-5"
            >
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
                  <Icon className="text-primary size-5" />
                </div>
                <div>
                  <p className="text-foreground text-base font-medium">{card.title}</p>
                  {card.detail && <p className="text-muted-foreground text-sm">{card.detail}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => goTo(card.editStep)}
                className="text-primary hover:text-primary/80 text-sm"
              >
                Endre
              </button>
            </div>
          );
        })}
      </div>

      {/* Ready indicator */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
        <CheckCircle className="size-5 text-emerald-500" />
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Alt klart. Klikk nedenfor for a fullføre oppsettet.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="border-destructive/20 bg-destructive/5 rounded-2xl border px-5 py-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Finalize button */}
      <button
        type="button"
        onClick={handleFinalize}
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-lg font-semibold transition-colors disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Aktiverer...
          </>
        ) : (
          t("confirm.finalize")
        )}
      </button>
    </div>
  );
}
