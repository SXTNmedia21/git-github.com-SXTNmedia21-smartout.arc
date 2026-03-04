// ============================================
// useDemoJourney.ts
// State management hook for one guided demo journey.
// Manages the current step, chat history, UI state,
// typing simulation, and auto-advance timers.
// Connected to: DemoShell.tsx (consumer), journeys/types.ts (config)
// ============================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JourneyConfig, JourneyStep, QuickReply } from "./journeys/types";
import type { ChatMessage } from "./AssistantPanel";

type DemoJourneyState = {
  /** Zero-based index of the current step */
  currentStepIndex: number;
  /** Chat messages displayed in the assistant panel */
  messages: ChatMessage[];
  /** Whether the assistant is "typing" (shows dots) */
  isTyping: boolean;
  /** Whether voice mode is active */
  isVoiceActive: boolean;
  /** UI state injected into the feature component */
  uiState: Record<string, unknown>;
  /** Current step ID for the feature component */
  currentStepId: string;
  /** Whether the journey has reached the final step */
  isComplete: boolean;
};

type DemoJourneyActions = {
  /** Advance to the next step (or a specific step by ID) */
  advanceToStep: (stepId?: string) => void;
  /** Handle a quick reply click */
  handleQuickReply: (reply: QuickReply) => void;
  /** Handle a user text message */
  handleSendMessage: (text: string) => void;
  /** Toggle voice mode */
  toggleVoice: () => void;
  /** Trigger a UI interaction from the feature component */
  handleInteraction: (action: string) => void;
  /** Reset journey to the beginning */
  reset: () => void;
};

/**
 * Manages the full lifecycle of a guided demo journey.
 *
 * Why a custom hook instead of useReducer: The logic involves
 * async timers (typing delays, auto-advance) that are easier
 * to coordinate with refs and useEffect than in a reducer.
 *
 * @param config - The journey configuration with steps
 * @returns State + actions for the DemoShell to consume
 */
export function useDemoJourney(config: JourneyConfig): DemoJourneyState & DemoJourneyActions {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [uiState, setUiState] = useState<Record<string, unknown>>({});

  // Track message counter for unique IDs
  const messageCounter = useRef(0);
  // Timer refs for cleanup
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard to avoid replaying the initial step when callback dependencies refresh.
  const hasStartedInitialStepRef = useRef(false);

  // Ref so advanceToNextStep can always call the latest playStep
  // without a direct circular reference between two memoized callbacks.
  // Pattern: declare advanceToNextStep before playStep, call playStep via ref.
  const playStepRef = useRef<((step: JourneyStep) => void) | null>(null);

  /** Generate a unique message ID */
  function nextMessageId(): string {
    messageCounter.current += 1;
    return `msg-${messageCounter.current}`;
  }

  /**
   * Internal: advance to the next sequential step.
   * Calls playStep via playStepRef to avoid a circular useCallback dependency.
   */
  const advanceToNextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next < config.steps.length) {
        playStepRef.current?.(config.steps[next]!);
        return next;
      }
      return prev;
    });
  }, [config.steps]);

  /**
   * Plays a step: shows typing indicator, then reveals the
   * assistant's message with quick replies after a delay.
   */
  const playStep = useCallback(
    (step: JourneyStep) => {
      // Clear any pending timers from the previous step
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);

      // Show typing indicator
      setIsTyping(true);

      // Inject UI state for this step (if any)
      if (step.uiState) {
        setUiState((prev) => ({ ...prev, ...step.uiState }));
      }

      // After typing delay, show the message
      const delay = step.typingDelayMs ?? 800;
      typingTimerRef.current = setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "assistant",
            content: step.assistantMessage,
            quickReplies: step.quickReplies,
          },
        ]);

        // Auto-advance if configured
        if (step.autoAdvanceMs) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            advanceToNextStep();
          }, step.autoAdvanceMs);
        }
      }, delay);
    },
    [advanceToNextStep],
  );

  // Keep the ref in sync so advanceToNextStep always calls the latest playStep.
  // Must be in useEffect — refs cannot be updated during render in React 19.
  useEffect(() => {
    playStepRef.current = playStep;
  }, [playStep]);

  /**
   * Advance to the next sequential step or to a specific step by ID.
   */
  const advanceToStep = useCallback(
    (stepId?: string) => {
      if (stepId) {
        const targetIndex = config.steps.findIndex((s) => s.id === stepId);
        if (targetIndex >= 0) {
          setCurrentStepIndex(targetIndex);
          playStep(config.steps[targetIndex]!);
        }
      } else {
        advanceToNextStep();
      }
    },
    [config.steps, playStep, advanceToNextStep],
  );

  /** Handle quick reply — add user message, then advance */
  const handleQuickReply = useCallback(
    (reply: QuickReply) => {
      // Add the user's reply as a message
      setMessages((prev) => [...prev, { id: nextMessageId(), role: "user", content: reply.label }]);
      // Advance to specified step or next
      advanceToStep(reply.advancesToStep);
    },
    [advanceToStep],
  );

  /** Handle free-text user message — same as quick reply */
  const handleSendMessage = useCallback(
    (text: string) => {
      setMessages((prev) => [...prev, { id: nextMessageId(), role: "user", content: text }]);
      // Always advance to the next step on any user input
      advanceToStep();
    },
    [advanceToStep],
  );

  /** Toggle voice mode on/off (Ultravox integration stubbed) */
  const toggleVoice = useCallback(() => {
    setIsVoiceActive((prev) => !prev);
  }, []);

  /**
   * Handle UI interaction from the feature component.
   * Some steps wait for the user to interact with the product UI
   * (e.g., clicking a button) before advancing.
   */
  const handleInteraction = useCallback(() => {
    // Advance to next step when the user interacts with the feature UI
    advanceToStep();
  }, [advanceToStep]);

  /** Reset the journey back to the start */
  const reset = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    hasStartedInitialStepRef.current = false;
    setCurrentStepIndex(-1);
    setMessages([]);
    setIsTyping(false);
    setIsVoiceActive(false);
    setUiState({});
    messageCounter.current = 0;
  }, []);

  // Start the first step automatically when the journey loads
  useEffect(() => {
    if (hasStartedInitialStepRef.current) return;
    if (config.steps.length === 0 || currentStepIndex !== -1) return;

    hasStartedInitialStepRef.current = true;
    setCurrentStepIndex(0);
    playStep(config.steps[0]!);
  }, [config.steps, playStep, currentStepIndex]);

  // Cleanup timers on unmount only.
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  const currentStep = config.steps[Math.max(0, currentStepIndex)];
  const isComplete = currentStepIndex >= config.steps.length - 1 && !isTyping;

  return {
    currentStepIndex: Math.max(0, currentStepIndex),
    messages,
    isTyping,
    isVoiceActive,
    uiState,
    currentStepId: currentStep?.id ?? "",
    isComplete,
    advanceToStep,
    handleQuickReply,
    handleSendMessage,
    toggleVoice,
    handleInteraction,
    reset,
  };
}
