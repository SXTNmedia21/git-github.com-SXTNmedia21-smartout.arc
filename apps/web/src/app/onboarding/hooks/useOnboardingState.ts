"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import type {
  OnboardingState,
  OnboardingSection,
  BusinessData,
  SeasonData,
  DepartmentOption,
  ContractData,
  Memory,
} from "../types";
import { ONBOARDING_SECTIONS, EMPTY_BUSINESS_DATA } from "../types";
import { mergeBusinessData } from "../lib/data-merger";
import type { PlacesData } from "../lib/data-merger";
import { suggestSeason } from "../lib/season-suggestions";
import { getDepartmentsForIndustry, resolveNaceCode } from "../lib/industry-defaults";

const SAVE_DEBOUNCE_MS = 500;

const INITIAL_SECTIONS = ONBOARDING_SECTIONS.map((s, i) => ({
  section: s,
  status: (i === 0 ? "active" : "locked") as "locked" | "active" | "completed",
}));

export interface OnboardingActions {
  triggerScrape: (url: string, orgNumber: string) => Promise<void>;
  updateBusiness: (partial: Partial<BusinessData>) => void;
  updateSeason: (partial: Partial<SeasonData>) => void;
  updateContract: (partial: Partial<ContractData>) => void;
  toggleDepartment: (id: string) => void;
  addCustomDepartment: (name: string) => void;
  completeSection: (section: OnboardingSection) => void;
  saveMemory: (content: string) => void;
  removeMemory: (id: string) => void;
  resetScrape: () => void;
  finalize: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useOnboardingState(): OnboardingState & OnboardingActions {
  const supabase = createClient();

  const [currentSection, setCurrentSection] = useState<OnboardingSection>("hero");
  const [sections, setSections] = useState(INITIAL_SECTIONS);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [onboardingWorkspaceId, setOnboardingWorkspaceId] = useState<string | null>(null);

  const [business, setBusiness] = useState<BusinessData>(EMPTY_BUSINESS_DATA);
  const [season, setSeason] = useState<SeasonData>(suggestSeason());
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [contract, setContract] = useState<ContractData>({
    templateGenerated: false,
    previewUrl: null,
    contractId: null,
    contractSent: false,
    signingUrl: null,
  });

  const [memories, setMemories] = useState<Memory[]>([]);

  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "scraping" | "done" | "error">("idle");
  const [scrapeSource, setScrapeSource] = useState<"url" | "org" | "both" | null>(null);

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
      // Try to resume from onboarding workspace first
      const { data: wsData } = await supabase
        .from("profile")
        .select(
          "workspace_id, workspace:workspace_id(workspace_id, contract_status, intelligence_data, name)",
        )
        .eq("user_id", userId!)
        .limit(10);

      if (wsData) {
        const onboardingProfile = wsData.find((p) => {
          const ws = p.workspace as unknown as {
            contract_status: string | null;
          } | null;
          return ws?.contract_status === "onboarding";
        });

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

            const merged = mergeBusinessData(scraped, brreg, places);
            const sourceUrl = intel.source_url as string | null;
            if (!merged.website && sourceUrl && !sourceUrl.startsWith("brreg:")) {
              merged.website = sourceUrl;
            }
            setBusiness(merged);
            setScrapeStatus("done");

            // Auto-populate departments from industry
            const nace = merged.industryCode || resolveNaceCode(merged.industry);
            const suggestedDepts = getDepartmentsForIndustry(nace);
            setDepartments(suggestedDepts);
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
  }, [isAuthenticated, userId]);

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

      const nextIdx = ONBOARDING_SECTIONS.indexOf(section) + 1;
      const next = ONBOARDING_SECTIONS[nextIdx];
      if (next) {
        setCurrentSection(next);

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => save(next), SAVE_DEBOUNCE_MS);
      }
    },
    [save],
  );

  // Scraping
  const triggerScrape = useCallback(
    async (url: string, orgNumber: string) => {
      setScrapeStatus("scraping");
      const source = url && orgNumber ? "both" : url ? "url" : "org";
      setScrapeSource(source);

      try {
        const { data, error } = await supabase.functions.invoke("gather-workspace-intelligence", {
          body: { url: url || undefined, orgNumber: orgNumber || undefined },
        });

        if (error) throw new Error("Scraping failed");

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

        // Auto-populate departments from industry
        const nace = merged.industryCode || resolveNaceCode(merged.industry);
        const suggestedDepts = getDepartmentsForIndustry(nace);
        setDepartments(suggestedDepts);
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

  // Agent-driven memories — knowledge context saved by Lise
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
  }, []);

  // Reset — clear all state and delete onboarding workspace or DB session
  const reset = useCallback(async () => {
    // Delete onboarding workspace if one exists (only if still in onboarding state)
    if (onboardingWorkspaceId) {
      // Verify it's still in onboarding state before deleting
      const { data: ws } = await supabase
        .from("workspace")
        .select("contract_status")
        .eq("workspace_id", onboardingWorkspaceId)
        .single();

      if (ws?.contract_status === "onboarding") {
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
    setMemories([]);
    setContract({ templateGenerated: false, previewUrl: null, contractId: null, contractSent: false, signingUrl: null });
    setScrapeStatus("idle");
    setScrapeSource(null);
    setSessionId(null);
    setOnboardingWorkspaceId(null);
    setActivatedWorkspaceId(null);
    setActivatedWorkspaceSlug(null);

    // Allow session resume to fire again on next auth check
    hasResumed.current = false;
  }, [sessionId, onboardingWorkspaceId, supabase]);

  // Finalize — use finalize-workspace if we have an onboarding workspace, else activate-workspace
  const finalize = useCallback(async () => {
    try {
      const selectedDepts = departments
        .filter((d) => d.selected)
        .map((d) => ({ name: d.name, positions: d.positions }));

      const workspacePayload = {
        name: business.name,
        legalName: business.legalName,
        orgNumber: business.orgNumber,
        email: business.email,
        phone: business.phone,
        address: `${business.address}, ${business.postalCode} ${business.city}`,
        industry: business.industry,
        industryCode: business.industryCode,
        employeeCount: business.employeeCount,
        summary: business.description,
        website: business.website,
        departments: selectedDepts,
        seasonName: season.name,
        seasonStartDate: season.startDate,
        seasonEndDate: season.endDate,
        contractId: contract.contractId,
      };

      let workspaceId: string;
      let slug: string | null = null;

      if (onboardingWorkspaceId) {
        // Finalize existing onboarding workspace
        const { data, error } = await supabase.functions.invoke("finalize-workspace", {
          body: {
            workspaceId: onboardingWorkspaceId,
            workspaceData: workspacePayload,
          },
        });

        if (error) throw new Error("Failed to finalize workspace");
        workspaceId = data?.workspaceId;
        slug = data?.slug ?? null;
      } else {
        // Legacy: activate-workspace for old flow
        const { data, error } = await supabase.functions.invoke("activate-workspace", {
          body: { workspaceData: workspacePayload },
        });

        if (error) throw new Error("Failed to activate workspace");
        workspaceId = data?.workspaceId;

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
    } catch (err) {
      console.error("Finalization error:", err);
      throw err;
    }
  }, [business, season, departments, contract, sessionId, onboardingWorkspaceId, supabase]);

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
    contract,
    memories,
    scrapeStatus,
    scrapeSource,
    activatedWorkspaceId,
    activatedWorkspaceSlug,
    triggerScrape,
    updateBusiness,
    updateSeason,
    updateContract,
    toggleDepartment,
    addCustomDepartment,
    completeSection,
    saveMemory,
    removeMemory,
    resetScrape,
    finalize,
    reset,
  };
}
