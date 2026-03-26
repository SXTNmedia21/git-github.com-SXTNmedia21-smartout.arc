---
title: "Landing Page Perspective Alignment — Implementation Plan"
status: done
updated: 2026-03-26
created: 2026-03-10
module: landing
tags: [landing, perspectives, copy]
---

# Landing Page Perspective Alignment — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define 10 distinct perspectives on Smartout, assign 7 to landing page variants, and align all variant copy (hero, sections, CTAs, voice config) to its assigned perspective.

**Architecture:** Each variant (`B`, `E`, `T`, `K`, `A`, `F`, `S`) is a separate React component in `apps/landing/src/components/landing/`. Voice/AI config lives in `apps/landing/src/lib/variant-voice-config.ts`. Shared nav/footer in `apps/landing/src/components/`. Copy changes are text-only — no JSX structure, styling, or component logic changes.

**Tech Stack:** Next.js (App Router), React, TypeScript, Framer Motion, Tailwind v4

---

## Current State (already completed)

All 7 variants have received a first-pass copy polish:

- **B** (default, `page.tsx`): 33 changes — sharper CTAs, benefit-first, softer stats
- **E** (`VariantELanding.tsx`): Swedish→Norwegian fix, jargon removed, operator language
- **T** (`VariantTLanding.tsx`): æ/ø/å character fixes, compliance angle sharpened
- **K** (`VariantKLanding.tsx`): Case studies rewritten with specifics, consultant toolkit
- **A** (`VariantALanding.tsx`): ASCII→proper Norwegian chars, "Du hører til her" hero
- **F** (`VariantFLanding.tsx`): Warmer tone, empowerment language, minimal text
- **S** (`VariantSLanding.tsx`): Editorial tone, craft metaphors, less corporate

These changes are **uncommitted** on branch `feat/landingpage`.

## Remaining Work

### Phase 1: Perspective Strategy (requires human decision)

10 candidate perspectives on Smartout (max 6 words each):

| #   | Perspective                      | Angle                                           | Current variant? |
| --- | -------------------------------- | ----------------------------------------------- | ---------------- |
| 1   | **Ingen starter uforberedt**     | Opplæring — den nye ansatte                     | —                |
| 2   | **Én plattform. Full kontroll.** | Alt-i-ett — eieren/lederen                      | B (current)      |
| 3   | **Riktig person, riktig tid**    | Intelligent vaktliste — driftsansvarlig         | —                |
| 4   | **Alltid klar for tilsyn**       | Compliance/HACCP — kvalitetsfokusert            | T (partial)      |
| 5   | **Kaos koster mer enn du tror**  | Kostnad av dårlige verktøy — frustrert operatør | E (partial)      |
| 6   | **En kollega som aldri glemmer** | AI som medarbeider — tech-nysgjerrig            | —                |
| 7   | **Du hører til fra dag én**      | Tilhørighet — den unge/usikre                   | A (current)      |
| 8   | **Voks uten å miste kvalitet**   | Skalering — kjede/multi-lokasjon                | —                |
| 9   | **Slutt å gjenta deg selv**      | Kommunikasjon/oppfølging — sliten leder         | —                |
| 10  | **Håndverket fortjener bedre**   | Stolthet i faget — den erfarne                  | S (partial)      |

**Decision needed:** Which 7 of 10 → which variant letter?

---

### Phase 2: Per-Variant Perspective Alignment

Once the 7 perspectives are assigned, each variant needs its copy aligned to its perspective. This means reviewing and potentially updating:

1. **Hero section** — headline, subtitle, badge text
2. **Section headings** — must echo the perspective angle
3. **CTAs** — primary and secondary button text
4. **Voice config** — `VARIANT_VOICE_CONFIG` persona and prompt context
5. **AI section** — `VARIANT_AI_SECTION` heading, subheading, capability cards
6. **Footer tagline** — already updated, verify consistency

**Files per variant:**

| Variant | Component file                                            | Voice config                      |
| ------- | --------------------------------------------------------- | --------------------------------- |
| B       | `apps/landing/src/app/page.tsx` (lines 1–1264)            | `variant-voice-config.ts` B entry |
| E       | `apps/landing/src/components/landing/VariantELanding.tsx` | `variant-voice-config.ts` E entry |
| T       | `apps/landing/src/components/landing/VariantTLanding.tsx` | `variant-voice-config.ts` T entry |
| K       | `apps/landing/src/components/landing/VariantKLanding.tsx` | `variant-voice-config.ts` K entry |
| A       | `apps/landing/src/components/landing/VariantALanding.tsx` | `variant-voice-config.ts` A entry |
| F       | `apps/landing/src/components/landing/VariantFLanding.tsx` | `variant-voice-config.ts` F entry |
| S       | `apps/landing/src/components/landing/VariantSLanding.tsx` | `variant-voice-config.ts` S entry |

---

## Chunk 1: Perspective Decision + First-Pass Polish Commit

### Task 1: Commit current copy polish work

All 7 variants have been polished. This work should be committed before perspective alignment begins.

**Files:**

- Modified: `apps/landing/src/app/page.tsx`
- Modified: `apps/landing/src/components/landing/VariantELanding.tsx`
- Modified: `apps/landing/src/components/landing/VariantTLanding.tsx`
- Modified: `apps/landing/src/components/landing/VariantKLanding.tsx`
- Modified: `apps/landing/src/components/landing/VariantALanding.tsx`
- Modified: `apps/landing/src/components/landing/VariantFLanding.tsx`
- Modified: `apps/landing/src/components/landing/VariantSLanding.tsx`
- Modified: `apps/landing/src/lib/variant-voice-config.ts`
- Modified: `apps/landing/src/components/footer.tsx`

- [ ] **Step 1: Run typecheck**

Run: `cd /home/sxtnl/dev/wt-10 && pnpm --filter landing exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Stage all modified landing files**

```bash
git add apps/landing/src/app/page.tsx \
  apps/landing/src/components/landing/VariantELanding.tsx \
  apps/landing/src/components/landing/VariantTLanding.tsx \
  apps/landing/src/components/landing/VariantKLanding.tsx \
  apps/landing/src/components/landing/VariantALanding.tsx \
  apps/landing/src/components/landing/VariantFLanding.tsx \
  apps/landing/src/components/landing/VariantSLanding.tsx \
  apps/landing/src/lib/variant-voice-config.ts \
  apps/landing/src/components/footer.tsx
```

- [ ] **Step 3: Commit**

```bash
git commit -m "copy(landing): polish all 7 variant pages — benefit-first, Norwegian fixes, tighter CTAs"
```

### Task 2: Get human decision on perspective mapping

Present the 10 perspectives table and get confirmation on which 7 map to which variant letter.

- [ ] **Step 1: Present perspective table to user**

Show the 10-row table from Phase 1 above. Ask: "Which 7? And which variant letter gets which perspective?"

- [ ] **Step 2: Document decision**

Write an ADR or add to decision log: perspective-to-variant mapping.

---

## Chunk 2: Perspective Alignment (per variant)

> This chunk is blocked on Task 2 (human decision). Tasks 3–9 below are templates — the actual perspective text depends on the decision.

### Task 3: Align Variant B (default) to assigned perspective

**Files:**

- Modify: `apps/landing/src/app/page.tsx`
- Modify: `apps/landing/src/lib/variant-voice-config.ts` (B entries)

- [ ] **Step 1: Read current hero section** in `page.tsx` (search for "Hero Section")
- [ ] **Step 2: Update hero headline** to match assigned perspective (max 6 words)
- [ ] **Step 3: Update hero subtitle** — one sentence expanding the perspective
- [ ] **Step 4: Update hero badge** text if it contradicts the perspective
- [ ] **Step 5: Review all section headings** — ensure they echo the perspective angle
- [ ] **Step 6: Update CTAs** — primary and secondary should reflect the perspective's action
- [ ] **Step 7: Update `VARIANT_VOICE_CONFIG.B.promptContext`** to match new perspective
- [ ] **Step 8: Update `VARIANT_AI_SECTION.B`** heading/subheading if needed
- [ ] **Step 9: Run typecheck**

Run: `cd /home/sxtnl/dev/wt-10 && pnpm --filter landing exec tsc --noEmit`

- [ ] **Step 10: Commit**

```bash
git commit -m "copy(landing): align variant B to [perspective name]"
```

### Task 4: Align Variant E to assigned perspective

**Files:**

- Modify: `apps/landing/src/components/landing/VariantELanding.tsx`
- Modify: `apps/landing/src/lib/variant-voice-config.ts` (E entries)

- [ ] **Step 1–10:** Same structure as Task 3, targeting Variant E files.

### Task 5: Align Variant T to assigned perspective

**Files:**

- Modify: `apps/landing/src/components/landing/VariantTLanding.tsx`
- Modify: `apps/landing/src/lib/variant-voice-config.ts` (T entries)

- [ ] **Step 1–10:** Same structure as Task 3, targeting Variant T files.

### Task 6: Align Variant K to assigned perspective

**Files:**

- Modify: `apps/landing/src/components/landing/VariantKLanding.tsx`
- Modify: `apps/landing/src/lib/variant-voice-config.ts` (K entries)

- [ ] **Step 1–10:** Same structure as Task 3, targeting Variant K files.

### Task 7: Align Variant A to assigned perspective

**Files:**

- Modify: `apps/landing/src/components/landing/VariantALanding.tsx`
- Modify: `apps/landing/src/lib/variant-voice-config.ts` (A entries)

- [ ] **Step 1–10:** Same structure as Task 3, targeting Variant A files.

### Task 8: Align Variant F to assigned perspective

**Files:**

- Modify: `apps/landing/src/components/landing/VariantFLanding.tsx`
- Modify: `apps/landing/src/lib/variant-voice-config.ts` (F entries)

- [ ] **Step 1–10:** Same structure as Task 3, targeting Variant F files.

### Task 9: Align Variant S to assigned perspective

**Files:**

- Modify: `apps/landing/src/components/landing/VariantSLanding.tsx`
- Modify: `apps/landing/src/lib/variant-voice-config.ts` (S entries)

- [ ] **Step 1–10:** Same structure as Task 3, targeting Variant S files.

---

## Chunk 3: Verification + Closure

### Task 10: Cross-variant consistency check

**Files:**

- Read: All 7 variant files + `variant-voice-config.ts` + `footer.tsx` + `navigation.tsx`

- [ ] **Step 1: Verify no duplicate perspectives** — each variant must have a unique angle
- [ ] **Step 2: Verify Norwegian language quality** — no Swedish, no ASCII-encoded æ/ø/å, no English
- [ ] **Step 3: Verify all `// CHANGED:` comments** are present on modified lines
- [ ] **Step 4: Verify `trackCta` calls** match updated CTA button text
- [ ] **Step 5: Run full typecheck**

Run: `cd /home/sxtnl/dev/wt-10 && pnpm --filter landing exec tsc --noEmit`

- [ ] **Step 6: Run build**

Run: `cd /home/sxtnl/dev/wt-10 && pnpm --filter landing build`

### Task 11: Update documentation

**Files:**

- Modify: `docs/worklogs/WORKLOG-landingpage.md`
- Modify: `docs/decisions/0000-decision-log.md`
- Modify: `docs/plans/PLAN-landingpage.md`

- [ ] **Step 1: Update WORKLOG** with all completed tasks, decisions, and log entries
- [ ] **Step 2: Register perspective decision** in decision log
- [ ] **Step 3: Update PLAN** with final scope, tasks, and acceptance criteria
- [ ] **Step 4: Commit docs**

```bash
git add docs/worklogs/WORKLOG-landingpage.md docs/decisions/0000-decision-log.md docs/plans/PLAN-landingpage.md
git commit -m "docs(landing): update worklog, decision log, and plan for perspective alignment"
```
