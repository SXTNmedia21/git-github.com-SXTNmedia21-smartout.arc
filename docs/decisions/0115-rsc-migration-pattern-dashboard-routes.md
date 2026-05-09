---
title: "RSC Migration Pattern for Dashboard Routes"
id: ADR-0115
status: accepted
layer: decision
created: 2026-04-16
updated: 2026-04-16
---

# ADR-0115: RSC Migration Pattern for Dashboard Routes — Streaming Boundary, Skeleton Pairing, Ambience Invariant

## Context and Problem Statement

Performance audit (2026-04-16) found that of 48 dashboard `page.tsx` files, a significant majority (27–36 depending on counting methodology) are marked `"use client"` on line 1–3. App Router is effectively being used as a SPA — every navigation re-mounts a client tree, hydrates, and then fires TanStack queries. Server Components and streaming are not being exercised.

The proposed remediation is to migrate dashboard routes to a Server Component `page.tsx` that fetches initial data, wraps in Suspense, and hands off to a single `<PageClient>` boundary. But migration without explicit rules risks: (a) accidentally moving orb/ambience JSX into server boundaries where it cannot run; (b) using cold shadcn default skeletons against the warm Nordic Split OKLCH surfaces; (c) Instrument Serif FOUT when heading chunks stream separately from font-swap moments; (d) breaking agent bridges (ScheduleVoiceToolsBridge, AgentProposalsProvider) by placing them outside their required provider boundaries.

## Decision Drivers

- Performance: exploit RSC streaming to deliver first HTML before client JS hydrates
- Design integrity: Nordic Split ambience (orbs, motion, glass) must remain choreographed — no cold skeleton flash, no Instrument Serif double-swap
- Agent architecture: voice session state, tool registration, and agent proposals must survive RSC boundary placement
- Migration safety: a consistent pattern is reviewable; ad-hoc migrations drift
- Scope discipline: `/dashboard/schedule` is explicitly excluded from the initial migration set (ADR-0032 local-state architecture + cross-route state push to header)

## Considered Options

1. **No pattern, let each route migrate organically.** Rejected: creates inconsistent Suspense placement, skeleton styles, and client-boundary locations.
2. **Strict pattern with no escape hatch.** Rejected: some routes have legitimately deep client-state needs (e.g., schedule reducer per ADR-0032).
3. **Canonical pattern with documented exceptions.** Chosen.

## Decision Outcome

**Chosen: Option 3 — canonical pattern for RSC migration, with explicit ADR-0032 exception and future-ADR exit path for other special cases.**

### Canonical structure

```
app/dashboard/<route>/
├── page.tsx                 # Server Component — fetches initial data, wraps Suspense
├── loading.tsx              # Server — NordicSkeleton matching route content shape
├── _components/
│   ├── <route>-client.tsx   # "use client" — the full interactive surface
│   ├── <route>-skeleton.tsx # Optional route-specific skeleton (if loading.tsx generic skeleton doesn't match)
│   └── ...
└── _actions/
    └── <route>-actions.ts   # Server Actions (ADR-0114)
```

### R1. Client boundary placement

- `page.tsx` is a Server Component. It fetches initial data via `createServerClient()` (cookie-backed, RLS-honoring) — verifies `x-workspace-slug` header, resolves profile, loads initial data.
- `page.tsx` renders EXACTLY ONE `<Suspense fallback={<RouteSkeleton />}>` boundary wrapping EXACTLY ONE `<PageClient data={...}>` child.
- `PageClient` is the sole Client Component — it owns all state, queries for incremental data, registers agent bridges, and renders interactive UI.
- Nested `"use client"` components inside `PageClient` are allowed and normal. The rule is one boundary per route, not one client component per route.

### R2. Ambience invariant

- **Route-level `page.tsx` is ambience-free.** No orbs, no glass panels, no noise overlay, no Framer Motion. These render ONLY inside `DashboardShell` (already Client, already ambience-owning).
- `PageClient` renders content surfaces ON TOP of the shell's ambience layer — it does not render new ambience.
- Enforcement: ESLint rule (follow-up) that warns on imports of `AmbientOrbs`, `NoiseOverlay`, or similar in files matching `app/dashboard/**/page.tsx` (the Server layer).

### R3. Skeleton pairing (NordicSkeleton primitive)

- `loading.tsx` uses `<NordicSkeleton>` primitive from `packages/ui/`, NOT shadcn's `Skeleton`.
- `NordicSkeleton` properties (binding from Designer, 2026-04-16):
  - `bg-muted` (token) at ~40% opacity
  - Warm gradient sweep (hue 55–60, chroma ≥ warm threshold per Nordic Split tokens) left-to-right at ~1.2s eased
  - Noise overlay at same opacity as real surface for seamless swap
  - Rounded corners + padding matching the real content
- Route-specific skeletons (e.g., `ChapterReaderSkeleton`, `ContractEditorSkeleton`, `CompetenceMatrixSkeleton`) replicate exact editor/table geometry — not generic rectangles.
- Skeleton-to-content swap uses Framer Motion spring (stiffness 280, damping 30 — Nordic Split motion token) with `initial={{ opacity: 0, y: 4 }}` → `animate={{ opacity: 1, y: 0 }}`. Duration ~220ms.

### R4. First-chunk heading rule

- For streamed pages, the first chunk MUST contain the route's primary heading (`h1` or equivalent). This prevents Instrument Serif FOUT from double-swapping as later chunks arrive.
- If a page's heading depends on streamed data, render a skeleton heading (matching Instrument Serif metrics) in the first chunk and swap to the real heading on data arrival. Do NOT leave the `<h1>` in a later chunk.

### R5. Agent bridge placement

- `ScheduleVoiceToolsBridge`, `AgentProposalsProvider`, and similar agent-coordination components MUST remain INSIDE `PageClient` — they cannot be moved to `page.tsx` (Server) because they hold client state and subscribe to agent events.
- Capability tools registered via `useRegisterTools()` continue to use the module-level singleton registry — no changes required.
- `BotssonProvider` continues to mount above the route boundary (at `dashboard/layout.tsx` level per ADR-0113) — unaffected by this ADR.

### R6. Initial data + realtime hand-off

- `page.tsx` fetches the initial snapshot via `createServerClient()`.
- `PageClient` receives initial data as prop and hydrates TanStack Query cache with it (e.g., `queryClient.setQueryData([...], initialData)`).
- Incremental queries run from client. Realtime subscriptions (if any) run from client.
- For routes with realtime subscriptions (shifts, messages): data may be stale between server render and first realtime tick. PageClient must handle "initial data + first realtime update" without UI jank.

### Exclusions from first migration set

- **`/dashboard/schedule`** — violates ADR-0032 local-state architecture (30+ reducer actions assume single client tree) AND pushes state up to DashboardContext (`setOnPublishAll`, `setScheduleDraftCount`). Requires separate ADR before migrating.
- **`/onboarding`** — brand-critical surface; explicitly out of scope (Designer binding).
- **`/Botsson` routes** — Botsson-native surfaces; different architecture.

### Approved first migration set (Sprint 2)

- `/dashboard/people`
- `/dashboard/handbook`
- `/dashboard/hms`
- `/dashboard/reports`

### Motion eager-load list (NEVER lazy)

- `DashboardShell` and children
- `AmbientOrbs` / noise overlays
- `AnimatedWizardShell` (onboarding — excluded anyway, listed for completeness)
- `WizardShell` transitions
- Sidebar open/close motion
- Top bar avatar/workspace switcher motion
- Botsson presence indicator (listening/fetching states — trust signals)

Safe to lazy: chart animations (Recharts), TipTap-internal (minimal motion), Year Wheel custom motion, one-off heavy animations behind tabs.

## Rules & Consequences

- **Good, because** RSC streaming delivers first HTML before client JS hydrates — measurable LCP/TTI improvement.
- **Good, because** server-rendered initial data skips the client mount → fetch round-trip waterfall.
- **Good, because** canonical pattern makes each route migration a template-application exercise, not a design decision.
- **Good, because** NordicSkeleton + motion entrance wrapper preserves Nordic Split brand invariant during loading states.
- **Good, because** explicit agent-bridge placement rule prevents regression of voice/tool registration during migration.
- **Bad, because** pattern adds file count per route (separate `page.tsx`, `loading.tsx`, `*-client.tsx`) — mitigated by consistency benefit.
- **Bad, because** the schedule exclusion leaves the heaviest dashboard route on the old pattern indefinitely — requires separate ADR to close.
- **Agent Impact:**
  - New dashboard routes MUST use this pattern from day one
  - Agents/developers migrating a route MUST consult `_components/` for agent bridge placement; moving them outside PageClient breaks voice/tool flows
  - NordicSkeleton + motion wrapper are hard prerequisites — a route with cold shadcn skeleton fails design review
  - `page.tsx` ambience-free rule applies — orbs/noise/glass go in `DashboardShell`, not routes

### Prerequisites

- NordicSkeleton primitive in `packages/ui/` — MUST land before any Sprint 2 route migration ships
- Framer Motion entrance wrapper pattern documented in `docs/design/motion.md`
- Geist Mono audit result (Designer — determines whether Geist Mono stays in root layout)

### Related ADRs

- ADR-0007 — Dashboard App Layout & Navigation State
- ADR-0019 — Performance and Build Governance — this ADR's patterns get enforced via perf-budgets.json (warn → fail transition)
- ADR-0021 — Subdomain-Based Workspace Routing — server page.tsx must honor `x-workspace-slug` via `createServerClient`
- ADR-0032 — Schedule Local-State Architecture — explicit exclusion ground for this ADR
- ADR-0113 — DashboardContext decomposition — Theme context hoist affects all RSC pages
- ADR-0114 — Server Actions as canonical mutation primitive — mutations called from `PageClient` route through Server Actions per 0114

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
