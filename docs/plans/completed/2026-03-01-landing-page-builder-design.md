---
title: "✅ Design — Landing Page Builder + Performance Optimization"
status: done
updated: 2026-03-07
created: 2026-03-01
module: landing
tags: [design, landing, performance, admin, page-builder, archived]
---

# ✅ Design — Landing Page Builder + Performance Optimization

> Closed on 2026-03-07 as completed-superseded.
>
> Outcome:
>
> - Core builder architecture is implemented (DB schema, admin builder UI, server rendering, `?v=slug` fallback, preview route, and revalidation).
> - Delivery differs from the original design in some areas (tracking architecture and route structure), but meets the functional objective.
> - Remaining minor drift is tracked as follow-up hardening/polish, not a blocker for closing this design plan.

> Branch: `feat/landing-optimization` | Worktree: wt-5 | Approved: 2026-03-01

## Goal

1. **Performance:** Optimize current landing app (code-split variants, lazy-load heavy deps, image infra)
2. **Variant System:** Block-based page builder in admin dashboard — admin creates unlimited landing page variants by combining ~15 block types, content stored in Supabase, rendered server-side
3. **Routing:** URL parameter `?v=slug` selects variant, default variant shown without parameter
4. **Migration:** Seed existing 7 hardcoded variants into DB, then remove old code

## Approach

**Block-based Page Builder** (Approach A) — admin builds variants by arranging predefined blocks (Hero, Features, CTA, Stats, etc.). Each block has structured content (Zod-validated JSONB). Rendered server-side by landing app. Balances WYSIWYG flexibility with structural safety.

---

## Section 1: Performance Optimization

### 1.1 Code-split variants

`page.tsx` (66.5 KB) imports ALL 7 variants synchronously. Switch to `next/dynamic` per variant — only selected variant loaded.

**Expected gain:** ~80% less JS for homepage.

### 1.2 Framer Motion tree-shaking

Switch from full `framer-motion` import to `framer-motion/m` + `LazyMotion` with `domAnimation` features.

**Expected gain:** ~60 KB less bundle.

### 1.3 Icon tree-shaking audit

Verify all `lucide-react` imports are direct (not barrel). Next.js modularizeImports should handle this.

### 1.4 PostHog lazy-load

Dynamic import `posthog-js` on first interaction or after idle instead of page load.

**Expected gain:** ~40 KB deferred.

### 1.5 Image infrastructure

Configure `next/image` in `next.config.ts` for Supabase Storage remote patterns + AVIF/WebP formats.

---

## Section 2: Database Schema

### Tables

**`landing_variant`** — Each variant is a "page"

| Column             | Type                          | Description                                         |
| ------------------ | ----------------------------- | --------------------------------------------------- |
| `id`               | uuid PK                       |                                                     |
| `slug`             | text UNIQUE                   | URL slug. Default variant has `slug = 'default'`    |
| `name`             | text                          | Admin display name                                  |
| `status`           | enum `landing_variant_status` | `draft` / `published` / `archived`                  |
| `is_default`       | boolean                       | Shown without ?v= parameter. Exactly 1 row = true   |
| `theme`            | jsonb                         | Color theme: `{ accent, accentMap }`                |
| `meta_title`       | text                          | SEO title                                           |
| `meta_description` | text                          | SEO description                                     |
| `og_image_path`    | text                          | OG image in Storage                                 |
| `voice_config`     | jsonb                         | Persona name, role, prompt context for voice widget |
| `sort_order`       | int                           | Order in admin list                                 |
| `created_at`       | timestamptz                   |                                                     |
| `updated_at`       | timestamptz                   |                                                     |

**`landing_block`** — Sections on a variant page

| Column       | Type                      | Description                                  |
| ------------ | ------------------------- | -------------------------------------------- |
| `id`         | uuid PK                   |                                              |
| `variant_id` | uuid FK → landing_variant |                                              |
| `block_type` | enum `landing_block_type` | `hero`, `features_grid`, `cta_section`, etc. |
| `sort_order` | int                       | Position on page                             |
| `content`    | jsonb                     | Block-specific content (Zod-validated)       |
| `settings`   | jsonb                     | Layout/styling options                       |
| `is_visible` | boolean                   | Hide without deleting                        |
| `created_at` | timestamptz               |                                              |
| `updated_at` | timestamptz               |                                              |

**`landing_media`** — Images/videos in Storage

| Column         | Type               | Description              |
| -------------- | ------------------ | ------------------------ |
| `id`           | uuid PK            |                          |
| `variant_id`   | uuid FK (nullable) | Can be shared            |
| `storage_path` | text               | Path in Supabase Storage |
| `alt_text`     | text               | Accessibility            |
| `width`        | int                | Original width           |
| `height`       | int                | Original height          |
| `mime_type`    | text               |                          |
| `file_size`    | int                | Bytes                    |
| `created_at`   | timestamptz        |                          |

### Block types (enum `landing_block_type`)

| Block type           | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `hero`               | Heading + subheading + CTA button(s) + optional image |
| `features_grid`      | Grid with icon + heading + short text                 |
| `features_list`      | Vertical list with icon + heading + description       |
| `features_icons`     | Large icons with 3-4 word labels (accessibility)      |
| `cta_section`        | Call-to-action with heading + button + background     |
| `stats`              | Numbers/metrics in a row                              |
| `testimonial`        | Quote + name + role + image                           |
| `case_study`         | Extended testimonial with results                     |
| `voice_widget`       | Voice demo with persona context                       |
| `workspace_analyzer` | URL analysis tool                                     |
| `text_section`       | Free text with heading (markdown)                     |
| `image_section`      | Image with optional caption                           |
| `pricing_preview`    | Pricing overview with CTA to /pricing                 |
| `faq`                | Expandable Q&A                                        |
| `logo_strip`         | Row of customer logos                                 |

### RLS

- **Landing app:** Reads via `anon` key — only `status = 'published'` variants
- **Admin dashboard:** Reads/writes via JWT — godmode required
- No `workspace_id` — platform-level tables

### Storage

- Bucket: `landing-media` (public)
- Path: `variants/{variant_id}/{filename}`
- Upload via admin → Supabase Storage → `next/image` with remote patterns

---

## Section 3: Landing App Rendering

### URL routing

```
smartout.ai              → default variant (is_default = true)
smartout.ai?v=chef       → variant with slug "chef"
smartout.ai?v=nonexist   → fallback to default
```

### Data fetching

Server component fetches variant + blocks from Supabase. Cached with `unstable_cache` + `revalidateTag('landing')`.

### Block Renderer

Maps `block_type` → React component via `next/dynamic`. Each block dynamically imported.

```tsx
const BLOCK_MAP: Record<LandingBlockType, ComponentType<BlockProps>> = {
  hero: dynamic(() => import("./HeroBlock")),
  // ...
};

function BlockRenderer({ variant }) {
  return (
    <ThemeProvider theme={variant.theme}>
      {variant.blocks
        .filter((b) => b.is_visible)
        .map((block) => {
          const Component = BLOCK_MAP[block.block_type];
          return <Component key={block.id} content={block.content} settings={block.settings} />;
        })}
    </ThemeProvider>
  );
}
```

### Theme

Variant `theme` object sets CSS variables via `ThemeProvider`. Block components use `bg-accent`, `text-accent-foreground`.

### SEO

`generateMetadata()` reads variant's `meta_title`, `meta_description`, `og_image_path`.

### Tracking

PostHog tracking unchanged — `variant` field set from `variant.slug` instead of localStorage.

---

## Section 4: Admin UI

### Route structure

```
apps/web/src/app/(dashboard)/admin/landing/
├── page.tsx                    → Variant list
├── [variantId]/
│   ├── page.tsx                → Block editor
│   └── preview/page.tsx        → Preview
└── components/
    ├── VariantList.tsx
    ├── VariantForm.tsx
    ├── BlockEditor.tsx
    ├── BlockCard.tsx
    ├── BlockFormRouter.tsx
    ├── forms/                   → One form per block type (15 total)
    ├── MediaPicker.tsx
    ├── IconPicker.tsx
    ├── ThemePicker.tsx
    └── PreviewFrame.tsx
```

### Variant list

Table with name, slug, status, default badge. Actions: edit, duplicate, set as default, archive.

### Block editor

- Drag-and-drop block reordering (`@dnd-kit/sortable`)
- Accordion pattern — click to expand block form inline
- Toggle visibility without deleting
- "Add section" modal with block type cards

### Block forms

One form component per block type with structured fields. Example hero form: heading, subheading, alignment, buttons (dynamic list), image picker, position.

### Preview

Button opens landing page in iframe with `?preview=true&id={variantId}`. Landing app recognizes preview mode, fetches draft variants, requires godmode session.

### Autosave

- Debounced save (1s inactivity)
- Status indicator: "Saved" / "Saving..." / "Unsaved changes"
- Publishing is separate action (draft → published)

### New dependencies

Only `@dnd-kit/core` + `@dnd-kit/sortable` (~15 KB gzipped). All else covered by shadcn/ui + Radix.

---

## Section 5: Caching & Revalidation

### Three cache layers

1. **Supabase query cache** — `unstable_cache()` with tag `'landing'`
2. **Next.js route cache** — `revalidateTag('landing')` on admin save
3. **Vercel Edge cache** — stale-while-revalidate headers

### Revalidation trigger

Admin dashboard calls `POST /api/revalidate` after publish → `revalidateTag('landing')`. Page updates within seconds without rebuild.

---

## Section 6: Migration Plan

### Seed existing variants

Extract content from 7 hardcoded variants into JSONB format matching block schema:

```
Variant A (Ahmad)  → hero + features_grid + voice_widget + cta_section
Variant B (Ingrid) → hero + features_grid + workspace_analyzer + voice_widget + cta_section
Variant E (Lars)   → hero + stats + features_grid + voice_widget + cta_section
Variant F (Fatima) → hero + features_icons + cta_section
Variant K (Katrine)→ hero + stats + features_list + case_study + cta_section
Variant S (Signe)  → hero + features_list + voice_widget + testimonial + cta_section
Variant T (Thomas) → hero + stats + features_grid + voice_widget + cta_section
```

### Parallel operation

Phase 1: New system lives alongside old — `?v=new-chef` points to DB variant
Phase 2: Migrate all 7 variants to DB, switch default rendering
Phase 3: Remove old variant components (~4500 lines)

---

## Delivery Order

| Phase       | Content                                                          | Depends on       |
| ----------- | ---------------------------------------------------------------- | ---------------- |
| **Phase 1** | Performance optimization (code-split, lazy motion, PostHog lazy) | Nothing          |
| **Phase 2** | DB schema + migration + Storage bucket                           | Phase 1          |
| **Phase 3** | Block components (15) + BlockRenderer + ThemeProvider            | Phase 2          |
| **Phase 4** | Landing app routing (?v=slug, server fetch, SEO)                 | Phase 3          |
| **Phase 5** | Admin UI — variant list + block editor + forms                   | Phase 3          |
| **Phase 6** | Seed existing variants → DB, parallel operation                  | Phase 4 + 5      |
| **Phase 7** | Switch default, remove old code                                  | Phase 6 verified |

Phase 4 and 5 can run in parallel.

---

## Out of Scope

- A/B testing with automatic randomization
- Version history / undo on block changes
- Collaborative editing (multiple admins simultaneously)
- Internationalization of landing content (one language per variant)
- Drag-and-drop within block forms (e.g., reorder features in a grid)

---

## Acceptance Criteria

- [ ] Lighthouse Performance score > 90 on homepage
- [ ] Each variant loads only its own block components (code-split)
- [ ] Admin can create new variant with slug, theme, and blocks
- [ ] Admin can add/remove/reorder blocks via drag-and-drop
- [ ] Admin can edit block content via forms
- [ ] Admin can publish/unpublish variant
- [ ] `?v=slug` shows correct variant for visitors
- [ ] Default variant shown without parameter
- [ ] Invalid slug → fallback to default
- [ ] Preview works for draft variants
- [ ] Images uploaded to Supabase Storage and optimized via next/image
- [ ] Existing 7 variants migrated to DB
- [ ] PostHog tracking works with new variant slugs
- [ ] Voice widget works with DB-stored persona config
