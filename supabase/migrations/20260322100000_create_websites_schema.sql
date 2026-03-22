-- websites schema: Website Factory bounded context
-- Spec: docs/superpowers/specs/2026-03-21-website-factory-design.md

BEGIN;

-- Schema
CREATE SCHEMA IF NOT EXISTS websites;

-- ============================================================
-- 1. websites.website — 1:1 with workspace
-- ============================================================
CREATE TABLE websites.website (
  website_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL UNIQUE REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  site_slug        text NOT NULL UNIQUE,
  name             text NOT NULL,
  tagline          text,
  theme            jsonb NOT NULL DEFAULT '{}',
  visibility       text NOT NULL DEFAULT 'draft'
                   CHECK (visibility IN ('draft', 'live', 'offline')),
  template_key     text NOT NULL,
  template_version int NOT NULL,
  booking_provider text NOT NULL DEFAULT 'none'
                   CHECK (booking_provider IN ('none', 'dinnerbooking', 'opentable', 'custom')),
  booking_url      text,
  social_links     jsonb,
  contact_email    text,
  contact_phone    text,
  contact_address  jsonb,
  default_meta_title       text,
  default_meta_description text,
  default_og_image_path    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT website_site_slug_format CHECK (site_slug ~ '^[a-z0-9-]+$' AND length(site_slug) >= 3)
);

ALTER TABLE websites.website ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. websites.website_page
-- ============================================================
CREATE TABLE websites.website_page (
  website_page_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id       uuid NOT NULL REFERENCES websites.website(website_id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES public.workspace(workspace_id),
  page_type        text NOT NULL
                   CHECK (page_type IN ('home', 'menu', 'about', 'careers', 'contact', 'gallery', 'events', 'custom')),
  slug             text NOT NULL,
  title            text NOT NULL,
  is_visible       boolean NOT NULL DEFAULT true,
  meta_title       text,
  meta_description text,
  og_image_path    text,
  sort_order       int NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT website_page_slug_format CHECK (slug ~ '^[a-z0-9-]*$')
);

CREATE UNIQUE INDEX website_page_unique_slug
  ON websites.website_page(website_id, slug) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX website_page_one_home
  ON websites.website_page(website_id) WHERE page_type = 'home' AND deleted_at IS NULL;

CREATE UNIQUE INDEX website_page_unique_sort
  ON websites.website_page(website_id, sort_order) WHERE is_visible = true AND deleted_at IS NULL;

ALTER TABLE websites.website_page ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. websites.website_section
-- ============================================================
CREATE TABLE websites.website_section (
  website_section_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_page_id    uuid NOT NULL REFERENCES websites.website_page(website_page_id) ON DELETE CASCADE,
  workspace_id       uuid NOT NULL REFERENCES public.workspace(workspace_id),
  section_type       text NOT NULL
                     CHECK (section_type IN (
                       'hero', 'rich_text', 'text_image', 'feature_grid', 'gallery',
                       'testimonials', 'cta', 'hours', 'map', 'contact',
                       'menu_preview', 'menu_full', 'faq', 'booking_cta', 'pdf_viewer', 'footer'
                     )),
  content            jsonb NOT NULL DEFAULT '{}',
  settings           jsonb NOT NULL DEFAULT '{}',
  is_visible         boolean NOT NULL DEFAULT true,
  sort_order         int NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

ALTER TABLE websites.website_section ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. websites.website_menu
-- ============================================================
CREATE TABLE websites.website_menu (
  website_menu_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id       uuid NOT NULL REFERENCES websites.website(website_id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES public.workspace(workspace_id),
  name             text NOT NULL,
  description      text,
  source_type      text NOT NULL DEFAULT 'structured'
                   CHECK (source_type IN ('structured', 'pdf')),
  pdf_storage_path text,
  sort_order       int NOT NULL DEFAULT 0,
  is_visible       boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

ALTER TABLE websites.website_menu ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. websites.website_menu_category
-- ============================================================
CREATE TABLE websites.website_menu_category (
  website_menu_category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_menu_id          uuid NOT NULL REFERENCES websites.website_menu(website_menu_id) ON DELETE CASCADE,
  website_id               uuid NOT NULL REFERENCES websites.website(website_id),
  workspace_id             uuid NOT NULL REFERENCES public.workspace(workspace_id),
  name                     text NOT NULL,
  description              text,
  sort_order               int NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

ALTER TABLE websites.website_menu_category ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. websites.website_menu_item
-- ============================================================
CREATE TABLE websites.website_menu_item (
  website_menu_item_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_menu_category_id uuid NOT NULL REFERENCES websites.website_menu_category(website_menu_category_id) ON DELETE CASCADE,
  website_id               uuid NOT NULL REFERENCES websites.website(website_id),
  workspace_id             uuid NOT NULL REFERENCES public.workspace(workspace_id),
  name                     text NOT NULL,
  description              text,
  price                    numeric(10,2),
  currency                 text NOT NULL DEFAULT 'NOK'
                           CHECK (currency IN ('NOK', 'SEK', 'DKK', 'EUR')),
  allergens                text[] DEFAULT '{}',
  dietary_tags             text[] DEFAULT '{}',
  image_asset_id           uuid,  -- FK added after website_asset table
  is_visible               boolean NOT NULL DEFAULT true,
  sort_order               int NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

ALTER TABLE websites.website_menu_item ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. websites.website_asset
-- ============================================================
CREATE TABLE websites.website_asset (
  website_asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id       uuid NOT NULL REFERENCES websites.website(website_id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES public.workspace(workspace_id),
  storage_path     text NOT NULL,
  file_name        text NOT NULL,
  mime_type        text NOT NULL,
  width            int,
  height           int,
  file_size_bytes  bigint,
  alt_text         text NOT NULL DEFAULT '',
  uploaded_by      uuid REFERENCES public.profile(profile_id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

ALTER TABLE websites.website_asset ENABLE ROW LEVEL SECURITY;

-- Now add the FK from menu_item to asset
ALTER TABLE websites.website_menu_item
  ADD CONSTRAINT website_menu_item_image_fk
  FOREIGN KEY (image_asset_id) REFERENCES websites.website_asset(website_asset_id);

-- ============================================================
-- 8. websites.website_published_snapshot
-- ============================================================
CREATE TABLE websites.website_published_snapshot (
  snapshot_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid NOT NULL REFERENCES websites.website(website_id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspace(workspace_id),
  version       int NOT NULL,
  snapshot_data jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT false,
  published_by  uuid REFERENCES public.profile(profile_id),
  published_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE UNIQUE INDEX website_snapshot_unique_version
  ON websites.website_published_snapshot(website_id, version);

CREATE UNIQUE INDEX website_snapshot_one_active
  ON websites.website_published_snapshot(website_id) WHERE is_active = true AND deleted_at IS NULL;

ALTER TABLE websites.website_published_snapshot ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. websites.website_draft_revision
-- ============================================================
CREATE TABLE websites.website_draft_revision (
  revision_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id      uuid NOT NULL REFERENCES websites.website(website_id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES public.workspace(workspace_id),
  revision_number int NOT NULL,
  draft_data      jsonb NOT NULL,
  schema_version  int NOT NULL,
  template_key    text NOT NULL,
  template_version int NOT NULL,
  source          text NOT NULL
                  CHECK (source IN ('manual', 'autosave', 'generator', 'template_apply')),
  created_by      uuid REFERENCES public.profile(profile_id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX website_revision_unique_number
  ON websites.website_draft_revision(website_id, revision_number);

ALTER TABLE websites.website_draft_revision ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. websites.website_domain
-- ============================================================
CREATE TABLE websites.website_domain (
  website_domain_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id        uuid NOT NULL REFERENCES websites.website(website_id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES public.workspace(workspace_id),
  domain            text NOT NULL UNIQUE,
  domain_type       text NOT NULL
                    CHECK (domain_type IN ('platform_subdomain', 'custom')),
  is_primary        boolean NOT NULL DEFAULT false,
  redirect_behavior text NOT NULL DEFAULT 'redirect_to_primary'
                    CHECK (redirect_behavior IN ('primary_only', 'serve_direct', 'redirect_to_primary')),
  status            text NOT NULL DEFAULT 'pending_verification'
                    CHECK (status IN ('pending_verification', 'verified', 'failed', 'active')),
  verification_token text,
  verified_at       timestamptz,
  ssl_status        text NOT NULL DEFAULT 'pending'
                    CHECK (ssl_status IN ('pending', 'active', 'error')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE UNIQUE INDEX website_domain_one_primary
  ON websites.website_domain(website_id) WHERE is_primary = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX website_domain_one_platform
  ON websites.website_domain(website_id) WHERE domain_type = 'platform_subdomain' AND deleted_at IS NULL;

ALTER TABLE websites.website_domain ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. websites.website_preview_session
-- ============================================================
CREATE TABLE websites.website_preview_session (
  preview_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id         uuid NOT NULL REFERENCES websites.website(website_id) ON DELETE CASCADE,
  workspace_id       uuid NOT NULL REFERENCES public.workspace(workspace_id),
  token              text NOT NULL UNIQUE,
  revision_id        uuid NOT NULL REFERENCES websites.website_draft_revision(revision_id),
  created_by         uuid REFERENCES public.profile(profile_id),
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_expires_after_created CHECK (expires_at > created_at)
);

ALTER TABLE websites.website_preview_session ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. websites.website_publish_event
-- ============================================================
CREATE TABLE websites.website_publish_event (
  publish_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id       uuid NOT NULL REFERENCES websites.website(website_id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES public.workspace(workspace_id),
  snapshot_id      uuid REFERENCES websites.website_published_snapshot(snapshot_id),
  action           text NOT NULL
                   CHECK (action IN ('publish', 'rollback', 'unpublish')),
  performed_by     uuid REFERENCES public.profile(profile_id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE websites.website_publish_event ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Triggers: set_updated_at
-- ============================================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website_page
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website_section
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website_menu
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website_menu_category
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website_menu_item
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website_asset
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website_published_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites.website_domain
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Triggers: workspace_id consistency
-- ============================================================

-- For tables that have a direct website_id FK
CREATE OR REPLACE FUNCTION websites.enforce_workspace_consistency_website()
RETURNS trigger AS $$
BEGIN
  IF NEW.workspace_id != (
    SELECT w.workspace_id FROM websites.website w WHERE w.website_id = NEW.website_id
  ) THEN
    RAISE EXCEPTION 'workspace_id mismatch: child does not match parent website';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = websites, public;

-- For tables that reference via website_page_id (no direct website_id)
CREATE OR REPLACE FUNCTION websites.enforce_workspace_consistency_via_page()
RETURNS trigger AS $$
BEGIN
  IF NEW.workspace_id != (
    SELECT w.workspace_id FROM websites.website w
    JOIN websites.website_page wp ON wp.website_id = w.website_id
    WHERE wp.website_page_id = NEW.website_page_id
  ) THEN
    RAISE EXCEPTION 'workspace_id mismatch: section does not match parent website via page';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = websites, public;

-- Apply to child tables with direct website_id FK
CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_page
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_menu
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_menu_category
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_menu_item
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_asset
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_published_snapshot
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_draft_revision
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_domain
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_preview_session
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_publish_event
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

-- website_section uses page-level lookup (no direct website_id column)
CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_section
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_via_page();

-- ============================================================
-- Indexes for common queries
-- ============================================================
CREATE INDEX idx_website_workspace ON websites.website(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_website_page_website ON websites.website_page(website_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_website_section_page ON websites.website_section(website_page_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_website_menu_website ON websites.website_menu(website_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_website_menu_cat_menu ON websites.website_menu_category(website_menu_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_website_menu_item_cat ON websites.website_menu_item(website_menu_category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_website_asset_website ON websites.website_asset(website_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_website_domain_website ON websites.website_domain(website_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_website_domain_lookup ON websites.website_domain(domain) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_website_snapshot_active ON websites.website_published_snapshot(website_id) WHERE is_active = true AND deleted_at IS NULL;

COMMIT;
