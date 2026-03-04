SET search_path TO public, extensions;

-- Migration: workspace_slug_constraints
-- Purpose: Global slug uniqueness, format validation, reserved slugs table,
--          auto-generation trigger for subdomain routing.
-- Spec: docs/architecture/SMARTOUT_Subdomain_Routing_Architecture.md

-- ============================================================================
-- 1. Reserved Slugs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reserved_slug (
  slug text PRIMARY KEY,
  reason text NOT NULL DEFAULT 'infrastructure',
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.reserved_slug IS 'Infrastructure subdomains that workspaces cannot claim';

INSERT INTO public.reserved_slug (slug, reason) VALUES
  ('app', 'Portal / workspace selector'),
  ('api', 'API gateway'),
  ('docs', 'Documentation site'),
  ('www', 'Root domain alias'),
  ('admin', 'Reserved for admin'),
  ('status', 'Status page'),
  ('voice', 'Voice AI service'),
  ('staging', 'Staging environment'),
  ('dev', 'Development environment'),
  ('mail', 'Email service'),
  ('smtp', 'Email transport'),
  ('ftp', 'File transfer'),
  ('cdn', 'Content delivery'),
  ('assets', 'Static assets'),
  ('static', 'Static files'),
  ('media', 'Media files'),
  ('blog', 'Blog'),
  ('help', 'Help center'),
  ('support', 'Customer support')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. Workspace Slug Constraints
-- ============================================================================

-- Drop existing per-company unique constraint
ALTER TABLE public.workspace
  DROP CONSTRAINT IF EXISTS workspace_company_id_slug_key;

-- Add global unique constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_slug_unique') THEN
    ALTER TABLE public.workspace ADD CONSTRAINT workspace_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- Add format validation (3-50 chars, lowercase alphanumeric + hyphens)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_slug_format') THEN
    ALTER TABLE public.workspace ADD CONSTRAINT workspace_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');
  END IF;
END $$;

-- ============================================================================
-- 3. Slug Generation Trigger Function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_workspace_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter integer := 0;
BEGIN
  -- Only generate if slug is NULL or empty
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    IF EXISTS (SELECT 1 FROM public.reserved_slug WHERE slug = NEW.slug) THEN
      RAISE EXCEPTION 'Slug "%" is reserved and cannot be used', NEW.slug;
    END IF;
    RETURN NEW;
  END IF;

  -- Generate base slug from workspace name
  base_slug := lower(regexp_replace(
    regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  base_slug := left(base_slug, 50);

  IF length(base_slug) < 3 THEN
    base_slug := base_slug || '-ws';
  END IF;

  candidate := base_slug;

  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.reserved_slug WHERE slug = candidate)
       AND NOT EXISTS (SELECT 1 FROM public.workspace WHERE slug = candidate AND workspace_id <> NEW.workspace_id)
    THEN
      NEW.slug := candidate;
      RETURN NEW;
    END IF;

    counter := counter + 1;
    candidate := base_slug || '-' || counter;

    IF counter > 100 THEN
      RAISE EXCEPTION 'Could not generate unique slug for "%"', NEW.name;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- 4. Attach Trigger (INSERT only -- existing rows already have slugs)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_workspace_generate_slug ON public.workspace;

DROP TRIGGER IF EXISTS trg_workspace_generate_slug ON public.workspace;
CREATE TRIGGER trg_workspace_generate_slug
  BEFORE INSERT ON public.workspace
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_workspace_slug();

-- ============================================================================
-- 5. Index for Fast Slug Lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_slug ON public.workspace (slug);
