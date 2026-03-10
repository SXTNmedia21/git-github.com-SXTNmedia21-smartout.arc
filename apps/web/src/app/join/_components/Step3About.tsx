"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useSignupWizard } from "../_hooks/useSignupWizard";
import { useAiContent } from "../_hooks/useAiContent";
import type { ScrapeStatus } from "../_hooks/useScrapedData";
import { step3Schema } from "../_lib/validation";
import { AiBadge } from "./AiBadge";

interface ScrapedDataInput {
  about_us?: string;
  our_history?: string;
  our_concept?: string;
  [key: string]: unknown;
}

interface Step3AboutProps {
  scrapedData: ScrapedDataInput | null;
  scrapeStatus: ScrapeStatus;
  companyName: string;
}

export function Step3About({ scrapedData, scrapeStatus, companyName }: Step3AboutProps) {
  const { state, updateStep, nextStep, prevStep } = useSignupWizard();
  const { aiContent, aiStatus, generateContent } = useAiContent();

  const [aboutUs, setAboutUs] = useState(state.step3.aboutUs ?? "");
  const [ourHistory, setOurHistory] = useState(state.step3.ourHistory ?? "");
  const [ourConcept, setOurConcept] = useState(state.step3.ourConcept ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [aboutUsAutoFilled, setAboutUsAutoFilled] = useState(false);
  const [ourHistoryAutoFilled, setOurHistoryAutoFilled] = useState(false);
  const [ourConceptAutoFilled, setOurConceptAutoFilled] = useState(false);

  const hasTriggeredGeneration = useRef(false);

  // Trigger AI content generation when scraped data is available
  useEffect(() => {
    if (hasTriggeredGeneration.current) return;
    if (scrapeStatus === "scraping" || aiStatus === "generating") return;

    if (scrapedData && (scrapeStatus === "success" || scrapeStatus === "partial")) {
      hasTriggeredGeneration.current = true;
      generateContent(companyName, scrapedData);
    }
  }, [scrapedData, scrapeStatus, aiStatus, companyName, generateContent]);

  // Fill fields when AI content arrives
  useEffect(() => {
    if (!aiContent) return;

    if (aiContent.about_us && !aboutUs) {
      setAboutUs(aiContent.about_us);
      setAboutUsAutoFilled(true);
    }
    if (aiContent.our_history && !ourHistory) {
      setOurHistory(aiContent.our_history);
      setOurHistoryAutoFilled(true);
    }
    if (aiContent.our_concept && !ourConcept) {
      setOurConcept(aiContent.our_concept);
      setOurConceptAutoFilled(true);
    }
  }, [aiContent]); // eslint-disable-line

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

  const isGenerating = scrapeStatus === "scraping" || aiStatus === "generating";

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Fortell om bedriften</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Dette brukes til opplæring og onboarding av ansatte.
        </p>
        {isGenerating && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {scrapeStatus === "scraping" ? "Leser nettsiden din..." : "Genererer innhold med AI..."}
          </p>
        )}
        {aiStatus === "failed" && (
          <p className="text-muted-foreground mt-2 text-xs">
            AI-generering feilet. Du kan fylle inn feltene manuelt.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="aboutUs">Om oss</Label>
            {aboutUsAutoFilled && (
              <AiBadge
                onClear={() => {
                  setAboutUs("");
                  setAboutUsAutoFilled(false);
                }}
              />
            )}
          </div>
          <Textarea
            id="aboutUs"
            rows={4}
            placeholder="Beskriv bedriften din..."
            value={aboutUs}
            onChange={(e) => {
              setAboutUs(e.target.value);
              setAboutUsAutoFilled(false);
              setErrors((prev) => ({ ...prev, aboutUs: "" }));
            }}
            aria-invalid={!!errors.aboutUs}
          />
          {errors.aboutUs && <p className="text-destructive text-xs">{errors.aboutUs}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="ourHistory">
              Vår historie <span className="text-muted-foreground">(valgfritt)</span>
            </Label>
            {ourHistoryAutoFilled && (
              <AiBadge
                onClear={() => {
                  setOurHistory("");
                  setOurHistoryAutoFilled(false);
                }}
              />
            )}
          </div>
          <Textarea
            id="ourHistory"
            rows={3}
            placeholder="Fortell historien bak bedriften..."
            value={ourHistory}
            onChange={(e) => {
              setOurHistory(e.target.value);
              setOurHistoryAutoFilled(false);
            }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="ourConcept">Vårt konsept</Label>
            {ourConceptAutoFilled && (
              <AiBadge
                onClear={() => {
                  setOurConcept("");
                  setOurConceptAutoFilled(false);
                }}
              />
            )}
          </div>
          <Textarea
            id="ourConcept"
            rows={4}
            placeholder="Hva gjør dere unike?"
            value={ourConcept}
            onChange={(e) => {
              setOurConcept(e.target.value);
              setOurConceptAutoFilled(false);
              setErrors((prev) => ({ ...prev, ourConcept: "" }));
            }}
            aria-invalid={!!errors.ourConcept}
          />
          {errors.ourConcept && <p className="text-destructive text-xs">{errors.ourConcept}</p>}
        </div>
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
