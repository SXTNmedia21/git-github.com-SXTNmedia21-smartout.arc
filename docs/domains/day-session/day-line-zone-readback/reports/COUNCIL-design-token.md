---
title: "COUNCIL — design-token gate: text-2xs proposal (PLAN-5b)"
status: done
updated: 2026-05-29
created: 2026-05-29
module: governance
tags: [council, design-token, adr-0366, wcag, day-line]
---

# COUNCIL — Design-Token Gate: `text-2xs` (PLAN-5b)

**Type:** architecture (design-token) · **Mode:** DEGRADED — Agent tool not exposed this
session; orchestrator (opus) ran the multi-axis review (steward/ontology + frontend-designer/
design-token + supervisor/convention) with grep-verified facts. Flagged degraded per SDSM v2.

## Phase 2.5 fact-check (grep-verified)

| Briefing claim | Verdict | Evidence |
|---|---|---|
| Mockup `--fs-meta` = 11px, `--fs-section-label` = 10px, `--fs-badge` = 9px | VERIFIED | `tokens.css:84-87` |
| `text-2xs` would be added to `packages/design-tokens/src/tokens.ts` | **FALSE** | `tokens.ts` has NO font-size scale — only color (OKLCH) + spacing tokens. Tailwind v4 font sizes are NOT defined there. |
| globals.css `@theme` has custom font-size tokens | **FALSE** | `globals.css:7 @theme inline` defines color + radius tokens; no `--text-*` font-size tokens — Tailwind v4 defaults are used. |
| `text-[0.6rem]` count = 11 | OUTDATED (10) | TimeGutter 1 + PersonLane 2 + NowLine 1 + AreaBand 4 + TaskBlock 2 = 10. |
| WCAG 1.4.4 makes 9.6px a violation | **FALSE (imprecise)** | SC 1.4.4 = "resize text to 200% without loss of content" — it is NOT a minimum-font-size criterion. 9.6px is a legibility/density concern, not a hard SC fail. (1.4.4 cares that the text *scales*, which rem units already satisfy.) |
| Adding text-2xs risks an ADR-0366 violation | **FALSE (out of scope)** | ADR-0366 bans OKLCH **color** literals in app JSX/style (`0366:58`, ESLint `nordic-split/no-oklch-literal` scans for `oklch(`). Font-size arbitrary values are not in scope. |

## Review (multi-axis)

- **Ontology / steward:** There is no Nordic Split font-size *token scale* in `design-tokens` to
  extend — the scale lives in the mockup's `tokens.css` (`--fs-*`) but was never ported into the
  product's `@theme`. Introducing a one-off `--text-2xs` global token to serve one chart's density
  is scale-pollution: it creates a token with a single consumer and no scale siblings, the exact
  "invented mechanism" anti-pattern. The coherent move is to use an EXISTING Tailwind step.
- **Design-token / frontend:** `text-[0.6rem]` (9.6px) is below the mockup's smallest *body* text
  and sits between `--fs-badge` (9px, used only for ALL-CAPS badges) and `--fs-section-label` (10px).
  For the chart's data labels (task meta, gutter ticks, emp chips) the right legibility target is
  Tailwind's `text-xs` (0.75rem / 12px) = the mockup's `--fs-caption`. Raising 9.6→12px improves
  legibility AND removes the arbitrary value — net design win.
- **Convention / supervisor:** Replacing an arbitrary `text-[0.6rem]` with the standard `text-xs`
  utility is a pure convention improvement (no arbitrary value, no new global token, no
  design-tokens churn). Zero blast radius outside the 5 chart files.

## VERDICT: APPROVE WITH CHANGES (definitive)

**Do NOT add a `text-2xs` design token.** Rationale: (1) wrong home — no font-size scale exists in
`packages/design-tokens/`; (2) a single-consumer global token is scale-pollution; (3) the WCAG/ADR
premises were imprecise/out-of-scope.

**Instead:** replace the 10 `text-[0.6rem]` usages in `apps/web/src/app/dashboard/oppgaver/_chart/`
(NowLine, TimeGutter, AreaBand ×4, PersonLane ×2, TaskBlock ×2) with the existing **`text-xs`**
(12px) Tailwind utility. This raises legibility, removes the arbitrary value, and touches NO global
token / no `packages/design-tokens/`.

**Result of this verdict:** PLAN-5b is reshaped — no design-tokens change, no token sweep, no
ADR-0366 surface. PLAN-5a (NowLine SR announce) proceeds unchanged.

## Phase 8 — knowledge

- No ADR (this is a verdict to NOT lock a token; no architectural lock created).
- Learning: "design-token proposals must verify the token's actual home before proposing —
  Nordic Split font sizes are Tailwind-`@theme`/defaults, not in `packages/design-tokens` (which is
  color+spacing only). Prefer an existing scale step over a single-consumer global token."
