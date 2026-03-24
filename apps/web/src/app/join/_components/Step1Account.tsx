"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Globe } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useJoinScraping } from "../_context/JoinScrapingProvider";
import { step1Schema } from "../_lib/validation";

const INDUSTRY_OPTIONS = [
  { value: "restaurant", label: "Restaurant", nace: "56.101" },
  { value: "cafe", label: "Kafe / Bakeri", nace: "56.102" },
  { value: "bar", label: "Bar / Nattklubb", nace: "56.301" },
  { value: "hotel", label: "Hotell", nace: "55.101" },
  { value: "catering", label: "Catering", nace: "56.210" },
  { value: "fast_food", label: "Hurtigmat / Takeaway", nace: "56.102" },
  { value: "retail", label: "Butikk / Detaljhandel", nace: "47.110" },
  { value: "other", label: "Annet", nace: "" },
] as const;

export function Step1Account({ state, updateState, next }: WizardStepProps<JoinState>) {
  const { scrapeStatus, triggerScrape, lookupBrreg } = useJoinScraping();

  const [email, setEmail] = useState(state.account.email ?? "");
  const [companyName, setCompanyName] = useState(state.account.companyName ?? "");
  const [industry, setIndustry] = useState(state.account.industry ?? "");
  const [city, setCity] = useState(state.account.city ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(state.account.websiteUrl ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced scrape trigger on URL change
  const handleUrlChange = useCallback(
    (url: string) => {
      setWebsiteUrl(url);
      setErrors((prev) => ({ ...prev, websiteUrl: "" }));

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (url.length > 4) {
        debounceRef.current = setTimeout(() => {
          const fullUrl = url.startsWith("http") ? url : `https://${url}`;
          triggerScrape(fullUrl);
        }, 1000);
      }
    },
    [triggerScrape],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleNext = () => {
    const result = step1Schema.safeParse({
      email,
      companyName,
      industry,
      city,
      websiteUrl,
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

    updateState({
      account: {
        ...state.account,
        email: result.data.email,
        companyName: result.data.companyName,
        industry: result.data.industry,
        city: result.data.city,
        websiteUrl: result.data.websiteUrl,
      },
    });

    // Trigger BRREG lookup with company name + city for accurate matching
    lookupBrreg(result.data.companyName, result.data.city);
    next();
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">Opprett din konto</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Vi starter med det grunnleggende om bedriften din.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-post</Label>
          <Input
            id="email"
            type="email"
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: "" }));
            }}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyName">Bedriftsnavn</Label>
          <Input
            id="companyName"
            type="text"
            placeholder="F.eks. Restaurant Solsiden"
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              setErrors((prev) => ({ ...prev, companyName: "" }));
            }}
            aria-invalid={!!errors.companyName}
          />
          {errors.companyName && <p className="text-destructive text-xs">{errors.companyName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="industry">Bransje</Label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                setErrors((prev) => ({ ...prev, industry: "" }));
              }}
              aria-invalid={!!errors.industry}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-brand-orange/40 flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">Velg bransje</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.industry && <p className="text-destructive text-xs">{errors.industry}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">By</Label>
            <Input
              id="city"
              type="text"
              placeholder="Oslo"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setErrors((prev) => ({ ...prev, city: "" }));
              }}
              aria-invalid={!!errors.city}
            />
            {errors.city && <p className="text-destructive text-xs">{errors.city}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Hjemmeside</Label>
          <div className="relative">
            <Globe className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="websiteUrl"
              type="text"
              placeholder="www.dinbedrift.no"
              value={websiteUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="pl-9"
              aria-invalid={!!errors.websiteUrl}
            />
          </div>
          {errors.websiteUrl && <p className="text-destructive text-xs">{errors.websiteUrl}</p>}
          {scrapeStatus === "scraping" && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Vi leser nettsiden din...
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleNext}
        className="bg-brand-orange hover:bg-brand-orange-dark w-full text-white"
      >
        Neste
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
