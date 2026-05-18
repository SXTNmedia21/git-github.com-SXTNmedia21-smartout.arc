-- 20260620110100_user_view_preference.sql
-- (Retimestamped from 20260515120050 — B1 R1-fixup, timestamp below dev tip 20260619100000)
--
-- Adds public.user_view_preference — per-user, per-workspace, per-surface UI
-- preference store. V1 use-case: schedule card density tier
-- (cozy | default | compact | pulse). Future surfaces: oversikt, contracts.
--
-- Design rationale: ADR-0331 (schedule-density-persistence).
-- Dedicated table (not a JSONB blob on profile) for RLS clarity and
-- future indexability. text + CHECK constraint instead of a new enum to
-- avoid database.types.ts regen blocking Local development; can be promoted
-- to a named enum in a follow-up migration if reused widely.
--
-- RLS:
--   JWT path (browser): user reads/writes own rows only (profile scoped to
--   matching workspace_id, user_id resolved from auth.uid()).
--   API-key path: no explicit policy — server actions use service-role with
--   manual profile_id + workspace_id guard (ADR-0151).

create table public.user_view_preference (
  user_view_preference_id  uuid primary key default gen_random_uuid(),
  profile_id               uuid not null references public.profile(profile_id) on delete cascade,
  workspace_id             uuid not null references public.workspace(workspace_id) on delete cascade,
  surface                  text not null,              -- 'schedule' | future: 'oversikt', 'contracts'
  preference_key           text not null,              -- 'density'
  preference_value         text not null,              -- 'cozy'|'default'|'compact'|'pulse'
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint user_view_preference_unique unique (profile_id, workspace_id, surface, preference_key),
  constraint user_view_preference_density_value
    check (preference_key <> 'density' or preference_value in ('cozy','default','compact','pulse'))
);

create index user_view_preference_lookup
  on public.user_view_preference (profile_id, workspace_id, surface);

alter table public.user_view_preference enable row level security;

-- updated_at trigger — matches repo convention (e.g. set_policy_updated_at)
create trigger set_user_view_preference_updated_at
  before update on public.user_view_preference
  for each row execute function public.set_updated_at();

-- JWT path (browser): user reads/writes own rows only
create policy "user_view_preference_own_jwt_select"
  on public.user_view_preference for select to authenticated
  using (profile_id = (select profile_id from public.profile where user_id = auth.uid()
                       and workspace_id = user_view_preference.workspace_id));

create policy "user_view_preference_own_jwt_write"
  on public.user_view_preference for insert to authenticated
  with check (profile_id = (select profile_id from public.profile where user_id = auth.uid()
                            and workspace_id = user_view_preference.workspace_id));

create policy "user_view_preference_own_jwt_update"
  on public.user_view_preference for update to authenticated
  using (profile_id = (select profile_id from public.profile where user_id = auth.uid()
                       and workspace_id = user_view_preference.workspace_id));

-- API-key path: no policy — server actions use service-role + manual profile/workspace guard
