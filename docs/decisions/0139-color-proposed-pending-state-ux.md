---
title: "`--color-proposed` Token + Pending-State UX Contract"
id: ADR_0139
status: draft
layer: decision
created: 2026-04-18
updated: 2026-04-18
module: design-system
tags: [adr, design-system, nordic-split, design-tokens, governance, pending-state, accessibility, tanstack, motion, wave-2c]
---

# ADR-0139: `--color-proposed` Token + Pending-State UX Contract

## Context and Problem Statement

Wave 2C (schedule TanStack migration) introduces a new visual state: when an optimistic mutation returns `{ outcome: 'proposed' }` from `cascade_gate_write` (ADR-0091 / ADR-0138), the affected row must remain visible in the UI but clearly marked as "pending approval" — not yet committed, not yet rejected. This state has no canonical representation in the Nordic Split design system today.

The problem compounds in three ways:

1. **No pending-governance token.** Nordic Split defines brand (warm OKLCH, hue 40–60), semantic destructive/warning/success/info, but nothing for "proposed / pending review." Using brand orange would be indistinguishable from Smartout-standard warm accents. Using `--color-warning` would conflate two governance meanings: "something is risky" vs "something awaits human approval."
2. **Accessibility.** A color-only signal fails screen readers and the ~8% of users with color-vision deficiency. The schedule surface specifically must remain usable for shift planners working under time pressure — a dashed border alone is not enough; a hue the color-blind cannot distinguish from the baseline row is not enough either.
3. **Rollback motion on denied.** When an optimistic mutation eventually returns `blocked` (either via deferred `gate_action` evaluation or manual rejection of the proposal), the UI must rewind the visual state. The default springSnappy motion (stiffness ~300) reads as "this happened again" rather than "this is reverting." The motion needs to feel like a retreat, not a second commit.
4. **Toast spam.** Schedule drag-drop produces many mutations per minute. If every `applied` outcome fires a toast, the UI floods. But suppressing toasts entirely hides `proposed` and `blocked` states that the user genuinely needs to see. The system needs a principled split between "visual state is the communication" and "toast is the communication."

Wave 2C cannot ship without these contracts. The design-system authors flagged four blockers; this ADR resolves them.

## Decision Drivers

- **Brand chroma hygiene.** Pending-approval must be visually distinct from Smartout warm accents. That means stepping outside hue 40–60 — otherwise every pending row reads as "the standard brand." The choice lands at amber (hue ~90): close enough to the warm family to feel Nordic Split, far enough to be unmistakable.
- **WCAG AA + color-blind safety.** No state may rely on color alone. Pending rows carry a mandatory text badge ("Venter"). Dashed border and token color are reinforcement, not substitute.
- **Motion language parity with governance semantics.** `applied` = commit (springSnappy, stiffness 300, damping 24). `proposed` = hover (enter with springSoft, stiffness 120, damping 18, appears gently). `blocked`/denied-after-proposal = retreat (lava-lamp spring, stiffness 30, damping 24, mass 2.2, ~450ms — slow, heavy, unmistakably a rollback).
- **Reduced motion compliance.** `useReducedMotion` (framer-motion) MUST be respected; all three motion variants have opacity-only fallbacks.
- **TanStack integration.** Optimistic mutations need a type-level signal that a row is pending. Client type augmentation: `pendingProposalId: string | null` on the optimistic row carries the `proposal_id` from `ToolGateResult` (ADR-0138).
- **Toast discipline.** For high-frequency surfaces where visual state IS the communication (schedule drag-drop), `applied` toasts are suppressed. For off-canvas mutations (the user is looking elsewhere when the mutation completes), toasts fire. `proposed` and `blocked` fire toasts always — but `proposed` aggregates over a short window into a strip, not per-event spam.

## Considered Options

1. **`--color-proposed` amber token + mandatory "Venter" badge + three-motion contract (chosen)** — add a new token family outside brand chroma, pair with accessible badge, specify motion semantics per governance outcome, suppress `applied` toasts on drag-drop surfaces only.
2. **Reuse `--color-warning`** — use the existing warning amber. Rejected: conflates "this is risky" with "this awaits human approval." A manager seeing amber on a row must know which of the two meanings applies without reading micro-copy.
3. **Brand orange with reduced saturation** — use Smartout warm but at reduced chroma. Rejected: indistinguishable from hover states and standard brand accents. Fails the "unmistakable" test.
4. **Icon-only signal (no new color)** — a small pending icon in the corner, no border, no background tint. Rejected: fails glanceability in dense grids (schedule week view); a planner scanning a 40-shift week cannot spot three pending rows by icon alone.
5. **Per-surface ad-hoc treatment** — let each surface decide. Rejected: explicit Nordic Split governance rule — consistent cross-surface language is a primary design-system invariant.

## Decision Outcome

Chosen option: **"`--color-proposed` amber token + mandatory `Venter` badge + three-motion contract"**, because it is the only approach that simultaneously solves brand hygiene (outside hue 40–60), accessibility (non-color signal), motion semantics (retreat is visually distinct from commit), and toast discipline (visual state vs off-canvas). Options 2–5 each fail at least one of the four invariants.

### Token definition

Add to `packages/design-tokens/src/tokens.ts`, `packages/design-tokens/src/tokens.css`, and `packages/design-tokens/src/tokens.native.ts`:

```ts
// packages/design-tokens/src/tokens.ts (additions)
proposed: {
  // OKLCH amber — hue ~90, outside brand chroma (hue 40–60).
  // Moderate chroma — visible but not aggressive (not destructive red territory).
  bg: {
    light: "oklch(0.95 0.06 90)",      // --color-proposed-bg
    dark:  "oklch(0.28 0.05 90)",
  },
  border: {
    light: "oklch(0.75 0.14 90)",      // --color-proposed-border
    dark:  "oklch(0.55 0.12 90)",
  },
  foreground: {
    light: "oklch(0.35 0.10 90)",      // --color-proposed-fg  (WCAG AA on bg.light)
    dark:  "oklch(0.92 0.05 90)",      // WCAG AA on bg.dark
  },
  accent: {
    light: "oklch(0.65 0.16 90)",      // --color-proposed-accent (badge background)
    dark:  "oklch(0.70 0.14 90)",
  },
},
```

CSS variables exposed as `--color-proposed-bg`, `--color-proposed-border`, `--color-proposed-fg`, `--color-proposed-accent`. Tailwind arbitrary-value usage: `bg-[var(--color-proposed-bg)]`, `border-[var(--color-proposed-border)]`. No hardcoded OKLCH in app code.

### Mandatory badge

Every surface rendering a `pendingProposalId` non-null row MUST render a `<PendingBadge />` component showing the literal Norwegian text "Venter". Dashed border + amber tint are reinforcement. The badge is the primary signal.

`<PendingBadge />` lives in `packages/ui/src/pending-badge.tsx`, uses `--color-proposed-accent` as background, `--color-proposed-fg` as text, includes `aria-label="Venter på godkjenning"` for screen readers. It is NOT optional — schedule, year-wheel, handbook, and any other surface adopting optimistic governance-gated mutations MUST render it.

### Client type augmentation

TanStack optimistic row types in `apps/web/src/lib/schedule/types.ts` (and equivalent for other surfaces) MUST include:

```ts
type OptimisticShift = Shift & {
  pendingProposalId: string | null;
};
```

`pendingProposalId` carries the `proposal_id` from `ToolGateResult<T>` (ADR-0138) when `outcome === 'proposed'`. Null on `applied`/`applied_with_exception` (committed), null on baseline rows, null on rolled-back rows. Renderers branch on `row.pendingProposalId != null` to apply the pending visual state.

### Motion contract

Three framer-motion variants governed by governance outcome:

| Outcome | Motion | Spring config | Duration approx |
|---------|--------|---------------|-----------------|
| `applied` | springSnappy (commit) | stiffness 300, damping 24 | ~200ms |
| `proposed` (enter) | springSoft (hover) | stiffness 120, damping 18 | ~350ms |
| `blocked` / denied-after-proposal | lava-lamp spring (retreat) | stiffness 30, damping 24, mass 2.2 | ~450ms |

All three MUST honor `useReducedMotion` from framer-motion — when reduced motion is set, all variants degrade to opacity-only crossfade at 150ms.

The lava-lamp retreat is the load-bearing choice. springSnappy on a rollback reads as "this happened a second time, differently" — users interpret it as a new commit. The slow, heavy lava-lamp motion is unambiguously a retreat. Spring config lives in `packages/design-tokens/src/motion.ts` as `motion.governance.retreat`.

### Toast suppression rule

For high-frequency mutation surfaces where visual state IS the primary communication channel (schedule drag-drop is the canonical case), `applied` toasts are SUPPRESSED. The user sees the row commit visually via springSnappy motion; a toast adds noise without signal.

Toasts ARE reserved for:

1. **Off-canvas mutations** — the user is not looking at the row when it completes. Example: the user drags a shift, then scrolls to a different week before the mutation resolves; the toast confirms the write.
2. **`outcome: 'blocked'`** — the block must be surfaced; the user explicitly needs to know the action did not happen. Toast always.
3. **`outcome: 'proposed'`** — aggregated. A batch-proposed drag (e.g. swapping three shifts in a row) fires ONE strip toast: "3 endringer venter godkjenning" with a link to the proposals list. NOT one toast per event. Aggregation window: 2 seconds.

Surfaces adopting this contract opt in via a `surface.toastPolicy = 'visual-primary'` config on the TanStack mutation. Default remains `'all-outcomes'` for surfaces where toast IS the communication.

### Realtime reconciliation — out of scope

When a `proposed` row is approved or rejected via a separate UI (another user, a manager on mobile, a scheduled review), the schedule surface must reconcile — either commit the pending row or roll it back. That reconciliation is a Supabase Realtime concern and requires its own contract (subscription channels, conflict resolution, ordering guarantees). A dedicated ADR or spec will cover it before Wave 2C closes. This ADR establishes the visual and motion states; the realtime plumbing is a separate decision.

## Rules & Consequences

- **Good, because** the new token sits outside brand chroma, so pending rows are visually unmistakable without colliding with warning or destructive semantics.
- **Good, because** the mandatory "Venter" badge gives screen readers, color-blind users, and glanceability all the same non-color signal. The color is reinforcement, not the primary channel.
- **Good, because** the three-motion contract gives governance outcomes a dedicated motion language — commit feels like commit, retreat feels like retreat. springSnappy would have lied about rollbacks.
- **Good, because** toast suppression on drag-drop keeps the schedule surface usable under load while still surfacing denied and proposed states that matter.
- **Good, because** Wave 2C now has concrete visual, type, and motion contracts — design and implementation can proceed in parallel.
- **Bad, because** hue ~90 is close to some existing warning amber use in third-party dependencies; design QA must verify no visual collision on shipped surfaces. Mitigated by chroma/lightness being explicit enough that amber-adjacent third-party colors will read as different.
- **Bad, because** the toast-suppression rule is surface-specific, meaning two surfaces with similar mutation patterns may configure differently. Mitigated by `surface.toastPolicy` being an explicit config, reviewed in PR.
- **Bad, because** this ADR does not cover realtime reconciliation — the pending state is defined but the transition out of it (approved / rejected elsewhere) is deferred. This is a known gap; Wave 2C ships with the visual state only and a follow-up ADR addresses the realtime contract.
- **Agent Impact:**
  - Design-system maintainers MUST add `--color-proposed-*` tokens to all three token files (ts, css, native) in a single PR.
  - UI authors MUST render `<PendingBadge />` on any row with `pendingProposalId != null`. Dashed border alone does not satisfy the contract.
  - TanStack mutation authors on governance-gated surfaces MUST augment their optimistic row type with `pendingProposalId: string | null`.
  - Motion implementers MUST use the lava-lamp retreat spring for blocked/denied rollbacks on proposed rows — springSnappy is non-conforming.
  - Surfaces adopting optimistic governance-gated mutations MUST declare `surface.toastPolicy` explicitly. Default `'all-outcomes'` is the conservative choice; drag-drop surfaces opt in to `'visual-primary'`.
  - `useReducedMotion` compliance is mandatory; all three motion variants MUST degrade cleanly.
  - Realtime reconciliation is tracked separately — adopters of this ADR must confirm the realtime contract exists before production launch on surfaces where the pending state may persist across sessions.

---

> Registered in `docs/decisions/0000-decision-log.md`.
> Status: draft — promote to accepted when Wave 2C schedule TanStack migration closes and the token + motion + toast contracts are adopted.
> Depends on: ADR-0137 (stacking), ADR-0138 (tool result). Companion to a forthcoming realtime reconciliation ADR/spec.
