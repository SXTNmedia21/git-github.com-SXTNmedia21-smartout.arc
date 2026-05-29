---
title: "PLAN-5 — UX-council deferrals (NowLine SR + text-2xs token)"
status: in_progress
updated: 2026-05-29
created: 2026-05-29
module: day-session
tags: [a11y, wcag, design-tokens, adr-0366, run-council]
---

# PLAN-5 — UX-council deferrals (optional-batchable)

## 5a. P4 — NowLine SR current-time announce

The now-line shows "NÅ · HH:MM" visually but isn't announced to screen readers.
**Fix:** add an `aria-live="polite"` (or `role="status"`) hidden element near the NowLine that announces the current
time, updated on the now-tick. Visually-hidden (`sr-only`), no layout impact. In the chart's now-line component.

## 5b. P6 — text-2xs design token (WCAG 1.4.4)

`text-[0.6rem]` = 9.6px hardcoded in timeline UI is below comfortable minimums and is an arbitrary value.
**Fix:** introduce a `text-2xs` token in `packages/design-tokens/` (the canonical font-size scale) mapping to a
defined step (e.g. 0.6875rem/11px = the mockup's `--fs-meta`, which is the smallest *named* token — prefer raising
9.6px→11px to meet 1.4.4 rather than codifying sub-10px). Replace `text-[0.6rem]` usages with `text-2xs`.

**ADR-0366 / design-tokens gate — MANDATORY before the sweep:** touching `packages/design-tokens/` is token-DEFINITION
territory. **Run `run-council` design-token gate** (topic: "add text-2xs token to Nordic Split scale; map 9.6px arbitrary
→ named token at 11px for WCAG 1.4.4; verify no OKLCH/scale-coherence violation"). Council verdict is DEFINITIVE:
- APPROVE → add the token + sweep.
- APPROVE WITH CHANGES → apply the mapping the council specifies.
- REJECT → do NOT add the token; instead replace `text-[0.6rem]` with the nearest EXISTING token (e.g. `text-xs`),
  document in HANDOFF. Either way, no Pontus stop (council is definitive).

Council output → `reports/COUNCIL-design-token-<ts>.md`.

**Acceptance:** NowLine announces current time to SR (aria-live verified in markup); `text-[0.6rem]` eliminated
(replaced by token per council verdict); design-tokens change council-approved; typecheck + lint green.

**Commit(s):** `fix(a11y): NowLine current-time SR announce (WCAG)` +
`feat(tokens): text-2xs scale token + timeline sweep (ADR-0366, council-approved)` (or the REJECT-path equivalent).

**Batchable:** if PLAN-5 risks blowing the work budget, 5a (no token risk) ships; 5b defers to a token sortie — note in HANDOFF.
