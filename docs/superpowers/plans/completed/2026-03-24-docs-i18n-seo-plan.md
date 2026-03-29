# Docs + i18n + SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix empty docs sidebar on Vercel, add nb+en i18n to landing+docs, add SEO infrastructure, enforce design tokens.

**Architecture:** Norwegian (nb) is default (no prefix), English gets `/en/` prefix. All text via JSON translation keys in `packages/i18n`. All docs through markdown `[slug]` route with upgraded MarkdownRenderer. Design tokens are the single source of truth for all colors.

**Tech Stack:** Next.js 16 App Router, `packages/i18n`, `react-markdown` + `remark-gfm` + `remark-github-blockquote-alert`, `packages/design-tokens`

**Spec:** `docs/superpowers/specs/2026-03-24-docs-i18n-seo-design.md`

---

## Phase 1: Foundation

### Task 1: Add brand.purple design token

**Files:**

- Modify: `packages/design-tokens/src/tokens.ts`
- Modify: `packages/design-tokens/src/tokens.css`
- Modify: `apps/landing/src/app/globals.css` (if it imports tokens.css or defines brand vars)

- [ ] **Step 1: Add purple to tokens.ts brand object**

In `packages/design-tokens/src/tokens.ts`, add to the `brand` export:

```typescript
export const brand = {
  orange: "oklch(0.65 0.22 40)",
  orangeLight: "oklch(0.75 0.18 40)",
  orangeDark: "oklch(0.55 0.22 40)",
  purple: "oklch(0.55 0.25 300)", // Secondary accent for feature sections
  purpleLight: "oklch(0.65 0.20 300)",
  purpleDark: "oklch(0.45 0.25 300)",
} as const;
```

- [ ] **Step 2: Add purple CSS variables to tokens.css**

In `packages/design-tokens/src/tokens.css`, add after `--brand-orange-dark`:

```css
--brand-purple: oklch(0.55 0.25 300);
--brand-purple-light: oklch(0.65 0.2 300);
--brand-purple-dark: oklch(0.45 0.25 300);
```

Add in both `:root` (light) and `.dark` blocks.

- [ ] **Step 3: Verify globals.css picks up the variables**

Check if `apps/landing/src/app/globals.css` imports `tokens.css` or redefines brand variables. If it redefines them, add the purple variables there too. Ensure Tailwind can use `bg-brand-purple`, `text-brand-purple`, etc.

- [ ] **Step 4: Commit**

```bash
git add packages/design-tokens/src/tokens.ts packages/design-tokens/src/tokens.css
git commit -m "feat(design-tokens): add brand.purple secondary accent token"
```

---

### Task 2: Create i18n translation infrastructure

**Files:**

- Create: `packages/i18n/locales/nb/landing.json`
- Create: `packages/i18n/locales/nb/docs.json`
- Create: `packages/i18n/locales/en/common.json`
- Create: `packages/i18n/locales/en/landing.json`
- Create: `packages/i18n/locales/en/docs.json`
- Create: `packages/i18n/src/translate.ts`
- Modify: `packages/i18n/src/index.ts` (export translate)

- [ ] **Step 1: Create stub JSON files for nb**

Create `packages/i18n/locales/nb/landing.json` with initial keys (extract from VariantMLanding later):

```json
{
  "site.title": "SmartOut - Mot fremtidens workforce management",
  "site.description": "AI-drevet workforce management for den norske serveringsbransjen."
}
```

Create `packages/i18n/locales/nb/docs.json`:

```json
{
  "sidebar.search": "Sok i dokumentasjonen...",
  "sidebar.contact": "Trenger du hjelp? Kontakt oss",
  "sidebar.noResults": "Ingen resultater for",
  "breadcrumb.docs": "Dokumentasjon",
  "nav.prev": "Forrige",
  "nav.next": "Neste"
}
```

Update `packages/i18n/locales/nb/common.json` — add `site.title` and `site.description` keys.

- [ ] **Step 2: Create stub JSON files for en**

Create `packages/i18n/locales/en/common.json`:

```json
{
  "site.title": "SmartOut - The future of workforce management",
  "site.description": "AI-powered workforce management for the hospitality industry."
}
```

Create `packages/i18n/locales/en/landing.json` (stub, same keys as nb, English values).

Create `packages/i18n/locales/en/docs.json`:

```json
{
  "sidebar.search": "Search documentation...",
  "sidebar.contact": "Need help? Contact us",
  "sidebar.noResults": "No results for",
  "breadcrumb.docs": "Documentation",
  "nav.prev": "Previous",
  "nav.next": "Next"
}
```

- [ ] **Step 3: Create translate.ts**

Create `packages/i18n/src/translate.ts`:

```typescript
import type { SupportedLocale } from "./config";

import nbCommon from "../locales/nb/common.json";
import nbLanding from "../locales/nb/landing.json";
import nbDocs from "../locales/nb/docs.json";
import enCommon from "../locales/en/common.json";
import enLanding from "../locales/en/landing.json";
import enDocs from "../locales/en/docs.json";

const localeModules: Record<string, Record<string, Record<string, string>>> = {
  nb: { common: nbCommon, landing: nbLanding, docs: nbDocs },
  en: { common: enCommon, landing: enLanding, docs: enDocs },
};

export function createTranslator(locale: SupportedLocale, namespace: string) {
  const messages = localeModules[locale]?.[namespace] ?? {};
  return function t(key: string): string {
    return messages[key] ?? key;
  };
}
```

Note: Use ES module imports (not `require()`) for proper tree-shaking and turbopack compatibility.

- [ ] **Step 4: Export from index.ts**

Add to `packages/i18n/src/index.ts`:

```typescript
export { createTranslator } from "./translate";
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm --filter @smartout/i18n typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/i18n/
git commit -m "feat(i18n): add translation infrastructure with nb+en JSON files"
```

---

### Task 3: Middleware locale detection + matcher expansion

**Files:**

- Modify: `apps/landing/src/middleware.ts`

- [ ] **Step 1: Add locale detection to middleware**

Rewrite `apps/landing/src/middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";

const FREE_FOREVER_HOSTNAMES = new Set(["free4ever.smartout.ai", "free4ever.localhost"]);

function getHostname(request: NextRequest): string {
  const hostHeader = request.headers.get("host");
  const host = hostHeader ?? request.nextUrl.host;
  return host.split(":")[0]?.toLowerCase() ?? request.nextUrl.hostname.toLowerCase();
}

export function middleware(request: NextRequest) {
  const hostname = getHostname(request);
  const { pathname } = request.nextUrl;

  // Free-forever subdomain rewrite
  if (pathname === "/" && FREE_FOREVER_HOSTNAMES.has(hostname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/free-forever";
    return NextResponse.rewrite(url);
  }

  // Locale detection: /en/ prefix = English, everything else = Norwegian
  const isEnglish = pathname.startsWith("/en/") || pathname === "/en";
  const locale = isEnglish ? "en" : "nb";

  const response = NextResponse.next();
  response.headers.set("x-locale", locale);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
```

Key changes:

- Removed legacy `?v=` variant redirects (variants are being archived)
- Added locale detection via `/en/` prefix
- Expanded matcher from `"/"` to all non-static paths
- Sets `x-locale` header for downstream components

- [ ] **Step 2: Verify landing still loads locally**

Run: `pnpm --filter landing dev` and check `http://localhost:3055` renders correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/middleware.ts
git commit -m "feat(landing): add locale detection middleware with expanded matcher"
```

---

## Phase 2: Docs Pipeline

### Task 4: Move docs content to locale subfolders

**Files:**

- Move: `docs/User Manual/*.md` → `docs/User Manual/nb/*.md`
- Keep: `docs/User Manual/INDEX.md` in root
- Keep: `docs/User Manual/sv/` as-is

- [ ] **Step 1: Create nb directory and move files**

```bash
mkdir -p "docs/User Manual/nb"
for f in docs/User\ Manual/[0-9]*.md; do
  mv "$f" "docs/User Manual/nb/"
done
```

- [ ] **Step 2: Create en directory with stub files**

```bash
mkdir -p "docs/User Manual/en"
```

Create `docs/User Manual/en/00-smartout-overview.md` with English translation of the overview. For now, create stubs for all 11 files that match the nb structure but with English content. Each file needs:

- YAML frontmatter with `title`, `slug`, `slug_en` fields
- English content (can be placeholder initially)

- [ ] **Step 3: Add slug_en to Norwegian frontmatter**

Update each `docs/User Manual/nb/*.md` file's YAML frontmatter to include `slug_en`:

```yaml
# 00-smartout-overview.md
slug_en: smartout-overview

# 01-kom-i-gang.md
slug_en: getting-started

# 02-onboarding.md
slug_en: onboarding

# 03-vaktplan.md
slug_en: shift-planning

# 04-ansatte.md
slug_en: staff-management

# 05-oppgaver-rutiner.md
slug_en: tasks-and-routines

# 06-haccp.md
slug_en: haccp

# 07-kommunikasjon.md
slug_en: communication

# 08-ai-assistent.md
slug_en: ai-assistant

# 09-rapporter.md
slug_en: reports

# 10-innstillinger.md
slug_en: settings
```

- [ ] **Step 4: Commit**

```bash
git add "docs/User Manual/"
git commit -m "feat(docs): restructure User Manual into nb/en locale subfolders"
```

---

### Task 5: Update user-manual.ts reader for locales + Vercel fix

**Files:**

- Modify: `apps/landing/src/lib/user-manual.ts`
- Modify: `apps/landing/next.config.ts`

- [ ] **Step 1: Update resolveManualDirectory to accept locale**

Modify `apps/landing/src/lib/user-manual.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

export type UserManualDoc = {
  slug: string;
  title: string;
  order: number;
  fileName: string;
  content: string;
  excerpt: string;
  slugEn?: string;
};

export type DocsLocale = "nb" | "en";

const MANUAL_DIR_NAME = "User Manual";

function resolveManualDirectory(locale: DocsLocale) {
  const candidates = [
    path.join(process.cwd(), "docs", MANUAL_DIR_NAME, locale),
    path.join(process.cwd(), "..", "..", "docs", MANUAL_DIR_NAME, locale),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
```

- [ ] **Step 2: Update getUserManualDocs with locale + React.cache**

```typescript
function extractFrontmatterField(markdown: string, field: string): string | undefined {
  if (!markdown.startsWith("---")) return undefined;
  const closing = markdown.indexOf("---", 3);
  if (closing === -1) return undefined;
  const frontmatter = markdown.slice(3, closing);
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "");
}

export const getUserManualDocs = cache((locale: DocsLocale): UserManualDoc[] => {
  const manualDir = resolveManualDirectory(locale);
  if (!manualDir) return [];
  const files = fs
    .readdirSync(manualDir)
    .filter((file) => file.toLowerCase().endsWith(".md") && file.toLowerCase() !== "index.md");

  const docs = files
    .map((fileName, index) => {
      const numberedMatch = fileName.match(/^(\d+)\-(.+)\.md$/i);
      const baseName = stripNumericPrefix(fileName).replace(/\.md$/i, "");
      const order = numberedMatch?.[1] ? Number.parseInt(numberedMatch[1], 10) : 1000 + index;
      const fullPath = path.join(manualDir, fileName);
      const content = fs.readFileSync(fullPath, "utf8");
      const fallbackTitle = toTitleCase(baseName || "Dokument");

      // For nb docs: use slug_en from frontmatter for cross-locale linking
      // For en docs: use slug from frontmatter (or derive from filename)
      const fmSlug = extractFrontmatterField(content, "slug");
      const fmSlugEn = extractFrontmatterField(content, "slug_en");
      const slug = locale === "en" && fmSlugEn ? fmSlugEn : (fmSlug ?? slugify(baseName));

      return {
        slug,
        title: extractTitle(content, fallbackTitle),
        order,
        fileName,
        content,
        excerpt: extractExcerpt(content),
        slugEn: fmSlugEn,
      } satisfies UserManualDoc;
    })
    .sort((a, b) => a.order - b.order);

  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.slug)) return false;
    seen.add(doc.slug);
    return true;
  });
});
```

- [ ] **Step 3: Update dependent functions**

Update all functions that call `getUserManualDocs()` to pass locale:

```typescript
export function getUserManualDocBySlug(slug: string, locale: DocsLocale = "nb") {
  return getUserManualDocs(locale).find((doc) => doc.slug === slug) ?? null;
}

export function getUserManualNavigation(locale: DocsLocale = "nb"): UserManualNavItem[] {
  return getUserManualDocs(locale).map((doc) => ({
    title: doc.title,
    href: locale === "en" ? `/en/docs/${doc.slug}` : `/docs/${doc.slug}`,
    description: doc.excerpt,
    slug: doc.slug,
  }));
}

export function searchUserManual(query: string, limit = 4, locale: DocsLocale = "nb") {
  return getUserManualDocs(locale)
    .map((doc) => ({ doc, score: scoreDocAgainstQuery(doc, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.doc);
}
```

- [ ] **Step 4: Add outputFileTracingIncludes to next.config.ts**

In `apps/landing/next.config.ts`, add to `nextConfig`:

```typescript
outputFileTracingIncludes: {
  "/docs": ["../../docs/User Manual/**/*.md"],
  "/docs/[slug]": ["../../docs/User Manual/**/*.md"],
  "/en/docs": ["../../docs/User Manual/**/*.md"],
  "/en/docs/[slug]": ["../../docs/User Manual/**/*.md"],
  "/sitemap.xml": ["../../docs/User Manual/**/*.md"],
},
```

- [ ] **Step 5: Update docs layout.tsx to pass locale**

Modify `apps/landing/src/app/docs/layout.tsx`:

```typescript
import { headers } from "next/headers";
import type { DocsLocale } from "@/lib/user-manual";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") ?? "nb") as DocsLocale;
  const navigation = getUserManualNavigation(locale);

  return (
    <div className="bg-background text-foreground flex min-h-screen font-sans">
      <FullTracker />
      <DocsSidebar navigation={navigation} locale={locale} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 lg:px-12 lg:py-16">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Update [slug]/page.tsx to pass locale**

Modify `apps/landing/src/app/docs/[slug]/page.tsx` to read locale from headers and pass to `getUserManualDocBySlug(slug, locale)` and `MarkdownRenderer`.

- [ ] **Step 7: Verify docs render locally**

Run: `pnpm --filter landing dev` and check `http://localhost:3055/docs` shows sidebar with all 11 docs.

- [ ] **Step 8: Commit**

```bash
git add apps/landing/src/lib/user-manual.ts apps/landing/next.config.ts apps/landing/src/app/docs/
git commit -m "feat(docs): locale-aware reader with React.cache + Vercel file tracing"
```

---

### Task 6: Upgrade MarkdownRenderer with rich components

**Files:**

- Modify: `apps/landing/src/app/docs/_components/markdown-renderer.tsx`
- Possibly add: `remark-github-blockquote-alert` dependency

- [ ] **Step 1: Install remark-github-blockquote-alert**

```bash
cd apps/landing && pnpm add remark-github-blockquote-alert
```

This remark plugin transforms `> [!TIP]`, `> [!WARNING]`, `> [!INFO]` into structured HTML nodes.

- [ ] **Step 2: Add locale prop to MarkdownRenderer**

```typescript
export function MarkdownRenderer({ content, locale = "nb" }: { content: string; locale?: "nb" | "en" }) {
```

- [ ] **Step 3: Upgrade blockquote to detect callout types**

Replace the `blockquote` component to detect and style GitHub-style alerts. The `remark-github-blockquote-alert` plugin wraps alerts in `<blockquote>` with a specific class structure. Style them using design-token CSS variables:

- `[!TIP]` → green (semantic success): `border-[var(--success)]/20 bg-[var(--success)]/5`
- `[!WARNING]` → amber (semantic warning): `border-[var(--warning)]/20 bg-[var(--warning)]/5`
- `[!INFO]` → brand orange (default blockquote style, keep existing)

- [ ] **Step 4: Upgrade ordered list items for step-card rendering**

Detect ordered list items where first child is `<strong>`: render as a numbered step card with a circle number badge (using design-token colors, no hardcoded values).

- [ ] **Step 5: Upgrade unordered list items for feature-highlight rendering**

Detect unordered list items where first child is `<strong>` followed by `—`: render as a feature card with subtle border and icon area.

- [ ] **Step 6: Add locale-aware link handling**

Update the `a` component to prefix `/en/` for internal docs links when `locale === "en"`:

```typescript
a: ({ href, children }) => {
  let resolvedHref = href;
  if (locale === "en" && href?.startsWith("/docs/")) {
    resolvedHref = `/en${href}`;
  }
  // ... rest of link rendering with design tokens
},
```

- [ ] **Step 7: Audit all components for hardcoded colors**

Replace ALL hardcoded color classes in the existing components:

- `text-brand-orange` stays (it's a CSS variable)
- Any `text-zinc-*`, `text-white`, `border-white/*`, `bg-blue-*`, `bg-amber-*`, `bg-emerald-*` must become CSS variable classes

- [ ] **Step 8: Verify rendering with a test markdown file**

Create a test markdown file with callouts, step lists, and feature highlights. Run locally and verify visual quality.

- [ ] **Step 9: Commit**

```bash
git add apps/landing/
git commit -m "feat(docs): upgrade MarkdownRenderer with callouts, steps, feature cards"
```

---

### Task 7: Delete hardcoded docs pages

**Files:**

- Delete: `apps/landing/src/app/docs/vaktplan/`
- Delete: `apps/landing/src/app/docs/onboarding/`
- Delete: `apps/landing/src/app/docs/kom-i-gang/`
- Delete: `apps/landing/src/app/docs/ansatte/`
- Delete: `apps/landing/src/app/docs/oppgaver-rutiner/`
- Delete: `apps/landing/src/app/docs/haccp/`
- Delete: `apps/landing/src/app/docs/kommunikasjon/`
- Delete: `apps/landing/src/app/docs/ai-assistent/`
- Delete: `apps/landing/src/app/docs/rapporter/`
- Delete: `apps/landing/src/app/docs/innstillinger/`
- Delete: `apps/landing/src/app/docs/_components/docs-article.tsx`
- Keep: `apps/landing/src/app/docs/api/` (API docs page, not part of User Manual)

- [ ] **Step 1: Verify markdown files cover all topics**

Check that `docs/User Manual/nb/` has equivalent content for each deleted page. If any hardcoded page has content not in the markdown file, update the markdown file first.

- [ ] **Step 2: Delete hardcoded route directories**

```bash
rm -rf apps/landing/src/app/docs/vaktplan
rm -rf apps/landing/src/app/docs/onboarding
rm -rf apps/landing/src/app/docs/kom-i-gang
rm -rf apps/landing/src/app/docs/ansatte
rm -rf apps/landing/src/app/docs/oppgaver-rutiner
rm -rf apps/landing/src/app/docs/haccp
rm -rf apps/landing/src/app/docs/kommunikasjon
rm -rf apps/landing/src/app/docs/ai-assistent
rm -rf apps/landing/src/app/docs/rapporter
rm -rf apps/landing/src/app/docs/innstillinger
```

- [ ] **Step 3: Delete docs-article.tsx**

```bash
rm apps/landing/src/app/docs/_components/docs-article.tsx
```

- [ ] **Step 4: Verify no broken imports**

Run: `pnpm --filter landing typecheck`
Fix any broken imports referencing deleted files.

- [ ] **Step 5: Verify docs still render via [slug] route**

Run: `pnpm --filter landing dev` and check all doc slugs work.

- [ ] **Step 6: Commit**

```bash
git add -A apps/landing/src/app/docs/
git commit -m "refactor(docs): remove 10 hardcoded pages, all docs via markdown [slug] route"
```

---

## Phase 3: Landing Page Cleanup

### Task 8: Archive landing variants + clean routing

**Files:**

- Move: `apps/landing/src/components/landing/Variant{A,E,F,I,K,S,T,V}Landing.tsx` → `_archived/`
- Modify: `apps/landing/src/app/page.tsx`
- Modify: `apps/landing/src/app/[slug]/page.tsx`
- Delete or modify: `apps/landing/src/lib/landing-variant.ts`
- Delete or modify: `apps/landing/src/lib/perspective-slugs.ts`

- [ ] **Step 1: Create \_archived directory and move variants**

```bash
mkdir -p apps/landing/src/components/landing/_archived
for v in A E F I K S T V; do
  mv "apps/landing/src/components/landing/Variant${v}Landing.tsx" \
     "apps/landing/src/components/landing/_archived/"
done
```

- [ ] **Step 2: Rewrite app/page.tsx as server component**

Replace `apps/landing/src/app/page.tsx`:

```typescript
import { headers } from "next/headers";
import VariantMLanding from "../components/landing/VariantMLanding";

export default async function SmartoutLandingPage() {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") ?? "nb") as "nb" | "en";

  return <VariantMLanding locale={locale} />;
}
```

Note: `VariantMLanding` stays `"use client"` (framer-motion). The server page passes `locale` as prop.

- [ ] **Step 3: Simplify [slug]/page.tsx**

Since we're archiving variants, the `[slug]` route no longer maps perspective slugs to variant components. Options:

- If perspective slugs should still work → redirect them to `/`
- If they should 404 → simplify to only handle non-variant slugs

Simplest approach: remove variant mapping, keep the route for any other slug usage, or delete it if only variants used it. Check if other routes use `[slug]`.

- [ ] **Step 4: Delete landing-variant.ts**

`useVariant()` is no longer needed. Delete:

```bash
rm apps/landing/src/lib/landing-variant.ts
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm --filter landing typecheck`
Fix any broken imports.

- [ ] **Step 6: Verify landing renders locally**

Run: `pnpm --filter landing dev` — check `http://localhost:3055` shows Variant M.

- [ ] **Step 7: Commit**

```bash
git add -A apps/landing/
git commit -m "refactor(landing): archive 8 variants, Variant M as sole landing page"
```

---

### Task 9: Add locale prop to VariantMLanding + design token audit

**Files:**

- Modify: `apps/landing/src/components/landing/VariantMLanding.tsx`

- [ ] **Step 1: Add locale prop**

Change the component signature:

```typescript
export default function VariantMLanding({ locale = "nb" }: { locale?: "nb" | "en" }) {
```

- [ ] **Step 2: Replace all purple-500 with brand-purple**

Search and replace in `VariantMLanding.tsx`:

- `bg-purple-500` → `bg-brand-purple`
- `to-purple-500` → `to-brand-purple`
- `border-purple-500` → `border-brand-purple`
- `from-purple-500` → `from-brand-purple`
- `rgba(168,85,247,0.3)` → use `var(--brand-purple)` equivalent
- `shadow-[0_0_30px_-10px_rgba(168,85,247,0.3)]` → `shadow-[0_0_30px_-10px_var(--brand-purple)]`

- [ ] **Step 3: Audit remaining hardcoded colors**

Search for any other hardcoded color patterns in VariantMLanding.tsx:

- `text-white` → `text-foreground`
- `text-zinc-*` → `text-muted-foreground` or `text-foreground/80`
- `bg-white` → `bg-background`
- `border-white` → `border-border`
- `rgba(251,146,60,*)` → use `var(--brand-orange)` equivalent

Note: Some occurrences of `text-white` on dark backgrounds may be intentional (e.g., over gradient overlays). Use judgment — the goal is CSS variables, not blindly replacing.

- [ ] **Step 4: Verify visual appearance**

Run: `pnpm --filter landing dev` and compare before/after. Purple sections should look the same.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/src/components/landing/VariantMLanding.tsx
git commit -m "refactor(landing): design token audit, replace hardcoded colors with CSS vars"
```

---

### Task 10: Extract landing text to i18n keys

**Files:**

- Modify: `apps/landing/src/components/landing/VariantMLanding.tsx`
- Modify: `packages/i18n/locales/nb/landing.json`
- Modify: `packages/i18n/locales/en/landing.json`

- [ ] **Step 1: Identify all hardcoded Norwegian text**

Read through `VariantMLanding.tsx` and list every hardcoded string: headings, paragraphs, button labels, feature titles, feature descriptions, section titles, etc.

- [ ] **Step 2: Create comprehensive landing.json for nb**

Extract all text into `packages/i18n/locales/nb/landing.json` with structured keys:

```json
{
  "hero.title": "...",
  "hero.subtitle": "...",
  "hero.cta": "...",
  "features.title": "...",
  "features.item1.title": "...",
  "features.item1.description": "...",
  ...
}
```

- [ ] **Step 3: Create English landing.json**

Translate all keys to English in `packages/i18n/locales/en/landing.json`.

- [ ] **Step 4: Wire up createTranslator in VariantMLanding**

At the top of the component:

```typescript
import { createTranslator } from "@smartout/i18n";

export default function VariantMLanding({ locale = "nb" }: { locale?: "nb" | "en" }) {
  const t = createTranslator(locale, "landing");
  // Replace all hardcoded text with t('key')
```

- [ ] **Step 5: Replace all hardcoded strings with t() calls**

Go through every text element and replace with `t('key')`. This is mechanical but thorough work.

- [ ] **Step 6: Verify both languages render**

Test with locale prop:

- Default (`/`) should show Norwegian
- Pass `locale="en"` to verify English renders

- [ ] **Step 7: Commit**

```bash
git add apps/landing/src/components/landing/VariantMLanding.tsx packages/i18n/
git commit -m "feat(landing): extract all text to i18n JSON keys, add English translations"
```

---

### Task 11: i18n shared components (Navigation, Footer, DocsSidebar)

**Files:**

- Modify: `apps/landing/src/components/navigation.tsx`
- Modify: `apps/landing/src/components/footer.tsx`
- Modify: `apps/landing/src/app/docs/_components/docs-sidebar.tsx`
- Modify: `packages/i18n/locales/nb/common.json`
- Modify: `packages/i18n/locales/en/common.json`

- [ ] **Step 1: Add locale prop to Navigation, Footer**

These are likely `"use client"` — add `locale` prop, use `createTranslator(locale, 'common')`.

- [ ] **Step 2: Extract hardcoded text from Navigation**

Replace Norwegian nav labels, CTA buttons with `t('nav.pricing')`, `t('nav.docs')`, etc.

- [ ] **Step 3: Extract hardcoded text from Footer**

Same pattern — all Norwegian text to common.json keys.

- [ ] **Step 4: Update DocsSidebar**

Add `locale` prop, replace hardcoded Norwegian text (`"Sok i dokumentasjonen..."`, `"Trenger du hjelp?"`, etc.) with `t()` calls from docs namespace.

- [ ] **Step 5: Design token audit on shared components**

Check Navigation, Footer, DocsSidebar for hardcoded colors. Replace with CSS variable classes.

- [ ] **Step 6: Commit**

```bash
git add apps/landing/src/components/ apps/landing/src/app/docs/_components/ packages/i18n/
git commit -m "feat(landing): i18n shared components (nav, footer, docs sidebar)"
```

---

## Phase 4: English Routes + SEO

### Task 12: Create /en/ route structure

**Files:**

- Create: `apps/landing/src/app/en/page.tsx`
- Create: `apps/landing/src/app/en/docs/page.tsx`
- Create: `apps/landing/src/app/en/docs/[slug]/page.tsx`
- Create: `apps/landing/src/app/en/docs/layout.tsx`
- Create: `apps/landing/src/app/en/pricing/page.tsx` (if pricing exists)
- Create: `apps/landing/src/app/en/layout.tsx`

- [ ] **Step 1: Create en/page.tsx (landing)**

```typescript
import VariantMLanding from "../../components/landing/VariantMLanding";

export default function EnglishLandingPage() {
  return <VariantMLanding locale="en" />;
}
```

- [ ] **Step 2: Create en/docs/layout.tsx**

Reuse the docs layout but with `locale="en"`:

```typescript
import { DocsSidebar } from "../../app/docs/_components/docs-sidebar";
import { getUserManualNavigation } from "@/lib/user-manual";
import { FullTracker } from "../../../components/tracking";

export default function EnDocsLayout({ children }: { children: React.ReactNode }) {
  const navigation = getUserManualNavigation("en");

  return (
    <div className="bg-background text-foreground flex min-h-screen font-sans">
      <FullTracker />
      <DocsSidebar navigation={navigation} locale="en" />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 lg:px-12 lg:py-16">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create en/docs/page.tsx**

Mirror the nb docs index but with `locale="en"`.

- [ ] **Step 4: Create en/docs/[slug]/page.tsx**

Mirror the nb `[slug]/page.tsx` but reading English docs:

```typescript
import { getUserManualDocBySlug, getUserManualDocs } from "@/lib/user-manual";
// ... same structure but with locale="en"
```

- [ ] **Step 5: Create en/ routes for other pages (pricing, om-oss, etc.)**

For each existing Norwegian page that needs English, create a thin wrapper in `en/`. Start with the most important ones: pricing, docs. Others can follow incrementally.

- [ ] **Step 6: Verify English routes work**

Navigate to `http://localhost:3055/en/`, `http://localhost:3055/en/docs/`, `http://localhost:3055/en/docs/smartout-overview`.

- [ ] **Step 7: Commit**

```bash
git add apps/landing/src/app/en/
git commit -m "feat(landing): add /en/ route structure for English locale"
```

---

### Task 13: Root layout — dynamic lang + metadataBase

**Files:**

- Modify: `apps/landing/src/app/layout.tsx`

- [ ] **Step 1: Make layout locale-aware**

```typescript
import type { Metadata } from "next";
import { headers } from "next/headers";
import { createTranslator } from "@smartout/i18n";
// ... font imports stay

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") ?? "nb") as "nb" | "en";
  const t = createTranslator(locale, "common");

  return {
    metadataBase: new URL("https://smartout.ai"),
    title: t("site.title"),
    description: t("site.description"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const locale = headersList.get("x-locale") ?? "nb";

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      {/* ... body stays the same */}
    </html>
  );
}
```

- [ ] **Step 2: Verify html lang changes**

Check `http://localhost:3055/` → `lang="nb"`
Check `http://localhost:3055/en/` → `lang="en"`

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/app/layout.tsx
git commit -m "feat(landing): dynamic html lang + metadataBase for SEO"
```

---

### Task 14: SEO — sitemap.xml + robots.txt

**Files:**

- Create: `apps/landing/src/app/sitemap.ts`
- Create: `apps/landing/src/app/robots.ts`

- [ ] **Step 1: Create sitemap.ts**

```typescript
import type { MetadataRoute } from "next";
import { getUserManualDocs } from "@/lib/user-manual";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://smartout.ai";
  const nbDocs = getUserManualDocs("nb");
  const enDocs = getUserManualDocs("en");

  const staticPages = [
    { path: "/", enPath: "/en/", priority: 1.0, freq: "weekly" as const },
    { path: "/pricing", enPath: "/en/pricing", priority: 0.9, freq: "monthly" as const },
    { path: "/docs", enPath: "/en/docs", priority: 0.8, freq: "weekly" as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  for (const page of staticPages) {
    entries.push({
      url: `${base}${page.path}`,
      changeFrequency: page.freq,
      priority: page.priority,
      alternates: {
        languages: {
          nb: `${base}${page.path}`,
          en: `${base}${page.enPath}`,
        },
      },
    });
  }

  // Norwegian docs
  for (const doc of nbDocs) {
    const enDoc = enDocs.find((d) => d.fileName === doc.fileName);
    entries.push({
      url: `${base}/docs/${doc.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: {
        languages: {
          nb: `${base}/docs/${doc.slug}`,
          en: `${base}/en/docs/${enDoc?.slug ?? doc.slugEn ?? doc.slug}`,
        },
      },
    });
  }

  return entries;
}
```

- [ ] **Step 2: Create robots.ts**

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/v/"] },
    sitemap: "https://smartout.ai/sitemap.xml",
  };
}
```

- [ ] **Step 3: Verify locally**

Check `http://localhost:3055/sitemap.xml` and `http://localhost:3055/robots.txt`.

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/app/sitemap.ts apps/landing/src/app/robots.ts
git commit -m "feat(seo): add dynamic sitemap.xml with hreflang + robots.txt"
```

---

### Task 15: Add hreflang to page-level metadata

**Files:**

- Modify: `apps/landing/src/app/docs/[slug]/page.tsx`
- Modify: `apps/landing/src/app/en/docs/[slug]/page.tsx`
- Modify: `apps/landing/src/app/page.tsx`
- Modify: `apps/landing/src/app/en/page.tsx`
- Modify: `apps/landing/src/app/docs/page.tsx`
- Modify: `apps/landing/src/app/en/docs/page.tsx`

- [ ] **Step 1: Add alternates to each page's generateMetadata**

For each page, add `alternates` with `canonical` and `languages`:

```typescript
// Example for docs/[slug]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getUserManualDocBySlug(slug, "nb");
  if (!doc) return { title: "Dokumentasjon" };
  return {
    title: `${doc.title} - SmartOut Docs`,
    description: doc.excerpt,
    alternates: {
      canonical: `/docs/${slug}`,
      languages: {
        nb: `/docs/${slug}`,
        en: `/en/docs/${doc.slugEn ?? slug}`,
      },
    },
  };
}
```

- [ ] **Step 2: Repeat for all page files**

Apply the same pattern to each page file (landing, docs index, pricing, etc.)

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/app/
git commit -m "feat(seo): add hreflang alternates to all page metadata"
```

---

## Phase 5: English Content

### Task 16: Translate User Manual docs to English

**Files:**

- Create/update: `docs/User Manual/en/00-smartout-overview.md` through `10-settings.md`

- [ ] **Step 1: Translate each markdown file**

For each of the 11 docs, create the English version in `docs/User Manual/en/`. Maintain:

- Same YAML frontmatter structure (with English title)
- Same heading hierarchy
- Same callout types (`[!TIP]`, `[!WARNING]`, `[!INFO]`)
- Correct internal links (English slugs)
- Professional English copy, not machine translation

- [ ] **Step 2: Verify all English docs render**

Navigate to `http://localhost:3055/en/docs/` and check each page.

- [ ] **Step 3: Commit**

```bash
git add "docs/User Manual/en/"
git commit -m "feat(docs): add English translations for all 11 User Manual docs"
```

---

### Task 17: Update docs/page.tsx (Moduler panel) for i18n

**Files:**

- Modify: `apps/landing/src/app/docs/page.tsx`
- Create: `apps/landing/src/app/en/docs/page.tsx`

- [ ] **Step 1: Extract module card text to docs.json**

The Moduler panel has 10 cards with hardcoded Norwegian titles and descriptions. Extract to `packages/i18n/locales/nb/docs.json` and `en/docs.json`.

- [ ] **Step 2: Make docs index locale-aware**

Read locale from headers, use `createTranslator(locale, 'docs')` for UI chrome text.

- [ ] **Step 3: Create en/docs/page.tsx**

Mirror the nb page but with `locale="en"`.

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/app/docs/page.tsx apps/landing/src/app/en/docs/ packages/i18n/
git commit -m "feat(docs): i18n Moduler panel + English docs index"
```

---

## Phase 6: Final Verification

### Task 18: Full typecheck + lint + build

- [ ] **Step 1: Typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 2: Lint**

Run: `pnpm turbo lint`
Expected: 0 errors.

- [ ] **Step 3: Build**

Run: `pnpm --filter landing build`
Expected: Successful build with all static pages generated.

- [ ] **Step 4: Fix any issues found**

- [ ] **Step 5: Commit any fixes**

```bash
git commit -m "fix(landing): resolve typecheck/lint/build issues from i18n overhaul"
```

---

### Task 19: Visual verification checklist

- [ ] **Step 1: Norwegian landing** — `localhost:3055/` renders Variant M with Norwegian text
- [ ] **Step 2: English landing** — `localhost:3055/en/` renders Variant M with English text
- [ ] **Step 3: Norwegian docs sidebar** — `localhost:3055/docs` shows 11 items in sidebar
- [ ] **Step 4: English docs sidebar** — `localhost:3055/en/docs` shows 11 English items
- [ ] **Step 5: Docs page rendering** — Professional formatting with callouts, steps, feature cards
- [ ] **Step 6: Docs navigation** — Prev/Next links work, cross-page nav works
- [ ] **Step 7: Design tokens** — No hardcoded colors visible in devtools inspection
- [ ] **Step 8: Sitemap** — `localhost:3055/sitemap.xml` shows all pages with hreflang
- [ ] **Step 9: Robots** — `localhost:3055/robots.txt` exists
- [ ] **Step 10: html lang** — View source shows `lang="nb"` on `/` and `lang="en"` on `/en/`
