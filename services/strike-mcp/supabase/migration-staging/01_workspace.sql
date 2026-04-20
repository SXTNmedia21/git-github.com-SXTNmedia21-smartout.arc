BEGIN;

-- strike-mcp generated migration
-- entity: workspace
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-16T13:15:59.035Z
-- rows: 1
-- REVIEW BEFORE APPLYING

INSERT INTO public.workspace (company_id, created_at, name, logo_url, workspace_id, updated_at, language, brand_color, phone, address_line_1, slug, source) VALUES ('8d22ac74-1813-510e-81b1-e742e5aaf813', '2023-05-02T20:25:56.753Z', 'Wrightegaarden', '//2c7b72955cb81ec1a99b821510a561cb.cdn.bubble.io/f1687200285762x938832837899618700/Wrightegaarden.png', '65532a8c-9571-5e8f-8890-f551ed242795', '2025-10-20T09:00:19.457Z', 'Norwegian', '#2c76e4', NULL, NULL, 'wrightegaarden', 'bubble_migration');

COMMIT;
