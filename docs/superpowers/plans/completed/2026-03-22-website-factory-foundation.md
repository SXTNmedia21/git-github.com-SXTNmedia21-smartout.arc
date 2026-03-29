---
title: Website Factory Foundation — Implementation Plan
status: done
updated: 2026-03-26
created: 2026-03-22
module: website-factory
tags: [website, schema, rendering, publishing, middleware, plan]
---

# Website Factory Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the database schema, shared package, middleware routing, public site rendering, and publish pipeline for the Website Factory — everything needed to render a public website from a published snapshot.

**Architecture:** Dedicated `websites` Postgres schema with 12 tables. Shared `packages/website` package for section registry, Zod schemas, types, and templates. Thin middleware extension for `*.smartout.info` routing. Server-side public rendering from immutable snapshots via ISR. Transactional publish pipeline with row locking and hash deduplication.

**Tech Stack:** PostgreSQL (dedicated schema), Next.js App Router (ISR), Supabase (RLS, Storage, server client), Zod, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-21-website-factory-design.md`

**Scope:** This is Plan A (Foundation). Plan B (Builder UI) builds on top of this.

---

## File Map

### Database Migrations (create in order)

| File                                                            | Responsibility                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `supabase/migrations/20260322100000_create_websites_schema.sql` | Schema + 12 tables + CHECK constraints + FKs + indexes + triggers                    |
| `supabase/migrations/20260322100100_websites_rls_policies.sql`  | All RLS policies for `websites.*` tables                                             |
| `supabase/migrations/20260322100200_websites_rpc_functions.sql` | `get_active_site_snapshot_by_host()`, `get_preview_site_by_token()`                  |
| `supabase/migrations/20260322100300_website_assets_storage.sql` | `website-assets` bucket + storage RLS policies                                       |
| `supabase/migrations/20260322100400_workspace_has_website.sql`  | `ALTER TABLE public.workspace ADD COLUMN has_website boolean NOT NULL DEFAULT false` |

### Shared Package: `packages/website/`

| File                                                    | Responsibility                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/website/package.json`                         | Package config, exports                                                                         |
| `packages/website/tsconfig.json`                        | TypeScript config                                                                               |
| `packages/website/src/index.ts`                         | Barrel export                                                                                   |
| `packages/website/src/types/index.ts`                   | All TypeScript types (re-exported)                                                              |
| `packages/website/src/types/snapshot.ts`                | `SiteSnapshot`, `SnapshotPage`, `SnapshotSection`, `SnapshotMenu`, `SnapshotAsset`, `BuildMeta` |
| `packages/website/src/types/theme.ts`                   | `WebsiteTheme` type                                                                             |
| `packages/website/src/types/section.ts`                 | `SectionSettings`, per-section content types                                                    |
| `packages/website/src/types/domain.ts`                  | Domain, page, menu types                                                                        |
| `packages/website/src/constants.ts`                     | Section type allowlist, MVP limits, schema version                                              |
| `packages/website/src/sections/registry.ts`             | `SectionDefinition`, `SECTION_REGISTRY`, `registerSection()`, `getSectionDef()`                 |
| `packages/website/src/sections/schemas/hero.ts`         | Zod schema + defaults for hero section                                                          |
| `packages/website/src/sections/schemas/rich-text.ts`    | Zod schema + defaults for rich_text                                                             |
| `packages/website/src/sections/schemas/text-image.ts`   | Zod schema + defaults for text_image                                                            |
| `packages/website/src/sections/schemas/feature-grid.ts` | Zod schema + defaults for feature_grid                                                          |
| `packages/website/src/sections/schemas/gallery.ts`      | Zod schema + defaults for gallery                                                               |
| `packages/website/src/sections/schemas/testimonials.ts` | Zod schema + defaults for testimonials                                                          |
| `packages/website/src/sections/schemas/cta.ts`          | Zod schema + defaults for cta                                                                   |
| `packages/website/src/sections/schemas/hours.ts`        | Zod schema + defaults for hours                                                                 |
| `packages/website/src/sections/schemas/map.ts`          | Zod schema + defaults for map                                                                   |
| `packages/website/src/sections/schemas/contact.ts`      | Zod schema + defaults for contact                                                               |
| `packages/website/src/sections/schemas/menu-preview.ts` | Zod schema + defaults for menu_preview                                                          |
| `packages/website/src/sections/schemas/menu-full.ts`    | Zod schema + defaults for menu_full                                                             |
| `packages/website/src/sections/schemas/faq.ts`          | Zod schema + defaults for faq                                                                   |
| `packages/website/src/sections/schemas/booking-cta.ts`  | Zod schema + defaults for booking_cta                                                           |
| `packages/website/src/sections/schemas/pdf-viewer.ts`   | Zod schema + defaults for pdf_viewer                                                            |
| `packages/website/src/sections/schemas/footer.ts`       | Zod schema + defaults for footer                                                                |
| `packages/website/src/sections/schemas/index.ts`        | Barrel export for all schemas                                                                   |
| `packages/website/src/sections/schemas/settings.ts`     | `sectionSettingsSchema` Zod schema                                                              |
| `packages/website/src/templates/registry.ts`            | Template registry + `getTemplate()`                                                             |
| `packages/website/src/templates/restaurant-classic.ts`  | Restaurant template manifest                                                                    |
| `packages/website/src/templates/cafe-modern.ts`         | Cafe/bar template manifest                                                                      |
| `packages/website/src/validation/snapshot.ts`           | `buildSnapshot()`, `validateSnapshot()`, `hashSnapshot()`                                       |
| `packages/website/src/validation/section.ts`            | `validateSectionContent()` — validates content against registry schema                          |

### Middleware Extension

| File                            | Responsibility                                                         |
| ------------------------------- | ---------------------------------------------------------------------- |
| `apps/web/src/lib/subdomain.ts` | Modify: add `public-site` variant to `SubdomainResult`                 |
| `apps/web/src/middleware.ts`    | Modify: add `.smartout.info` / `.public.localhost` detection + rewrite |

### Public Site Rendering

| File                                                                              | Responsibility                                                                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/web/src/app/public-site/[host]/layout.tsx`                                  | Public site shell: nav, footer, theme provider, no auth                            |
| `apps/web/src/app/public-site/[host]/page.tsx`                                    | Home page (slug = '')                                                              |
| `apps/web/src/app/public-site/[host]/[...path]/page.tsx`                          | Dynamic page routing                                                               |
| `apps/web/src/app/public-site/[host]/sitemap.xml/route.ts`                        | Dynamic sitemap                                                                    |
| `apps/web/src/app/public-site/[host]/robots.txt/route.ts`                         | Dynamic robots.txt                                                                 |
| `apps/web/src/app/public-site/[host]/not-found.tsx`                               | 404 page for public sites                                                          |
| `apps/web/src/app/public-site/[host]/_data/site-public-repository.ts`             | `getPublishedSiteByHost()`, `getPreviewSiteByToken()` — service role isolated here |
| `apps/web/src/app/public-site/[host]/_components/SitePageRenderer.tsx`            | Section loop renderer                                                              |
| `apps/web/src/app/public-site/[host]/_components/SiteNavigation.tsx`              | Public site navigation                                                             |
| `apps/web/src/app/public-site/[host]/_components/SiteFooter.tsx`                  | Public site footer                                                                 |
| `apps/web/src/app/public-site/[host]/_components/SiteThemeProvider.tsx`           | CSS variable injection from theme tokens                                           |
| `apps/web/src/app/public-site/[host]/_components/sections/HeroPublic.tsx`         | Public hero renderer                                                               |
| `apps/web/src/app/public-site/[host]/_components/sections/RichTextPublic.tsx`     | Public rich_text renderer                                                          |
| `apps/web/src/app/public-site/[host]/_components/sections/TextImagePublic.tsx`    | Public text_image renderer                                                         |
| `apps/web/src/app/public-site/[host]/_components/sections/FeatureGridPublic.tsx`  | Public feature_grid renderer                                                       |
| `apps/web/src/app/public-site/[host]/_components/sections/GalleryPublic.tsx`      | Public gallery renderer                                                            |
| `apps/web/src/app/public-site/[host]/_components/sections/TestimonialsPublic.tsx` | Public testimonials renderer                                                       |
| `apps/web/src/app/public-site/[host]/_components/sections/CtaPublic.tsx`          | Public cta renderer                                                                |
| `apps/web/src/app/public-site/[host]/_components/sections/HoursPublic.tsx`        | Public hours renderer                                                              |
| `apps/web/src/app/public-site/[host]/_components/sections/MapPublic.tsx`          | Public map renderer                                                                |
| `apps/web/src/app/public-site/[host]/_components/sections/ContactPublic.tsx`      | Public contact renderer                                                            |
| `apps/web/src/app/public-site/[host]/_components/sections/MenuPreviewPublic.tsx`  | Public menu_preview renderer                                                       |
| `apps/web/src/app/public-site/[host]/_components/sections/MenuFullPublic.tsx`     | Public menu_full renderer                                                          |
| `apps/web/src/app/public-site/[host]/_components/sections/FaqPublic.tsx`          | Public faq renderer                                                                |
| `apps/web/src/app/public-site/[host]/_components/sections/BookingCtaPublic.tsx`   | Public booking_cta renderer                                                        |
| `apps/web/src/app/public-site/[host]/_components/sections/PdfViewerPublic.tsx`    | Public pdf_viewer renderer                                                         |
| `apps/web/src/app/public-site/[host]/_components/sections/FooterPublic.tsx`       | Public footer renderer                                                             |
| `apps/web/src/app/public-site/[host]/_components/sections/index.ts`               | `PUBLIC_SECTION_MAP` registry                                                      |

### Publish Pipeline

| File                                                             | Responsibility                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/website/_actions/publish-actions.ts` | Server actions: `publishWebsite()`, `rollbackWebsite()`, `unpublishWebsite()` |

### Telemetry

| File                                 | Responsibility                                |
| ------------------------------------ | --------------------------------------------- |
| `packages/telemetry/src/registry.ts` | Modify: add `website.*` event types + routing |

---

## Task 1: Create `websites` Schema + All Tables

**Files:**

- Create: `supabase/migrations/20260322100000_create_websites_schema.sql`

**Read first:**

- `docs/superpowers/specs/2026-03-21-website-factory-design.md` (section 2: Data Model)
- `supabase/migrations/20260418100000_timesheet_schema.sql` (precedent for custom schema)

- [ ] **Step 1: Write the migration SQL**

Create the file with the full schema. Include all 12 tables, CHECK constraints, FKs, indexes, `workspace_id` consistency triggers, `set_updated_at()` triggers, and soft delete support.

```sql
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

-- Apply to all child tables that have website_id FK
CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_page
  FOR EACH ROW EXECUTE FUNCTION websites.enforce_workspace_consistency_website();

CREATE TRIGGER enforce_ws_consistency BEFORE INSERT OR UPDATE ON websites.website_section
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

-- website_section needs page-level check too (workspace_id via page -> website)
-- The website_id trigger already handles this since section.workspace_id must match website.workspace_id

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
```

- [ ] **Step 2: Apply the migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260322100000_create_websites_schema.sql`

Expected: No errors. All tables created in `websites` schema.

- [ ] **Step 3: Verify tables exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'websites' ORDER BY table_name;"`

Expected: 12 rows (all `website_*` tables).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260322100000_create_websites_schema.sql
git commit -m "feat(website-factory): create websites schema with 12 tables

Dedicated PostgreSQL schema for Website Factory bounded context.
Tables: website, website_page, website_section, website_menu,
website_menu_category, website_menu_item, website_asset,
website_published_snapshot, website_draft_revision, website_domain,
website_preview_session, website_publish_event.

Includes: CHECK constraints, FKs, indexes, workspace_id consistency
triggers, set_updated_at triggers, soft delete support.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: RLS Policies

**Files:**

- Create: `supabase/migrations/20260322100100_websites_rls_policies.sql`

**Read first:**

- `supabase/migrations/00004_rls_policies.sql` (existing RLS pattern)
- Spec section 5 (Auth + RLS Model)

- [ ] **Step 1: Write the RLS migration**

```sql
-- RLS policies for websites.* schema
-- All reads and writes restricted to workspace admins/owners only.
-- Public reads go through SECURITY DEFINER RPC functions.

BEGIN;

-- ============================================================
-- websites.website
-- ============================================================
CREATE POLICY "admins_read_website"
  ON websites.website FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "admins_write_website"
  ON websites.website FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "admins_update_website"
  ON websites.website FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "admins_delete_website"
  ON websites.website FOR DELETE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Repeat same pattern for all 11 remaining tables.
-- Using a helper to reduce duplication:

-- website_page
CREATE POLICY "admins_select_website_page" ON websites.website_page FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_page" ON websites.website_page FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_page" ON websites.website_page FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_page" ON websites.website_page FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_section
CREATE POLICY "admins_select_website_section" ON websites.website_section FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_section" ON websites.website_section FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_section" ON websites.website_section FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_section" ON websites.website_section FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_menu
CREATE POLICY "admins_select_website_menu" ON websites.website_menu FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_menu" ON websites.website_menu FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_menu" ON websites.website_menu FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_menu" ON websites.website_menu FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_menu_category
CREATE POLICY "admins_select_website_menu_category" ON websites.website_menu_category FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_menu_category" ON websites.website_menu_category FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_menu_category" ON websites.website_menu_category FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_menu_category" ON websites.website_menu_category FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_menu_item
CREATE POLICY "admins_select_website_menu_item" ON websites.website_menu_item FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_menu_item" ON websites.website_menu_item FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_menu_item" ON websites.website_menu_item FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_menu_item" ON websites.website_menu_item FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_asset
CREATE POLICY "admins_select_website_asset" ON websites.website_asset FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_asset" ON websites.website_asset FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_asset" ON websites.website_asset FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_asset" ON websites.website_asset FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_published_snapshot
CREATE POLICY "admins_select_website_snapshot" ON websites.website_published_snapshot FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_snapshot" ON websites.website_published_snapshot FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_snapshot" ON websites.website_published_snapshot FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_draft_revision
CREATE POLICY "admins_select_website_revision" ON websites.website_draft_revision FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_revision" ON websites.website_draft_revision FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_domain
CREATE POLICY "admins_select_website_domain" ON websites.website_domain FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_domain" ON websites.website_domain FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_domain" ON websites.website_domain FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_preview_session
CREATE POLICY "admins_select_website_preview" ON websites.website_preview_session FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_preview" ON websites.website_preview_session FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_preview" ON websites.website_preview_session FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_publish_event
CREATE POLICY "admins_select_website_publish_event" ON websites.website_publish_event FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_publish_event" ON websites.website_publish_event FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

COMMIT;
```

- [ ] **Step 2: Apply the migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260322100100_websites_rls_policies.sql`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260322100100_websites_rls_policies.sql
git commit -m "feat(website-factory): RLS policies — admin-only access

All websites.* tables restricted to workspace admins/owners.
No employee/manager read access to draft content or preview tokens.
Public reads handled by SECURITY DEFINER RPC functions (next migration).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: RPC Functions + Storage Bucket + Feature Flag

**Files:**

- Create: `supabase/migrations/20260322100200_websites_rpc_functions.sql`
- Create: `supabase/migrations/20260322100300_website_assets_storage.sql`
- Create: `supabase/migrations/20260322100400_workspace_has_website.sql`

- [ ] **Step 1: Write RPC functions migration**

```sql
BEGIN;

-- Public site read: returns active snapshot for a hostname
CREATE OR REPLACE FUNCTION websites.get_active_site_snapshot_by_host(p_host text)
RETURNS jsonb AS $$
  SELECT ws.snapshot_data
  FROM websites.website_published_snapshot ws
  JOIN websites.website_domain wd ON wd.website_id = ws.website_id
  WHERE wd.domain = p_host
    AND wd.status = 'active'
    AND wd.deleted_at IS NULL
    AND ws.is_active = true
    AND ws.deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = websites, public;

-- Preview read: returns draft data for a valid, non-expired, pinned token
CREATE OR REPLACE FUNCTION websites.get_preview_site_by_token(p_token text)
RETURNS jsonb AS $$
  SELECT dr.draft_data
  FROM websites.website_preview_session ps
  JOIN websites.website_draft_revision dr ON dr.revision_id = ps.revision_id
  WHERE ps.token = p_token
    AND ps.expires_at > now()
    AND ps.revoked_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = websites, public;

COMMIT;
```

- [ ] **Step 2: Write storage bucket migration**

```sql
BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('website-assets', 'website-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for all website assets
CREATE POLICY "public_read_website_assets" ON storage.objects FOR SELECT
  USING (bucket_id = 'website-assets');

-- Workspace admin upload
CREATE POLICY "admin_upload_website_assets" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'website-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      WHERE ws.workspace_id IN (
        SELECT public.get_workspace_ids_for_user(auth.uid())
      )
      AND public.is_admin_in_workspace(auth.uid(), ws.workspace_id)
    )
  );

-- Workspace admin update
CREATE POLICY "admin_update_website_assets" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'website-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      WHERE ws.workspace_id IN (
        SELECT public.get_workspace_ids_for_user(auth.uid())
      )
      AND public.is_admin_in_workspace(auth.uid(), ws.workspace_id)
    )
  );

-- Workspace admin delete
CREATE POLICY "admin_delete_website_assets" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'website-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      WHERE ws.workspace_id IN (
        SELECT public.get_workspace_ids_for_user(auth.uid())
      )
      AND public.is_admin_in_workspace(auth.uid(), ws.workspace_id)
    )
  );

COMMIT;
```

- [ ] **Step 3: Write feature flag migration**

```sql
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS has_website boolean NOT NULL DEFAULT false;
```

- [ ] **Step 4: Apply all three migrations**

Run:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260322100200_websites_rpc_functions.sql && \
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260322100300_website_assets_storage.sql && \
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260322100400_workspace_has_website.sql
```

- [ ] **Step 5: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

Verify: `websites` schema tables appear in generated types.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260322100200_websites_rpc_functions.sql \
        supabase/migrations/20260322100300_website_assets_storage.sql \
        supabase/migrations/20260322100400_workspace_has_website.sql \
        packages/supabase/src/database.types.ts
git commit -m "feat(website-factory): RPC functions, storage bucket, feature flag

- get_active_site_snapshot_by_host(): public site reads
- get_preview_site_by_token(): preview reads
- website-assets storage bucket with admin-only write RLS
- workspace.has_website feature flag column

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Shared Package — `packages/website`

**Files:** All files listed under "Shared Package" in the file map above.

**Read first:**

- `packages/telemetry/package.json` (package structure pattern)
- `packages/telemetry/tsconfig.json`
- Spec sections 3 (Snapshot Contract), 4 (Theme), 10 (Section Registry)

This task is large. The agent should create files in this order:

1. Package config (`package.json`, `tsconfig.json`)
2. Types (`types/*.ts`)
3. Constants (`constants.ts`)
4. Section schemas (`sections/schemas/*.ts`)
5. Section registry (`sections/registry.ts`)
6. Templates (`templates/*.ts`)
7. Validation (`validation/*.ts`)
8. Barrel export (`index.ts`)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@smartout/website",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./sections": "./src/sections/registry.ts",
    "./templates": "./src/templates/registry.ts",
    "./validation": "./src/validation/snapshot.ts"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@smartout/typescript-config": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@smartout/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create all type files**

Create `packages/website/src/types/theme.ts`, `snapshot.ts`, `section.ts`, `domain.ts`, `index.ts` using the exact TypeScript interfaces from the spec (sections 3 and 4). See spec for complete type definitions.

- [ ] **Step 4: Create constants.ts**

```typescript
export const SCHEMA_VERSION = 1;

export const SECTION_TYPES = [
  "hero",
  "rich_text",
  "text_image",
  "feature_grid",
  "gallery",
  "testimonials",
  "cta",
  "hours",
  "map",
  "contact",
  "menu_preview",
  "menu_full",
  "faq",
  "booking_cta",
  "pdf_viewer",
  "footer",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const LIMITS = {
  maxPagesPerSite: 20,
  maxSectionsPerPage: 30,
  maxMenusPerSite: 10,
  maxMenuItemsPerMenu: 200,
  maxAssetsPerSite: 500,
  maxSnapshotSizeBytes: 2 * 1024 * 1024, // 2 MB
  maxActivePreviewTokens: 50,
  previewTokenTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  maxImageUploadBytes: 5 * 1024 * 1024, // 5 MB
  maxPdfUploadBytes: 20 * 1024 * 1024, // 20 MB
} as const;
```

- [ ] **Step 5: Create section schemas**

Create one file per section type in `packages/website/src/sections/schemas/`. Each exports a Zod schema and a defaults object. Also create `settings.ts` for the shared `SectionSettings` schema. Example for hero:

```typescript
// packages/website/src/sections/schemas/hero.ts
import { z } from "zod";

export const heroContentSchema = z.object({
  heading: z.string().min(1),
  subheading: z.string().default(""),
  buttonText: z.string().default(""),
  buttonUrl: z.string().default(""),
  imageAssetId: z.string().uuid().optional(),
  imagePosition: z.enum(["right", "below"]).default("right"),
  alignment: z.enum(["left", "center"]).default("center"),
});

export type HeroContent = z.infer<typeof heroContentSchema>;

export const heroDefaults: HeroContent = {
  heading: "Welcome",
  subheading: "",
  buttonText: "",
  buttonUrl: "",
  imagePosition: "right",
  alignment: "center",
};
```

Create similar files for all 16 section types. The barrel export at `schemas/index.ts` should map section type string to its schema.

- [ ] **Step 6: Create section registry**

```typescript
// packages/website/src/sections/registry.ts
import type { ZodSchema } from "zod";
import type { SectionSettings } from "../types/section";

export interface SectionDefinition<T = unknown> {
  type: string;
  name: string;
  description: string;
  schema: ZodSchema<T>;
  defaults: T;
  allowedPageTypes?: string[];
  maxPerPage?: number;
}

const SECTION_REGISTRY = new Map<string, SectionDefinition>();

export function registerSection<T>(def: SectionDefinition<T>): void {
  SECTION_REGISTRY.set(def.type, def);
}

export function getSectionDef(type: string): SectionDefinition | undefined {
  return SECTION_REGISTRY.get(type);
}

export function getAllSectionDefs(): SectionDefinition[] {
  return Array.from(SECTION_REGISTRY.values());
}

// Register all sections
import { heroContentSchema, heroDefaults } from "./schemas/hero";
// ... import all other schemas

registerSection({
  type: "hero",
  name: "Hero",
  description: "Full-width hero section with heading, image, and CTA",
  schema: heroContentSchema,
  defaults: heroDefaults,
  maxPerPage: 1,
});
// ... register all 16 types
```

- [ ] **Step 7: Create template manifests**

Create `packages/website/src/templates/restaurant-classic.ts` and `cafe-modern.ts` using the template structure from spec section 9.

- [ ] **Step 8: Create validation functions**

```typescript
// packages/website/src/validation/snapshot.ts
import { createHash } from "crypto";
import type { SiteSnapshot } from "../types/snapshot";
import { SCHEMA_VERSION, LIMITS } from "../constants";

export function hashSnapshot(data: SiteSnapshot): string {
  const json = JSON.stringify(data);
  return createHash("sha256").update(json).digest("hex");
}

export function validateSnapshotSize(data: SiteSnapshot): { valid: boolean; sizeBytes: number } {
  const json = JSON.stringify(data);
  const sizeBytes = Buffer.byteLength(json, "utf8");
  return { valid: sizeBytes <= LIMITS.maxSnapshotSizeBytes, sizeBytes };
}
```

- [ ] **Step 9: Create barrel export and install deps**

Create `packages/website/src/index.ts` re-exporting types, constants, registry, and validation.

Run: `pnpm install` (to link the new package in the monorepo)

- [ ] **Step 10: Verify package compiles**

Run: `pnpm --filter @smartout/website exec tsc --noEmit`

Expected: No errors.

- [ ] **Step 11: Commit**

```bash
git add packages/website/
git commit -m "feat(website-factory): shared package — types, schemas, registry, templates

@smartout/website package with:
- TypeScript types (SiteSnapshot, WebsiteTheme, SectionSettings)
- 16 Zod section schemas with defaults
- Section registry (type -> schema mapping)
- 2 template manifests (restaurant-classic, cafe-modern)
- Snapshot validation + SHA-256 hashing
- MVP constants and limits

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Middleware Extension

**Files:**

- Modify: `apps/web/src/lib/subdomain.ts`
- Modify: `apps/web/src/middleware.ts`

**Read first:**

- `apps/web/src/lib/subdomain.ts` (full file)
- `apps/web/src/middleware.ts` (full file)
- Spec section 1 (Routing, middleware order)

- [ ] **Step 1: Extend SubdomainResult type**

In `apps/web/src/lib/subdomain.ts`, add a new variant to `SubdomainResult`:

```typescript
| { type: "public-site"; host: string }
```

Add detection logic at the TOP of `extractSubdomain()`, before any `.smartout.ai` logic:

```typescript
// Check for public site domains FIRST (*.smartout.info or *.public.localhost)
const PUBLIC_SITE_DOMAIN = process.env.NEXT_PUBLIC_PUBLIC_SITE_DOMAIN ?? "smartout.info";
const LOCAL_PUBLIC_PREFIX = "public.localhost";

if (host.endsWith(`.${PUBLIC_SITE_DOMAIN}`) || host.includes(`.${LOCAL_PUBLIC_PREFIX}`)) {
  const slug = host.split(".")[0];
  if (slug) {
    return { type: "public-site", host };
  }
}
```

- [ ] **Step 2: Add middleware handler**

In `apps/web/src/middleware.ts`, add handling for `public-site` type BEFORE the existing subdomain routing:

```typescript
if (subdomain.type === "public-site") {
  const url = request.nextUrl.clone();
  const pathSegments = url.pathname.split("/").filter(Boolean);
  url.pathname = `/public-site/${subdomain.host}/${pathSegments.join("/")}`;
  const response = NextResponse.rewrite(url);
  response.headers.set("x-site-host", subdomain.host);
  return response;
}
```

- [ ] **Step 3: Verify existing routes still work**

Run: `pnpm --filter web dev` (start dev server)

Test manually:

- `app.localhost:3060` should still show admin portal
- `hq-workspace.localhost:3060` should still show dashboard
- `test.public.localhost:3060` should rewrite to `/public-site/test.public.localhost:3060/` (will 404 until public site route group exists)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/subdomain.ts apps/web/src/middleware.ts
git commit -m "feat(website-factory): middleware extension for *.smartout.info

Extend extractSubdomain() with public-site variant.
Middleware rewrites *.smartout.info and *.public.localhost
to /public-site/[host]/... route group.
Check runs BEFORE .smartout.ai logic per spec.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Site Public Repository

**Files:**

- Create: `apps/web/src/app/public-site/[host]/_data/site-public-repository.ts`

**Read first:**

- `packages/supabase/src/server.ts` (server client creation)
- Spec section 5 (Service Role Isolation)

- [ ] **Step 1: Create the repository**

This is the ONLY file that uses service role for public site reads. Two functions, narrow contract.

```typescript
import { createClient } from "@supabase/supabase-js";
import type { SiteSnapshot } from "@smartout/website";

/**
 * Service-role Supabase client for public site reads ONLY.
 * Isolated here — no other file should use service role for website data.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Fetch the active published snapshot for a given hostname.
 * Returns null if no site is published for this host.
 */
export async function getPublishedSiteByHost(host: string): Promise<SiteSnapshot | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("get_active_site_snapshot_by_host", { p_host: host });

  if (error || !data) return null;
  return data as SiteSnapshot;
}

/**
 * Fetch draft data for a valid preview token.
 * Returns null if token is invalid, expired, or revoked.
 */
export async function getPreviewSiteByToken(token: string): Promise<SiteSnapshot | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("get_preview_site_by_token", { p_token: token });

  if (error || !data) return null;
  return data as SiteSnapshot;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/public-site/[host]/_data/site-public-repository.ts
git commit -m "feat(website-factory): site-public-repository — isolated service role

Two functions only: getPublishedSiteByHost(), getPreviewSiteByToken().
Calls narrow SECURITY DEFINER RPC functions in websites schema.
Service role never used outside this file for website data.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Public Site Route Group + Section Renderers

**Files:** All files under "Public Site Rendering" in the file map.

**Read first:**

- `apps/web/src/app/join/page.tsx` (public route pattern — no auth)
- `apps/landing/src/components/blocks/BlockRenderer.tsx` (section rendering pattern)
- Spec sections 7 (Public Rendering), 10 (Section Registry)

This is the largest task. The agent should create files in this order:

1. Theme provider
2. Navigation + Footer components
3. Section renderers (all 16)
4. Section registry map
5. Page renderer
6. Layout
7. Home page + dynamic page routing
8. Sitemap + robots routes
9. 404 page

- [ ] **Step 1: Create SiteThemeProvider**

Server component that injects CSS custom properties from the snapshot's theme tokens. Maps `WebsiteTheme` colors/fonts/spacing to CSS variables used by all section renderers.

- [ ] **Step 2: Create SiteNavigation and SiteFooter**

Server components rendered from `snapshot.navigation.pages`. Responsive nav with mobile hamburger. Footer with contact info + social links.

- [ ] **Step 3: Create all 16 section renderers**

Each section renderer is a server component in `_components/sections/`. Each receives `content`, `settings`, `theme`, and `assets` props. Use `@smartout/website` types for prop typing.

Key renderers:

- **HeroPublic**: Full-width with heading, subheading, optional image, CTA button
- **MenuFullPublic**: Renders from `snapshot.menuData.menus` — categories with items, prices, allergens, dietary tags
- **MapPublic**: Client component (`"use client"`) for Google Maps embed or static map image
- **BookingCtaPublic**: CTA button linking to booking provider URL

All text rendered via React (auto-escaped). No `dangerouslySetInnerHTML`.

- [ ] **Step 4: Create PUBLIC_SECTION_MAP**

```typescript
// _components/sections/index.ts
import type { ComponentType } from "react";
import type { SectionSettings, WebsiteTheme } from "@smartout/website";

export interface PublicSectionProps {
  content: Record<string, unknown>;
  settings: SectionSettings;
  theme: WebsiteTheme;
  assets: {
    byId: Record<
      string,
      {
        storagePath: string;
        alt: string;
        width: number | null;
        height: number | null;
        mimeType: string;
      }
    >;
    storageBaseUrl: string;
  };
}

export const PUBLIC_SECTION_MAP: Record<string, ComponentType<PublicSectionProps>> = {
  hero: HeroPublic,
  rich_text: RichTextPublic,
  // ... all 16
};
```

- [ ] **Step 5: Create SitePageRenderer**

Loops over page sections, looks up renderer from map, renders in sort order. Skips unknown types gracefully.

- [ ] **Step 6: Create layout.tsx**

```typescript
// apps/web/src/app/public-site/[host]/layout.tsx
import type { ReactNode } from 'react';

export const revalidate = 3600; // ISR: 1 hour

export default function PublicSiteLayout({ children }: { children: ReactNode }) {
  // No auth, no DashboardShell, no workspace provider
  return <>{children}</>;
}
```

- [ ] **Step 7: Create page.tsx (home) and [...path]/page.tsx (dynamic)**

Both pages:

1. Extract `host` from params
2. Check for `?preview=TOKEN` query param
3. Call `getPublishedSiteByHost(host)` or `getPreviewSiteByToken(token)`
4. If no snapshot → `notFound()`
5. Resolve page from path (home = empty slug)
6. Render layout shell (nav, theme, content, footer)
7. Export `generateMetadata()` for SEO

- [ ] **Step 8: Create sitemap.xml and robots.txt routes**

Route handlers that read snapshot data and return XML/text responses.

- [ ] **Step 9: Create not-found.tsx**

Simple 404 page with "Site not found" message.

- [ ] **Step 10: Verify the public site renders**

Seed test data manually:

```sql
-- Insert a test website, page, section, domain, and published snapshot
-- with snapshot_data matching the SiteSnapshot contract
```

Visit `test.public.localhost:3060` and verify the page renders.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/public-site/
git commit -m "feat(website-factory): public site rendering — ISR from snapshots

Route group /public-site/[host]/ with:
- 16 section renderers (server components)
- Theme provider (CSS variables from snapshot)
- Navigation + footer from snapshot data
- Dynamic page routing
- generateMetadata() for SEO
- Sitemap + robots.txt routes
- ISR with 1h revalidation
- Preview support via ?preview=TOKEN

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Publish Pipeline

**Files:**

- Create: `apps/web/src/app/dashboard/website/_actions/publish-actions.ts`

**Read first:**

- `apps/web/src/app/dashboard/people/_actions/people-actions.ts` (server action pattern)
- Spec section 8 (Publishing Pipeline)
- `packages/website/src/validation/snapshot.ts`

- [ ] **Step 1: Create publish server actions**

Three server actions: `publishWebsite()`, `rollbackWebsite()`, `unpublishWebsite()`.

`publishWebsite()` implements the full pipeline: 0. Lock website row (`FOR UPDATE`)

1. Validate (home page exists, sections pass Zod validation)
2. Create draft revision (source = 'manual')
3. Build snapshot from draft tables
4. Hash snapshot, check for duplicate
5. Write snapshot row with next version
6. Activate (set `is_active`, deactivate others)
7. Update visibility to 'live'
8. Log publish event
9. Commit
10. Revalidate ISR cache (`revalidateTag`)
11. Emit telemetry

Uses service role client for the transactional write (publish is a privileged operation that spans snapshot activation + visibility update atomically).

- [ ] **Step 2: Verify publish produces valid snapshot**

Write a manual test: create site data, call `publishWebsite()`, verify snapshot in DB matches `SiteSnapshot` contract.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/website/_actions/publish-actions.ts
git commit -m "feat(website-factory): publish pipeline — transactional with hash dedup

Server actions: publishWebsite(), rollbackWebsite(), unpublishWebsite().
Full pipeline: lock -> validate -> revision -> build -> hash -> write ->
activate -> update visibility -> log event -> revalidate -> telemetry.
Hash deduplication skips identical publishes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Telemetry Registration

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

**Read first:**

- `packages/telemetry/src/registry.ts` (existing event pattern)

- [ ] **Step 1: Add website event types and routing**

Add to the `SmartoutEvent` union and `EVENT_ROUTING` map:

```typescript
// Event interfaces
export interface WebsiteCreated extends BaseEvent {
  event: "website created";
  properties: { entity: EntityRef; data: { template_key: string } };
}
export interface WebsitePublished extends BaseEvent {
  event: "website published";
  properties: { entity: EntityRef; data: { version: number; snapshot_hash: string } };
}
export interface WebsiteUnpublished extends BaseEvent {
  event: "website unpublished";
  properties: { entity: EntityRef };
}
export interface WebsiteRollback extends BaseEvent {
  event: "website rollback";
  properties: { entity: EntityRef; data: { from_version: number; to_version: number } };
}
export interface WebsiteDomainVerified extends BaseEvent {
  event: "website domain_verified";
  properties: { entity: EntityRef; data: { domain: string } };
}
export interface WebsiteDomainFailed extends BaseEvent {
  event: "website domain_failed";
  properties: { entity: EntityRef; data: { domain: string; reason: string } };
}
export interface WebsitePreviewCreated extends BaseEvent {
  event: "website preview_created";
  properties: { entity: EntityRef; data: { revision_number: number } };
}
export interface WebsiteContentGenerated extends BaseEvent {
  event: "website content_generated";
  properties: { entity: EntityRef; data: { section_count: number } };
}

// Add to union
export type SmartoutEvent = ... | WebsiteCreated | WebsitePublished | WebsiteUnpublished | WebsiteRollback | WebsiteDomainVerified | WebsiteDomainFailed | WebsitePreviewCreated | WebsiteContentGenerated;

// Add to routing
"website created": { destinations: ["posthog", "activity_trail"], category: "system" },
"website published": { destinations: ["posthog", "activity_trail", "engine_event"], category: "system" },
"website unpublished": { destinations: ["posthog", "activity_trail"], category: "system" },
"website rollback": { destinations: ["posthog", "activity_trail"], category: "system" },
"website domain_verified": { destinations: ["activity_trail"], category: "system" },
"website domain_failed": { destinations: ["activity_trail", "logger"], category: "system" },
"website preview_created": { destinations: ["activity_trail"], category: "system" },
"website content_generated": { destinations: ["posthog", "activity_trail"], category: "system" },
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @smartout/telemetry exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(website-factory): register website.* telemetry events

8 events: created, published, unpublished, rollback,
domain_verified, domain_failed, preview_created, content_generated.
Routed to PostHog, activity_trail, engine_event, logger as appropriate.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Integration Test — Full Publish + Render Cycle

**Files:**

- Create: `supabase/seed/website-factory-test.sql`

- [ ] **Step 1: Create seed data**

SQL that inserts a complete test website with pages, sections, menu, domain, and a published snapshot — using the HQ workspace from `seed.sql`.

- [ ] **Step 2: Run seed and verify public site renders**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/seed/website-factory-test.sql
```

Then visit `hq-workspace.public.localhost:3060` and verify the site renders.

- [ ] **Step 3: Run typecheck on full workspace**

Run: `pnpm typecheck`

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed/website-factory-test.sql
git commit -m "test(website-factory): seed data for integration testing

Complete test website with pages, sections, menu, domain,
and published snapshot for the HQ workspace.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Execution Order Summary

```
Task 1: Schema + tables          (parallel with Task 4)
Task 2: RLS policies             (depends on 1)
Task 3: RPC + storage + flag     (depends on 1)
Task 4: Shared package           (parallel with Task 1)
Task 5: Middleware extension      (independent)
Task 6: Public repository        (depends on 3)
Task 7: Public site renderers    (depends on 4, 5, 6)
Task 8: Publish pipeline         (depends on 3, 4)
Task 9: Telemetry events         (depends on 4)
Task 10: Integration test        (depends on 7, 8)
```

**Parallelizable:** Tasks 1+4, Tasks 5+9 can run concurrently.

**Critical path:** 1 -> 2 -> 3 -> 6 -> 7 -> 10 (public rendering) and 1 -> 3 -> 8 -> 10 (publish pipeline).
