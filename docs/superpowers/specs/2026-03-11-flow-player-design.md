---
title: FlowPlayer — Interactive Presentation/Quiz Engine
status: approved
created: 2026-03-11
updated: 2026-03-11
module: ui
tags: [flow-player, presentation, quiz, onboarding, standalone]
---

# FlowPlayer — Design Spec

## Purpose

A standalone, config-driven presentation and quiz engine. Renders slides from a config array. No business logic. Reusable across admin onboarding, employee training, product tours, quizzes.

## Principles

1. **Dumb components** — primitives receive props, render pixels. Zero internal state, zero business logic.
2. **Config-driven** — every flow is a `SlideConfig[]`. No hardcoded content inside components.
3. **Standalone** — lives in `packages/ui/src/flow-player/`. No imports from `apps/web/`, no Supabase, no dashboard deps.
4. **Light theme default** — warm cream background matching Smartout design tokens.
5. **Apple-level transitions** — spring-based, staggered entrances, morph between slides.

## Slide Types

| Type      | Layout                                       | Purpose              |
| --------- | -------------------------------------------- | -------------------- |
| `hero`    | Centered title + subtitle + background media | Opening, wow-moments |
| `give`    | Split (media + text) or centered             | Present information  |
| `take`    | Question + interactive choice cards in grid  | Collect answers      |
| `summary` | Compact answer list + CTA buttons            | Closing, transition  |

## Transitions

- `morph` — shared elements morph position/size between slides
- `fade` — soft crossfade (default)
- `push` — new slide pushes in from right
- `reveal` — content reveals from below, staggered per element
- `scale` — gentle zoom in/out

Every element on a slide has staggered entrance: title first, then body, then interactive elements. Spring easing via framer-motion.

## Micro-interactions

- **ChoiceCard hover:** translateY -2px + shadow grow + border glow
- **ChoiceCard select:** Scale bounce (1.0 → 0.97 → 1.02 → 1.0) + check reveal + color shift
- **ContinueButton:** Disabled → enabled animation (opacity + slide up) when selection made
- **ProgressDots:** Active dot expands with spring, fill animation
- **Background:** Subtle gradient shift between slides

## Package Structure

```
packages/ui/src/flow-player/
├── FlowPlayer.tsx           # Orchestrator: state + slide routing + background
├── FlowContext.tsx           # React context: answers, currentSlide, navigate()
├── types.ts                 # SlideConfig, FlowResult, ChoiceOption, transitions
├── slides/
│   ├── HeroSlide.tsx        # Big title, background media
│   ├── GiveSlide.tsx        # Info presentation (split/center layout)
│   ├── TakeSlide.tsx        # Question + interactive choices
│   └── SummarySlide.tsx     # Answer summary + CTA buttons
├── primitives/
│   ├── ChoiceCard.tsx       # Clickable card: icon + label + selected state
│   ├── SlideTransition.tsx  # Framer motion orchestrator for slide changes
│   ├── ProgressDots.tsx     # Bottom navigation dots
│   ├── ContinueButton.tsx   # Animated forward button
│   └── TemplateText.tsx     # Resolves {{variable}} placeholders from context
└── index.ts                 # Public exports
```

## Component Contracts

### FlowPlayer (smart — the ONLY smart component)

```tsx
interface FlowPlayerProps {
  slides: SlideConfig[];
  context: Record<string, string>; // Template variables: companyName, logoUrl, etc.
  onComplete: (result: FlowResult) => void;
  onSkip?: () => void;
  defaultTransition?: TransitionType;
}
```

### Primitives (dumb — props in, pixels out)

```tsx
// ChoiceCard
interface ChoiceCardProps {
  label: string;
  icon?: string; // Lucide icon name
  description?: string;
  selected: boolean;
  onSelect: () => void;
}

// ContinueButton
interface ContinueButtonProps {
  enabled: boolean;
  onClick: () => void;
  label?: string; // Default: "Neste"
}

// ProgressDots
interface ProgressDotsProps {
  total: number;
  current: number;
}

// TemplateText
interface TemplateTextProps {
  template: string; // "Velkommen, {{companyName}}"
  context: Record<string, string>;
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
}
```

### Slide Configs

```typescript
type SlideConfig = HeroSlideConfig | GiveSlideConfig | TakeSlideConfig | SummarySlideConfig;

interface HeroSlideConfig {
  type: "hero";
  title: string; // Supports {{variables}}
  subtitle?: string;
  background?: { type: "image" | "gradient"; src: string };
  transition?: TransitionType;
}

interface GiveSlideConfig {
  type: "give";
  title: string;
  body: string;
  media?: { type: "image" | "icon"; src: string; alt?: string };
  layout?: "center" | "split";
  transition?: TransitionType;
}

interface TakeSlideConfig {
  type: "take";
  question: string;
  answerKey: string; // Key in FlowResult.answers
  options: ChoiceOption[];
  multi?: boolean; // Multi-select (default: false)
  transition?: TransitionType;
}

interface SummarySlideConfig {
  type: "summary";
  title: string;
  body?: string;
  actions: { label: string; key: string; variant: "primary" | "secondary" }[];
  transition?: TransitionType;
}

interface ChoiceOption {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}

type TransitionType = "morph" | "fade" | "push" | "reveal" | "scale";

interface FlowResult {
  answers: Record<string, string | string[]>;
  completedAt: Date;
  action?: string; // Which summary CTA was clicked
}
```

## First Flow: Admin Onboarding Info

9 slides alternating give/take. Uses data from Join flow (companyName, logoUrl, description). Collects: painPoints, targetAudience, policyPriorities, toneOfVoice. Result feeds into wizard/handbook-builder.

## Integration Point

FlowPlayer renders fullscreen inside the dashboard. Dashboard sidebar minimized, header hidden. FlowPlayer manages its own background and layout.

```tsx
// In dashboard — when first visit detected
{
  showInfoFlow && (
    <FlowPlayer
      slides={adminOnboardingSlides}
      context={{ companyName: business.name, logoUrl: business.logoUrl }}
      onComplete={(result) => {
        saveInfoFlowResult(result);
        setShowInfoFlow(false);
      }}
      onSkip={() => setShowInfoFlow(false)}
    />
  );
}
```
