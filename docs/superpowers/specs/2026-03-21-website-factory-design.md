---
title: Website Factory Design Spec
status: approved
updated: 2026-03-22
created: 2026-03-21
module: website-factory
tags: [website, multi-tenant, public-site, builder, publishing, menu, ISR]
---

# Website Factory Design Spec

> Approved architecture for the SmartOut Website Factory. A controlled website builder inside the admin portal that lets each workspace publish a public-facing website.

## Executive Summary

The Website Factory is an admin portal feature that gives each SmartOut workspace a public website. Admins choose a template, customize content via structured section editing, manage menus (structured data or PDF), and publish to `{site_slug}.smartout.info`. Content is auto-generated from workspace intelligence. Published sites are served as ISR pages from immutable snapshots — fast, stable, and SEO-friendly.

**Product frame:** The website is the public face of the workspace. It distributes SmartOut's structured business data (branding, menus, hours, contact, booking) to the public web.

**Key constraints:**

- One site per workspace (MVP)
- Controlled section editor, not freeform page builder
- No `custom_html`, no arbitrary CSS, no contact form submission (MVP)
- All database objects in dedicated `websites` Postgres schema
- Public rendering server-side only from immutable snapshots
- Templates are hybrid (code manifests + DB identity)

---

## 1. System Architecture

### Domain Map

| Domain                      | Purpose                                          | Auth          | Rendering                           |
| --------------------------- | ------------------------------------------------ | ------------- | ----------------------------------- |
| `app.smartout.ai`           | Admin portal, workspace selector, platform-admin | Authenticated | SSR                                 |
| `{slug}.smartout.ai`        | Workspace dashboard (existing)                   | Authenticated | SSR                                 |
| `{site_slug}.smartout.info` | Public website (default)                         | Anonymous     | ISR from snapshot, server-side only |
| `customdomain.com`          | Public website (custom, Phase 2)                 | Anonymous     | ISR from snapshot, server-side only |

No overlap. `.ai` is internal. `.info` is public. Custom domains are Phase 2.

### Routing

- Middleware detects `*.smartout.info` (or `*.public.localhost:3060` in local dev) or known custom domain
- Sets `x-site-host` header
- Rewrites to `/public-site/[host]/[...path]`
- That's all middleware does. No DB lookups, no auth, no content fetching.
- Server components in `/public-site/` route group resolve host, fetch snapshot, render.

**Middleware integration:** `extractSubdomain()` in `apps/web/src/lib/subdomain.ts` must be extended with a new `SubdomainResult` variant: `{ type: "public-site"; host: string }`. All consumers of `SubdomainResult` must be audited for exhaustive-switch handling.

**Middleware routing order (strict):**

1. `*.smartout.info` → `public-site`
2. `*.public.localhost` → `public-site`
3. `*.smartout.ai` subdomain → workspace dashboard
4. `app.smartout.ai` → admin portal
5. fallback

If this order is wrong, routing bugs will be extremely hard to debug. The `.smartout.info` check **must** come first because `.smartout.ai` matching could otherwise intercept public-site requests.

**Local development:** Public sites are tested via `*.public.localhost:3060`. The `extractSubdomain()` function maps `{slug}.public.localhost` to the same `public-site` result type. No `/etc/hosts` changes needed.

### Builder

Lives at `{slug}.smartout.ai/dashboard/website` inside the existing admin portal. Only `admin` and `owner` roles can access.

### Data Flow

```
Builder (authenticated) → writes draft tables in websites.* schema
                        → publish pipeline builds immutable snapshot
                        → snapshot stored in websites.website_published_snapshot
                        → on-demand ISR revalidation triggered

Public site (anonymous) → middleware rewrites to /public-site/[host]/...
                        → server component calls site-public-repository.ts
                        → repository calls websites.get_active_site_snapshot_by_host(host)
                        → server renders from snapshot data
                        → ISR caches result
```

---

## 2. Data Model

All tables live in the `websites` schema. Cross-schema references are fully qualified.

### Hard Rule

> All Website Factory database objects must live in a dedicated PostgreSQL schema named `websites`, with fully qualified SQL references and schema-scoped migrations.

Supporting objects (enums/CHECK constraints, views, RPC functions, triggers, indexes, helper functions) also live in `websites` where they are specific to this bounded context. Shared auth/workspace helpers remain in `public`.

### Schema-wide conventions

- All `SECURITY DEFINER` functions in `websites` must set `SET search_path = websites, public` to prevent cross-schema resolution failures.
- All tables with `updated_at` columns get a `BEFORE UPDATE` trigger calling `public.set_updated_at()` per project convention.
- All `*_by` columns (e.g. `published_by`, `created_by`, `uploaded_by`, `performed_by`) reference `public.profile(profile_id)`, NOT `public.user_identity(user_id)`. Builder actions resolve the current workspace profile before writing.
- CHECK constraints are used instead of enums for all `websites.*` columns. Rationale: the `websites` schema is a bounded context — CHECK constraints keep type definitions local and avoid polluting the shared enum namespace. New values require only a constraint update, not a global enum migration.
- Auto-increment per-parent version numbers (`website_published_snapshot.version`, `website_draft_revision.revision_number`) are computed via `SELECT COALESCE(MAX(version), 0) + 1 ... FOR UPDATE` within a transaction. No sequences.
- All data tables support soft delete via `deleted_at timestamptz`. NULL = active, set = deleted. Queries must filter `WHERE deleted_at IS NULL` unless explicitly recovering deleted data. Unique constraints use partial indexes excluding soft-deleted rows.

### MVP Limits

Enforced at the application layer and/or via CHECK constraints:

| Resource                       | Limit    |
| ------------------------------ | -------- |
| Pages per site                 | 20       |
| Sections per page              | 30       |
| Menus per site                 | 10       |
| Menu items per menu            | 200      |
| Assets per site                | 500      |
| Snapshot JSON size             | 2 MB     |
| Active preview tokens per site | 50       |
| Preview token TTL              | 24 hours |
| Image upload size              | 5 MB     |
| PDF upload size                | 20 MB    |

Without limits, large snapshots will degrade ISR performance and DB storage.

### 2.1 `websites.website` — 1:1 with workspace

| Column                     | Type                               | Notes                                                                            |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `website_id`               | UUID PK                            |                                                                                  |
| `workspace_id`             | UUID FK UNIQUE                     | References `public.workspace`. UNIQUE enforces 1:1 for MVP.                      |
| `site_slug`                | text NOT NULL UNIQUE               | Public URL slug: `{site_slug}.smartout.info`. Independent of workspace slug.     |
| `name`                     | text NOT NULL                      |                                                                                  |
| `tagline`                  | text                               |                                                                                  |
| `theme`                    | JSONB NOT NULL                     | Presentation tokens only: colors, fonts, radius, spacing, shadow, button variant |
| `visibility`               | text NOT NULL DEFAULT 'draft'      | CHECK: `draft`, `live`, `offline`                                                |
| `template_key`             | text NOT NULL                      | Which template this site was created from                                        |
| `template_version`         | int NOT NULL                       | Version of template at creation time                                             |
| `booking_provider`         | text NOT NULL DEFAULT 'none'       | CHECK: `none`, `dinnerbooking`, `opentable`, `custom`                            |
| `booking_url`              | text                               |                                                                                  |
| `social_links`             | JSONB                              | instagram, facebook, tripadvisor, google_maps URLs                               |
| `contact_email`            | text                               |                                                                                  |
| `contact_phone`            | text                               |                                                                                  |
| `contact_address`          | JSONB                              | street, city, postal_code, country                                               |
| `default_meta_title`       | text                               |                                                                                  |
| `default_meta_description` | text                               |                                                                                  |
| `default_og_image_path`    | text                               |                                                                                  |
| `created_at`               | timestamptz NOT NULL DEFAULT now() |                                                                                  |
| `updated_at`               | timestamptz NOT NULL DEFAULT now() |                                                                                  |
| `deleted_at`               | timestamptz                        | Soft delete. NULL = active. Set = deleted.                                       |

**`site_slug` rationale:** Decoupled from workspace slug. Workspace slugs can change, and multi-site per workspace (Phase 3) requires independent site identity. Platform domain becomes `{site_slug}.smartout.info`. Defaults to workspace slug at creation but is independently editable. CHECK: `slug ~ '^[a-z0-9-]+$'`, min 3 chars.

**Visibility semantics:**

- `draft` = no active public snapshot
- `live` = active snapshot serving on public domain
- `offline` = intentionally disabled even if prior snapshots exist

### 2.2 `websites.website_page`

| Column             | Type                               | Notes                                                                               |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| `website_page_id`  | UUID PK                            |                                                                                     |
| `website_id`       | UUID FK                            |                                                                                     |
| `workspace_id`     | UUID FK                            | For RLS. Must match parent website's workspace_id (enforced by trigger).            |
| `page_type`        | text NOT NULL                      | CHECK: `home`, `menu`, `about`, `careers`, `contact`, `gallery`, `events`, `custom` |
| `slug`             | text NOT NULL                      | UNIQUE(website_id, slug). Home page slug = '' (empty string).                       |
| `title`            | text NOT NULL                      |                                                                                     |
| `is_visible`       | boolean NOT NULL DEFAULT true      |                                                                                     |
| `meta_title`       | text                               |                                                                                     |
| `meta_description` | text                               |                                                                                     |
| `og_image_path`    | text                               |                                                                                     |
| `sort_order`       | int NOT NULL DEFAULT 0             | CHECK >= 0                                                                          |
| `created_at`       | timestamptz NOT NULL DEFAULT now() |                                                                                     |
| `updated_at`       | timestamptz NOT NULL DEFAULT now() |                                                                                     |

| `deleted_at` | timestamptz | Soft delete |

**Constraints:**

- `UNIQUE(website_id, slug) WHERE deleted_at IS NULL`
- Partial unique index: one `page_type = 'home'` per website `WHERE deleted_at IS NULL`
- `UNIQUE(website_id, sort_order) WHERE is_visible = true AND deleted_at IS NULL` — deterministic navigation order
- `CHECK(slug ~ '^[a-z0-9-]*$')` (lowercase alphanumeric + hyphens, empty allowed for home)

### 2.3 `websites.website_section`

| Column               | Type                               | Notes                                                      |
| -------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `website_section_id` | UUID PK                            |                                                            |
| `website_page_id`    | UUID FK                            |                                                            |
| `workspace_id`       | UUID FK                            | For RLS. Enforced by trigger.                              |
| `section_type`       | text NOT NULL                      | Text registry key. CHECK against allowlist.                |
| `content`            | JSONB NOT NULL                     | Validated against section-specific Zod schema in app layer |
| `settings`           | JSONB NOT NULL DEFAULT '{}'        | Design tokens only (see below)                             |
| `is_visible`         | boolean NOT NULL DEFAULT true      |                                                            |
| `sort_order`         | int NOT NULL DEFAULT 0             | CHECK >= 0                                                 |
| `created_at`         | timestamptz NOT NULL DEFAULT now() |                                                            |
| `updated_at`         | timestamptz NOT NULL DEFAULT now() |                                                            |
| `deleted_at`         | timestamptz                        | Soft delete                                                |

**MVP section types (CHECK constraint):**
`hero`, `rich_text`, `text_image`, `feature_grid`, `gallery`, `testimonials`, `cta`, `hours`, `map`, `contact`, `menu_preview`, `menu_full`, `faq`, `booking_cta`, `pdf_viewer`, `footer`

**Section `settings` schema — design tokens only, never arbitrary CSS:**

```typescript
interface SectionSettings {
  spacing: "none" | "sm" | "md" | "lg" | "xl";
  backgroundVariant: "default" | "muted" | "accent" | "dark" | "image";
  containerWidth: "narrow" | "default" | "wide" | "full";
  alignment: "left" | "center" | "right";
  themeSurface: "primary" | "secondary" | "inverse";
}
```

### 2.4 `websites.website_menu`

| Column             | Type                               | Notes                                                    |
| ------------------ | ---------------------------------- | -------------------------------------------------------- |
| `website_menu_id`  | UUID PK                            |                                                          |
| `website_id`       | UUID FK                            |                                                          |
| `workspace_id`     | UUID FK                            | For RLS                                                  |
| `name`             | text NOT NULL                      | e.g. "Lunch", "Dinner", "Drinks", "Wine List"            |
| `description`      | text                               |                                                          |
| `source_type`      | text NOT NULL DEFAULT 'structured' | CHECK: `structured`, `pdf`                               |
| `pdf_storage_path` | text                               | For PDF fallback. Second-class: renders viewer/download. |
| `sort_order`       | int NOT NULL DEFAULT 0             |                                                          |
| `is_visible`       | boolean NOT NULL DEFAULT true      |                                                          |
| `created_at`       | timestamptz NOT NULL DEFAULT now() |                                                          |
| `updated_at`       | timestamptz NOT NULL DEFAULT now() |                                                          |
| `deleted_at`       | timestamptz                        | Soft delete                                              |

### 2.5 `websites.website_menu_category`

| Column                     | Type                               | Notes                                   |
| -------------------------- | ---------------------------------- | --------------------------------------- |
| `website_menu_category_id` | UUID PK                            |                                         |
| `website_menu_id`          | UUID FK                            |                                         |
| `website_id`               | UUID FK                            | For consistency trigger (one-hop check) |
| `workspace_id`             | UUID FK                            | For RLS                                 |
| `name`                     | text NOT NULL                      | e.g. "Starters", "Mains", "Desserts"    |
| `description`              | text                               |                                         |
| `sort_order`               | int NOT NULL DEFAULT 0             |                                         |
| `created_at`               | timestamptz NOT NULL DEFAULT now() |                                         |
| `updated_at`               | timestamptz NOT NULL DEFAULT now() |                                         |
| `deleted_at`               | timestamptz                        | Soft delete                             |

### 2.6 `websites.website_menu_item`

| Column                     | Type                               | Notes                                   |
| -------------------------- | ---------------------------------- | --------------------------------------- |
| `website_menu_item_id`     | UUID PK                            |                                         |
| `website_menu_category_id` | UUID FK                            |                                         |
| `website_id`               | UUID FK                            | For consistency trigger (one-hop check) |
| `workspace_id`             | UUID FK                            | For RLS                                 |
| `name`                     | text NOT NULL                      |                                         |
| `description`              | text                               |                                         |
| `price`                    | numeric(10,2)                      |                                         |
| `currency`                 | text NOT NULL DEFAULT 'NOK'        | CHECK: `NOK`, `SEK`, `DKK`, `EUR`       |
| `allergens`                | text[] DEFAULT '{}'                | Array of allergen codes                 |
| `dietary_tags`             | text[] DEFAULT '{}'                | vegan, vegetarian, gluten-free, etc.    |
| `image_asset_id`           | UUID FK                            | References websites.website_asset       |
| `is_visible`               | boolean NOT NULL DEFAULT true      |                                         |
| `sort_order`               | int NOT NULL DEFAULT 0             |                                         |
| `created_at`               | timestamptz NOT NULL DEFAULT now() |                                         |
| `updated_at`               | timestamptz NOT NULL DEFAULT now() |                                         |
| `deleted_at`               | timestamptz                        | Soft delete                             |

### 2.7 `websites.website_published_snapshot`

| Column          | Type                               | Notes                                                       |
| --------------- | ---------------------------------- | ----------------------------------------------------------- |
| `snapshot_id`   | UUID PK                            |                                                             |
| `website_id`    | UUID FK                            |                                                             |
| `workspace_id`  | UUID FK                            | For RLS                                                     |
| `version`       | int NOT NULL                       | Auto-increment per website. UNIQUE(website_id, version).    |
| `snapshot_data` | JSONB NOT NULL                     | Render contract (see snapshot shape below)                  |
| `snapshot_hash` | text NOT NULL                      | SHA-256 of snapshot_data JSON. Detects identical publishes. |
| `is_active`     | boolean NOT NULL DEFAULT false     | Partial unique: one active per website                      |
| `published_by`  | UUID FK                            | References public.profile(profile_id)                       |
| `published_at`  | timestamptz NOT NULL DEFAULT now() |                                                             |
| `created_at`    | timestamptz NOT NULL DEFAULT now() |                                                             |
| `updated_at`    | timestamptz NOT NULL DEFAULT now() | Tracks `is_active` toggle changes                           |
| `deleted_at`    | timestamptz                        | Soft delete                                                 |

**Constraints:**

- `UNIQUE(website_id, version)`
- Partial unique index: `UNIQUE(website_id) WHERE is_active = true`

### 2.8 `websites.website_draft_revision`

| Column             | Type                               | Notes                                                            |
| ------------------ | ---------------------------------- | ---------------------------------------------------------------- |
| `revision_id`      | UUID PK                            |                                                                  |
| `website_id`       | UUID FK                            |                                                                  |
| `workspace_id`     | UUID FK                            | For RLS                                                          |
| `revision_number`  | int NOT NULL                       | Auto-increment per website. UNIQUE(website_id, revision_number). |
| `draft_data`       | JSONB NOT NULL                     | Full site state at revision time                                 |
| `schema_version`   | int NOT NULL                       | For future draft migration                                       |
| `template_key`     | text NOT NULL                      | Historical fidelity                                              |
| `template_version` | int NOT NULL                       | Historical fidelity                                              |
| `source`           | text NOT NULL                      | CHECK: `manual`, `autosave`, `generator`, `template_apply`       |
| `created_by`       | UUID FK                            | References public.profile                                        |
| `created_at`       | timestamptz NOT NULL DEFAULT now() |                                                                  |

### 2.9 `websites.website_asset`

| Column             | Type                               | Notes                                                     |
| ------------------ | ---------------------------------- | --------------------------------------------------------- |
| `website_asset_id` | UUID PK                            |                                                           |
| `website_id`       | UUID FK                            |                                                           |
| `workspace_id`     | UUID FK                            | For RLS                                                   |
| `storage_path`     | text NOT NULL                      | Supabase Storage key: `{workspace_id}/{asset_uuid}.{ext}` |
| `file_name`        | text NOT NULL                      | Original filename                                         |
| `mime_type`        | text NOT NULL                      |                                                           |
| `width`            | int                                | For images                                                |
| `height`           | int                                | For images                                                |
| `file_size_bytes`  | bigint                             |                                                           |
| `alt_text`         | text NOT NULL DEFAULT ''           | Required for accessibility                                |
| `uploaded_by`      | UUID FK                            | References public.profile(profile_id)                     |
| `created_at`       | timestamptz NOT NULL DEFAULT now() |                                                           |
| `updated_at`       | timestamptz NOT NULL DEFAULT now() | Tracks alt_text/dimension updates                         |
| `deleted_at`       | timestamptz                        | Soft delete                                               |

### 2.10 `websites.website_domain`

| Column               | Type                                         | Notes                                                         |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------- | --- |
| `website_domain_id`  | UUID PK                                      |                                                               |
| `website_id`         | UUID FK                                      |                                                               |
| `workspace_id`       | UUID FK                                      | For RLS                                                       |
| `domain`             | text NOT NULL UNIQUE                         |                                                               |
| `domain_type`        | text NOT NULL                                | CHECK: `platform_subdomain`, `custom`                         |
| `is_primary`         | boolean NOT NULL DEFAULT false               | Exactly one per site                                          |
| `redirect_behavior`  | text NOT NULL DEFAULT 'redirect_to_primary'  | CHECK: `primary_only`, `serve_direct`, `redirect_to_primary`  |
| `status`             | text NOT NULL DEFAULT 'pending_verification' | CHECK: `pending_verification`, `verified`, `failed`, `active` |
| `verification_token` | text                                         | For DNS TXT verification                                      |
| `verified_at`        | timestamptz                                  |                                                               |
| `ssl_status`         | text NOT NULL DEFAULT 'pending'              | CHECK: `pending`, `active`, `error`                           |
| `created_at`         | timestamptz NOT NULL DEFAULT now()           |                                                               |
| `updated_at`         | timestamptz NOT NULL DEFAULT now()           |
| `deleted_at`         | timestamptz                                  | Soft delete                                                   |     |

**Constraints:**

- `UNIQUE(domain)`
- Partial unique: `UNIQUE(website_id) WHERE is_primary = true`
- Partial unique: `UNIQUE(website_id) WHERE domain_type = 'platform_subdomain'`

**Rules:**

- One `platform_subdomain` per site — auto-created as `{slug}.smartout.info`
- Zero or more `custom` domains (Phase 2)
- Exactly one `is_primary = true` at any time
- Non-primary domains redirect or serve with canonical pointing to primary

**Domain status lifecycle:**

- Platform subdomains: inserted directly as `status = 'active'` (skip verification)
- Custom domains (Phase 2): `pending_verification` -> `verified` (DNS TXT check passes) -> `active` (admin confirms and Vercel domain added)
- `failed`: DNS check failed. Can retry -> `pending_verification`
- Only `active` domains are served by the public renderer RPC

### 2.11 `websites.website_preview_session`

| Column               | Type                               | Notes                                                                                               |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `preview_session_id` | UUID PK                            |                                                                                                     |
| `website_id`         | UUID FK                            |                                                                                                     |
| `workspace_id`       | UUID FK                            | For RLS                                                                                             |
| `token`              | text NOT NULL UNIQUE               | Cryptographically random (32 bytes, hex)                                                            |
| `revision_id`        | UUID FK NOT NULL                   | Always pinned to a specific revision. App creates a draft revision before generating preview token. |
| `created_by`         | UUID FK                            | References public.profile(profile_id)                                                               |
| `expires_at`         | timestamptz NOT NULL               | CHECK: expires_at > created_at. Default: 24h from creation.                                         |
| `revoked_at`         | timestamptz                        | Nullable. Set to revoke early.                                                                      |
| `created_at`         | timestamptz NOT NULL DEFAULT now() |                                                                                                     |

### 2.12 `websites.website_publish_event`

| Column             | Type                               | Notes                                     |
| ------------------ | ---------------------------------- | ----------------------------------------- |
| `publish_event_id` | UUID PK                            |                                           |
| `website_id`       | UUID FK                            |                                           |
| `workspace_id`     | UUID FK                            | For RLS                                   |
| `snapshot_id`      | UUID FK                            | Which snapshot was activated/deactivated  |
| `action`           | text NOT NULL                      | CHECK: `publish`, `rollback`, `unpublish` |
| `performed_by`     | UUID FK                            | References public.profile                 |
| `created_at`       | timestamptz NOT NULL DEFAULT now() |                                           |

### workspace_id Consistency

Every child table's `workspace_id` must match its parent chain's `workspace_id`. Enforced by trigger:

```sql
CREATE OR REPLACE FUNCTION websites.enforce_workspace_consistency()
RETURNS trigger AS $$
BEGIN
  -- Example for website_page
  IF NEW.workspace_id != (
    SELECT w.workspace_id FROM websites.website w WHERE w.website_id = NEW.website_id
  ) THEN
    RAISE EXCEPTION 'workspace_id mismatch: child does not match parent website';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Applied as BEFORE INSERT OR UPDATE trigger on all child tables.

### RPC Functions

```sql
-- Public site read: returns active snapshot for a host
CREATE OR REPLACE FUNCTION websites.get_active_site_snapshot_by_host(p_host text)
RETURNS jsonb AS $$
  SELECT ws.snapshot_data
  FROM websites.website_published_snapshot ws
  JOIN websites.website_domain wd ON wd.website_id = ws.website_id
  WHERE wd.domain = p_host
    AND wd.status = 'active'
    AND ws.is_active = true
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
```

---

## 3. Snapshot Render Contract

The published snapshot is the sole data source for public rendering. Its shape is a versioned contract.

```typescript
interface SiteSnapshot {
  site: {
    name: string;
    tagline: string;
    contact: {
      email: string;
      phone: string;
      address: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
      };
    };
    social: {
      instagram?: string;
      facebook?: string;
      tripadvisor?: string;
      googleMaps?: string;
    };
  };
  theme: WebsiteTheme;
  navigation: {
    pages: Array<{
      slug: string;
      title: string;
      sortOrder: number;
    }>;
  };
  pages: Record<
    string,
    {
      title: string;
      slug: string;
      meta: {
        title: string;
        description: string;
        ogImage: string;
      };
      sections: Array<{
        id: string;
        type: string;
        content: Record<string, unknown>;
        settings: SectionSettings;
        sortOrder: number;
      }>;
    }
  >;
  menuData: {
    menus: Array<{
      name: string;
      description: string;
      sourceType: "structured" | "pdf";
      pdfPath?: string;
      categories: Array<{
        name: string;
        description: string;
        items: Array<{
          name: string;
          description: string;
          price: number;
          currency: string;
          allergens: string[];
          dietaryTags: string[];
          imageAssetId?: string;
        }>;
      }>;
    }>;
  };
  seoDefaults: {
    title: string;
    description: string;
    ogImage: string;
  };
  assets: {
    byId: Record<
      string,
      {
        storagePath: string; // Supabase Storage key (stable)
        alt: string;
        width: number | null;
        height: number | null;
        mimeType: string;
      }
    >;
    storageBaseUrl: string; // Resolved at snapshot build time, e.g. "https://xyz.supabase.co/storage/v1/object/public/website-assets"
  };
  integrations: {
    booking: {
      provider: string;
      url: string;
    };
  };
  buildMeta: {
    snapshotVersion: number;
    templateKey: string;
    templateVersion: number;
    schemaVersion: number;
    publishedAt: string;
    publishedBy: string;
  };
}
```

`buildMeta.schemaVersion` is critical. Without it, renderer migrations across snapshot shape changes become fragile. Increment on any structural change to the contract.

---

## 4. Theme Type

Presentation tokens only. Nothing else goes here.

```typescript
interface WebsiteTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseFontSize: number;
  };
  borderRadius: "none" | "sm" | "md" | "lg" | "full";
  spacing: "compact" | "default" | "relaxed";
  shadow: "none" | "sm" | "md" | "lg";
  buttonVariant: "solid" | "outline" | "ghost";
}
```

---

## 5. Auth + RLS Model

### Four Access Contexts

| Context                | Client                       | Role                   | Access                                                    |
| ---------------------- | ---------------------------- | ---------------------- | --------------------------------------------------------- |
| Admin builder          | Supabase server client (SSR) | Authenticated JWT      | CRUD on all `websites.*` tables within own workspace      |
| Public site render     | `site-public-repository.ts`  | Service role, isolated | Read active snapshot by host, read preview by token       |
| Background jobs        | Edge Function                | Service role           | Publish pipeline, domain verification, cache invalidation |
| API consumers (future) | `workspace-api` gateway      | API key (scoped)       | Read published site data via `websites:read` scope        |

### RLS Policy Pattern

All `websites.*` tables restrict both read and write to workspace **admins and owners only**. Non-admin workspace members (employees, managers) cannot see draft content, preview tokens, or revision history.

```sql
-- Workspace admins can read
CREATE POLICY "workspace_admins_read"
  ON websites.website_page FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Workspace admins can write
CREATE POLICY "workspace_admins_write"
  ON websites.website_page FOR INSERT, UPDATE, DELETE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Future: API key read (published data only)
CREATE POLICY "api_key_read"
  ON websites.website_published_snapshot FOR SELECT
  USING (workspace_id = public.get_api_workspace_id() AND is_active = true);
```

This prevents employees from extracting preview tokens or reading unpublished content via direct Supabase client queries.

### Service Role Isolation

Service role is used ONLY in `site-public-repository.ts`. This file exposes exactly two functions:

```typescript
export async function getPublishedSiteByHost(host: string): Promise<SiteSnapshot | null>;
export async function getPreviewSiteByToken(token: string): Promise<SiteSnapshot | null>;
```

Both call the narrow RPC functions in the `websites` schema. No raw table access. No service role anywhere else.

### Builder Role Gate

Only `admin` and `owner` roles can access the website builder UI:

- RLS write policies enforce this at the database layer
- Builder route layout checks profile role and redirects non-admins

### Storage

New bucket `website-assets`:

- Public read (published assets must be servable to anonymous visitors)
- Write restricted to workspace admins via storage RLS
- Assets referenced by UUID in section content and snapshot `assets.byId`

---

## 6. Builder Application Design

### Route Structure

```
/dashboard/website/
  page.tsx                → Overview: site status, quick actions, publish button
  /setup                  → First-time wizard (template pick, brand bootstrap)
  /pages/
    page.tsx              → Page list, reorder, add/remove
    /[pageId]/
      page.tsx            → Section editor for this page
  /menus/
    page.tsx              → Menu list
    /[menuId]/
      page.tsx            → Category + item editor
  /theme/
    page.tsx              → Theme token editor (colors, fonts, spacing)
  /settings/
    page.tsx              → Domain config, SEO defaults, booking, social, contact
  /preview               → Draft preview (iframe to preview URL)
  /history               → Draft revisions + publish events, restore
```

### Component Architecture

- Server components for data loading (pages, menus, sections)
- Client components for interactive editing (section editor, drag-reorder, theme picker)
- `"use client"` pushed as deep as possible

### State Strategy

- TanStack Query for all data fetching + mutations
- Optimistic updates for reordering (sort_order)
- Manual save with autosave fallback (creates `website_draft_revision` with source=`autosave` every 60s if dirty)
- Zod validation on every section content save

### AI Content Generation

- "Generate content" button on first setup and per-section
- Pulls workspace `intelligence_data`, branding, industry, location
- Calls generator in `packages/ai/src/generators/`
- Creates `website_draft_revision` with source=`generator` before applying
- Admin reviews and edits — AI never publishes directly

### Section Editor Pattern

Registry maps `section_type` to `{ schema, editor, renderer, defaults }`. Editor is form-driven from Zod schema. Renderer shows live preview alongside editor. Side-by-side layout.

---

## 7. Public Rendering Design

### Route Group

`/public-site/[host]/[...path]`

### Flow

1. Middleware detects `*.smartout.info` or known custom domain
2. Rewrites to `/public-site/{host}/` (or `/public-site/{host}/menu`, etc.)
3. Server component calls `getPublishedSiteByHost(host)`
4. No active snapshot = 404 or "coming soon" page
5. Snapshot found = resolve page from path, render sections
6. Preview: `?preview=TOKEN` calls `getPreviewSiteByToken(token)` instead

### Rendering Model

- ISR with `revalidate: 3600` (1 hour default)
- On-demand revalidation via `revalidateTag('site:${host}')` on publish
- Server components only for page content — zero client JS for static sections
- Client JS only for interactive sections (map embed, booking CTA)

### Section Rendering

```typescript
const PUBLIC_SECTION_MAP: Record<string, ComponentType<PublicSectionProps>> = {
  hero: HeroPublic,
  rich_text: RichTextPublic,
  text_image: TextImagePublic,
  feature_grid: FeatureGridPublic,
  gallery: GalleryPublic,
  testimonials: TestimonialsPublic,
  cta: CtaPublic,
  hours: HoursPublic,
  map: MapPublic,
  contact: ContactPublic,
  menu_preview: MenuPreviewPublic,
  menu_full: MenuFullPublic,
  faq: FaqPublic,
  booking_cta: BookingCtaPublic,
  pdf_viewer: PdfViewerPublic,
  footer: FooterPublic,
}

function SitePageRenderer({ page, theme, assets }: Props) {
  return page.sections
    .filter(s => s.is_visible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(section => {
      const Component = PUBLIC_SECTION_MAP[section.type]
      if (!Component) return null  // Gracefully skip unknown types
      return (
        <Component
          key={section.id}
          content={section.content}
          settings={section.settings}
          theme={theme}
          assets={assets}
        />
      )
    })
}
```

### SEO

- `generateMetadata()` from snapshot data per page
- Canonical URL always points to primary domain
- Dynamic sitemap at `{host}/sitemap.xml`
- Dynamic robots.txt (draft/offline = `Disallow: /`)
- JSON-LD structured data: `Organization`, `LocalBusiness`, `Menu`, `MenuItem`, `ContactPoint`, `BreadcrumbList`
- All server-side, no client JS

---

## 8. Publishing Pipeline

When admin clicks Publish:

0. **Lock** — `SELECT * FROM websites.website WHERE website_id = $1 FOR UPDATE` — prevents double publish, concurrent rollback, and version increment races
1. **Validate** — required pages exist (home minimum), all sections pass Zod validation, required fields populated
2. **Create revision** — save current draft state as `website_draft_revision` with source=`manual`
3. **Build snapshot** — assemble render contract from live draft tables (site + pages + sections + menus + assets + integrations + buildMeta with current schemaVersion)
4. **Hash snapshot** — SHA-256 of `snapshot_data` JSON. If hash matches latest snapshot, skip (no-op publish). Otherwise continue.
5. **Write snapshot** — insert `websites.website_published_snapshot` with next version number + hash
6. **Activate** — new snapshot `is_active = true`, all others `is_active = false`
7. **Update website** — set `visibility = 'live'`
8. **Log event** — insert `websites.website_publish_event` with action=`publish`
9. **Commit transaction**
10. **Invalidate cache** — `revalidateTag('site:${host}')` for all domains (after commit)
11. **Emit telemetry** — `website.published` event (after commit)

**Synchronous.** Steps 0-9 run in a single database transaction. Steps 10-11 run after commit (cache invalidation and telemetry are side effects, not transactional).

**Rollback:** Admin picks previous snapshot from history. Pipeline runs steps 5-9 with old snapshot. Logged as `action = 'rollback'`.

**Unpublish:** Sets `is_active = false` on all snapshots, sets `visibility = 'offline'`, invalidates cache. Logged as `action = 'unpublish'`.

---

## 9. Template System (Hybrid)

### Architecture

- **In code:** Template manifest — allowed pages, default sections per page, default theme tokens, section defaults
- **In DB:** `template_key` + `template_version` on `websites.website` and `websites.website_draft_revision`
- **Not in DB for MVP:** No template admin CMS table

### Example Manifest

```typescript
const restaurantClassic: WebsiteTemplate = {
  key: "restaurant-classic",
  version: 1,
  name: "Restaurant Classic",
  industry: "restaurant",
  defaultPages: [
    { type: "home", slug: "", sections: ["hero", "feature_grid", "testimonials", "cta"] },
    { type: "menu", slug: "menu", sections: ["menu_full"] },
    { type: "about", slug: "about", sections: ["text_image", "gallery"] },
    { type: "contact", slug: "contact", sections: ["hours", "map", "contact"] },
  ],
  defaultTheme: {
    /* presentation tokens */
  },
  sectionDefaults: {
    /* default content per section type */
  },
};
```

### MVP Templates

2-3 industry-specific: restaurant, cafe/bar, hotel. Each defines page structure, section composition, and theme.

### Application Flow

Admin picks template during setup. System creates pages + sections with defaults, sets `template_key` + `template_version`, saves `website_draft_revision` with source=`template_apply`. Admin customizes from there.

---

## 10. Section/Component Registry

```typescript
interface SectionDefinition<T = unknown> {
  type: string;
  name: string;
  description: string;
  schema: ZodSchema<T>;
  defaults: T;
  settingsSchema: ZodSchema<SectionSettings>;
  editorComponent: ComponentType<EditorProps<T>>;
  publicComponent: ComponentType<RenderProps<T>>;
  previewComponent?: ComponentType<RenderProps<T>>;
  allowedPageTypes?: string[];
  maxPerPage?: number;
}

const SECTION_REGISTRY = new Map<string, SectionDefinition>();

export function registerSection<T>(def: SectionDefinition<T>) {
  SECTION_REGISTRY.set(def.type, def);
}

export function getSectionDef(type: string): SectionDefinition | undefined {
  return SECTION_REGISTRY.get(type);
}
```

Each section type is self-contained: schema + editor + renderer + defaults. Adding a section = one file, one registration call. Unknown types gracefully skipped in renderer.

---

## 11. Assets & Media

### Storage

Bucket: `website-assets` (public read, admin write).

Structure: `website-assets/{workspace_id}/{asset_uuid}.{ext}`

### Upload Flow

1. Client-side validation (type whitelist, 5MB images, 20MB PDFs)
2. Server action creates `websites.website_asset` row, returns signed upload URL
3. Client uploads directly to Supabase Storage
4. Server verifies file, extracts dimensions, updates record
5. Asset UUID referenced in section content JSONB

### Image Optimization

Next.js `<Image>` with Vercel image optimization. Source = Supabase Storage public URL. Automatic WebP/AVIF, responsive sizing, lazy loading.

### Orphan Handling

Nightly cron compares asset rows against references in active snapshots + current draft. Assets unreferenced >30 days flagged for manual cleanup. No auto-deletion.

### Draft Asset Visibility

The `website-assets` bucket is public-read. This means assets uploaded during editing are publicly accessible before publishing. This is an accepted tradeoff: assets are images/PDFs with no inherent sensitivity, and the alternative (private bucket + signed URLs or copy-on-publish) adds significant complexity. If asset privacy becomes a concern in Phase 2+, assets can be moved to a private bucket with a CDN serving layer.

### Snapshot Asset References

Sections reference assets by UUID. Snapshot `assets.byId` maps UUID to `{ storagePath, alt, width, height, mimeType }`. The `storageBaseUrl` field provides the URL prefix. Public URLs are assembled at render time: `${storageBaseUrl}/${storagePath}`. This makes snapshots resilient to storage URL changes.

---

## 12. Security & Threat Model

| Threat                    | Risk   | Mitigation                                                                                                                                               |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant data leakage | High   | RLS on all `websites.*` tables. `workspace_id` FK + CHECK trigger. Snapshot RPC returns only active published data for resolved host.                    |
| Domain hijacking          | Medium | DNS TXT verification with `verification_token`. Domain must be verified before `status = 'active'`. Platform subdomains auto-verified. Phase 2.          |
| XSS from user content     | High   | No `custom_html`. All content validated via Zod schemas. React auto-escapes. No `dangerouslySetInnerHTML`. Rich text = constrained markdown subset only. |
| Asset abuse               | Medium | Upload size limits. MIME type validation server-side. Workspace-scoped paths. Orphan cleanup cron. Rate limiting.                                        |
| Preview URL leakage       | Low    | Cryptographically random tokens (32 bytes). 24h expiry. Revocable. `noindex` header on preview pages.                                                    |
| Service role blast radius | Medium | Isolated in `site-public-repository.ts`. Two functions only. Reads via narrow SQL RPC.                                                                   |
| Snapshot data exposure    | Low    | Snapshots contain only intentionally public data. No workspace internals, no PII, no auth tokens.                                                        |
| Rate limiting             | Medium | Public pages ISR-cached. No anonymous write surface in MVP. Vercel DDoS protection at edge.                                                              |
| Subdomain enumeration     | Low    | Workspace names are business names (already public). 404 for non-existent sites.                                                                         |

### Hard Rules

- No `dangerouslySetInnerHTML` in any public renderer
- No raw SQL from user input
- No service role outside `site-public-repository.ts`
- No secrets in snapshot data
- No `custom_html` section type

---

## 13. Migration into Existing SmartOut

### Bounded Context

Clean module addition. No refactoring of existing code.

### Reuses

- Auth system (Supabase Auth, sessions)
- Workspace/profile model (FK to `public.workspace`)
- RLS helpers (`public.get_workspace_ids_for_user()`, `public.is_admin_in_workspace()`)
- Middleware pattern (extended, not replaced)
- Dashboard shell + navigation
- Telemetry system (`emit()`)
- Supabase Storage (new bucket)

### Does NOT Touch

- Existing `landing_*` tables
- Existing routes
- Existing `public.*` schema
- Existing Edge Functions

### Integration Points

1. **Middleware** — extend `extractSubdomain()` with new `public-site` variant for `*.smartout.info` / `*.public.localhost`. Must run before existing `.smartout.ai` logic. Audit all `SubdomainResult` consumers for exhaustive-switch.
2. **Dashboard nav** — "Website" sidebar item. Feature-flagged.
3. **Workspace intelligence** — read `intelligence_data` for content generation. Read-only.
4. **Telemetry** — register `website.*` events in registry.

### Feature Flag

`has_website` boolean on workspace (or feature JSONB). Builder hidden until enabled. Public rendering returns 404 for disabled workspaces.

### Migration Order

1. Create `websites` schema + tables (zero impact)
2. Add middleware extension (additive)
3. Add builder routes (new pages)
4. Add public-site route group (new, isolated)
5. Add sidebar item (feature-flagged)
6. Enable for test workspaces

---

## 14. Rollout Plan

### MVP (Phase 1)

- `websites` schema: 12 tables, RPC functions, constraints, triggers
- Builder: setup wizard, page manager, section editor, theme picker, domain settings, publish
- Templates: 2 industry templates (restaurant, cafe/bar)
- Sections: 16 MVP types
- Menu: structured + PDF fallback
- Public rendering: ISR from snapshots via `*.smartout.info`
- Publishing: validate, snapshot, activate, revalidate
- Preview: token-based draft preview
- AI: content generation from workspace intelligence
- Domain: platform subdomain only

### Phase 2

- Custom domains with DNS verification + Vercel domain API
- Contact form with Turnstile captcha + email notification
- More templates (hotel, catering, bar)
- More sections: `instagram_feed`, `events`, `team`
- Draft comparison (diff revisions)
- Basic page view analytics
- Multi-language site content
- Menu AI: PDF to structured extraction

### Phase 3

- Multi-site per workspace
- Blog/news section
- Campaign pages (time-limited, schedulable)
- A/B testing on public site
- Module 19 integration (live menu from production)
- White-label (remove SmartOut branding)
- API scope: `websites:read`
- SEO audit tool in builder

---

## 15. Testing Strategy

| Layer             | What                                                                      | Tool                          | Priority |
| ----------------- | ------------------------------------------------------------------------- | ----------------------------- | -------- |
| Unit              | Section Zod schemas, snapshot assembly, template validation               | Vitest                        | P0       |
| Unit              | `site-public-repository.ts`, domain resolution                            | Vitest                        | P0       |
| Integration       | RLS policies: workspace isolation, admin-only writes, cross-tenant blocks | pgTAP / Supabase test helpers | P0       |
| Integration       | Publish pipeline end-to-end                                               | Vitest + Supabase local       | P0       |
| E2E               | Builder: create site, edit sections, publish, verify public page          | Playwright                    | P1       |
| E2E               | Public site: visit slug.smartout.info, verify pages, navigation, SEO      | Playwright                    | P1       |
| E2E               | Preview: generate token, visit preview URL, verify draft content          | Playwright                    | P1       |
| Visual regression | Section renderers with fixture data                                       | Playwright screenshots        | P2       |
| Domain routing    | Middleware rewrites for .smartout.info, unknown hosts                     | Vitest                        | P1       |
| Load              | ISR cache behavior under concurrent requests                              | k6                            | P2       |

---

## 16. Observability

### Telemetry Events

| Event                       | Trigger                     | Destinations                          |
| --------------------------- | --------------------------- | ------------------------------------- |
| `website.created`           | First-time setup complete   | PostHog, activity_trail               |
| `website.published`         | Publish succeeds            | PostHog, activity_trail, engine_event |
| `website.unpublished`       | Site taken offline          | PostHog, activity_trail               |
| `website.rollback`          | Previous snapshot activated | PostHog, activity_trail               |
| `website.domain_verified`   | Custom domain DNS passes    | activity_trail                        |
| `website.domain_failed`     | Custom domain DNS fails     | activity_trail, Logger                |
| `website.preview_created`   | Preview token generated     | activity_trail                        |
| `website.content_generated` | AI content generation done  | PostHog, activity_trail               |

### Error Tracking

Sentry for builder and public renderer. Public site errors tagged `site:${host}`.

### Performance

Vercel Analytics on public sites. ISR cache hit rate, TTFB per host, revalidation frequency.

### Domain Diagnostics

Daily Edge Function cron checks active custom domains (DNS + SSL). Updates status and logs events on failure.

---

## 17. Folder Structure

```
apps/web/src/
  app/
    dashboard/website/              --> Builder UI (authenticated)
      page.tsx                      --> Overview
      setup/page.tsx                --> First-time wizard
      pages/page.tsx                --> Page manager
      pages/[pageId]/page.tsx       --> Section editor
      menus/page.tsx                --> Menu manager
      menus/[menuId]/page.tsx       --> Menu editor
      theme/page.tsx                --> Theme editor
      settings/page.tsx             --> Domain, SEO, booking, social, contact
      preview/page.tsx              --> Draft preview shell
      history/page.tsx              --> Revisions + publish log
      _components/                  --> Builder-specific components
      _data/                        --> TanStack queries + mutations
      _actions/                     --> Server actions (publish, save, generate)
    public-site/[host]/             --> Public rendering (anonymous)
      page.tsx                      --> Home page
      [...path]/page.tsx            --> Dynamic page routing
      sitemap.xml/route.ts          --> Dynamic sitemap
      robots.txt/route.ts           --> Dynamic robots
      layout.tsx                    --> Public site shell
      _components/                  --> Public section renderers
      _data/                        --> site-public-repository.ts

packages/website/                   --> Shared website factory package
  src/
    sections/
      registry.ts                   --> Section registry
      schemas/                      --> Zod schemas per section type
      defaults/                     --> Default content per section type
    templates/
      registry.ts                   --> Template registry
      restaurant-classic.ts
      cafe-modern.ts
    types/
      index.ts                      --> All website TypeScript types
      snapshot.ts                   --> Render contract types
      section.ts                    --> Section content types
      theme.ts                      --> Theme token types
    validation/
      snapshot.ts                   --> Snapshot assembly + validation
      section.ts                    --> Section content validation
    constants.ts                    --> Section type allowlist, limits

supabase/migrations/
  YYYYMMDDHHMMSS_create_websites_schema.sql
  YYYYMMDDHHMMSS_websites_rls_policies.sql
  YYYYMMDDHHMMSS_websites_constraints.sql
  YYYYMMDDHHMMSS_websites_rpc_functions.sql
  YYYYMMDDHHMMSS_website_assets_storage.sql
```

---

## 18. MVP Ticket Breakdown

| #   | Ticket                                               | Depends    | Scope                                                                                                                                                                                                          |
| --- | ---------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Create `websites` schema + all tables + feature flag | --         | Migration: schema, 12 tables, CHECK constraints, FKs, indexes, workspace_id consistency triggers. Also: `ALTER TABLE public.workspace ADD COLUMN has_website boolean NOT NULL DEFAULT false` for feature flag. |
| 2   | RLS policies + RPC functions                         | 1          | Migration: all RLS policies, `get_active_site_snapshot_by_host()`, `get_preview_site_by_token()`, storage bucket + policies                                                                                    |
| 3   | `packages/website` shared package                    | --         | Section registry, Zod schemas (16 types), template manifests (2), TypeScript types, snapshot validation, constants                                                                                             |
| 4   | `site-public-repository.ts`                          | 2          | Server-side data access. Two functions. Service role isolated here only.                                                                                                                                       |
| 5   | Middleware extension for `*.smartout.info`           | --         | Extend `extractSubdomain()` with `public-site` variant. Add `.smartout.info` + `.public.localhost` detection before `.smartout.ai` logic. Audit all `SubdomainResult` consumers. Unit tests.                   |
| 6   | Public site route group + renderers                  | 3, 4, 5    | `/public-site/[host]/` layout, page routing, 16 public section renderers, ISR, `generateMetadata()`, sitemap, robots                                                                                           |
| 7   | Builder: setup wizard                                | 1, 3       | Template picker, brand bootstrap from intelligence, AI content generation, website + pages + sections from template                                                                                            |
| 8   | Builder: page manager + section editor               | 1, 3       | Page CRUD, reorder. Section add/remove/reorder, content editing with Zod forms.                                                                                                                                |
| 9   | Builder: menu editor                                 | 1, 3       | Menu CRUD, categories, items. PDF upload.                                                                                                                                                                      |
| 10  | Builder: theme editor                                | 1, 2, 3    | Color picker, font picker, spacing/radius tokens. Live preview.                                                                                                                                                |
| 11  | Builder: settings                                    | 1, 2       | Domain config, SEO defaults, booking provider, social links, contact info.                                                                                                                                     |
| 12  | Publish pipeline                                     | 1, 2, 3, 4 | Server action: validate, revision, snapshot, activate, revalidate, telemetry. Rollback + unpublish.                                                                                                            |
| 13  | Preview system                                       | 4, 6       | Token generation, preview session CRUD, preview rendering.                                                                                                                                                     |
| 14  | Builder: history + revisions                         | 1, 12      | List publish events + draft revisions. Restore from revision.                                                                                                                                                  |
| 15  | AI content generator                                 | 3, 7       | Generator in `packages/ai/src/generators/`. Intelligence to section content.                                                                                                                                   |
| 16  | Dashboard navigation + feature flag                  | 1, 7       | Sidebar "Website" item. Feature flag gating via `workspace.has_website`.                                                                                                                                       |
| 17  | Telemetry registration                               | 12         | Register `website.*` events in telemetry registry.                                                                                                                                                             |
| 18  | E2E tests                                            | 6, 8, 12   | Playwright: create site, edit, publish, verify public page, preview.                                                                                                                                           |

**Critical path:** Tickets 1 and 3 are parallel. After those: track A (2 -> 4 -> 6 = public rendering) and track B (7 -> 8 -> 9 = builder). Both tracks converge at ticket 12 (publish pipeline).

---

## 19. Decisions Locked Before Coding

| Decision                   | Answer                                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| Public domain              | `*.smartout.info`                                                        |
| Database schema            | `websites.*` dedicated Postgres schema                                   |
| Public reads               | Server-side only via narrow RPC functions                                |
| Service role               | Isolated in `site-public-repository.ts` only                             |
| Section types              | Text registry key with CHECK constraint, not enum                        |
| Templates                  | Hybrid: code manifests + DB identity                                     |
| Snapshots                  | Immutable render contracts with `schemaVersion`                          |
| Contact form               | Out of MVP                                                               |
| Custom domains             | Out of MVP (schema ready)                                                |
| Sites per workspace        | One (UNIQUE constraint, droppable later)                                 |
| Rich text                  | Constrained markdown subset, no raw HTML                                 |
| Section settings           | Design tokens only, no arbitrary CSS                                     |
| `custom_html`              | Banned from MVP                                                          |
| `workspace_id` consistency | FK + CHECK trigger on all child tables                                   |
| Visibility status          | `draft` / `live` / `offline` with clear semantics                        |
| Asset references           | By UUID in content, `assets.byId` in snapshot                            |
| Draft revisions            | Site-level with `schema_version` and `template_key`                      |
| Preview                    | Token-based, always pinned to a revision                                 |
| Domain model               | `platform_subdomain` + `custom` types, `is_primary`, `redirect_behavior` |
| Middleware                 | Hostname detection + rewrite only. Nothing else.                         |
| `site_slug`                | Dedicated column, decoupled from workspace slug                          |
| Snapshot hash              | SHA-256 of snapshot JSON, skip duplicate publishes                       |
| Soft delete                | `deleted_at` on all data tables, no hard deletes                         |
| Publish locking            | `SELECT ... FOR UPDATE` on website row before publish                    |
| Snapshot/content limits    | 2 MB max snapshot, 20 pages, 30 sections/page, 500 assets                |
| Middleware order           | `.smartout.info` before `.smartout.ai` — strict                          |

---

## 20. Open Questions / Assumptions

| Item                                             | Assumption                                     | Risk if wrong                                         |
| ------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| Vercel wildcard domain for `*.smartout.info`     | Supported on current plan                      | Need to verify before ticket 5                        |
| ISR revalidation across all hosts                | `revalidateTag` works for dynamic hosts        | May need per-host revalidation strategy               |
| Supabase Storage public bucket for assets        | Acceptable for public site images              | Could add CDN layer in Phase 2                        |
| One Vercel project serves both `.ai` and `.info` | Middleware can distinguish and route correctly | May need separate Vercel project if routing conflicts |
| Menu schema compatible with future Module 19     | Allergens, dietary tags, price model align     | May need migration when Module 19 builds              |
| AI content generation quality                    | Workspace intelligence provides enough signal  | May need manual content fallback UX                   |

---

## 21. Invariants

These rules must never be violated. They define the architectural contract.

1. Every website belongs to exactly one workspace
2. Every live website has exactly one active snapshot
3. Public rendering only uses snapshot data — never draft tables
4. Draft tables are never read by public routes
5. Section content must validate against registry schema before save AND before publish
6. Middleware only performs hostname routing — no DB lookups, no auth, no content
7. Service role is only used in `site-public-repository.ts`
8. Snapshot `buildMeta.schemaVersion` must be incremented on any contract shape change
9. Assets are referenced by UUID only — never by raw storage path in content
10. Preview tokens must always point to a pinned revision
11. One `platform_subdomain` domain per site
12. Exactly one `is_primary = true` domain per site
13. Publish pipeline must run in a transaction with row lock
14. No renderer may use `dangerouslySetInnerHTML`
15. Navigation order is driven by `website_page.sort_order` — never by creation order
16. `site_slug` is the public identity — never derive public URLs from workspace slug
17. Snapshot hash must be checked before creating duplicate versions
18. All deletions are soft deletes (`deleted_at`) — no hard deletes on data tables
19. All queries on data tables must filter `WHERE deleted_at IS NULL` unless explicitly recovering

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                       | Author          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-03-21 | Initial spec — approved architecture                                                                                                                                                                                                                                                                                                                                                                                         | Claude + Pontus |
| 2026-03-21 | Spec review fixes: middleware integration detail, updated_at on all tables, preview always pinned to revision, admin-only RLS reads, asset URL resilience, search_path on SECURITY DEFINER, CHECK vs enum rationale, domain status lifecycle, ticket dependency fixes, local dev story, draft asset visibility note, booking deduplication in snapshot, website_id on deeply nested menu tables, version increment mechanism | Claude          |
| 2026-03-22 | Final technical review: added site_slug (decoupled from workspace), snapshot_hash (duplicate detection), soft delete on all data tables, publish row locking (step 0), snapshot size limits, middleware routing order, invariants section (19 rules), navigation sort_order unique constraint                                                                                                                                | Claude + Pontus |
