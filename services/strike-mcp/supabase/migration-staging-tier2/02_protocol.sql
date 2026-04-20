-- strike-mcp Tier 2 extraction (content-extraction approach)
-- entity: protocol
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-17T18:23:31.793Z
-- rows: 2
-- REVIEW BEFORE APPLYING
-- DRY-RUN ONLY — inherits Tier 1 strike-auth-bridge gate
-- See docs/superpowers/specs/2026-04-17-tier2-content-extraction.md

BEGIN;
INSERT INTO public.protocol (protocol_id, policy_id, workspace_id, name, description, version, status, owner_profile_id, created_by, provenance) VALUES ('845d5b9b-bd2c-5d71-beb6-9b76e4fa8e91', 'f689174a-89e1-52b9-ad69-cab712335f94', '65532a8c-9571-5e8f-8890-f551ed242795', '[IMPORT] Wrightegaarden 123', NULL, '1.0', 'draft', '60eb4841-d996-53e5-be81-32054de660cb', '60eb4841-d996-53e5-be81-32054de660cb', '{"origin":"bubble-import","bubble_id":"1739874949110x885713510733185000","migrated_at":"2026-04-17T18:23:31.790Z","tenant":"wrightegaarden","batch":"2026-04-17T18:23:31.789Z"}') ON CONFLICT (protocol_id) DO NOTHING;
INSERT INTO public.protocol (protocol_id, policy_id, workspace_id, name, description, version, status, owner_profile_id, created_by, provenance) VALUES ('66460907-8eae-5623-ad5f-ebc9b7eacd5d', '064c857a-e30c-5a69-9af2-f8c2e5a693bd', '65532a8c-9571-5e8f-8890-f551ed242795', '[IMPORT] Operational procedures', 'Auto-generated container holding all live operational activities migrated from Bubble. Live = Published status AND Active 🚫 = true. Deleted-in-Bubble activities (Active 🚫 = false) and drafts are skipped.', '1.0', 'draft', '60eb4841-d996-53e5-be81-32054de660cb', '60eb4841-d996-53e5-be81-32054de660cb', '{"origin":"bubble-import","bubble_id":"synthetic:wrightegaarden:operational_procedures","migrated_at":"2026-04-17T18:23:31.790Z","tenant":"wrightegaarden","batch":"2026-04-17T18:23:31.789Z"}') ON CONFLICT (protocol_id) DO NOTHING;

COMMIT;
