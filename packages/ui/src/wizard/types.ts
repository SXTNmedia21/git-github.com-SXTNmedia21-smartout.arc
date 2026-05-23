// packages/ui/src/wizard/types.ts
import type { ComponentType } from "react";
import type { ZodSchema } from "zod";

// -- Wizard Definition (config object per wizard) --

export interface WizardDefinition<TState extends Record<string, unknown>> {
  id: string;
  theme: "dark" | "warm" | "light";
  steps: WizardStepDef<TState>[];
  metadata: {
    titleKey: string;
    descriptionKey: string;
    i18nNamespace: string;
  };
  /** Brand panel config — dark panel with contextual messages per step (Nordic Split layout) */
  brandPanel?: {
    /** Per-step messages: { heading, sub } keyed by step id */
    messages: Record<string, { heading: string; sub: string }>;
    /** Logo image path */
    logoSrc?: string;
    /** Panel position */
    position?: "left" | "right";
  };
  initialState: TState;
  loadState?: () => Promise<Partial<TState>>;
  onComplete?: (state: TState) => Promise<void>;
}

export interface WizardStepDef<TState> {
  id: string;
  labelKey: string;
  /** Icon name (kebab-case). Each platform renders via its own icon lookup
   *  (web: lucide-react; mobile: lucide-react-native). Replaces former
   *  LucideIcon type to keep this module RN-portable. */
  iconName?: string;
  component: ComponentType<WizardStepProps<TState>>;
  validation?: ZodSchema;
  /** Key in TState to validate (e.g. "account"). If omitted, validates full state. */
  validationKey?: keyof TState;
  skippable?: boolean;
  /** Hide the WizardNavBar for this step (step handles its own submit) */
  hideNavBar?: boolean;
  /** Called when the user leaves this step (next or back). NOT called on skip. */
  onStepLeave?: (state: TState) => void | Promise<void>;
  estimatedMinutes?: number;
}

// -- Props received by step components --

export interface WizardStepProps<TState> {
  state: TState;
  updateState: (patch: Partial<TState>) => void;
  next: () => void | Promise<void>;
  back: () => void;
  goTo: (stepId: string) => void;
  isFirst: boolean;
  isLast: boolean;
  /** True after the user clicked Neste and validation failed — use for red border on invalid fields */
  attempted: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  theme: WizardThemeTokens;
  botsson: BotssonHelper;
}

export interface WizardThemeTokens {
  name: "dark" | "warm" | "light";
}

// -- Walk AI semantic tagging --

export interface BotssonHelper {
  id: (element: string) => string;
  tag: (
    element: string,
    intent: string,
    context?: Record<string, unknown>,
  ) => BotssonDataAttributes;
}

export type BotssonDataAttributes = {
  "data-botsson-id": string;
  "data-botsson-intent": string;
  "data-botsson-type": string;
  "data-botsson-context"?: string;
};

// -- Wizard context payload for external consumers (Botsson, telemetry) --

export type WizardContextPayload = {
  wizardId: string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  completedSteps: string[];
  theme: "dark" | "warm" | "light";
};

// -- Internal state --

export interface WizardState {
  currentStepIndex: number;
  completedSteps: Set<string>;
  data: Record<string, unknown>;
  startedAt: number;
  stepEnteredAt: number;
}
