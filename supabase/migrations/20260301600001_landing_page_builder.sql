-- ============================================
-- 20260301600000_landing_page_builder.sql
-- Creates the landing page builder schema:
-- 2 enums, 3 tables, indexes, triggers, RLS,
-- and the landing-media storage bucket.
-- These are PLATFORM-LEVEL tables — no workspace_id.
-- Public visitors can read published variants.
-- Only godmode users can manage content.
-- Connected to: apps/landing (rendering)
--               apps/web/src/app/platform-admin/landing/ (admin UI)
-- ============================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE landing_variant_status AS ENUM (
  'draft',
  'published',
  'archived'
);

CREATE TYPE landing_block_type AS ENUM (
  'hero',
  'features_grid',
  'features_list',
  'features_icons',
  'cta_section',
  'stats',
  'testimonial',
  'case_study',
  'voice_widget',
  'workspace_analyzer',
  'text_section',
  'image_section',
  'pricing_preview',
  'faq',
  'logo_strip'
);

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE public.landing_variant (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  status           landing_variant_status NOT NULL DEFAULT 'draft',
  is_default       boolean NOT NULL DEFAULT false,
  theme            jsonb NOT NULL DEFAULT '{}',
  meta_title       text,
  meta_description text,
  og_image_path    text,
  voice_config     jsonb NOT NULL DEFAULT '{}',
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.landing_block (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid NOT NULL REFERENCES public.landing_variant(id) ON DELETE CASCADE,
  block_type  landing_block_type NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  content     jsonb NOT NULL DEFAULT '{}',
  settings    jsonb NOT NULL DEFAULT '{}',
  is_visible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.landing_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id   uuid REFERENCES public.landing_variant(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  alt_text     text NOT NULL DEFAULT '',
  width        integer,
  height       integer,
  mime_type    text NOT NULL,
  file_size    integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Comments ─────────────────────────────────────────────────

COMMENT ON TABLE public.landing_variant IS 'Landing page variants for A/B testing and multi-audience pages. Platform-level, no workspace_id.';
COMMENT ON TABLE public.landing_block IS 'Content blocks composing a landing variant. Ordered by sort_order.';
COMMENT ON TABLE public.landing_media IS 'Media assets used on landing pages, stored in landing-media bucket.';
COMMENT ON COLUMN public.landing_variant.is_default IS 'Exactly one variant should be the default (enforced by partial unique index).';
COMMENT ON COLUMN public.landing_variant.theme IS 'JSON theme overrides: colors, fonts, spacing.';
COMMENT ON COLUMN public.landing_variant.voice_config IS 'Voice widget configuration: joinUrl, agentId, etc.';
COMMENT ON COLUMN public.landing_block.content IS 'Block-specific content: headings, body text, items array, etc.';
COMMENT ON COLUMN public.landing_block.settings IS 'Block-specific display settings: layout, animation, spacing.';

-- ── Indexes ──────────────────────────────────────────────────

-- Ensures at most one default variant
CREATE UNIQUE INDEX idx_landing_variant_one_default
  ON public.landing_variant (is_default)
  WHERE is_default = true;

-- Primary access pattern: blocks for a variant, ordered
CREATE INDEX idx_landing_block_variant_sort
  ON public.landing_block (variant_id, sort_order);

-- Media lookup by variant
CREATE INDEX idx_landing_media_variant
  ON public.landing_media (variant_id);

-- ── Triggers ─────────────────────────────────────────────────

CREATE TRIGGER set_landing_variant_updated_at
  BEFORE UPDATE ON public.landing_variant
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_landing_block_updated_at
  BEFORE UPDATE ON public.landing_block
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.landing_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_block ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_media ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can read published variants (landing app uses anon key)
CREATE POLICY "public_read_landing_variant"
  ON public.landing_variant FOR SELECT
  USING (status = 'published');

-- Public read: blocks belonging to published variants
CREATE POLICY "public_read_landing_block"
  ON public.landing_block FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.landing_variant
      WHERE id = landing_block.variant_id
      AND status = 'published'
    )
  );

-- Public read: all media is publicly accessible
CREATE POLICY "public_read_landing_media"
  ON public.landing_media FOR SELECT
  USING (true);

-- Godmode: full access to landing_variant
CREATE POLICY "godmode_landing_variant_all"
  ON public.landing_variant FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

-- Godmode: full access to landing_block
CREATE POLICY "godmode_landing_block_all"
  ON public.landing_block FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

-- Godmode: full access to landing_media
CREATE POLICY "godmode_landing_media_all"
  ON public.landing_media FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

-- ── Storage Bucket ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-media', 'landing-media', true);

-- Public read: anyone can view landing media files
CREATE POLICY "public_read_landing_media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'landing-media');

-- Godmode: upload landing media
CREATE POLICY "godmode_upload_landing_media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'landing-media'
    AND EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

-- Godmode: update landing media
CREATE POLICY "godmode_update_landing_media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'landing-media'
    AND EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

-- Godmode: delete landing media
CREATE POLICY "godmode_delete_landing_media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'landing-media'
    AND EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );
