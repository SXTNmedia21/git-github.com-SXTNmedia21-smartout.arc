---
id: "0011"
title: Framer Motion Landing Page Animation Patterns
date: 2026-02-28
tags: [framer-motion, animation, landing, ux, performance]
---

# Learning-0011: Framer Motion Landing Page Animation Patterns

## Context

Adding animations to the landing page (`apps/landing/`) to create visual life and movement without overwhelming users. Used across homepage sections, feature pages, and concept pages.

## Discovery

Three tiers of animation work well together on landing pages:

### 1. Entrance animations (staggered reveals)

Grid cards benefit from staggered `whileInView` animations with a short delay per index (`i * 0.08` to `i * 0.12`). Combined with `viewport={{ once: true }}` so they only play on first scroll.

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: i * 0.1, duration: 0.4 }}
/>
```

### 2. Ambient animations (breathing/floating loops)

Icons and decorative elements benefit from subtle infinite loops. Keep displacement small (scale 1-1.1, y 0-3px) and duration long (3-4s) to avoid distraction.

```tsx
<motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }} />
<motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3, repeat: Infinity }} />
```

### 3. State-machine animations (phase transitions)

Complex interactive components (like the Workspace Analyzer) benefit from `AnimatePresence mode="wait"` with keyed phases. Each phase gets enter/exit animations.

### Performance consideration

The project's `globals.css` already has `@media (prefers-reduced-motion: reduce)` disabling animations — no extra work needed per component.

## Impact

- Pattern is reusable across all landing pages and feature showcase pages
- "Just right" amount: entrance + 2-3 ambient loops per section max
- Tag pills (small elements): use `scale` pop-in instead of `y` slide to avoid layout shift
- Never animate text content — only containers, icons, and decorative elements

## References

- `apps/landing/src/app/page.tsx` — Homepage with all three tiers
- `apps/landing/src/components/workspace-analyzer.tsx` — Phase-based state machine
- `apps/landing/src/app/features/punchclock-timetracking/page.tsx` — Staggered cards + overlay transitions
