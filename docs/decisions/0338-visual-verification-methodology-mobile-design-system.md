---
id: ADR-0338
title: "Visual Verification Methodology for Mobile Design System"
status: accepted
date: 2026-05-16
deciders: [pontus, council]
tags: [mobile, design-system, testing, visual-regression, nordic-split]
supersedes: null
superseded_by: null
created: 2026-05-16
updated: 2026-05-16
accepted_at: 2026-05-16
implementation_commit: 16b000387
layer: decision
---

# ADR-0338: Visual Verification Methodology for Mobile Design System

**Status:** Accepted (2026-05-16 — methodology + audit scaffold + gap-list shipped at `16b000387`)
**Date:** 2026-05-16
**Council:** Chat-WhatsApp Phase 3 priority council — APPROVE WITH CHANGES
**Implementation:** `docs/protocols/VISUAL-VERIFICATION-MOBILE.md` (275 lines) + `docs/audits/2026-05-16-chat-whatsapp-visual-audit.md` (331 lines, AMBER verdict — 7 NEEDS-PWA-MANUAL items enumerated)

## Context and Problem Statement

Chat-WhatsApp Phase 1 shipped a design system token bug that went undetected
through implementation and review: `secondary === muted` resolved to identical
hex values in the mobile token set. The bug was caught only by Pontus during
PWA inspection on the actual device — not during implementation, not during
code review, not during Phase 2 review.

Chat-WhatsApp Phase 2 was never visually verified at all. Both phases used
"Nordic Split spec compliant" as a proxy for "visually correct." The proxy is
insufficient — spec compliance is structural, not perceptual.

The design system has OKLCH tokens that may resolve identically at intermediate
steps, motion timing values that feel wrong only in the browser, and gesture
recognizer conflicts detectable only on a real PWA touch surface.

## Decision Drivers

- L-0276 (2026-05-16) — Phase 2.5 haiku fact-check reported 4 schema items
  "VERIFIED MISSING" that existed under different names. Same class of gap
  applies to visual verification: checking spec names is not checking rendered
  output.
- ADR-0133 (mobile surface boundary) — mobile executes, not authors. The
  mobile execution surface requires real device or PWA verification; desktop
  browser simulation is insufficient for gesture + motion quality.
- Nordic Split spec (`smartout-nordic-split` skill) — defines token names but
  not resolved hex values. Implementation must verify resolved values.

## Considered Options

- **Option A** — Continue spec-compliance review only (current, implicit)
- **Option B** — Codify a four-step visual verification methodology as a
  required gate for mobile design system work
- **Option C** — Option B + automated Playwright snapshot diff for pixel-level
  regression

## Decision Outcome

**Chosen option: B (codify methodology) with Option C as optional extension.**

The four mandatory steps for any mobile design system change:

### Step 1 — Token Resolved-Value Audit

Before shipping, log actual hex/oklch resolved values for every token used:

```typescript
// In test or storybook, not production code
console.log({
  secondary: getComputedStyle(el).getPropertyValue("--color-secondary"),
  muted: getComputedStyle(el).getPropertyValue("--color-muted"),
});
```

If two tokens resolve to the same value: either the spec intends them identical
(document it) or it is a bug (fix before merge).

### Step 2 — Motion Timing Audit

Verify every `duration` and `easing` value against `motionTokens`:
- `enterMs`, `exitMs`, `springAmbient`, `springReactive` are from
  `packages/design-tokens/src/tokens.ts`
- Verify values feel correct at `prefers-reduced-motion: no-preference` AND
  that reduced-motion path exists
- Log resolved ms values; do NOT trust variable names alone

### Step 3 — Side-by-Side Reference Comparison

Compare every UI surface against the reference screenshot from the original
design briefing (or Pontus's approved PWA screenshot). Pixel-perfect is not
required; perceptual match is. Document: "matches reference: yes/no; deviation
notes: X."

### Step 4 — Gesture-Recognizer Conflict Check on PWA

For any component with swipe, long-press, pan, or drag gestures:
1. Test on `localhost:8083` PWA (per `feedback_mobile_pwa_for_testing.md`)
2. Confirm the gesture does not conflict with browser native scroll, back
   swipe, or PWA chrome gestures
3. Document: "tested on PWA: yes/no; conflicts found: X"

**Option C (Playwright snapshot diff — optional):**

For pages with stable visual output, add a baseline snapshot test:

```typescript
// apps/e2e/tests/mobile/design-regression.spec.ts
test("komm-chat color tokens", async ({ page }) => {
  await page.goto("/dashboard/komm/chat");
  await expect(page).toHaveScreenshot("komm-chat-baseline.png", {
    maxDiffPixelRatio: 0.02,
  });
});
```

Run `pnpm playwright update-snapshots` when intentional redesign ships;
reject PRs where snapshot diff exceeds threshold.

## Implementation Gate

For any PR touching `apps/mobile/`, `apps/web/src/app/dashboard/`, or
`packages/design-tokens/` that affects rendered output:

**Required in PR description:**

```markdown
## Visual Verification
- [ ] Step 1 Token resolved-value audit: <values logged>
- [ ] Step 2 Motion timing audit: <ms values confirmed>
- [ ] Step 3 Side-by-side reference: matches/deviates (notes)
- [ ] Step 4 PWA gesture test: tested / not applicable
```

## Rules & Consequences enforced for Agents

- **Good, because** token identity bugs like `secondary===muted` are caught
  before merge, not after Pontus's device inspection.
- **Good, because** motion timing is verified at the value level, not the name
  level.
- **Bad, because** PWA testing requires `localhost:8083` to be running (adds
  ~2min to PR cycle for mobile-UI changes).
- **Agent Impact:** When implementing any mobile or dashboard design system
  change, complete the four-step checklist before declaring done. Do NOT mark
  visual work done based on TypeScript compilation alone.

## Cross-References

ADR-0133 (mobile surface boundary), L-0276 (Phase 2.5 concept-vs-name drift —
same class), Nordic Split skill (`smartout-nordic-split`), `packages/design-tokens/src/tokens.ts`
