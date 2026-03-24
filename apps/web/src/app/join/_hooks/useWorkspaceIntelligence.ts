"use client";

import { useCallback, useRef, useState } from "react";
import { useJoinScraping } from "../_context/JoinScrapingProvider";
import type { JoinState } from "../types";

export type IntelligenceStatus = "idle" | "enriching" | "generating" | "done" | "failed";

export interface WorkspaceIntelligenceContent {
  about_us: string;
  our_history: string;
  our_concept: string;
  menu_description: string;
}

interface WorkspaceIntelligence {
  company_name?: string | null;
  founding_date?: string | null;
  sources?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Hook for AI-powered workspace intelligence (content generation, enrichment).
 *
 * Requires JoinScrapingProvider in tree for BRREG/scrape data.
 * Receives wizard state + updater from the step component props.
 */
export function useWorkspaceIntelligence(
  state?: JoinState,
  updateState?: (patch: Partial<JoinState>) => void,
) {
  const { scrapedData, brregData } = useJoinScraping();

  // Intelligence persists in wizard state (survives step navigation + localStorage)
  const intelligence = (state?.intelligence as WorkspaceIntelligence) ?? null;
  const setIntelligence = useCallback(
    (intel: WorkspaceIntelligence) => {
      updateState?.({ intelligence: intel as Record<string, unknown> });
    },
    [updateState],
  );
  const [content, setContent] = useState<WorkspaceIntelligenceContent | null>(null);
  const [status, setStatus] = useState<IntelligenceStatus>("idle");
  const [gapsRemaining, setGapsRemaining] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const buildInitialIntelligence = useCallback((): WorkspaceIntelligence => {
    const sources: Record<string, unknown> = {};
    const result: Record<string, unknown> = {
      company_name: state?.account.companyName ?? null,
      city: state?.account.city ?? null,
      website_url: state?.account.websiteUrl ?? null,
      org_number: state?.business?.orgNumber ?? null,
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
        urls_scraped: [state?.account.websiteUrl].filter(Boolean),
      };
    }

    if (Object.keys(sources).length > 0) {
      result.sources = sources;
    }

    return result as WorkspaceIntelligence;
  }, [state?.account, state?.business, brregData, scrapedData]);

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
            company_name: state?.account.companyName,
            city: state?.account.city,
            website_url: state?.account.websiteUrl,
            org_number: state?.business?.orgNumber,
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
          // Merge LLM classifications into intelligence so they persist in wizard
          // state and later steps (Step 5) can read them without re-calling the API
          const intel = { ...data.intelligence } as Record<string, unknown>;
          if (data.content) {
            if (data.content.menu_description)
              intel.menu_description = data.content.menu_description;
            if (data.content.restaurant_type)
              intel.llm_restaurant_type = data.content.restaurant_type;
            if (data.content.cuisine_types?.length)
              intel.llm_cuisine_types = data.content.cuisine_types;
            if (data.content.price_category) intel.llm_price_category = data.content.price_category;
          }
          setIntelligence(intel as WorkspaceIntelligence);
        }

        if (data.content?.about_us || data.content?.our_history || data.content?.our_concept) {
          setContent({
            about_us: data.content.about_us ?? "",
            our_history: data.content.our_history ?? "",
            our_concept: data.content.our_concept ?? "",
            menu_description: data.content.menu_description ?? "",
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
    [intelligence, buildInitialIntelligence, state?.account, state?.business],
  );

  const enrichAndGenerate = useCallback(() => callApi(false), [callApi]);
  const rewrite = useCallback(() => callApi(true), [callApi]);

  /**
   * Rewrite a single field. Calls the full generate pipeline but only
   * updates the requested field in the content state. Passes current user
   * text as context so the API can build on what the user wrote.
   */
  const rewriteField = useCallback(
    async (
      field: keyof WorkspaceIntelligenceContent,
      currentText: string,
      mode: "rewrite" | "longer" | "shorter" = "rewrite",
    ) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const currentIntel = intelligence ?? buildInitialIntelligence();

      // "rewrite" re-enriches for fresh data; "longer"/"shorter" just regenerates
      const action = mode === "rewrite" ? "enrich_and_generate" : "generate";

      setStatus(mode === "rewrite" ? "enriching" : "generating");

      try {
        const res = await fetch("/api/workspace-intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            intelligence: {
              ...currentIntel,
              [`current_${field}`]: currentText,
              rewrite_field: field,
              rewrite_mode: mode,
            },
            company_name: state?.account.companyName,
            city: state?.account.city,
            website_url: state?.account.websiteUrl,
            org_number: state?.business?.orgNumber,
            force_new_queries: mode === "rewrite",
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          setStatus("done");
          return;
        }

        const data = await res.json();
        const generated = data.content as WorkspaceIntelligenceContent | null;

        if (generated?.[field]) {
          setContent((prev) => ({
            about_us: prev?.about_us ?? "",
            our_history: prev?.our_history ?? "",
            our_concept: prev?.our_concept ?? "",
            menu_description: prev?.menu_description ?? "",
            [field]: generated[field],
          }));
        }

        setStatus("done");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("done");
      }
    },
    [intelligence, buildInitialIntelligence],
  );

  return { intelligence, content, status, gapsRemaining, enrichAndGenerate, rewrite, rewriteField };
}
