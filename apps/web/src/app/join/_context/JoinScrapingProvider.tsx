"use client";

/**
 * JoinScrapingProvider — side-context for website scraping, BRREG lookups,
 * and intelligence pre-fetching.
 *
 * WizardShell manages step state and navigation. This provider wraps the
 * useScrapedData hook and exposes scraping/BRREG data to step components
 * via useJoinScraping(). It sits OUTSIDE WizardShell in the component tree
 * so that scraping state survives step transitions.
 *
 * Intelligence pre-fetching: call prefetchContent() from Step2's onStepLeave
 * so the AI call runs during Step2→Step3 transition. Step3 reads from
 * prefetchedContent instead of making its own call.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  useScrapedData,
  type ScrapeStatus,
  type BrregData,
  type PlacesMatch,
} from "../_hooks/useScrapedData";

// ── Scraped data shape (matches the hook's internal type) ──

export interface ScrapedData {
  companyName?: string;
  email?: string;
  phone?: string;
  description?: string;
  summary?: string;
  logoUrl?: string;
  socialLinks?: Record<string, string>;
  locations?: Array<{ name: string; type: string }>;
  departments?: Array<{ name: string; roles: string[] }>;
  [key: string]: unknown;
}

// ── Pre-fetched intelligence content ──

export interface PrefetchedContent {
  about_us: string;
  our_history: string;
  our_concept: string;
  menu_description: string;
  intelligence?: Record<string, unknown>;
}

// ── Context value ──

export interface JoinScrapingContextValue {
  scrapedData: ScrapedData | null;
  scrapeStatus: ScrapeStatus;
  triggerScrape: (url: string) => Promise<void>;
  brregData: BrregData | null;
  brregCandidates: BrregData[];
  brregLoading: boolean;
  brregNeedOrgNumber: boolean;
  placesMatch: PlacesMatch | null;
  selectBrregCandidate: (candidate: BrregData) => void;
  lookupBrreg: (companyName: string, city?: string, industry?: string) => Promise<void>;
  lookupBrregByOrgNumber: (orgNumber: string) => Promise<void>;
  /** Fire intelligence API early so Step3 has content ready */
  prefetchContent: (params: {
    companyName: string;
    city?: string;
    websiteUrl?: string;
    orgNumber?: string;
  }) => void;
  prefetchedContent: PrefetchedContent | null;
  prefetchStatus: "idle" | "fetching" | "done" | "failed";
}

const JoinScrapingContext = createContext<JoinScrapingContextValue | null>(null);

// ── Provider ──

interface JoinScrapingProviderProps {
  children: ReactNode;
}

export function JoinScrapingProvider({ children }: JoinScrapingProviderProps) {
  const {
    scrapedData,
    scrapeStatus,
    triggerScrape,
    brregData,
    brregCandidates,
    brregLoading,
    brregNeedOrgNumber,
    placesMatch,
    selectBrregCandidate,
    lookupBrreg,
    lookupBrregByOrgNumber,
  } = useScrapedData();

  const [prefetchedContent, setPrefetchedContent] = useState<PrefetchedContent | null>(null);
  const [prefetchStatus, setPrefetchStatus] = useState<"idle" | "fetching" | "done" | "failed">(
    "idle",
  );
  const prefetchAbortRef = useRef<AbortController | null>(null);

  const prefetchContent = useCallback(
    (params: { companyName: string; city?: string; websiteUrl?: string; orgNumber?: string }) => {
      if (prefetchStatus === "fetching" || prefetchStatus === "done") return;

      if (prefetchAbortRef.current) prefetchAbortRef.current.abort();
      const controller = new AbortController();
      prefetchAbortRef.current = controller;

      setPrefetchStatus("fetching");

      const intelligence: Record<string, unknown> = {
        company_name: params.companyName,
        city: params.city,
        website_url: params.websiteUrl,
        org_number: params.orgNumber,
      };

      if (brregData) {
        intelligence.founding_date = brregData.foundingDate ?? null;
        intelligence.address = brregData.street ?? null;
        intelligence.industry = brregData.industry ?? null;
      }

      if (scrapedData) {
        intelligence.website_description = scrapedData.description ?? null;
        intelligence.website_about_text = scrapedData.summary ?? null;
      }

      fetch("/api/workspace-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enrich_and_generate",
          intelligence,
          company_name: params.companyName,
          city: params.city,
          website_url: params.websiteUrl,
          org_number: params.orgNumber,
          force_new_queries: false,
        }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed");
          return res.json();
        })
        .then((data) => {
          if (data.content?.about_us || data.content?.our_history || data.content?.our_concept) {
            setPrefetchedContent({
              about_us: data.content.about_us ?? "",
              our_history: data.content.our_history ?? "",
              our_concept: data.content.our_concept ?? "",
              menu_description: data.content.menu_description ?? "",
              intelligence: data.intelligence ?? undefined,
            });
            setPrefetchStatus("done");
          } else {
            setPrefetchStatus("done");
          }
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setPrefetchStatus("failed");
        });
    },
    [prefetchStatus, brregData, scrapedData],
  );

  const value: JoinScrapingContextValue = {
    scrapedData: scrapedData as ScrapedData | null,
    scrapeStatus,
    triggerScrape,
    brregData,
    brregCandidates,
    brregLoading,
    brregNeedOrgNumber,
    placesMatch,
    selectBrregCandidate,
    lookupBrreg,
    lookupBrregByOrgNumber,
    prefetchContent,
    prefetchedContent,
    prefetchStatus,
  };

  return <JoinScrapingContext.Provider value={value}>{children}</JoinScrapingContext.Provider>;
}

// ── Hook ──

export function useJoinScraping(): JoinScrapingContextValue {
  const context = useContext(JoinScrapingContext);
  if (!context) {
    throw new Error("useJoinScraping must be used within a JoinScrapingProvider");
  }
  return context;
}
