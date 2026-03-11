export type TransitionType = "morph" | "fade" | "push" | "reveal" | "scale";

export interface ChoiceOption {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface HeroSlideConfig {
  type: "hero";
  title: string;
  subtitle?: string;
  background?: { type: "image" | "gradient"; src: string };
  transition?: TransitionType;
}

export interface GiveSlideConfig {
  type: "give";
  title: string;
  body: string;
  media?: { type: "image" | "icon"; src: string; alt?: string };
  layout?: "center" | "split";
  transition?: TransitionType;
}

export interface TakeSlideConfig {
  type: "take";
  question: string;
  answerKey: string;
  options: ChoiceOption[];
  multi?: boolean;
  transition?: TransitionType;
}

export interface SummaryAction {
  label: string;
  key: string;
  variant: "primary" | "secondary";
}

export interface SummarySlideConfig {
  type: "summary";
  title: string;
  body?: string;
  actions: SummaryAction[];
  transition?: TransitionType;
}

export type SlideConfig =
  | HeroSlideConfig
  | GiveSlideConfig
  | TakeSlideConfig
  | SummarySlideConfig;

export interface FlowResult {
  answers: Record<string, string | string[]>;
  completedAt: Date;
  durationMs: number;
  action?: string;
}

export type FlowEventType =
  | "flow:started"
  | "flow:slide_viewed"
  | "flow:answer_submitted"
  | "flow:completed"
  | "flow:skipped";

export interface FlowEvent {
  type: FlowEventType;
  slideIndex: number;
  slideType: string;
  durationMs: number;
  data?: Record<string, unknown>;
}

export interface FlowPlayerProps {
  slides: SlideConfig[];
  context: Record<string, string>;
  flowId?: string;
  onComplete: (result: FlowResult) => void;
  onSkip?: () => void;
  onEvent?: (event: FlowEvent) => void;
  defaultTransition?: TransitionType;
  renderIcon?: (iconName: string) => React.ReactNode;
}
