-- strike-mcp Tier 2 extraction (content-extraction approach)
-- entity: policy
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-17T18:23:31.793Z
-- rows: 2
-- REVIEW BEFORE APPLYING
-- DRY-RUN ONLY — inherits Tier 1 strike-auth-bridge gate
-- See docs/superpowers/specs/2026-04-17-tier2-content-extraction.md

BEGIN;
INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, scope_ref_id, name, description, statement, enforcement_status, rules_json, valid_from, valid_to, priority, is_active, created_by, provenance) VALUES ('f689174a-89e1-52b9-ad69-cab712335f94', '65532a8c-9571-5e8f-8890-f551ed242795', NULL, 'operational', 'workspace', NULL, '[IMPORT] Wrightegaarden 123', 'Auto-generated bookkeeping policy paired 1:1 with a migrated protocol. UNIQUE(policy_id) on protocol enforces pairing. Created by strike-mcp Tier 2.', 'Employees should complete the paired migrated protocol. Bookkeeping-only — not an enforced business policy until reviewed.', 'aspirational', NULL, NULL, NULL, 0, true, '60eb4841-d996-53e5-be81-32054de660cb', '{"origin":"bubble-import","bubble_id":"1739874949110x885713510733185000","migrated_at":"2026-04-17T18:23:31.790Z","tenant":"wrightegaarden","batch":"2026-04-17T18:23:31.789Z"}') ON CONFLICT (policy_id) DO NOTHING;
INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, scope_ref_id, name, description, statement, enforcement_status, rules_json, valid_from, valid_to, priority, is_active, created_by, provenance) VALUES ('064c857a-e30c-5a69-9af2-f8c2e5a693bd', '65532a8c-9571-5e8f-8890-f551ed242795', NULL, 'operational', 'workspace', NULL, '[IMPORT] Operational procedures', 'Auto-generated bookkeeping policy paired 1:1 with a migrated protocol. UNIQUE(policy_id) on protocol enforces pairing. Created by strike-mcp Tier 2.', 'Employees should complete the paired migrated protocol. Bookkeeping-only — not an enforced business policy until reviewed.', 'aspirational', NULL, NULL, NULL, 0, true, '60eb4841-d996-53e5-be81-32054de660cb', '{"origin":"bubble-import","bubble_id":"synthetic:wrightegaarden:operational_procedures","migrated_at":"2026-04-17T18:23:31.790Z","tenant":"wrightegaarden","batch":"2026-04-17T18:23:31.789Z"}') ON CONFLICT (policy_id) DO NOTHING;

COMMIT;
