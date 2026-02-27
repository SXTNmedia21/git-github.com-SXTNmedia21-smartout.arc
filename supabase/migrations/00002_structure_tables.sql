-- Enums
CREATE TYPE location_type AS ENUM ('main', 'outdoor', 'kitchen', 'event', 'storage', 'other');
CREATE TYPE team_type AS ENUM ('operational', 'access', 'cross_department', 'seasonal', 'custom');
CREATE TYPE season_type AS ENUM ('default', 'calendar', 'focus', 'cycle', 'custom');
CREATE TYPE season_status AS ENUM ('draft', 'active', 'archived');

-- Season
CREATE TABLE public.season (
  season_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  parent_season_id uuid,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  season_type season_type NOT NULL DEFAULT 'default',
  start_date date,
  end_date date,
  status season_status NOT NULL DEFAULT 'draft',
  is_default boolean NOT NULL DEFAULT false,
  color text,
  icon text,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_season_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_season_parent FOREIGN KEY (parent_season_id) REFERENCES public.season(season_id),
  CONSTRAINT fk_season_created_by FOREIGN KEY (created_by) REFERENCES public.profile(profile_id)
);
CREATE TRIGGER set_season_updated_at BEFORE UPDATE ON public.season FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Department
CREATE TABLE public.department (
  department_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  color text,
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_department_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id)
);
CREATE TRIGGER set_department_updated_at BEFORE UPDATE ON public.department FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Location
CREATE TABLE public.location (
  location_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  address text,
  latitude float,
  longitude float,
  floor text,
  capacity integer,
  location_type location_type NOT NULL DEFAULT 'main',
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_location_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id)
);
CREATE TRIGGER set_location_updated_at BEFORE UPDATE ON public.location FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Zone
CREATE TABLE public.zone (
  zone_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  location_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  capacity integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_zone_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_zone_location FOREIGN KEY (location_id) REFERENCES public.location(location_id)
);
CREATE TRIGGER set_zone_updated_at BEFORE UPDATE ON public.zone FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Asset
CREATE TABLE public.asset (
  asset_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  location_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  requires_training boolean NOT NULL DEFAULT false,
  requires_routine boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_asset_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_asset_location FOREIGN KEY (location_id) REFERENCES public.location(location_id)
);
CREATE TRIGGER set_asset_updated_at BEFORE UPDATE ON public.asset FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Position
CREATE TABLE public.position (
  position_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  department_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  skill_requirements jsonb,
  minimum_role profile_role DEFAULT 'employee',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_position_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_position_department FOREIGN KEY (department_id) REFERENCES public.department(department_id)
);
CREATE TRIGGER set_position_updated_at BEFORE UPDATE ON public.position FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Team
CREATE TABLE public.team (
  team_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  department_id uuid,
  season_id uuid,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  color text,
  icon text,
  leader_profile_id uuid,
  team_type team_type NOT NULL DEFAULT 'operational',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_team_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_team_department FOREIGN KEY (department_id) REFERENCES public.department(department_id),
  CONSTRAINT fk_team_season FOREIGN KEY (season_id) REFERENCES public.season(season_id),
  CONSTRAINT fk_team_leader FOREIGN KEY (leader_profile_id) REFERENCES public.profile(profile_id)
);
CREATE TRIGGER set_team_updated_at BEFORE UPDATE ON public.team FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Team Member (junction)
CREATE TABLE public.team_member (
  team_member_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_team_member_team FOREIGN KEY (team_id) REFERENCES public.team(team_id),
  CONSTRAINT fk_team_member_profile FOREIGN KEY (profile_id) REFERENCES public.profile(profile_id),
  CONSTRAINT unique_team_member UNIQUE (team_id, profile_id)
);
CREATE TRIGGER set_team_member_updated_at BEFORE UPDATE ON public.team_member FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Update Profile FKs now that department and location exist
ALTER TABLE public.profile ADD CONSTRAINT fk_profile_department FOREIGN KEY (department_id) REFERENCES public.department(department_id);
ALTER TABLE public.profile ADD CONSTRAINT fk_profile_location FOREIGN KEY (location_id) REFERENCES public.location(location_id);
