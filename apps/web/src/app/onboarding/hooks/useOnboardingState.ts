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
} from "../types";
import { ONBOARDING_SECTIONS, EMPTY_BUSINESS_DATA, DEFAULT_SEASON_DATA } from "../types";
import { mergeBusinessData } from "../lib/data-merger";
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
  toggleDepartment: (id: string) => void;
  addCustomDepartment: (name: string) => void;
  completeSection: (section: OnboardingSection) => void;
  finalize: () => Promise<void>;
}

export function useOnboardingState(): OnboardingState & OnboardingActions {
  const supabase = createClient();

  const [currentSection, setCurrentSection] = useState<OnboardingSection>("hero");
  const [sections, setSections] = useState(INITIAL_SECTIONS);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [business, setBusiness] = useState<BusinessData>(EMPTY_BUSINESS_DATA);
  const [season, setSeason] = useState<SeasonData>(suggestSeason());
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [contract, setContract] = useState({
    templateGenerated: false,
    previewUrl: null as string | null,
  });

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

  // Resume session
  useEffect(() => {
    if (!isAuthenticated || !userId || hasResumed.current) return;
    hasResumed.current = true;

    async function resume() {
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

  // Auto-save with debounce
  const save = useCallback(
    async (sectionName: OnboardingSection) => {
      if (!isAuthenticated || !userId) return;

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
    },
    [isAuthenticated, userId, sessionId, business, supabase],
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
      if (nextIdx < ONBOARDING_SECTIONS.length) {
        const next = ONBOARDING_SECTIONS[nextIdx];
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

        const { scrapedData, brregData } = data;
        const merged = mergeBusinessData(scrapedData, brregData);

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

  const toggleDepartment = useCallback((id: string) => {
    setDepartments((prev) => prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)));
  }, []);

  const addCustomDepartment = useCallback((name: string) => {
    setDepartments((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name,
        icon: "plus",
        selected: true,
        positions: [],
      },
    ]);
  }, []);

  // Finalize
  const finalize = useCallback(async () => {
    try {
      const selectedDepts = departments
        .filter((d) => d.selected)
        .map((d) => ({ name: d.name, positions: d.positions }));

      const { data, error } = await supabase.functions.invoke("activate-workspace", {
        body: {
          workspaceData: {
            name: business.name,
            email: business.email,
            phone: business.phone,
            address: `${business.address}, ${business.postalCode} ${business.city}`,
            industry: business.industry,
            employeeCount: business.employeeCount,
            summary: business.description,
            departments: selectedDepts,
            seasonName: season.name,
            seasonStartDate: season.startDate,
            seasonEndDate: season.endDate,
          },
        },
      });

      if (error) throw new Error("Failed to activate workspace");

      const workspaceId = data?.workspaceId;
      if (!workspaceId) throw new Error("No workspace ID returned");

      setActivatedWorkspaceId(workspaceId);

      const { data: ws } = await supabase
        .from("workspace")
        .select("slug")
        .eq("workspace_id", workspaceId)
        .single();

      setActivatedWorkspaceSlug(ws?.slug ?? null);

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
  }, [business, season, departments, sessionId, supabase]);

  return {
    currentSection,
    sections,
    isAuthenticated,
    userId,
    sessionId,
    business,
    season,
    departments,
    contract,
    scrapeStatus,
    scrapeSource,
    activatedWorkspaceId,
    activatedWorkspaceSlug,
    triggerScrape,
    updateBusiness,
    updateSeason,
    toggleDepartment,
    addCustomDepartment,
    completeSection,
    finalize,
  };
}
