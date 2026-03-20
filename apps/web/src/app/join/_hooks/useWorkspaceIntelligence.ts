"use client";

import { useCallback, useRef, useState } from "react";
import { useSignupWizard } from "./useSignupWizard";

export type IntelligenceStatus = "idle" | "enriching" | "generating" | "done" | "failed";

export interface WorkspaceIntelligenceContent {
  about_us: string;
  our_history: string;
  our_concept: string;
}

interface WorkspaceIntelligence {
  company_name?: string | null;
  founding_date?: string | null;
  sources?: Record<string, unknown>;
  [key: string]: unknown;
}

export function useWorkspaceIntelligence() {
  const { state, updateStep, scrapedData, brregData } = useSignupWizard();
  // Intelligence persists in wizard state (survives step navigation + localStorage)
  const intelligence = (state.intelligence as WorkspaceIntelligence) ?? null;
  const setIntelligence = useCallback(
    (intel: WorkspaceIntelligence) => updateStep("intelligence", intel as Record<string, unknown>),
    [updateStep],
  );
  const [content, setContent] = useState<WorkspaceIntelligenceContent | null>(null);
  const [status, setStatus] = useState<IntelligenceStatus>("idle");
  const [gapsRemaining, setGapsRemaining] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const buildInitialIntelligence = useCallback((): WorkspaceIntelligence => {
    const sources: Record<string, unknown> = {};
    const result: Record<string, unknown> = {
      company_name: state.step1.companyName ?? null,
      city: state.step1.city ?? null,
      website_url: state.step1.websiteUrl ?? null,
      org_number: state.step2?.orgNumber ?? null,
    };

    if (brregData) {
      result.founding_date = brregData.foundingDate ?? null;
      result.address = brregData.street ?? null;
      result.industry = brregData.industry ?? null;
      sources.brreg = { fetched_at: new Date().toISOString() };
    }

    if (scrapedData) {
      result.website_description = scrapedData.description ?? null;
      result.website_about_text = scrapedData.summary ?? null;
      result.email = scrapedData.email ?? null;
      result.phone = scrapedData.phone ?? null;
      result.logo_url = scrapedData.logoUrl ?? null;
      result.social_links = scrapedData.socialLinks ?? {};
      sources.scrape = {
        fetched_at: new Date().toISOString(),
        urls_scraped: [state.step1.websiteUrl].filter(Boolean),
      };
    }

    if (Object.keys(sources).length > 0) {
      result.sources = sources;
    }

    return result as WorkspaceIntelligence;
  }, [state.step1, state.step2, brregData, scrapedData]);

  const callApi = useCallback(
    async (forceNewQueries: boolean) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const currentIntel = intelligence ?? buildInitialIntelligence();

      setStatus("enriching");
      setContent(null);

      try {
        const res = await fetch("/api/workspace-intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "enrich_and_generate",
            intelligence: currentIntel,
            company_name: state.step1.companyName,
            city: state.step1.city,
            website_url: state.step1.websiteUrl,
            org_number: state.step2?.orgNumber,
            force_new_queries: forceNewQueries,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          setStatus("failed");
          return;
        }

        const data = await res.json();

        if (data.intelligence) {
          setIntelligence(data.intelligence as WorkspaceIntelligence);
        }

        if (data.content?.about_us || data.content?.our_history || data.content?.our_concept) {
          setContent({
            about_us: data.content.about_us ?? "",
            our_history: data.content.our_history ?? "",
            our_concept: data.content.our_concept ?? "",
          });
          setStatus("done");
        } else if (data.error) {
          setStatus("failed");
        } else {
          setStatus("done");
        }

        setGapsRemaining(data.gaps_remaining ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("failed");
      }
    },
    [intelligence, buildInitialIntelligence, state.step1, state.step2],
  );

  const enrichAndGenerate = useCallback(() => callApi(false), [callApi]);
  const rewrite = useCallback(() => callApi(true), [callApi]);

  return { intelligence, content, status, gapsRemaining, enrichAndGenerate, rewrite };
}
