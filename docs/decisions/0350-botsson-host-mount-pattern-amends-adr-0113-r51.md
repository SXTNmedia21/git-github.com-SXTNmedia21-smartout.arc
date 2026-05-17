---
title: "BotssonHost mount pattern — SSR-preserving provider scope, amends ADR-0113 R51"
id: ADR_0350
status: accepted
layer: decision
created: 2026-05-17
updated: 2026-05-17
accepted_at: 2026-05-17
implementation_commit: 04aa7e9e7
module: botsson
tags: [botsson, provider, ssr, adr-amendment]
---

# ADR-0350: BotssonHost mount pattern — SSR-preserving provider scope, amends ADR-0113 R51

> **Slot note:** ADR-0348 (collision-detector + two-hash-citation) and ADR-0349 (paragraph-ref translation map) were already claimed across branches at draft time. Advanced to ADR-0350 per L-0147 outsider-renumbers convention.

## Context and Problem Statement

ADR-0337 (commit `16b000387`) shipped `<DomainChatOwnership>` per ADR-0238 (Botsson Surface Disambiguation). Three dashboard pages mount it — `dashboard/komm/chat`, `dashboard/komm/thread/[id]`, `dashboard/shift-clock` — and all three threw `useBotsson must be used within <BotssonProvider>` at runtime today because `DashboardShell` did not wrap `{children}` in a `BotssonProvider`. The provider only existed inside `EmmaOverlay`, scoped to the Orb subtree. ADR-0238's ownership contract therefore had a no-provider audience for declarants living in `{children}`.

An in-place fix lifted `BotssonProvider` into a rewritten `EmmaOverlay` that wrapped both `{children}` and `BotssonShell`. Council R1 2026-05-17 reviewed and REVERSED the chair's Phase-3 verdict (8th L-0147 self-reversal precedent). Three reviewers (`supervisor`, `botsson-harness-builder`, `frontend-designer`) independently identified runtime regressions:

- Dashboard `{children}` became SSR-disabled because `EmmaOverlay` is loaded via `next/dynamic({ ssr: false })`. LCP regression rated HIGH.
- `apps/web/src/app/dashboard/help/_components/BotssonChatHero.tsx:30` mounts an inner `BotssonProvider`. Post-lift, it became a silent shadow of the outer provider — the ADR-0238 suppression contract breaks for hero-internal consumers with no error surface.
- `EmmaOverlay` suffered name-vs-purpose drift: an overlay component became a content-scope owner.

ADR-0113 §R51 originally mandates: *"BotssonProvider mounts ABOVE the dashboard shell refactor boundary."* The in-place lift violated this rule even before runtime considerations.

## Decision Drivers

- SSR preservation for dashboard `{children}` (required by App Router RSC streaming pattern; LCP-sensitive)
- Single `BotssonProvider` instance visible to both the Orb subtree and any `DomainChatOwnership` declarants in `{children}` (ADR-0238 contract)
- Naming clarity: scope-owner component vs visual-surface component must be distinct
- Provider mount as high as practical without breaking the SSR boundary or forcing a larger shell refactor

## Considered Options

1. **Solution A — ship the in-place lift** (EmmaOverlay wraps both Orb and children). REJECTED: SSR regression for all dashboard pages + nested-provider silent break in `BotssonChatHero.tsx:30`.
2. **Solution B — ship A + register ADR-0338 amendment only** (paper over with doc). REJECTED: runtime regressions remain unaddressed; ADR-0113 §R51 violated with no compensating mechanism.
3. **Solution C — split `BotssonHost` (sync, SSR-safe) from `EmmaOverlay` (dynamic, Orb-only).** CHOSEN: keeps Orb chunk async without forcing children into client-only render path.
4. **Solution D — hoist `BotssonProvider` to `dashboard/layout.tsx`** (strict ADR-0113 §R51 compliance). DEFERRED: larger refactor; current 5-provider nesting in `DashboardShell` is established for orthogonal reasons; revisit when next provider-topology council convenes.

## Decision Outcome

Chosen option: **Solution C**, because it preserves SSR for dashboard `{children}`, honors ADR-0238's single-provider-instance contract, and resolves the name-vs-purpose drift without a shell-wide refactor.

Implementation:

- Introduce `apps/web/src/app/Botsson/_components/BotssonHost.tsx` as the canonical provider-scope wrapper. Sync component, SSR-safe.
- Reduce `EmmaOverlay` back to Orb-only responsibility (still loaded via `next/dynamic({ ssr: false })`).
- `DashboardShell` at line 1778 wraps as: `<BotssonHost>{children}<EmmaOverlay /></BotssonHost>`.
- Setup-page early-return at `DashboardShell.tsx:1112-1124` intentionally bypasses `BotssonHost` (no workspace context yet); future setup-page consumers needing `DomainChatOwnership` must declare a local `BotssonProvider`.
- Remove the nested `BotssonProvider` in `BotssonChatHero.tsx:30` in the same PR (Track B) — it is now redundant and was always a latent shadow.

## Amendment to ADR-0113

§R51 is RELAXED as follows: `BotssonProvider` MAY mount inside `DashboardShell` via the `BotssonHost` wrapper, provided that (a) the wrapper is SSR-safe (no `next/dynamic` and no `ssr: false`), and (b) it remains the sole provider instance reachable by both `{children}` and `<EmmaOverlay />`. The strict-above-shell requirement is upheld wherever SSR or remount-survival behavior would otherwise break — re-evaluate at the next provider-topology council.

## Rules & Consequences

- **Good, because** SSR is restored for dashboard `{children}` (no LCP regression); ADR-0238 ownership contract is honored end-to-end; component naming aligns with responsibility (Host = scope, Overlay = surface).
- **Bad, because** ADR-0113 §R51 now carries a documented exception that future readers must trace; any future mount-topology change must reason across `BotssonHost.tsx`, `DashboardShell.tsx:1778`, and `EmmaOverlay.tsx` together rather than treating any one in isolation.
- **Agent Impact:** When adding any `useBotsson()` consumer under `dashboard/`, verify the consumer renders inside `BotssonHost`. When mounting a nested `BotssonProvider` (e.g. setup-page, embedded preview, isolated test surface), document the reason in-place and link this ADR — nesting is now silent-break territory.

## Follow-ups

- **Track B (same PR):** remove redundant `BotssonProvider` in `BotssonChatHero.tsx:30`.
- **Track E (same PR):** Playwright regression spec covering (1) throw-free mount on the three affected pages, (2) SSR-rendered HTML present in initial response for dashboard `{children}`.
- **L-0289 (new learning):** "context-hook consumer merges must verify provider-ancestor chain at runtime, not just at typecheck." File under `docs/learnings/` when the sortie closes.
- **Future:** if a third nested-provider case appears, escalate to Solution D (layout hoist) via council.

## References

- ADR-0113 — DashboardShell refactor boundary (amended by this ADR §R51 only)
- ADR-0238 — Botsson Surface Disambiguation (DomainChatOwnership contract)
- ADR-0337 — DomainChatOwnership enforcement build (commit `16b000387`)
- L-0147 — outsider-renumbers + chair self-reversal precedent
- Implementation commit: TBD (this sortie)

---

> Registered in `docs/decisions/0000-decision-log.md`. Council R1 2026-05-17.
