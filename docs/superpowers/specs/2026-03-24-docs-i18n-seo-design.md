---
title: "Docs + i18n + SEO — Landing Site Overhaul"
status: draft
updated: 2026-03-24
created: 2026-03-24
module: landing
tags: [docs, i18n, seo, landing, design-tokens]
---

# Docs + i18n + SEO — Landing Site Overhaul

## Problem Statement

The SmartOut landing site (`apps/landing/`) has three critical gaps:

1. **Docs sidebar is empty on production** — `user-manual.ts` reads markdown files via `fs.readdirSync` from `docs/User Manual/`, but these files are outside the `apps/landing/` directory and not included in Vercel's output file tracing. Result: `resolveManualDirectory()` returns `null`, sidebar renders empty, all `/docs/[slug]` pages 404.

2. **No internationalization** — All landing page text is hardcoded Norwegian. The `packages/i18n` package defines 8 supported locales but the landing app doesn't use it. No locale routing exists.

3. **No SEO infrastructure** — No `sitemap.xml`, no `robots.txt`, no `hreflang` tags, `<html lang="no">` is hardcoded. Zero discoverability for search engines.

## Scope

- **Languages:** Norwegian (nb, default) + English (en)
- **Landing variant:** Variant M (Kommunikasjon) only — archive all other variants
- **Design tokens:** Enforce as single source of truth for all styling
- **Target:** `smartout.ai` (landing) and `smartout.ai/docs` (documentation)

## Decisions

### D0: Key Design Choices (from brainstorming)

These decisions were made during brainstorming and inform the rest of the spec:

1. **Languages:** nb + en only. Infrastructure supports more later.
2. **URL structure:** Norwegian default (no prefix), English at `/en/`.
3. **Translation method:** JSON keys via `packages/i18n`. Static imports (both locales bundled) — avoids client/server boundary issues since `VariantMLanding.tsx` is `"use client"`.
4. **Variant M only:** Archive other 8 variants, don't delete.
5. **Docs pipeline:** Remove 10 hardcoded docs pages. All docs through markdown `[slug]` route. Upgrade `MarkdownRenderer` with rich components (callouts, step lists, feature cards).
6. **Purple token:** Add `brand.purple` to design-tokens instead of replacing with orange.

### D1: URL Structure

Norwegian is the default locale with no prefix. English gets `/en/` prefix.

| Locale | Landing           | Docs                                 | Pricing                  |
| ------ | ----------------- | ------------------------------------ | ------------------------ |
| nb     | `smartout.ai/`    | `smartout.ai/docs/vaktplan`          | `smartout.ai/pricing`    |
| en     | `smartout.ai/en/` | `smartout.ai/en/docs/shift-planning` | `smartout.ai/en/pricing` |

**Why:** Preserves all existing Norwegian URLs (no redirects, no SEO loss). Standard pattern for Nordic SaaS.

### D2: Docs Content Pipeline Fix

Replace runtime filesystem reads with build-time static content.

**Current (broken):**

```
docs/User Manual/*.md → fs.readdirSync at runtime → empty on Vercel
```

**New:**

```
docs/User Manual/*.md → outputFileTracingIncludes in next.config.ts → files bundled → works on Vercel
```

Add to `next.config.ts`:

```typescript
outputFileTracingIncludes: {
  '/docs': ['../../docs/User Manual/**/*.md'],
  '/docs/[slug]': ['../../docs/User Manual/**/*.md'],
},
```

**Why not move files into `apps/landing/`?** The docs pipeline (`packages/docs-pipeline`) and other consumers also read from `docs/User Manual/`. Single source of truth > duplication.

### D3: Docs i18n Content Structure

```
docs/User Manual/
  nb/                          # Norwegian (source of truth)
    00-smartout-overview.md
    01-kom-i-gang.md
    ...
  en/                          # English translations
    00-smartout-overview.md
    01-getting-started.md
    ...
  INDEX.md                     # Content registry
```

Current files in `docs/User Manual/` root are Norwegian — they move into `nb/` subfolder.

The `user-manual.ts` reader gains a `locale` parameter, wrapped in `React.cache()` to memoize per request (avoids redundant fs reads across layout, page, sitemap, and generateMetadata):

```typescript
import { cache } from "react";

export const getUserManualDocs = cache((locale: "nb" | "en"): UserManualDoc[] => {
  const manualDir = resolveManualDirectory(locale);
  if (!manualDir) return [];
  // ... fs reads
});
```

### D4: Landing Page — Variant M Only

**Keep:** `VariantMLanding.tsx` as the sole landing page component.

**Archive:** Move these to `apps/landing/src/components/landing/_archived/`:

- VariantALanding.tsx
- VariantELanding.tsx
- VariantFLanding.tsx
- VariantILanding.tsx
- VariantKLanding.tsx
- VariantSLanding.tsx
- VariantTLanding.tsx
- VariantVLanding.tsx

**Remove from routing:** Clean up middleware legacy variant redirects (E, T, K, A, F, S, V, I mappings) and any route files that reference archived variants.

**Clean up `app/page.tsx`:** Remove all `next/dynamic` imports for variant components. The root `page.tsx` becomes a clean server component that renders `<VariantMLanding locale="nb" />` directly. The `app/[slug]/page.tsx` catch-all must also be updated to remove all variant imports — otherwise the build breaks.

**Why archive instead of delete?** Pontus wants to reuse them for demos/showcases later.

### D5: Translation System

Use `packages/i18n` with JSON translation files. All hardcoded text extracted to keys.

**File structure:**

```
packages/i18n/locales/
  nb/
    common.json          # Shared UI (nav, footer, CTA buttons)
    landing.json         # Variant M landing page text
    docs.json            # Docs UI chrome (sidebar, search, breadcrumbs)
    pricing.json         # Pricing page
    features.json        # Feature pages
  en/
    common.json
    landing.json
    docs.json
    pricing.json
    features.json
```

**Translation helper** — static imports, client-safe:

```typescript
// packages/i18n/src/translate.ts
import type { SupportedLocale } from "./config";

// Static imports — both locales bundled. ~5-10KB per namespace.
// This avoids dynamic require() which fails in client components.
const localeModules: Record<string, Record<string, Record<string, string>>> = {
  nb: {
    common: require("../locales/nb/common.json"),
    landing: require("../locales/nb/landing.json"),
    docs: require("../locales/nb/docs.json"),
  },
  en: {
    common: require("../locales/en/common.json"),
    landing: require("../locales/en/landing.json"),
    docs: require("../locales/en/docs.json"),
  },
};

export function createTranslator(locale: SupportedLocale, namespace: string) {
  const messages = localeModules[locale]?.[namespace] ?? {};
  return function t(key: string): string {
    return messages[key] ?? key;
  };
}
```

**Why static imports?** `VariantMLanding.tsx` is `"use client"`. Dynamic `require()` with template literals fails in browser context and is unreliable with turbopack. Static imports work in both client and server components. Bundle cost is negligible (~5-10KB per language per namespace).

**Why not next-intl or similar?** The landing page is mostly static. A simple key-lookup function avoids bundle bloat and complexity. If the dashboard needs i18n later, we can adopt next-intl there without affecting the landing app.

### D6: Locale Routing via Next.js Middleware

Extend existing `middleware.ts` to detect and route locale:

1. Check URL path for `/en/` prefix
2. If present: set `x-locale: en` header, rewrite to remove prefix
3. If absent: set `x-locale: nb` header

**Client/server boundary:** `headers()` is only available in server components. Since `VariantMLanding.tsx` is `"use client"` (framer-motion), the pattern is:

```
app/page.tsx (server)          → reads headers(), resolves locale
  └─ <VariantMLanding locale={locale} />  → receives locale as prop
       └─ const t = createTranslator(locale, 'landing')
```

Server components (`page.tsx`, `layout.tsx`) read `x-locale` from `headers()` and pass `locale` as a prop to client components. Client components never call `headers()` directly.

**App Router structure:**

```
app/
  page.tsx                    # Server component: reads locale, renders <VariantMLanding locale="nb" />
  en/
    page.tsx                  # Server component: renders <VariantMLanding locale="en" />
  docs/
    page.tsx                  # nb docs index
    [slug]/page.tsx           # nb docs pages
  en/
    docs/
      page.tsx                # en docs index
      [slug]/page.tsx         # en docs pages
  pricing/page.tsx            # nb pricing
  en/pricing/page.tsx         # en pricing
  ...
```

**Alternative considered:** `[locale]` dynamic segment. Rejected because it changes ALL existing URLs and requires redirects.

### D7: SEO Infrastructure

#### sitemap.xml

Dynamic via `app/sitemap.ts`:

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const nbDocs = getUserManualDocs("nb");
  const enDocs = getUserManualDocs("en");

  return [
    // Landing pages
    {
      url: "https://smartout.ai/",
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: { languages: { nb: "https://smartout.ai/", en: "https://smartout.ai/en/" } },
    },
    // Docs pages
    ...nbDocs.map((doc) => ({
      url: `https://smartout.ai/docs/${doc.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: {
        languages: {
          nb: `https://smartout.ai/docs/${doc.slug}`,
          en: `https://smartout.ai/en/docs/${doc.enSlug}`,
        },
      },
    })),
    // ... pricing, features, etc.
  ];
}
```

#### robots.txt

Via `app/robots.ts`:

```typescript
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/v/"] },
    sitemap: "https://smartout.ai/sitemap.xml",
  };
}
```

#### metadataBase

Set in root `layout.tsx` so all `generateMetadata` calls can use relative URLs:

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://smartout.ai"),
};
```

This means `generateMetadata` in page files uses relative paths:

```typescript
export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: {
      canonical: "/",
      languages: {
        nb: "/",
        en: "/en/",
      },
    },
  };
}
```

Next.js resolves these to absolute URLs automatically. The `sitemap.ts` still needs absolute URLs (Next.js requirement).

#### hreflang

Every page's `generateMetadata` includes alternates (see pattern above). Root layout metadata also changes from hardcoded Norwegian to locale-aware:

```typescript
// Root layout — title/description become locale-aware via generateMetadata
// instead of the static metadata export
export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocaleFromHeaders(); // 'nb' | 'en'
  const t = createTranslator(locale, "common");
  return {
    metadataBase: new URL("https://smartout.ai"),
    title: t("site.title"),
    description: t("site.description"),
  };
}
```

#### html lang

Root layout reads locale from header and sets `<html lang={locale}>`.

### D8: Design Token Enforcement

**Audit scope:** `VariantMLanding.tsx`, `MarkdownRenderer`, all shared components (Navigation, Footer, docs-sidebar, docs-article), and all docs components.

**Rules:**

1. No hardcoded color values (hex, rgb, oklch, zinc-_, white, orange-_) in component files
2. All colors via CSS variables: `bg-background`, `text-foreground`, `text-brand-orange`, etc.
3. Any new color needs go through `packages/design-tokens/src/tokens.ts` first
4. Token changes propagate automatically via `tokens.css` (web) and `native.ts` (mobile)

**New token — brand purple:**

```typescript
// packages/design-tokens/src/tokens.ts
export const brand = {
  orange: "oklch(0.65 0.22 40)",
  orangeLight: "oklch(0.75 0.18 40)",
  orangeDark: "oklch(0.55 0.22 40)",
  purple: "oklch(0.55 0.25 300)", // Secondary accent
  purpleLight: "oklch(0.65 0.20 300)",
  purpleDark: "oklch(0.45 0.25 300)",
} as const;
```

Exposed as CSS variables: `--brand-purple`, `--brand-purple-light`, `--brand-purple-dark`. Used in Tailwind as `text-brand-purple`, `bg-brand-purple/10`, etc.

**Deliverable:** After audit, document any new tokens added in the tokens file with comments explaining their purpose.

### D10: Docs Consolidation — Remove Hardcoded Pages

**Delete** the 10 hardcoded docs route directories:

```
apps/landing/src/app/docs/vaktplan/
apps/landing/src/app/docs/onboarding/
apps/landing/src/app/docs/kom-i-gang/
apps/landing/src/app/docs/ansatte/
apps/landing/src/app/docs/oppgaver-rutiner/
apps/landing/src/app/docs/haccp/
apps/landing/src/app/docs/kommunikasjon/
apps/landing/src/app/docs/ai-assistent/
apps/landing/src/app/docs/rapporter/
apps/landing/src/app/docs/innstillinger/
```

All docs served exclusively through the `[slug]/page.tsx` dynamic route + markdown files.

**Also delete** `docs-article.tsx` (Heading, SubHeading, Paragraph, InfoBox, FeatureCard, Step, StepList) — these are replaced by the upgraded MarkdownRenderer.

**Why delete instead of archive?** The content lives in markdown files. The React component wrappers have no reuse value — the MarkdownRenderer replaces their function entirely.

### D11: MarkdownRenderer Upgrade

Upgrade `markdown-renderer.tsx` to support rich documentation features that the hardcoded pages had, using standard markdown conventions:

**Callout boxes** (replaces `InfoBox`):

```markdown
> [!TIP] Optional title
> Content here

> [!WARNING] Viktig
> Content here

> [!INFO]
> Content here
```

Implemented via remark plugin that detects GitHub-style alerts (`[!TIP]`, `[!WARNING]`, `[!INFO]`). Rendered with design-token colors:

- TIP: `semantic.success` background/border
- WARNING: `semantic.warning` background/border
- INFO: `semantic.info` background/border

**Step lists** (replaces `Step`/`StepList`):
Ordered lists where items start with bold text are rendered as step cards:

```markdown
1. **Opprett vaktplan** — Velg avdeling og periode...
2. **Legg til vakter** — Dra og slipp ansatte...
```

**Feature highlights** (replaces `FeatureCard`):
Definition lists or bold-first paragraphs in a specific section get card treatment:

```markdown
### Funksjoner

- **Sanntidsoversikt** — Se bemanningen live per avdeling
- **Drag & drop** — Flytt vakter mellom ansatte med ett klikk
```

**All styling via design tokens.** Zero hardcoded colors. The MarkdownRenderer uses only CSS variable classes.

### D12: Middleware Matcher Expansion

Current matcher: `"/"` (root only).

New matcher:

```typescript
export const config = {
  matcher: [
    // Match all paths except static files and API routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
```

This ensures locale detection runs on all pages, not just root. The existing free-forever hostname rewrite and legacy variant redirects continue to work (they check pathname/hostname before locale logic runs).

The legacy variant redirects (`?v=E`, `?v=T`, etc.) can be removed since we're archiving all variants except M. Add a catch-all redirect: any `?v=` parameter → root page.

### D9: Docs Slug Mapping (nb <-> en)

Each User Manual file has YAML frontmatter. Add an optional `slug` field per locale:

```yaml
---
title: "Vaktplan"
slug: vaktplan
slug_en: shift-planning
---
```

The `user-manual.ts` reader uses `slug_en` when serving English docs, falling back to the Norwegian slug if not specified. This enables human-readable English URLs while keeping the Norwegian originals.

**Internal link handling:** Markdown files may contain relative links (e.g., `[Se vaktplan](./03-vaktplan.md)`). The English markdown files must use their own correct relative links. The MarkdownRenderer's `a` component also transforms internal `/docs/` links to include the `/en/` prefix when rendering in English locale. This is done by passing `locale` to MarkdownRenderer and having the link component check:

```typescript
// Inside MarkdownRenderer components
a: ({ href, children }) => {
  let resolvedHref = href;
  if (locale === 'en' && href?.startsWith('/docs/')) {
    resolvedHref = `/en${href}`;
  }
  return <a href={resolvedHref}>{children}</a>;
},
```

## Architecture Summary

```
                    middleware.ts
                    (locale detection)
                         |
              +----------+----------+
              |                     |
         nb (default)          en (/en/)
              |                     |
    +----+----+----+      +----+----+----+
    |    |    |    |      |    |    |    |
   page docs pricing    page docs pricing
              |                     |
         user-manual.ts        user-manual.ts
         (locale='nb')         (locale='en')
              |                     |
         docs/User Manual/nb/  docs/User Manual/en/
```

**Translation flow:**

```
Component → t('hero.title') → packages/i18n/locales/{nb,en}/landing.json → rendered text
```

**Design token flow:**

```
tokens.ts → tokens.css (Tailwind variables) → Component classes (bg-background, text-brand-orange)
```

## Out of Scope

- Additional languages beyond nb + en (future batch)
- Dashboard i18n (separate project, uses `packages/i18n` when ready)
- Mobile app i18n (separate project)
- Docs AI agent translation (agent already responds in user's language)
- Landing page builder / variant system from DB (`get-variant.ts`) — Variant M is now hardcoded
- Blog i18n (low priority, can follow same pattern later)
- Swedish docs in `docs/User Manual/sv/` — existing files stay, not served until sv locale is enabled

## Success Criteria

1. `smartout.ai/docs` shows all 11 docs in sidebar with professional rendering (not empty)
2. `smartout.ai/en/docs` shows English translations of all 11 docs
3. `smartout.ai/` renders Variant M with Norwegian text from i18n JSON keys
4. `smartout.ai/en/` renders Variant M with English text from i18n JSON keys
5. `smartout.ai/sitemap.xml` includes all pages in both languages with hreflang alternates
6. `smartout.ai/robots.txt` exists and is valid
7. `<html lang="">` dynamically set to `nb` or `en` based on route
8. Zero hardcoded color values in any landing/docs component — all via design tokens
9. `brand.purple` token exists and replaces all `purple-500` instances
10. No hardcoded docs pages — all 10 removed, all content through markdown `[slug]` route
11. MarkdownRenderer supports callouts (`[!TIP]`, `[!WARNING]`, `[!INFO]`), step lists, and feature cards
12. Lighthouse SEO score > 95 on both `/` and `/en/`
13. `apps/landing/src/app/[slug]/page.tsx` updated — no imports of archived variants
