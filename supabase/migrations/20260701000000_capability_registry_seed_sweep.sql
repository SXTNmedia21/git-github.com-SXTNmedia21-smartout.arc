-- ============================================================================
-- 20260701000000_capability_registry_seed_sweep.sql
--
-- BUG-A4-02 FIX + 10 sibling CVEs: seed 11 capabilities missing from
-- capability_default_registry.
--
-- ROOT CAUSE:
--   Migration 20260518000000_contract_authority_seed_upsert_and_bootstrap.sql
--   lines 235-244 explicitly deferred 13 capabilities from the registry under
--   the comment "These have never had explicit authority seeds in any migration."
--   Since then:
--     - `communication` was closed by 20260626000000 (BUG-1 ADR-0413 fix).
--     - `payroll` was closed by 20260519160000 (ADR-0234).
--   The remaining 11 have NEVER been seeded.
--
--   Effect: the workspace_seed_authority_defaults_trg trigger (installed by
--   20260518000000) iterates capability_default_registry on every new workspace
--   INSERT. With no row for these 11 capabilities, the bootstrap trigger creates
--   no engine_authority_config rows → gate_action silently default-allows every
--   caller → L-0066 CVE-class. Silent. No error. No log.
--
-- THIS MIGRATION:
--   Part A: INSERT the 11 capabilities into capability_default_registry so
--           all future workspaces auto-seed them via the bootstrap trigger.
--   Part B: Backfill engine_authority_config for every existing workspace that
--           lacks a row for each capability (one INSERT per capability).
--           Same COALESCE(owner→any_member→first_user) chain as ADR-0413 pattern.
--
-- AUTHORITY CHOICES (per capability — conservative defaults):
--   See inline comments. Rule: defaultAuthority from code wins where present;
--   for capabilities with write tools, minimum 'suggest'; PII mutations = 'confirm'.
--   Deviations from defaultAuthority are annotated.
--
-- IDEMPOTENCY: ON CONFLICT (capability) DO NOTHING for registry;
--              ON CONFLICT (workspace_id, capability) DO NOTHING for backfill.
--              Safe to replay on db reset (L-0042).
--
-- ADR references: ADR-0413 (registry single source of truth), ADR-0192
-- (bootstrap trigger pattern), L-0066 (CVE-class default-allow),
-- ADR-0421 sub-check C-G, L-0354 (restaurant-week sim council 2026-05-25).
-- ============================================================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part A — INSERT 11 capabilities into capability_default_registry
-- ─────────────────────────────────────────────────────────────────────────────
-- Each row is individually inserted (not a bulk VALUES) so that a conflict on
-- one row does not mask a missing row on another. One statement per capability.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. kb_query  ─────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/kb_query/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat']
-- Pure semantic search (searchKb), no writes, no mutations.
-- read_only / employee: every workspace member may query the KB.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'kb_query',
    'read_only',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Semantic search over workspace KB (ADR-0221). '
    'No mutations. read_only/employee: all members may search. '
    'chat-only per ADR-0078. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 2. schedule  ────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/schedule/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat','voice','system']
-- All tools are read-only queries (getMyShifts, getTodaySchedule, etc.).
-- No write/mutation tools in this capability (writes are in shift_lifecycle).
-- read_only / employee: shift queries are employee-safe.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'schedule',
    'read_only',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Shift query capability — read-only tools only. '
    'Mutations delegated to shift_lifecycle (ADR-0095). '
    'read_only/employee: all members may query own schedule. '
    'chat+voice+system per ADR-0078. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 3. training  ────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/training/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat']
-- readOnlyTools: [getMyTrainingStatus, getNextProtocol] (employee-safe)
-- suggestTools: [getTeamReadiness] (manager+ — team-level PII)
-- suggest / employee: unlocks both tiers; getTeamReadiness is constrained by
-- per-tool manager check inside execute(), so employee-level callers receive
-- only their own training data. Conservative-PENDING-REVIEW on manager check.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'training',
    'suggest',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Training + competence capability. '
    'readOnlyTools for employee (getMyTrainingStatus, getNextProtocol); '
    'suggestTools for manager (getTeamReadiness — team-level PII). '
    'suggest/employee: tier-unlock exposes both layers; per-tool role '
    'guard in execute() constrains manager tools. chat-only ADR-0163. '
    '20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 4. operations  ──────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/operations/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat']
-- readOnlyTools: [getMyTasks, getSessionInfo, getDepartmentStatus]
-- suggestTools: [createDeviation]
-- suggest / employee: createDeviation is a gated write — tier-unlock at suggest.
-- Employee can request a deviation (gate_action governs approval pathway).
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'operations',
    'suggest',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Operations reads + deviation creation. '
    'readOnlyTools for all (getMyTasks, getSessionInfo, getDepartmentStatus); '
    'suggestTools for deviations (createDeviation — gated via gate_action). '
    'suggest/employee: employees may propose deviations; gate_action governs '
    'approval. chat-only per ADR-0078. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 5. profile  ─────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/profile/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat']
-- All tools read-only (getProfile, getTeam, getContractStatus, searchProfilesByName).
-- PII-bearing (name, email, phone) — ADR-0163 chat-only, no voice.
-- read_only / employee: members may query their own profile.
-- DEFAULT-CONSERVATIVE-PENDING-REVIEW: searchProfilesByName returns team PII;
-- confirmed chat-only by ADR-0163. Authority capped read_only until a mutation
-- tool (e.g. update_profile) lands its own confirm-tier seed.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'profile',
    'read_only',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Profile reads — PII-bearing (ADR-0163 chat-only). '
    'All tools read-only (getProfile, getTeam, getContractStatus, '
    'searchProfilesByName). read_only/employee: members query own data. '
    'searchProfilesByName is team-scoped but no mutation vector. '
    'DEFAULT-CONSERVATIVE-PENDING-REVIEW: upgrade to suggest when a '
    'write tool lands. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 6. memory  ──────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/memory/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat']
-- suggestTools: [saveMemoryTool] — writes to engine_memory via gate_action.
-- suggest / employee: memory saves are opt-in per ADR-0078 PII-opt-in spec.
-- Phase A3: authority seeded for dev workspaces in 20260528000000; this seeds
-- the platform-wide default so new workspaces also receive a row.
-- Note: production workspaces stay at suggest/employee (opt-in UX flow pending).
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'memory',
    'suggest',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Workspace memory saves (engine_memory). '
    'suggestTools: [saveMemoryTool] gated via gate_action (ADR-0099). '
    'suggest/employee: opt-in per ADR-0078 PII spec. Dev workspaces seeded '
    'separately in 20260528000000; this seeds the default for new workspaces. '
    'chat-only per ADR-0078. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 7. ui  ──────────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/ui/index.ts
-- No defaultAuthority defined in code. allowedChannels: all (chat, voice, sms, email).
-- Tools: navigateTool, fillFieldTool, highlightTool, showPanelTool, toastTool.
-- readOnlyTools: [] — all tools touch the UI surface (no DB reads/writes).
-- ui tools are presentation-only — no data exfiltration, no DB mutations.
-- suggest / employee: Botsson can propose UI changes; user confirms by seeing them.
-- DEFAULT-CONSERVATIVE: no defaultAuthority in code; suggest chosen because
-- UI tools are lower-risk than data mutations but still change user context.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'ui',
    'suggest',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Presentation-only UI tools (navigate, fill, highlight, '
    'showPanel, toast). No DB reads or writes — ADR-0163 all-channels cleared. '
    'No defaultAuthority in code; suggest/employee chosen as conservative '
    'DEFAULT-CONSERVATIVE-PENDING-REVIEW: no data exfiltration vector. '
    'All channels per ADR-0078 review 2026-04-20. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 8. contract_intake  ─────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/contract-intake/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat']
-- readOnlyTools: [getIntakeProgress]
-- allTools: [getIntakeProgress, submitFieldGroup, declineIntake]
-- NO suggestTools defined — allTools implies confirm-tier required for writes.
-- submitFieldGroup collects personnummer / bank account (ADR-0078 Høy-PII).
-- confirm / employee: employee submits their own PII; confirm gate ensures
-- the employee explicitly acknowledges submission (no silent PII capture).
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'contract_intake',
    'confirm',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Contract PII intake (personnummer, bank, address). '
    'readOnlyTools: [getIntakeProgress]. Mutation tools: [submitFieldGroup, '
    'declineIntake] collect Høy-PII (ADR-0078 Channel Guard). No suggestTools '
    'defined → confirm tier required for mutations. confirm/employee: employee '
    'submits own PII with explicit gate. chat-only per ADR-0163. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 9. shift_swap  ──────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/shift-swap/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat']
-- readOnlyTools: [getSwapRequests, getSwapEligibility]
-- suggestTools: [requestSwap, respondToSwap, cancelSwap]
-- overrideSwapPipeline is autonomous-tier (admin+); omitted from suggestTools.
-- suggest / employee: employees may request/respond/cancel swaps with suggest gate.
-- Override pipeline is admin-level; present in allTools only (tier-unlock at autonomous).
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'shift_swap',
    'suggest',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Shift swap lifecycle (ADR-0078 chat-only). '
    'readOnlyTools: [getSwapRequests, getSwapEligibility]. '
    'suggestTools: [requestSwap, respondToSwap, cancelSwap]. '
    'overrideSwapPipeline is autonomous/admin-tier (in allTools only; '
    'gate_action enforces admin requirement at call time). '
    'suggest/employee: standard swap flows. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 10. shift_lifecycle  ────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/shift-lifecycle/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat','system']
-- readOnlyTools: [] — only mutations in this capability.
-- suggestTools: [publishShift, approveShift]
-- interpretShift + settleShift are system-channel-only (no direct user trigger).
-- clockInCheck is read-only but not in readOnlyTools (queried via schedule).
-- suggest / manager: shift publish + approve are manager-level operations.
-- employee cannot publish or approve a shift; conservative min_role=manager.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'shift_lifecycle',
    'suggest',
    'manager',
    false,
    72,
    'BUG-A4-02 sweep. Shift publish/approve/interpret/settle (ADR-0095). '
    'suggestTools: [publishShift, approveShift] — manager-level mutations. '
    'interpretShift + settleShift are system-channel-only (not user-triggerable). '
    'readOnlyTools empty: reads handled by schedule capability. '
    'suggest/manager: conservative — employee has no shift mutation vector. '
    'chat+system per ADR-0078. 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 11. governance  ─────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/governance/index.ts
-- defaultAuthority: 'read_only', allowedChannels: ['chat']
-- All tools read-only probes: [checkReadiness, listMandatoryProtocolsForRole]
-- No mutations. chat-only per ADR-0163 (checkReadiness contains employee PII).
-- read_only / employee: readiness checks are employee-self-service.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'governance',
    'read_only',
    'employee',
    false,
    72,
    'BUG-A4-02 sweep. Governance readiness probes — no mutations (ADR-0095). '
    'readOnlyTools: [checkReadiness, listMandatoryProtocolsForRole]. '
    'checkReadiness contains employee PII (ADR-0163 chat-only ceiling). '
    'read_only/employee: readiness is employee-self-service. '
    'ADR-0379a adds list_mandatory_protocols_for_role (PII-free but '
    'capability-ceiling preserves chat-only). 20260701000000.'
  )
ON CONFLICT (capability) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Part B — Backfill engine_authority_config for existing workspaces
-- ─────────────────────────────────────────────────────────────────────────────
-- One INSERT per capability. WHERE NOT EXISTS guard + ON CONFLICT DO NOTHING
-- makes each statement safe to replay on db reset.
-- updated_by COALESCE chain: owner/admin → any_member → first_user_in_system.
-- Mirrors 20260518000000 Part A / 20260519160000 Part B / 20260626000000 Part B.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper subquery used in all backfills (inline, not a function — forward-only):
-- COALESCE(
--   first owner/admin in workspace's company,
--   first any member in workspace's company,
--   first user_identity in system
-- )

-- B.1 kb_query
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'kb_query',
  'read_only',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'kb_query'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.2 schedule
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'schedule',
  'read_only',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'schedule'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.3 training
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'training',
  'suggest',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'training'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.4 operations
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'operations',
  'suggest',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'operations'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.5 profile
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'profile',
  'read_only',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'profile'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.6 memory
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'memory',
  'suggest',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'memory'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.7 ui
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'ui',
  'suggest',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'ui'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.8 contract_intake
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'contract_intake',
  'confirm',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'contract_intake'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.9 shift_swap
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'shift_swap',
  'suggest',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'shift_swap'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.10 shift_lifecycle
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'shift_lifecycle',
  'suggest',
  'manager',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'shift_lifecycle'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.11 governance
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'governance',
  'read_only',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'governance'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verification query (manual, not executed):
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT
--   r.capability,
--   r.level,
--   r.min_role,
--   (SELECT count(*) FROM workspace) AS workspace_count,
--   (SELECT count(*) FROM engine_authority_config eac WHERE eac.capability = r.capability) AS seeded_workspaces
-- FROM capability_default_registry r
-- WHERE r.capability IN (
--   'kb_query','schedule','training','operations','profile',
--   'memory','ui','contract_intake','shift_swap','shift_lifecycle','governance'
-- )
-- ORDER BY r.capability;
-- Expected: seeded_workspaces = workspace_count for all 11 rows.
