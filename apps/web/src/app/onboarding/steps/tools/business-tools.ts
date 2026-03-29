"use client";

/**
 * business-tools.ts — Emma's tool kit for the ConfirmBusiness step.
 *
 * Provides tools to read/update business info, search BRREG, identify
 * a company (creates the workspace), and scrape the website.
 * Mirrors the Botsson actions (updateBusiness, searchCompany, identifyCompany,
 * scrapeWebsite) but uses updateState() instead of direct callbacks.
 */

import { useMemo } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { useSyncRef, useWizardToolKit } from "@/lib/wizard-tools/shared";
import type { OnboardingConfirmState } from "../../types-v2";
import type { BusinessData } from "../../types";

export function useBusinessTools(
  state: OnboardingConfirmState,
  updateState: (patch: Partial<OnboardingConfirmState>) => void,
  next: () => void | Promise<void>,
  back: () => void,
): ClientToolKit {
  const stateRef = useSyncRef(state);
  const updateRef = useSyncRef(updateState);
  const nextRef = useSyncRef(next);
  const backRef = useSyncRef(back);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "update_business",
          description:
            "Update business fields. Pass a JSON object with fields to update: name, orgNumber, website, email, phone, address, postalCode, city, industry, employeeCount.",
          dynamicParameters: [
            {
              name: "fields",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "JSON object with business fields to update",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "search_company",
          description:
            "Search for a Norwegian company by name in Brønnøysundregistrene. Returns candidates with org number, city, industry.",
          dynamicParameters: [
            {
              name: "name",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Company name to search for" },
              required: true,
            },
            {
              name: "city",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "City where the business is located" },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "identify_company",
          description:
            "Confirm and identify a company using its org number. Returns full details: address, CEO, website. Also creates the workspace.",
          dynamicParameters: [
            {
              name: "orgNumber",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Norwegian org number (9 digits) from search_company results",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "scrape_website",
          description:
            "Scrape a website to extract email, phone, locations, departments. Call when you know the business website URL.",
          dynamicParameters: [
            {
              name: "url",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Website URL to scrape" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_business_status",
          description: "Get current business info: name, orgNumber, website, city, industry.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      update_business: (params) => {
        const p = params as Record<string, string>;
        const rawFields = p.fields;
        if (!rawFields) return "Error: fields is required.";

        let parsed: Partial<BusinessData>;
        try {
          parsed = JSON.parse(rawFields) as Partial<BusinessData>;
        } catch {
          return "Error: fields must be a valid JSON object.";
        }

        const current = stateRef.current.business;
        updateRef.current({ business: { ...current, ...parsed } });
        const updated = Object.keys(parsed).join(", ");
        return `Business updated: ${updated}.`;
      },

      search_company: async (params) => {
        const p = params as Record<string, string>;
        const name = p.name?.trim();
        if (!name)
          return JSON.stringify({
            found: false,
            count: 0,
            candidates: [],
            error: "name is required",
          });

        try {
          const qs = new URLSearchParams({ name });
          if (p.city) qs.set("city", p.city);
          const res = await fetch(`/api/brreg/search?${qs.toString()}`);
          if (!res.ok)
            return JSON.stringify({
              found: false,
              count: 0,
              candidates: [],
              error: `HTTP ${res.status}`,
            });
          const data = (await res.json()) as { candidates?: unknown[] };
          const candidates = data.candidates ?? [];
          return JSON.stringify({
            found: candidates.length > 0,
            count: candidates.length,
            candidates,
          });
        } catch {
          return JSON.stringify({ found: false, count: 0, candidates: [], error: "Search failed" });
        }
      },

      identify_company: async (params) => {
        const p = params as Record<string, string>;
        const orgNumber = p.orgNumber?.trim();
        if (!orgNumber) return JSON.stringify({ success: false, error: "orgNumber is required" });

        try {
          const res = await fetch(`/api/brreg/identify?orgNumber=${encodeURIComponent(orgNumber)}`);
          if (!res.ok) return JSON.stringify({ success: false, error: `HTTP ${res.status}` });
          const data = (await res.json()) as Record<string, unknown>;

          // Merge returned business data into state if present
          if (data.business) {
            const current = stateRef.current.business;
            updateRef.current({
              business: { ...current, ...(data.business as Partial<BusinessData>) },
            });
          }
          if (data.workspaceId) {
            updateRef.current({ workspaceId: data.workspaceId as string });
          }

          return JSON.stringify({ success: true, ...data });
        } catch {
          return JSON.stringify({ success: false, error: "Identification failed" });
        }
      },

      scrape_website: async (params) => {
        const p = params as Record<string, string>;
        const url = p.url?.trim();
        if (!url) return JSON.stringify({ success: false, error: "url is required" });

        try {
          const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
          if (!res.ok) return JSON.stringify({ success: false, error: `HTTP ${res.status}` });
          const data = (await res.json()) as { scrapedData?: Record<string, unknown> };

          // Merge scraped data into business state if available
          if (data.scrapedData) {
            const current = stateRef.current.business;
            const { email, phone, website, description, openingHours } =
              data.scrapedData as Partial<BusinessData>;
            const merge: Partial<BusinessData> = {};
            if (email && !current.email) merge.email = email;
            if (phone && !current.phone) merge.phone = phone;
            if (website && !current.website) merge.website = website;
            if (description && !current.description) merge.description = description;
            if (openingHours && !current.openingHours) merge.openingHours = openingHours;
            if (Object.keys(merge).length > 0) {
              updateRef.current({ business: { ...current, ...merge } });
            }
          }

          return JSON.stringify({ success: true, scrapedData: data.scrapedData ?? null });
        } catch {
          return JSON.stringify({ success: false, scrapedData: null, error: "Scraping failed" });
        }
      },

      get_business_status: () => {
        const b = stateRef.current.business;
        const filled = [
          b.name,
          b.orgNumber,
          b.website,
          b.email,
          b.phone,
          b.address,
          b.city,
          b.industry,
        ].filter(Boolean).length;
        return `Business: "${b.name || "(not set)"}" | Org: ${b.orgNumber || "unknown"} | Website: ${b.website || "none"} | City: ${b.city || "unknown"} | Industry: ${b.industry || "unknown"} | Fields filled: ${filled}/8`;
      },
    }),
    [],
  );

  return useWizardToolKit(definitions, implementations, nextRef, backRef);
}
