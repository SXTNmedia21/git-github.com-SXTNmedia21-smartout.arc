---
title: Landing App Design Token Migration
status: in_progress
updated: 2026-03-26
created: 2026-03-26
module: landing
tags: [design-tokens, i18n, landing, refactor]
---

# Landing App Design Token Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all hardcoded Tailwind color classes from the landing app, replacing them with design token CSS variables and i18n keys.

**Architecture:** The landing app has three color contexts: (1) theme-aware components (Navigation, VariantMLanding) that already use tokens correctly, (2) intentionally dark-themed components (Footer, Blocks, Demo) that hardcode zinc/white/black, and (3) archived variants that are dead code. For group 2, we introduce a `.dark-section` CSS utility that locally overrides CSS variables to dark-mode values, letting those components use `text-foreground` / `bg-background` etc. while staying dark regardless of system theme.

**Tech Stack:** Tailwind v4 (CSS config), design-tokens OKLCH, @smartout/i18n JSON, Framer Motion

**Scope:** 3 phases, independently executable. Total ~30 files.

---

## File Structure

### Phase 1: Foundation + Critical Path (4 tasks)

- **Modify:** `packages/design-tokens/src/tokens.css` — add `.dark-section` utility
- **Modify:** `apps/landing/src/app/globals.css` — register dark-section in @theme
- **Modify:** `apps/landing/src/components/footer.tsx` — token migration
- **Modify:** `packages/i18n/locales/nb/landing.json` — add poll + mockup keys
- **Modify:** `packages/i18n/locales/en/landing.json` — add poll + mockup keys
- **Modify:** `apps/landing/src/components/landing/LandingInteractivePoll.tsx` — use i18n
- **Modify:** `apps/landing/src/components/landing/LandingInteractiveMockup.tsx` — use i18n

### Phase 2: Blocks, Demo & Utility Token Migration (4 tasks)

- **Modify:** `apps/landing/src/components/blocks/block-helpers.ts` — token migration
- **Modify:** 15 block component files — structural color migration
- **Modify:** 8 demo component files — structural color migration
- **Modify:** 5 utility component files — structural color migration

### Phase 3: Archive Cleanup (1 task)

- **Delete:** 8 files in `apps/landing/src/components/landing/_archived/`

---

## Color Mapping Reference

This table governs ALL replacements in Phases 1 and 2. Every hardcoded class maps to a token class.

### Structural Colors (surfaces, text, borders)

| Hardcoded                                                       | Token Replacement                                             | Notes                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `bg-[#050505]`, `bg-[#0a0a0c]`, `bg-zinc-900/50`, `bg-zinc-950` | `bg-background`                                               | Inside `.dark-section`, resolves to dark OKLCH |
| `bg-zinc-900`, `bg-zinc-900/80`, `bg-zinc-900/95`               | `bg-background`                                               |                                                |
| `bg-zinc-800`                                                   | `bg-muted`                                                    |                                                |
| `bg-white/[0.02]`, `bg-white/[0.03]`                            | `bg-foreground/[0.02]`, `bg-foreground/[0.03]`                | Subtle surface highlights                      |
| `bg-white/5`, `bg-white/10`, `bg-white/[0.06]`                  | `bg-foreground/5`, `bg-foreground/10`, `bg-foreground/[0.06]` |                                                |
| `bg-white` (solid, for CTA buttons)                             | `bg-foreground`                                               | Paired with `text-background`                  |
| `text-white`                                                    | `text-foreground`                                             | Inside dark-section                            |
| `text-zinc-100`, `text-zinc-200`, `text-zinc-300`               | `text-foreground`                                             | High-emphasis text                             |
| `text-zinc-400`                                                 | `text-muted-foreground`                                       |                                                |
| `text-zinc-500`, `text-zinc-600`                                | `text-muted-foreground`                                       | Low-emphasis text                              |
| `text-zinc-700`                                                 | `text-muted-foreground/50`                                    | Very low emphasis                              |
| `text-zinc-950` (on white bg)                                   | `text-background`                                             | Inverse text on foreground bg                  |
| `text-black`                                                    | `text-background`                                             |                                                |
| `border-white/[0.06]`, `border-white/10`                        | `border-border`                                               |                                                |
| `border-zinc-700`, `border-zinc-700/50`, `border-zinc-800`      | `border-border`                                               |                                                |
| `hover:text-white`                                              | `hover:text-foreground`                                       |                                                |
| `hover:text-zinc-200`, `hover:text-zinc-300`                    | `hover:text-foreground`                                       |                                                |
| `hover:text-zinc-400`                                           | `hover:text-muted-foreground`                                 |                                                |
| `hover:bg-white/[0.06]`, `hover:bg-white/10`                    | `hover:bg-foreground/[0.06]`, `hover:bg-foreground/10`        |                                                |
| `hover:bg-zinc-200` (on white bg CTA)                           | `hover:bg-foreground/90`                                      |                                                |
| `hover:bg-zinc-700`, `hover:bg-zinc-800`                        | `hover:bg-muted`                                              |                                                |
| `hover:border-white/10`, `hover:border-white/20`                | `hover:border-border`                                         |                                                |
| `placeholder:text-zinc-500`, `placeholder:text-zinc-600`        | `placeholder:text-muted-foreground`                           |                                                |
| `fill-zinc-700` → `fill-muted`                                  | `fill-muted-foreground/50`                                    | SVG fills                                      |

### Semantic Status Colors (KEEP as-is in demo)

These are intentional design choices for status indicators in the demo system. Do NOT replace:

- `emerald-*` (success states) — maps conceptually to `--success` but the opacity variants are needed
- `amber-*` (warning states) — maps to `--warning`
- `red-*` (error states) — maps to `--destructive`
- `cyan-*` (AI/info states) — maps to `--info`
- `purple-*` (quiz/accent states) — maps to `--brand-purple`
- `rose-*` (onboarding accent) — intentional demo accent

### Brand Colors (already migrated in VariantMLanding)

These should be replaced when found in blocks/utilities:

- `text-orange-400`, `text-orange-500` → `text-brand-orange`
- `bg-orange-500` → `bg-brand-orange`
- `bg-orange-500/10`, `bg-orange-500/20` → `bg-brand-orange/10`, `bg-brand-orange/20`
- `border-orange-500/20`, `border-orange-500/30` → `border-brand-orange/20`, `border-brand-orange/30`
- `shadow-orange-500/20` → `shadow-[0_0_15px_-3px_var(--brand-orange)]`
- `hover:bg-orange-400` → `hover:bg-brand-orange-light`

---

## Phase 1: Foundation + Critical Path

### Task 1: Create dark-section CSS utility

**Files:**

- Modify: `packages/design-tokens/src/tokens.css:106-151`
- Modify: `apps/landing/src/app/globals.css:80-102`

The `.dark-section` class locally overrides CSS variables to dark-mode values. Components inside it can use `bg-background`, `text-foreground`, etc. and they resolve to dark tokens — regardless of the system theme.

- [ ] **Step 1: Add dark-section class to tokens.css**

Add this after the `.dark` block (after line 150) in `packages/design-tokens/src/tokens.css`:

```css
/* Dark Section — forces dark palette on any element tree.
     Use on footer, blocks, demo shell, and other always-dark regions.
     Components inside use standard token classes (bg-background, text-foreground, etc.). */
.dark-section {
  --background: oklch(0.06 0.015 50);
  --foreground: oklch(0.95 0.005 55);
  --card: oklch(0.1 0.02 50);
  --card-foreground: oklch(0.95 0.005 55);
  --popover: oklch(0.1 0.02 50);
  --popover-foreground: oklch(0.95 0.005 55);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0.01 50);
  --secondary: oklch(0.18 0.015 50);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.18 0.015 50);
  --muted-foreground: oklch(0.55 0.01 52);
  --accent: oklch(0.18 0.015 50);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 8%);
  --input: oklch(1 0 0 / 10%);
  --ring: oklch(0.556 0 0);

  color-scheme: dark;
}
```

Note: `--background` uses `oklch(0.06 ...)` (darker than `.dark`'s `0.12`) to match the current `#050505` / `#0a0a0c` hex values those components use. The `.dark` class uses `0.12` which is slightly lighter.

- [ ] **Step 2: Verify tokens.css compiles**

Run: `pnpm --filter @smartout/design-tokens build 2>&1 || echo "No build script, CSS is imported directly"`

Expected: No errors (tokens.css is imported as raw CSS, no build step needed).

- [ ] **Step 3: Verify landing app still loads**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter landing typecheck`

Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/design-tokens/src/tokens.css
git commit -m "feat(design-tokens): add dark-section utility class for always-dark regions

Locally overrides CSS variables to dark palette values. Used by landing
footer, blocks, and demo components to stay dark regardless of system theme.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Footer token migration

**Files:**

- Modify: `apps/landing/src/components/footer.tsx`

The footer is intentionally dark. We add `dark-section` class to the root element and replace all hardcoded zinc/white classes with token classes.

- [ ] **Step 1: Add dark-section class and replace structural colors**

In `apps/landing/src/components/footer.tsx`, make these changes:

Line 36 — root element:

```tsx
// Before:
<footer className="relative z-10 border-t border-white/[0.06] bg-[#050505]">

// After:
<footer className="dark-section relative z-10 border-t border-border bg-background">
```

Line 48 — tagline text:

```tsx
// Before:
<p className="max-w-xs text-sm leading-relaxed text-zinc-500">

// After:
<p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
```

Line 55 — heading:

```tsx
// Before:
<h3 className="mb-3 text-[11px] font-bold tracking-widest text-zinc-600 uppercase sm:mb-4 sm:text-xs sm:text-zinc-500">

// After:
<h3 className="mb-3 text-[11px] font-bold tracking-widest text-muted-foreground/70 uppercase sm:mb-4 sm:text-xs sm:text-muted-foreground">
```

Line 63 — link:

```tsx
// Before:
className =
  "text-xs text-zinc-500 transition-colors duration-200 hover:text-white sm:text-sm sm:text-zinc-400";

// After:
className =
  "text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground sm:text-sm sm:text-muted-foreground";
```

Line 76 — divider:

```tsx
// Before:
<div className="mt-10 h-px bg-white/[0.06] sm:mt-12" />

// After:
<div className="mt-10 h-px bg-border sm:mt-12" />
```

Line 80 — copyright:

```tsx
// Before:
<p className="text-xs text-zinc-600 sm:text-sm">

// After:
<p className="text-xs text-muted-foreground/70 sm:text-sm">
```

Line 83 — bottom bar container:

```tsx
// Before:
<div className="flex items-center gap-4 text-xs text-zinc-600 sm:gap-6 sm:text-sm">

// After:
<div className="flex items-center gap-4 text-xs text-muted-foreground/70 sm:gap-6 sm:text-sm">
```

Line 87 — privacy link:

```tsx
// Before:
className = "transition-colors duration-200 hover:text-zinc-400";

// After:
className = "transition-colors duration-200 hover:text-muted-foreground";
```

Line 90 — terms link:

```tsx
// Before:
className = "transition-colors duration-200 hover:text-zinc-400";

// After:
className = "transition-colors duration-200 hover:text-muted-foreground";
```

Line 95 — back-to-top button:

```tsx
// Before:
className =
  "hidden items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-zinc-500 transition-all duration-200 hover:border-white/10 hover:text-zinc-300 sm:flex";

// After:
className =
  "hidden items-center gap-1.5 rounded-full border border-border bg-foreground/[0.02] px-3 py-1.5 text-muted-foreground transition-all duration-200 hover:border-foreground/10 hover:text-foreground sm:flex";
```

Line 46 — brand name:

```tsx
// Before:
<span className="text-lg font-black tracking-tighter text-white">SmartOut</span>

// After:
<span className="text-lg font-black tracking-tighter text-foreground">SmartOut</span>
```

- [ ] **Step 2: Verify no hardcoded colors remain**

Run: `grep -n "zinc\|gray-\|slate-\|bg-\[#" apps/landing/src/components/footer.tsx`

Expected: No output (0 matches).

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter landing typecheck`

Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/components/footer.tsx
git commit -m "refactor(landing): migrate footer to design token classes

Replace all hardcoded zinc/white classes with CSS variable token classes.
Footer uses dark-section utility for always-dark appearance.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add i18n keys for Poll and Mockup

**Files:**

- Modify: `packages/i18n/locales/nb/landing.json`
- Modify: `packages/i18n/locales/en/landing.json`

- [ ] **Step 1: Add poll keys to nb/landing.json**

Add these keys to the end of `packages/i18n/locales/nb/landing.json` (before the closing `}`):

```json
  "poll.step1.title": "Hvor stort er teamet ditt?",
  "poll.step1.subtitle": "Vi tilpasser Smartout etter din skala.",
  "poll.size.small": "1 - 10 ansatte",
  "poll.size.medium": "11 - 30 ansatte",
  "poll.size.large": "Over 30 ansatte",
  "poll.step2.title": "Hva stjeler mest av tiden din i dag?",
  "poll.step2.subtitle": "De fleste ledere mister 10-15 timer i uka på ren administrasjon.",
  "poll.problem.scheduling": "Evig puslespill med vaktplan og fravær",
  "poll.problem.communication": "Beskjeder forsvinner i Facebook-grupper",
  "poll.problem.compliance": "Sliter med å dokumentere IK-Mat og rutiner",
  "poll.done.title": "Vi hører deg.",
  "poll.done.scheduling": "Smarout sin AI-motoren bygger ferdige vaktplaner på sekunder, og håndterer vaktbytter for deg.",
  "poll.done.communication": "Samle alt i én proff app. Integrert chat, Dagens Beskjed og push-varsler som faktisk når frem.",
  "poll.done.compliance": "Slutt på permer og papir. Alt av sjekklister, temperaturlogger og kontrakter signeres digitalt.",
  "mockup.sidebar.kitchen": "Hovedkjøkken",
  "mockup.sidebar.dashboard": "Dashboard",
  "mockup.sidebar.schedule": "Vaktplan",
  "mockup.sidebar.messages": "Meldinger",
  "mockup.sidebar.vacation": "Ferie & Fravær",
  "mockup.header.title": "Vaktplan — Uke 42",
  "mockup.header.subtitle": "AI Event Motor bygger vakter live...",
  "mockup.notice.title": "Dagens Beskjed publisert",
  "mockup.notice.message": "Husk at vi får inn 40 personer på langbord kl 19:00. Prepp stasjonen.",
  "mockup.notice.readBy": "Lest av 4/5 ansatte på vakt.",
  "mockup.shift1.name": "Jonas (Servitør)",
  "mockup.shift1.time": "16:00 - 23:30 (7.5t)",
  "mockup.shift1.status": "Godkjent & Signert",
  "mockup.shift2.name": "Maria (Kokk)",
  "mockup.shift2.time": "14:00 - 22:00 (8.0t)",
  "mockup.shift2.status": "Godkjent & Signert",
  "mockup.vacation.title": "Ferieforespørsel: Peder",
  "mockup.vacation.duration": "Uke 43 (5 dager)",
  "mockup.vacation.status": "Må behandles",
  "mockup.overlay.shift.badge": "Vakt-innsikt",
  "mockup.overlay.shift.close": "Lukk",
  "mockup.overlay.shift.title": "Krav & Tariff",
  "mockup.overlay.shift.subtitle": "Automatisert av Event Motoren",
  "mockup.overlay.shift.reqLabel": "Krav til vakt",
  "mockup.overlay.shift.reqValue": "Minimum \"Servitør Erfaren\" eller \"Sommelier\"",
  "mockup.overlay.shift.tariffLabel": "Tariff Tillegg",
  "mockup.overlay.shift.evening": "Kveldstillegg (etter 18:00)",
  "mockup.overlay.shift.eveningRate": "+ 29,-/t",
  "mockup.overlay.shift.weekend": "Helgetillegg",
  "mockup.overlay.shift.weekendRate": "+ 55,-/t",
  "mockup.overlay.shift.hmsNote": "Systemet sjekker automatisk HMS-krav før noen kan godta denne vakten.",
  "mockup.overlay.vacation.title": "Ferieforespørsel",
  "mockup.overlay.vacation.subtitle": "Peder søker om ferie uke 43.",
  "mockup.overlay.vacation.insight": "Peder har 12 feriedager igjen i år. Hvis du godkjenner, mangler vi én kokk på Torsdag og Fredag uke 43. Vil du at jeg skal sende ut et bytte-forslag til Maria og Thomas?",
  "mockup.overlay.vacation.insightLabel": "Botsson Insight:",
  "mockup.overlay.vacation.approve": "Godkjenn",
  "mockup.overlay.vacation.reject": "Avslå",
  "mockup.botsson.name": "Lise Botsson",
  "mockup.botsson.role": "AI Assistent",
  "mockup.botsson.collapsed": "Klikk på meg for å se hvordan jeg eier driften for deg mens du sover.",
  "mockup.botsson.expanded.title": "Smartout er AI Native.",
  "mockup.botsson.expanded.body": "Mitt AI-rammeverk lærer bedriften din å kjenne. Jeg følger med på fravær, sjekker at lovverk og tariffer følges, og jeg kan kommunisere med de ansatte på deres eget språk for å dekke vakter.",
  "mockup.botsson.expanded.tagline": "Mens du eier restauranten, eier jeg driften for deg."
```

- [ ] **Step 2: Add poll keys to en/landing.json**

Add the English equivalents to `packages/i18n/locales/en/landing.json`:

```json
  "poll.step1.title": "How big is your team?",
  "poll.step1.subtitle": "We tailor Smartout to your scale.",
  "poll.size.small": "1 - 10 employees",
  "poll.size.medium": "11 - 30 employees",
  "poll.size.large": "Over 30 employees",
  "poll.step2.title": "What steals most of your time today?",
  "poll.step2.subtitle": "Most managers lose 10-15 hours per week on pure administration.",
  "poll.problem.scheduling": "Endless puzzle with shift planning and absences",
  "poll.problem.communication": "Messages disappear in Facebook groups",
  "poll.problem.compliance": "Struggling to document food safety and routines",
  "poll.done.title": "We hear you.",
  "poll.done.scheduling": "Smartout's AI engine builds complete shift plans in seconds and handles shift swaps for you.",
  "poll.done.communication": "Gather everything in one professional app. Integrated chat, Daily Messages, and push notifications that actually reach people.",
  "poll.done.compliance": "No more binders and paper. All checklists, temperature logs, and contracts are signed digitally.",
  "mockup.sidebar.kitchen": "Main Kitchen",
  "mockup.sidebar.dashboard": "Dashboard",
  "mockup.sidebar.schedule": "Schedule",
  "mockup.sidebar.messages": "Messages",
  "mockup.sidebar.vacation": "Vacation & Absence",
  "mockup.header.title": "Shift Plan — Week 42",
  "mockup.header.subtitle": "AI Event Engine building shifts live...",
  "mockup.notice.title": "Daily Message published",
  "mockup.notice.message": "Remember we have 40 guests at the long table at 7 PM. Prep the station.",
  "mockup.notice.readBy": "Read by 4/5 staff on shift.",
  "mockup.shift1.name": "Jonas (Waiter)",
  "mockup.shift1.time": "4:00 PM - 11:30 PM (7.5h)",
  "mockup.shift1.status": "Approved & Signed",
  "mockup.shift2.name": "Maria (Chef)",
  "mockup.shift2.time": "2:00 PM - 10:00 PM (8.0h)",
  "mockup.shift2.status": "Approved & Signed",
  "mockup.vacation.title": "Vacation Request: Peder",
  "mockup.vacation.duration": "Week 43 (5 days)",
  "mockup.vacation.status": "Needs review",
  "mockup.overlay.shift.badge": "Shift Insight",
  "mockup.overlay.shift.close": "Close",
  "mockup.overlay.shift.title": "Requirements & Tariff",
  "mockup.overlay.shift.subtitle": "Automated by the Event Engine",
  "mockup.overlay.shift.reqLabel": "Shift requirements",
  "mockup.overlay.shift.reqValue": "Minimum \"Experienced Waiter\" or \"Sommelier\"",
  "mockup.overlay.shift.tariffLabel": "Tariff Supplements",
  "mockup.overlay.shift.evening": "Evening supplement (after 6 PM)",
  "mockup.overlay.shift.eveningRate": "+ 29,-/h",
  "mockup.overlay.shift.weekend": "Weekend supplement",
  "mockup.overlay.shift.weekendRate": "+ 55,-/h",
  "mockup.overlay.shift.hmsNote": "The system automatically checks HMS requirements before anyone can accept this shift.",
  "mockup.overlay.vacation.title": "Vacation Request",
  "mockup.overlay.vacation.subtitle": "Peder is requesting vacation week 43.",
  "mockup.overlay.vacation.insight": "Peder has 12 vacation days left this year. If you approve, we'll be short one chef on Thursday and Friday week 43. Want me to send a swap suggestion to Maria and Thomas?",
  "mockup.overlay.vacation.insightLabel": "Botsson Insight:",
  "mockup.overlay.vacation.approve": "Approve",
  "mockup.overlay.vacation.reject": "Decline",
  "mockup.botsson.name": "Lise Botsson",
  "mockup.botsson.role": "AI Assistant",
  "mockup.botsson.collapsed": "Click me to see how I run operations for you while you sleep.",
  "mockup.botsson.expanded.title": "Smartout is AI Native.",
  "mockup.botsson.expanded.body": "My AI framework learns your business. I monitor absences, verify that regulations and tariffs are followed, and I can communicate with your employees in their own language to cover shifts.",
  "mockup.botsson.expanded.tagline": "While you own the restaurant, I own the operations for you."
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/nb/landing.json'))" && node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/en/landing.json'))" && echo "Valid JSON"`

Expected: `Valid JSON`

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/locales/nb/landing.json packages/i18n/locales/en/landing.json
git commit -m "feat(i18n): add poll and mockup translation keys for landing

Adds nb + en keys for LandingInteractivePoll (3 steps, 3 options each,
3 result messages) and LandingInteractiveMockup (sidebar, shifts,
overlays, botsson panel).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire i18n into Poll and Mockup components

**Files:**

- Modify: `apps/landing/src/components/landing/LandingInteractivePoll.tsx`
- Modify: `apps/landing/src/components/landing/LandingInteractiveMockup.tsx`

- [ ] **Step 1: Refactor LandingInteractivePoll to accept locale and use i18n**

Replace the full component signature and hardcoded strings:

```tsx
// At the top, add import:
import { createTranslator } from "@smartout/i18n";

// Change signature to accept locale:
export function LandingInteractivePoll({ locale = "nb" }: { locale?: "nb" | "en" }) {
  const t = createTranslator(locale, "landing");

  // Replace hardcoded arrays:
  const sizeOptions = [
    { id: "1-10", label: t("poll.size.small") },
    { id: "11-30", label: t("poll.size.medium") },
    { id: "30+", label: t("poll.size.large") },
  ];

  const problemOptions = [
    { id: "scheduling", label: t("poll.problem.scheduling") },
    { id: "communication", label: t("poll.problem.communication") },
    { id: "compliance", label: t("poll.problem.compliance") },
  ];

  // Replace step 1 heading (line 65):
  // "Hvor stort er teamet ditt?" → {t("poll.step1.title")}
  // "Vi tilpasser Smartout etter din skala." → {t("poll.step1.subtitle")}

  // Replace step 2 heading (line 100-101):
  // "Hva stjeler mest av tiden din i dag?" → {t("poll.step2.title")}
  // "De fleste ledere..." → {t("poll.step2.subtitle")}

  // Replace done state (line 135):
  // "Vi hører deg." → {t("poll.done.title")}
  // The conditional text block → {t(`poll.done.${answers.problem}`)}
```

In `VariantMLanding.tsx`, pass locale to the poll:

```tsx
// Line 140, change:
<LandingInteractivePoll />
// To:
<LandingInteractivePoll locale={locale} />
```

- [ ] **Step 2: Refactor LandingInteractiveMockup to accept locale and use i18n**

Add import and locale prop:

```tsx
import { createTranslator } from "@smartout/i18n";

export function LandingInteractiveMockup({ locale = "nb" }: { locale?: "nb" | "en" }) {
  const t = createTranslator(locale, "landing");
```

Replace all hardcoded Norwegian strings with `t()` calls using the keys from Task 3. Key mapping:

| Hardcoded string                         | i18n key                                      |
| ---------------------------------------- | --------------------------------------------- |
| `"Hovedkjøkken"`                         | `t("mockup.sidebar.kitchen")`                 |
| `"Dashboard"`                            | `t("mockup.sidebar.dashboard")`               |
| `"Vaktplan"`                             | `t("mockup.sidebar.schedule")`                |
| `"Meldinger"`                            | `t("mockup.sidebar.messages")`                |
| `"Ferie & Fravær"`                       | `t("mockup.sidebar.vacation")`                |
| `"Smartout AI Workspace"`                | `"Smartout AI Workspace"` (keep — brand name) |
| `"Vaktplan — Uke 42"`                    | `t("mockup.header.title")`                    |
| `"AI Event Motor bygger vakter live..."` | `t("mockup.header.subtitle")`                 |
| `"Dagens Beskjed publisert"`             | `t("mockup.notice.title")`                    |
| `"Husk at vi får inn 40 personer..."`    | `t("mockup.notice.message")`                  |
| `"Lest av 4/5 ansatte på vakt."`         | `t("mockup.notice.readBy")`                   |
| `"Jonas (Servitør)"`                     | `t("mockup.shift1.name")`                     |
| `"16:00 - 23:30 (7.5t)"`                 | `t("mockup.shift1.time")`                     |
| `"Godkjent & Signert"`                   | `t("mockup.shift1.status")`                   |
| `"Maria (Kokk)"`                         | `t("mockup.shift2.name")`                     |
| `"14:00 - 22:00 (8.0t)"`                 | `t("mockup.shift2.time")`                     |
| `"Godkjent & Signert"` (2nd)             | `t("mockup.shift2.status")`                   |
| `"Ferieforespørsel: Peder"`              | `t("mockup.vacation.title")`                  |
| `"Uke 43 (5 dager)"`                     | `t("mockup.vacation.duration")`               |
| `"Må behandles"`                         | `t("mockup.vacation.status")`                 |
| `"Vakt-innsikt"`                         | `t("mockup.overlay.shift.badge")`             |
| `"Lukk"`                                 | `t("mockup.overlay.shift.close")`             |
| `"Krav & Tariff"`                        | `t("mockup.overlay.shift.title")`             |
| `"Automatisert av Event Motoren"`        | `t("mockup.overlay.shift.subtitle")`          |
| `"Krav til vakt"`                        | `t("mockup.overlay.shift.reqLabel")`          |
| `"Minimum \"Servitør Erfaren\"..."`      | `t("mockup.overlay.shift.reqValue")`          |
| `"Tariff Tillegg"`                       | `t("mockup.overlay.shift.tariffLabel")`       |
| `"Kveldstillegg (etter 18:00)"`          | `t("mockup.overlay.shift.evening")`           |
| `"+ 29,-/t"`                             | `t("mockup.overlay.shift.eveningRate")`       |
| `"Helgetillegg"`                         | `t("mockup.overlay.shift.weekend")`           |
| `"+ 55,-/t"`                             | `t("mockup.overlay.shift.weekendRate")`       |
| `"Systemet sjekker automatisk..."`       | `t("mockup.overlay.shift.hmsNote")`           |
| `"Ferieforespørsel"`                     | `t("mockup.overlay.vacation.title")`          |
| `"Peder søker om ferie uke 43."`         | `t("mockup.overlay.vacation.subtitle")`       |
| `"Botsson Insight:"`                     | `t("mockup.overlay.vacation.insightLabel")`   |
| `"Peder har 12 feriedager..."`           | `t("mockup.overlay.vacation.insight")`        |
| `"Godkjenn"`                             | `t("mockup.overlay.vacation.approve")`        |
| `"Avslå"`                                | `t("mockup.overlay.vacation.reject")`         |
| `"Lise Botsson"`                         | `t("mockup.botsson.name")`                    |
| `"AI Assistent"`                         | `t("mockup.botsson.role")`                    |
| `"Klikk på meg..."`                      | `t("mockup.botsson.collapsed")`               |
| `"Smartout er AI Native."`               | `t("mockup.botsson.expanded.title")`          |
| `"Mitt AI-rammeverk..."`                 | `t("mockup.botsson.expanded.body")`           |
| `"Mens du eier restauranten..."`         | `t("mockup.botsson.expanded.tagline")`        |

In `VariantMLanding.tsx`, pass locale to the mockup:

```tsx
// Change:
<LandingInteractiveMockup />
// To:
<LandingInteractiveMockup locale={locale} />
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter landing typecheck`

Expected: PASS with 0 errors.

- [ ] **Step 4: Verify no remaining hardcoded Norwegian in Poll**

Run: `grep -n "ansatte\|Smartout.*tilpasser\|puslespill\|Facebook\|Sliter\|Vi hører" apps/landing/src/components/landing/LandingInteractivePoll.tsx`

Expected: No output (0 matches).

- [ ] **Step 5: Verify no remaining hardcoded Norwegian in Mockup**

Run: `grep -n "Hovedkjøkken\|Vaktplan\|Meldinger\|Ferie.*Fravær\|Godkjent\|Servitør\|Ferieforespørsel\|Lukk\|Krav.*Tariff\|Botsson.*Insight\|Godkjenn\|Avslå\|AI Native\|restauranten" apps/landing/src/components/landing/LandingInteractiveMockup.tsx`

Expected: No output (0 matches).

- [ ] **Step 6: Commit**

```bash
git add apps/landing/src/components/landing/LandingInteractivePoll.tsx apps/landing/src/components/landing/LandingInteractiveMockup.tsx apps/landing/src/components/landing/VariantMLanding.tsx
git commit -m "feat(landing): wire i18n into Poll and Mockup interactive components

Replace all hardcoded Norwegian text with t() calls using landing
namespace keys. Both components now accept locale prop, passed from
VariantMLanding.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Blocks, Demo & Utility Token Migration

### Task 5: Migrate block-helpers.ts and blocks structural colors

**Files:**

- Modify: `apps/landing/src/components/blocks/block-helpers.ts`
- Modify: All 15 block `.tsx` files in `apps/landing/src/components/blocks/`

- [ ] **Step 1: Fix block-helpers.ts**

In `apps/landing/src/components/blocks/block-helpers.ts`, replace:

```ts
// Line 33:
case "subtle":
  return "bg-white/[0.02]";
// Replace with:
case "subtle":
  return "bg-foreground/[0.02]";

// Line 35:
case "dark":
  return "bg-zinc-900/50";
// Replace with:
case "dark":
  return "bg-muted";
```

- [ ] **Step 2: Migrate all block .tsx files**

Apply the structural color mapping from the reference table above to these files. Each block component renders inside a dark context (the blocks page wrapper is dark-themed). Apply these replacements:

**Files to modify (all in `apps/landing/src/components/blocks/`):**

- `CtaSectionBlock.tsx`
- `FeaturesGridBlock.tsx`
- `HeroBlock.tsx`
- `TestimonialBlock.tsx`
- `CaseStudyBlock.tsx`
- `LogoStripBlock.tsx`
- `FeaturesListBlock.tsx`
- `TextSectionBlock.tsx`
- `FeaturesIconsBlock.tsx`
- `PricingPreviewBlock.tsx`
- `ImageSectionBlock.tsx`
- `FaqBlock.tsx`
- `StatsBlock.tsx`
- `VoiceWidgetBlock.tsx`
- `WorkspaceAnalyzerBlock.tsx`

**Global find-and-replace rules (apply to all block files):**

| Find                                 | Replace                      |
| ------------------------------------ | ---------------------------- |
| `text-white`                         | `text-foreground`            |
| `text-zinc-200`                      | `text-foreground`            |
| `text-zinc-300`                      | `text-foreground`            |
| `text-zinc-400`                      | `text-muted-foreground`      |
| `text-zinc-500`                      | `text-muted-foreground`      |
| `text-zinc-600`                      | `text-muted-foreground/70`   |
| `text-zinc-950`                      | `text-background`            |
| `bg-white` (when solid, for buttons) | `bg-foreground`              |
| `bg-white/[0.02]`                    | `bg-foreground/[0.02]`       |
| `bg-white/[0.03]`                    | `bg-foreground/[0.03]`       |
| `bg-white/[0.05]`                    | `bg-foreground/[0.05]`       |
| `bg-white/5`                         | `bg-foreground/5`            |
| `bg-white/10`                        | `bg-foreground/10`           |
| `bg-white/20`                        | `bg-foreground/20`           |
| `bg-zinc-900/50`                     | `bg-muted`                   |
| `bg-zinc-950`                        | `bg-background`              |
| `border-white/5`                     | `border-border`              |
| `border-white/10`                    | `border-border`              |
| `border-white/20`                    | `border-border`              |
| `hover:bg-white/5`                   | `hover:bg-foreground/5`      |
| `hover:bg-white/[0.05]`              | `hover:bg-foreground/[0.05]` |
| `hover:bg-zinc-200`                  | `hover:bg-foreground/90`     |
| `hover:border-white/20`              | `hover:border-foreground/20` |
| `hover:border-white/40`              | `hover:border-foreground/40` |
| `hover:text-white`                   | `hover:text-foreground`      |
| `open:bg-white/[0.05]`               | `open:bg-foreground/[0.05]`  |

**Important:** The blocks page wrapper must also have `dark-section` class. Check `BlockRenderer.tsx` — if it has a root wrapper, add `dark-section` there. If not, the parent page applies it.

- [ ] **Step 3: Verify no hardcoded structural colors remain in blocks**

Run: `grep -rn "zinc\|text-white\|bg-white\|bg-\[#" apps/landing/src/components/blocks/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"`

Expected: No output (0 matches). If any remain, fix them per the mapping table.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter landing typecheck`

Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/src/components/blocks/
git commit -m "refactor(landing): migrate blocks to design token classes

Replace all hardcoded zinc/white structural colors with CSS variable
token classes across 16 block component files. Semantic status colors
(emerald, amber, red) preserved as-is.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Migrate demo component structural colors

**Files:**

- Modify: `apps/landing/src/components/demo/DemoShell.tsx`
- Modify: `apps/landing/src/components/demo/AssistantPanel.tsx`
- Modify: `apps/landing/src/components/demo/JourneyCard.tsx`
- Modify: `apps/landing/src/components/demo/JourneyProgress.tsx`
- Modify: `apps/landing/src/components/demo/features/FeatureHaccp.tsx`
- Modify: `apps/landing/src/components/demo/features/FeatureDeviation.tsx`
- Modify: `apps/landing/src/components/demo/features/FeatureOnboarding.tsx`
- Modify: `apps/landing/src/components/demo/features/FeaturePunchIn.tsx`
- Modify: `apps/landing/src/components/demo/features/FeatureSchedule.tsx`
- Modify: `apps/landing/src/components/demo/features/FeatureQuiz.tsx`

- [ ] **Step 1: Add dark-section to DemoShell root**

In `DemoShell.tsx`, add `dark-section` to the root element:

```tsx
// Before (line 40):
className = "bg-[#050505] text-zinc-100 ...";
// After:
className = "dark-section bg-background text-foreground ...";
```

- [ ] **Step 2: Apply structural color replacements to all demo files**

Apply the same mapping table from Task 5 to ALL demo files. Additional demo-specific mappings:

| Find                         | Replace                        |
| ---------------------------- | ------------------------------ |
| `bg-[#050505]`               | `bg-background`                |
| `bg-[#0a0a0c]`               | `bg-background`                |
| `bg-[#0a0a0c]/80`            | `bg-background/80`             |
| `bg-zinc-800`                | `bg-muted`                     |
| `bg-zinc-700`                | `bg-muted`                     |
| `fill-zinc-700`              | `fill-muted`                   |
| `text-zinc-100`              | `text-foreground`              |
| `focus:border-orange-500/30` | `focus:border-brand-orange/30` |
| `focus:ring-white/20`        | `focus:ring-foreground/20`     |

**Brand orange replacements in demo files:**

| Find                         | Replace                        |
| ---------------------------- | ------------------------------ |
| `text-orange-400`            | `text-brand-orange`            |
| `text-orange-500`            | `text-brand-orange`            |
| `text-orange-100`            | `text-brand-orange-light`      |
| `text-orange-300`            | `text-brand-orange`            |
| `text-orange-200`            | `text-brand-orange-light`      |
| `bg-orange-400`              | `bg-brand-orange-light`        |
| `bg-orange-500`              | `bg-brand-orange`              |
| `bg-orange-500/10`           | `bg-brand-orange/10`           |
| `bg-orange-500/15`           | `bg-brand-orange/15`           |
| `bg-orange-500/20`           | `bg-brand-orange/20`           |
| `bg-orange-500/30`           | `bg-brand-orange/30`           |
| `border-orange-500/20`       | `border-brand-orange/20`       |
| `border-orange-500/30`       | `border-brand-orange/30`       |
| `border-orange-500/40`       | `border-brand-orange/40`       |
| `hover:bg-orange-400`        | `hover:bg-brand-orange-light`  |
| `hover:bg-orange-500/20`     | `hover:bg-brand-orange/20`     |
| `hover:bg-orange-500/30`     | `hover:bg-brand-orange/30`     |
| `hover:border-orange-500/30` | `hover:border-brand-orange/30` |
| `hover:border-orange-500/40` | `hover:border-brand-orange/40` |
| `shadow-orange-500/20`       | `shadow-brand-orange/20`       |

**DO NOT replace** semantic status colors: `emerald-*`, `amber-*`, `red-*`, `cyan-*`, `purple-*`, `rose-*`. These are intentional status indicators in the demo.

- [ ] **Step 3: Verify no hardcoded structural/orange colors remain**

Run: `grep -rn "zinc\|text-white\|bg-white\|bg-\[#\|orange-[0-9]" apps/landing/src/components/demo/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"`

Expected: No output (0 matches for structural + orange). Semantic colors (emerald, amber, red, cyan, purple, rose) should still be present — that's correct.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter landing typecheck`

Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/src/components/demo/
git commit -m "refactor(landing): migrate demo components to design token classes

Replace structural colors (zinc, white, black, hex, orange) with CSS
variable token classes across 10 demo files. DemoShell uses dark-section
utility. Semantic status colors (emerald, amber, red, cyan, purple, rose)
preserved for interactive state indicators.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Migrate utility component structural colors

**Files:**

- Modify: `apps/landing/src/components/variant-badge.tsx`
- Modify: `apps/landing/src/components/variant-dropdown.tsx`
- Modify: `apps/landing/src/components/voice-assistant.tsx`
- Modify: `apps/landing/src/components/workspace-analyzer.tsx`
- Modify: `apps/landing/src/components/next-page-banner.tsx`

These utility components live inside dark contexts (footer, blocks, etc.). Apply the same structural + brand-orange mapping from Tasks 5-6.

- [ ] **Step 1: Apply replacements to all 5 utility files**

Use the same mapping tables from Tasks 5 and 6. Additionally for `workspace-analyzer.tsx`:

| Find                                      | Replace                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| `from-blue-600 to-violet-600`             | `from-brand-purple to-brand-purple-light`             |
| `hover:from-blue-500 hover:to-violet-500` | `hover:from-brand-purple-light hover:to-brand-purple` |

- [ ] **Step 2: Verify no hardcoded structural colors remain**

Run: `grep -n "zinc\|gray-\|text-white\|bg-white\|bg-\[#\|orange-[0-9]\|blue-[0-9]\|violet-[0-9]" apps/landing/src/components/variant-badge.tsx apps/landing/src/components/variant-dropdown.tsx apps/landing/src/components/voice-assistant.tsx apps/landing/src/components/workspace-analyzer.tsx apps/landing/src/components/next-page-banner.tsx`

Expected: No output (0 matches).

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter landing typecheck`

Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/components/variant-badge.tsx apps/landing/src/components/variant-dropdown.tsx apps/landing/src/components/voice-assistant.tsx apps/landing/src/components/workspace-analyzer.tsx apps/landing/src/components/next-page-banner.tsx
git commit -m "refactor(landing): migrate utility components to design token classes

Replace hardcoded colors in variant-badge, variant-dropdown,
voice-assistant, workspace-analyzer, and next-page-banner with CSS
variable token classes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: Archive Cleanup

### Task 8: Delete archived variant landing pages

**Files:**

- Delete: `apps/landing/src/components/landing/_archived/VariantALanding.tsx`
- Delete: `apps/landing/src/components/landing/_archived/VariantELanding.tsx`
- Delete: `apps/landing/src/components/landing/_archived/VariantFLanding.tsx`
- Delete: `apps/landing/src/components/landing/_archived/VariantILanding.tsx`
- Delete: `apps/landing/src/components/landing/_archived/VariantKLanding.tsx`
- Delete: `apps/landing/src/components/landing/_archived/VariantSLanding.tsx`
- Delete: `apps/landing/src/components/landing/_archived/VariantTLanding.tsx`
- Delete: `apps/landing/src/components/landing/_archived/VariantVLanding.tsx`

- [ ] **Step 1: Verify no imports reference archived variants**

Run: `grep -rn "_archived\|VariantALanding\|VariantELanding\|VariantFLanding\|VariantILanding\|VariantKLanding\|VariantSLanding\|VariantTLanding\|VariantVLanding" apps/landing/src/ --include="*.tsx" --include="*.ts" | grep -v "_archived/"`

Expected: No output (0 matches outside the archived directory itself).

- [ ] **Step 2: Delete the archived directory**

```bash
rm -rf apps/landing/src/components/landing/_archived/
```

- [ ] **Step 3: Verify landing typecheck still passes**

Run: `pnpm --filter landing typecheck`

Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/landing/src/components/landing/_archived/
git commit -m "chore(landing): delete 8 archived variant landing pages

Remove VariantA/E/F/I/K/S/T/V Landing pages (~248KB of dead code).
These were persona-based A/B test variants replaced by VariantMLanding.
No imports reference these files.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Final Verification

After all phases are complete:

- [ ] **Full typecheck:** `pnpm --filter landing typecheck`
- [ ] **Full lint:** `pnpm --filter landing lint`
- [ ] **Grep audit:** `grep -rn "zinc\|gray-[0-9]\|slate-\|stone-\|bg-\[#0" apps/landing/src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules\|_archived" | wc -l` — target: 0 structural color violations
- [ ] **Visual check:** Run `pnpm --filter landing dev` and verify footer, blocks pages, and demo look correct in both light and dark mode

---

## Council Verdict

**Status: APPROVED_WITH_CONDITIONS**
**Reviewer:** Council Agent — 2026-03-26

### Summary

The plan is architecturally sound and production-ready. Design token references verified against codebase — all token variables (`--brand-orange`, `--brand-orange-light`, `--brand-purple`, `--brand-purple-light`, etc.) are confirmed in `tokens.css` and wired as `@theme` color tokens in `globals.css`. The `.dark-section` approach is correct: it mirrors the `.dark` block pattern with darker OKLCH values (`0.06` vs `0.12`) appropriate for footer/blocks that currently hardcode `#050505`/`#0a0a0c`. OKLCH hues (50–55) are within the Nordic Split warm tone range.

### Conditions (fix before executing)

1. **Missing YAML frontmatter** — CLAUDE.md requires frontmatter on all `docs/` files. Add before work begins:

   ```yaml
   ---
   title: Landing App Design Token Migration
   status: in_progress
   updated: 2026-03-26
   created: 2026-03-26
   module: landing
   tags: [design-tokens, i18n, landing, refactor]
   ---
   ```

2. **Shadow mapping inconsistency** — The Color Mapping Reference maps `shadow-orange-500/20` → `shadow-[0_0_15px_-3px_var(--brand-orange)]` (explicit arbitrary value), but Task 6's table maps it to `shadow-brand-orange/20`. Use the explicit `var()` form from the reference — it is more reliable in Tailwind v4 where shadow color utilities are not guaranteed to compose with opacity modifiers.

3. **`globals.css` step in Task 1 is misleading** — The File Structure header says "register dark-section in @theme" for `globals.css:80-102`, but `.dark-section` is a raw CSS class, not a `@theme` token. No changes to `globals.css` are needed. The class just lives in `tokens.css` and is imported automatically. Remove the `globals.css` file from Task 1's file list to avoid confusion.

### What looks good

- All 3 phases are independently executable and correctly sequenced
- Every task has atomic commits, typecheck verification, and grep audit steps
- Semantic status colors (emerald, amber, red, cyan, purple, rose) correctly preserved
- i18n coverage complete: both `nb` and `en` keys added for Poll and Mockup
- Archive cleanup (Phase 3) correctly verifies no live imports before delete
- 8 archived variants confirmed to exist in the codebase
- Color mapping reference is comprehensive and covers all known hardcoded patterns
