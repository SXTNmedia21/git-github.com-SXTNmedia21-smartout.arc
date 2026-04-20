BEGIN;

-- strike-mcp generated migration
-- entity: departments
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-16T13:16:01.469Z
-- rows: 3
-- REVIEW BEFORE APPLYING

INSERT INTO public.department (updated_at, created_at, name, department_id, workspace_id, slug, source) VALUES ('2026-02-10T01:05:49.147Z', '2023-05-02T20:40:50.798Z', 'Restaurant', '3c44614d-391b-5203-88f0-c9700974d310', '65532a8c-9571-5e8f-8890-f551ed242795', 'restaurant', 'bubble_migration');
INSERT INTO public.department (updated_at, created_at, name, department_id, workspace_id, slug, source) VALUES ('2026-02-10T01:05:48.741Z', '2023-05-02T20:47:37.484Z', 'Hagen', 'a269cbfa-c33a-5d86-8e55-8c9d04f14fa5', '65532a8c-9571-5e8f-8890-f551ed242795', 'hagen', 'bubble_migration');
INSERT INTO public.department (updated_at, created_at, name, department_id, workspace_id, slug, source) VALUES ('2026-02-10T01:05:48.451Z', '2023-05-02T20:48:00.352Z', 'Brennvinsbaren', 'be6bdb00-09d9-518a-a876-cbb2f4382d47', '65532a8c-9571-5e8f-8890-f551ed242795', 'brennvinsbaren', 'bubble_migration');

COMMIT;
