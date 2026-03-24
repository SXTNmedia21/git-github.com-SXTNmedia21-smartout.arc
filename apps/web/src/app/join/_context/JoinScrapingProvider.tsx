"use client";

/**
 * JoinScrapingProvider — side-context for website scraping and BRREG lookups.
 *
 * WizardShell manages step state and navigation. This provider wraps the
 * useScrapedData hook and exposes scraping/BRREG data to step components
 * via useJoinScraping(). It sits OUTSIDE WizardShell in the component tree
 * so that scraping state survives step transitions.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useScrapedData, type ScrapeStatus, type BrregData } from "../_hooks/useScrapedData";

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

// ── Context value ──

export interface JoinScrapingContextValue {
  scrapedData: ScrapedData | null;
  scrapeStatus: ScrapeStatus;
  triggerScrape: (url: string) => Promise<void>;
  brregData: BrregData | null;
  brregCandidates: BrregData[];
  selectBrregCandidate: (candidate: BrregData) => void;
  lookupBrreg: (companyName: string, city?: string) => Promise<void>;
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
    selectBrregCandidate,
    lookupBrreg,
  } = useScrapedData();

  const value: JoinScrapingContextValue = {
    scrapedData: scrapedData as ScrapedData | null,
    scrapeStatus,
    triggerScrape,
    brregData,
    brregCandidates,
    selectBrregCandidate,
    lookupBrreg,
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
