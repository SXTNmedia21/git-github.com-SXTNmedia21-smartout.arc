"use client";

/**
 * ConfirmSummary — Step 5 (final) of onboarding confirmation wizard.
 *
 * Read-only summary of everything the user confirmed.
 * Shows counts and highlights for departments, locations, procedures.
 * The "Finalize" button calls next() which triggers onComplete in the definition.
 * Design matches the Join wizard pattern (Nordic Split, max-w-md).
 */

import { useState } from "react";
import { Building2, Layers, MapPin, ClipboardCheck, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useSummaryTools } from "./tools/summary-tools";

export function ConfirmSummary({
  state,
  updateState,
  next,
  back,
  goTo,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const tools = useSummaryTools(state, updateState, next, back);
  useRegisterTools("wizard-onboarding-summary", tools);

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
      setError(err instanceof Error ? err.message : "Noe gikk galt. Prov igjen.");
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

  // Build a readable summary of selected professions and their positions
  const professionSummaryLines = state.professions
    .filter((p) => p.positions.some((pos) => pos.selected))
    .map((p) => {
      const selected = p.positions.filter((pos) => pos.selected);
      return `${p.name}: ${selected.map((pos) => pos.name).join(", ")}`;
    });

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">{t("confirm.summary_title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.summary_description")}</p>
      </div>

      {/* Summary cards */}
      <div className="space-y-2">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.editStep}
              className="border-border bg-card flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="bg-brand-orange/10 flex size-9 items-center justify-center rounded-lg">
                  <Icon className="text-brand-orange size-4" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">{card.title}</p>
                  {card.detail && (
                    <p className="text-muted-foreground max-w-[200px] truncate text-xs">
                      {card.detail}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => goTo(card.editStep)}
                className="text-brand-orange hover:text-brand-orange/80 text-xs"
              >
                Endre
              </button>
            </div>
          );
        })}
      </div>

      {/* Professions & Positions */}
      {professionSummaryLines.length > 0 && (
        <div className="border-border bg-card rounded-lg border p-4">
          <dl>
            <div>
              <dt className="text-muted-foreground text-xs font-medium">Fag & posisjoner</dt>
              <dd className="text-foreground mt-1 text-sm">{professionSummaryLines.join(" | ")}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Ready indicator */}
      <div className="flex items-center gap-2.5 rounded-lg border border-[var(--success)]/20 bg-[var(--success)]/5 px-3 py-3">
        <CheckCircle className="text-success size-4" />
        <p className="text-success text-xs">Alt klart. Klikk nedenfor for a fullfare oppsettet.</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="border-destructive/20 bg-destructive/5 rounded-lg border px-3 py-3">
          <p className="text-destructive text-xs">{error}</p>
        </div>
      )}

      {/* Finalize button — uses brand-orange like Join's Step6CreateAccount */}
      <Button
        type="button"
        onClick={handleFinalize}
        disabled={isSubmitting}
        className="bg-brand-orange hover:bg-brand-orange-dark w-full text-white"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Aktiverer...
          </>
        ) : (
          t("confirm.finalize")
        )}
      </Button>
    </div>
  );
}
