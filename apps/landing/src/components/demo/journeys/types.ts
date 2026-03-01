// ============================================
// types.ts
// Type definitions for the guided demo experience.
// Each journey is a scripted sequence of steps where
// an AI assistant guides the visitor through a real
// Smartout scenario (punch-in, scheduling, quiz, etc.)
// Connected to: journeys/index.ts (registry), DemoShell.tsx (consumer)
// ============================================

import type { ComponentType } from "react";

/**
 * Props injected into each feature component rendered
 * on the left side of the demo split-screen.
 *
 * Why: The DemoShell controls the journey state and
 * passes it down so feature UIs can react to step changes.
 */
export type DemoFeatureProps = {
  /** Current step ID the visitor is on */
  currentStepId: string;
  /** Arbitrary state injected by the journey config at each step */
  uiState: Record<string, unknown>;
  /** Callback for when the visitor interacts with a UI element */
  onInteraction: (action: string) => void;
};

/**
 * A single quick-reply chip shown below the assistant's message.
 * Clicking it advances the journey (optionally to a specific step).
 */
export type QuickReply = {
  /** Button label shown in the chat */
  label: string;
  /** Step ID to jump to. If omitted, advances to the next step. */
  advancesToStep?: string;
};

/**
 * One step in a guided journey. The assistant sends a message,
 * optional quick replies appear, and the UI can be highlighted
 * or updated with injected state.
 */
export type JourneyStep = {
  /** Unique identifier for this step within the journey */
  id: string;
  /** The message the assistant displays in the chat panel */
  assistantMessage: string;
  /** Simulated typing delay in ms before showing the message (default 800) */
  typingDelayMs?: number;
  /** Suggested quick-reply buttons shown below the message */
  quickReplies?: QuickReply[];
  /** CSS selector to pulse-highlight in the feature UI panel */
  highlight?: string;
  /** Auto-advance to next step after N ms (no user action needed) */
  autoAdvanceMs?: number;
  /** State to inject into the feature component at this step */
  uiState?: Record<string, unknown>;
};

/** Persona type for the journey — shown as a badge on the card */
export type JourneyPersona = "ansatt" | "leder" | "ny-ansatt";

/**
 * Complete configuration for one guided demo journey.
 * Contains metadata for the hub card and the scripted
 * steps the assistant walks through.
 */
export type JourneyConfig = {
  /** URL-safe ID used in the route: /demo/[id] */
  id: string;
  /** Who the visitor plays as in this scenario */
  persona: JourneyPersona;
  /** Journey name shown on the hub card */
  title: string;
  /** Short description below the title */
  subtitle: string;
  /** Estimated duration, e.g. "2 min" */
  duration: string;
  /** Lucide icon name for the hub card */
  icon: string;
  /** Tailwind color class for accent (e.g. "orange", "cyan") */
  accentColor: string;
  /** Ordered list of steps the assistant guides through */
  steps: JourneyStep[];
  /** React component rendered on the left side of the split screen */
  featureComponent: ComponentType<DemoFeatureProps>;
};
