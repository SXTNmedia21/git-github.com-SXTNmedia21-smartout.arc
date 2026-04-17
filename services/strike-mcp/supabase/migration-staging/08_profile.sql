BEGIN;

-- strike-mcp generated migration
-- entity: profiles
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-16T13:16:11.455Z
-- rows: 3
-- REVIEW BEFORE APPLYING

INSERT INTO public.profile (avatar_url, profile_id, user_id, department_id, updated_at, workspace_id, created_at, display_name, external_employee_number, profile_code, company_id, source) VALUES ('//2c7b72955cb81ec1a99b821510a561cb.cdn.bubble.io/f1728512128727x874643955987913300/Sheriffen.jpeg', '60eb4841-d996-53e5-be81-32054de660cb', '063800c2-17bc-5a16-aa8e-efeea3444355', '3c44614d-391b-5203-88f0-c9700974d310', '2025-10-07T05:51:00.681Z', '65532a8c-9571-5e8f-8890-f551ed242795', '2023-05-02T20:25:57.481Z', 'Pontus lindroth W', NULL, 'EMP-60eb4841', '8d22ac74-1813-510e-81b1-e742e5aaf813', 'bubble_migration');
INSERT INTO public.profile (avatar_url, profile_id, user_id, department_id, updated_at, workspace_id, created_at, display_name, external_employee_number, profile_code, company_id, source) VALUES ('//2c7b72955cb81ec1a99b821510a561cb.cdn.bubble.io/f1692210000869x922316677202028200/pngkey.com-tracy-mcgrady-png-1579943.png', 'caa25396-07cb-5b06-b3bf-8ca9d86ff0c3', '216ea491-9507-5c26-bc59-3ec2a410364e', '3c44614d-391b-5203-88f0-c9700974d310', '2025-07-04T18:22:41.504Z', '65532a8c-9571-5e8f-8890-f551ed242795', '2023-05-25T10:10:21.525Z', 'Natalie Wille', NULL, 'EMP-caa25396', '8d22ac74-1813-510e-81b1-e742e5aaf813', 'bubble_migration');
INSERT INTO public.profile (avatar_url, profile_id, user_id, department_id, updated_at, workspace_id, created_at, display_name, external_employee_number, profile_code, company_id, source) VALUES ('//s3.amazonaws.com/appforest_uf/f1673205780607x113584523158737800/pngkey.com-tracy-mcgrady-png-1579943.png?q=5', '56a19bbc-658e-56a4-a644-9941d745e3bd', '7376bfd1-2c6b-5896-9f45-28b11fea7521', NULL, '2025-06-25T20:22:18.505Z', '65532a8c-9571-5e8f-8890-f551ed242795', '2023-06-08T11:16:13.544Z', 'Erik Olstad', NULL, 'EMP-56a19bbc', '8d22ac74-1813-510e-81b1-e742e5aaf813', 'bubble_migration');

COMMIT;
