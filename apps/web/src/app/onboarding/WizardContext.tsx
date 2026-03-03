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
      scrapeStatus: state.scrapeStatus,
    }),
    [scroll.activeSection, state.business, state.season, state.departments, state.scrapeStatus],
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

  // Writable actions the agent can invoke via client tools
  const botssonActions: BotssonActions = useMemo(
    () => ({
      getState: getOnboardingState,
      updateBusiness: state.updateBusiness,
      updateSeason: state.updateSeason,
      addDepartments,
      triggerScrape: state.triggerScrape,
      advanceToNextSection,
    }),
    [
      getOnboardingState,
      state.updateBusiness,
      state.updateSeason,
      addDepartments,
      state.triggerScrape,
      advanceToNextSection,
    ],
  );

  const botsson = useBotsson(botssonActions);

  // Push section changes to voice agent
  const prevSectionRef = useRef<OnboardingSection | null>(null);
  useEffect(() => {
    const section = scroll.activeSection;
    if (section === prevSectionRef.current) return;
    prevSectionRef.current = section;

    const messages: Record<string, string | null> = {
      hero: null,
      business:
        "Brukeren er nå på bedriftsseksjonen. De kan skrive inn nettside eller org.nummer, eller fortelle deg muntlig.",
      season: `Brukeren er nå på sesongseksjonen. Foreslått sesong: ${state.season.name || "ikke valgt ennå"}.`,
      departments: `Brukeren er nå på avdelingsseksjonen. ${
        state.departments.filter((d) => d.selected).length > 0
          ? `Foreslåtte: ${state.departments
              .filter((d) => d.selected)
              .map((d) => d.name)
              .join(", ")}.`
          : "Ingen avdelinger valgt ennå. Spør brukeren hvilke avdelinger de har."
      }`,
      contract: `Brukeren er nå på kontraktseksjonen. Bedrift: ${state.business.name || "ikke angitt"}.`,
      done: `Brukeren er ferdig! Alt er klart. Bedrift: ${state.business.name || "ikke angitt"}, sesong: ${state.season.name || "ikke angitt"}, ${state.departments.filter((d) => d.selected).length} avdelinger valgt.`,
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
    botsson.sendContext,
  ]);

  // Push scrape status changes to voice agent
  const prevScrapeRef = useRef(state.scrapeStatus);
  useEffect(() => {
    if (state.scrapeStatus === prevScrapeRef.current) return;
    prevScrapeRef.current = state.scrapeStatus;

    if (state.scrapeStatus === "scraping") {
      botsson.sendContext("Skanner bedriften nå...");
    } else if (state.scrapeStatus === "done") {
      const b = state.business;
      botsson.sendContext(
        `Skanning ferdig! Fant: ${b.name || "ukjent"}, bransje: ${b.industry || "ukjent"}.`,
      );
    } else if (state.scrapeStatus === "error") {
      botsson.sendContext(
        "Skanningen feilet. Brukeren kan prøve igjen eller fortelle deg manuelt.",
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
