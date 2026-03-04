"use client";

import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useOnboardingState, type OnboardingActions } from "./hooks/useOnboardingState";
import { useScrollProgress } from "./hooks/useScrollProgress";
import { useBotsson, type BotssonActions } from "./hooks/useBotsson";
import type { OnboardingState, OnboardingSection } from "./types";
import { ONBOARDING_SECTIONS } from "./types";

interface OnboardingContextValue extends OnboardingState, OnboardingActions {
  activeSection: OnboardingSection;
  scrollToSection: (section: OnboardingSection) => void;
  totalProgress: number;
  sectionIndex: number;
  progress: number;
  botsson: ReturnType<typeof useBotsson>;
  containerRef: React.RefObject<HTMLElement | null>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const state = useOnboardingState();
  const scroll = useScrollProgress(containerRef);

  // Getter for client tool — agent can query current onboarding state
  const getOnboardingState = useCallback(
    () => ({
      currentSection: scroll.activeSection,
      business: {
        name: state.business.name,
        orgNumber: state.business.orgNumber,
        industry: state.business.industry,
        address: state.business.address,
        city: state.business.city,
      },
      season: {
        name: state.season.name,
        startDate: state.season.startDate,
        endDate: state.season.endDate,
      },
      departments: state.departments.filter((d) => d.selected).map((d) => d.name),
      locations: state.locations.map((l) => ({
        name: l.name,
        type: l.type,
        zones: l.zones.map((z) => z.name),
      })),
      procedures: state.procedures.filter((p) => p.selected).map((p) => p.name),
      scrapeStatus: state.scrapeStatus,
    }),
    [
      scroll.activeSection,
      state.business,
      state.season,
      state.departments,
      state.locations,
      state.procedures,
      state.scrapeStatus,
    ],
  );

  // Helper: add multiple departments by name (called by agent)
  const addDepartments = useCallback(
    (names: string[]) => {
      for (const name of names) {
        state.addCustomDepartment(name);
      }
    },
    [state.addCustomDepartment],
  );

  // Advance to next section (called by agent tool)
  const advanceToNextSection = useCallback(() => {
    const currentIdx = ONBOARDING_SECTIONS.indexOf(scroll.activeSection);
    const next = ONBOARDING_SECTIONS[currentIdx + 1];
    if (next) {
      state.completeSection(scroll.activeSection);
      scroll.scrollToSection(next);
    }
  }, [scroll.activeSection, scroll.scrollToSection, state.completeSection]);

  // Save agent memory via API
  const saveMemory = useCallback(
    async (content: string, memoryType: string, expiresAt?: string) => {
      try {
        await fetch("/api/agent/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, memoryType, expiresAt }),
        });
      } catch {
        // Silently fail — memory is best-effort
      }
    },
    [],
  );

  // Add a key fact to the visual panel (agent tool)
  const addKeyFact = useCallback(
    (label: string, value: string) => {
      state.saveMemory(`${label}: ${value}`);
    },
    [state.saveMemory],
  );

  // Finalize onboarding — called by Botsson's finalizeOnboarding tool
  const finalizeOnboarding = useCallback(async (): Promise<{
    success: boolean;
    slug?: string;
    error?: string;
  }> => {
    try {
      await state.finalize();
      // Give Botsson time to say "Velkommen!" before redirect
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Finalization failed",
      };
    }
  }, [state.finalize, router]);

  // Helper: add locations by name+type (called by agent)
  const addLocations = useCallback(
    (locs: { name: string; type?: string }[]) => {
      for (const loc of locs) {
        const locType = (loc.type as "main" | "outdoor" | "satellite" | "other") || "main";
        state.addLocation(loc.name, locType);
      }
    },
    [state.addLocation],
  );

  // Helper: add zones to a location by name match (called by agent)
  const addZones = useCallback(
    (locationName: string, zones: { name: string }[]) => {
      const loc = state.locations.find((l) => l.name.toLowerCase() === locationName.toLowerCase());
      if (loc) {
        for (const zone of zones) {
          state.addZone(loc.id, zone.name);
        }
      }
    },
    [state.locations, state.addZone],
  );

  // Helper: add procedures by name (called by agent)
  const addProcedures = useCallback(
    (names: string[]) => {
      for (const name of names) {
        // Check if procedure already exists
        const exists = state.procedures.some((p) => p.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
          state.addCustomProcedure(name);
        } else {
          // Ensure existing procedure is selected
          const proc = state.procedures.find((p) => p.name.toLowerCase() === name.toLowerCase());
          if (proc && !proc.selected) {
            state.toggleProcedure(proc.id);
          }
        }
      }
    },
    [state.procedures, state.addCustomProcedure, state.toggleProcedure],
  );

  // Writable actions the agent can invoke via client tools
  const botssonActions: BotssonActions = useMemo(
    () => ({
      getState: getOnboardingState,
      updateBusiness: state.updateBusiness,
      updateSeason: state.updateSeason,
      addDepartments,
      addLocations,
      addZones,
      addProcedures,
      triggerScrape: state.triggerScrape,
      advanceToNextSection,
      addKeyFact,
      saveMemory,
      finalizeOnboarding,
    }),
    [
      getOnboardingState,
      state.updateBusiness,
      state.updateSeason,
      addDepartments,
      addLocations,
      addZones,
      addProcedures,
      state.triggerScrape,
      advanceToNextSection,
      addKeyFact,
      saveMemory,
      finalizeOnboarding,
    ],
  );

  const botsson = useBotsson(botssonActions);

  // Push section changes to voice agent — but only after Botsson has had time to introduce himself
  const prevSectionRef = useRef<OnboardingSection | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  // Track when session starts
  useEffect(() => {
    if (botsson.isConnected && !sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }
    if (!botsson.isConnected) {
      sessionStartRef.current = null;
    }
  }, [botsson.isConnected]);

  useEffect(() => {
    const section = scroll.activeSection;
    if (section === prevSectionRef.current) return;
    prevSectionRef.current = section;

    // Don't push section context until at least 30s into the session
    // This prevents interrupting Botsson's intro in the first moments
    const elapsed = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
    if (elapsed < 30_000 && section !== "hero" && section !== "welcome") return;

    const messages: Record<string, string | null> = {
      hero: null,
      business:
        "[Systemmelding: Brukeren har scrollet til bedriftsseksjonen. Fullfør det du snakker om naturlig. Ikke avbryt deg selv.]",
      season: `[Systemmelding: Brukeren har scrollet til sesongseksjonen. Fullfør det du snakker om naturlig. Sesonginfo: ${state.season.name || "ikke valgt ennå"}.]`,
      departments: `[Systemmelding: Brukeren har scrollet til avdelingsseksjonen. Fullfør det du snakker om naturlig. ${
        state.departments.filter((d) => d.selected).length > 0
          ? `Allerede valgt: ${state.departments
              .filter((d) => d.selected)
              .map((d) => d.name)
              .join(", ")}.`
          : ""
      }]`,
      locations: `[Systemmelding: Brukeren har scrollet til lokasjonsseksjonen. Spør hvor de holder til — har de flere lokaler? ${
        state.locations.length > 0
          ? `Allerede lagt til: ${state.locations.map((l) => l.name).join(", ")}.`
          : ""
      }]`,
      procedures: `[Systemmelding: Brukeren har scrollet til prosedyreseksjonen. Anbefal standardprosedyrer for bransjen. ${
        state.procedures.filter((p) => p.selected).length > 0
          ? `Valgt: ${state.procedures
              .filter((p) => p.selected)
              .map((p) => p.name)
              .join(", ")}.`
          : ""
      }]`,
      contract: `[Systemmelding: Brukeren har scrollet til kontraktseksjonen. Fullfør det du snakker om naturlig.]`,
      welcome: `[Systemmelding: Brukeren er ferdig med onboarding! Avslutt med en varm velkomst. Bedrift: ${state.business.name || "ikke angitt"}, sesong: ${state.season.name || "ikke angitt"}, ${state.departments.filter((d) => d.selected).length} avdelinger, ${state.locations.length} lokasjoner, ${state.procedures.filter((p) => p.selected).length} prosedyrer.]`,
    };

    const msg = messages[section];
    if (msg) {
      botsson.sendContext(msg);
    }
  }, [
    scroll.activeSection,
    state.business.name,
    state.season.name,
    state.departments,
    state.locations,
    state.procedures,
    botsson.sendContext,
    botsson.isConnected,
  ]);

  // Push scrape status changes to voice agent
  const prevScrapeRef = useRef(state.scrapeStatus);
  useEffect(() => {
    if (state.scrapeStatus === prevScrapeRef.current) return;
    prevScrapeRef.current = state.scrapeStatus;

    if (state.scrapeStatus === "scraping") {
      botsson.sendContext(
        "[Systemmelding: Skanner bedriften nå... Big Board vises. Fortell brukeren at du leter.]",
      );
    } else if (state.scrapeStatus === "done") {
      const b = state.business;
      const deptNames = state.departments.filter((d) => d.selected).map((d) => d.name);
      const locNames = state.locations.map((l) => l.name);
      const procNames = state.procedures.filter((p) => p.selected).map((p) => p.name);
      const parts = [
        `[Systemmelding: Skanning ferdig! Fant:`,
        `- Bedrift: ${b.name || "ukjent"} (${b.industry || "ukjent bransje"})${b.employeeCount ? `, ${b.employeeCount} ansatte` : ""}`,
        b.address || b.city ? `- Adresse: ${[b.address, b.city].filter(Boolean).join(", ")}` : null,
        b.googleRating
          ? `- Google: ${b.googleRating}/5${b.googleRatingCount ? ` (${b.googleRatingCount} anmeldelser)` : ""}`
          : null,
        deptNames.length > 0
          ? `- ${deptNames.length} avdelinger foreslått: ${deptNames.join(", ")}`
          : null,
        locNames.length > 0
          ? `- ${locNames.length} lokasjoner funnet: ${locNames.join(", ")}`
          : null,
        procNames.length > 0 ? `- ${procNames.length} prosedyrer foreslått` : null,
        `Gå gjennom resultatet med brukeren. Spør om det ser riktig ut.]`,
      ].filter(Boolean);
      botsson.sendContext(parts.join("\n"));
    } else if (state.scrapeStatus === "error") {
      botsson.sendContext(
        "[Systemmelding: Skanningen feilet. Brukeren kan prøve igjen eller fortelle deg manuelt.]",
      );
    }
  }, [state.scrapeStatus, state.business, botsson.sendContext]);

  // Wrap reset to also scroll back to hero
  const resetWithScroll = useCallback(async () => {
    await state.reset();
    scroll.scrollToSection("hero");
  }, [state.reset, scroll.scrollToSection]);

  // Wrap completeSection to also auto-scroll to the next section
  const completeSectionWithScroll = useCallback(
    (section: OnboardingSection) => {
      state.completeSection(section);
      const nextIdx = ONBOARDING_SECTIONS.indexOf(section) + 1;
      const next = ONBOARDING_SECTIONS[nextIdx];
      if (next) {
        scroll.scrollToSection(next);
      }
    },
    [state.completeSection, scroll.scrollToSection],
  );

  const value: OnboardingContextValue = {
    ...state,
    ...scroll,
    completeSection: completeSectionWithScroll,
    reset: resetWithScroll,
    botsson,
    containerRef,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
