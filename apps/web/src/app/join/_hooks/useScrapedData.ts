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

  // Use a ref for the poll function so it can call itself without
  // violating React Compiler's "no self-reference in useCallback" rule.
  const pollStatusRef = useRef<(url: string, runId: number) => void>(undefined);

  useEffect(() => {
    pollStatusRef.current = (url: string, runId: number) => {
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
            setScrapedData(data.data ?? null);
            setScrapeStatus("success");
            cleanup();
          } else if (status === "partial") {
            setScrapedData(data.data ?? null);
            setScrapeStatus("partial");
            cleanup();
          } else if (status === "scraping" || status === "pending" || status === "processing") {
            pollStatusRef.current?.(url, runId);
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
    };
  }); // updates pollStatusRef each render cycle inside effect

  const triggerScrape = useCallback(
    async (url: string) => {
      const runId = activeRunIdRef.current + 1;
      activeRunIdRef.current = runId;
      cleanup();
      setScrapeStatus("scraping");
      setScrapedData(null);

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
          setScrapedData(data.data ?? null);
          setScrapeStatus("success");
        } else if (
          data.status === "scraping" ||
          data.status === "pending" ||
          data.status === "processing"
        ) {
          pollStatusRef.current?.(url, runId);
        } else {
          setScrapeStatus("failed");
        }
      } catch {
        setScrapeStatus("failed");
      }
    },
    [cleanup],
  );

  return { scrapedData, scrapeStatus, triggerScrape };
}
