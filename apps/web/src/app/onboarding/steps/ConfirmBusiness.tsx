"use client";

/**
 * ConfirmBusiness — Step 1 of onboarding confirmation wizard.
 *
 * Shows pre-filled business data in an editable card grid.
 * Data comes from intelligence pipeline (BRREG + scraping + Google Places).
 */

import { useState } from "react";
import { Building2, Globe, Mail, Phone, MapPin, Hash } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import type { BusinessData } from "../types";

interface FieldConfig {
  key: keyof BusinessData;
  label: string;
  icon: React.ElementType;
  type?: "text" | "email" | "tel" | "url";
}

const FIELDS: FieldConfig[] = [
  { key: "name", label: "Bedriftsnavn", icon: Building2 },
  { key: "legalName", label: "Juridisk navn", icon: Building2 },
  { key: "orgNumber", label: "Organisasjonsnummer", icon: Hash },
  { key: "email", label: "E-post", icon: Mail, type: "email" },
  { key: "phone", label: "Telefon", icon: Phone, type: "tel" },
  { key: "website", label: "Nettside", icon: Globe, type: "url" },
  { key: "address", label: "Adresse", icon: MapPin },
  { key: "city", label: "By", icon: MapPin },
  { key: "industry", label: "Bransje", icon: Building2 },
];

export function ConfirmBusiness({
  state,
  updateState,
  next,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [editingField, setEditingField] = useState<string | null>(null);

  function handleFieldChange(key: keyof BusinessData, value: string) {
    updateState({
      business: { ...state.business, [key]: value },
    });
  }

  const filledCount = FIELDS.filter((f) => {
    const val = state.business[f.key];
    return typeof val === "string" && val.trim().length > 0;
  }).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h2 className="font-heading text-foreground text-3xl tracking-tight">
          {t("confirm.business_title")}
        </h2>
        <p className="text-muted-foreground mt-2 text-base">{t("confirm.business_description")}</p>
        <p className="text-muted-foreground/60 mt-1 text-sm">
          {filledCount} av {FIELDS.length} felt utfylt
        </p>
      </div>

      {/* Logo preview if available */}
      {state.business.logoUrl && (
        <div className="flex items-center gap-4">
          <img
            src={state.business.logoUrl}
            alt={state.business.name || "Logo"}
            className="border-border h-16 w-16 rounded-xl border object-contain"
          />
          <div>
            <p className="text-foreground text-sm font-medium">{state.business.name}</p>
            <p className="text-muted-foreground text-xs">{state.business.industry}</p>
          </div>
        </div>
      )}

      {/* Editable field grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const value = state.business[field.key];
          const displayValue = typeof value === "string" ? value : "";
          const Icon = field.icon;
          const isEditing = editingField === field.key;

          return (
            <div
              key={field.key}
              className="group border-border bg-card hover:border-border/80 rounded-xl border p-4 transition-colors"
            >
              <div className="text-muted-foreground mb-1.5 flex items-center gap-2 text-xs">
                <Icon className="size-3.5" />
                <span>{field.label}</span>
              </div>

              {isEditing ? (
                <input
                  type={field.type ?? "text"}
                  value={displayValue}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingField(null);
                  }}
                  className="border-border bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingField(field.key)}
                  className="text-foreground w-full text-left text-sm"
                >
                  {displayValue || <span className="text-muted-foreground/40">Ikke angitt</span>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={next}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-colors"
      >
        {t("confirm.departments_title")} &rarr;
      </button>
    </div>
  );
}
