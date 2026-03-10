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
import { createClient } from "@smartout/supabase/client";
import { useScrapedData, type ScrapeStatus } from "./useScrapedData";
import type {
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  Step6Data,
} from "../_lib/validation";

const TOTAL_STEPS = 6;
const PERSIST_DEBOUNCE_MS = 2000;

export interface WizardState {
  currentStep: number;
  scrapeJobId: string | null;
  step1: Partial<Step1Data>;
  step2: Partial<Step2Data>;
  step3: Partial<Step3Data>;
  step4: Partial<Step4Data>;
  step5: Partial<Step5Data>;
  step6: Partial<Step6Data>;
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
};

const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardProviderProps {
  children: ReactNode;
  initialState?: Partial<WizardState>;
}

export function WizardProvider({ children, initialState }: WizardProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { scrapedData, scrapeStatus, triggerScrape } = useScrapedData();

  const [state, setState] = useState<WizardState>(() => {
    const stepParam = searchParams.get("step");
    const currentStep = stepParam ? Math.max(1, Math.min(TOTAL_STEPS, Number(stepParam))) : 1;

    return {
      ...defaultState,
      ...initialState,
      currentStep: isNaN(currentStep) ? 1 : currentStep,
    };
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Core persist logic (extracted for reuse by debounce + flush)
  const doPersist = useCallback(async (wizardState: WizardState) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("signup_progress").upsert(
        {
          auth_id: user.id,
          current_step: wizardState.currentStep,
          step_data: {
            scrapeJobId: wizardState.scrapeJobId,
            step1: wizardState.step1,
            step2: wizardState.step2,
            step3: wizardState.step3,
            step4: wizardState.step4,
            step5: wizardState.step5,
            step6: wizardState.step6,
          },
        },
        { onConflict: "auth_id" },
      );
    } catch (error) {
      console.error("[WizardProvider] Failed to persist state:", error);
    }
  }, []);

  // Persist state to signup_progress (debounced)
  const persistState = useCallback(
    (wizardState: WizardState) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        doPersist(wizardState);
      }, PERSIST_DEBOUNCE_MS);
    },
    [doPersist],
  );

  // Flush pending persist immediately (used before setup)
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
