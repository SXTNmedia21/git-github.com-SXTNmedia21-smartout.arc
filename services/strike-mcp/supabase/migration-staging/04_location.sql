BEGIN;

-- strike-mcp generated migration
-- entity: locations
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-16T13:16:00.909Z
-- rows: 3
-- REVIEW BEFORE APPLYING

INSERT INTO public.location (is_active, name, updated_at, workspace_id, created_at, location_id, sort_order, description, slug, source) VALUES (true, 'Kjøkken lager', '2023-05-03T07:00:43.923Z', '65532a8c-9571-5e8f-8890-f551ed242795', '2023-05-02T20:49:33.967Z', '52766a34-fc07-5ee3-aa6b-7b749d64a43c', NULL, NULL, 'kjokken-lager', 'bubble_migration');
INSERT INTO public.location (is_active, name, updated_at, workspace_id, created_at, location_id, sort_order, description, slug, source) VALUES (true, 'Kjeller lager', '2023-05-03T07:00:50.536Z', '65532a8c-9571-5e8f-8890-f551ed242795', '2023-05-02T20:51:04.908Z', '9bcbf745-1bf9-5694-b4f8-ffbe1666c90f', NULL, NULL, 'kjeller-lager', 'bubble_migration');
INSERT INTO public.location (is_active, name, updated_at, workspace_id, created_at, location_id, sort_order, description, slug, source) VALUES (true, 'Hovedlager', '2023-05-03T07:00:56.676Z', '65532a8c-9571-5e8f-8890-f551ed242795', '2023-05-02T20:52:05.452Z', 'c6f0c396-206c-55e5-95f1-d07a541e8a41', NULL, NULL, 'hovedlager', 'bubble_migration');

COMMIT;
