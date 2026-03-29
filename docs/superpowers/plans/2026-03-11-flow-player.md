# FlowPlayer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, config-driven presentation/quiz engine with Apple-level transitions. Dumb primitives, one smart orchestrator.

**Architecture:** FlowPlayer lives in `packages/ui/src/flow-player/`. Primitives are pure render functions (props in, pixels out). FlowPlayer is the only component with state. Config arrays define flows. framer-motion as peer dep.

**Tech Stack:** React 19, TypeScript strict, framer-motion (peer dep), Tailwind v4, CVA for variants, lucide-react for icons.

**Spec:** `docs/superpowers/specs/2026-03-11-flow-player-design.md`

---

## File Map

| File                                                         | Responsibility                 | Creates/Modifies |
| ------------------------------------------------------------ | ------------------------------ | ---------------- |
| `packages/ui/src/flow-player/types.ts`                       | All type definitions           | Create           |
| `packages/ui/src/flow-player/primitives/TemplateText.tsx`    | Resolve `{{var}}` placeholders | Create           |
| `packages/ui/src/flow-player/primitives/ChoiceCard.tsx`      | Clickable option card          | Create           |
| `packages/ui/src/flow-player/primitives/ProgressDots.tsx`    | Navigation dots                | Create           |
| `packages/ui/src/flow-player/primitives/ContinueButton.tsx`  | Animated forward button        | Create           |
| `packages/ui/src/flow-player/primitives/SlideTransition.tsx` | Framer motion slide wrapper    | Create           |
| `packages/ui/src/flow-player/slides/HeroSlide.tsx`           | Big title + background slide   | Create           |
| `packages/ui/src/flow-player/slides/GiveSlide.tsx`           | Info presentation slide        | Create           |
| `packages/ui/src/flow-player/slides/TakeSlide.tsx`           | Question + choices slide       | Create           |
| `packages/ui/src/flow-player/slides/SummarySlide.tsx`        | Answer summary + CTAs          | Create           |
| `packages/ui/src/flow-player/FlowContext.tsx`                | React context for state        | Create           |
| `packages/ui/src/flow-player/FlowPlayer.tsx`                 | Orchestrator component         | Create           |
| `packages/ui/src/flow-player/index.ts`                       | Public exports                 | Create           |
| `packages/ui/src/index.ts`                                   | Add flow-player exports        | Modify           |
| `packages/ui/package.json`                                   | Add framer-motion peer dep     | Modify           |

---

## Chunk 1: Types + Primitives

### Task 1: Types

**Files:**

- Create: `packages/ui/src/flow-player/types.ts`

- [ ] **Step 1: Create type definitions**

```typescript
// packages/ui/src/flow-player/types.ts

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

export type SlideConfig = HeroSlideConfig | GiveSlideConfig | TakeSlideConfig | SummarySlideConfig;

export interface FlowResult {
  answers: Record<string, string | string[]>;
  completedAt: Date;
  action?: string;
}

export interface FlowPlayerProps {
  slides: SlideConfig[];
  context: Record<string, string>;
  onComplete: (result: FlowResult) => void;
  onSkip?: () => void;
  defaultTransition?: TransitionType;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/types.ts
git commit -m "feat(flow-player): add type definitions"
```

---

### Task 2: TemplateText primitive

**Files:**

- Create: `packages/ui/src/flow-player/primitives/TemplateText.tsx`

- [ ] **Step 1: Create TemplateText**

Pure function. Replaces `{{variableName}}` with values from context. No state.

```tsx
// packages/ui/src/flow-player/primitives/TemplateText.tsx
import { cn } from "../../lib/utils";

interface TemplateTextProps {
  template: string;
  context: Record<string, string>;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
}

function resolveTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => context[key] ?? "");
}

export function TemplateText({
  template,
  context,
  as: Tag = "span",
  className,
}: TemplateTextProps) {
  return <Tag className={cn(className)}>{resolveTemplate(template, context)}</Tag>;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/primitives/TemplateText.tsx
git commit -m "feat(flow-player): add TemplateText primitive"
```

---

### Task 3: ChoiceCard primitive

**Files:**

- Create: `packages/ui/src/flow-player/primitives/ChoiceCard.tsx`

- [ ] **Step 1: Create ChoiceCard**

Dumb. Props in → card out. Handles hover/select transitions via Tailwind + framer-motion.

```tsx
// packages/ui/src/flow-player/primitives/ChoiceCard.tsx
"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface ChoiceCardProps {
  label: string;
  icon?: React.ReactNode;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}

export function ChoiceCard({ label, icon, description, selected, onSelect }: ChoiceCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      animate={selected ? { scale: [1, 0.97, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-2xl border px-6 py-8 text-center transition-all duration-300",
        "hover:shadow-lg",
        selected
          ? "border-brand-orange/40 bg-brand-orange/5 shadow-brand-orange/10 shadow-md"
          : "border-border bg-card hover:border-border/80",
      )}
    >
      {/* Check indicator */}
      <motion.div
        className="absolute top-3 right-3"
        initial={false}
        animate={selected ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <div className="bg-brand-orange flex h-6 w-6 items-center justify-center rounded-full">
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        </div>
      </motion.div>

      {/* Icon */}
      {icon && (
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300",
            selected ? "bg-brand-orange/10 text-brand-orange" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
      )}

      {/* Label */}
      <span
        className={cn(
          "text-sm font-semibold transition-colors duration-300",
          selected ? "text-foreground" : "text-foreground/80",
        )}
      >
        {label}
      </span>

      {/* Description */}
      {description && (
        <span className="text-muted-foreground text-xs leading-relaxed">{description}</span>
      )}
    </motion.button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/primitives/ChoiceCard.tsx
git commit -m "feat(flow-player): add ChoiceCard primitive"
```

---

### Task 4: ProgressDots primitive

**Files:**

- Create: `packages/ui/src/flow-player/primitives/ProgressDots.tsx`

- [ ] **Step 1: Create ProgressDots**

```tsx
// packages/ui/src/flow-player/primitives/ProgressDots.tsx
"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface ProgressDotsProps {
  total: number;
  current: number;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "h-2 rounded-full transition-colors duration-300",
            i === current ? "bg-brand-orange" : i < current ? "bg-brand-orange/30" : "bg-border",
          )}
          animate={{
            width: i === current ? 24 : 8,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/primitives/ProgressDots.tsx
git commit -m "feat(flow-player): add ProgressDots primitive"
```

---

### Task 5: ContinueButton primitive

**Files:**

- Create: `packages/ui/src/flow-player/primitives/ContinueButton.tsx`

- [ ] **Step 1: Create ContinueButton**

```tsx
// packages/ui/src/flow-player/primitives/ContinueButton.tsx
"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface ContinueButtonProps {
  enabled: boolean;
  onClick: () => void;
  label?: string;
}

export function ContinueButton({ enabled, onClick, label = "Neste" }: ContinueButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: enabled ? 1 : 0.4,
        y: enabled ? 0 : 10,
      }}
      whileHover={enabled ? { scale: 1.02 } : undefined}
      whileTap={enabled ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-semibold transition-colors duration-200",
        enabled
          ? "bg-brand-orange text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)]"
          : "bg-muted text-muted-foreground cursor-not-allowed",
      )}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </motion.button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/primitives/ContinueButton.tsx
git commit -m "feat(flow-player): add ContinueButton primitive"
```

---

### Task 6: SlideTransition wrapper

**Files:**

- Create: `packages/ui/src/flow-player/primitives/SlideTransition.tsx`

- [ ] **Step 1: Create SlideTransition**

Wraps any slide content with animated entrance/exit. Staggered children.

```tsx
// packages/ui/src/flow-player/primitives/SlideTransition.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TransitionType } from "../types";

interface SlideTransitionProps {
  slideKey: string | number;
  transition?: TransitionType;
  direction?: 1 | -1;
  children: React.ReactNode;
}

const VARIANTS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  push: {
    initial: (d: number) => ({ opacity: 0, x: d * 80 }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -80 }),
  },
  reveal: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  morph: {
    initial: { opacity: 0, scale: 0.98, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: -10 },
  },
};

export function SlideTransition({
  slideKey,
  transition = "fade",
  direction = 1,
  children,
}: SlideTransitionProps) {
  const v = VARIANTS[transition];

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={slideKey}
        custom={direction}
        initial={typeof v.initial === "function" ? v.initial(direction) : v.initial}
        animate={v.animate}
        exit={typeof v.exit === "function" ? v.exit(direction) : v.exit}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/primitives/SlideTransition.tsx
git commit -m "feat(flow-player): add SlideTransition wrapper"
```

---

## Chunk 2: Slide Components

### Task 7: HeroSlide

**Files:**

- Create: `packages/ui/src/flow-player/slides/HeroSlide.tsx`

- [ ] **Step 1: Create HeroSlide**

Dumb. Renders centered title + subtitle with staggered entrance. Optional background.

```tsx
// packages/ui/src/flow-player/slides/HeroSlide.tsx
"use client";

import { motion } from "framer-motion";
import { TemplateText } from "../primitives/TemplateText";
import type { HeroSlideConfig } from "../types";

interface HeroSlideProps {
  config: HeroSlideConfig;
  context: Record<string, string>;
  onContinue: () => void;
}

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

export function HeroSlide({ config, context, onContinue }: HeroSlideProps) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-6">
      {/* Background */}
      {config.background?.type === "gradient" && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: config.background.src }}
        />
      )}
      {config.background?.type === "image" && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${config.background.src})` }}
        />
      )}

      <motion.div
        className="relative z-10 flex max-w-2xl flex-col items-center gap-6 text-center"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeUp}>
          <TemplateText
            template={config.title}
            context={context}
            as="h1"
            className="font-heading text-foreground text-5xl leading-[1.1] tracking-tight sm:text-7xl"
          />
        </motion.div>

        {config.subtitle && (
          <motion.div variants={fadeUp}>
            <TemplateText
              template={config.subtitle}
              context={context}
              as="p"
              className="text-muted-foreground text-xl leading-relaxed"
            />
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <button
            type="button"
            onClick={onContinue}
            className="text-muted-foreground/60 hover:text-muted-foreground mt-4 text-sm transition-colors"
          >
            Trykk for å fortsette
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/slides/HeroSlide.tsx
git commit -m "feat(flow-player): add HeroSlide"
```

---

### Task 8: GiveSlide

**Files:**

- Create: `packages/ui/src/flow-player/slides/GiveSlide.tsx`

- [ ] **Step 1: Create GiveSlide**

Split or centered layout. Shows information with media.

```tsx
// packages/ui/src/flow-player/slides/GiveSlide.tsx
"use client";

import { motion } from "framer-motion";
import { TemplateText } from "../primitives/TemplateText";
import type { GiveSlideConfig } from "../types";

interface GiveSlideProps {
  config: GiveSlideConfig;
  context: Record<string, string>;
  onContinue: () => void;
}

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

function resolveTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => context[key] ?? "");
}

export function GiveSlide({ config, context, onContinue }: GiveSlideProps) {
  const isSplit = config.layout === "split" && config.media;

  if (isSplit) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex w-full max-w-4xl items-center gap-16">
          {/* Media */}
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {config.media?.type === "image" && (
              <img
                src={resolveTemplate(config.media.src, context)}
                alt={config.media.alt ?? ""}
                className="w-full rounded-2xl object-cover shadow-lg"
              />
            )}
          </motion.div>

          {/* Text */}
          <motion.div
            className="flex flex-1 flex-col gap-4"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp}>
              <TemplateText
                template={config.title}
                context={context}
                as="h2"
                className="font-heading text-foreground text-4xl leading-[1.1] tracking-tight"
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <TemplateText
                template={config.body}
                context={context}
                as="p"
                className="text-muted-foreground text-lg leading-relaxed"
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <button
                type="button"
                onClick={onContinue}
                className="text-muted-foreground/60 hover:text-muted-foreground mt-2 text-sm transition-colors"
              >
                Trykk for å fortsette
              </button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Center layout
  return (
    <div className="flex h-full items-center justify-center px-6">
      <motion.div
        className="flex max-w-2xl flex-col items-center gap-6 text-center"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {config.media?.type === "image" && (
          <motion.img
            variants={fadeUp}
            src={resolveTemplate(config.media.src, context)}
            alt={config.media.alt ?? ""}
            className="h-48 w-48 rounded-2xl object-cover shadow-lg"
          />
        )}
        <motion.div variants={fadeUp}>
          <TemplateText
            template={config.title}
            context={context}
            as="h2"
            className="font-heading text-foreground text-4xl leading-[1.1] tracking-tight sm:text-5xl"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <TemplateText
            template={config.body}
            context={context}
            as="p"
            className="text-muted-foreground text-lg leading-relaxed"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <button
            type="button"
            onClick={onContinue}
            className="text-muted-foreground/60 hover:text-muted-foreground mt-2 text-sm transition-colors"
          >
            Trykk for å fortsette
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/slides/GiveSlide.tsx
git commit -m "feat(flow-player): add GiveSlide"
```

---

### Task 9: TakeSlide

**Files:**

- Create: `packages/ui/src/flow-player/slides/TakeSlide.tsx`

- [ ] **Step 1: Create TakeSlide**

Question + choice cards. Dumb — receives selected state and callbacks.

```tsx
// packages/ui/src/flow-player/slides/TakeSlide.tsx
"use client";

import { motion } from "framer-motion";
import { ChoiceCard } from "../primitives/ChoiceCard";
import { ContinueButton } from "../primitives/ContinueButton";
import { TemplateText } from "../primitives/TemplateText";
import type { TakeSlideConfig, ChoiceOption } from "../types";

interface TakeSlideProps {
  config: TakeSlideConfig;
  context: Record<string, string>;
  selected: string[];
  onToggle: (optionId: string) => void;
  onContinue: () => void;
  renderIcon?: (iconName: string) => React.ReactNode;
}

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export function TakeSlide({
  config,
  context,
  selected,
  onToggle,
  onContinue,
  renderIcon,
}: TakeSlideProps) {
  const hasSelection = selected.length > 0;

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="flex w-full max-w-3xl flex-col items-center gap-10">
        {/* Question */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <TemplateText
            template={config.question}
            context={context}
            as="h2"
            className="font-heading text-foreground text-3xl leading-[1.2] tracking-tight sm:text-4xl"
          />
        </motion.div>

        {/* Choice grid */}
        <motion.div
          className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {config.options.map((option: ChoiceOption) => (
            <motion.div key={option.id} variants={fadeUp}>
              <ChoiceCard
                label={option.label}
                icon={option.icon && renderIcon ? renderIcon(option.icon) : undefined}
                description={option.description}
                selected={selected.includes(option.id)}
                onSelect={() => onToggle(option.id)}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Continue */}
        <ContinueButton enabled={hasSelection} onClick={onContinue} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/slides/TakeSlide.tsx
git commit -m "feat(flow-player): add TakeSlide"
```

---

### Task 10: SummarySlide

**Files:**

- Create: `packages/ui/src/flow-player/slides/SummarySlide.tsx`

- [ ] **Step 1: Create SummarySlide**

```tsx
// packages/ui/src/flow-player/slides/SummarySlide.tsx
"use client";

import { motion } from "framer-motion";
import { TemplateText } from "../primitives/TemplateText";
import type { SummarySlideConfig, SummaryAction } from "../types";
import { cn } from "../../lib/utils";

interface SummarySlideProps {
  config: SummarySlideConfig;
  context: Record<string, string>;
  answers: Record<string, string | string[]>;
  onAction: (actionKey: string) => void;
}

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export function SummarySlide({ config, context, answers, onAction }: SummarySlideProps) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <motion.div
        className="flex w-full max-w-xl flex-col items-center gap-8 text-center"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeUp}>
          <TemplateText
            template={config.title}
            context={context}
            as="h2"
            className="font-heading text-foreground text-4xl leading-[1.1] tracking-tight sm:text-5xl"
          />
        </motion.div>

        {config.body && (
          <motion.div variants={fadeUp}>
            <TemplateText
              template={config.body}
              context={context}
              as="p"
              className="text-muted-foreground text-lg leading-relaxed"
            />
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          variants={fadeUp}
          className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4"
        >
          {config.actions.map((action: SummaryAction) => (
            <button
              key={action.key}
              type="button"
              onClick={() => onAction(action.key)}
              className={cn(
                "rounded-xl px-8 py-3.5 text-sm font-semibold transition-all duration-200",
                action.variant === "primary"
                  ? "bg-brand-orange text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110"
                  : "border-border bg-card text-foreground hover:bg-accent border",
              )}
            >
              {action.label}
            </button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/slides/SummarySlide.tsx
git commit -m "feat(flow-player): add SummarySlide"
```

---

## Chunk 3: Orchestrator + Exports

### Task 11: FlowContext

**Files:**

- Create: `packages/ui/src/flow-player/FlowContext.tsx`

- [ ] **Step 1: Create FlowContext**

The ONLY place with state. Manages current slide, answers, navigation direction.

```tsx
// packages/ui/src/flow-player/FlowContext.tsx
"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { SlideConfig, FlowResult } from "./types";

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
  children: ReactNode;
}

export function FlowProvider({ slides, onComplete, children }: FlowProviderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const directionRef = useRef<1 | -1>(1);

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

  const toggleAnswer = useCallback((key: string, optionId: string, multi: boolean) => {
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
  }, []);

  const complete = useCallback(
    (action?: string) => {
      onComplete({ answers, completedAt: new Date(), action });
    },
    [answers, onComplete],
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/FlowContext.tsx
git commit -m "feat(flow-player): add FlowContext state management"
```

---

### Task 12: FlowPlayer orchestrator

**Files:**

- Create: `packages/ui/src/flow-player/FlowPlayer.tsx`

- [ ] **Step 1: Create FlowPlayer**

The main component. Routes slide configs to slide components. Manages background and chrome.

```tsx
// packages/ui/src/flow-player/FlowPlayer.tsx
"use client";

import { useCallback } from "react";
import { FlowProvider, useFlow } from "./FlowContext";
import { SlideTransition } from "./primitives/SlideTransition";
import { ProgressDots } from "./primitives/ProgressDots";
import { HeroSlide } from "./slides/HeroSlide";
import { GiveSlide } from "./slides/GiveSlide";
import { TakeSlide } from "./slides/TakeSlide";
import { SummarySlide } from "./slides/SummarySlide";
import type { FlowPlayerProps, SlideConfig, TransitionType } from "./types";

interface FlowRendererProps {
  slides: SlideConfig[];
  context: Record<string, string>;
  defaultTransition: TransitionType;
  onSkip?: () => void;
  renderIcon?: (iconName: string) => React.ReactNode;
}

function FlowRenderer({
  slides,
  context,
  defaultTransition,
  onSkip,
  renderIcon,
}: FlowRendererProps) {
  const { currentSlide, direction, answers, totalSlides, next, toggleAnswer, complete } = useFlow();
  const config = slides[currentSlide];
  if (!config) return null;

  const transition = config.transition ?? defaultTransition;

  const getSelected = useCallback(
    (key: string): string[] => {
      const val = answers[key];
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    },
    [answers],
  );

  return (
    <div className="bg-background relative flex h-dvh flex-col">
      {/* Skip button */}
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-muted-foreground/50 hover:text-muted-foreground absolute top-6 right-6 z-20 text-sm transition-colors"
        >
          Hopp over
        </button>
      )}

      {/* Slide content */}
      <div className="flex-1">
        <SlideTransition slideKey={currentSlide} transition={transition} direction={direction}>
          {config.type === "hero" && (
            <HeroSlide config={config} context={context} onContinue={next} />
          )}
          {config.type === "give" && (
            <GiveSlide config={config} context={context} onContinue={next} />
          )}
          {config.type === "take" && (
            <TakeSlide
              config={config}
              context={context}
              selected={getSelected(config.answerKey)}
              onToggle={(optionId) =>
                toggleAnswer(config.answerKey, optionId, config.multi ?? false)
              }
              onContinue={next}
              renderIcon={renderIcon}
            />
          )}
          {config.type === "summary" && (
            <SummarySlide
              config={config}
              context={context}
              answers={answers}
              onAction={(key) => complete(key)}
            />
          )}
        </SlideTransition>
      </div>

      {/* Progress dots */}
      <div className="pb-8">
        <ProgressDots total={totalSlides} current={currentSlide} />
      </div>
    </div>
  );
}

export function FlowPlayer({
  slides,
  context,
  onComplete,
  onSkip,
  defaultTransition = "fade",
  renderIcon,
}: FlowPlayerProps & { renderIcon?: (iconName: string) => React.ReactNode }) {
  return (
    <FlowProvider slides={slides} onComplete={onComplete}>
      <FlowRenderer
        slides={slides}
        context={context}
        defaultTransition={defaultTransition}
        onSkip={onSkip}
        renderIcon={renderIcon}
      />
    </FlowProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/flow-player/FlowPlayer.tsx
git commit -m "feat(flow-player): add FlowPlayer orchestrator"
```

---

### Task 13: Exports + package.json

**Files:**

- Create: `packages/ui/src/flow-player/index.ts`
- Modify: `packages/ui/src/index.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Create barrel export**

```typescript
// packages/ui/src/flow-player/index.ts
export { FlowPlayer } from "./FlowPlayer";
export { ChoiceCard } from "./primitives/ChoiceCard";
export { ContinueButton } from "./primitives/ContinueButton";
export { ProgressDots } from "./primitives/ProgressDots";
export { TemplateText } from "./primitives/TemplateText";
export { SlideTransition } from "./primitives/SlideTransition";
export type {
  SlideConfig,
  HeroSlideConfig,
  GiveSlideConfig,
  TakeSlideConfig,
  SummarySlideConfig,
  FlowPlayerProps,
  FlowResult,
  ChoiceOption,
  TransitionType,
} from "./types";
```

- [ ] **Step 2: Add to main index.ts**

Add to `packages/ui/src/index.ts`:

```typescript
export * from "./flow-player";
```

- [ ] **Step 3: Add framer-motion as peer dependency**

In `packages/ui/package.json`, add to `peerDependencies`:

```json
"framer-motion": ">=11.0.0"
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/flow-player/index.ts packages/ui/src/index.ts packages/ui/package.json
git commit -m "feat(flow-player): add exports and framer-motion peer dep"
```

---

## Chunk 4: Verification

### Task 14: Typecheck

- [ ] **Step 1: Run typecheck**

```bash
pnpm --filter @smartout/ui exec tsc --noEmit
```

Expected: 0 errors from flow-player files.

- [ ] **Step 2: Fix any type errors found**

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -u
git commit -m "fix(flow-player): resolve type errors"
```
