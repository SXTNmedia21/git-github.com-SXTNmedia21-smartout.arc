"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScrapeStatus = "idle" | "scraping" | "success" | "partial" | "failed";

interface ScrapedData {
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

export interface BrregData {
  orgNumber: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  foundingDate?: string;
  industry?: string;
}

/** Google Maps confirmation when BRREG can't find the business.
 * Lets us show "Found on Google: <name>, <address>, <rating>★" while
 * the user enters their org-number manually, so they keep the data we
 * already discovered instead of starting over. */
export interface PlacesMatch {
  name: string;
  address: string;
  category: string;
  rating: number | null;
  reviewCount: number | null;
  phone: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

export function useScrapedData() {
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>("idle");
  const [brregData, setBrregData] = useState<BrregData | null>(null);
  const [brregCandidates, setBrregCandidates] = useState<BrregData[]>([]);
  const [brregLoading, setBrregLoading] = useState(false);
  const [brregNeedOrgNumber, setBrregNeedOrgNumber] = useState(false);
  const [placesMatch, setPlacesMatch] = useState<PlacesMatch | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const activeRunIdRef = useRef(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    attemptRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // BRREG lookup — triggered with user-entered company name + city + industry.
  // Industry is the wizard `account.industry` value (restaurant/cafe/bar/...).
  // Server uses it to filter on næringskode prefix and score candidates.
  const lookupBrreg = useCallback(async (companyName: string, city?: string, industry?: string) => {
    setBrregLoading(true);
    setBrregNeedOrgNumber(false);
    setPlacesMatch(null);
    try {
      const params = new URLSearchParams({ name: companyName });
      if (city) params.set("city", city);
      if (industry) params.set("industry", industry);

      const res = await fetch(`/api/scrape/brreg?${params}`);
      if (!res.ok) return;
      const data = await res.json();

      // Always capture Google Maps confirmation when present, even if
      // BRREG also returned candidates — the UI uses it for context.
      if (data.placesMatch) setPlacesMatch(data.placesMatch as PlacesMatch);

      if (data.candidates && data.candidates.length > 0) {
        setBrregCandidates(data.candidates);
        setBrregData(data.candidates[0]);
        setBrregNeedOrgNumber(false);
      } else if (data.match) {
        setBrregData(data.match);
        setBrregCandidates([data.match]);
        setBrregNeedOrgNumber(false);
      } else {
        setBrregCandidates([]);
        setBrregData(null);
        setBrregNeedOrgNumber(Boolean(data.needOrgNumber));
      }
    } catch {
      // BRREG lookup is best-effort — don't fail the flow
    } finally {
      setBrregLoading(false);
    }
  }, []);

  // Direct lookup by org-number — used when the user enters one manually
  // after we couldn't find their company by name.
  const lookupBrregByOrgNumber = useCallback(async (orgNumber: string) => {
    const cleaned = orgNumber.replace(/\s/g, "");
    if (cleaned.length !== 9) return;
    setBrregLoading(true);
    try {
      const res = await fetch(`/api/scrape/brreg?orgNumber=${cleaned}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.match) {
        setBrregData(data.match);
        setBrregCandidates([data.match]);
        setBrregNeedOrgNumber(false);
      }
    } catch {
      // best-effort
    } finally {
      setBrregLoading(false);
    }
  }, []);

  const handleScrapeSuccess = useCallback((data: ScrapedData) => {
    setScrapedData(data);
    // Don't auto-trigger BRREG from scraped companyName — it's often a tagline.
    // Instead, lookupBrreg is exposed and called with the user-entered name.
  }, []);

  const pollStatus = useCallback(
    (url: string, runId: number) => {
      if (runId !== activeRunIdRef.current) return;
      attemptRef.current += 1;

      if (attemptRef.current > MAX_POLL_ATTEMPTS) {
        setScrapeStatus("failed");
        cleanup();
        return;
      }

      pollRef.current = setTimeout(async () => {
        if (runId !== activeRunIdRef.current) return;
        try {
          const res = await fetch("/api/scrape/public", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          if (!res.ok) {
            setScrapeStatus("failed");
            cleanup();
            return;
          }

          const data = await res.json();
          const status = data.status;

          if (status === "success") {
            handleScrapeSuccess(data.data ?? {});
            setScrapeStatus("success");
            cleanup();
          } else if (status === "partial") {
            handleScrapeSuccess(data.data ?? {});
            setScrapeStatus("partial");
            cleanup();
          } else if (status === "scraping" || status === "pending" || status === "processing") {
            pollStatus(url, runId);
          } else if (status === "failed") {
            setScrapeStatus("failed");
            cleanup();
          } else {
            setScrapeStatus("failed");
            cleanup();
          }
        } catch {
          setScrapeStatus("failed");
          cleanup();
        }
      }, POLL_INTERVAL_MS);
    },
    [cleanup, handleScrapeSuccess],
  );

  const triggerScrape = useCallback(
    async (url: string) => {
      const runId = activeRunIdRef.current + 1;
      activeRunIdRef.current = runId;
      cleanup();
      setScrapeStatus("scraping");
      setScrapedData(null);
      setBrregCandidates([]);

      try {
        const res = await fetch("/api/scrape/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          console.warn("[useScrapedData] Scrape request failed:", res.status);
          setScrapeStatus("failed");
          return;
        }

        const data = await res.json();

        if (data.status === "failed") {
          console.warn("[useScrapedData] Scrape returned failed status for:", url);
          setScrapeStatus("failed");
          return;
        }

        if (data.status === "success") {
          handleScrapeSuccess(data.data ?? {});
          setScrapeStatus("success");
        } else if (
          data.status === "scraping" ||
          data.status === "pending" ||
          data.status === "processing"
        ) {
          pollStatus(url, runId);
        } else {
          setScrapeStatus("failed");
        }
      } catch {
        setScrapeStatus("failed");
      }
    },
    [cleanup, pollStatus, handleScrapeSuccess],
  );

  const selectBrregCandidate = useCallback((candidate: BrregData) => {
    setBrregData(candidate);
  }, []);

  return {
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
  };
}
