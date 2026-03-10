---
title: "Design Audit — Landing, Onboarding, Dashboard"
status: in_progress
updated: 2026-03-05
created: 2026-03-05
module: design-system
tags: [design, audit, visual-continuity, brand, animation]
---

# Design Audit — Three Surfaces

**Date:** 2026-03-05
**Scope:** Landing (`apps/landing/`), Onboarding (`apps/web/src/app/onboarding/`), Dashboard (`apps/web/src/components/dashboard/`)
**Goal:** Document current design language across all three surfaces, identify inconsistencies, and propose a unified direction.

---

## 1. Surface-by-Surface Findings

### 1.1 Landing Page (`apps/landing/`)

**Overall character:** Dark, high-energy, gradient-heavy. "Flower power" is an accurate description — lots of ambient orbs, gradient text, shimmer effects, and spring animations. Feels like a premium SaaS marketing page, but the visual intensity is dialed up high.

**Color palette:**

- Background: `#050505` (near-black, darker than dashboard's `zinc-950`)
- Text: white, `zinc-400`, `zinc-500`
- Accent: orange-600/rose-600 gradient (CTAs), orange-500 (active states, dots)
- Status chips: emerald-400 (active), orange-400 (warning), white/20 (inactive)
- Ambient orbs: `orange-600/8`, `rose-600/8`, `purple-600/6` — with `mix-blend-screen`
- Card surfaces: `white/[0.03]`, `white/[0.05]`, `#0a0a0c/60`
- Borders: `white/5`, `white/10`, `orange-500/20`

**Typography:**

- Headlines: `font-black tracking-tighter`, sizes up to `text-[7.5rem]`
- Gradient text: `bg-gradient-to-r from-orange-400 via-rose-400 to-orange-400 bg-clip-text text-transparent`
- Body: `text-zinc-400`, `text-zinc-500`, `font-medium` to `font-semibold`
- Section labels: `text-[10px] font-bold tracking-widest uppercase`
- Display font: NOT using `font-heading` (Instrument Serif) — all Geist Sans

**Spacing:**

- Sections: generous `pt-32 pb-20` to `pt-48 pb-32`
- Inner cards: `p-4` to `p-6`
- Gaps: `gap-3`, `gap-4`, `gap-6`
- Max width: `max-w-7xl` (1280px)

**Borders & surfaces:**

- Very thin: `border-white/5`, `border-white/10`
- Card surface: frosted glass-like `bg-white/[0.03]` + `backdrop-blur-3xl`
- Navigation: `bg-[#0a0a0c]/90` with `backdrop-blur-3xl`, transitions on scroll
- Rounded corners: `rounded-2xl` (cards), `rounded-full` (badges, CTAs), `rounded-xl` (buttons)

**Animation (heaviest of all three surfaces):**

- Framer Motion (`m.div`, `m.span` shorthand) — used extensively
- `staggerChildren: 0.1`, `delayChildren: 0.2` on hero container
- Spring animations: `stiffness: 80-100`, `damping: 15`
- Custom keyframes in CSS: `float` (6s infinite), `glow-shift` (8s infinite), `hero-glow` (4s infinite), `shimmer` (3s, once)
- `layoutId="nav-active-dot"` with spring transition (0.5s) on nav
- Floating dashboard mockup: `animate={{ y: [0, -12, 0] }}` (6s infinite)
- AnimatePresence on mobile menu icon (rotate in/out)
- Reduced motion support: `motion-safe:` prefix and `@media (prefers-reduced-motion)`

**Component patterns:**

- Navigation: fixed top, frosted glass, orange active dot, white CTA pill
- Hero: centered text, staggered reveal, gradient CTA with outer glow
- Dashboard mockup: window chrome (traffic light dots), mock sidebar + cards
- Sections: full-viewport, center-aligned, `section-divider` between
- Footer: 3-column links, brand, gradient top-border accent
- Multiple landing variants (A/E/F/K/S/T) — A/B testing different layouts

**Inconsistencies with other surfaces:**

- Uses `#050505` as base (darker than anywhere else)
- `mix-blend-screen` on orbs (not used in dashboard/onboarding)
- `backdrop-blur-3xl` (stronger than onboarding's `backdrop-blur-xl`)
- No `font-heading` (Instrument Serif) usage despite it being defined
- Gradient text with shimmer effect — nowhere else in the product
- Purple as a third accent color (only appears on landing)

---

### 1.2 Onboarding (`apps/web/src/app/onboarding/`)

**Overall character:** Dark, cinematic, immersive. Full-screen scroll-snapped sections with parallax backgrounds. More restrained than landing but still atmospheric. Feels like an Apple keynote — deliberate reveals, generous white space, minimal UI chrome.

**Color palette:**

- Background: Per-section color temperature journey via CSS custom properties:
  - hero: `oklch(0.13 0.01 250)` (cool blue-black)
  - business: `oklch(0.12 0.02 60)` (warm amber-black)
  - season: `oklch(0.11 0.03 35)` (orange-tinted black)
  - departments: `oklch(0.1 0.02 150)` (green-tinted black)
  - locations: `oklch(0.11 0.02 180)` (teal-tinted black)
  - procedures: `oklch(0.1 0.02 220)` (blue-tinted black)
  - contract: `oklch(0.12 0.01 280)` (purple-tinted black)
  - welcome: `oklch(0.11 0.03 80)` (warm yellow-black)
- Glow orb: `oklch(0.75 0.15 55)` (warm amber)
- Text: white, `white/50`, `white/30`, `white/40`
- Card surfaces: `white/[0.05]`, `white/[0.07]`
- Borders: `white/[0.06]`, `white/[0.04]`
- Buttons: white bg (primary), `white/[0.05]` + border (secondary)
- Errors: `red-400`

**Typography:**

- Headlines: `font-heading` (Instrument Serif), `text-6xl` to `text-7xl`, `tracking-tight`
- Body: `text-xl leading-relaxed`, `text-white/50`
- Labels: `text-sm`, `text-white/30`
- Inputs: `text-white`, `placeholder:text-white/30`

**Spacing:**

- Full-screen sections: `min-h-dvh`
- Content max width: `max-w-lg` (512px) to `max-w-2xl` (672px)
- Card padding: `p-8`
- Input spacing: `mt-3` between fields
- Section gaps: `gap-10`

**Borders & surfaces:**

- Very subtle: `border-white/[0.06]`
- Card surface: `bg-white/[0.07]` with `shadow-lg shadow-black/20`
- Inputs: `border-white/[0.06] bg-white/5`
- Rounded corners: `rounded-2xl` (cards, buttons), `rounded-xl` (inputs)

**Animation (medium intensity — cinematic but controlled):**

- Framer Motion (`motion` from `framer-motion` — NOT `m` shorthand)
- `SectionReveal` component: stagger 0.18s, delay 0.25s, y: 40 -> 0, duration 1.0s with custom ease `[0.16, 1, 0.3, 1]`
- `ParallaxBackground`: `useScroll` + `useTransform` for two orbs with different speeds (20%, 35%)
- `BotssonAvatar`: drag, breathing ring animation, voice visualizer bars
- Progress bar: `duration: 1.0, ease: [0.16, 1, 0.3, 1]`
- Page sections: `whileInView` fade-up, duration 1.2s
- Scale animations on voice avatar (breathing, speaking) — allowed per design spec

**Component patterns:**

- Scroll-snapped vertical sections (one per data entry step)
- ParallaxBackground per section with 2 glowing orbs
- SectionReveal + RevealItem pattern for staggered content entrance
- BotssonAvatar: floating draggable AI assistant (bottom-right)
- VoiceSessionOverlay: full-screen takeover for voice mode
- NavigationController: keyboard/swipe navigation between sections
- KeyFactsPanel: extracted business data sidebar
- BigBoard: data materializer showing scraped business info

**Inconsistencies with other surfaces:**

- Uses `font-heading` (Instrument Serif) — landing and dashboard do not
- White primary buttons (not orange gradient like landing CTA)
- Color temperature journey concept is unique to onboarding
- `white/[0.06]` border convention (dashboard uses `zinc-800`, landing uses `white/10`)
- No theme toggle — always dark
- Inputs styled differently from auth pages (no labels, different focus styles)

---

### 1.3 Dashboard (`apps/web/src/components/dashboard/`)

**Overall character:** Functional, data-dense, tool-like. Classic admin panel with sidebar, header, content area. Supports dark/light mode via `isDark` prop drilling. Feels like a professional operations tool — closer to Linear or Vercel than to the landing page.

**Color palette (dark mode — default):**

- Header: `#0a0a0c`
- Sidebar: `#0c0c0e`
- Main area: `bg-zinc-950`
- Cards: `bg-card` (CSS var), `bg-zinc-900`
- Borders: `border-zinc-800`, `border-zinc-800/50`, `border-zinc-900`
- Text: `text-foreground` (via CSS var), `text-muted-foreground`, `text-zinc-400`, `text-zinc-500`
- Status: emerald-500 (good), orange-500 (warning), red-500 (critical)
- Active accent: orange-500 with glow `shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]`
- Badge pattern: `border-{color}-500/20 bg-{color}-500/10 text-{color}-400`

**Color palette (light mode):**

- Header: `bg-zinc-900 text-white` (stays dark — intentional)
- Sidebar: `bg-white`, `border-zinc-200`
- Main area: `bg-zinc-50`
- Cards: `bg-white`, `border-zinc-200`
- Text: `text-zinc-900`, `text-zinc-500`, `text-zinc-400`
- Status: emerald-600, orange-600, red-600 (darker variants)

**Typography:**

- Headers: `font-black` (900 weight)
- Labels: `text-[10px] font-bold tracking-widest uppercase`
- Values: `text-3xl font-bold`, `text-2xl font-black`
- Body: `text-sm font-semibold`, `text-xs font-medium`
- Breadcrumb: `text-sm`, `font-semibold capitalize`

**Spacing:**

- Header height: `h-14`
- Sidebar width: `w-64` (expanded), `w-16` (collapsed)
- Action bar height: `h-16`
- Card padding: `p-5`
- Gaps: `gap-3`, `gap-4`
- Content area: `px-6 md:px-8`

**Borders & surfaces:**

- Solid borders: `border-zinc-800` (dark), `border-zinc-200` (light)
- Card style: `rounded-2xl border bg-card`
- Sidebar divider: `border-t border-zinc-800`
- Minimal separators: `h-px` dividers

**Animation (minimal — functional only):**

- `transition-colors duration-300` on major containers (theme switch)
- `transition-[width] duration-200` on sidebar collapse
- `transition-all` on hover states
- `animate-pulse` on status dots and skeletons
- `animate-spin` on loaders (Loader2)
- Ring chart stroke: `transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)`
- Progress bars: `transition-all duration-1000 ease-out`
- Expand panels: `transition-all duration-300 ease-out` (max-height toggle)
- NO Framer Motion in core dashboard components (SignalCard, ActionStrip, LeaderPulseCard)
- Glow orb on SignalCard: `blur-2xl transition-all duration-500 group-hover:h-32`

**Component patterns:**

- DashboardShell: full layout with header + sidebar + content
- DashboardContext: 20+ values including `isDark`, `isAdminMode`, `activeView`, etc.
- SignalCard: reusable metric card with status-based coloring, sparkline, ring chart, expand panel
- ActionStrip: horizontal alert chips with priority coloring
- NavItem: sidebar link with tooltip (collapsed), badge support, AI indicator
- Admin/Employee mode toggle: bottom of sidebar, custom toggle switch
- Layout/view toggles: pill-button groups with orange active glow
- Breadcrumb: in action bar, shows current path

**Dual theme system:**

- `isDark` boolean prop-drilled from DashboardShell
- Ternary pattern everywhere: `isDark ? "dark-class" : "light-class"`
- `.dark` class on root container enables CSS variable dark theme
- SignalCard uses CSS variables (`bg-card`, `text-foreground`, `text-muted-foreground`)
- ActionStrip uses `isDark` ternaries
- MIXED approach: some components use CSS vars, others use `isDark` ternaries

**Inconsistencies with other surfaces:**

- Uses `isDark` prop drilling + ternaries (landing/onboarding are dark-only)
- Hardcoded hex values (`#0a0a0c`, `#0c0c0e`) alongside CSS variables
- Some components use CSS vars (`bg-card`, `text-foreground`), others use `isDark` ternaries for the same purpose
- No `font-heading` usage
- `rounded-2xl` for cards (matching landing), but buttons are `rounded-lg` or `rounded-xl` (not `rounded-full` like landing CTAs)
- Active state uses orange glow shadow (matching landing's orange accent)
- Status badge pattern is consistent within dashboard but different format from landing's chips

---

### 1.4 Auth Pages (Login, Signup, Select Workspace)

**Overall character:** Warm, light-mode, frosted glass. The ONLY light-mode-first surface in the product. Feels distinctly different from everything else — closer to a premium iOS app than the dark dashboard.

**Color palette:**

- Background: `oklch(0.985 0.005 60)` — very warm off-white with slight amber tint
- Ambient orbs: `oklch(0.92 0.04 55)` (warm), `oklch(0.95 0.02 40)` (subtle warm)
- Card: `bg-background/70` with `backdrop-blur-xl`
- Borders: `border-border/60`
- Text: `text-foreground`, `text-muted-foreground`
- Accent: `bg-brand-orange`, `text-brand-orange`
- Focus: `focus:border-brand-orange` + `focus:shadow-[0_0_0_3px_oklch(0.65_0.22_40/0.1)]`
- Errors: `border-destructive/20 bg-destructive/5 text-destructive`

**Typography:**

- Headlines: `font-heading` (Instrument Serif), `text-[1.85rem]`
- Labels: `text-[0.8125rem] font-medium`
- Body: `text-sm`

**Animation:**

- Custom `animate-auth-in` keyframe: fade-up 12px, 0.5s ease-out
- Staggered delays: 0ms, 80ms, 140ms, 200ms, 260ms, 320ms, 380ms, 420ms, 480ms
- Very controlled and sequential — each element enters after the previous

**Key observation:** Auth pages are the bridge between landing (dark) and dashboard (dark/light). They use CSS variables properly (`bg-background`, `text-foreground`, `bg-brand-orange`) and `font-heading`. This is the cleanest design implementation in the codebase.

---

## 2. Cross-Surface Comparison

### 2.1 What IS Consistent

| Pattern                           | Landing | Onboarding           | Dashboard        | Auth    |
| --------------------------------- | ------- | -------------------- | ---------------- | ------- |
| Orange as primary accent          | Yes     | Partial (white CTAs) | Yes              | Yes     |
| lucide-react icons                | Yes     | Yes                  | Yes              | Partial |
| Status: emerald=good, orange=warn | Yes     | N/A                  | Yes              | N/A     |
| `rounded-2xl` cards               | Yes     | Yes                  | Yes              | Yes     |
| Ambient glow orbs                 | Yes     | Yes                  | Yes (SignalCard) | Yes     |
| `font-black` for emphasis         | Yes     | N/A                  | Yes              | N/A     |
| Section labels uppercase tracking | Yes     | N/A                  | Yes              | N/A     |

### 2.2 What IS NOT Consistent

| Aspect             | Landing                  | Onboarding                    | Dashboard                    | Auth               |
| ------------------ | ------------------------ | ----------------------------- | ---------------------------- | ------------------ |
| **Base BG**        | `#050505`                | `oklch(0.10-0.13...)`         | `zinc-950`                   | `oklch(0.985...)`  |
| **Theme**          | Dark only                | Dark only                     | Dark/Light toggle            | Light only         |
| **Display font**   | Not used                 | `font-heading`                | Not used                     | `font-heading`     |
| **FM import**      | `m` from `framer-motion` | `motion` from `framer-motion` | Not used                     | Not used           |
| **Border opacity** | `white/5`, `white/10`    | `white/[0.06]`                | `zinc-800`, CSS vars         | CSS vars           |
| **CTA style**      | Gradient pill            | White rectangle               | Orange glow pill             | Orange rectangle   |
| **Card surface**   | `white/[0.03]`           | `white/[0.07]`                | `bg-card` (CSS var)          | `bg-background/70` |
| **Button radius**  | `rounded-full`           | `rounded-2xl`                 | `rounded-lg` to `rounded-xl` | `rounded-xl`       |
| **Color approach** | Hardcoded hex/rgba       | OKLCH custom props            | Mix of CSS vars + hardcoded  | CSS vars           |
| **Purple usage**   | Yes (orbs)               | Only contract section         | Never                        | Never              |
| **Backdrop blur**  | `backdrop-blur-3xl`      | Not on cards                  | Not used                     | `backdrop-blur-xl` |

### 2.3 The Journey Gap

A user going **Landing -> Login -> Onboarding -> Dashboard** experiences:

1. **Landing:** Ultra-dark, gradient-heavy, animated, purple accents, no serif font
2. **Login:** Suddenly warm light mode, frosted glass, serif headers, minimal animation
3. **Onboarding:** Back to dark, cinematic scroll, serif headers, parallax
4. **Dashboard:** Dark (default), functional, no serif, completely different card patterns

This is four distinctly different visual languages. The transition from landing (dark, flashy) to login (light, warm) is the most jarring. The transition from onboarding (cinematic) to dashboard (functional) also lacks bridging.

---

## 3. Design Token Audit

### 3.1 Tokens That Work Well

The `packages/design-tokens/` package is well-structured:

- OKLCH colors with perceptual uniformity
- Brand orange at three levels (base, light, dark)
- Semantic status colors mapped to domain concepts
- Department and profile-status colors
- Chart colors for both themes
- Glow shadows defined

### 3.2 Tokens That Are Ignored

| Token                              | Defined In            | Actually Used By                       |
| ---------------------------------- | --------------------- | -------------------------------------- |
| `brand.orange` / `--brand-orange`  | tokens.ts, tokens.css | Auth pages only                        |
| `shadows.glow.orange`              | tokens.ts             | Not imported (dashboard uses inline)   |
| `spacing.page` / `.section` / etc. | tokens.ts             | Never — all surfaces use ad-hoc values |
| `radius.base` (0.625rem)           | tokens.ts             | Via CSS `--radius` only                |
| `--color-onboarding-*`             | globals.css           | Onboarding only (good, intentional)    |
| `--font-heading`                   | globals.css           | Auth + Onboarding only                 |

### 3.3 Hardcoded Values That Should Be Tokens

| Value                   | Where                         | Should Be                              |
| ----------------------- | ----------------------------- | -------------------------------------- |
| `#050505`               | Landing BG                    | `--surface-marketing` or similar       |
| `#0a0a0c`               | Dashboard header, landing nav | `--surface-chrome`                     |
| `#0c0c0e`               | Dashboard sidebar             | `--surface-sidebar`                    |
| `white/[0.06]`          | Onboarding borders            | `--border-subtle`                      |
| `white/[0.03]`          | Landing card surfaces         | `--surface-glass-1`                    |
| `white/[0.07]`          | Onboarding card surfaces      | `--surface-glass-2`                    |
| `oklch(0.985 0.005 60)` | Auth BG                       | `--surface-auth` or use `--background` |

---

## 4. Animation Audit

### 4.1 Animation Budget by Surface

| Surface    | CSS Transitions      | CSS Keyframes                             | Framer Motion                         | Total "Moving Parts" |
| ---------- | -------------------- | ----------------------------------------- | ------------------------------------- | -------------------- |
| Landing    | ~15 hover states     | 4 (float, glow-shift, hero-glow, shimmer) | ~20 (stagger, spring, floating)       | HIGH                 |
| Onboarding | ~5                   | 0 custom                                  | ~12 (parallax, reveal, avatar, voice) | MEDIUM               |
| Dashboard  | ~30 hover/transition | 3 (pulse, ping, spin)                     | 0 in core components                  | LOW                  |
| Auth       | ~8                   | 1 (auth-fade-up)                          | 0                                     | MINIMAL              |

### 4.2 Animation Consistency

**Good:**

- Dashboard and auth share the principle of minimal animation
- Onboarding's SectionReveal ease curve `[0.16, 1, 0.3, 1]` is a nice signature that could be standardized
- Breathing/speaking animations are correctly scoped to voice avatar only

**Problems:**

- Landing uses `m` shorthand, onboarding uses `motion` — should pick one per app
- Landing's spring config varies: `stiffness: 50-100`, `damping: 15` — not standardized
- No shared animation constants (durations, eases, springs)
- Landing's `animate-glow-shift` and `animate-float` could be reused in onboarding but aren't

### 4.3 Recommended Animation Primitives

Define these once, use everywhere:

```ts
// Shared timing
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const SPRING_GENTLE = { type: "spring", bounce: 0.2, duration: 0.6 };
const SPRING_SNAPPY = { type: "spring", stiffness: 400, damping: 30 };

// Shared durations
const DURATION_FAST = 0.15; // hover, micro-interaction
const DURATION_MEDIUM = 0.3; // view change, panel toggle
const DURATION_SLOW = 0.6; // entrance, reveal
const DURATION_CINEMATIC = 1.0; // onboarding reveal, parallax
```

---

## 5. Proposed Unified Direction

### 5.1 Design Philosophy: "Ren och varm"

**The bartender analogy:** Smartout should feel like a confident bartender — knowledgeable, warm, attentive, but never try-hard. Not a nightclub (landing), not a hospital (dashboard), not a movie theater (onboarding). A well-run Scandinavian bar.

**Principles:**

1. **Warm neutrals over cold neutrals** — Slight warm tint to dark backgrounds, never blue-black
2. **Orange as warmth, not alarm** — Primary accent for action and identity, not just status
3. **Serif for moments, sans for tools** — `font-heading` for welcome/headers, Geist for everything functional
4. **Glass, not plastic** — Subtle translucency on elevated surfaces (not full frosted-glass everywhere)
5. **Glow with purpose** — Ambient orbs for status emphasis, not decoration
6. **Movement only when meaningful** — CSS transitions for state, Framer for view changes, nothing for decoration

### 5.2 Color Convergence

**Proposed unified dark palette:**

| Role            | Current (varies)                        | Proposed                                 | Token Name          |
| --------------- | --------------------------------------- | ---------------------------------------- | ------------------- |
| Base background | `#050505`, `zinc-950`, `oklch(0.10...)` | `oklch(0.12 0.005 60)` — warm near-black | `--surface-base`    |
| Chrome (header) | `#0a0a0c`                               | `oklch(0.10 0.005 60)`                   | `--surface-chrome`  |
| Sidebar         | `#0c0c0e`                               | `oklch(0.11 0.005 60)`                   | `--surface-sidebar` |
| Card elevated   | `bg-card`, `white/[0.03]`               | `oklch(0.14 0.005 60)`                   | `--surface-card`    |
| Card glass      | `white/[0.07]`, `bg-white/5`            | `oklch(1 0 0 / 5%)`                      | `--surface-glass`   |
| Border default  | `zinc-800`, `white/[0.06]`, `white/10`  | `oklch(1 0 0 / 8%)`                      | `--border-default`  |
| Border subtle   | `zinc-800/50`, `white/5`                | `oklch(1 0 0 / 5%)`                      | `--border-subtle`   |

**Key change:** All dark backgrounds get a 60-degree hue (warm amber) at very low chroma (0.005). This creates a subliminal warmth without being visibly warm. The landing's purple tint and onboarding's color journey are replaced by consistent warmth.

**Proposed unified light palette:**

| Role            | Current                                  | Proposed                                     | Token Name         |
| --------------- | ---------------------------------------- | -------------------------------------------- | ------------------ |
| Base background | `zinc-50`, `oklch(0.985 0.005 60)`       | `oklch(0.985 0.005 60)` — keep auth's warmth | `--surface-base`   |
| Card            | `bg-white`                               | `oklch(1 0 0)` — pure white                  | `--surface-card`   |
| Chrome          | `bg-zinc-900` (stays dark in light mode) | Same — header always dark                    | `--surface-chrome` |

### 5.3 Typography Convergence

| Context               | Current                                           | Proposed                                                                |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| Landing hero          | `font-black` Geist, up to 7.5rem                  | `font-heading` (Instrument Serif) + `font-black` Geist for support text |
| Onboarding titles     | `font-heading` 6xl-7xl                            | Keep as-is (already good)                                               |
| Dashboard page titles | Not present                                       | Add `font-heading` for page-level headers (e.g., "Schedule", "People")  |
| Auth titles           | `font-heading` 1.85rem                            | Keep as-is                                                              |
| Metric values         | `font-black` 3xl                                  | Keep as-is                                                              |
| Labels                | `text-[10px] font-bold tracking-widest uppercase` | Standardize: `text-[11px] font-semibold tracking-wide uppercase`        |

**The rule:** Instrument Serif appears at the top of every surface for welcome/identity moments. Geist takes over for everything functional. This creates a signature "Smartout serif moment" that connects all surfaces.

### 5.4 Button & CTA Convergence

| Type          | Current (varies)                                                     | Proposed                                                                    |
| ------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Primary CTA   | Gradient pill (landing), White rect (onboarding), Orange rect (auth) | **Orange solid, `rounded-xl`**: `bg-brand-orange text-white rounded-xl`     |
| Secondary     | Ghost pill (landing), Glass rect (onboarding), Bordered (auth)       | **Glass, `rounded-xl`**: `bg-white/5 border border-white/[0.08] rounded-xl` |
| Tertiary      | Text links                                                           | **Text with underline on hover**                                            |
| Active toggle | Orange glow pill (dashboard)                                         | Keep — this is good as a dashboard-specific control                         |

**Kill the gradient CTA.** One solid orange button everywhere. The landing's `from-orange-600 to-rose-600` gradient adds personality but fractures consistency. A solid `bg-brand-orange` with a warm glow shadow is enough.

### 5.5 Card Convergence

**Proposed unified card pattern:**

```tsx
// Standard card (dashboard, onboarding post-completion)
<div className={cn(
  "relative overflow-hidden rounded-2xl border p-5",
  "bg-card border-border",
  "transition-all duration-300",
)}>
  {/* Optional ambient glow (status cards only) */}
  <div className="pointer-events-none absolute -top-4 -right-4 h-24 w-24 rounded-full bg-{status}/10 blur-2xl" />
  {/* Content */}
</div>

// Glass card (onboarding, modals, elevated overlays)
<div className={cn(
  "relative overflow-hidden rounded-2xl border p-6",
  "bg-white/5 border-white/[0.08] backdrop-blur-xl",
)}>
  {/* Content */}
</div>
```

Two card types. Standard for data display. Glass for immersive/overlay contexts. Both use `rounded-2xl`.

### 5.6 Animation Convergence

**Landing (reduce):**

- Remove gradient shimmer on text (replace with static gradient)
- Remove `mix-blend-screen` on orbs (use standard opacity)
- Keep spring entrance animations but standardize config
- Keep floating dashboard mockup (it's the hero visual)
- Remove purple orb (use only orange/rose)

**Onboarding (keep mostly):**

- SectionReveal pattern is the best animation in the codebase — keep
- ParallaxBackground is appropriate for this immersive context — keep
- Consider extracting the `[0.16, 1, 0.3, 1]` ease as a named constant

**Dashboard (add selectively):**

- Add `AnimatePresence` for view transitions (tactical -> strategic)
- Add staggered entrance for SignalCard grid on initial load
- Add `layoutId` for active tab/pill indicators
- Do NOT add entrance animations to every page change

**Auth (keep):**

- Staggered fade-up is perfect for this context — keep as-is

### 5.7 The Transition Journey

**Proposed flow:**

1. **Landing** (dark, warm-black, animated hero, orange CTA)
   - Serif headline "En plattform. Full kontroll."
   - Orange solid CTA, not gradient
   - Ambient orbs: orange only, no purple

2. **Login/Signup** (light, warm off-white, frosted glass)
   - Serif headline "Velkommen tilbake"
   - Same warm amber glow orbs but in light mode
   - Orange CTA matches landing's

3. **Onboarding** (dark, cinematic, section-by-section)
   - Serif headlines per section
   - Color temperature journey is unique here (justified by the immersive context)
   - White CTA buttons (justified — dark bg needs contrast)

4. **Dashboard** (dark default, functional, data-first)
   - Serif used ONLY for page titles (small touch of warmth)
   - Same warm-black base as landing (not cold zinc-950)
   - SignalCard glow orbs echo landing's ambient orbs
   - Orange accent throughout matches landing

**The thread:** Orange accent + warm-black backgrounds + serif moments + ambient glow. These four elements stitch all surfaces together.

---

## 6. Priority Action Items

### Tier 1 — Quick Wins (1-2 days)

1. **Standardize dark background warmth** — Replace `#050505` and `zinc-950` with warm-tinted OKLCH values in design tokens
2. **Add `font-heading` to landing headlines** — Currently missing, easy add
3. **Unify button radius** — `rounded-xl` everywhere, kill `rounded-full` CTAs
4. **Kill gradient CTA** on landing — Solid `bg-brand-orange` with glow shadow
5. **Standardize border opacity** — `oklch(1 0 0 / 8%)` as the default dark border

### Tier 2 — Structural (3-5 days)

6. **New design tokens** for surfaces: `--surface-base`, `--surface-chrome`, `--surface-sidebar`, `--surface-glass`
7. **Shared animation constants** — Extract ease curves, springs, durations to `packages/design-tokens/src/animation.ts`
8. **Dashboard view transitions** — Add `AnimatePresence` for tactical/strategic/reconciliation switching
9. **Dashboard SignalCard entrance** — Staggered fade-up on initial load (same ease as onboarding)
10. **Active indicator `layoutId`** — Landing nav already has this; add to dashboard sidebar and tab controls

### Tier 3 — Polish (1-2 weeks)

11. **Landing page redesign** — Reduce visual intensity by 30%, align with unified palette
12. **Dashboard page headers** — Add serif-set titles to each page
13. **Onboarding-to-dashboard bridge** — The last onboarding section ("Welcome") should visually morph into the dashboard layout
14. **Dark mode consistency audit** — Resolve `isDark` ternary vs CSS variable inconsistency (pick one approach per component type)
15. **Motion primitives library** — Reusable `FadeIn`, `StaggerContainer`, `ViewTransition` components

---

## 7. What We Do NOT Change

- **Onboarding color temperature journey** — It's intentional and earned. The immersive context justifies unique per-section coloring.
- **Dashboard `isDark` prop pattern** — It works, it's established, and refactoring to pure CSS vars would be a massive migration.
- **Landing A/B variant system** — Business decision, not design debt.
- **BotssonAvatar voice animations** — Scale/breathing is correct for this interactive context.
- **Auth page light mode** — The warm welcome before entering the dark dashboard is intentionally different.

---

## 8. Summary

The three surfaces have strong individual design languages but lack the connective tissue that makes a product feel whole. The fix is not to make everything look the same — it's to establish shared DNA:

1. **Warm backgrounds** (not cold zinc)
2. **Instrument Serif for identity moments** (not just onboarding/auth)
3. **Orange as the through-line** (solid, not gradient)
4. **Ambient glow as the signature effect** (already present everywhere, just needs alignment)
5. **Consistent card and border language** (two card types, one border opacity)

The goal is that a screenshot from any surface should look like it belongs to the same product, even though each surface serves a different purpose and has different levels of animation intensity.
