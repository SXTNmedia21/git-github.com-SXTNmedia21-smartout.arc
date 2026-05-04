---
title: User Journeys — Contract Hub Redesign
status: verified
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [contracts, ia, hub, tabs, nordic-split, journey]
verified_by: council-gate-3 2026-04-22
verified_note: Implementation live on feat/contract-hub-redesign; E2E spec exists (apps/e2e/tests/contracts/hub-redesign.spec.ts). Post-merge E2E re-run pending per L-0107.
---

# User Journeys — Contract Hub Redesign

> Council 2026-04-22 resolution: tabs-in-hub IA replaces split ops/setup. `/dashboard/contracts` becomes the single entry point for all contract-related work for workspace admins. `/settings/contracts` is retired. The hub carries three tabs (`Kontrakter | Maler | Bindinger`) with role-gated visibility, an ambient Botsson chip, and drawer-based composition that replaces the retired `/dashboard/contracts/new` route.

## Roles

- **Admin / Owner** — full access to all three tabs + CTAs
- **Manager** — read-only access to `Kontrakter` tab; `Maler` and `Bindinger` tabs hidden
- **Employee** — never sees this hub; their surface is `/dashboard/my-contract`
- **Platform Admin (Pontus)** — also sees workspace hub for any workspace (impersonation scope); primary curation surface is `/platform-admin/contracts/templates` (see `JOURNEY-platform-k1a-curation.md`)

---

## Journey 1: Admin lands on the contracts hub

**Precondition:** Admin or owner is logged in; at least one contract exists or at least one K1a system template is available.

1. Admin navigates to `/dashboard/contracts` (sidebar entry `Kontrakter`)
   → System renders the hub page with Instrument Serif heading `Kontrakter` and Geist Sans muted subtitle `Administrer maler og send kontrakter til dine ansatte`
   → Ambient orb renders low-right (hue 50, 25% opacity, radial-gradient)
   → Tab bar renders: `Kontrakter | Maler | Bindinger` — no card wrapper, 2px underline on active tab
   → Default active tab = `Kontrakter`
2. Page fetches via `useEmploymentContracts` TanStack hook
   → Bucket counts computed client-side: `ready_for_action`, `waiting_employee`, `completed`
   → Tab sub-badges render counts in muted pill style
3. Ambient `Spør Botsson` chip renders bottom-right, hue 40 glow pulse every 4s
   → `primeContext` pre-set to `{ module: "contracts", scope: "hub" }`
4. Primary CTA `Lag kontrakt` renders top-right of active tab, brand hue 40 fill
   → Secondary CTA `Lag med Botsson` is removed per council Q3 resolution

**Postcondition:** Admin sees the hub with current contract state and three clear navigation paths. No render stall (virtualization + spring tuning prevent the old wizard-page lag).

**Error paths:**
- Hub fetch fails: skeleton renders first, then warm-pulse empty state `Ingen kontrakter ennå`
- No K1a templates AND no K1b templates: Maler tab shows curated catalog preview (see Journey 3)
- Non-admin profile arrives at hub: only `Kontrakter` tab visible, CTA disabled with tooltip `Kun admin og eier kan lage kontrakter`

---

## Journey 2: Admin switches between tabs

**Precondition:** Admin is on the hub.

1. Admin clicks `Maler` tab
   → Tab indicator slides with spring (stiffness 35, damping 22, mass 2.2) ~600ms
   → Content area fades at 250ms exit, 500ms entrance spring
   → URL updates to `/dashboard/contracts?tab=maler` (deep-linkable)
2. Admin clicks `Bindinger` tab
   → Same spring animation
   → URL updates to `/dashboard/contracts?tab=bindinger`
3. Admin presses browser back
   → Returns to previous tab via URL state (not local component state)

**Postcondition:** Tab deep links work. URL reflects current tab. Browser history respects tab switches.

**Error paths:**
- Unknown tab param: falls back to `Kontrakter`
- Tab query param mutated by user to `maler` while user is non-admin: server-side guard redirects to hub default

---

## Journey 3: First-run empty state on Maler tab

**Precondition:** Admin has workspace with no K1b templates (fresh workspace).

1. Admin clicks `Maler` tab
2. Empty state renders: Instrument Serif `Start fra Smartouts bibliotek` + Geist Sans `Maler bygget for bransjen din, tilpasset dine regler`
3. Below heading: curated vertical list of K1a system templates filtered by workspace industry (hospitality)
   → Each row: Instrument Serif name + Geist Sans one-line description + Geist Mono metadata (`12 klausuler · Dekker Riksavtalen § 4–7`)
   → Hover lifts row to `bg-muted` with 250ms ease
   → Right-aligned `Bruk denne` button reveals on hover, brand fill
4. Admin clicks `Bruk denne` → see `JOURNEY-workspace-template-fork.md` for the clone flow

**Postcondition:** Admin is guided into the K1a catalog without dead-end empty state.

**Error paths:**
- No K1a industry templates for this workspace's industry: shows generic "Alle industrier"-fallback list
- K1a fetch fails: skeleton → retry button

---

## Journey 4: Ambient Botsson chip invocation

**Precondition:** Admin is on any tab of the hub.

1. Admin clicks the `Spør Botsson` chip bottom-right
   → Chip fires `botsson:open` CustomEvent with `primeContext = { module: "contracts", scope: "hub" | "templates" | "bindings" }` depending on active tab
   → `BotssonProvider` listener consumes event (`apps/web/src/app/Botsson/_components/BotssonProvider.tsx:874`)
   → Botsson side panel slides in from the right
2. Botsson receives `primeContext` via `BotssonChat` → `POST /api/botsson/chat`
   → Stage engine routes intent through `contract` capability (chat-channel only, per ADR-0078)
   → Botsson presents module-scoped greeting
3. Admin types question (e.g. "hvor mange kontrakter venter på signering?")
   → Read-only tools (`list_employee_templates`, `get_contract_status`) answer without mutation
4. If admin asks to create a contract, Botsson surfaces `createEmployeeContract` at `suggest` authority level
   → Admin confirms in UI → tool calls `POST /api/employment-contracts`
   → Contract created, CompositionDrawer opens automatically with the new draft (reverse flow hand-off)

**Postcondition:** Botsson is ambient, reachable, and context-aware. It never replaces direct CTAs; it augments them.

**Error paths:**
- Botsson surface unavailable: chip disabled with tooltip `Botsson er ikke tilgjengelig akkurat nå`
- Authority level too low (read_only): `createEmployeeContract` not surfaced; Botsson explains and points to primary CTA
- primeContext missing `profileId` on hub-scope invocation: Botsson asks "for hvilken ansatt?" — by design, hub-scope is employee-agnostic

---

## Journey 5: Reverse flow from employee detail

**Precondition:** Admin is on `/dashboard/employees/[id]` for a specific employee.

1. Admin clicks `Lag kontrakt` button in the employee detail page header
   → System navigates to `/dashboard/contracts?open=compose&profileId=[id]`
   → Hub mounts with `Kontrakter` tab active
   → `CompositionDrawer` auto-opens with step 1 (Ansatt) pre-filled with the employee
2. Admin continues composition per `JOURNEY-contract-composition-engine.md`

**Postcondition:** Admin can launch composition from context (employee page) without losing scope.

**Error paths:**
- `profileId` invalid: drawer opens at step 1 empty, toast `Kunne ikke finne ansatt`
- Admin lacks role: drawer refuses to open, toast `Kun admin og eier kan lage kontrakter`

---

## Cross-cutting concerns

### Retired routes

- `/dashboard/contracts/new` — 410 Gone; deep links redirect to `/dashboard/contracts?open=compose`
- `/dashboard/settings/contracts` — 404; settings tab `contract-templates` is removed (see `JOURNEY-contract-system-phase2-3.md` for bindings move)

### Nordic Split visual contract

- Background: `bg-background` with single ambient orb low-right (hue 50, 25% opacity)
- Tabs: no card wrapper, 2px underline, spring-animated indicator
- List rows: typography-led, 1px `border-border` divider, hover to `bg-muted`
- CTAs: brand hue 40 fill, `scale(0.96)` on press with 100ms spring
- Fonts: Instrument Serif for heading, Geist Sans for body, Geist Mono for metadata
- No hardcoded `zinc-*` / `gray-*` anywhere — CSS variables only

### Role-based tab visibility

| Role | Kontrakter | Maler | Bindinger | CTA `Lag kontrakt` |
|------|-----------|-------|-----------|---------------------|
| Owner | ✓ | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ |
| Manager | ✓ (read) | — | — | disabled |
| Employee | — | — | — | — |

### Telemetry

- `contract.hub_viewed` (new) — emitted on hub mount with `tab`, `workspace_id`, `actor_id`
- `contract.tab_switched` (new) — emitted on tab click with `from`, `to`
- `contract.botsson_chip_invoked` (new) — emitted when ambient chip fires `botsson:open`

All three events need to be registered in `packages/telemetry/src/registry.ts` before the hub ships (Gate G2 from council verdict).

### Known debt

- Mobile hub layout not yet designed — ADR-0133 keeps authoring on web, mobile executes only. Mobile gets a read-only status tile on dashboard, no tabs.
- Tab deep linking via query param not via path segments — revisit if the hub grows to 5+ tabs.
