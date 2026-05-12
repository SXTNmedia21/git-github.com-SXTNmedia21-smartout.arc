---
title: "ADR-0030: Documentation System in Landing App (Nextra Removal)"
id: ADR_0030
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0030: Documentation System in Landing App (Nextra Removal)

## Context and Problem Statement

Smartout needs customer-facing documentation. ADR-0025 scaffolded a separate Nextra v4 app at `apps/docs/` for a public docs site (docs.smartout.ai). Meanwhile, the landing app (`apps/landing/src/app/docs/`) already had a fully-featured documentation system with 10 module pages, custom component library, sidebar with search, breadcrumbs, AI docs agent, and a 50KB API reference page. Two competing systems existed — neither complete, causing confusion about where new docs content should go.

## Decision Drivers

- Landing docs have 10 real pages with brand-matched styling and full component library
- Nextra app had only stub pages ("Coming soon") with zero custom styling
- Nextra app was never deployed (excluded from CI, Vercel, and `.vercelignore`)
- Maintaining two docs systems doubles effort for styling, navigation, and content
- Landing docs already deploy automatically via the existing Vercel project
- AI docs agent is already integrated in the landing docs

## Considered Options

1. **Expand landing app docs** — add audience grouping, employee pages, content lifecycle
2. **Build out Nextra app** — migrate content, add branding, set up new Vercel project
3. **Keep both** — landing for marketing docs, Nextra for technical docs

## Decision Outcome

Chosen option: **"Option 1 — Expand landing app docs"**, because the landing docs system is already production-quality with extensive infrastructure. Building a separate Nextra app would duplicate all branding, navigation, and deploy configuration for no benefit.

### Actions taken

- Deleted `apps/docs/` (Nextra scaffold)
- Marked `docs/architecture/SMARTOUT_docs_NEXTRA_architecture.md` as superseded
- Accepted `docs/plans/2026-02-28-docs-nextra-system.md` (landing-first expansion plan)
- Updated ADR-0025 to note the Nextra scaffold removal

## Rules & Consequences

- **Good, because** all customer docs live in one place (`apps/landing/src/app/docs/`)
- **Good, because** docs deploy with the existing landing Vercel project — no new infra needed
- **Good, because** custom component library (DocsArticle, InfoBox, Step, etc.) is already built
- **Bad, because** content is JSX (not MDX) — harder for non-developers to author
- **Agent Impact:** Never reference `apps/docs/` — it no longer exists. All documentation work targets `apps/landing/src/app/docs/`. Navigation data lives in `_data/navigation.ts`.
