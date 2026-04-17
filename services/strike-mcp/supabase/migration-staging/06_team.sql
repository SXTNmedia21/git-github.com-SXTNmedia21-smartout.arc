BEGIN;

-- strike-mcp generated migration
-- entity: teams
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-16T13:16:01.890Z
-- rows: 3
-- REVIEW BEFORE APPLYING

INSERT INTO public.team (updated_at, workspace_id, name, color, team_id, created_at, department_id, description, slug, source) VALUES ('2025-10-20T09:00:21.437Z', '65532a8c-9571-5e8f-8890-f551ed242795', 'Servitør', NULL, 'd71e4083-f14d-58e2-aee4-de63be290723', '2023-05-02T21:56:11.856Z', '3c44614d-391b-5203-88f0-c9700974d310', NULL, 'servitor', 'bubble_migration');
INSERT INTO public.team (updated_at, workspace_id, name, color, team_id, created_at, department_id, description, slug, source) VALUES ('2025-10-20T09:00:22.086Z', '65532a8c-9571-5e8f-8890-f551ed242795', 'Hovmester', NULL, 'b07b72f1-dfdc-567f-8592-d4dacb4c810b', '2023-05-02T21:56:20.181Z', '3c44614d-391b-5203-88f0-c9700974d310', NULL, 'hovmester', 'bubble_migration');
INSERT INTO public.team (updated_at, workspace_id, name, color, team_id, created_at, department_id, description, slug, source) VALUES ('2025-10-20T09:00:25.609Z', '65532a8c-9571-5e8f-8890-f551ed242795', 'Vert Restaurant', NULL, '48375d76-44db-5f1a-bb10-f3e0e0ed819d', '2023-05-02T21:56:30.242Z', '3c44614d-391b-5203-88f0-c9700974d310', NULL, 'vert-restaurant', 'bubble_migration');

COMMIT;
