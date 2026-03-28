---
title: "Design: Context Handshake — Industry + System Intelligence Tables"
status: draft
updated: 2026-03-06
created: 2026-03-06
module: platform
tags: [design, context, industry, system-intelligence, playpark, schema]
---

# Design: Context Handshake

## Problem

The AI layer (packages/ai) cannot access industry or system intelligence at runtime. The three intelligence layers are:

1. **System Intelligence** — pages, functions, capabilities, context layers (exists in code, not queryable)
2. **Artificial Intelligence** — posture, intent, memory, prompt builder (implemented, but missing domain input)
3. **Industry Intelligence** — hospitality defaults, niches, roles, environment, policies (exists in docs only)

The context collector (`packages/ai/src/context/collector.ts`) covers layers 1 (identity, partial) and 4 (memory, basic) of the 5-layer context contract. Layers 2 (session), 3 (domain), and 5 (execution) are missing or indirect.

## Solution

- 9 database tables (5 industry + 4 system) with seed data for hospitality
- A "Context Handshake" tab in the EnginePlaypark that visualizes how the three layers compose
- API docs updated with new table definitions

## Approach

**Option 3: Schema + seed now, wire later.** Migrations and seed SQL go in. Runtime wiring (collector.ts, prompt-builder.ts changes) is a separate task. Playpark uses seeded data as static constants initially.

---

## Schema: Industry Intelligence (5 tables)

### `industry_vertical`

Top-level industry classification. Named `industry_vertical` to avoid collision with existing `industry` enum on `company` table.

| Column                 | Type        | Description                  |
| ---------------------- | ----------- | ---------------------------- |
| `industry_vertical_id` | uuid PK     |                              |
| `code`                 | text UNIQUE | `'hospitality'`              |
| `display_name`         | text        | `'Hospitality & Restaurant'` |
| `description`          | text        |                              |
| `created_at`           | timestamptz |                              |
| `updated_at`           | timestamptz |                              |

Maps to existing enum values: hospitality covers `restaurant`, `hotel`, `cafe`, `bar`, `catering`.

### `industry_niche`

Specialization within an industry.

| Column                  | Type        | Description                                                    |
| ----------------------- | ----------- | -------------------------------------------------------------- |
| `niche_id`              | uuid PK     |                                                                |
| `industry_vertical_id`  | uuid FK     | → industry_vertical                                            |
| `code`                  | text        | `'italian_premium_service'`                                    |
| `display_name`          | text        | `'Italian Premium Service'`                                    |
| `summary`               | text        |                                                                |
| `tags`                  | jsonb       | `["fine-dining","full-service","premium"]`                     |
| `operating_assumptions` | jsonb       | `{service_mode, price_level, peak_pattern, guest_expectation}` |
| `created_at`            | timestamptz |                                                                |
| `updated_at`            | timestamptz |                                                                |

UNIQUE(industry_vertical_id, code).

### `industry_role_profile`

What each role needs to know and be able to do.

| Column                 | Type             | Description                                |
| ---------------------- | ---------------- | ------------------------------------------ |
| `role_profile_id`      | uuid PK          |                                            |
| `industry_vertical_id` | uuid FK          | → industry_vertical                        |
| `niche_id`             | uuid FK nullable | → industry_niche (null = industry-wide)    |
| `role_code`            | text             | `'waiter'`, `'cook'`, `'shift_leader'`     |
| `display_name`         | text             | `'Servitør'`                               |
| `description`          | text             |                                            |
| `core_knowledge`       | jsonb            | `["menu basics","allergen communication"]` |
| `core_skills`          | jsonb            | `["order flow","guest communication"]`     |
| `required_trainings`   | jsonb            | `["allergen handling","service safety"]`   |
| `readiness_criteria`   | jsonb            | `["completes full service sequence"]`      |
| `created_at`           | timestamptz      |                                            |
| `updated_at`           | timestamptz      |                                            |

UNIQUE(industry_vertical_id, niche_id, role_code).

### `industry_environment`

Physical + operational context for the industry/niche.

| Column                 | Type             | Description                                                |
| ---------------------- | ---------------- | ---------------------------------------------------------- |
| `environment_id`       | uuid PK          |                                                            |
| `industry_vertical_id` | uuid FK          | → industry_vertical                                        |
| `niche_id`             | uuid FK nullable | → industry_niche                                           |
| `service_context`      | jsonb            | `{peak_times, interruption_frequency, decision_speed}`     |
| `workforce_context`    | jsonb            | `{digital_maturity, language, turnover_pressure}`          |
| `compliance_context`   | jsonb            | `{food_safety_continuous, allergen_critical, age_control}` |
| `physical_context`     | jsonb            | `{zones, cross_zone_handoffs, hygiene_boundaries}`         |
| `created_at`           | timestamptz      |                                                            |
| `updated_at`           | timestamptz      |                                                            |

UNIQUE(industry_vertical_id, niche_id).

### `industry_default_policy`

Seeded governance baselines per industry/niche.

| Column                 | Type             | Description                                           |
| ---------------------- | ---------------- | ----------------------------------------------------- |
| `policy_id`            | uuid PK          |                                                       |
| `industry_vertical_id` | uuid FK          | → industry_vertical                                   |
| `niche_id`             | uuid FK nullable | → industry_niche                                      |
| `group_name`           | text             | `'safety_compliance'`, `'operational_standard'`, etc. |
| `policy_name`          | text             | `'Temperaturovervåking'`                              |
| `description`          | text             |                                                       |
| `scope`                | text             | `'workspace'` / `'department'` / `'team'`             |
| `enforcement`          | text             | `'required'` / `'warning'` / `'advisory'`             |
| `verification`         | text             | `'checklist'` / `'test'` / `'confirmation'` / `'log'` |
| `created_at`           | timestamptz      |                                                       |
| `updated_at`           | timestamptz      |                                                       |

---

## Schema: System Intelligence (4 tables)

### `system_page`

App routes the agent can see and navigate.

| Column          | Type        | Description                              |
| --------------- | ----------- | ---------------------------------------- |
| `page_id`       | uuid PK     |                                          |
| `route`         | text UNIQUE | `'/dashboard/schedule'`                  |
| `display_name`  | text        | `'Vaktplanlegging'`                      |
| `description`   | text        |                                          |
| `module`        | text        | `'MODULE_10'`                            |
| `requires_role` | text        | minimum role to access                   |
| `nav_group`     | text        | `'dashboard'`, `'onboarding'`, `'admin'` |
| `components`    | jsonb       | `["ShiftGrid","DayPlanner"]`             |
| `agent_actions` | jsonb       | `["focusDay","openDayPlanner"]`          |
| `created_at`    | timestamptz |                                          |
| `updated_at`    | timestamptz |                                          |

### `system_function`

Edge Functions + service endpoints.

| Column         | Type        | Description                                               |
| -------------- | ----------- | --------------------------------------------------------- |
| `function_id`  | uuid PK     |                                                           |
| `name`         | text UNIQUE | `'workspace-api'`                                         |
| `service`      | text        | `'edge-function'`, `'stage-engine'`, `'contract-service'` |
| `description`  | text        |                                                           |
| `auth_pattern` | text        | `'jwt-only'`, `'dual-auth'`, `'cron-only'`                |
| `endpoint`     | text        | `'/functions/v1/workspace-api'`                           |
| `scopes`       | jsonb       | `["profiles:read","schedules:write"]`                     |
| `created_at`   | timestamptz |                                                           |
| `updated_at`   | timestamptz |                                                           |

### `system_capability`

DB-backed capability registry. Replaces hardcoded `registry.ts` as source of truth. `engine_authority_config` stores per-workspace overrides.

| Column              | Type        | Description                                         |
| ------------------- | ----------- | --------------------------------------------------- |
| `capability_id`     | uuid PK     |                                                     |
| `name`              | text UNIQUE | `'profile'`, `'ui'`, `'schedule'`                   |
| `description`       | text        |                                                     |
| `status`            | text        | `'active'`, `'planned'`, `'deprecated'`             |
| `tools`             | jsonb       | `["get_profile","get_team"]`                        |
| `read_only_tools`   | jsonb       |                                                     |
| `suggest_tools`     | jsonb       |                                                     |
| `default_authority` | text        | `'read_only'` — fallback when no workspace override |
| `created_at`        | timestamptz |                                                     |
| `updated_at`        | timestamptz |                                                     |

### `system_context_layer`

The 5-layer context contract from `04-context-contract.md`.

| Column             | Type        | Description                                                  |
| ------------------ | ----------- | ------------------------------------------------------------ |
| `layer_id`         | uuid PK     |                                                              |
| `sequence`         | int UNIQUE  | 1–5 priority order                                           |
| `name`             | text UNIQUE | `'identity'`/`'session'`/`'domain'`/`'memory'`/`'execution'` |
| `description`      | text        |                                                              |
| `source_tables`    | jsonb       | `["user_identity","profile","workspace"]`                    |
| `collector_method` | text        | `'loadIdentityContext'`                                      |
| `failure_mode`     | text        | `'safe_mode'`/`'ask_clarification'`/`'fetch_missing'`        |
| `created_at`       | timestamptz |                                                              |
| `updated_at`       | timestamptz |                                                              |

---

## Workspace Binding

```sql
ALTER TABLE workspace
  ADD COLUMN industry_vertical_id uuid REFERENCES industry_vertical(industry_vertical_id),
  ADD COLUMN niche_id uuid REFERENCES industry_niche(niche_id);
```

---

## RLS

All 9 tables are **platform-level reference data**:

- Read: any authenticated user
- Write: service_role only (seeded via migrations)

```sql
CREATE POLICY "authenticated_read" ON {table}
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "service_write" ON {table}
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Seed Data: Hospitality

### industry_vertical

- `hospitality` — Hospitality & Restaurant

### industry_niche (4 niches)

- `restaurant_generic` — Generisk restaurant
- `italian_premium_service` — Italian Premium Service
- `fast_casual` — Fast Casual
- `hotel_restaurant` — Hotellrestaurant

### industry_role_profile (5 roles, industry-wide)

- `shift_leader` — Skiftleder
- `waiter` — Servitør
- `cook` — Kokk
- `bartender` — Bartender
- `cleaner` — Renholdsoperatør

### industry_environment (1 baseline + 1 niche override)

- Hospitality baseline (generic restaurant context)
- Italian Premium Service override (higher formality, quality emphasis)

### industry_default_policy (5 groups, ~15 policies)

- Group A: Safety & Compliance (temperatur, hygiene, allergen, sporbarhet, brannvern)
- Group B: Operational Standard (åpning, stenging, kassaoppgjør, varemottak)
- Group C: Workforce & HR (arbeidsmiljø, onboarding, underage constraints)
- Group D: Access & Accountability (signoff, logging)
- Group E: Incident & Exception (avvik, tilbaketrekking)

### system_page (~10 key routes)

- `/dashboard` — Oversikt
- `/dashboard/schedule` — Vaktplanlegging
- `/dashboard/season` — Sesongplanlegging
- `/dashboard/operations` — Daglig drift
- `/dashboard/employees` — Ansatte
- `/dashboard/training` — Opplæring
- `/dashboard/settings` — Innstillinger
- `/onboarding` — Onboarding-wizard
- `/onboarding/showcase` — Showcase / System Room

### system_function (~8 key functions)

- `workspace-api` (dual-auth), `validate-api-key` (dual-auth)
- `brreg-proxy` (jwt-only), `scrapling` (service)
- `stage-engine` (service), `contract-service` (service)
- `send-notification` (cron-only), `guardian-sweep` (cron-only)

### system_capability (10 capabilities)

- `profile` (active), `ui` (active), `guardian` (active)
- `knowledge`, `schedule`, `training`, `operations`, `communication`, `memory`, `payroll` (planned)

### system_context_layer (5 layers)

1. identity — user_identity, profile, workspace
2. session — engine_sessions, engine_stages
3. domain — industry_vertical, industry_niche, industry_environment, industry_role_profile, industry_default_policy
4. memory — engine_memory
5. execution — system_capability, engine_authority_config

---

## Playpark: "Context Handshake" Tab

New tab in EnginePlaypark (tab 9) that visualizes the three-layer composition.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Context Handshake — How three layers become one prompt  │
├──────────┬──────────────────┬───────────────────────────┤
│  SYSTEM  │   ARTIFICIAL     │      INDUSTRY             │
│  pages   │   posture 5D     │   vertical: [selector]    │
│  funcs   │   intent router  │   niche: [selector]       │
│  caps    │   memory system  │   role: [selector]        │
│  layers  │   prompt builder │   environment: [display]  │
│          │                  │   policies: [display]     │
├──────────┴──────────────────┴───────────────────────────┤
│  CONTEXT ASSEMBLY PIPELINE                               │
│  [1.Identity] → [2.Session] → [3.Domain] → [4.Memory]  │
│  → [5.Execution]                                         │
│  Each layer shows source tables + toggle on/off          │
├─────────────────────────────────────────────────────────┤
│  ASSEMBLED PROMPT PREVIEW                                │
│  Color-coded sections: System=blue AI=purple Industry=   │
│  orange. Shows what LLM receives for selected config.    │
└─────────────────────────────────────────────────────────┘
```

### Interactions

- Select industry → niche → role to see how domain context changes
- Toggle context layers on/off to see prompt impact
- Color-coded prompt preview shows which layer contributes which section

### Element "Context = YES" Display

Each selectable item in the handshake UI (page, function, capability, context layer, policy, environment block)
must expose a visible context-state badge in the item row:

- `Context: YES` when the item is included in the current assembled prompt
- `Context: NO` when excluded by toggle/filter/selection state

This badge should be shown both:

1. inline on the element itself, and
2. in the side info panel ("page item information") for the currently selected element.

Minimum item metadata in the side info panel:

- item type (`system_page`, `system_function`, `system_capability`, `system_context_layer`, `industry_*`)
- source table key
- active selectors (industry/niche/role)
- context state (`YES` or `NO`)
- reason (`included by layer`, `excluded by toggle`, `no niche match`, etc.)

### Dark Mode Visual Contract (Cards + Special Shifts)

The handshake view and related schedule/report cards MUST follow a dark-mode readability contract:

1. **Card Contrast Baseline**
   - Dark surfaces use `bg-zinc-950/90` or equivalent high-contrast token surface.
   - Card borders in dark mode use `border-zinc-700` minimum (never blend into background).
   - Primary text in cards uses high-contrast foreground (`text-zinc-100` or token equivalent).
   - Secondary text remains readable (`text-zinc-300` / `text-zinc-400`) and never drops below readable contrast.

2. **Interactive State Visibility**
   - Hover, focus, and selected states MUST show both border and background change in dark mode.
   - Selected elements require a visible ring/border accent (not color-only text changes).

3. **Special Shift Visibility**
   - Special shifts (night/weekend and explicitly tagged shift variants) MUST have a dedicated visual treatment.
   - In dark mode, special shift indicators use an emphasized contrast pair (`amber` surface + high-contrast text).
   - "Special shift" state must be readable at a glance in list cards and detail modals.

4. **Side Information Readability**
   - "Page item information" / side-info panels must keep the same contrast contract as cards.
   - Metadata labels and values must be distinguishable in dark mode without hover interaction.

### Data Source

Static constants in component, structured identically to DB schema. When runtime wiring is done, these become real Supabase queries.

---

## API Docs Updates

### DATABASE.md

Add 9 tables to frontmatter `tables` array and add table documentation sections for each.

### API_DATA_DICTIONARY.md

Add field definitions for new tables with sensitivity classifications:

- All `industry_*` fields: `public_operational` (reference data)
- All `system_*` fields: `internal_operational`

### CLAUDE.md

Add to "Database — Critical Traps":

- `industry_vertical` table, NOT `industry` (enum collision)
- `system_capability` stores defaults, `engine_authority_config` stores workspace overrides
- Industry tables have no workspace_id — they're platform-level

---

## Future Wiring (not in this task)

1. **collector.ts** — Add `loadDomainContext(workspaceId)` that joins through `workspace.industry_vertical_id`
2. **prompt-builder.ts** — Inject domain context into the `context` parameter
3. **posture.ts** — Add niche adjustment layer via `deriveNichePosture(niche, environment)`
4. **session-manager.ts** — Extend `loadIdentityContext()` to include industry/niche data
5. **registry.ts** — Migrate from hardcoded registry to DB-backed `system_capability` loader
6. **tool-selector.ts** — Change fallback from hardcoded `"read_only"` to `system_capability.default_authority`

---

## Changelog

| Date       | Change                                                       |
| ---------- | ------------------------------------------------------------ |
| 2026-03-06 | Initial design — 9 tables, seed data, Playpark tab           |
| 2026-03-06 | Added dark-mode visual contract for cards and special shifts |
