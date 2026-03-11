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
  industry?: string;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

export function useScrapedData() {
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>("idle");
  const [brregData, setBrregData] = useState<BrregData | null>(null);
  const [brregCandidates, setBrregCandidates] = useState<BrregData[]>([]);
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

  // BRREG lookup — triggered with user-entered company name + city
  const lookupBrreg = useCallback(async (companyName: string, city?: string) => {
    try {
      const params = new URLSearchParams({ name: companyName });
      if (city) params.set("city", city);

      const res = await fetch(`/api/scrape/brreg?${params}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.candidates && data.candidates.length > 0) {
        setBrregCandidates(data.candidates);
        setBrregData(data.candidates[0]);
      } else if (data.match) {
        setBrregData(data.match);
        setBrregCandidates([data.match]);
      }
    } catch {
      // BRREG lookup is best-effort — don't fail the flow
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
      setBrregData(null);
      setBrregCandidates([]);

      try {
        const res = await fetch("/api/scrape/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          setScrapeStatus("failed");
          return;
        }

        const data = await res.json();

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
    selectBrregCandidate,
    lookupBrreg,
  };
}
