---
title: "Context Handshake Implementation Plan"
status: in_progress
updated: 2026-03-06
created: 2026-03-06
module: platform
tags: [plan, context, industry, system-intelligence, playpark, schema, migration]
---

# Context Handshake Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 9 database tables (5 industry + 4 system intelligence) with seed data and a Context Handshake visualization tab in EnginePlaypark.

**Architecture:** Flat schema with 9 reference tables (no workspace_id — platform-level). JSONB for nested structures. Static constants in Playpark matching DB schema, to be wired to real queries later. Option 3: schema + seed now, wire later.

**Tech Stack:** Supabase (PostgreSQL 17), Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, framer-motion

---

### Task 1: Migration — Industry Intelligence Tables (5 tables)

**Files:**

- Create: `supabase/migrations/20260409100000_industry_intelligence_tables.sql`

**Step 1: Write the migration SQL**

Create `supabase/migrations/20260409100000_industry_intelligence_tables.sql` with this content:

```sql
-- Context Handshake: Industry Intelligence Tables
-- Design doc: docs/plans/2026-03-06-context-handshake-design.md

-- ─── industry_vertical ───
CREATE TABLE industry_vertical (
  industry_vertical_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE industry_vertical IS 'Top-level industry classification. Named industry_vertical to avoid collision with existing industry enum on company table.';

-- ─── industry_niche ───
CREATE TABLE industry_niche (
  niche_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_vertical_id uuid NOT NULL REFERENCES industry_vertical(industry_vertical_id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  summary text,
  tags jsonb DEFAULT '[]'::jsonb,
  operating_assumptions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(industry_vertical_id, code)
);

COMMENT ON TABLE industry_niche IS 'Specialization within an industry vertical. E.g. italian_premium_service under hospitality.';

-- ─── industry_role_profile ───
CREATE TABLE industry_role_profile (
  role_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_vertical_id uuid NOT NULL REFERENCES industry_vertical(industry_vertical_id) ON DELETE CASCADE,
  niche_id uuid REFERENCES industry_niche(niche_id) ON DELETE SET NULL,
  role_code text NOT NULL,
  display_name text NOT NULL,
  description text,
  core_knowledge jsonb DEFAULT '[]'::jsonb,
  core_skills jsonb DEFAULT '[]'::jsonb,
  required_trainings jsonb DEFAULT '[]'::jsonb,
  readiness_criteria jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(industry_vertical_id, niche_id, role_code)
);

COMMENT ON TABLE industry_role_profile IS 'What each role needs to know and do within an industry/niche.';

-- ─── industry_environment ───
CREATE TABLE industry_environment (
  environment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_vertical_id uuid NOT NULL REFERENCES industry_vertical(industry_vertical_id) ON DELETE CASCADE,
  niche_id uuid REFERENCES industry_niche(niche_id) ON DELETE SET NULL,
  service_context jsonb DEFAULT '{}'::jsonb,
  workforce_context jsonb DEFAULT '{}'::jsonb,
  compliance_context jsonb DEFAULT '{}'::jsonb,
  physical_context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(industry_vertical_id, niche_id)
);

COMMENT ON TABLE industry_environment IS 'Physical + operational context for an industry/niche.';

-- ─── industry_default_policy ───
CREATE TABLE industry_default_policy (
  policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_vertical_id uuid NOT NULL REFERENCES industry_vertical(industry_vertical_id) ON DELETE CASCADE,
  niche_id uuid REFERENCES industry_niche(niche_id) ON DELETE SET NULL,
  group_name text NOT NULL,
  policy_name text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'workspace',
  enforcement text NOT NULL DEFAULT 'required',
  verification text NOT NULL DEFAULT 'checklist',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE industry_default_policy IS 'Seeded governance baselines per industry/niche.';

-- ─── RLS: All 5 industry tables ───
ALTER TABLE industry_vertical ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_niche ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_role_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_environment ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_default_policy ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
CREATE POLICY "authenticated_read" ON industry_vertical FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "authenticated_read" ON industry_niche FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "authenticated_read" ON industry_role_profile FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "authenticated_read" ON industry_environment FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "authenticated_read" ON industry_default_policy FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- Write: service_role only
CREATE POLICY "service_write" ON industry_vertical FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write" ON industry_niche FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write" ON industry_role_profile FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write" ON industry_environment FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write" ON industry_default_policy FOR ALL USING (auth.role() = 'service_role');

-- ─── Workspace binding ───
ALTER TABLE workspace
  ADD COLUMN IF NOT EXISTS industry_vertical_id uuid REFERENCES industry_vertical(industry_vertical_id),
  ADD COLUMN IF NOT EXISTS niche_id uuid REFERENCES industry_niche(niche_id);
```

**Step 2: Apply migration locally**

Run: `npx supabase db reset`
Expected: All migrations apply cleanly, including the new one.

**Step 3: Commit**

```bash
git add supabase/migrations/20260409100000_industry_intelligence_tables.sql
git commit -m "feat(db): add 5 industry intelligence tables with RLS"
```

---

### Task 2: Migration — System Intelligence Tables (4 tables)

**Files:**

- Create: `supabase/migrations/20260409100100_system_intelligence_tables.sql`

**Step 1: Write the migration SQL**

Create `supabase/migrations/20260409100100_system_intelligence_tables.sql` with this content:

```sql
-- Context Handshake: System Intelligence Tables
-- Design doc: docs/plans/2026-03-06-context-handshake-design.md

-- ─── system_page ───
CREATE TABLE system_page (
  page_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  module text,
  requires_role text,
  nav_group text,
  components jsonb DEFAULT '[]'::jsonb,
  agent_actions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_page IS 'App routes the agent can see and navigate.';

-- ─── system_function ───
CREATE TABLE system_function (
  function_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  service text NOT NULL,
  description text,
  auth_pattern text NOT NULL DEFAULT 'jwt-only',
  endpoint text,
  scopes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_function IS 'Edge Functions + service endpoints the agent can call.';

-- ─── system_capability ───
CREATE TABLE system_capability (
  capability_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planned',
  tools jsonb DEFAULT '[]'::jsonb,
  read_only_tools jsonb DEFAULT '[]'::jsonb,
  suggest_tools jsonb DEFAULT '[]'::jsonb,
  default_authority text NOT NULL DEFAULT 'read_only',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_capability IS 'DB-backed capability registry. engine_authority_config stores per-workspace overrides.';

-- ─── system_context_layer ───
CREATE TABLE system_context_layer (
  layer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence int UNIQUE NOT NULL,
  name text UNIQUE NOT NULL,
  description text,
  source_tables jsonb DEFAULT '[]'::jsonb,
  collector_method text,
  failure_mode text NOT NULL DEFAULT 'safe_mode',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_context_layer IS 'The 5-layer context contract from 04-context-contract.md.';

-- ─── RLS: All 4 system tables ───
ALTER TABLE system_page ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_function ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_capability ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_context_layer ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
CREATE POLICY "authenticated_read" ON system_page FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "authenticated_read" ON system_function FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "authenticated_read" ON system_capability FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "authenticated_read" ON system_context_layer FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- Write: service_role only
CREATE POLICY "service_write" ON system_page FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write" ON system_function FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write" ON system_capability FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write" ON system_context_layer FOR ALL USING (auth.role() = 'service_role');
```

**Step 2: Apply migration locally**

Run: `npx supabase db reset`
Expected: All migrations apply cleanly.

**Step 3: Commit**

```bash
git add supabase/migrations/20260409100100_system_intelligence_tables.sql
git commit -m "feat(db): add 4 system intelligence tables with RLS"
```

---

### Task 3: Seed Data — All 9 Tables

**Files:**

- Create: `supabase/migrations/20260409100200_seed_context_handshake.sql`

**Step 1: Write the seed migration**

Create `supabase/migrations/20260409100200_seed_context_handshake.sql` with this content:

```sql
-- Context Handshake: Seed data for hospitality + system intelligence
-- Design doc: docs/plans/2026-03-06-context-handshake-design.md

-- ─── industry_vertical ───
INSERT INTO industry_vertical (code, display_name, description) VALUES
  ('hospitality', 'Hospitality & Restaurant', 'Covers restaurant, hotel, cafe, bar, catering. Maps to existing industry enum values on company table.');

-- ─── industry_niche ───
WITH vert AS (SELECT industry_vertical_id FROM industry_vertical WHERE code = 'hospitality')
INSERT INTO industry_niche (industry_vertical_id, code, display_name, summary, tags, operating_assumptions) VALUES
  ((SELECT industry_vertical_id FROM vert), 'restaurant_generic', 'Generisk restaurant', 'Standard full-service restaurant without specific cuisine focus.', '["full-service","general"]'::jsonb, '{"service_mode":"table","price_level":"mid","peak_pattern":"lunch_dinner","guest_expectation":"standard"}'::jsonb),
  ((SELECT industry_vertical_id FROM vert), 'italian_premium_service', 'Italian Premium Service', 'Fine-dining Italian restaurant with premium service standards.', '["fine-dining","full-service","premium","italian"]'::jsonb, '{"service_mode":"table","price_level":"premium","peak_pattern":"dinner_heavy","guest_expectation":"high_formality"}'::jsonb),
  ((SELECT industry_vertical_id FROM vert), 'fast_casual', 'Fast Casual', 'Counter-service restaurant with quick turnaround.', '["counter-service","quick-turnaround","casual"]'::jsonb, '{"service_mode":"counter","price_level":"low","peak_pattern":"lunch_heavy","guest_expectation":"speed"}'::jsonb),
  ((SELECT industry_vertical_id FROM vert), 'hotel_restaurant', 'Hotellrestaurant', 'Restaurant operating within a hotel context with breakfast, room service, and events.', '["hotel","breakfast","room-service","events"]'::jsonb, '{"service_mode":"mixed","price_level":"mid_high","peak_pattern":"breakfast_dinner","guest_expectation":"hotel_standard"}'::jsonb);

-- ─── industry_role_profile (5 industry-wide roles) ───
WITH vert AS (SELECT industry_vertical_id FROM industry_vertical WHERE code = 'hospitality')
INSERT INTO industry_role_profile (industry_vertical_id, niche_id, role_code, display_name, description, core_knowledge, core_skills, required_trainings, readiness_criteria) VALUES
  ((SELECT industry_vertical_id FROM vert), NULL, 'shift_leader', 'Skiftleder', 'Ansvarlig for daglig drift under skiftet. Koordinerer team, haandterer avvik, rapporterer til leder.',
    '["operational flow","team coordination","incident handling","closing procedures"]'::jsonb,
    '["delegation","conflict resolution","time management","quality oversight"]'::jsonb,
    '["allergen handling","fire safety","cash handling","opening/closing procedures"]'::jsonb,
    '["completes full shift cycle independently","handles 3+ deviation types","passes closing checklist"]'::jsonb),
  ((SELECT industry_vertical_id FROM vert), NULL, 'waiter', 'Servitoer', 'Fronter gjestekontakt. Tar bestillinger, serverer mat og drikke, gir en positiv opplevelse.',
    '["menu basics","allergen communication","wine/beverage basics","POS operation"]'::jsonb,
    '["order flow","guest communication","upselling","table management"]'::jsonb,
    '["allergen handling","service safety","POS training"]'::jsonb,
    '["completes full service sequence","handles allergen inquiry correctly","processes payment"]'::jsonb),
  ((SELECT industry_vertical_id FROM vert), NULL, 'cook', 'Kokk', 'Tilbereder mat etter oppskrifter og standarder. Opprettholder hygiene og mattrygghet.',
    '["food safety","recipe standards","portion control","station setup"]'::jsonb,
    '["mise en place","cooking techniques","time coordination","hygiene discipline"]'::jsonb,
    '["food safety certification","allergen handling","temperature monitoring"]'::jsonb,
    '["prepares station independently","passes temperature log check","handles 2+ stations"]'::jsonb),
  ((SELECT industry_vertical_id FROM vert), NULL, 'bartender', 'Bartender', 'Ansvarlig for bar og drikkeservering. Blander drinker, haandterer alderskontroll.',
    '["cocktail recipes","beverage knowledge","age verification","bar hygiene"]'::jsonb,
    '["drink preparation","guest interaction","speed service","stock management"]'::jsonb,
    '["age control procedures","allergen handling","responsible serving"]'::jsonb,
    '["prepares standard drink menu independently","passes age control scenario","manages bar station solo"]'::jsonb),
  ((SELECT industry_vertical_id FROM vert), NULL, 'cleaner', 'Renholdsoperatoer', 'Sikrer renhold og hygiene i alle soner. Foelger renholdsprotokoller og HACCP-krav.',
    '["cleaning protocols","chemical safety","zone hygiene standards","waste handling"]'::jsonb,
    '["systematic cleaning","chemical handling","time efficiency","quality self-check"]'::jsonb,
    '["chemical safety","hygiene zones","waste sorting"]'::jsonb,
    '["completes zone checklist independently","passes hygiene spot-check","handles chemical dilution correctly"]'::jsonb);

-- ─── industry_environment (1 baseline + 1 niche override) ───
WITH vert AS (SELECT industry_vertical_id FROM industry_vertical WHERE code = 'hospitality')
INSERT INTO industry_environment (industry_vertical_id, niche_id, service_context, workforce_context, compliance_context, physical_context) VALUES
  ((SELECT industry_vertical_id FROM vert), NULL,
    '{"peak_times":["11:30-13:30","17:30-21:00"],"interruption_frequency":"high","decision_speed":"immediate","service_rhythm":"reactive"}'::jsonb,
    '{"digital_maturity":"low_to_mid","language":"norwegian_primary","turnover_pressure":"high","avg_tenure_months":8}'::jsonb,
    '{"food_safety_continuous":true,"allergen_critical":true,"age_control":true,"temperature_logging":true}'::jsonb,
    '{"zones":["kitchen","floor","bar","storage","office"],"cross_zone_handoffs":true,"hygiene_boundaries":["kitchen_entry","food_prep"]}'::jsonb),
  ((SELECT industry_vertical_id FROM vert),
    (SELECT niche_id FROM industry_niche WHERE code = 'italian_premium_service'),
    '{"peak_times":["18:00-22:00"],"interruption_frequency":"low","decision_speed":"measured","service_rhythm":"choreographed"}'::jsonb,
    '{"digital_maturity":"mid","language":"norwegian_primary","turnover_pressure":"mid","avg_tenure_months":14}'::jsonb,
    '{"food_safety_continuous":true,"allergen_critical":true,"age_control":true,"temperature_logging":true,"wine_service_protocol":true}'::jsonb,
    '{"zones":["kitchen","dining_room","private_dining","wine_cellar","bar"],"cross_zone_handoffs":true,"hygiene_boundaries":["kitchen_entry","food_prep","wine_cellar"]}'::jsonb);

-- ─── industry_default_policy (~15 policies in 5 groups) ───
WITH vert AS (SELECT industry_vertical_id FROM industry_vertical WHERE code = 'hospitality')
INSERT INTO industry_default_policy (industry_vertical_id, niche_id, group_name, policy_name, description, scope, enforcement, verification) VALUES
  -- Group A: Safety & Compliance
  ((SELECT industry_vertical_id FROM vert), NULL, 'safety_compliance', 'Temperaturovervaaking', 'Kontinuerlig temperaturlogging for kjoeling, fryse og varmholding.', 'workspace', 'required', 'log'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'safety_compliance', 'Hygienesoner', 'Definerte hygienesoner med haandvask og bekledningskrav.', 'department', 'required', 'checklist'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'safety_compliance', 'Allergenhaandtering', 'Allergendokumentasjon og kommunikasjonsrutiner for alle retter.', 'workspace', 'required', 'test'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'safety_compliance', 'Sporbarhet', 'Varemottak med batch-registrering og holdbarhetskontroll.', 'workspace', 'required', 'log'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'safety_compliance', 'Brannvern', 'Brannvernsopplaering og evakueringsrutiner.', 'workspace', 'required', 'confirmation'),
  -- Group B: Operational Standard
  ((SELECT industry_vertical_id FROM vert), NULL, 'operational_standard', 'Aapningsrutine', 'Standardisert aapningsprosedyre per avdeling.', 'department', 'required', 'checklist'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'operational_standard', 'Stengingsrutine', 'Standardisert stengingsprosedyre per avdeling.', 'department', 'required', 'checklist'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'operational_standard', 'Kassaoppgjoer', 'Daglig kassaoppgjoer med avviksrapportering.', 'workspace', 'required', 'log'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'operational_standard', 'Varemottak', 'Varemottakskontroll med temperatur- og kvalitetssjekk.', 'workspace', 'required', 'checklist'),
  -- Group C: Workforce & HR
  ((SELECT industry_vertical_id FROM vert), NULL, 'workforce_hr', 'Arbeidsmiljoekartlegging', 'Regelmessig kartlegging av arbeidsmiljoe og trivsel.', 'workspace', 'advisory', 'confirmation'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'workforce_hr', 'Onboarding-standard', 'Standardisert onboarding-program for nye ansatte.', 'workspace', 'required', 'checklist'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'workforce_hr', 'Aldersgrense-ansatte', 'Restriksjoner for mindreaarige ansatte ihht arbeidsmiljoeloven.', 'workspace', 'required', 'confirmation'),
  -- Group D: Access & Accountability
  ((SELECT industry_vertical_id FROM vert), NULL, 'access_accountability', 'Signoff-rutine', 'Skiftleder signerer av daglige kontroller.', 'team', 'required', 'confirmation'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'access_accountability', 'Aktivitetslogging', 'Logging av kritiske handlinger for sporbarhet.', 'workspace', 'required', 'log'),
  -- Group E: Incident & Exception
  ((SELECT industry_vertical_id FROM vert), NULL, 'incident_exception', 'Avvikshaandtering', 'Prosedyre for registrering og oppfoelging av avvik.', 'workspace', 'required', 'log'),
  ((SELECT industry_vertical_id FROM vert), NULL, 'incident_exception', 'Tilbaketrekking', 'Prosedyre for tilbaketrekking av produkt ved mattrygghetshendelse.', 'workspace', 'required', 'checklist');

-- ─── system_page (~10 key routes) ───
INSERT INTO system_page (route, display_name, description, module, requires_role, nav_group, components, agent_actions) VALUES
  ('/dashboard', 'Oversikt', 'Main dashboard with tactical, strategic, reconciliation, and activity views.', 'MODULE_01', 'employee', 'dashboard', '["TacticalView","StrategicView","ReconciliationView","ActivityView"]'::jsonb, '["switchView","focusMetric"]'::jsonb),
  ('/dashboard/schedule', 'Vaktplanlegging', 'Weekly schedule grid with shift management.', 'MODULE_10', 'manager', 'dashboard', '["ShiftGrid","DayPlanner","EmployeeRow"]'::jsonb, '["focusDay","openDayPlanner","createShift"]'::jsonb),
  ('/dashboard/season', 'Sesongplanlegging', 'Season budget planning with day/hour factors.', 'MODULE_15', 'admin', 'dashboard', '["SeasonOverview","BudgetTab","DayFactorTab","HourFactorTab"]'::jsonb, '["selectSeason","editBudget"]'::jsonb),
  ('/dashboard/operations', 'Daglig drift', 'Daily operations with department sessions.', 'MODULE_06', 'manager', 'dashboard', '["DepartmentSessionList","SessionDetail"]'::jsonb, '["openSession","startSession","closeSession"]'::jsonb),
  ('/dashboard/employees', 'Ansatte', 'Employee list with profiles, readiness, and invitations.', 'MODULE_04', 'manager', 'dashboard', '["EmployeeList","ProfileDetail","InviteDrawer"]'::jsonb, '["viewProfile","inviteEmployee","editRole"]'::jsonb),
  ('/dashboard/training', 'Opplaering', 'Training management with protocols and assignments.', 'MODULE_05', 'manager', 'dashboard', '["ProtocolList","AssignmentBoard","ReadinessTracker"]'::jsonb, '["assignProtocol","viewProgress","markComplete"]'::jsonb),
  ('/dashboard/settings', 'Innstillinger', 'Workspace settings, billing, API keys, integrations.', 'MODULE_03', 'admin', 'dashboard', '["GeneralSettings","BillingSettings","ApiKeyManager"]'::jsonb, '["updateSetting","manageKeys"]'::jsonb),
  ('/onboarding', 'Onboarding-wizard', 'Multi-step workspace onboarding wizard.', 'MODULE_02', 'owner', 'onboarding', '["OnboardingWizard","StepComponents"]'::jsonb, '["nextStep","previousStep","saveProgress"]'::jsonb),
  ('/onboarding/showcase', 'Showcase / System Room', 'Interactive showcase of AI agent architecture.', 'MODULE_02', 'owner', 'onboarding', '["ShowcasePage","EnginePlaypark"]'::jsonb, '["openPlaypark","switchTab"]'::jsonb);

-- ─── system_function (~8 key functions) ───
INSERT INTO system_function (name, service, description, auth_pattern, endpoint, scopes) VALUES
  ('workspace-api', 'edge-function', 'Central API gateway for workspace data access.', 'dual-auth', '/functions/v1/workspace-api', '["profiles:read","schedules:read","schedules:write","training:read","contracts:read"]'::jsonb),
  ('validate-api-key', 'edge-function', 'Validates API keys and returns workspace context.', 'dual-auth', '/functions/v1/validate-api-key', '[]'::jsonb),
  ('brreg-proxy', 'edge-function', 'Proxy for Broennoysundregistrene company lookup.', 'jwt-only', '/functions/v1/brreg-proxy', '[]'::jsonb),
  ('scrapling', 'service', 'Python web scraping service for company data extraction.', 'service', 'http://scrapling:8000', '[]'::jsonb),
  ('stage-engine', 'service', 'Hono-based AI stage engine for mission execution.', 'service', 'http://localhost:3000', '[]'::jsonb),
  ('contract-service', 'service', 'Fastify service for DocuSign/DocuSeal contract management.', 'service', 'http://localhost:3100', '["contracts:read"]'::jsonb),
  ('send-notification', 'edge-function', 'Sends email/SMS notifications via SendGrid/Twilio.', 'cron-only', '/functions/v1/send-notification', '[]'::jsonb),
  ('guardian-sweep', 'edge-function', 'Periodic guardian signal evaluation and notification.', 'cron-only', '/functions/v1/guardian-sweep', '[]'::jsonb);

-- ─── system_capability (10 capabilities) ───
INSERT INTO system_capability (name, description, status, tools, read_only_tools, suggest_tools, default_authority) VALUES
  ('profile', 'User profile, team, and role management.', 'active', '["get_profile","get_team","get_contract_status","update_profile"]'::jsonb, '["get_profile","get_team","get_contract_status"]'::jsonb, '["get_profile"]'::jsonb, 'read_only'),
  ('ui', 'Navigation, form filling, and UI element control.', 'active', '["navigate_to","fill_field","highlight_element","show_panel","show_toast"]'::jsonb, '["navigate_to","show_toast"]'::jsonb, '["navigate_to"]'::jsonb, 'autonomous'),
  ('guardian', 'Workspace health monitoring and signal management.', 'active', '["get_signals","acknowledge_signal","get_workspace_health"]'::jsonb, '["get_signals","get_workspace_health"]'::jsonb, '["get_signals"]'::jsonb, 'read_only'),
  ('knowledge', 'Policy, protocol, and training content access.', 'planned', '["get_policy","get_protocol","search_knowledge"]'::jsonb, '["get_policy","get_protocol","search_knowledge"]'::jsonb, '["search_knowledge"]'::jsonb, 'read_only'),
  ('schedule', 'Shift scheduling and roster management.', 'planned', '["get_shifts","create_shift","update_shift","get_availability"]'::jsonb, '["get_shifts","get_availability"]'::jsonb, '["get_shifts"]'::jsonb, 'read_only'),
  ('training', 'Training assignment and progress tracking.', 'planned', '["assign_protocol","get_progress","mark_complete"]'::jsonb, '["get_progress"]'::jsonb, '["get_progress"]'::jsonb, 'read_only'),
  ('operations', 'Department sessions and daily operations.', 'planned', '["get_session","start_session","close_session"]'::jsonb, '["get_session"]'::jsonb, '["get_session"]'::jsonb, 'read_only'),
  ('communication', 'Notifications and messaging.', 'planned', '["send_notification","get_messages"]'::jsonb, '["get_messages"]'::jsonb, '["get_messages"]'::jsonb, 'escalate'),
  ('memory', 'Agent memory storage and semantic retrieval.', 'planned', '["store_memory","search_memories","get_context"]'::jsonb, '["search_memories","get_context"]'::jsonb, '["get_context"]'::jsonb, 'autonomous'),
  ('payroll', 'Hour tracking and payroll data.', 'planned', '["get_hours","approve_hours"]'::jsonb, '["get_hours"]'::jsonb, '["get_hours"]'::jsonb, 'never');

-- ─── system_context_layer (5 layers) ───
INSERT INTO system_context_layer (sequence, name, description, source_tables, collector_method, failure_mode) VALUES
  (1, 'identity', 'Who is the user? Role, workspace, profile data.', '["user_identity","profile","workspace","company"]'::jsonb, 'loadIdentityContext', 'safe_mode'),
  (2, 'session', 'What is the current session state? Stage, mission, conversation.', '["engine_sessions","engine_stages"]'::jsonb, 'loadSessionContext', 'ask_clarification'),
  (3, 'domain', 'What industry/niche context applies? Defaults, roles, environment.', '["industry_vertical","industry_niche","industry_environment","industry_role_profile","industry_default_policy"]'::jsonb, 'loadDomainContext', 'fetch_missing'),
  (4, 'memory', 'What does the agent remember? Past interactions, preferences.', '["engine_memory"]'::jsonb, 'loadMemoryContext', 'safe_mode'),
  (5, 'execution', 'What can the agent do? Capabilities, authority, tools.', '["system_capability","engine_authority_config"]'::jsonb, 'loadExecutionContext', 'safe_mode');
```

**Step 2: Apply migration locally**

Run: `npx supabase db reset`
Expected: All migrations apply cleanly. All seed data inserted.

**Step 3: Verify seed data**

Run: `npx supabase db execute --sql "SELECT count(*) FROM industry_vertical; SELECT count(*) FROM industry_niche; SELECT count(*) FROM industry_role_profile; SELECT count(*) FROM industry_environment; SELECT count(*) FROM industry_default_policy; SELECT count(*) FROM system_page; SELECT count(*) FROM system_function; SELECT count(*) FROM system_capability; SELECT count(*) FROM system_context_layer;"`

Expected counts: 1, 4, 5, 2, 16, 9, 8, 10, 5.

**Step 4: Commit**

```bash
git add supabase/migrations/20260409100200_seed_context_handshake.sql
git commit -m "feat(db): seed hospitality + system intelligence data"
```

---

### Task 4: Regenerate Database Types

**Files:**

- Modify: `packages/supabase/src/database.types.ts` (auto-generated)

**Step 1: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File regenerated with new table types for all 9 tables.

**Step 2: Verify new types exist**

Run: `grep -c "industry_vertical\|industry_niche\|industry_role_profile\|industry_environment\|industry_default_policy\|system_page\|system_function\|system_capability\|system_context_layer" packages/supabase/src/database.types.ts`
Expected: Multiple matches (at least 9 — one per table in the Tables interface).

**Step 3: Typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 new errors (pre-existing merge conflict errors in ContractSection.tsx are known and unrelated).

**Step 4: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore: regenerate database.types.ts with context handshake tables"
```

---

### Task 5: Context Handshake Tab in EnginePlaypark

**Files:**

- Modify: `apps/web/src/app/onboarding/showcase/_components/EnginePlaypark.tsx`

**Step 1: Add "context" to PlayparkTab type**

At line ~93, add `"context"` to the union:

```typescript
type PlayparkTab =
  | "missions"
  | "personality"
  | "tools"
  | "capabilities"
  | "intent"
  | "memory"
  | "guardian"
  | "roleplay"
  | "context";
```

**Step 2: Add context handshake static data constants**

After the existing data constants (around line 700, after the ROLEPLAY_SCENARIOS array), add these constants:

```typescript
// ─── Data: Context Handshake (from design doc, matches DB schema) ───

const INDUSTRY_VERTICALS = [
  {
    code: "hospitality",
    displayName: "Hospitality & Restaurant",
    description: "Covers restaurant, hotel, cafe, bar, catering.",
  },
];

const INDUSTRY_NICHES = [
  {
    code: "restaurant_generic",
    displayName: "Generisk restaurant",
    tags: ["full-service", "general"],
    operatingAssumptions: {
      service_mode: "table",
      price_level: "mid",
      peak_pattern: "lunch_dinner",
      guest_expectation: "standard",
    },
  },
  {
    code: "italian_premium_service",
    displayName: "Italian Premium Service",
    tags: ["fine-dining", "full-service", "premium", "italian"],
    operatingAssumptions: {
      service_mode: "table",
      price_level: "premium",
      peak_pattern: "dinner_heavy",
      guest_expectation: "high_formality",
    },
  },
  {
    code: "fast_casual",
    displayName: "Fast Casual",
    tags: ["counter-service", "quick-turnaround", "casual"],
    operatingAssumptions: {
      service_mode: "counter",
      price_level: "low",
      peak_pattern: "lunch_heavy",
      guest_expectation: "speed",
    },
  },
  {
    code: "hotel_restaurant",
    displayName: "Hotellrestaurant",
    tags: ["hotel", "breakfast", "room-service", "events"],
    operatingAssumptions: {
      service_mode: "mixed",
      price_level: "mid_high",
      peak_pattern: "breakfast_dinner",
      guest_expectation: "hotel_standard",
    },
  },
];

const INDUSTRY_ROLES = [
  {
    code: "shift_leader",
    displayName: "Skiftleder",
    coreKnowledge: ["operational flow", "team coordination", "incident handling"],
    coreSkills: ["delegation", "conflict resolution", "time management"],
  },
  {
    code: "waiter",
    displayName: "Servitoer",
    coreKnowledge: ["menu basics", "allergen communication", "POS operation"],
    coreSkills: ["order flow", "guest communication", "upselling"],
  },
  {
    code: "cook",
    displayName: "Kokk",
    coreKnowledge: ["food safety", "recipe standards", "portion control"],
    coreSkills: ["mise en place", "cooking techniques", "hygiene discipline"],
  },
  {
    code: "bartender",
    displayName: "Bartender",
    coreKnowledge: ["cocktail recipes", "age verification", "bar hygiene"],
    coreSkills: ["drink preparation", "guest interaction", "stock management"],
  },
  {
    code: "cleaner",
    displayName: "Renholdsoperatoer",
    coreKnowledge: ["cleaning protocols", "chemical safety", "zone hygiene"],
    coreSkills: ["systematic cleaning", "chemical handling", "quality self-check"],
  },
];

const CONTEXT_LAYERS = [
  {
    sequence: 1,
    name: "identity",
    description: "Who is the user?",
    sourceTables: ["user_identity", "profile", "workspace", "company"],
    collectorMethod: "loadIdentityContext",
    failureMode: "safe_mode",
    color: "blue",
  },
  {
    sequence: 2,
    name: "session",
    description: "Current session state",
    sourceTables: ["engine_sessions", "engine_stages"],
    collectorMethod: "loadSessionContext",
    failureMode: "ask_clarification",
    color: "blue",
  },
  {
    sequence: 3,
    name: "domain",
    description: "Industry/niche context",
    sourceTables: [
      "industry_vertical",
      "industry_niche",
      "industry_environment",
      "industry_role_profile",
      "industry_default_policy",
    ],
    collectorMethod: "loadDomainContext",
    failureMode: "fetch_missing",
    color: "orange",
  },
  {
    sequence: 4,
    name: "memory",
    description: "Agent memories",
    sourceTables: ["engine_memory"],
    collectorMethod: "loadMemoryContext",
    failureMode: "safe_mode",
    color: "purple",
  },
  {
    sequence: 5,
    name: "execution",
    description: "Capabilities & authority",
    sourceTables: ["system_capability", "engine_authority_config"],
    collectorMethod: "loadExecutionContext",
    failureMode: "safe_mode",
    color: "blue",
  },
];

const SYSTEM_PAGES_SUMMARY = [
  { route: "/dashboard", displayName: "Oversikt", module: "MODULE_01" },
  { route: "/dashboard/schedule", displayName: "Vaktplanlegging", module: "MODULE_10" },
  { route: "/dashboard/season", displayName: "Sesongplanlegging", module: "MODULE_15" },
  { route: "/dashboard/operations", displayName: "Daglig drift", module: "MODULE_06" },
  { route: "/dashboard/employees", displayName: "Ansatte", module: "MODULE_04" },
  { route: "/dashboard/training", displayName: "Opplaering", module: "MODULE_05" },
  { route: "/dashboard/settings", displayName: "Innstillinger", module: "MODULE_03" },
  { route: "/onboarding", displayName: "Onboarding-wizard", module: "MODULE_02" },
  { route: "/onboarding/showcase", displayName: "Showcase", module: "MODULE_02" },
];

const SYSTEM_FUNCTIONS_SUMMARY = [
  { name: "workspace-api", service: "edge-function", authPattern: "dual-auth" },
  { name: "validate-api-key", service: "edge-function", authPattern: "dual-auth" },
  { name: "brreg-proxy", service: "edge-function", authPattern: "jwt-only" },
  { name: "scrapling", service: "service", authPattern: "service" },
  { name: "stage-engine", service: "service", authPattern: "service" },
  { name: "contract-service", service: "service", authPattern: "service" },
  { name: "send-notification", service: "edge-function", authPattern: "cron-only" },
  { name: "guardian-sweep", service: "edge-function", authPattern: "cron-only" },
];
```

**Step 3: Add the tab entry**

In the `tabs` array (line ~1715), add after the roleplay entry:

```typescript
{ id: "context", label: "Context Handshake", icon: Sparkles },
```

**Step 4: Add the ContextHandshakePanel component**

Before the main `EnginePlaypark` component function, add:

```typescript
// ─── Panel: Context Handshake ───

function ContextHandshakePanel() {
  const [selectedNiche, setSelectedNiche] = useState(INDUSTRY_NICHES[0].code);
  const [selectedRole, setSelectedRole] = useState(INDUSTRY_ROLES[0].code);
  const [enabledLayers, setEnabledLayers] = useState<Record<string, boolean>>(
    Object.fromEntries(CONTEXT_LAYERS.map((l) => [l.name, true]))
  );

  const niche = INDUSTRY_NICHES.find((n) => n.code === selectedNiche) ?? INDUSTRY_NICHES[0];
  const role = INDUSTRY_ROLES.find((r) => r.code === selectedRole) ?? INDUSTRY_ROLES[0];

  const toggleLayer = useCallback((name: string) => {
    setEnabledLayers((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const layerColorMap: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/5",
    orange: "border-orange-500/30 bg-orange-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
  };

  const layerTextColorMap: Record<string, string> = {
    blue: "text-blue-400",
    orange: "text-orange-400",
    purple: "text-purple-400",
  };

  const layerDotColorMap: Record<string, string> = {
    blue: "bg-blue-400",
    orange: "bg-orange-400",
    purple: "bg-purple-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-white/90">Context Handshake</h3>
        <p className="mt-1 text-xs text-white/50">
          How three intelligence layers compose into one prompt. Select industry, niche, and role
          to see how domain context changes the assembled prompt.
        </p>
      </div>

      {/* Three Columns: System | Artificial | Industry */}
      <div className="grid grid-cols-3 gap-3">
        {/* System Intelligence */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <h4 className="mb-2 text-xs font-semibold text-blue-400">System Intelligence</h4>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Pages ({SYSTEM_PAGES_SUMMARY.length})</span>
              <div className="mt-1 space-y-0.5">
                {SYSTEM_PAGES_SUMMARY.slice(0, 5).map((p) => (
                  <div key={p.route} className="flex items-center justify-between text-[11px]">
                    <span className="text-white/60">{p.displayName}</span>
                    <span className="text-white/30">{p.module}</span>
                  </div>
                ))}
                {SYSTEM_PAGES_SUMMARY.length > 5 && (
                  <span className="text-[10px] text-white/30">+{SYSTEM_PAGES_SUMMARY.length - 5} more</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Functions ({SYSTEM_FUNCTIONS_SUMMARY.length})</span>
              <div className="mt-1 space-y-0.5">
                {SYSTEM_FUNCTIONS_SUMMARY.map((f) => (
                  <div key={f.name} className="flex items-center justify-between text-[11px]">
                    <span className="text-white/60">{f.name}</span>
                    <span className={`rounded px-1 text-[9px] ${
                      f.authPattern === "dual-auth" ? "bg-yellow-500/20 text-yellow-400" :
                      f.authPattern === "cron-only" ? "bg-gray-500/20 text-gray-400" :
                      f.authPattern === "jwt-only" ? "bg-green-500/20 text-green-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>{f.authPattern}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Artificial Intelligence */}
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
          <h4 className="mb-2 text-xs font-semibold text-purple-400">Artificial Intelligence</h4>
          <div className="space-y-2">
            {[
              { label: "Posture 5D", desc: "Personality resolution with role + situation adjustments" },
              { label: "Intent Router", desc: "10-domain classifier for capability routing" },
              { label: "Memory System", desc: "pgvector semantic retrieval + importance scoring" },
              { label: "Prompt Builder", desc: "Context assembly into structured LLM prompt" },
              { label: "Stage Engine", desc: "Mission state machine with stage transitions" },
            ].map((item) => (
              <div key={item.label} className="rounded border border-purple-500/10 bg-purple-500/5 px-2 py-1.5">
                <span className="text-[11px] font-medium text-white/70">{item.label}</span>
                <p className="text-[10px] text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Industry Intelligence */}
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
          <h4 className="mb-2 text-xs font-semibold text-orange-400">Industry Intelligence</h4>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Vertical</span>
              <div className="mt-1 rounded border border-orange-500/20 bg-black/30 px-2 py-1 text-[11px] text-white/60">
                {INDUSTRY_VERTICALS[0].displayName}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Niche</span>
              <select
                value={selectedNiche}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="mt-1 w-full rounded border border-orange-500/20 bg-black/30 px-2 py-1 text-[11px] text-white/60"
              >
                {INDUSTRY_NICHES.map((n) => (
                  <option key={n.code} value={n.code}>{n.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Role</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="mt-1 w-full rounded border border-orange-500/20 bg-black/30 px-2 py-1 text-[11px] text-white/60"
              >
                {INDUSTRY_ROLES.map((r) => (
                  <option key={r.code} value={r.code}>{r.displayName}</option>
                ))}
              </select>
            </div>
            <div className="rounded border border-orange-500/10 bg-orange-500/5 px-2 py-1.5">
              <span className="text-[10px] font-medium text-white/50">Operating Assumptions</span>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {Object.entries(niche.operatingAssumptions).map(([key, val]) => (
                  <div key={key} className="text-[10px]">
                    <span className="text-white/30">{key}:</span>{" "}
                    <span className="text-orange-300/70">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Assembly Pipeline */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <h4 className="mb-3 text-xs font-semibold text-white/70">Context Assembly Pipeline</h4>
        <div className="flex items-center gap-1">
          {CONTEXT_LAYERS.map((layer, i) => (
            <div key={layer.name} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleLayer(layer.name)}
                className={`rounded-lg border px-3 py-2 transition-all ${
                  enabledLayers[layer.name]
                    ? layerColorMap[layer.color]
                    : "border-white/5 bg-white/[0.02] opacity-40"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${enabledLayers[layer.name] ? layerDotColorMap[layer.color] : "bg-white/20"}`} />
                  <span className={`text-[11px] font-medium ${enabledLayers[layer.name] ? layerTextColorMap[layer.color] : "text-white/30"}`}>
                    {layer.sequence}. {layer.name}
                  </span>
                </div>
                <p className="mt-0.5 text-[9px] text-white/30">{layer.description}</p>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {layer.sourceTables.map((t) => (
                    <span key={t} className="rounded bg-black/30 px-1 py-0.5 text-[8px] text-white/25">{t}</span>
                  ))}
                </div>
              </button>
              {i < CONTEXT_LAYERS.length - 1 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-white/20" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Assembled Prompt Preview */}
      <div className="rounded-lg border border-white/10 bg-black/40 p-3">
        <h4 className="mb-2 text-xs font-semibold text-white/70">Assembled Prompt Preview</h4>
        <p className="mb-3 text-[10px] text-white/30">
          Color-coded sections show which layer contributes which part of the LLM prompt.
          Toggle layers above to see prompt impact.
        </p>
        <div className="space-y-2 font-mono text-[11px]">
          {enabledLayers.identity && (
            <div className="rounded border border-blue-500/20 bg-blue-500/5 px-2 py-1.5">
              <span className="text-[9px] font-semibold uppercase text-blue-400">Identity</span>
              <p className="text-white/50">User: [profile.display_name] | Role: [profile.role] | Workspace: [workspace.name]</p>
            </div>
          )}
          {enabledLayers.session && (
            <div className="rounded border border-blue-500/20 bg-blue-500/5 px-2 py-1.5">
              <span className="text-[9px] font-semibold uppercase text-blue-400">Session</span>
              <p className="text-white/50">Mode: [session.mode] | Stage: [stage.current] | Mission: [mission.name]</p>
            </div>
          )}
          {enabledLayers.domain && (
            <div className="rounded border border-orange-500/20 bg-orange-500/5 px-2 py-1.5">
              <span className="text-[9px] font-semibold uppercase text-orange-400">Domain</span>
              <p className="text-white/50">
                Industry: {INDUSTRY_VERTICALS[0].displayName} | Niche: {niche.displayName} |
                Role: {role.displayName}
              </p>
              <p className="mt-1 text-white/40">
                Knowledge: {role.coreKnowledge.join(", ")}
              </p>
              <p className="text-white/40">
                Service mode: {String(niche.operatingAssumptions.service_mode)} |
                Guest expectation: {String(niche.operatingAssumptions.guest_expectation)}
              </p>
            </div>
          )}
          {enabledLayers.memory && (
            <div className="rounded border border-purple-500/20 bg-purple-500/5 px-2 py-1.5">
              <span className="text-[9px] font-semibold uppercase text-purple-400">Memory</span>
              <p className="text-white/50">Recent memories: [3 most relevant by embedding similarity]</p>
            </div>
          )}
          {enabledLayers.execution && (
            <div className="rounded border border-blue-500/20 bg-blue-500/5 px-2 py-1.5">
              <span className="text-[9px] font-semibold uppercase text-blue-400">Execution</span>
              <p className="text-white/50">Capabilities: profile (read_only), ui (autonomous), guardian (read_only)</p>
              <p className="text-white/40">Tools available: get_profile, get_team, navigate_to, show_toast, get_signals</p>
            </div>
          )}
          {Object.values(enabledLayers).every((v) => !v) && (
            <div className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1.5">
              <span className="text-[9px] font-semibold uppercase text-red-400">No Context</span>
              <p className="text-white/50">All layers disabled. The agent has no context — safe mode only.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Add the tab rendering case**

In the main render section of `EnginePlaypark` where other tabs are rendered (look for the pattern `{activeTab === "roleplay" && ...}`), add:

```typescript
{activeTab === "context" && <ContextHandshakePanel />}
```

**Step 6: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 new errors.

**Step 7: Commit**

```bash
git add apps/web/src/app/onboarding/showcase/_components/EnginePlaypark.tsx
git commit -m "feat(showcase): add Context Handshake tab to EnginePlaypark"
```

---

### Task 6: Update DATABASE.md

**Files:**

- Modify: `docs/reference/DATABASE.md`

**Step 1: Add tables to frontmatter `tables` array**

In the YAML frontmatter, add these 9 entries to the `tables` array:

```yaml
industry_vertical,
industry_niche,
industry_role_profile,
industry_environment,
industry_default_policy,
system_page,
system_function,
system_capability,
system_context_layer,
```

Add changelog entry:

```yaml
- date: 2026-03-06
  change: "Added 9 context handshake tables (5 industry + 4 system intelligence)"
```

Update the total entity count header (e.g., "## All Tables (61 entities)").

**Step 2: Add Industry Intelligence section**

After the "AI / Agent" section (~line 225), add:

```markdown
### Industry Intelligence (Platform-level — no workspace_id)

| Table                     | PK                     | Purpose                                                                                      |
| ------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `industry_vertical`       | `industry_vertical_id` | Top-level industry classification. Named to avoid collision with `industry` enum on company. |
| `industry_niche`          | `niche_id`             | Specialization within an industry vertical. UNIQUE(industry_vertical_id, code).              |
| `industry_role_profile`   | `role_profile_id`      | What each role needs to know and do. UNIQUE(industry_vertical_id, niche_id, role_code).      |
| `industry_environment`    | `environment_id`       | Physical + operational context. UNIQUE(industry_vertical_id, niche_id).                      |
| `industry_default_policy` | `policy_id`            | Seeded governance baselines per industry/niche.                                              |

**industry_niche key columns:** `industry_vertical_id` (FK CASCADE), `code` (TEXT), `display_name`, `tags` (JSONB), `operating_assumptions` (JSONB: service_mode, price_level, peak_pattern, guest_expectation).

**industry_role_profile key columns:** `industry_vertical_id` (FK CASCADE), `niche_id` (FK nullable, null = industry-wide), `role_code`, `core_knowledge` (JSONB), `core_skills` (JSONB), `required_trainings` (JSONB), `readiness_criteria` (JSONB).

**industry_environment key columns:** `industry_vertical_id` (FK CASCADE), `niche_id` (FK nullable), `service_context` (JSONB: peak_times, interruption_frequency, decision_speed), `workforce_context` (JSONB: digital_maturity, language, turnover_pressure), `compliance_context` (JSONB: food_safety_continuous, allergen_critical, age_control), `physical_context` (JSONB: zones, cross_zone_handoffs, hygiene_boundaries).

**industry_default_policy key columns:** `industry_vertical_id` (FK CASCADE), `niche_id` (FK nullable), `group_name`, `policy_name`, `scope` (workspace/department/team), `enforcement` (required/warning/advisory), `verification` (checklist/test/confirmation/log).

**RLS:** Platform-level reference data. Read: any authenticated user. Write: service_role only.

**Workspace binding:** `workspace.industry_vertical_id` + `workspace.niche_id` FK columns link a workspace to its industry context.
```

**Step 3: Add System Intelligence section**

After the Industry Intelligence section, add:

```markdown
### System Intelligence (Platform-level — no workspace_id)

| Table                  | PK              | Purpose                                                                    |
| ---------------------- | --------------- | -------------------------------------------------------------------------- |
| `system_page`          | `page_id`       | App routes the agent can see and navigate. UNIQUE(route).                  |
| `system_function`      | `function_id`   | Edge Functions + service endpoints. UNIQUE(name).                          |
| `system_capability`    | `capability_id` | DB-backed capability registry. `engine_authority_config` stores overrides. |
| `system_context_layer` | `layer_id`      | The 5-layer context contract. UNIQUE(sequence), UNIQUE(name).              |

**system_page key columns:** `route` (TEXT UNIQUE), `display_name`, `module`, `requires_role`, `nav_group`, `components` (JSONB), `agent_actions` (JSONB).

**system_function key columns:** `name` (TEXT UNIQUE), `service` (edge-function/stage-engine/contract-service), `auth_pattern` (jwt-only/dual-auth/cron-only), `endpoint`, `scopes` (JSONB).

**system_capability key columns:** `name` (TEXT UNIQUE), `status` (active/planned/deprecated), `tools` (JSONB), `read_only_tools` (JSONB), `suggest_tools` (JSONB), `default_authority` (TEXT — fallback when no workspace override in `engine_authority_config`).

**system_context_layer key columns:** `sequence` (INT UNIQUE, 1-5), `name` (TEXT UNIQUE: identity/session/domain/memory/execution), `source_tables` (JSONB), `collector_method` (TEXT), `failure_mode` (safe_mode/ask_clarification/fetch_missing).

**RLS:** Platform-level reference data. Read: any authenticated user. Write: service_role only.
```

**Step 4: Update the `updated:` date in frontmatter to `2026-03-06`**

**Step 5: Commit**

```bash
git add docs/reference/DATABASE.md
git commit -m "docs: add 9 context handshake tables to DATABASE.md"
```

---

### Task 7: Update API_DATA_DICTIONARY.md

**Files:**

- Modify: `docs/reference/API_DATA_DICTIONARY.md`

**Step 1: Add industry intelligence fields section**

After the last existing section in the file, add:

```markdown
---

## Industry intelligence fields (platform reference data)

| Field                   | Type   | Description                                         | Sensitivity          | External sharing default |
| ----------------------- | ------ | --------------------------------------------------- | -------------------- | ------------------------ |
| `industry_vertical_id`  | uuid   | Industry vertical identifier                        | public_operational   | allow                    |
| `niche_id`              | uuid   | Industry niche identifier                           | public_operational   | allow                    |
| `role_profile_id`       | uuid   | Industry role profile identifier                    | public_operational   | allow                    |
| `environment_id`        | uuid   | Industry environment identifier                     | public_operational   | allow                    |
| `policy_id`             | uuid   | Industry default policy identifier                  | public_operational   | allow                    |
| `code`                  | text   | Machine-readable identifier (unique per table)      | public_operational   | allow                    |
| `display_name`          | text   | Human-readable name                                 | public_operational   | allow                    |
| `group_name`            | text   | Policy group classification                         | public_operational   | allow                    |
| `policy_name`           | text   | Policy display name                                 | public_operational   | allow                    |
| `scope`                 | text   | Policy scope (workspace/department/team)            | public_operational   | allow                    |
| `enforcement`           | text   | Policy enforcement level (required/warning/advisory)| public_operational   | allow                    |
| `verification`          | text   | Policy verification method                          | public_operational   | allow                    |
| `tags`                  | jsonb  | Classification tags for niche                       | public_operational   | allow                    |
| `operating_assumptions` | jsonb  | Niche operating context                             | public_operational   | allow                    |
| `core_knowledge`        | jsonb  | Role knowledge requirements                         | public_operational   | allow                    |
| `core_skills`           | jsonb  | Role skill requirements                             | public_operational   | allow                    |
| `required_trainings`    | jsonb  | Role training requirements                          | public_operational   | allow                    |
| `readiness_criteria`    | jsonb  | Role readiness criteria                             | public_operational   | allow                    |
| `service_context`       | jsonb  | Service environment context                         | public_operational   | allow                    |
| `workforce_context`     | jsonb  | Workforce environment context                       | public_operational   | allow                    |
| `compliance_context`    | jsonb  | Compliance environment context                      | public_operational   | allow                    |
| `physical_context`      | jsonb  | Physical environment context                        | public_operational   | allow                    |

---

## System intelligence fields (platform reference data)

| Field               | Type  | Description                            | Sensitivity          | External sharing default |
| ------------------- | ----- | -------------------------------------- | -------------------- | ------------------------ |
| `page_id`           | uuid  | System page identifier                 | internal_operational | deny                     |
| `function_id`       | uuid  | System function identifier             | internal_operational | deny                     |
| `capability_id`     | uuid  | System capability identifier           | internal_operational | deny                     |
| `layer_id`          | uuid  | Context layer identifier               | internal_operational | deny                     |
| `route`             | text  | App route path                         | internal_operational | deny                     |
| `module`            | text  | Module identifier                      | internal_operational | deny                     |
| `requires_role`     | text  | Minimum role for access                | internal_operational | deny                     |
| `nav_group`         | text  | Navigation group                       | internal_operational | deny                     |
| `components`        | jsonb | UI components on page                  | internal_operational | deny                     |
| `agent_actions`     | jsonb | Actions the agent can perform on page  | internal_operational | deny                     |
| `service`           | text  | Service type (edge-function, service)  | internal_operational | deny                     |
| `auth_pattern`      | text  | Authentication pattern                 | internal_operational | deny                     |
| `endpoint`          | text  | Service endpoint URL                   | internal_operational | deny                     |
| `scopes`            | jsonb | API scopes for function                | internal_operational | deny                     |
| `tools`             | jsonb | Full tool list for capability          | internal_operational | deny                     |
| `read_only_tools`   | jsonb | Read-only tool subset                  | internal_operational | deny                     |
| `suggest_tools`     | jsonb | Suggest-only tool subset               | internal_operational | deny                     |
| `default_authority` | text  | Default authority level for capability | internal_operational | deny                     |
| `sequence`          | int   | Context layer priority (1-5)           | internal_operational | deny                     |
| `source_tables`     | jsonb | Tables sourcing this context layer     | internal_operational | deny                     |
| `collector_method`  | text  | Method name for context collection     | internal_operational | deny                     |
| `failure_mode`      | text  | Behavior on layer load failure         | internal_operational | deny                     |
```

**Step 2: Update `updated:` date in frontmatter to `2026-03-06`**

**Step 3: Commit**

```bash
git add docs/reference/API_DATA_DICTIONARY.md
git commit -m "docs: add context handshake fields to API_DATA_DICTIONARY.md"
```

---

### Task 8: Update CLAUDE.md Critical Traps

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add to "Database — Critical Traps" section**

After the existing `engine_sessions.mode` bullet, add:

```markdown
- `industry_vertical` table, NOT `industry` — the enum `industry` already exists on `company`. Use `industry_vertical` for the table.
- `system_capability` stores platform defaults (default_authority), `engine_authority_config` stores workspace overrides (authority_level). Authority = max(default, override).
- Industry tables (`industry_*`) have no `workspace_id` — they are platform-level reference data. Workspace binds via `workspace.industry_vertical_id` + `workspace.niche_id`.
- System tables (`system_*`) have no `workspace_id` — they are platform-level reference data. Read: authenticated. Write: service_role only.
```

**Step 2: Update changelog**

Add to the changelog table:

```markdown
| 2026-03-06 | 8.2.0 | Context Handshake: 9 tables (5 industry + 4 system intelligence), seed data, workspace binding, Playpark tab | Claude |
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add context handshake critical traps to CLAUDE.md"
```

---

### Task 9: Final Verification

**Step 1: Run full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 new errors.

**Step 2: Run showcase tests**

Run: `cd apps/web && npx vitest run src/app/onboarding/showcase --reporter=verbose`
Expected: All existing tests pass.

**Step 3: Verify migration applies cleanly**

Run: `npx supabase db reset`
Expected: All migrations apply, seed data loads.

**Step 4: Final commit (if any formatting changes)**

```bash
git add -A
git commit -m "chore: context handshake final cleanup"
```

---

## Summary

| Task | What                                                       | Files                                      |
| ---- | ---------------------------------------------------------- | ------------------------------------------ |
| 1    | Industry intelligence tables (5) + RLS + workspace binding | `supabase/migrations/20260409100000_*.sql` |
| 2    | System intelligence tables (4) + RLS                       | `supabase/migrations/20260409100100_*.sql` |
| 3    | Seed data (hospitality + system)                           | `supabase/migrations/20260409100200_*.sql` |
| 4    | Regenerate database.types.ts                               | `packages/supabase/src/database.types.ts`  |
| 5    | Context Handshake tab in EnginePlaypark                    | `EnginePlaypark.tsx`                       |
| 6    | Update DATABASE.md                                         | `docs/reference/DATABASE.md`               |
| 7    | Update API_DATA_DICTIONARY.md                              | `docs/reference/API_DATA_DICTIONARY.md`    |
| 8    | Update CLAUDE.md                                           | `CLAUDE.md`                                |
| 9    | Final verification                                         | All files                                  |

## Future Wiring (NOT in this plan)

1. `collector.ts` — Add `loadDomainContext(workspaceId)` joining through `workspace.industry_vertical_id`
2. `prompt-builder.ts` — Inject domain context into the `context` parameter
3. `posture.ts` — Add niche adjustment layer via `deriveNichePosture(niche, environment)`
4. `registry.ts` — Migrate from hardcoded to DB-backed `system_capability` loader
