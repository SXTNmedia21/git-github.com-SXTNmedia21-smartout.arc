"use client";

/**
 * ConfirmBusiness — Step 1 of onboarding confirmation wizard.
 *
 * Shows pre-filled business data as standard form fields (Input + Label).
 * Data comes from intelligence pipeline (BRREG + scraping + Google Places).
 * Design matches the Join wizard pattern (Nordic Split, max-w-md, shadcn form fields).
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Globe, Mail, Phone, MapPin, Hash } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import type { BusinessData } from "../types";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useBusinessTools } from "./tools/business-tools";

interface FieldConfig {
  key: keyof BusinessData;
  labelKey: string;
  icon: React.ElementType;
  type?: "text" | "email" | "tel" | "url";
  placeholderKey: string;
}

const FIELDS: FieldConfig[] = [
  {
    key: "name",
    labelKey: "confirm.fields.name.label",
    icon: Building2,
    placeholderKey: "confirm.fields.name.placeholder",
  },
  {
    key: "legalName",
    labelKey: "confirm.fields.legalName.label",
    icon: Building2,
    placeholderKey: "confirm.fields.legalName.placeholder",
  },
  {
    key: "orgNumber",
    labelKey: "confirm.fields.orgNumber.label",
    icon: Hash,
    placeholderKey: "confirm.fields.orgNumber.placeholder",
  },
  {
    key: "email",
    labelKey: "confirm.fields.email.label",
    icon: Mail,
    type: "email",
    placeholderKey: "confirm.fields.email.placeholder",
  },
  {
    key: "phone",
    labelKey: "confirm.fields.phone.label",
    icon: Phone,
    type: "tel",
    placeholderKey: "confirm.fields.phone.placeholder",
  },
  {
    key: "website",
    labelKey: "confirm.fields.website.label",
    icon: Globe,
    type: "url",
    placeholderKey: "confirm.fields.website.placeholder",
  },
  {
    key: "address",
    labelKey: "confirm.fields.address.label",
    icon: MapPin,
    placeholderKey: "confirm.fields.address.placeholder",
  },
  {
    key: "city",
    labelKey: "confirm.fields.city.label",
    icon: MapPin,
    placeholderKey: "confirm.fields.city.placeholder",
  },
  {
    key: "industry",
    labelKey: "confirm.fields.industry.label",
    icon: Building2,
    placeholderKey: "confirm.fields.industry.placeholder",
  },
];

export function ConfirmBusiness({
  state,
  updateState,
  next,
  back,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const tools = useBusinessTools(state, updateState, next, back);
  useRegisterTools("wizard-onboarding-business", tools);

  const [localBusiness, setLocalBusiness] = useState(state.business);

  function handleFieldChange(key: keyof BusinessData, value: string) {
    setLocalBusiness((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    updateState({ business: localBusiness });
  }, [localBusiness]);

  const filledCount = FIELDS.filter((f) => {
    const val = localBusiness[f.key];
    return typeof val === "string" && val.trim().length > 0;
  }).length;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">
          {t("confirm.business_title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.business_description")}</p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          {t("confirm.fields.filledCount", { filled: filledCount, total: FIELDS.length })}
        </p>
      </div>

      {/* Logo preview if available */}
      {state.business.logoUrl && (
        <div className="flex items-center gap-3">
          <Image
            src={state.business.logoUrl}
            alt={state.business.name || "Logo"}
            width={48}
            height={48}
            className="border-border h-12 w-12 rounded-lg border object-contain"
          />
          <div>
            <p className="text-foreground text-sm font-medium">{state.business.name}</p>
            <p className="text-muted-foreground text-xs">{state.business.industry}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {FIELDS.map((field) => {
          const value = localBusiness[field.key];
          const displayValue = typeof value === "string" ? value : "";

          return (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`confirm-${field.key}`}>{t(field.labelKey)}</Label>
              <Input
                id={`confirm-${field.key}`}
                type={field.type ?? "text"}
                placeholder={t(field.placeholderKey)}
                value={displayValue}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
