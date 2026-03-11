"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useSignupWizard } from "../_hooks/useSignupWizard";
import { useTypewriterSequence } from "../_hooks/useTypewriter";
import { step3Schema } from "../_lib/validation";
import { AiBadge } from "./AiBadge";

export function Step3About() {
  const { state, updateStep, nextStep, prevStep, aiContent, aiStatus } = useSignupWizard();

  const [aboutUs, setAboutUs] = useState(state.step3.aboutUs ?? "");
  const [ourHistory, setOurHistory] = useState(state.step3.ourHistory ?? "");
  const [ourConcept, setOurConcept] = useState(state.step3.ourConcept ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});

  // Build typewriter fields from AI content
  const hasApplied = useRef(false);
  const typewriterFields = useMemo(() => {
    if (!aiContent || hasApplied.current) return [];
    const fields: Array<{ key: string; value: string }> = [];
    if (aiContent.about_us) fields.push({ key: "aboutUs", value: aiContent.about_us });
    if (aiContent.our_history) fields.push({ key: "ourHistory", value: aiContent.our_history });
    if (aiContent.our_concept) fields.push({ key: "ourConcept", value: aiContent.our_concept });
    return fields;
  }, [aiContent]);

  const shouldType = typewriterFields.length > 0 && !hasApplied.current;
  const {
    values: typedValues,
    activeIndex,
    allDone,
  } = useTypewriterSequence(typewriterFields, shouldType, {
    initialDelay: 200,
    speed: 12,
    gap: 300,
  });

  // Sync typewriter output to state
  useEffect(() => {
    if (!shouldType) return;
    if (typedValues.aboutUs && !userEdited.aboutUs) setAboutUs(typedValues.aboutUs);
    if (typedValues.ourHistory && !userEdited.ourHistory) setOurHistory(typedValues.ourHistory);
    if (typedValues.ourConcept && !userEdited.ourConcept) setOurConcept(typedValues.ourConcept);
  }, [typedValues, shouldType, userEdited]);

  // Mark done
  useEffect(() => {
    if (allDone && shouldType) hasApplied.current = true;
  }, [allDone, shouldType]);

  const markEdited = (field: string) => {
    setUserEdited((prev) => ({ ...prev, [field]: true }));
  };

  const handleNext = () => {
    const result = step3Schema.safeParse({
      aboutUs,
      ourHistory: ourHistory || undefined,
      ourConcept,
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

    updateStep("step3", result.data);
    nextStep();
  };

  const typingField =
    activeIndex >= 0 && activeIndex < typewriterFields.length
      ? typewriterFields[activeIndex]!.key
      : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Fortell om bedriften</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Dette brukes til opplæring og onboarding av ansatte.
        </p>
        {aiStatus === "generating" && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Skriver utkast...
          </p>
        )}
        {allDone && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-orange-500">
            <Sparkles className="h-3 w-3" />
            Utkast fylt ut — rediger fritt
          </p>
        )}
        {aiStatus === "failed" && (
          <p className="text-muted-foreground mt-2 text-xs">
            Kunne ikke generere utkast. Fyll inn manuelt.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <TypewriterTextarea
          label="Om oss"
          id="aboutUs"
          rows={3}
          placeholder="Beskriv bedriften din..."
          value={aboutUs}
          typing={typingField === "aboutUs"}
          autoFilled={allDone && !userEdited.aboutUs && !!aiContent?.about_us}
          onChange={(val) => {
            setAboutUs(val);
            markEdited("aboutUs");
            setErrors((prev) => ({ ...prev, aboutUs: "" }));
          }}
          onClearAi={() => {
            setAboutUs("");
            markEdited("aboutUs");
          }}
          error={errors.aboutUs}
        />

        <TypewriterTextarea
          label="Vår historie"
          labelSuffix="(valgfritt)"
          id="ourHistory"
          rows={2}
          placeholder="Fortell historien bak bedriften..."
          value={ourHistory}
          typing={typingField === "ourHistory"}
          autoFilled={allDone && !userEdited.ourHistory && !!aiContent?.our_history}
          onChange={(val) => {
            setOurHistory(val);
            markEdited("ourHistory");
          }}
          onClearAi={() => {
            setOurHistory("");
            markEdited("ourHistory");
          }}
        />

        <TypewriterTextarea
          label="Vårt konsept"
          id="ourConcept"
          rows={3}
          placeholder="Hva gjør dere unike?"
          value={ourConcept}
          typing={typingField === "ourConcept"}
          autoFilled={allDone && !userEdited.ourConcept && !!aiContent?.our_concept}
          onChange={(val) => {
            setOurConcept(val);
            markEdited("ourConcept");
            setErrors((prev) => ({ ...prev, ourConcept: "" }));
          }}
          onClearAi={() => {
            setOurConcept("");
            markEdited("ourConcept");
          }}
          error={errors.ourConcept}
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbake
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
        >
          Neste
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Typewriter textarea wrapper ── */

function TypewriterTextarea({
  label,
  labelSuffix,
  id,
  rows,
  placeholder,
  value,
  typing,
  autoFilled,
  onChange,
  onClearAi,
  error,
}: {
  label: string;
  labelSuffix?: string;
  id: string;
  rows: number;
  placeholder: string;
  value: string;
  typing: boolean;
  autoFilled: boolean;
  onChange: (val: string) => void;
  onClearAi: () => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id}>
            {label}
            {labelSuffix && <span className="text-muted-foreground ml-1">{labelSuffix}</span>}
          </Label>
          {typing && (
            <span className="flex animate-pulse items-center gap-0.5 text-[10px] text-orange-500">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
        {autoFilled && !typing && <AiBadge onClear={onClearAi} />}
      </div>
      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
