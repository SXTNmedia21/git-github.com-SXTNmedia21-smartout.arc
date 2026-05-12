---
title: "Dynamic Landing Engine — Supersedes Block-based Builder"
id: ADR_0064
status: accepted
layer: decision
created: 2026-03-28
updated: 2026-03-28
supersedes: ADR_0046
tags: [landing, personalization, scroll, i1, architecture]
---

# ADR-0064: Dynamic Landing Engine

## Context and Problem Statement

ADR-0046 established a block-based page builder with `landing_variant` + `landing_block` tables and 15 block types rendered via `BlockRenderer.tsx`. The intent was admin-editable landing pages.

In practice, the main landing page (`VariantMLanding.tsx`, ~5700 lines) was never migrated to the block system. The block infrastructure exists in the database but is not the rendering path for the primary conversion page. Meanwhile, the business need has evolved:

1. **Personalization** — The landing page must dynamically adapt to industry (restaurant, hotel, cafe, bar) and visitor persona (owner, manager, HR, ops)
2. **Interactive scoring** — Soft-gate retrievers collect visitor signals (industry, pain points) and score them with diminishing weights to drive section ordering
3. **I1 integration** — All industry/persona/pain data must come from the Industry Intelligence layer, not be maintained separately
4. **Parallax scroll** — Three-layer depth system (L0 background, L1 sections, L2 floating) with Framer Motion scroll-linked animations
5. **Algorithm-driven content** — Action Grid shows top 6 of 12 actions, sorted by weighted dot-product scoring against visitor profile

The block-based builder cannot deliver this. Blocks are static content containers — they have no concept of visitor profiling, scoring, conditional rendering, or I1 data consumption.

## Decision Drivers

- Landing page is a conversion engine, not a CMS page
- All industry data must flow from I1 (single source of truth)
- Visitor profile scoring requires a state machine with retriever gates
- Parallax and scroll animations require programmatic control
- Admin editability of section ORDER and CONTENT remains important (via `landing_config` JSONB)
- Performance: all sections in DOM at mount, zero network latency for variant swaps

## Considered Options

1. **Extend ADR-0046 block builder** — Add personalization, scoring, and I1 integration to existing block system
2. **Dynamic Landing Engine** — New section-based architecture with Presenter/Retriever/Redirecter types, I1 consumption, and scroll system
3. **Hybrid: blocks for static pages, engine for main landing** — Keep both systems

## Decision Outcome

Chosen option: **"Dynamic Landing Engine"** (option 2), because:

- The block system's strength (admin drag-and-drop) is not needed for the main conversion page — it needs programmatic control
- Adding scoring, profiling, and I1 integration to the block system would make blocks do two fundamentally different things
- Option 3 (hybrid) creates maintenance burden with two rendering systems for the same domain

### What happens to ADR-0046 infrastructure

| Asset                                     | Fate                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `landing_config` table                    | **Kept** — stores PageConfig JSONB for section engine                                     |
| `landing_config_version` table            | **Kept** — versioning for A/B testing                                                     |
| `landing_variant` table                   | **Deprecated** — replaced by I1 industry profiles + VisitorProfile                        |
| `landing_block` table                     | **Deprecated** — replaced by section components                                           |
| `landing_block_type` enum                 | **Deprecated** — replaced by Presenter/Retriever type system                              |
| `landing_media` table                     | **Kept** — media assets still needed                                                      |
| `landing_visitor` table                   | **Kept** — visitor tracking, potentially connected to VisitorProfile                      |
| `landing_waitlist_submission` table       | **Kept** — independent of rendering                                                       |
| `BlockRenderer.tsx` + 15 block components | **Frozen** — not deleted, but no new development. Available for secondary pages if needed |
| `block-schemas.ts`                        | **Frozen** — Zod schemas kept for reference                                               |

Deprecated tables are not dropped immediately. They are frozen (no new writes) and will be cleaned up when confirmed unused.

## Architecture Summary

See full spec: `docs/superpowers/specs/2026-03-28-dynamic-landing-engine-design.md`

**Three section types:**

- **Presenter** — Renders content variant based on visitor profile
- **Retriever** — Sticky soft-gate that collects visitor data (industry, pain scores)
- **Redirecter** — Assembler logic that skips/injects/reorders sections

**Data flow:** I1 Industry Intelligence → LandingIntelligence adapter → Section content. Landing engine NEVER owns industry data.

**Config:** TypeScript types define the shape (`PageConfig`, `PresenterConfig`, `RetrieverConfig`). Database (`landing_config.config_json`) stores the content. Zod validates at write time.

**Scroll:** Framer Motion primary (useScroll/useTransform for parallax). GSAP ScrollTrigger conditional — only if FM prototype proves insufficient for pin/scrub (requires separate ADR with evidence).

**Telemetry:** Landing events continue via existing `useTracking` → `landing_event` table pattern. Migration to `@smartout/telemetry` `emit()` is documented tech debt, not blocking.

## Rules & Consequences

- **Good, because** landing page becomes a true conversion engine with personalization
- **Good, because** all industry data flows from I1 (no duplication)
- **Good, because** admin can still edit section order and content via `landing_config` JSONB
- **Good, because** existing `landing_config` tables are reused (no new tables needed)
- **Bad, because** admin drag-and-drop block editing is lost for the main landing page
- **Bad, because** block infrastructure is frozen but not removed (mild code surface bloat)
- **Agent Impact:** Never use `BlockRenderer` or `landing_block` for the main landing page. All new landing work uses the section engine in `components/engine/` + `components/sections/`. Content comes from I1 via `i1-adapter.ts`. Types live in `apps/landing/src/lib/types.ts` (not `packages/types/`).

---
