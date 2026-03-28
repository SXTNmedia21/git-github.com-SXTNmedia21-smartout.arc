"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import type { SlideConfig, FlowResult, FlowEvent } from "./types";

interface FlowContextValue {
  currentSlide: number;
  direction: 1 | -1;
  answers: Record<string, string | string[]>;
  totalSlides: number;
  next: () => void;
  prev: () => void;
  setAnswer: (key: string, value: string | string[]) => void;
  toggleAnswer: (key: string, optionId: string, multi: boolean) => void;
  complete: (action?: string) => void;
}

const FlowCtx = createContext<FlowContextValue | null>(null);

interface FlowProviderProps {
  slides: SlideConfig[];
  onComplete: (result: FlowResult) => void;
  onEvent?: (event: FlowEvent) => void;
  children: ReactNode;
}

export function FlowProvider({ slides, onComplete, onEvent, children }: FlowProviderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const directionRef = useRef<1 | -1>(1);

  // ── Timing ──────────────────────────────────────
  const flowStartRef = useRef(Date.now());
  const slideStartRef = useRef(Date.now());

  const emitEvent = useCallback(
    (type: FlowEvent["type"], slideIndex: number, data?: Record<string, unknown>) => {
      if (!onEvent) return;
      const now = Date.now();
      const slideType = slides[slideIndex]?.type ?? "unknown";
      onEvent({
        type,
        slideIndex,
        slideType,
        durationMs: now - slideStartRef.current,
        data,
      });
    },
    [onEvent, slides],
  );

  // Emit flow:started on mount
  useEffect(() => {
    flowStartRef.current = Date.now();
    slideStartRef.current = Date.now();
    emitEvent("flow:started", 0, { totalSlides: slides.length });
  }, []);

  // Emit flow:slide_viewed on slide change
  useEffect(() => {
    if (currentSlide > 0) {
      emitEvent("flow:slide_viewed", currentSlide);
    }
    slideStartRef.current = Date.now();
  }, [currentSlide]);

  const next = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      directionRef.current = 1;
      setCurrentSlide((s) => s + 1);
    }
  }, [currentSlide, slides.length]);

  const prev = useCallback(() => {
    if (currentSlide > 0) {
      directionRef.current = -1;
      setCurrentSlide((s) => s - 1);
    }
  }, [currentSlide]);

  const setAnswer = useCallback((key: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleAnswer = useCallback(
    (key: string, optionId: string, multi: boolean) => {
      setAnswers((prev) => {
        const current = prev[key];
        if (!multi) {
          return { ...prev, [key]: optionId };
        }
        const arr = Array.isArray(current) ? current : [];
        const next = arr.includes(optionId)
          ? arr.filter((id) => id !== optionId)
          : [...arr, optionId];
        return { ...prev, [key]: next };
      });

      // Emit answer event
      emitEvent("flow:answer_submitted", currentSlide, {
        answerKey: key,
        optionId,
        multi,
      });
    },
    [currentSlide, emitEvent],
  );

  const complete = useCallback(
    (action?: string) => {
      const totalDurationMs = Date.now() - flowStartRef.current;

      emitEvent("flow:completed", currentSlide, {
        action,
        totalDurationMs,
        answers,
      });

      onComplete({
        answers,
        completedAt: new Date(),
        durationMs: totalDurationMs,
        action,
      });
    },
    [answers, onComplete, currentSlide, emitEvent],
  );

  return (
    <FlowCtx.Provider
      value={{
        currentSlide,
        direction: directionRef.current,
        answers,
        totalSlides: slides.length,
        next,
        prev,
        setAnswer,
        toggleAnswer,
        complete,
      }}
    >
      {children}
    </FlowCtx.Provider>
  );
}

export function useFlow() {
  const ctx = useContext(FlowCtx);
  if (!ctx) throw new Error("useFlow must be used within FlowProvider");
  return ctx;
}
