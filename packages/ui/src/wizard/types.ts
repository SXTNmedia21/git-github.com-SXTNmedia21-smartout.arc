// packages/ui/src/wizard/types.ts
import type { ComponentType } from "react";
import type { ZodSchema } from "zod";
import type { LucideIcon } from "lucide-react";

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
  icon?: LucideIcon;
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
  t: (key: string, params?: Record<string, string | number>) => string;
  theme: WizardThemeTokens;
  walkai: WalkAiHelper;
}

export interface WizardThemeTokens {
  name: "dark" | "warm" | "light";
}

// -- Walk AI semantic tagging --

export interface WalkAiHelper {
  id: (element: string) => string;
  tag: (element: string, intent: string, context?: Record<string, unknown>) => WalkAiDataAttributes;
}

export type WalkAiDataAttributes = {
  "data-walkai-id": string;
  "data-walkai-intent": string;
  "data-walkai-type": string;
  "data-walkai-context"?: string;
};

// -- Internal state --

export interface WizardState {
  currentStepIndex: number;
  completedSteps: Set<string>;
  data: Record<string, unknown>;
  startedAt: number;
  stepEnteredAt: number;
}
