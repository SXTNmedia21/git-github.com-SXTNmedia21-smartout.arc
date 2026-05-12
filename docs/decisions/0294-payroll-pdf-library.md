---
title: "ADR-0294: PDF library for Payroll Lønnsgrunnlag generation"
id: ADR-0294
status: accepted
layer: decision
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [payroll, pdf, lonnsgrunnlag, phase-4]
---

# ADR-0294: PDF library for Payroll Lønnsgrunnlag generation

**Status:** Accepted
**Date:** 2026-05-08

## Context and Problem Statement

Phase 4 of the Payroll Engine introduces per-employee PDF lønnsgrunnlag (wage basis document). We need to generate server-side PDF files from typed payroll calculation rows — the same `AggregateRow` data that drives CSV export. The library must:

- Run server-side (Node.js) without a headless browser
- Produce deterministic output (same input → same SHA-256) for audit-replay
- Support JSX-based templating to reuse familiar React patterns
- Fit a receipt/letter layout (not a data-visualization or video use case)
- Work in the existing `@smartout/payroll-export` package (TypeScript ESM)

## Decision Drivers

- No headless browser in production — Puppeteer/Playwright add 200 MB+ and require a running Chromium process
- Deterministic SHA-256 footer: PDF bytes must be stable across renders with identical input (excluding timestamps — caller must freeze `generatedAt` for test stability)
- JSX familiarity: same mental model as React components already used throughout the monorepo
- Scope: receipt-style layout (portrait A4, 3-5 tables, no charts) — does not require full CSS support
- Package size: must not bloat the edge runtime

## Considered Options

1. **@react-pdf/renderer** — JSX React components compiled to PDF via custom renderer; renders server-side via `renderToBuffer`; no browser dep; active community; ~1.5 MB bundle
2. **Puppeteer / Playwright** — headless Chromium renders HTML → PDF; full CSS support; ~200 MB+ process dep; non-deterministic timestamps in PDF metadata; not suitable for serverless/edge
3. **pdfkit** — procedural imperative API; no JSX; requires manual coordinate calculation for tables; steep maintenance cost for multi-section documents
4. **Remotion** — video-first renderer; PDF export is not the primary use case; overkill and adds heavy ffmpeg dep

## Decision Outcome

**Chosen: @react-pdf/renderer**

JSX-based templates live in `packages/payroll-export/src/pdf/` as React components. The top-level document (`LonnsgrunnlagDocument.tsx`) composes sub-components (Header, EmployeeBlock, HoursTable, SupplementsTable, TipsTable, TotalsBlock, Footer). Server-side rendering uses `@react-pdf/renderer`'s `renderToBuffer` API from the Node.js module path. No headless browser is introduced.

### Consequences

**Positive:**
- Deterministic PDF bytes when caller freezes `generatedAt` in options
- JSX templating means component structure is readable and testable
- Zero headless-browser dependency
- SHA-256 can be computed over output buffer for audit-trail linkage
- Works in Next.js API routes and standalone Node services

**Negative:**
- CSS subset only: no `gap` (use `margin` instead), no CSS Grid, no `position: fixed`
- Fonts must be embedded or loaded from a URL — system fonts not available server-side (we use built-in Helvetica for now; custom font can be added later)
- `@react-pdf/renderer` uses `react` peer dep — the package bundles its own reconciler; no conflict with app React versions but requires `react` as a peer dep in `package.json`

### Constraints adopted

- PDF components use inline styles only (no Tailwind, no CSS variables — translate Nordic Split brand colors to OKLCH hex/rgb for the few brand-color uses)
- `generatedAt` in PDF metadata is passed as a parameter (not `new Date()` inside the component) so tests can fix the timestamp for SHA-256 stability
- PDF footer includes a 16-char SHA-256 prefix (full hash in PDF `Keywords` metadata) as Bokføringsloven §13 traceability anchor
- Templates live in `packages/payroll-export/src/pdf/` — Wave B capability tool and Wave C BFF route import the `generateLonnsgrunnlagPdf` and `generateBundlePdfs` functions from `pdf.ts`

## References

- `packages/payroll-export/src/pdf.ts` — entry point implementing this ADR
- `docs/plans/PLAN-payroll-phase-4.md` §A
- ADR-0057 — Payroll Engine origin
- ADR-0292 / ADR-0293 — Payroll Phase 2+3 architecture
- Bokføringsloven §13 — audit traceability requirement for SHA-256 footer
