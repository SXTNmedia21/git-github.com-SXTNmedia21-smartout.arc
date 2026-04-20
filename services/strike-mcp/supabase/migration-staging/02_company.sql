BEGIN;

-- strike-mcp generated migration
-- entity: company
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-16T13:15:59.348Z
-- rows: 1
-- REVIEW BEFORE APPLYING

INSERT INTO public.company (email, logo_url, updated_at, org_number, legal_name, company_id, created_at, name, phone, city, postal_code, billing_email, address_line_1, source) VALUES ('jorn@wrightegaarden.no', '//2c7b72955cb81ec1a99b821510a561cb.cdn.bubble.io/f1687200285762x938832837899618700/Wrightegaarden.png', '2025-06-04T08:15:34.011Z', '929024354', NULL, '8d22ac74-1813-510e-81b1-e742e5aaf813', '2023-05-02T20:25:56.230Z', 'Wrightegaarden Langesund AS', NULL, 'Langesund', NULL, NULL, NULL, 'bubble_migration');

COMMIT;
