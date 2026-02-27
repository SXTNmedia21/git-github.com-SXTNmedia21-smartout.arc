-- Migration för att synkronisera databasen med Module 2: Org Structure

-- 1. Skapa Enum för asset_type
CREATE TYPE asset_type AS ENUM ('equipment', 'safety', 'storage', 'station', 'other');

-- 2. Uppdatera Zone-tabellen
ALTER TABLE public.zone
ADD COLUMN season_id uuid REFERENCES public.season(season_id),
ADD COLUMN color text,
ADD COLUMN sort_order integer DEFAULT 0;

-- 3. Uppdatera Asset-tabellen
ALTER TABLE public.asset
ADD COLUMN slug text,
ADD COLUMN asset_type asset_type NOT NULL DEFAULT 'other',
ADD COLUMN icon text,
ADD COLUMN season_id uuid REFERENCES public.season(season_id),
ADD COLUMN sort_order integer DEFAULT 0;

-- 4. Uppdatera Position-tabellen
ALTER TABLE public.position
ADD COLUMN season_id uuid REFERENCES public.season(season_id),
ADD COLUMN color text,
ADD COLUMN icon text,
ADD COLUMN sort_order integer DEFAULT 0;

-- Notera: minimum_role finns redan i Position (motsvarar min_role_level i docs).
