"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { invokeEdgeFunction } from "@/lib/supabase-edge-invoke";
import type { Json } from "@smartout/supabase";
import type {
  OnboardingState,
  OnboardingSection,
  BusinessData,
  SeasonData,
  DepartmentOption,
  LocationData,
  ProcedureData,
  ContractData,
  Memory,
  BrregCandidate,
} from "../types";
import { ONBOARDING_SECTIONS, EMPTY_BUSINESS_DATA } from "../types";
import { mergeBusinessData } from "../lib/data-merger";
import type { PlacesData } from "../lib/data-merger";
import { suggestSeason } from "../lib/season-suggestions";
import { buildWorkspaceFinalizationRequest } from "../lib/finalization";
import {
  getDepartmentsForIndustry,
  getProceduresForIndustry,
  resolveNaceCode,
} from "../lib/industry-defaults";

const SAVE_DEBOUNCE_MS = 500;

const INITIAL_SECTIONS = ONBOARDING_SECTIONS.map((s, i) => ({
  section: s,
  status: (i === 0 ? "active" : "locked") as "locked" | "active" | "completed",
}));

export interface OnboardingActions {
  triggerScrape: (
    url: string,
    orgNumber: string,
    companyName?: string,
    city?: string,
  ) => Promise<void>;
  searchCompany: (name: string, city?: string) => Promise<BrregCandidate[]>;
  identifyCompany: (orgNumber: string) => Promise<{
    company: Record<string, unknown>;
    places: unknown;
    workspaceId: string | null;
  } | null>;
  scrapeWebsite: (url: string) => Promise<{ scrapedData: Record<string, unknown> | null } | null>;
  brregCandidates: BrregCandidate[];
  updateBusiness: (partial: Partial<BusinessData>) => void;
  updateSeason: (partial: Partial<SeasonData>) => void;
  updateContract: (partial: Partial<ContractData>) => void;
  toggleDepartment: (id: string) => void;
  addCustomDepartment: (name: string) => void;
  addLocation: (name: string, type?: LocationData["type"]) => void;
  removeLocation: (id: string) => void;
  addZone: (locationId: string, zoneName: string) => void;
  removeZone: (locationId: string, zoneId: string) => void;
  toggleProcedure: (id: string) => void;
  addCustomProcedure: (name: string) => void;
  completeSection: (section: OnboardingSection) => void;
  saveMemory: (content: string) => void;
  removeMemory: (id: string) => void;
  resetScrape: () => void;
  finalize: () => Promise<{ workspaceId: string; slug: string | null }>;
  reset: () => Promise<void>;
}

export function useOnboardingState(): OnboardingState & OnboardingActions {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const requestedWorkspaceId = searchParams.get("ws") ?? searchParams.get("workspaceId");

  const [currentSection, setCurrentSection] = useState<OnboardingSection>("hero");
  const [sections, setSections] = useState(INITIAL_SECTIONS);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [onboardingWorkspaceId, setOnboardingWorkspaceId] = useState<string | null>(null);

  const [business, setBusiness] = useState<BusinessData>(EMPTY_BUSINESS_DATA);
  const [season, setSeason] = useState<SeasonData>(suggestSeason());
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [procedures, setProcedures] = useState<ProcedureData[]>([]);
  const [contract, setContract] = useState<ContractData>({
    templateGenerated: false,
    previewUrl: null,
    contractId: null,
    contractSent: false,
    signingUrl: null,
  });

  const [memories, setMemories] = useState<Memory[]>([]);

  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "scraping" | "done" | "error">("idle");
  const [scrapeSource, setScrapeSource] = useState<"url" | "org" | "both" | "name" | null>(null);
  const [brregCandidates, setBrregCandidates] = useState<BrregCandidate[]>([]);

  const [activatedWorkspaceId, setActivatedWorkspaceId] = useState<string | null>(null);
  const [activatedWorkspaceSlug, setActivatedWorkspaceSlug] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasResumed = useRef(false);

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setIsAuthenticated(true);
        setUserId(user.id);
      }
    }
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Resume session — check for existing onboarding workspace first, then fallback to onboarding_session
  useEffect(() => {
    if (!isAuthenticated || !userId || hasResumed.current) return;
    hasResumed.current = true;

    async function resume() {
      // Try to resume from a workspace that hasn't completed onboarding
      const { data: wsData } = await supabase
        .from("profile")
        .select(
          "workspace_id, workspace:workspace_id(workspace_id, onboarding_completed, intelligence_data, name)",
        )
        .eq("user_id", userId!)
        .limit(10);

      if (wsData) {
        const onboardingProfiles = wsData.filter((p) => {
          const ws = p.workspace as unknown as {
            onboarding_completed: boolean;
            workspace_id: string;
          } | null;
          return ws?.onboarding_completed === false;
        });

        const onboardingProfile =
          onboardingProfiles.find((p) => {
            const ws = p.workspace as unknown as {
              workspace_id: string;
            } | null;
            return ws?.workspace_id === requestedWorkspaceId;
          }) ?? onboardingProfiles[0];

        if (onboardingProfile) {
          const ws = onboardingProfile.workspace as unknown as {
            workspace_id: string;
            intelligence_data: Record<string, unknown> | null;
            name: string;
          };

          setOnboardingWorkspaceId(ws.workspace_id);

          // Restore business data from intelligence_data
          const intel = ws.intelligence_data;
          if (intel) {
            const scraped = intel.scraped as Record<string, unknown> | null;
            const brreg = intel.brreg as Record<string, unknown> | null;
            const places = intel.places as PlacesData | null;
            const joinIntake = intel.join_intake as {
              businessNarrative?: { aboutUs?: string; ourHistory?: string; ourConcept?: string };
              menu?: {
                restaurantType?: string;
                cuisineTypes?: string[];
                priceCategory?: string;
                menuDescription?: string;
              };
            } | null;

            const merged = mergeBusinessData(scraped, brreg, places);
            const sourceUrl = intel.source_url as string | null;
            if (!merged.website && sourceUrl && !sourceUrl.startsWith("brreg:")) {
              merged.website = sourceUrl;
            }
            if (!merged.description) {
              merged.description =
                joinIntake?.businessNarrative?.aboutUs ??
                joinIntake?.businessNarrative?.ourConcept ??
                "";
            }

            // Restore join intake fields that mergeBusinessData doesn't handle
            if (joinIntake) {
              const narrative = joinIntake.businessNarrative;
              if (narrative?.ourHistory) merged.ourHistory = narrative.ourHistory;
              if (narrative?.ourConcept) merged.ourConcept = narrative.ourConcept;

              const menu = joinIntake.menu;
              if (menu?.restaurantType) merged.restaurantType = menu.restaurantType;
              if (menu?.cuisineTypes?.length) merged.cuisineTypes = menu.cuisineTypes;
              if (menu?.priceCategory) merged.priceCategory = menu.priceCategory;
              if (menu?.menuDescription) merged.menuDescription = menu.menuDescription;
            }

            // Restore scraped fields not covered by mergeBusinessData
            const scrapedRaw = scraped as Record<string, unknown> | null;
            if (scrapedRaw) {
              const socialLinks = scrapedRaw.socialLinks as Record<string, string> | undefined;
              if (socialLinks && Object.keys(socialLinks).length > 0)
                merged.socialLinks = socialLinks;
              if (scrapedRaw.reservationUrl)
                merged.reservationUrl = scrapedRaw.reservationUrl as string;
              if (scrapedRaw.menus)
                merged.menuLinks = scrapedRaw.menus as Array<{ href: string; text: string }>;
              if (scrapedRaw.logoUrl && !merged.logoUrl)
                merged.logoUrl = scrapedRaw.logoUrl as string;
            }

            setBusiness(merged);
            setScrapeStatus("done");

            // Auto-populate departments + procedures from industry
            const nace = merged.industryCode || resolveNaceCode(merged.industry);
            const suggestedDepts = getDepartmentsForIndustry(nace);
            setDepartments(suggestedDepts);
            const suggestedProcs = getProceduresForIndustry(nace);
            setProcedures(suggestedProcs);

            const restoredLocations = Array.isArray(scraped?.locations)
              ? scraped.locations
                  .filter(
                    (location): location is { name: string; type?: string } =>
                      typeof location === "object" &&
                      location !== null &&
                      typeof location.name === "string",
                  )
                  .map((location, index) => ({
                    id: `loc-resume-${index}`,
                    name: location.name,
                    type:
                      location.type === "outdoor" ||
                      location.type === "satellite" ||
                      location.type === "other"
                        ? (location.type as LocationData["type"])
                        : "main",
                    zones: [],
                  }))
              : [];

            if (restoredLocations.length > 0) {
              setLocations(restoredLocations);
            }
          }

          return; // Resumed from workspace
        }
      }

      // Fallback: try legacy onboarding_session
      const { data } = await supabase
        .from("onboarding_session")
        .select("id, current_step, scraped_data")
        .eq("user_id", userId!)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;

      setSessionId(data.id);

      if (data.scraped_data) {
        const scraped = data.scraped_data as Record<string, unknown>;
        setBusiness((prev) => ({
          ...prev,
          name: (scraped.companyName as string) ?? prev.name,
          email: (scraped.email as string) ?? prev.email,
          phone: (scraped.phone as string) ?? prev.phone,
          description: (scraped.summary as string) ?? prev.description,
        }));
        setScrapeStatus("done");
      }
    }

    resume();
  }, [isAuthenticated, requestedWorkspaceId, userId]);

  // Auto-save with debounce — save to workspace intelligence_data if we have one
  const save = useCallback(
    async (sectionName: OnboardingSection) => {
      if (!isAuthenticated || !userId) return;

      if (onboardingWorkspaceId) {
        // Merge into existing intelligence_data — never overwrite pipeline results
        const now = new Date().toISOString();
        const { data: existing } = await supabase
          .from("workspace")
          .select("intelligence_data")
          .eq("workspace_id", onboardingWorkspaceId)
          .single();

        const existingData = (existing?.intelligence_data as Record<string, unknown>) ?? {};

        await supabase
          .from("workspace")
          .update({
            intelligence_data: {
              ...existingData,
              last_saved_section: sectionName,
              updated_at: now,
              business_snapshot: {
                name: business.name,
                email: business.email,
                phone: business.phone,
                description: business.description,
              },
            } as unknown as Json,
          })
          .eq("workspace_id", onboardingWorkspaceId);
      } else {
        // Legacy: save to onboarding_session
        const stepIndex = ONBOARDING_SECTIONS.indexOf(sectionName);
        const now = new Date().toISOString();
        const payload = {
          user_id: userId,
          current_step: stepIndex,
          scraped_data: {
            companyName: business.name,
            email: business.email,
            phone: business.phone,
            summary: business.description,
          } as unknown as Json,
          updated_at: now,
        };

        if (sessionId) {
          await supabase.from("onboarding_session").update(payload).eq("id", sessionId);
        } else {
          const { data } = await supabase
            .from("onboarding_session")
            .insert({ ...payload, started_at: now })
            .select("id")
            .single();
          if (data) setSessionId(data.id);
        }
      }
    },
    [isAuthenticated, userId, sessionId, onboardingWorkspaceId, business, supabase],
  );

  // Section management
  const completeSection = useCallback(
    (section: OnboardingSection) => {
      setSections((prev) => {
        const idx = ONBOARDING_SECTIONS.indexOf(section);
        return prev.map((s, i) => {
          if (i === idx) return { ...s, status: "completed" as const };
          if (i === idx + 1) return { ...s, status: "active" as const };
          return s;
        });
      });

      // Emit journey event — drives engine_state advancement
      const stepIndex = ONBOARDING_SECTIONS.indexOf(section);
      if (userId) {
        emit({
          event: "wizard step_completed",
          workspace_id: onboardingWorkspaceId ?? null,
          actor_id: userId,
          properties: {
            data: {
              wizard_id: "onboarding",
              step_id: section,
              step_index: stepIndex,
            },
          },
        }).catch((e: unknown) => console.error("[onboarding] emit failed:", e));
      }

      const nextIdx = ONBOARDING_SECTIONS.indexOf(section) + 1;
      const next = ONBOARDING_SECTIONS[nextIdx];
      if (next) {
        setCurrentSection(next);

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => save(next), SAVE_DEBOUNCE_MS);
      }
    },
    [save, userId, onboardingWorkspaceId],
  );

  // Scraping
  const triggerScrape = useCallback(
    async (url: string, orgNumber: string, companyName?: string, city?: string) => {
      setScrapeStatus("scraping");
      const source =
        companyName && !url && !orgNumber
          ? "name"
          : url && orgNumber
            ? "both"
            : url
              ? "url"
              : "org";
      setScrapeSource(source as "url" | "org" | "both" | "name");

      try {
        const { data, error } = await invokeEdgeFunction<{
          scrapedData:
            | (Record<string, unknown> & { locations?: { name: string; type?: string }[] })
            | null;
          brregData: Record<string, unknown> | null;
          placesData: unknown;
          workspaceId?: string;
        }>(supabase, "gather-workspace-intelligence", {
          body: {
            url: url || undefined,
            orgNumber: orgNumber || undefined,
            companyName: companyName || undefined,
            city: city || undefined,
          },
        });

        if (error) throw error;
        if (!data) throw new Error("No data returned from intelligence pipeline");

        const { scrapedData, brregData, placesData, workspaceId } = data;

        // Store the workspace ID from the pipeline
        if (workspaceId) {
          setOnboardingWorkspaceId(workspaceId);
        }

        const merged = mergeBusinessData(scrapedData, brregData, placesData as PlacesData | null);

        if (!merged.website && url) {
          merged.website = url;
        }

        setBusiness(merged);
        setScrapeStatus("done");

        // Auto-populate departments + procedures from industry
        const nace = merged.industryCode || resolveNaceCode(merged.industry);
        const suggestedDepts = getDepartmentsForIndustry(nace);
        setDepartments(suggestedDepts);
        const suggestedProcs = getProceduresForIndustry(nace);
        setProcedures(suggestedProcs);

        // Auto-populate locations from scraped data
        if (scrapedData?.locations?.length) {
          const newLocs = (scrapedData.locations as { name: string; type?: string }[]).map(
            (loc, i) => ({
              id: `loc-scrape-${Date.now()}-${i}`,
              name: loc.name,
              type: (loc.type === "Outdoor" ? "outdoor" : "main") as LocationData["type"],
              zones: [] as { id: string; name: string }[],
            }),
          );
          setLocations((prev) => [...prev, ...newLocs]);
        }
      } catch {
        setScrapeStatus("error");
      }
    },
    [supabase],
  );

  const updateBusiness = useCallback((partial: Partial<BusinessData>) => {
    setBusiness((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateSeason = useCallback((partial: Partial<SeasonData>) => {
    setSeason((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateContract = useCallback((partial: Partial<ContractData>) => {
    setContract((prev) => ({ ...prev, ...partial }));
  }, []);

  const toggleDepartment = useCallback((id: string) => {
    setDepartments((prev) => prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)));
  }, []);

  const addCustomDepartment = useCallback((name: string) => {
    setDepartments((prev) => {
      const id = `custom-${Date.now()}-${prev.length}`;
      return [...prev, { id, name, icon: "plus", selected: true, positions: [] }];
    });
  }, []);

  // Locations
  const addLocation = useCallback((name: string, type: LocationData["type"] = "main") => {
    setLocations((prev) => [
      ...prev,
      { id: `loc-${Date.now()}-${prev.length}`, name, type, zones: [] },
    ]);
  }, []);

  const removeLocation = useCallback((id: string) => {
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addZone = useCallback((locationId: string, zoneName: string) => {
    setLocations((prev) =>
      prev.map((loc) =>
        loc.id === locationId
          ? {
              ...loc,
              zones: [
                ...loc.zones,
                { id: `zone-${Date.now()}-${loc.zones.length}`, name: zoneName },
              ],
            }
          : loc,
      ),
    );
  }, []);

  const removeZone = useCallback((locationId: string, zoneId: string) => {
    setLocations((prev) =>
      prev.map((loc) =>
        loc.id === locationId ? { ...loc, zones: loc.zones.filter((z) => z.id !== zoneId) } : loc,
      ),
    );
  }, []);

  // Procedures
  const toggleProcedure = useCallback((id: string) => {
    setProcedures((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }, []);

  const addCustomProcedure = useCallback((name: string) => {
    setProcedures((prev) => [
      ...prev,
      { id: `proc-custom-${Date.now()}-${prev.length}`, name, selected: true, isCustom: true },
    ]);
  }, []);

  // Agent-driven memories — knowledge context saved by Botsson
  const saveMemory = useCallback((content: string) => {
    setMemories((prev) => [
      ...prev,
      { id: `mem-${Date.now()}-${prev.length}`, content, savedAt: new Date() },
    ]);
  }, []);

  const removeMemory = useCallback((id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Reset scrape — go back to input fields
  const resetScrape = useCallback(() => {
    setScrapeStatus("idle");
    setScrapeSource(null);
    setBusiness(EMPTY_BUSINESS_DATA);
    setDepartments([]);
    setBrregCandidates([]);
  }, []);

  // Progressive intelligence: search company by name
  const searchCompany = useCallback(
    async (name: string, city?: string): Promise<BrregCandidate[]> => {
      try {
        const { data, error } = await invokeEdgeFunction<{ candidates: BrregCandidate[] }>(
          supabase,
          "search-brreg",
          { body: { name, city: city || undefined } },
        );

        if (error) throw error;

        const candidates: BrregCandidate[] = data?.candidates || [];
        setBrregCandidates(candidates);
        return candidates;
      } catch {
        return [];
      }
    },
    [supabase],
  );

  // Progressive intelligence: identify company by org number
  const identifyCompany = useCallback(
    async (orgNumber: string) => {
      try {
        setScrapeStatus("scraping");
        setScrapeSource("org");

        const { data, error } = await invokeEdgeFunction<{
          company: Record<string, unknown> | null;
          places: unknown;
          workspaceId?: string;
        }>(supabase, "identify-company", {
          body: { orgNumber },
        });

        if (error) throw error;
        if (!data) throw new Error("No data returned from company identification");

        const { company, places, workspaceId } = data;

        // Store workspace ID
        if (workspaceId) {
          setOnboardingWorkspaceId(workspaceId);
        }

        // Merge into business data
        const merged = mergeBusinessData(null, company, places as PlacesData | null);
        setBusiness(merged);
        setScrapeStatus("done");

        // Auto-populate departments + procedures from industry
        const nace = merged.industryCode || resolveNaceCode(merged.industry);
        const suggestedDepts = getDepartmentsForIndustry(nace);
        setDepartments(suggestedDepts);
        const suggestedProcs = getProceduresForIndustry(nace);
        setProcedures(suggestedProcs);

        return {
          company: company ?? ({} as Record<string, unknown>),
          places,
          workspaceId: workspaceId ?? null,
        };
      } catch {
        setScrapeStatus("error");
        return null;
      }
    },
    [supabase],
  );

  // Progressive intelligence: scrape a website
  const scrapeWebsite = useCallback(
    async (url: string) => {
      try {
        const { data, error } = await invokeEdgeFunction<{
          scrapedData: Record<string, unknown> | null;
        }>(supabase, "scrape-website", {
          body: { url },
        });

        if (error) throw error;

        const scrapedData = data?.scrapedData ?? null;

        if (scrapedData) {
          // Merge scraped data into existing business state
          setBusiness((prev) => ({
            ...prev,
            email: (scrapedData.email as string) || prev.email,
            phone: (scrapedData.phone as string) || prev.phone,
            description: (scrapedData.summary as string) || prev.description,
            website: prev.website || url,
          }));

          // Add scraped locations
          if (Array.isArray(scrapedData.locations) && scrapedData.locations.length > 0) {
            const newLocs = (scrapedData.locations as { name: string; type?: string }[]).map(
              (loc, i) => ({
                id: `loc-scrape-${Date.now()}-${i}`,
                name: loc.name,
                type: (loc.type === "Outdoor" ? "outdoor" : "main") as LocationData["type"],
                zones: [] as { id: string; name: string }[],
              }),
            );
            setLocations((prev) => [...prev, ...newLocs]);
          }
        }

        return { scrapedData };
      } catch {
        return null;
      }
    },
    [supabase],
  );

  // Reset — clear all state and delete onboarding workspace or DB session
  const reset = useCallback(async () => {
    // Delete onboarding workspace if one exists (only if still in onboarding state)
    if (onboardingWorkspaceId) {
      // Verify it's still in onboarding state before deleting
      const { data: ws } = await supabase
        .from("workspace")
        .select("onboarding_completed")
        .eq("workspace_id", onboardingWorkspaceId)
        .single();

      if (ws && !ws.onboarding_completed) {
        // Delete profile, company_member, workspace, company in order
        // The cascade should handle most of this, but be explicit
        await supabase.from("profile").delete().eq("workspace_id", onboardingWorkspaceId);
        await supabase.from("workspace").delete().eq("workspace_id", onboardingWorkspaceId);
      }
    }

    // Legacy: delete DB session if one exists
    if (sessionId) {
      await supabase.from("onboarding_session").delete().eq("id", sessionId);
    }

    // Clear pending save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // Reset all local state
    setCurrentSection("hero");
    setSections(INITIAL_SECTIONS);
    setBusiness(EMPTY_BUSINESS_DATA);
    setSeason(suggestSeason());
    setDepartments([]);
    setLocations([]);
    setProcedures([]);
    setMemories([]);
    setContract({
      templateGenerated: false,
      previewUrl: null,
      contractId: null,
      contractSent: false,
      signingUrl: null,
    });
    setScrapeStatus("idle");
    setScrapeSource(null);
    setBrregCandidates([]);
    setSessionId(null);
    setOnboardingWorkspaceId(null);
    setActivatedWorkspaceId(null);
    setActivatedWorkspaceSlug(null);

    // Allow session resume to fire again on next auth check
    hasResumed.current = false;
  }, [sessionId, onboardingWorkspaceId, supabase]);

  // Finalize — use finalize-workspace if we have an onboarding workspace, else activate-workspace
  const finalize = useCallback(async (): Promise<{ workspaceId: string; slug: string | null }> => {
    try {
      const selectedDepts = departments
        .filter((d) => d.selected)
        .map((d) => ({
          name: d.name,
          positions: d.positions
            .filter((p) => p.selected)
            .map((p) => ({ name: p.name, isLeader: p.isLeader })),
        }));

      const selectedProcs = procedures.filter((p) => p.selected).map((p) => p.name);

      const locationPayload = locations.map((loc) => ({
        name: loc.name,
        type: loc.type,
        zones: loc.zones.map((z) => z.name),
      }));

      const workspacePayload = {
        name: business.name || "Min bedrift",
        legalName: business.legalName,
        orgNumber: business.orgNumber,
        email: business.email,
        phone: business.phone,
        address: [business.address, [business.postalCode, business.city].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", "),
        industry: business.industry,
        industryCode: business.industryCode,
        employeeCount: business.employeeCount,
        summary: business.description,
        website: business.website,
        departments: selectedDepts,
        locations: locationPayload,
        procedures: selectedProcs,
        seasonName: season.name || "Sesong 1",
        seasonType: "default",
        seasonStartDate: season.startDate,
        seasonEndDate: season.endDate,
        contractId: contract?.contractId ?? null,
        // Business narrative + menu data for company_details upsert
        aboutUs: business.description,
        ourHistory: business.ourHistory,
        ourConcept: business.ourConcept,
        restaurantType: business.restaurantType,
        cuisineTypes: business.cuisineTypes,
        priceCategory: business.priceCategory,
        menuDescription: business.menuDescription,
        socialLinks: business.socialLinks,
        logoUrl: business.logoUrl,
      };

      const finalizationRequest = buildWorkspaceFinalizationRequest(
        onboardingWorkspaceId,
        workspacePayload,
      );

      const { data: finalizationResult, error: finalizationError } = await invokeEdgeFunction<{
        workspaceId?: string;
        slug?: string | null;
      }>(supabase, finalizationRequest.functionName, { body: finalizationRequest.body });

      if (finalizationError) {
        throw finalizationError;
      }

      const response = finalizationResult;

      const workspaceId = response?.workspaceId;
      let slug = response?.slug ?? null;

      if (workspaceId && !slug) {
        const { data: ws } = await supabase
          .from("workspace")
          .select("slug")
          .eq("workspace_id", workspaceId)
          .single();
        slug = ws?.slug ?? null;
      }

      if (!workspaceId) throw new Error("No workspace ID returned");

      setActivatedWorkspaceId(workspaceId);
      setActivatedWorkspaceSlug(slug);

      // Emit finalization telemetry
      if (userId) {
        emit({
          event: "wizard completed",
          workspace_id: workspaceId,
          actor_id: userId,
          properties: {
            data: {
              wizard_id: "onboarding",
              workspace_id: workspaceId,
            },
          },
        }).catch((e: unknown) => console.error("[onboarding] emit failed:", e));
      }

      // Mark legacy session as completed if it exists
      if (sessionId) {
        await supabase
          .from("onboarding_session")
          .update({
            workspace_id: workspaceId,
            completed_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      }

      return { workspaceId, slug };
    } catch (err) {
      console.error("Finalization error:", err);
      throw err;
    }
  }, [
    business,
    season,
    departments,
    locations,
    procedures,
    contract,
    sessionId,
    onboardingWorkspaceId,
    supabase,
  ]);

  return {
    currentSection,
    sections,
    isAuthenticated,
    userId,
    sessionId,
    onboardingWorkspaceId,
    business,
    season,
    departments,
    locations,
    procedures,
    contract,
    memories,
    scrapeStatus,
    scrapeSource,
    activatedWorkspaceId,
    activatedWorkspaceSlug,
    brregCandidates,
    triggerScrape,
    searchCompany,
    identifyCompany,
    scrapeWebsite,
    updateBusiness,
    updateSeason,
    updateContract,
    toggleDepartment,
    addCustomDepartment,
    addLocation,
    removeLocation,
    addZone,
    removeZone,
    toggleProcedure,
    addCustomProcedure,
    completeSection,
    saveMemory,
    removeMemory,
    resetScrape,
    finalize,
    reset,
  };
}
