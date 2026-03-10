-- Add opening_hours JSONB to season table
-- Structure: { "department_name": { "mon": "09:00-22:00", ... }, ... }
-- Opening hours live on season (not department) because the same department
-- can have different hours in different seasons.
ALTER TABLE season ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}';

COMMENT ON COLUMN season.opening_hours IS 'Per-department opening hours per weekday. Structure: { "Kitchen": { "mon": "09:00-22:00", ... } }';
