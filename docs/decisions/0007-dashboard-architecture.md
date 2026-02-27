# ADR-0007: Dashboard App Layout & Navigation State

## Status

Accepted

## Date

2026-02-24

## Context

Smartout requires a dynamic layout tailored to distinct operational and administrative roles as defined in `docs/architecture/SMARTOUT_UI_ARCHITECTURE.md`. We needed a highly scalable structural layout that could flip between "Admin Mode" and "Employee Mode" seamlessly while keeping relevant context—such as the Active Workspace, Season, and logged-in user profile—fixed in place.

## Decision

Instead of creating distinct page trees for Admin vs. Employee, we decided to handle the primary Dashboard structure through a unified client wrapper in `apps/web/src/app/page.tsx` during this rapid UI iteration phase.

The layout adopts the following structural components:

1. **Top Context Bar:** High-level details indicating real-world operational parameters (Location/Workspace, Global Active Season status, Theme switcher).
2. **Left Sidebar Navigation:** Contains the Smartout logo and mode-dependent routing links. It employs an `activeTab` state and dynamic list rendering conditioned upon an `isAdminMode` flag.
3. **Action Bar:** Sits atop the main working area, feeding dynamically from `activeTab` to display the active location context and search parameters.
4. **Main Content Area:** Designed to dynamically switch components based on `activeTab` via a helper function (`renderMainContent`).

## Rationale

- **Flexibility for Development:** Conditionally rendering placeholder states via `renderMainContent()` prevents empty routing screens and allows us to visualize real content bounds before committing to complex file-based router setups.
- **Unified Context:** Keeping the Top Context Bar entirely detached from the side navigation prevents the Workspace/Season selector from shifting or reloading when navigating.
- **Responsive Scalability:** Mode switching via the unified client shell acts as a structural mock pattern. Long-term, this `isAdminMode` boundary maps natively to Supabase Roles, paving the way for eventual React Server Components layout protection without reworking the UI paradigm.

## Consequences

- Requires porting the monolithic draft file (`page.tsx`) into modular React components (`<Sidebar />`, `<ContextBar />`, `<DashboardShell />`) in the future to keep the file size manageable.
- We must make sure that `activeTab` URL persistence is solved (via query params, `useRouter`, or `next-nuqs`) when we graduate this code from draft UI to a stable production routing layer.
