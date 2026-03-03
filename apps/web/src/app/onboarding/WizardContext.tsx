"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useOnboardingState, type OnboardingActions } from "./hooks/useOnboardingState";
import { useScrollProgress } from "./hooks/useScrollProgress";
import { useBotsson } from "./hooks/useBotsson";
import type { OnboardingState, OnboardingSection } from "./types";

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
  const botsson = useBotsson();

  const value: OnboardingContextValue = {
    ...state,
    ...scroll,
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
