"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useJoinScraping } from "../_context/JoinScrapingProvider";
import { useTypewriterSequence } from "../_hooks/useTypewriter";
import { WizardLoadingOverlay } from "./WizardLoadingOverlay";
import { DevAutoFill } from "./DevAutoFill";

const INITIAL_CANDIDATES = 3;

export function Step2Business({ state, updateState, attempted, t }: WizardStepProps<JoinState>) {
  const { scrapeStatus, brregData, brregCandidates, brregLoading, selectBrregCandidate } =
    useJoinScraping();

  const [street, setStreet] = useState(state.business.street ?? "");
  const [postalCode, setPostalCode] = useState(state.business.postalCode ?? "");
  const [city, setCity] = useState(state.business.city ?? "");
  const [orgNumber, setOrgNumber] = useState(state.business.orgNumber ?? "");
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});
  const [showAllCandidates, setShowAllCandidates] = useState(false);

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

  // Sync local fields to wizard state
  useEffect(() => {
    updateState({
      business: {
        ...state.business,
        street,
        postalCode,
        city,
        orgNumber,
      },
    });
  }, [street, postalCode, city, orgNumber]);

  const markEdited = (field: string) => {
    setUserEdited((prev) => ({ ...prev, [field]: true }));
  };

  // Which field is currently being typed?
  const typingField =
    activeIndex >= 0 && activeIndex < typewriterFields.length
      ? typewriterFields[activeIndex]!.key
      : null;

  // Show loading overlay when BRREG lookup is in progress
  if (brregLoading && !brregData) {
    return (
      <WizardLoadingOverlay
        messages={[
          "Soker i Bronnoysundregistrene...",
          "Finner bedriftsinformasjon...",
          "Henter adresse og organisasjonsnummer...",
        ]}
      />
    );
  }

  // BRREG candidates — show max 3 with "vis mer"
  const visibleCandidates = showAllCandidates
    ? brregCandidates
    : brregCandidates.slice(0, INITIAL_CANDIDATES);
  const hasMoreCandidates = brregCandidates.length > INITIAL_CANDIDATES;

  const devFill = () => {
    setStreet("Langbrygga 5");
    setPostalCode("3724");
    setCity("Skien");
    setOrgNumber("911 722 267");
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <DevAutoFill onFill={devFill} label="Fyll steg 2" />
      <div>
        <h2 className="font-heading text-foreground text-[1.75rem] leading-tight tracking-tight">
          {t("step2.heading")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("step2.description")}</p>
        {scrapeStatus === "scraping" && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("step2.scraping")}
          </p>
        )}
        {allDone && (
          <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            {t("step2.brregDone")}
          </p>
        )}
      </div>

      {/* BRREG candidates selector — show if multiple matches */}
      {brregCandidates.length > 1 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">{t("step2.multipleCandidates")}</Label>
          <div className="space-y-1">
            {visibleCandidates.map((c) => (
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
          {hasMoreCandidates && !showAllCandidates && (
            <button
              type="button"
              onClick={() => setShowAllCandidates(true)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              <ChevronDown className="h-3 w-3" />
              {t("step2.showMore", { count: brregCandidates.length - INITIAL_CANDIDATES })}
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        <TypewriterField
          label={t("step2.street")}
          typing={typingField === "street"}
          autoFilled={allDone && !userEdited.street && !!brregData?.street}
        >
          <Input
            id="street"
            type="text"
            placeholder={t("step2.street_placeholder")}
            value={street}
            onChange={(e) => {
              setStreet(e.target.value);
              markEdited("street");
            }}
            aria-invalid={attempted && street.length < 2}
          />
        </TypewriterField>

        <div className="grid grid-cols-2 gap-4">
          <TypewriterField
            label={t("step2.postalCode")}
            typing={typingField === "postalCode"}
            autoFilled={allDone && !userEdited.postalCode && !!brregData?.postalCode}
          >
            <Input
              id="postalCode"
              type="text"
              placeholder={t("step2.postalCode_placeholder")}
              maxLength={4}
              value={postalCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPostalCode(val);
                markEdited("postalCode");
              }}
              aria-invalid={attempted && !/^\d{4}$/.test(postalCode)}
            />
          </TypewriterField>

          <TypewriterField
            label={t("step2.postCity")}
            typing={typingField === "city"}
            autoFilled={allDone && !userEdited.city && !!brregData?.city}
          >
            <Input
              id="city"
              type="text"
              placeholder={t("step2.postCity_placeholder")}
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                markEdited("city");
              }}
              aria-invalid={attempted && city.length < 2}
            />
          </TypewriterField>
        </div>

        <TypewriterField
          label={t("step2.orgNumber")}
          typing={typingField === "orgNumber"}
          autoFilled={allDone && !userEdited.orgNumber && !!brregData?.orgNumber}
        >
          <Input
            id="orgNumber"
            type="text"
            placeholder={t("step2.orgNumber_placeholder")}
            maxLength={11}
            value={orgNumber}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\s]/g, "");
              setOrgNumber(val);
              markEdited("orgNumber");
            }}
            aria-invalid={attempted && orgNumber.replace(/\s/g, "").length < 9}
          />
        </TypewriterField>
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
