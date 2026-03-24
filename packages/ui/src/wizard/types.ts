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
  skippable?: boolean;
  estimatedMinutes?: number;
}

// -- Props received by step components --

export interface WizardStepProps<TState> {
  state: TState;
  updateState: (patch: Partial<TState>) => void;
  next: () => void;
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
