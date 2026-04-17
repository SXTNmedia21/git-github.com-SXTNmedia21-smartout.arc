BEGIN;

-- strike-mcp generated migration
-- entity: shifts
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-17T08:19:41.640Z
-- rows: 5
-- REVIEW BEFORE APPLYING

INSERT INTO public.schedule_shift (schedule_shift_id, workspace_id, employee_id, team_id, department_id, is_published, work_hours, created_at, updated_at, shift_date, start_time, end_time, source, day_category, role) VALUES ('7f8f34b7-e99b-5c23-ab07-16855b7d869e', '65532a8c-9571-5e8f-8890-f551ed242795', '4d311321-e15f-5840-ac72-d4cad163d0a6', 'df818e92-4da3-5fdc-91ec-b66809db2470', 'a269cbfa-c33a-5d86-8e55-8c9d04f14fa5', true, 6.83, '2024-06-19T17:26:39.093Z', '2025-12-18T12:37:51.112Z', '2024-06-14', '14:30:00', '21:20:00', 'bubble_migration', 'weekday', 'Vakt');
INSERT INTO public.schedule_shift (schedule_shift_id, workspace_id, employee_id, team_id, department_id, is_published, work_hours, created_at, updated_at, shift_date, start_time, end_time, source, day_category, role) VALUES ('c2e35e2d-b25a-5fc2-9b3a-f5aa5a7a20c3', '65532a8c-9571-5e8f-8890-f551ed242795', '9059649d-858e-505a-ae9c-65211a594db8', '430e61e9-2111-5e12-b2ae-894140ce5f5c', 'be6bdb00-09d9-518a-a876-cbb2f4382d47', true, 7.5, '2024-06-19T17:26:39.959Z', '2025-10-20T09:00:11.992Z', '2024-06-15', '17:00:00', '00:30:00', 'bubble_migration', 'weekday', 'Vakt');
INSERT INTO public.schedule_shift (schedule_shift_id, workspace_id, employee_id, team_id, department_id, is_published, work_hours, created_at, updated_at, shift_date, start_time, end_time, source, day_category, role) VALUES ('9d69ed30-357d-5c6c-ba04-ad980e384328', '65532a8c-9571-5e8f-8890-f551ed242795', '0903477b-8308-5c56-84a0-4597dd0687b7', 'd71e4083-f14d-58e2-aee4-de63be290723', '3c44614d-391b-5203-88f0-c9700974d310', true, 8, '2024-06-19T17:26:41.110Z', '2025-12-18T12:37:51.122Z', '2024-06-15', '14:00:00', '22:00:00', 'bubble_migration', 'weekday', 'Vakt');
INSERT INTO public.schedule_shift (schedule_shift_id, workspace_id, employee_id, team_id, department_id, is_published, work_hours, created_at, updated_at, shift_date, start_time, end_time, source, day_category, role) VALUES ('79a981fd-1a32-5b16-9dfd-8ad63a05311d', '65532a8c-9571-5e8f-8890-f551ed242795', '829bd8ba-5262-5a5f-940b-df204ab0c64d', 'e92d5126-2c56-5b72-b9b7-79e302138805', 'a269cbfa-c33a-5d86-8e55-8c9d04f14fa5', true, 2, '2024-06-19T17:26:42.015Z', '2025-12-18T12:37:51.139Z', '2024-06-12', '13:38:00', '15:38:00', 'bubble_migration', 'weekday', 'Vakt');
INSERT INTO public.schedule_shift (schedule_shift_id, workspace_id, employee_id, team_id, department_id, is_published, work_hours, created_at, updated_at, shift_date, start_time, end_time, source, day_category, role) VALUES ('24417b55-22a2-5e48-a982-e73b85580adb', '65532a8c-9571-5e8f-8890-f551ed242795', '7faffef0-b6c1-5bb9-82f5-6e010ab4b8d9', 'd71e4083-f14d-58e2-aee4-de63be290723', '3c44614d-391b-5203-88f0-c9700974d310', true, 5.23, '2024-06-19T17:26:42.952Z', '2025-12-18T12:37:51.149Z', '2024-06-10', '08:01:00', '13:15:00', 'bubble_migration', 'weekday', 'Vakt');

COMMIT;
