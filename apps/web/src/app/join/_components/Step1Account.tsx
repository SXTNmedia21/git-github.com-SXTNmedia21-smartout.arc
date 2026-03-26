"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Globe } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useJoinScraping } from "../_context/JoinScrapingProvider";

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

export function Step1Account({ state, updateState }: WizardStepProps<JoinState>) {
  const { scrapeStatus, triggerScrape, lookupBrreg } = useJoinScraping();

  const [email, setEmail] = useState(state.account.email ?? "");
  const [companyName, setCompanyName] = useState(state.account.companyName ?? "");
  const [industry, setIndustry] = useState(state.account.industry ?? "");
  const [city, setCity] = useState(state.account.city ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(state.account.websiteUrl ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local fields to wizard state so WizardNavBar validation sees current data
  useEffect(() => {
    updateState({
      account: {
        ...state.account,
        email,
        companyName,
        industry,
        city,
        websiteUrl,
      },
    });
  }, [email, companyName, industry, city, websiteUrl]); // sync local fields only

  // Trigger BRREG lookup when company name + city are both filled
  const brregTriggeredRef = useRef(false);
  useEffect(() => {
    if (companyName && city && !brregTriggeredRef.current) {
      brregTriggeredRef.current = true;
      lookupBrreg(companyName, city);
    }
  }, [companyName, city, lookupBrreg]);

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

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Opprett din konto</h2>
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
            <Select
              value={industry}
              onValueChange={(val) => {
                setIndustry(val);
                setErrors((prev) => ({ ...prev, industry: "" }));
              }}
            >
              <SelectTrigger id="industry" aria-invalid={!!errors.industry}>
                <SelectValue placeholder="Velg bransje" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
    </div>
  );
}
