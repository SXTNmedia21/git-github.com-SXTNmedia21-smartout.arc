-- ⚠ APPLY-BLOCKED until strike-auth-bridge package pre-creates auth.users entries.
-- See ADR-0006 strike-mcp + smartout.ai migration runbook.
BEGIN;

-- strike-mcp generated migration
-- entity: users
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-16T13:16:02.580Z
-- rows: 3
-- REVIEW BEFORE APPLYING

INSERT INTO public.user_identity (email, user_id, first_name, phone, updated_at, created_at, last_name) VALUES ('anneli@sf-nett.no', '69d30a6f-170a-545d-af11-13306e5fbc77', 'Anneli', '+4790947852', '2025-06-25T20:22:21.552Z', '2023-05-17T08:05:24.637Z', 'Eilertsen Ødegård');
INSERT INTO public.user_identity (email, user_id, first_name, phone, updated_at, created_at, last_name) VALUES ('nataliewille@live.no', '216ea491-9507-5c26-bc59-3ec2a410364e', 'Natalie', '98809639', '2025-06-25T20:22:21.134Z', '2023-05-25T10:10:22.693Z', 'Både Larsen Wille');
INSERT INTO public.user_identity (email, user_id, first_name, phone, updated_at, created_at, last_name) VALUES ('erikoverbo@icloud.com', '58a79d96-7d03-5f49-9696-ac5eb1d851df', 'Erik', '+4741330665', '2025-06-25T20:22:20.760Z', '2023-05-25T16:22:24.032Z', 'Haarr Øverbø');

COMMIT;
