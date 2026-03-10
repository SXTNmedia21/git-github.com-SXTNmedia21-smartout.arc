---
title: Master Implementation Roadmap: Autonomy, Intelligence & Onboarding
status: proposed
created: 2026-03-06
owner: AI Architect
tags: [master-plan, roadmap, autonomy, onboarding, agent, ui]
---

# Master Implementation Roadmap: Autonomy, Intelligence & Onboarding

**Goal:** Unify the isolated system plans into a single, cohesive execution sequence. This roadmap takes Smartout from raw infrastructure up to a fully autonomous, context-aware AI agent guiding users through a data-enriched onboarding and hard-gated operational setup.

This plan integrates the Service Layer, Agent Profiles (Backend + UI), the Intelligence Pipeline, the Event Motor, and the Dashboard Setup Wizard.

---

## The Execution Sequence

### Phase 1: Platform Foundation & Services

**Source:** `2026-03-06-service-layer-plan.md`
**Objective:** Move all microservice and external API configurations (Serper, Brreg, Scraping, Stage Engine) out of hardcoded env vars into the database, controllable via Platform Admin.

- **Implementation:**
  - Migrate `service_config` table with Redis caching helper.
  - Build CRUD APIs for services and sync endpoints for Docker/Vercel.
  - Build Platform Admin Services UI.
- **📖 Documentation & Context Binding:**
  - **Link:** `CLAUDE.md` (Security Protocol) and `docs/protocols/SECURITY.md`.
  - **Instruct:** Do not store actual secret values in `service_config`. External secrets (e.g., `SERPER_API_KEY`) must use the `platform_external_secret` Vault wrappers. The UI should mask these.

---

### Phase 2: Agent Profile Backend & Context Collector

**Source:** `2026-03-07-agent-profile-implementation.md`
**Objective:** Give Mr. Botsson persistent DNA (voice, personality sliders) and relational memory per workspace/employee.

- **Implementation:**
  - Migrate `agent_profile` (DNA) and `agent_relationship` (Familiarity/Trust).
  - Build `collectContext()` pipeline in `packages/ai`.
  - Build posture resolver to dynamically alter prompt behavior based on relationship score and authority.
- **📖 Documentation & Context Binding:**
  - **Link:** `docs/engines/system-inteligence/02-agent-framework-runtime.md`.
  - **Instruct:** The `authority` parameter injected into the context collector must map perfectly to the System Intelligence runtime. Agent writes must carry provenance.

---

### Phase 3: Agent Profile UI & Management (New addition)

**Source:** Derived from System Intelligence Requirements
**Objective:** Allow Workspace Admins to configure and view their specific AI Agent (Mr. Botsson's local instance).

- **Implementation:**
  - Create `apps/web/src/app/dashboard/settings/agent/page.tsx`.
  - **Personality UI:** Sliders for Formality, Assertiveness, Warmth, Humor, Verbosity (0.0 to 1.0).
  - **Voice DNA UI:** Dropdown for Voice selection (e.g., "mark", "jessica"), Speed, and Temperature.
  - **Relationship Dashboard:** A view for admins to see how the agent perceives the team (aggregated from `agent_relationship`), showing overall sentiment and trust scores.
- **📖 Documentation & Context Binding:**
  - **Link:** `docs/engines/industri-inteligence/hospitalety/01-ai-council/restaurant-council.md`.
  - **Instruct:** Provide "Preset Buttons" in the UI that map the sliders to the AI Council personas (e.g., click "The Strict Head Chef" to set Formality to 0.8, Assertiveness to 0.9, Warmth to 0.2).

---

### Phase 4: Onboarding Intelligence Pipeline

**Source:** `2026-03-10-onboarding-intelligence-pipeline-design.md`
**Objective:** Turn a single user-provided URL into a fully populated workspace draft.

- **Implementation:**
  - Rewrite `gather-workspace-intelligence` Edge Function.
  - Sequence: Scrapling (Web content) -> Brreg Name Search (Fuzzy Match) -> Brreg Details (Legal/CEO) -> Serper.dev (News/Ratings).
- **📖 Documentation & Context Binding:**
  - **Link:** `docs/Roadmaps/Admin onboarding/Journey.md`.
  - **Instruct:** The output of this edge function must hydrate the "BigBoard" step defined in the Journey doc. If Serper.dev fails, the pipeline must degrade gracefully, not crash.

---

### Phase 5: Event Motor & Package Gating (R-001)

**Source:** `2026-03-06-three-engine-autonomy-r001.md`
**Objective:** Enforce that the onboarding journey cannot transition to "complete" unless all data, agent missions, and licenses are valid.

- **Implementation:**
  - Create `event_envelope` table for unified telemetry.
  - Implement API gates that check for Mission/License artifacts before allowing Journey status transitions.
  - Stage Engine checks gates before advancing stages.
- **📖 Documentation & Context Binding:**
  - **Link:** `docs/engines/system-inteligence/08-event-envelope-spec.md` & `09-gold-package-admin-onboarding.md`.
  - **Instruct:** Every transition in Phase 4 (Onboarding) and Phase 6 (Setup Wizard) MUST emit a canonical `event_envelope` payload. The shape is strict.

---

### Phase 6: Dashboard Setup Wizard & Interface States

**Source:** `2026-03-06-dashboard-setup-wizard-plan.md`
**Objective:** The post-onboarding handoff. Force admins to configure operational compliance before accessing the normal dashboard.

- **Implementation:**
  - Implement `interfaceState` (`NORMAL`, `FOCUS_SOFT`, `FOCUS_HARD`) in `WorkspaceContext` and `DashboardShell`.
  - Build the 4-step wizard container.
  - Wire Step 1 (Location Specifics) and Step 2 (Orientation) as a `FOCUS_HARD` gate.
  - Wire Step 3 (Staffing) and Step 4 (Training) as a `FOCUS_SOFT` gate.
- **📖 Documentation & Context Binding:**
  - **Link:** `docs/engines/industri-inteligence/hospitalety/02-default-policies/restaurant-policy-catalog.md` and `supabase/templates/restaurant/OVERVIEW.md`.
  - **Instruct:** The UI toggles in Step 1 (e.g., "Food Service" or "Fire Safety") must directly trigger the corresponding SQL templates in Supabase (e.g., `SELECT template_restaurant_mattilsynet('uuid')`). Do not hardcode policies in the frontend; drive them via the templates overview.

---

## Execution Strategy (How to build this)

We will execute this plan sequentially using the `executing-plans` and `subagent-driven-development` superpowers.

1. **Phase 1** is foundational (infrastructure config).
2. **Phases 2 & 3** establish the Agent's identity.
3. **Phase 4** builds the data-ingestion pipeline.
4. **Phase 5** establishes the state machine laws.
5. **Phase 6** consumes all of the above into the final user-facing wizard.
