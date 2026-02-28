# Docs Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a polished, navigable documentation section on the landing site with curated sidebar navigation, full Norwegian content, and a working AI search agent.

**Architecture:** Static TSX pages using DocsArticle components for all 10 modules + API reference. Sidebar driven by curated `docsNavigation` structure with expandable sections and #anchor sub-items. Markdown files in `docs/User Manual/` serve as search index for the AI docs agent only (not rendered directly).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, lucide-react, react-markdown + remark-gfm (for agent panel), DocsArticle component system.

---

## Current State

| Asset                           | Status                           | Notes                                                                |
| ------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| 10 static TSX module pages      | Complete, untracked              | Full Norwegian content                                               |
| API reference page              | Complete, untracked              | Two-column layout with own sidebar                                   |
| Overview/hub page               | Complete, modified               | Module cards + AI agent panel                                        |
| DocsArticle components          | Complete, tracked                | Heading, SubHeading, Paragraph, StepList, Step, InfoBox, FeatureCard |
| `navigation.ts`                 | Complete, tracked                | 10 sections with subsection #anchors                                 |
| Sidebar (`docs-sidebar.tsx`)    | Needs upgrade                    | Currently flat list from markdown files                              |
| Layout (`layout.tsx`)           | Needs update                     | Currently imports `getUserManualNavigation()`                        |
| `[slug]/page.tsx` dynamic route | Exists, untracked                | Conflicts with static routes — remove                                |
| `docs/User Manual/*.md`         | 01 complete, 02-10 Swedish stubs | Needed for docs agent search index                                   |
| Footer links                    | Complete, untracked              | 6-section link grid                                                  |
| Agent panel                     | Complete, tracked                | Chat UI hitting `/api/docs-agent`                                    |
| `api-sidebar.tsx`               | Exists, untracked                | Used by API page only                                                |

## Key Files

| File               | Path                                                          | Role                         |
| ------------------ | ------------------------------------------------------------- | ---------------------------- |
| Docs layout        | `apps/landing/src/app/docs/layout.tsx`                        | Sidebar + main wrapper       |
| Sidebar            | `apps/landing/src/app/docs/_components/docs-sidebar.tsx`      | Navigation component         |
| Navigation data    | `apps/landing/src/app/docs/_data/navigation.ts`               | Curated sections + sub-items |
| User manual loader | `apps/landing/src/lib/user-manual.ts`                         | Reads markdown for search    |
| Article components | `apps/landing/src/app/docs/_components/docs-article.tsx`      | Shared page building blocks  |
| Breadcrumb         | `apps/landing/src/app/docs/_components/docs-breadcrumb.tsx`   | Auto breadcrumbs             |
| Footer links       | `apps/landing/src/app/docs/_components/docs-footer-links.tsx` | Bottom link grid             |
| Agent panel        | `apps/landing/src/app/docs/_components/docs-agent-panel.tsx`  | AI chat                      |
| API sidebar        | `apps/landing/src/app/docs/_components/api-sidebar.tsx`       | API page nav                 |
| Overview page      | `apps/landing/src/app/docs/page.tsx`                          | Module hub                   |

---

## Task 1: Upgrade Sidebar to Curated Navigation

The sidebar currently renders a flat list from `getUserManualNavigation()` (reads markdown files). Replace it with the curated `docsNavigation` structure from `navigation.ts` — grouped sections with icons, expandable sub-items, and #anchor links.

**Files:**

- Modify: `apps/landing/src/app/docs/_components/docs-sidebar.tsx`
- Read: `apps/landing/src/app/docs/_data/navigation.ts`

**Step 1: Read current sidebar and navigation data**

Understand the current `DocsSidebar` props and `docsNavigation` types.

**Step 2: Update sidebar props and imports**

Change the sidebar to accept `DocSection[]` from `navigation.ts` instead of the flat `DocsNavItem[]`.

```tsx
// Old
import type { DocsNavItem } from "somewhere";
export function DocsSidebar({ navigation }: { navigation: DocsNavItem[] }) {

// New
import { type DocSection, docsNavigation } from "../_data/navigation";
export function DocsSidebar() {
```

**Step 3: Implement collapsible sections**

Each `DocSection` renders as a group with:

- Section header (icon + title) — links to `section.href`
- Active state when pathname matches `section.href` or starts with it
- Sub-items with smaller text — link to `section.items[n].href` (#anchor links)
- Auto-expand the section that contains the current path
- Collapse other sections

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { Building2, Search, Menu, X, ChevronDown } from "lucide-react";
import { type DocSection, docsNavigation } from "../_data/navigation";

export function DocsSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Find which section is active
  const activeSectionHref = useMemo(() => {
    return (
      docsNavigation.find((s) => pathname === s.href || pathname.startsWith(s.href + "/"))?.href ??
      null
    );
  }, [pathname]);

  // Track expanded sections (auto-expand active)
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(activeSectionHref ? [activeSectionHref] : []),
  );

  const toggleSection = (href: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  // Filter sections by search
  const filteredSections = searchQuery
    ? docsNavigation.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.items.some((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : docsNavigation;

  // ... render sidebar with sections, sub-items, search, mobile toggle
}
```

**Step 4: Style section headers and sub-items**

- Section header: icon + title, bold, clickable → navigates to section page
- ChevronDown icon for expand/collapse toggle
- Active section: orange accent (`border-orange-500/20 bg-orange-500/10`)
- Sub-items: indented, smaller text, link to `#anchor` within section page
- Active sub-item: orange text when hash matches

**Step 5: Verify sidebar renders correctly**

Run: `pnpm --filter landing dev`
Navigate to `/docs`, `/docs/kom-i-gang`, `/docs/vaktplan#vaktkort` etc.
Expected: Sections expand/collapse, active states work, #anchor links scroll correctly.

**Step 6: Commit**

```bash
git add apps/landing/src/app/docs/_components/docs-sidebar.tsx
git commit -m "feat(docs): upgrade sidebar to curated navigation with sections"
```

---

## Task 2: Update Docs Layout

Remove dependency on `getUserManualNavigation()`. The sidebar now imports its own data.

**Files:**

- Modify: `apps/landing/src/app/docs/layout.tsx`

**Step 1: Remove getUserManualNavigation import and call**

```tsx
// Old
import { getUserManualNavigation } from "@/lib/user-manual";
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const navigation = getUserManualNavigation();
  return (
    <div className="flex min-h-screen bg-[#050505] text-white">
      <DocsSidebar navigation={navigation} />
      ...
    </div>
  );
}

// New
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#050505] text-white">
      <DocsSidebar />
      ...
    </div>
  );
}
```

**Step 2: Verify layout still renders**

Run: `pnpm --filter landing dev`
Navigate to `/docs`
Expected: Layout renders with updated sidebar, no errors.

**Step 3: Commit**

```bash
git add apps/landing/src/app/docs/layout.tsx
git commit -m "feat(docs): decouple layout from markdown navigation"
```

---

## Task 3: Remove Dynamic [slug] Route

The `[slug]/page.tsx` dynamic route conflicts with static routes and is no longer needed.

**Files:**

- Delete: `apps/landing/src/app/docs/[slug]/page.tsx`

**Step 1: Delete the dynamic route file**

```bash
rm apps/landing/src/app/docs/\[slug\]/page.tsx
rmdir apps/landing/src/app/docs/\[slug\]
```

**Step 2: Verify no broken imports**

Run: `pnpm --filter landing build`
Expected: Build succeeds without the [slug] route.

**Step 3: Commit**

```bash
git add -A apps/landing/src/app/docs/\[slug\]/
git commit -m "chore(docs): remove dynamic [slug] route in favor of static pages"
```

---

## Task 4: Audit and Fix Anchor IDs

Verify that every `#anchor` in `navigation.ts` sub-items matches an actual `id` attribute in the corresponding page's `<Heading id="...">` or `<h2 id="...">` elements.

**Files:**

- Read: `apps/landing/src/app/docs/_data/navigation.ts`
- Modify (if needed): Each module `page.tsx` and/or `navigation.ts`

**Step 1: Build the anchor map**

For each section in `navigation.ts`, list expected anchors:

| Section       | navigation.ts anchors                                                                | Page heading IDs                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Kom i gang    | `#opprett-konto`, `#konfigurer-bedrift`, `#opprett-arbeidsplass`, `#inviter-ansatte` | `opprett-konto`, `konfigurer-bedrift`, `opprett-arbeidsplass`, `inviter-ansatte`                                                   |
| Onboarding    | `#onboarding-flyten`, `#opplaeringsplan`, `#dokumenter`, `#trainee-modus`            | `tre-systemer`, `trainee-modus`, `modulreiser`, `readiness`, `ai-veiledning`, `krysstrening`, `gamifisering`                       |
| Vaktplan      | `#lag-vaktplan`, `#publiser`, `#vaktbytte`, `#stemplingsur`, `#timeregistrering`     | `visningsmodi`, `vaktkort`, `ukeperiode`, `maler`, `tilgjengelighet`, `vaktbytte`, `stemplingsur`, `arbeidsrett`, `ai-planlegging` |
| Ansatte       | `#oversikt`, `#roller`, `#avdelinger`, `#team`, `#profiler`                          | `organisasjonsstruktur`, `profil-status`, `roller`, `administrere`, `kompetanse`, `flerarbeidsplass`                               |
| Oppgaver      | `#daglig-sesjon`, `#prosedyrer`, `#rutiner`, `#sjekklister`                          | `driftsokt`, `hooks`, `oppgavetyper`, `livssyklus`, `governance`, `signering`                                                      |
| HACCP         | `#ik-mat`, `#temperatur`, `#avvik`, `#rapporter`                                     | `hva-er-haccp`, `haccp-kjede`, `temperaturlogging`, `avvik`, `sertifiseringer`, `inspeksjon`, `ai-haccp`                           |
| Kommunikasjon | `#chat`, `#varsler`, `#oversettelse`                                                 | `kanaler`, `chat`, `kunngjøringer`, `varsling`, `stille-timer`                                                                     |
| AI-assistent  | `#hva-er-lise`, `#spor-lise`, `#stemme`                                              | `hvem-er-lise`, `motorer`, `autorisasjon`, `stemme`, `hendelseslogg`, `personvern`                                                 |
| Rapporter     | `#dashboard`, `#timer`, `#opplaering`, `#eksport`                                    | `tre-nivaer`, `daglig`, `kpi`, `varsler`, `sesong`, `rapporttyper`, `ai-rapporter`                                                 |
| Innstillinger | `#bedrift`, `#arbeidsplasser`, `#integrasjoner`, `#faktura`                          | `arbeidsplass`, `abonnement`, `flerarbeidsplass`, `gdpr`, `sprak`, `integrasjoner`, `rolletilgang`                                 |

**Step 2: Update navigation.ts anchors to match actual page IDs**

Many anchors in `navigation.ts` do NOT match the actual heading IDs in the pages. Update `navigation.ts` to use the real IDs:

```typescript
// Example fix for Kom i gang — these already match
{ title: "Opprett konto", href: "/docs/kom-i-gang#opprett-konto" }, // OK

// Example fix for Onboarding — mismatches
// OLD: { title: "Onboarding-flyten", href: "/docs/onboarding#onboarding-flyten" }
// NEW:
{ title: "Tre onboarding-systemer", href: "/docs/onboarding#tre-systemer" },
{ title: "Trainee-modus", href: "/docs/onboarding#trainee-modus" },
{ title: "Modulreiser", href: "/docs/onboarding#modulreiser" },
{ title: "Readiness Score", href: "/docs/onboarding#readiness" },
```

Do this for ALL 10 sections. Match every anchor to a real heading ID in the page.

**Step 3: Verify anchors work**

Navigate to each anchor link in the sidebar. Expected: Page scrolls to correct heading.

**Step 4: Commit**

```bash
git add apps/landing/src/app/docs/_data/navigation.ts
git commit -m "fix(docs): align navigation anchors with actual page heading IDs"
```

---

## Task 5: Fix API Page Layout Integration

The API page currently breaks out of the docs layout with `fixed inset-0 z-50`. It renders its own full-screen layout with `ApiSidebar`. This needs to either:

- (A) Integrate into the docs layout properly, or
- (B) Be explicitly excluded from the docs layout

**Files:**

- Read: `apps/landing/src/app/docs/api/page.tsx`
- Read: `apps/landing/src/app/docs/_components/api-sidebar.tsx`
- Possibly modify: `apps/landing/src/app/docs/api/layout.tsx` (create if needed)

**Step 1: Assess the API page's layout override**

The API page uses `fixed inset-0 z-50` which overlays the entire viewport, effectively hiding the docs sidebar. This is intentional — the API reference has its own two-column layout with code panels.

**Step 2: Create API-specific layout**

Create `apps/landing/src/app/docs/api/layout.tsx` that suppresses the parent docs layout's sidebar for this route:

```tsx
// Option A: Override with own layout that hides parent content
export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

Since the API page already renders `fixed inset-0 z-50`, it covers the docs layout. This works but is hacky. A cleaner approach:

**Step 3: Move API docs outside the docs layout**

If the API page is too different from the rest of the docs:

- Move `apps/landing/src/app/docs/api/` to `apps/landing/src/app/api-docs/`
- Update all links from `/docs/api` to `/api-docs`
- Update navigation.ts and overview page

OR: Accept the `fixed inset-0` approach as intentional since the API page IS a different experience.

**Decision needed from Pontus:** Keep API page at `/docs/api` with the overlay approach, or move it to its own route?

For now: Keep at `/docs/api`, accept the overlay. Document this as intentional.

**Step 4: Verify API page renders correctly**

Navigate to `/docs/api`. Expected: Full-screen API reference with own sidebar, not clipped by docs layout.

**Step 5: Commit (if changes made)**

```bash
git add apps/landing/src/app/docs/api/
git commit -m "feat(docs): handle API reference layout override"
```

---

## Task 6: Write Norwegian Markdown Content for Search Index

The docs agent (`DocsAgentPanel`) uses `searchUserManual()` from `user-manual.ts` which reads `docs/User Manual/*.md`. These files need proper Norwegian content matching the TSX pages so the AI agent can answer questions accurately.

**Files:**

- Modify: `docs/User Manual/02-vaktplan.md` through `docs/User Manual/10-*.md`
- Read: Each corresponding `page.tsx` for content source

**Step 1: Write `02-vaktplan.md`**

Convert the TSX content from `apps/landing/src/app/docs/vaktplan/page.tsx` to markdown. Strip JSX, keep the structure and text.

```markdown
# Vaktplan og bemanning

Vaktplanlegging i SmartOut kobler sammen bemanning, kompetanse, arbeidsrett og økonomi — og gir ledere sanntidsoversikt fra tre perspektiver.

## Tre visningsmodi

Vaktplanen kan vises på tre måter...
[full content matching the TSX page]
```

**Step 2: Write `03-oppgaver-rutiner.md`**

Merge content from `03-uppgaver.md` and `04-rutiner.md` into one file matching the combined `oppgaver-rutiner/page.tsx`. Rename to `03-oppgaver-rutiner.md`.

**Step 3: Write `04-haccp.md`**

Convert `haccp/page.tsx` content to markdown. Rename from `09-haccp-mat-syn.md` to follow consistent naming.

**Step 4: Write `05-kommunikasjon.md`**

Convert `kommunikasjon/page.tsx` content.

**Step 5: Write `06-ai-assistent.md`**

Convert `ai-assistent/page.tsx` content.

**Step 6: Write `07-rapporter.md`**

Convert `rapporter/page.tsx` content.

**Step 7: Write `08-ansatte.md`**

Convert `ansatte/page.tsx` content.

**Step 8: Write `09-onboarding.md`**

Rename `07-on-boarding.md`. Convert `onboarding/page.tsx` content.

**Step 9: Write `10-innstillinger.md`**

Convert `innstillinger/page.tsx` content.

**Step 10: Reorganize file numbering**

Ensure file names follow the same order as navigation.ts:

```
01-kom-i-gang.md          → Kom i gang (already complete)
02-onboarding.md          → Onboarding
03-vaktplan.md            → Vaktplan
04-ansatte.md             → Ansatte
05-oppgaver-rutiner.md    → Oppgaver og rutiner
06-haccp.md               → HACCP
07-kommunikasjon.md       → Kommunikasjon
08-ai-assistent.md        → Lise AI
09-rapporter.md           → Rapporter
10-innstillinger.md       → Innstillinger
```

Delete old Swedish-named files (`03-uppgaver.md`, `04-rutiner.md`, `05-kommunikation.md`, `06-rapporter.md`, `07-on-boarding.md`, `08-ansatta.md`, `09-haccp-mat-syn.md`, `10-lisa-ai-assistent-och-installningar.md`).

**Step 11: Update INDEX.md to reflect new file names**

**Step 12: Verify search works**

Start dev server, open `/docs`, use the AI agent panel to ask a question.
Expected: Agent returns relevant answers from the Norwegian markdown content.

**Step 13: Commit**

```bash
git add "docs/User Manual/"
git commit -m "feat(docs): write full Norwegian content for all user manual modules"
```

---

## Task 7: Commit All Untracked Docs Files

Stage and commit all the previously untracked docs components, pages, and data files.

**Files:**

- All untracked files in `apps/landing/src/app/docs/`

**Step 1: Review untracked files**

```bash
git status apps/landing/src/app/docs/
```

**Step 2: Stage all docs files**

```bash
git add apps/landing/src/app/docs/_components/docs-footer-links.tsx
git add apps/landing/src/app/docs/_components/api-sidebar.tsx
git add apps/landing/src/app/docs/_data/
git add apps/landing/src/app/docs/kom-i-gang/
git add apps/landing/src/app/docs/onboarding/
git add apps/landing/src/app/docs/vaktplan/
git add apps/landing/src/app/docs/ansatte/
git add apps/landing/src/app/docs/oppgaver-rutiner/
git add apps/landing/src/app/docs/haccp/
git add apps/landing/src/app/docs/kommunikasjon/
git add apps/landing/src/app/docs/ai-assistent/
git add apps/landing/src/app/docs/rapporter/
git add apps/landing/src/app/docs/innstillinger/
git add apps/landing/src/app/docs/api/
```

**Step 3: Stage modified files**

```bash
git add apps/landing/src/app/docs/_components/markdown-renderer.tsx
git add apps/landing/src/app/docs/layout.tsx
git add apps/landing/src/app/docs/page.tsx
```

**Step 4: Commit**

```bash
git commit -m "feat(docs): add complete documentation section with 10 modules + API reference"
```

---

## Task 8: Build Verification and Polish

**Step 1: Run full build**

```bash
pnpm --filter landing build
```

Expected: Build succeeds with no errors.

**Step 2: Test all routes**

Navigate to each page and verify content renders correctly:

- `/docs` — Hub page with module cards
- `/docs/kom-i-gang` — Getting started guide
- `/docs/onboarding` — Onboarding docs
- `/docs/vaktplan` — Shift planning
- `/docs/ansatte` — Staff management
- `/docs/oppgaver-rutiner` — Tasks & routines
- `/docs/haccp` — HACCP compliance
- `/docs/kommunikasjon` — Communication
- `/docs/ai-assistent` — AI assistant
- `/docs/rapporter` — Reports
- `/docs/innstillinger` — Settings
- `/docs/api` — API reference

**Step 3: Test sidebar navigation**

- Sections expand/collapse correctly
- Active section is highlighted
- Sub-item #anchor links scroll to correct headings
- Search filters sections
- Mobile sidebar opens/closes

**Step 4: Test prev/next navigation**

Each page should have correct prev/next links matching the navigation order.

**Step 5: Test breadcrumbs**

Breadcrumbs should show correct path for each page.

**Step 6: Final commit**

```bash
git commit -m "chore(docs): polish and verify all documentation pages"
```

---

## Task Order and Dependencies

```
Task 1 (Sidebar) ──→ Task 2 (Layout) ──→ Task 3 (Remove [slug])
                                              │
Task 4 (Anchor audit) ────────────────────────┤
                                              │
Task 5 (API page) ───────────────────────────┤
                                              │
Task 6 (Markdown content) ───────────────────┤
                                              ↓
                                    Task 7 (Commit all)
                                              ↓
                                    Task 8 (Build + verify)
```

Tasks 1→2→3 are sequential (sidebar needs to work before layout update, layout update before removing [slug]).

Tasks 4, 5, and 6 are independent of each other and can run in parallel after Task 3.

Task 7 depends on all prior tasks.

Task 8 is the final verification.

---

## Risk Notes

| Risk                                                    | Mitigation                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| API page's `fixed inset-0` overlay hides docs layout    | Intentional design — API ref is a separate experience             |
| `user-manual.ts` still imported by docs agent API route | Keep the file, just stop using it for sidebar nav                 |
| Markdown files out of sync with TSX pages               | Single conversion task, then markdown serves only as search index |
| `scroll-mt-24` on headings may not match sidebar height | Test anchor scrolling and adjust if needed                        |
