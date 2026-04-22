"use client";

/**
 * Step6Summary — final review step of the Join wizard.
 *
 * Auth has already happened silently in step 1. This step gives the user
 * a chance to verify everything looks right before we provision the workspace.
 * The "Next" button in the wizard nav triggers onComplete.
 */

import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { Building2, CheckCircle, Clock, FileText, UtensilsCrossed } from "lucide-react";

export function Step6Summary({ state, t }: WizardStepProps<JoinState>) {
  const sections = [
    {
      icon: Building2,
      label: t("steps.account"),
      items: [
        state.account.companyName,
        state.account.email,
        state.account.firstName && state.account.lastName
          ? `${state.account.firstName} ${state.account.lastName}`
          : undefined,
      ].filter((item): item is string => Boolean(item)),
    },
    {
      icon: FileText,
      label: t("steps.business"),
      items: [
        state.business.street,
        state.business.postalCode && state.business.city
          ? `${state.business.postalCode} ${state.business.city}`
          : undefined,
        state.business.orgNumber,
      ].filter((item): item is string => Boolean(item)),
    },
    {
      icon: Clock,
      label: t("steps.hours"),
      items: [state.hours.phone].filter((item): item is string => Boolean(item)),
    },
    {
      icon: UtensilsCrossed,
      label: t("steps.menu"),
      items: [
        state.menu.restaurantType,
        state.menu.cuisineTypes && state.menu.cuisineTypes.length > 0
          ? state.menu.cuisineTypes.join(", ")
          : undefined,
      ].filter((item): item is string => Boolean(item)),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-[1.75rem] leading-tight tracking-tight">
          {t("step6.summary.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("step6.summary.subtitle")}</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.label} className="border-border/50 bg-card/50 rounded-xl border p-4">
            <div className="mb-2 flex items-center gap-2">
              <section.icon className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-sm font-medium">{section.label}</span>
              {section.items.length > 0 && (
                <CheckCircle className="text-primary ml-auto h-3.5 w-3.5" />
              )}
            </div>
            {section.items.length > 0 ? (
              <div className="text-muted-foreground space-y-0.5 text-sm">
                {section.items.map((item, i) => (
                  <p key={i}>{item}</p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground/50 text-sm italic">Ikke fylt ut</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
