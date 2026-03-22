-- ============================================
-- 20260422110900_website_factory_builder_compat.sql
-- Add compatibility columns/defaults so the
-- website builder actions can write against
-- the current websites schema.
-- Why: the local builder code writes fields
-- from the builder plan that the foundation
-- schema does not currently expose.
-- ============================================

BEGIN;

ALTER TABLE websites.website
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE websites.website_domain
  ADD COLUMN IF NOT EXISTS hostname text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

UPDATE websites.website_domain
SET
  hostname = COALESCE(hostname, domain),
  is_verified = COALESCE(is_verified, verified_at IS NOT NULL OR status IN ('verified', 'active'));

ALTER TABLE websites.website_draft_revision
  ADD COLUMN IF NOT EXISTS changed_by uuid,
  ADD COLUMN IF NOT EXISTS change_summary text;

ALTER TABLE websites.website_draft_revision
  ALTER COLUMN revision_number DROP NOT NULL,
  ALTER COLUMN draft_data DROP NOT NULL,
  ALTER COLUMN schema_version DROP NOT NULL,
  ALTER COLUMN template_key DROP NOT NULL,
  ALTER COLUMN template_version DROP NOT NULL;

CREATE OR REPLACE FUNCTION websites.apply_builder_domain_defaults()
RETURNS trigger AS $$
BEGIN
  NEW.hostname := COALESCE(NEW.hostname, NEW.domain);
  NEW.domain := COALESCE(NEW.domain, NEW.hostname);
  NEW.domain_type := COALESCE(NEW.domain_type, 'platform_subdomain');

  IF NEW.is_verified AND NEW.verified_at IS NULL THEN
    NEW.verified_at := now();
  END IF;

  IF NEW.is_verified AND (NEW.status IS NULL OR NEW.status = 'pending_verification') THEN
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS builder_domain_defaults ON websites.website_domain;
CREATE TRIGGER builder_domain_defaults
  BEFORE INSERT OR UPDATE ON websites.website_domain
  FOR EACH ROW
  EXECUTE FUNCTION websites.apply_builder_domain_defaults();

CREATE OR REPLACE FUNCTION websites.apply_builder_revision_defaults()
RETURNS trigger AS $$
DECLARE
  website_meta RECORD;
BEGIN
  IF NEW.revision_number IS NULL THEN
    SELECT COALESCE(MAX(revision_number), 0) + 1
    INTO NEW.revision_number
    FROM websites.website_draft_revision
    WHERE website_id = NEW.website_id;
  END IF;

  IF NEW.draft_data IS NULL THEN
    NEW.draft_data := '{}'::jsonb;
  END IF;

  IF NEW.schema_version IS NULL THEN
    NEW.schema_version := 1;
  END IF;

  IF NEW.template_key IS NULL OR NEW.template_version IS NULL THEN
    SELECT template_key, template_version
    INTO website_meta
    FROM websites.website
    WHERE website_id = NEW.website_id;

    NEW.template_key := COALESCE(NEW.template_key, website_meta.template_key, 'unknown');
    NEW.template_version := COALESCE(NEW.template_version, website_meta.template_version, 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS builder_revision_defaults ON websites.website_draft_revision;
CREATE TRIGGER builder_revision_defaults
  BEFORE INSERT OR UPDATE ON websites.website_draft_revision
  FOR EACH ROW
  EXECUTE FUNCTION websites.apply_builder_revision_defaults();

NOTIFY pgrst, 'reload schema';

COMMIT;
