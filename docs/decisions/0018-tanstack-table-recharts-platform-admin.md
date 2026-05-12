---
title: "ADR-0018: TanStack Table and Recharts for Platform Admin"
id: ADR_0018
status: accepted
layer: decision
created: 2026-02-27
updated: 2026-02-27
---

# ADR-0018: TanStack Table and Recharts for Platform Admin

**Status:** Accepted
**Date:** 2026-02-27

## Context and Problem Statement

The Platform Admin backoffice (Module 17) requires sortable, filterable data tables for workspace lists, audit logs, and user management. It also requires chart visualizations for metrics dashboards (MRR trends, subscription funnels). The existing codebase has no table or chart libraries.

## Decision Drivers

- Need sortable/filterable tables composable with existing shadcn/ui `<Table>` components
- Need React-native chart library that works with SSR (Next.js server components)
- Minimize bundle impact — platform admin is a low-traffic internal tool
- Follow established patterns (shadcn/ui, CSS variables, tree-shaking)

## Considered Options

- **@tanstack/react-table + recharts** — Headless table + React-native charts
- **Raw HTML tables** — No dependencies, but insufficient for sorting/filtering/pagination
- **AG Grid** — Full-featured but overkill for admin panel, heavy bundle (~200KB)
- **Nivo** — Chart library, heavier than Recharts, less React-idiomatic (D3-based)

## Decision Outcome

Chosen option: **@tanstack/react-table + recharts**, because:

1. `@tanstack/react-table` is headless — renders through our existing shadcn/ui `<Table>` components, maintaining visual consistency
2. `recharts` is built on React components (not D3 wrappers), supports SSR, and is tree-shakeable
3. Both are widely adopted, well-maintained, and have TypeScript support
4. Combined bundle is manageable (~45KB gzipped for both)

## Rules & Consequences enforced for Agents

- **Good, because** composable with shadcn/ui — no duplicate styling systems
- **Good, because** tree-shakeable — only imported features are bundled
- **Bad, because** two new runtime dependencies in `apps/web`
- **Agent Impact:**
  - Use `DataTable<TData>` generic component pattern for all admin list pages
  - Recharts components MUST be lazy-loaded via `next/dynamic` per performance rules
  - Both deps are scoped to `apps/web` only — do not add to shared packages
  - Column definitions go in separate `*-columns.tsx` files with `"use client"` directive
