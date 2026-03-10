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

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

export function useScrapedData() {
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>("idle");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

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

  const pollStatus = useCallback(() => {
    attemptRef.current += 1;

    if (attemptRef.current > MAX_POLL_ATTEMPTS) {
      setScrapeStatus("failed");
      cleanup();
      return;
    }

    pollRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/scrape/company");
        if (!res.ok) {
          setScrapeStatus("failed");
          cleanup();
          return;
        }

        const data = await res.json();
        const status = data.scrape_status;

        if (status === "success") {
          setScrapedData(data.parsed_data ?? null);
          setScrapeStatus("success");
          cleanup();
        } else if (status === "partial") {
          setScrapedData(data.parsed_data ?? null);
          setScrapeStatus("partial");
          cleanup();
        } else if (status === "failed") {
          setScrapeStatus("failed");
          cleanup();
        } else {
          // Still scraping — poll again
          pollStatus();
        }
      } catch {
        setScrapeStatus("failed");
        cleanup();
      }
    }, POLL_INTERVAL_MS);
  }, [cleanup]);

  const triggerScrape = useCallback(
    async (url: string) => {
      cleanup();
      setScrapeStatus("scraping");
      setScrapedData(null);

      try {
        const res = await fetch("/api/scrape/company", {
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
          // Scraping completed synchronously — fetch the result
          const pollRes = await fetch("/api/scrape/company");
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            setScrapedData(pollData.parsed_data ?? null);
            setScrapeStatus("success");
          } else {
            setScrapeStatus("failed");
          }
        } else if (data.status === "failed") {
          setScrapeStatus("failed");
        } else {
          // Still processing, start polling
          pollStatus();
        }
      } catch {
        setScrapeStatus("failed");
      }
    },
    [cleanup, pollStatus],
  );

  return { scrapedData, scrapeStatus, triggerScrape };
}
