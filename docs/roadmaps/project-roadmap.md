# Smartout Roadmaps

This document maintains the high-level roadmap and architectural milestones for the Smartout Engine rewrite.

## Phase 1: Foundation (Currently Active)

- **Status:** In Progress
- **Goal:** Monorepo scaffolding, Document boundaries, Rules definition.
- **Milestones:**
  - [x] Initialize Git standard repository and Turbo/pnpm schemas
  - [x] Establish `GEMINI.md` as the Agentic Law
  - [x] Establish Decision Logs (ADR)
  - [ ] Port existing modules into Types/Supabase abstractions

## Phase 2: Platform Primitives & The Brain (Active)

- **Status:** In Progress
- **Goal:** Connect Next.js 14 and React Native to the new data model.
- **Milestones:**
  - [x] Implement strict Types package.
  - [x] Scaffold UI package with shadcn.
  - [x] Base Auth, Roles, Workspace Context via Layouts.
  - [ ] Supabase Edge Functions mapping for atomic operations.

## Phase 3: Domain Implementation (Onboarding, Org, Operations)

- **Goal:** Implement the modules detailed in `docs/modules/`.
- **Milestones:**
  - [ ] Org Structure (Locations, Zones, Departments, Roles)
  - [ ] Onboarding & Trainee sandbox mapping
  - [ ] Core UI rendering of the Department Sessions logic.

## AI Generation Strategy

- Agents (Gemini/Claude) must refer to ADRs and Module Docs.
- Agents must operate on one logical PR at a time (e.g., `feature/0001-scaffold-auth`).
