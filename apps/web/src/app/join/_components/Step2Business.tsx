"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useJoinScraping } from "../_context/JoinScrapingProvider";
import { useTypewriterSequence } from "../_hooks/useTypewriter";
import { step2Schema } from "../_lib/validation";

export function Step2Business({ state, updateState, next, back }: WizardStepProps<JoinState>) {
  const { scrapeStatus, brregData, brregCandidates, selectBrregCandidate } = useJoinScraping();

  const [firstName, setFirstName] = useState(state.business.firstName ?? "");
  const [lastName, setLastName] = useState(state.business.lastName ?? "");
  const [street, setStreet] = useState(state.business.street ?? "");
  const [postalCode, setPostalCode] = useState(state.business.postalCode ?? "");
  const [city, setCity] = useState(state.business.city ?? "");
  const [orgNumber, setOrgNumber] = useState(state.business.orgNumber ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});

  // Build typewriter fields from BRREG data
  const hasAppliedBrreg = useRef(false);
  const typewriterFields = useMemo(() => {
    if (!brregData || hasAppliedBrreg.current) return [];
    const fields: Array<{ key: string; value: string }> = [];
    if (brregData.street) fields.push({ key: "street", value: brregData.street });
    if (brregData.postalCode) fields.push({ key: "postalCode", value: brregData.postalCode });
    if (brregData.city) fields.push({ key: "city", value: brregData.city });
    if (brregData.orgNumber) {
      const formatted = brregData.orgNumber.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
      fields.push({ key: "orgNumber", value: formatted });
    }
    return fields;
  }, [brregData]);

  const shouldType = typewriterFields.length > 0 && !hasAppliedBrreg.current;
  const {
    values: typedValues,
    activeIndex,
    allDone,
  } = useTypewriterSequence(typewriterFields, shouldType, {
    initialDelay: 900,
    speed: 30,
    gap: 200,
  });

  // Sync typewriter output to state
  useEffect(() => {
    if (!shouldType) return;
    if (typedValues.street && !userEdited.street) setStreet(typedValues.street);
    if (typedValues.postalCode && !userEdited.postalCode) setPostalCode(typedValues.postalCode);
    if (typedValues.city && !userEdited.city) setCity(typedValues.city);
    if (typedValues.orgNumber && !userEdited.orgNumber) setOrgNumber(typedValues.orgNumber);
  }, [typedValues, shouldType, userEdited]);

  // Mark as applied when sequence completes
  useEffect(() => {
    if (allDone && shouldType) {
      hasAppliedBrreg.current = true;
    }
  }, [allDone, shouldType]);

  // Handle BRREG candidate selection — reset typewriter
  const handleSelectCandidate = (candidate: typeof brregData) => {
    if (!candidate) return;
    selectBrregCandidate(candidate);
    hasAppliedBrreg.current = false;
    setUserEdited({});
  };

  const handleNext = () => {
    const result = step2Schema.safeParse({
      firstName,
      lastName,
      street,
      postalCode,
      city,
      orgNumber,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    updateState({ business: { ...state.business, ...result.data } });
    next();
  };

  const clearError = (field: string) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const markEdited = (field: string) => {
    setUserEdited((prev) => ({ ...prev, [field]: true }));
  };

  // Which field is currently being typed?
  const typingField =
    activeIndex >= 0 && activeIndex < typewriterFields.length
      ? typewriterFields[activeIndex]!.key
      : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">Bedriftsinformasjon</h2>
        <p className="text-muted-foreground mt-1 text-sm">Fortell oss om deg og bedriften.</p>
        {scrapeStatus === "scraping" && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Henter data fra nettsiden din...
          </p>
        )}
        {allDone && (
          <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            Fylt ut fra Bronnoysundregistrene
          </p>
        )}
      </div>

      {/* BRREG candidates selector — show if multiple matches */}
      {brregCandidates.length > 1 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">
            Vi fant flere bedrifter — velg riktig:
          </Label>
          <div className="space-y-1">
            {brregCandidates.map((c) => (
              <button
                key={c.orgNumber}
                type="button"
                onClick={() => handleSelectCandidate(c)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  brregData?.orgNumber === c.orgNumber
                    ? "border-brand-orange bg-brand-orange/10"
                    : "border-border hover:bg-accent"
                }`}
              >
                <span className="text-foreground font-medium">{c.name}</span>
                <span className="text-muted-foreground ml-2">
                  {c.orgNumber} · {c.city}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Fornavn</Label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                clearError("firstName");
              }}
              aria-invalid={!!errors.firstName}
            />
            {errors.firstName && <p className="text-destructive text-xs">{errors.firstName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Etternavn</Label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                clearError("lastName");
              }}
              aria-invalid={!!errors.lastName}
            />
            {errors.lastName && <p className="text-destructive text-xs">{errors.lastName}</p>}
          </div>
        </div>

        <TypewriterField
          label="Gateadresse"
          typing={typingField === "street"}
          autoFilled={allDone && !userEdited.street && !!brregData?.street}
        >
          <Input
            id="street"
            type="text"
            placeholder="Storgata 1"
            value={street}
            onChange={(e) => {
              setStreet(e.target.value);
              clearError("street");
              markEdited("street");
            }}
            aria-invalid={!!errors.street}
          />
          {errors.street && <p className="text-destructive text-xs">{errors.street}</p>}
        </TypewriterField>

        <div className="grid grid-cols-2 gap-4">
          <TypewriterField
            label="Postnummer"
            typing={typingField === "postalCode"}
            autoFilled={allDone && !userEdited.postalCode && !!brregData?.postalCode}
          >
            <Input
              id="postalCode"
              type="text"
              placeholder="0000"
              maxLength={4}
              value={postalCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPostalCode(val);
                clearError("postalCode");
                markEdited("postalCode");
              }}
              aria-invalid={!!errors.postalCode}
            />
            {errors.postalCode && <p className="text-destructive text-xs">{errors.postalCode}</p>}
          </TypewriterField>

          <TypewriterField
            label="Poststed"
            typing={typingField === "city"}
            autoFilled={allDone && !userEdited.city && !!brregData?.city}
          >
            <Input
              id="city"
              type="text"
              placeholder="Oslo"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                clearError("city");
                markEdited("city");
              }}
              aria-invalid={!!errors.city}
            />
            {errors.city && <p className="text-destructive text-xs">{errors.city}</p>}
          </TypewriterField>
        </div>

        <TypewriterField
          label="Org.nummer"
          typing={typingField === "orgNumber"}
          autoFilled={allDone && !userEdited.orgNumber && !!brregData?.orgNumber}
        >
          <Input
            id="orgNumber"
            type="text"
            placeholder="123 456 789"
            maxLength={11}
            value={orgNumber}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\s]/g, "");
              setOrgNumber(val);
              clearError("orgNumber");
              markEdited("orgNumber");
            }}
            aria-invalid={!!errors.orgNumber}
          />
          {errors.orgNumber && <p className="text-destructive text-xs">{errors.orgNumber}</p>}
        </TypewriterField>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={back} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbake
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          className="bg-brand-orange hover:bg-brand-orange-dark flex-1 text-white"
        >
          Neste
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* -- Typewriter field wrapper -- */

function TypewriterField({
  label,
  typing,
  autoFilled,
  children,
}: {
  label: string;
  typing: boolean;
  autoFilled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {typing && (
          <span className="text-brand-orange flex animate-pulse items-center gap-0.5 text-[10px]">
            <Sparkles className="h-2.5 w-2.5" />
          </span>
        )}
        {autoFilled && !typing && (
          <span className="text-brand-orange/60 flex items-center gap-0.5 text-[10px]">
            <Sparkles className="h-2.5 w-2.5" />
            BRREG
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
