---
title: "Plan — Landing Page Builder + Performance Optimization"
status: in_progress
updated: 2026-03-03
created: 2026-03-01
module: landing
tags: [plan, landing, performance, admin, page-builder]
---

# Landing Page Builder + Performance Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize landing page performance and build a block-based page builder in the platform-admin dashboard, allowing admins to create unlimited landing page variants with drag-and-drop block editing, stored in Supabase.

**Architecture:** Block-based page builder. Admin creates variants by combining ~15 predefined block types (Hero, Features, CTA, Stats, etc.). Each block has Zod-validated JSONB content. Landing app fetches variant + blocks server-side based on `?v=slug` URL parameter. Existing 7 hardcoded variants migrated to DB as seed data.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL + Storage), Tailwind v4, shadcn/ui, @dnd-kit (drag-and-drop), Framer Motion (LazyMotion), Zod

**Design doc:** `docs/plans/2026-03-01-landing-page-builder-design.md`

---

## Phase 1: Performance Optimization

### Task 1: Code-split variant imports with next/dynamic

**Files:**

- Modify: `apps/landing/src/app/page.tsx`

**Context:** `page.tsx` is 1,209 lines. Lines 1-18 import ALL 6 variant components synchronously (variant B is rendered inline). This means every visitor downloads ~4500 lines of JS regardless of which variant they see.

**Step 1: Replace static imports with dynamic imports**

In `apps/landing/src/app/page.tsx`, replace lines 12-17:

```typescript
// BEFORE (static imports — all variants in bundle)
import VariantELanding from "../components/landing/VariantELanding";
import VariantTLanding from "../components/landing/VariantTLanding";
import VariantKLanding from "../components/landing/VariantKLanding";
import VariantALanding from "../components/landing/VariantALanding";
import VariantFLanding from "../components/landing/VariantFLanding";
import VariantSLanding from "../components/landing/VariantSLanding";
```

With:

```typescript
// AFTER (dynamic imports — only active variant loaded)
import dynamic from "next/dynamic";

const VariantELanding = dynamic(() => import("../components/landing/VariantELanding"));
const VariantTLanding = dynamic(() => import("../components/landing/VariantTLanding"));
const VariantKLanding = dynamic(() => import("../components/landing/VariantKLanding"));
const VariantALanding = dynamic(() => import("../components/landing/VariantALanding"));
const VariantFLanding = dynamic(() => import("../components/landing/VariantFLanding"));
const VariantSLanding = dynamic(() => import("../components/landing/VariantSLanding"));
```

**Step 2: Verify the app still runs**

Run: `cd apps/landing && pnpm dev`

Open http://localhost:3055 — verify default variant loads. Switch between variants using the footer switcher. All variants should render correctly.

**Step 3: Commit**

```bash
git add apps/landing/src/app/page.tsx
git commit -m "perf(landing): code-split variant components with next/dynamic"
```

---

### Task 2: Switch to LazyMotion for smaller Framer Motion bundle

**Files:**

- Modify: `apps/landing/src/app/page.tsx` (change framer-motion imports)
- Modify: `apps/landing/src/components/landing/VariantELanding.tsx`
- Modify: `apps/landing/src/components/landing/VariantTLanding.tsx`
- Modify: `apps/landing/src/components/landing/VariantKLanding.tsx`
- Modify: `apps/landing/src/components/landing/VariantALanding.tsx`
- Modify: `apps/landing/src/components/landing/VariantFLanding.tsx`
- Modify: `apps/landing/src/components/landing/VariantSLanding.tsx`
- Modify: `apps/landing/src/components/landing/VoiceDemoWidget.tsx`
- Modify: `apps/landing/src/components/workspace-analyzer.tsx`

**Context:** Every file imports `motion` from `framer-motion`. The full `motion` component includes all features (~100 KB). `LazyMotion` + `m` component loads only needed features (~40 KB).

**Step 1: Add LazyMotion provider to layout**

In `apps/landing/src/app/layout.tsx`, wrap children with LazyMotion:

```typescript
import { LazyMotion, domAnimation } from "framer-motion";

// In the return:
<body ...>
  <LazyMotion features={domAnimation} strict>
    {children}
  </LazyMotion>
  <Analytics />
  <SpeedInsights />
</body>
```

**Step 2: Replace `motion` with `m` in all variant files**

In each file listed above, change:

```typescript
// BEFORE
import { motion } from "framer-motion";
// or
import { motion, AnimatePresence } from "framer-motion";

// AFTER
import { m, AnimatePresence } from "framer-motion";
```

Then find-and-replace `<motion.` with `<m.` and `</motion.` with `</m.` in each file.

Also replace `motion(` with `m(` if used as a HOC (check `VariantTLanding.tsx` which uses `useInView`).

**Important:** `AnimatePresence`, `useInView`, `type Variants` stay the same — only the `motion` component changes to `m`.

**Step 3: Verify all variants still animate**

Run: `pnpm --filter landing dev`

Check each variant (B, E, T, K, A, F, S) — animations should work identically.

**Step 4: Commit**

```bash
git add apps/landing/src/app/layout.tsx apps/landing/src/app/page.tsx apps/landing/src/components/
git commit -m "perf(landing): switch to LazyMotion for smaller framer-motion bundle"
```

---

### Task 3: Configure next/image for Supabase Storage

**Files:**

- Modify: `apps/landing/next.config.ts`

**Step 1: Add image configuration**

In `apps/landing/next.config.ts`, add to `nextConfig`:

```typescript
const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  transpilePackages: [
    /* existing */
  ],
  // ... rest unchanged
};
```

**Step 2: Verify build works**

Run: `pnpm --filter landing build`

Should complete without errors.

**Step 3: Commit**

```bash
git add apps/landing/next.config.ts
git commit -m "perf(landing): configure next/image for Supabase Storage with AVIF/WebP"
```

---

### Task 4: Typecheck + lint after Phase 1

**Step 1: Run typecheck**

Run: `pnpm --filter landing typecheck`

Fix any type errors.

**Step 2: Run lint**

Run: `pnpm --filter landing lint`

Fix any lint issues.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(landing): resolve typecheck and lint issues after perf optimization"
```

---

## Phase 2: Database Schema + Migration

### Task 5: Create enums and tables migration

**Files:**

- Create: `supabase/migrations/20260301600000_landing_page_builder.sql`

**Step 1: Write the migration**

```sql
-- Landing Page Builder schema
-- Design doc: docs/plans/2026-03-01-landing-page-builder-design.md

-- Enums
CREATE TYPE landing_variant_status AS ENUM ('draft', 'published', 'archived');

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

-- Landing variant (a complete page)
CREATE TABLE landing_variant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status landing_variant_status NOT NULL DEFAULT 'draft',
  is_default boolean NOT NULL DEFAULT false,
  theme jsonb NOT NULL DEFAULT '{}',
  meta_title text,
  meta_description text,
  og_image_path text,
  voice_config jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure exactly one default variant
CREATE UNIQUE INDEX landing_variant_single_default
  ON landing_variant (is_default) WHERE is_default = true;

-- Landing block (a section within a variant)
CREATE TABLE landing_block (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES landing_variant(id) ON DELETE CASCADE,
  block_type landing_block_type NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  content jsonb NOT NULL DEFAULT '{}',
  settings jsonb NOT NULL DEFAULT '{}',
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX landing_block_variant_order ON landing_block (variant_id, sort_order);

-- Landing media (images/videos in Storage)
CREATE TABLE landing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES landing_variant(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  width integer,
  height integer,
  mime_type text NOT NULL,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX landing_media_variant ON landing_media (variant_id);

-- updated_at triggers
CREATE TRIGGER set_landing_variant_updated_at
  BEFORE UPDATE ON landing_variant
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER set_landing_block_updated_at
  BEFORE UPDATE ON landing_block
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- RLS
ALTER TABLE landing_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_block ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_media ENABLE ROW LEVEL SECURITY;

-- Public read (landing app via anon key) — only published variants
CREATE POLICY "public_read_published_variants" ON landing_variant
  FOR SELECT USING (status = 'published');

CREATE POLICY "public_read_published_blocks" ON landing_block
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM landing_variant
      WHERE landing_variant.id = landing_block.variant_id
      AND landing_variant.status = 'published'
    )
  );

CREATE POLICY "public_read_media" ON landing_media
  FOR SELECT USING (true);

-- Godmode full access (platform admin)
CREATE POLICY "godmode_full_variant" ON landing_variant
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

CREATE POLICY "godmode_full_block" ON landing_block
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

CREATE POLICY "godmode_full_media" ON landing_media
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );
```

**Step 2: Apply the migration**

Run: `npx supabase db push` (local) or apply via Supabase MCP.

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Verify types include new tables**

Check that `database.types.ts` contains `landing_variant`, `landing_block`, `landing_media` tables and the two enums.

**Step 5: Commit**

```bash
git add supabase/migrations/20260301600000_landing_page_builder.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add landing page builder schema — variant, block, media tables"
```

---

### Task 6: Create Supabase Storage bucket for landing media

**Step 1: Create storage bucket migration**

Add to the migration or create a separate one. The bucket `landing-media` should be public (images served directly).

This is done via Supabase dashboard or CLI:

```bash
npx supabase storage create landing-media --public
```

Or via SQL:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('landing-media', 'landing-media', true);
```

**Step 2: Add storage RLS policy**

```sql
-- Allow public read
CREATE POLICY "public_read_landing_media" ON storage.objects
  FOR SELECT USING (bucket_id = 'landing-media');

-- Allow godmode upload/delete
CREATE POLICY "godmode_upload_landing_media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'landing-media'
    AND EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

CREATE POLICY "godmode_delete_landing_media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'landing-media'
    AND EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );
```

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(storage): add landing-media bucket with public read + godmode write"
```

---

## Phase 3: Shared Types + Block Components

### Task 7: Create block content Zod schemas and TypeScript types

**Files:**

- Create: `apps/landing/src/lib/block-schemas.ts`

**Context:** Each block type has a specific content structure stored as JSONB. These Zod schemas validate content on both admin write and landing read.

**Step 1: Write the schemas**

```typescript
import { z } from "zod";

// ──── Shared sub-schemas ────

const buttonSchema = z.object({
  label: z.string(),
  href: z.string(),
  style: z.enum(["primary", "outline", "ghost"]).default("primary"),
});

const mediaRefSchema = z.object({
  media_id: z.string().uuid(),
  alt: z.string().default(""),
});

// ──── Block content schemas ────

export const heroContentSchema = z.object({
  heading: z.string(),
  subheading: z.string().default(""),
  buttons: z.array(buttonSchema).default([]),
  image: mediaRefSchema.optional(),
  image_position: z.enum(["right", "below"]).default("right"),
  alignment: z.enum(["left", "center"]).default("center"),
});

export const featuresGridContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string().default(""),
      }),
    )
    .default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

export const featuresListContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    )
    .default([]),
});

export const featuresIconsContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        icon: z.string(),
        label: z.string(),
      }),
    )
    .default([]),
});

export const ctaSectionContentSchema = z.object({
  heading: z.string(),
  subheading: z.string().default(""),
  buttons: z.array(buttonSchema).default([]),
  background: z.enum(["dark", "accent", "gradient"]).default("dark"),
});

export const statsContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        suffix: z.string().default(""),
      }),
    )
    .default([]),
});

export const testimonialContentSchema = z.object({
  quote: z.string(),
  name: z.string(),
  role: z.string().default(""),
  company: z.string().default(""),
  image: mediaRefSchema.optional(),
});

export const caseStudyContentSchema = z.object({
  heading: z.string(),
  company: z.string(),
  quote: z.string().default(""),
  author_name: z.string().default(""),
  author_role: z.string().default(""),
  metrics: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    )
    .default([]),
});

export const voiceWidgetContentSchema = z.object({
  heading: z.string().default(""),
  subheading: z.string().default(""),
  // voice_config comes from variant-level, not block-level
});

export const workspaceAnalyzerContentSchema = z.object({
  heading: z.string().default(""),
  subheading: z.string().default(""),
});

export const textSectionContentSchema = z.object({
  heading: z.string().default(""),
  body: z.string().default(""),
});

export const imageSectionContentSchema = z.object({
  image: mediaRefSchema,
  caption: z.string().default(""),
  max_width: z.enum(["sm", "md", "lg", "full"]).default("lg"),
});

export const pricingPreviewContentSchema = z.object({
  heading: z.string().default(""),
  subheading: z.string().default(""),
  cta_label: z.string().default("Se priser"),
  cta_href: z.string().default("/pricing"),
});

export const faqContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .default([]),
});

export const logoStripContentSchema = z.object({
  heading: z.string().default(""),
  logos: z
    .array(
      z.object({
        image: mediaRefSchema,
        name: z.string(),
      }),
    )
    .default([]),
});

// ──── Schema map ────

export const BLOCK_CONTENT_SCHEMAS = {
  hero: heroContentSchema,
  features_grid: featuresGridContentSchema,
  features_list: featuresListContentSchema,
  features_icons: featuresIconsContentSchema,
  cta_section: ctaSectionContentSchema,
  stats: statsContentSchema,
  testimonial: testimonialContentSchema,
  case_study: caseStudyContentSchema,
  voice_widget: voiceWidgetContentSchema,
  workspace_analyzer: workspaceAnalyzerContentSchema,
  text_section: textSectionContentSchema,
  image_section: imageSectionContentSchema,
  pricing_preview: pricingPreviewContentSchema,
  faq: faqContentSchema,
  logo_strip: logoStripContentSchema,
} as const;

// ──── Inferred types ────

export type HeroContent = z.infer<typeof heroContentSchema>;
export type FeaturesGridContent = z.infer<typeof featuresGridContentSchema>;
export type FeaturesListContent = z.infer<typeof featuresListContentSchema>;
export type FeaturesIconsContent = z.infer<typeof featuresIconsContentSchema>;
export type CtaSectionContent = z.infer<typeof ctaSectionContentSchema>;
export type StatsContent = z.infer<typeof statsContentSchema>;
export type TestimonialContent = z.infer<typeof testimonialContentSchema>;
export type CaseStudyContent = z.infer<typeof caseStudyContentSchema>;
export type VoiceWidgetContent = z.infer<typeof voiceWidgetContentSchema>;
export type WorkspaceAnalyzerContent = z.infer<typeof workspaceAnalyzerContentSchema>;
export type TextSectionContent = z.infer<typeof textSectionContentSchema>;
export type ImageSectionContent = z.infer<typeof imageSectionContentSchema>;
export type PricingPreviewContent = z.infer<typeof pricingPreviewContentSchema>;
export type FaqContent = z.infer<typeof faqContentSchema>;
export type LogoStripContent = z.infer<typeof logoStripContentSchema>;

export type LandingBlockType = keyof typeof BLOCK_CONTENT_SCHEMAS;

// ──── Block settings schema (shared across all blocks) ────

export const blockSettingsSchema = z
  .object({
    layout: z.enum(["default", "wide", "narrow"]).default("default"),
    background: z.enum(["none", "subtle", "dark"]).default("none"),
    padding: z.enum(["sm", "md", "lg"]).default("md"),
  })
  .default({});

export type BlockSettings = z.infer<typeof blockSettingsSchema>;

// ──── Variant theme schema ────

export const variantThemeSchema = z.object({
  accent: z.string().default("orange"),
  accentColor: z.string().default("234 88% 55%"),
  accentForeground: z.string().default("0 0% 100%"),
});

export type VariantTheme = z.infer<typeof variantThemeSchema>;

// ──── Block props type for render components ────

export type BlockProps<T = unknown> = {
  content: T;
  settings: BlockSettings;
};
```

**Step 2: Verify types compile**

Run: `pnpm --filter landing typecheck`

**Step 3: Commit**

```bash
git add apps/landing/src/lib/block-schemas.ts
git commit -m "feat(landing): add Zod schemas and types for all 15 block types"
```

---

### Task 8: Create ThemeProvider component

**Files:**

- Create: `apps/landing/src/components/blocks/ThemeProvider.tsx`

**Step 1: Write ThemeProvider**

```typescript
import type { CSSProperties, ReactNode } from "react";
import type { VariantTheme } from "../../lib/block-schemas";

type ThemeProviderProps = {
  theme: VariantTheme;
  children: ReactNode;
};

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const style = {
    "--accent": theme.accentColor,
    "--accent-foreground": theme.accentForeground,
  } as CSSProperties;

  return <div style={style}>{children}</div>;
}
```

**Step 2: Commit**

```bash
git add apps/landing/src/components/blocks/ThemeProvider.tsx
git commit -m "feat(landing): add ThemeProvider for variant accent colors"
```

---

### Task 9: Create core block components (hero, features_grid, cta_section, stats, text_section)

**Files:**

- Create: `apps/landing/src/components/blocks/HeroBlock.tsx`
- Create: `apps/landing/src/components/blocks/FeaturesGridBlock.tsx`
- Create: `apps/landing/src/components/blocks/CtaSectionBlock.tsx`
- Create: `apps/landing/src/components/blocks/StatsBlock.tsx`
- Create: `apps/landing/src/components/blocks/TextSectionBlock.tsx`

**Context:** These 5 blocks cover the most common sections across all 7 existing variants. Extract the visual patterns from the existing variant components but make them data-driven (receiving content via props instead of hardcoding).

**Step 1: Write HeroBlock**

Reference the hero section patterns from:

- `VariantELanding.tsx` lines ~15-80 (centered hero with gradient text)
- `VariantALanding.tsx` (warm amber hero with large icons)
- `VariantBLanding.tsx` (inline in `page.tsx` lines ~50-200)

The component receives `HeroContent` + `BlockSettings` as props and renders heading, subheading, buttons, optional image. Use `m.div` for animations (LazyMotion compatible).

**Step 2: Write FeaturesGridBlock**

Reference `VariantELanding.tsx` features section — grid of icon + title + description cards. Receives `FeaturesGridContent` with configurable column count.

**Step 3: Write CtaSectionBlock**

Reference the CTA sections at the bottom of every variant. Heading + subheading + button(s) with background option.

**Step 4: Write StatsBlock**

Reference `VariantELanding.tsx` and `VariantTLanding.tsx` stats sections — row of animated counters.

**Step 5: Write TextSectionBlock**

Simple heading + markdown body. Use for any freeform text section.

**Step 6: Verify all compile**

Run: `pnpm --filter landing typecheck`

**Step 7: Commit**

```bash
git add apps/landing/src/components/blocks/
git commit -m "feat(landing): add core block components — hero, features_grid, cta, stats, text"
```

---

### Task 10: Create remaining block components

**Files:**

- Create: `apps/landing/src/components/blocks/FeaturesListBlock.tsx`
- Create: `apps/landing/src/components/blocks/FeaturesIconsBlock.tsx`
- Create: `apps/landing/src/components/blocks/TestimonialBlock.tsx`
- Create: `apps/landing/src/components/blocks/CaseStudyBlock.tsx`
- Create: `apps/landing/src/components/blocks/VoiceWidgetBlock.tsx`
- Create: `apps/landing/src/components/blocks/WorkspaceAnalyzerBlock.tsx`
- Create: `apps/landing/src/components/blocks/ImageSectionBlock.tsx`
- Create: `apps/landing/src/components/blocks/PricingPreviewBlock.tsx`
- Create: `apps/landing/src/components/blocks/FaqBlock.tsx`
- Create: `apps/landing/src/components/blocks/LogoStripBlock.tsx`

**Context:**

- `FeaturesListBlock` — vertical list, reference `VariantKLanding.tsx` and `VariantSLanding.tsx`
- `FeaturesIconsBlock` — giant icons with labels, reference `VariantFLanding.tsx` (accessibility variant)
- `TestimonialBlock` — quote card, reference `VariantSLanding.tsx`
- `CaseStudyBlock` — extended testimonial with metrics, reference `VariantKLanding.tsx`
- `VoiceWidgetBlock` — wrapper around existing `VoiceDemoWidget` component. Receives `VoiceWidgetContent`, passes variant-level `voice_config` to the widget
- `WorkspaceAnalyzerBlock` — wrapper around existing `workspace-analyzer.tsx`
- `ImageSectionBlock` — `next/image` with Supabase Storage URL
- `PricingPreviewBlock` — simple CTA section linking to /pricing
- `FaqBlock` — accordion with Radix Accordion or details/summary
- `LogoStripBlock` — horizontal row of logos with `next/image`

**Step 1: Write all 10 components**

Each follows the same pattern: receives typed `content` + `settings` props, renders UI. The `VoiceWidgetBlock` and `WorkspaceAnalyzerBlock` re-use the existing components as-is.

**Step 2: Verify**

Run: `pnpm --filter landing typecheck`

**Step 3: Commit**

```bash
git add apps/landing/src/components/blocks/
git commit -m "feat(landing): add remaining 10 block components"
```

---

### Task 11: Create BlockRenderer that maps block_type to components

**Files:**

- Create: `apps/landing/src/components/blocks/BlockRenderer.tsx`
- Create: `apps/landing/src/components/blocks/index.ts`

**Step 1: Write BlockRenderer**

```typescript
"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { BlockProps, LandingBlockType, BlockSettings } from "../../lib/block-schemas";
import { ThemeProvider } from "./ThemeProvider";
import type { VariantTheme } from "../../lib/block-schemas";

const BLOCK_MAP: Record<LandingBlockType, ComponentType<BlockProps<unknown>>> = {
  hero: dynamic(() => import("./HeroBlock")),
  features_grid: dynamic(() => import("./FeaturesGridBlock")),
  features_list: dynamic(() => import("./FeaturesListBlock")),
  features_icons: dynamic(() => import("./FeaturesIconsBlock")),
  cta_section: dynamic(() => import("./CtaSectionBlock")),
  stats: dynamic(() => import("./StatsBlock")),
  testimonial: dynamic(() => import("./TestimonialBlock")),
  case_study: dynamic(() => import("./CaseStudyBlock")),
  voice_widget: dynamic(() => import("./VoiceWidgetBlock")),
  workspace_analyzer: dynamic(() => import("./WorkspaceAnalyzerBlock")),
  text_section: dynamic(() => import("./TextSectionBlock")),
  image_section: dynamic(() => import("./ImageSectionBlock")),
  pricing_preview: dynamic(() => import("./PricingPreviewBlock")),
  faq: dynamic(() => import("./FaqBlock")),
  logo_strip: dynamic(() => import("./LogoStripBlock")),
};

type Block = {
  id: string;
  block_type: LandingBlockType;
  content: unknown;
  settings: BlockSettings;
  is_visible: boolean;
};

type BlockRendererProps = {
  blocks: Block[];
  theme: VariantTheme;
  voiceConfig?: unknown;
};

export function BlockRenderer({ blocks, theme, voiceConfig }: BlockRendererProps) {
  return (
    <ThemeProvider theme={theme}>
      {blocks
        .filter((b) => b.is_visible)
        .map((block) => {
          const Component = BLOCK_MAP[block.block_type];
          if (!Component) return null;
          return (
            <Component
              key={block.id}
              content={block.content}
              settings={block.settings}
            />
          );
        })}
    </ThemeProvider>
  );
}
```

**Step 2: Create index barrel**

```typescript
export { BlockRenderer } from "./BlockRenderer";
export { ThemeProvider } from "./ThemeProvider";
```

**Step 3: Verify**

Run: `pnpm --filter landing typecheck`

**Step 4: Commit**

```bash
git add apps/landing/src/components/blocks/
git commit -m "feat(landing): add BlockRenderer mapping block_type to dynamic components"
```

---

## Phase 4: Landing App Routing

### Task 12: Create server-side variant fetching

**Files:**

- Create: `apps/landing/src/lib/get-variant.ts`

**Step 1: Write the data fetching function**

```typescript
import { createClient } from "@smartout/supabase/server";
import { unstable_cache } from "next/cache";
import type { LandingBlockType, BlockSettings } from "./block-schemas";
import { variantThemeSchema } from "./block-schemas";

export type VariantBlock = {
  id: string;
  block_type: LandingBlockType;
  sort_order: number;
  content: unknown;
  settings: BlockSettings;
  is_visible: boolean;
};

export type VariantData = {
  id: string;
  slug: string;
  name: string;
  status: string;
  is_default: boolean;
  theme: unknown;
  meta_title: string | null;
  meta_description: string | null;
  og_image_path: string | null;
  voice_config: unknown;
  blocks: VariantBlock[];
};

async function fetchVariant(slug?: string, previewId?: string): Promise<VariantData | null> {
  const supabase = await createClient();

  // Preview mode: fetch by ID regardless of status (requires godmode)
  if (previewId) {
    const { data } = await supabase
      .from("landing_variant")
      .select("*, blocks:landing_block(*)")
      .eq("id", previewId)
      .order("sort_order", { referencedTable: "landing_block" })
      .single();
    return data as VariantData | null;
  }

  // Normal mode: fetch published variant by slug or default
  const query = supabase
    .from("landing_variant")
    .select("*, blocks:landing_block(*)")
    .eq("status", "published")
    .order("sort_order", { referencedTable: "landing_block" });

  if (slug) {
    query.eq("slug", slug);
  } else {
    query.eq("is_default", true);
  }

  const { data } = await query.single();
  return data as VariantData | null;
}

export const getVariantWithBlocks = unstable_cache(fetchVariant, ["landing-variant"], {
  tags: ["landing"],
  revalidate: 300,
});

export function parseTheme(raw: unknown) {
  return variantThemeSchema.parse(raw ?? {});
}
```

**Step 2: Verify compilation**

Run: `pnpm --filter landing typecheck`

**Step 3: Commit**

```bash
git add apps/landing/src/lib/get-variant.ts
git commit -m "feat(landing): add server-side variant fetching with cache tags"
```

---

### Task 13: Create DB-driven landing page route

**Files:**

- Create: `apps/landing/src/app/v/page.tsx`

**Context:** We create a NEW route `/v` that renders DB-driven variants. The existing `/` page continues to work with hardcoded variants during migration. Once migration is verified, we swap them.

**Step 1: Write the new page**

```typescript
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getVariantWithBlocks, parseTheme } from "../../lib/get-variant";
import { BlockRenderer } from "../../components/blocks";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { PageTracker } from "../../components/tracking";

type PageProps = {
  searchParams: Promise<{ v?: string; preview?: string; id?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const variant = await getVariantWithBlocks(params.v, params.preview ? params.id : undefined);

  return {
    title: variant?.meta_title ?? "SmartOut - Møt fremtidens workforce management",
    description: variant?.meta_description ?? "AI-drevet workforce management for den norske serveringsbransjen.",
  };
}

export default async function VariantPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const variant = await getVariantWithBlocks(params.v, params.preview ? params.id : undefined);

  if (!variant) {
    // No variant found — redirect to home
    redirect("/");
  }

  const theme = parseTheme(variant.theme);

  return (
    <>
      <PageTracker />
      <Navigation />
      <main className="min-h-screen pt-16">
        <BlockRenderer
          blocks={variant.blocks}
          theme={theme}
          voiceConfig={variant.voice_config}
        />
      </main>
      <Footer />
    </>
  );
}
```

**Step 2: Verify the route loads**

Run: `pnpm --filter landing dev`

Open http://localhost:3055/v — should show either the default DB variant or redirect to `/` if no variants exist in DB yet.

**Step 3: Commit**

```bash
git add apps/landing/src/app/v/
git commit -m "feat(landing): add DB-driven variant route at /v with ?v=slug support"
```

---

### Task 14: Create revalidation API route

**Files:**

- Create: `apps/landing/src/app/api/revalidate/route.ts`

**Step 1: Write the route**

```typescript
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { secret } = await req.json();

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag("landing");
  return NextResponse.json({ revalidated: true });
}
```

**Step 2: Add env var to env.ts**

In `apps/landing/src/env.ts`, add to the `server` section:

```typescript
REVALIDATION_SECRET: z.string().min(16).optional(),
```

**Step 3: Commit**

```bash
git add apps/landing/src/app/api/revalidate/route.ts apps/landing/src/env.ts
git commit -m "feat(landing): add revalidation API endpoint for cache busting"
```

---

## Phase 5: Admin UI

### Task 15: Add variant list page to platform-admin

**Files:**

- Create: `apps/web/src/app/platform-admin/landing/variants/page.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/_components/variant-list.tsx`

**Context:** The admin UI lives under the existing `platform-admin/landing/` path. The current `page.tsx` shows activity. We add a `/variants` sub-route for managing variants.

**Step 1: Write the variant list server page**

Follows the same pattern as `platform-admin/users/page.tsx`:

- Check `getSuperAdminId()` → redirect if not godmode
- Fetch all landing_variants with `createAdminClient()`
- Pass to client component

**Step 2: Write the variant list client component**

Uses `DataTable` (existing in `@/components/platform-admin/data-table`):

- Columns: name, slug, status badge, is_default star, created_at, actions dropdown
- Actions: Edit (link to /variants/[id]), Duplicate, Set as default, Archive
- "Create variant" button → dialog with name + slug form

**Step 3: Verify it loads**

Run: `pnpm --filter web dev`

Navigate to http://localhost:3050/platform-admin/landing/variants

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/landing/variants/
git commit -m "feat(admin): add landing variant list page with CRUD actions"
```

---

### Task 16: Add sidebar navigation link

**Files:**

- Modify: `apps/web/src/components/platform-admin/sidebar-nav.tsx` (or wherever the sidebar is)

**Step 1: Find and update sidebar**

Add "Variants" link under the existing "Landing" section in the platform-admin sidebar navigation.

**Step 2: Commit**

```bash
git add apps/web/src/components/platform-admin/
git commit -m "feat(admin): add landing variants link to platform-admin sidebar"
```

---

### Task 17: Install @dnd-kit for drag-and-drop

**Files:**

- Modify: `apps/web/package.json`

**Step 1: Install**

```bash
cd apps/web && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "deps(web): add @dnd-kit for drag-and-drop block editing"
```

---

### Task 18: Create block editor page

**Files:**

- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/page.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/block-editor.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/block-card.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/variant-metadata-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/add-block-dialog.tsx`

**Context:** The block editor page is the main editing interface. It shows:

1. Variant metadata form (name, slug, theme, SEO) at the top
2. List of blocks as collapsible cards, reorderable via drag-and-drop
3. "Add section" button at the bottom

**Step 1: Write the server page**

Fetches variant + blocks from Supabase, passes to client `BlockEditor` component.

**Step 2: Write BlockEditor client component**

- Uses `@dnd-kit/sortable` for drag-and-drop reordering
- Each block rendered as `BlockCard` (collapsible)
- On reorder: update `sort_order` in Supabase
- "Add section" button opens `AddBlockDialog`

**Step 3: Write BlockCard component**

Collapsible card showing:

- Drag handle (⠿)
- Block type icon + name
- Preview text (first 50 chars of heading)
- Toggle visibility button
- Delete button
- Expand to show block-specific form

**Step 4: Write VariantMetadataForm**

Form fields: name, slug, status dropdown, is_default toggle, meta_title, meta_description, theme picker.

**Step 5: Write AddBlockDialog**

Modal with a grid of block types. Each type shown as a card with icon + name + description. Click to add.

**Step 6: Verify it loads**

Navigate to the edit page for a variant in the browser.

**Step 7: Commit**

```bash
git add apps/web/src/app/platform-admin/landing/variants/
git commit -m "feat(admin): add block editor with drag-and-drop and collapsible cards"
```

---

### Task 19: Create block-specific edit forms

**Files:**

- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/hero-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/features-grid-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/cta-section-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/stats-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/text-section-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/features-list-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/features-icons-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/testimonial-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/case-study-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/voice-widget-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/workspace-analyzer-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/image-section-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/pricing-preview-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/faq-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/logo-strip-form.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/forms/block-form-router.tsx`

**Context:** Each form matches its Zod schema from `block-schemas.ts`. Uses shadcn/ui `Input`, `Label`, `Select`, `Button`.

**Step 1: Write BlockFormRouter**

Routes `block_type` to the correct form component:

```typescript
const FORM_MAP: Record<LandingBlockType, ComponentType<BlockFormProps>> = {
  hero: HeroForm,
  features_grid: FeaturesGridForm,
  // ...
};
```

**Step 2: Write hero-form.tsx as reference**

Fields: heading (Input), subheading (Textarea), alignment (RadioGroup), buttons (dynamic list with add/remove), image (MediaPicker).

Each form receives `content`, `onChange(content)` callback. Autosave via debounce.

**Step 3: Write remaining 14 forms**

Follow the same pattern. Simpler blocks (text_section, voice_widget) have fewer fields.

**Step 4: Integrate forms into BlockCard**

When a BlockCard is expanded, render `<BlockFormRouter blockType={block.block_type} content={block.content} onChange={handleUpdate} />`.

**Step 5: Verify all forms render correctly**

**Step 6: Commit**

```bash
git add apps/web/src/app/platform-admin/landing/variants/
git commit -m "feat(admin): add block-specific edit forms for all 15 block types"
```

---

### Task 20: Add MediaPicker and IconPicker components

**Files:**

- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/media-picker.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/icon-picker.tsx`
- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/theme-picker.tsx`

**Step 1: Write MediaPicker**

- Shows current image (if set) with remove button
- "Upload" button opens file input
- Uploads to Supabase Storage `landing-media` bucket
- Creates `landing_media` row
- Returns `media_id` to parent form

**Step 2: Write IconPicker**

- Searchable dropdown of lucide icon names
- Shows icon preview next to each option
- Returns icon name string (e.g., "clock", "users")

**Step 3: Write ThemePicker**

- Grid of accent color swatches (orange, amber, emerald, slate, rose, yellow)
- Click to select
- Shows preview with selected accent

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/landing/variants/
git commit -m "feat(admin): add MediaPicker, IconPicker, and ThemePicker components"
```

---

### Task 21: Add autosave and publish flow

**Files:**

- Modify: `apps/web/src/app/platform-admin/landing/variants/[variantId]/_components/block-editor.tsx`

**Step 1: Implement autosave**

- Debounce saves (1 second after last change)
- Show save status indicator: "Sparat" / "Lagrer..." / "Ulagrede endringer"
- Save individual block content updates to Supabase
- Save sort_order changes after drag-and-drop

**Step 2: Implement publish/unpublish**

- Status dropdown in header: Draft / Published / Archived
- Changing status calls Supabase update
- After publishing, trigger revalidation: POST to landing app `/api/revalidate`

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/landing/variants/
git commit -m "feat(admin): add autosave and publish flow with revalidation"
```

---

### Task 22: Add preview functionality

**Files:**

- Create: `apps/web/src/app/platform-admin/landing/variants/[variantId]/preview/page.tsx`

**Step 1: Write preview page**

Opens the landing app `/v?preview=true&id={variantId}` in an iframe. Shows "Preview" banner. Includes device size toggles (mobile/tablet/desktop).

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/landing/variants/
git commit -m "feat(admin): add variant preview with responsive device toggle"
```

---

## Phase 6: Seed Existing Variants + Migration

### Task 23: Write seed migration for existing 7 variants

**Files:**

- Create: `supabase/migrations/20260301600100_seed_landing_variants.sql`

**Context:** Extract the hardcoded content from the 7 existing variant components and insert them as `landing_variant` + `landing_block` rows. This is the bridge between old and new systems.

**Step 1: Write the seed SQL**

Manually extract hero headings, subheadings, feature lists, CTA text, voice configs from each variant component file. Create INSERT statements matching the block schemas.

Example for Variant B (Standard/Default):

```sql
-- Variant B (Ingrid — Standard)
INSERT INTO landing_variant (id, slug, name, status, is_default, theme, meta_title, meta_description, voice_config, sort_order)
VALUES (
  gen_random_uuid(),
  'default',
  'Standard (Ingrid)',
  'published',
  true,
  '{"accent": "orange", "accentColor": "234 88% 55%", "accentForeground": "0 0% 100%"}',
  'SmartOut - Møt fremtidens workforce management',
  'AI-drevet workforce management for den norske serveringsbransjen.',
  '{"personaName": "Ingrid", "personaRole": "Daglig leder", "promptContext": "..."}',
  0
);
-- Then INSERT blocks for this variant...
```

Repeat for all 7 variants (A, B, E, F, K, S, T).

**Step 2: Apply migration**

**Step 3: Verify variants load at /v**

Open http://localhost:3055/v — should show the default (B) variant with all blocks rendered from DB data.

Test slugs: http://localhost:3055/v?v=chef, etc.

**Step 4: Commit**

```bash
git add supabase/migrations/20260301600100_seed_landing_variants.sql
git commit -m "feat(db): seed existing 7 landing variants into page builder tables"
```

---

### Task 24: Verify parity between old and new rendering

**Step 1: Visual comparison**

For each of the 7 variants, compare:

- Old: http://localhost:3055 (with localStorage variant switcher)
- New: http://localhost:3055/v?v={slug}

They don't need to be pixel-identical, but should have the same structure, content, and feel.

**Step 2: Fix any rendering issues in block components**

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(landing): resolve rendering parity issues between old and new variant system"
```

---

## Phase 7: Switch Default + Cleanup

### Task 25: Make /v the default route, move old page to /legacy

**Files:**

- Modify: `apps/landing/src/app/page.tsx` → rename to `apps/landing/src/app/legacy/page.tsx`
- Move: `apps/landing/src/app/v/page.tsx` → `apps/landing/src/app/page.tsx`
- Modify: `apps/landing/src/app/page.tsx` (new) — update import paths

**Step 1: Create /legacy route with old page**

Move the current `page.tsx` to `apps/landing/src/app/legacy/page.tsx` so it's still accessible at `/legacy` as a fallback.

**Step 2: Promote /v/page.tsx to root**

Move or copy the DB-driven page to be the root `page.tsx`.

**Step 3: Verify**

- http://localhost:3055 → shows DB-driven default variant
- http://localhost:3055?v=chef → shows DB-driven chef variant
- http://localhost:3055/legacy → shows old hardcoded page (fallback)

**Step 4: Commit**

```bash
git add apps/landing/src/app/
git commit -m "feat(landing): switch root page to DB-driven variant system"
```

---

### Task 26: Remove old variant components

**Files:**

- Delete: `apps/landing/src/components/landing/VariantELanding.tsx`
- Delete: `apps/landing/src/components/landing/VariantTLanding.tsx`
- Delete: `apps/landing/src/components/landing/VariantKLanding.tsx`
- Delete: `apps/landing/src/components/landing/VariantALanding.tsx`
- Delete: `apps/landing/src/components/landing/VariantFLanding.tsx`
- Delete: `apps/landing/src/components/landing/VariantSLanding.tsx`
- Delete: `apps/landing/src/lib/landing-variant.ts` (replaced by DB-driven system)
- Delete: `apps/landing/src/components/variant-switcher.tsx` (replaced by admin UI)
- Delete: `apps/landing/src/app/legacy/page.tsx` (when fully verified)

**Step 1: Remove old files**

Only do this AFTER Phase 6 is fully verified and the team is confident in the new system.

**Step 2: Remove dead imports**

Clean up any remaining references to old variant components.

**Step 3: Verify**

Run: `pnpm --filter landing typecheck && pnpm --filter landing lint && pnpm --filter landing build`

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(landing): remove legacy variant components (~4500 lines)"
```

---

### Task 27: Final typecheck, lint, and build

**Step 1: Full monorepo check**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

**Step 2: Fix any issues**

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: resolve all typecheck and lint issues after landing page builder"
```

---

## ADR

After all tasks are complete, write an ADR documenting:

- Decision to use block-based page builder over free canvas
- Platform-level tables (no workspace_id)
- Seed migration strategy
- Register in `docs/decisions/0000-decision-log.md`

---

## Summary

| Phase | Tasks | Key Deliverable                                                 |
| ----- | ----- | --------------------------------------------------------------- |
| 1     | 1-4   | Performance optimization (code-split, LazyMotion, image config) |
| 2     | 5-6   | DB schema + Storage bucket                                      |
| 3     | 7-11  | Block schemas, 15 block components, BlockRenderer               |
| 4     | 12-14 | Server-side variant fetching, /v route, revalidation            |
| 5     | 15-22 | Admin UI — variant list, block editor, forms, preview           |
| 6     | 23-24 | Seed 7 existing variants, verify parity                         |
| 7     | 25-27 | Switch default route, remove old code, final checks             |

**Total: 27 tasks across 7 phases.**
