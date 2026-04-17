BEGIN;

-- strike-mcp generated migration
-- entity: employee_types
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-16T13:16:00.494Z
-- rows: 3
-- REVIEW BEFORE APPLYING

INSERT INTO public.employee_type (fixed_salary, days_trial_period, accounting_account_code, employee_type_id, updated_at, max_hours_week, workspace_id, created_at, max_vacation_days, title, color_pallet) VALUES (true, 0, '2000', 'e372f860-221d-54f7-a7db-dd2707268502', '2025-05-06T09:19:39.893Z', 37.5, '65532a8c-9571-5e8f-8890-f551ed242795', '2023-12-19T21:50:58.234Z', 0, 'Månedslønn', NULL);
INSERT INTO public.employee_type (fixed_salary, days_trial_period, accounting_account_code, employee_type_id, updated_at, max_hours_week, workspace_id, created_at, max_vacation_days, title, color_pallet) VALUES (false, 0, '2001', '6dfd5098-fd23-53ce-b722-53aa68e714ac', '2024-06-19T09:27:15.540Z', 37.5, '65532a8c-9571-5e8f-8890-f551ed242795', '2023-12-19T21:50:58.243Z', 0, 'Timelønn sesongmedarbeider', NULL);
INSERT INTO public.employee_type (fixed_salary, days_trial_period, accounting_account_code, employee_type_id, updated_at, max_hours_week, workspace_id, created_at, max_vacation_days, title, color_pallet) VALUES (false, NULL, NULL, '6fcbf0ec-8ddd-5099-a770-1e40262a8812', '2025-04-14T11:48:21.609Z', NULL, '65532a8c-9571-5e8f-8890-f551ed242795', '2025-04-14T11:48:21.607Z', NULL, 'Frivillig', 'Curious Blue');

COMMIT;
