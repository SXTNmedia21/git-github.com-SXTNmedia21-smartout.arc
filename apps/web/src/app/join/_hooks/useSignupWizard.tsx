"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useScrapedData, type ScrapeStatus, type BrregData } from "./useScrapedData";
import type {
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  Step6Data,
} from "../_lib/validation";

const TOTAL_STEPS = 6;
const PERSIST_DEBOUNCE_MS = 1000;
const STORAGE_KEY = "smartout_signup_wizard";

export interface WizardState {
  currentStep: number;
  scrapeJobId: string | null;
  step1: Partial<Step1Data>;
  step2: Partial<Step2Data>;
  step3: Partial<Step3Data>;
  step4: Partial<Step4Data>;
  step5: Partial<Step5Data>;
  step6: Partial<Step6Data>;
  intelligence: Record<string, unknown> | null;
}

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

export interface WizardContextValue {
  state: WizardState;
  updateStep: <K extends keyof WizardState>(key: K, data: WizardState[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  flushPersist: () => void;
  // Shared scrape state
  scrapedData: ScrapedData | null;
  scrapeStatus: ScrapeStatus;
  triggerScrape: (url: string) => Promise<void>;
  // BRREG data
  brregData: BrregData | null;
  brregCandidates: BrregData[];
  selectBrregCandidate: (candidate: BrregData) => void;
  lookupBrreg: (companyName: string, city?: string) => Promise<void>;
}

const defaultState: WizardState = {
  currentStep: 1,
  scrapeJobId: null,
  step1: {},
  step2: {},
  step3: {},
  step4: {},
  step5: {},
  step6: {},
  intelligence: null,
};

const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardProviderProps {
  children: ReactNode;
  initialState?: Partial<WizardState>;
}

export function WizardProvider({ children, initialState }: WizardProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    scrapedData,
    scrapeStatus,
    triggerScrape,
    brregData,
    brregCandidates,
    selectBrregCandidate,
    lookupBrreg,
  } = useScrapedData();

  const [state, setState] = useState<WizardState>(() => {
    const stepParam = searchParams.get("step");
    const currentStep = stepParam ? Math.max(1, Math.min(TOTAL_STEPS, Number(stepParam))) : 1;

    // Restore from localStorage if no server-provided initialState
    let restored = initialState;
    if (!restored && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) restored = JSON.parse(stored);
      } catch {
        /* ignore */
      }
    }

    return {
      ...defaultState,
      ...restored,
      currentStep: isNaN(currentStep) ? (restored?.currentStep ?? 1) : currentStep,
    };
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist to localStorage (no auth needed)
  const doPersist = useCallback((wizardState: WizardState) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStep: wizardState.currentStep,
          scrapeJobId: wizardState.scrapeJobId,
          step1: wizardState.step1,
          step2: wizardState.step2,
          step3: wizardState.step3,
          step4: wizardState.step4,
          step5: wizardState.step5,
          step6: wizardState.step6,
        }),
      );
    } catch {
      // localStorage might be full or unavailable
    }
  }, []);

  // Persist state to localStorage (debounced)
  const persistState = useCallback(
    (wizardState: WizardState) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doPersist(wizardState), PERSIST_DEBOUNCE_MS);
    },
    [doPersist],
  );

  // Flush pending persist immediately
  const flushPersist = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    doPersist(state);
  }, [doPersist, state]);

  // Sync URL when step changes
  useEffect(() => {
    const currentParam = searchParams.get("step");
    const newStep = String(state.currentStep);

    if (currentParam !== newStep) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", newStep);
      router.push(`?${params.toString()}`, { scroll: false });
    }
  }, [state.currentStep, searchParams, router]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const updateStep = useCallback(
    <K extends keyof WizardState>(key: K, data: WizardState[K]) => {
      setState((prev) => {
        const next = { ...prev, [key]: data };
        persistState(next);
        return next;
      });
    },
    [persistState],
  );

  const nextStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep >= TOTAL_STEPS) return prev;
      const next = { ...prev, currentStep: prev.currentStep + 1 };
      persistState(next);
      return next;
    });
  }, [persistState]);

  const prevStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep <= 1) return prev;
      const next = { ...prev, currentStep: prev.currentStep - 1 };
      persistState(next);
      return next;
    });
  }, [persistState]);

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.max(1, Math.min(TOTAL_STEPS + 1, step)); // +1 for loading step
      setState((prev) => {
        const next = { ...prev, currentStep: clamped };
        persistState(next);
        return next;
      });
    },
    [persistState],
  );

  const value: WizardContextValue = {
    state,
    updateStep,
    nextStep,
    prevStep,
    goToStep,
    flushPersist,
    scrapedData,
    scrapeStatus,
    triggerScrape,
    brregData,
    brregCandidates,
    selectBrregCandidate,
    lookupBrreg,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useSignupWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useSignupWizard must be used within a WizardProvider");
  }
  return context;
}
