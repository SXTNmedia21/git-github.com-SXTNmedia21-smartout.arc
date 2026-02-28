---
title: "Documentation System — Landing App Expansion Plan"
id: PLAN_NEXTRA
version: "1.1"
status: draft
layer: plan
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags:
  - plan
  - documentation
  - nextra
  - landing
  - docs-system
tables: []
changelog:
  - date: 2026-02-28
    change: "Status → draft. This plan targets apps/landing/ docs expansion. A separate Nextra v4 app was scaffolded at apps/docs/ (ADR-0025). The two approaches coexist: apps/landing/docs/ has existing hardcoded doc pages, apps/docs/ is the new Nextra-powered public docs site. This plan needs revision to decide which approach wins for public documentation."
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout Documentation System — Landing App Expansion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the existing documentation system in `apps/landing/` with audience-based sections (admin/user/api), content lifecycle tracking (draft → verified → production), user stories as quality gates, and a promotion pipeline — all while keeping the existing visual style and component library intact.

**Architecture:** The landing app already has a complete docs infrastructure: sidebar with search, semantic component library (DocsArticle, Heading, Step, InfoBox, FeatureCard), breadcrumbs, prev/next navigation, markdown renderer, API reference page, and AI docs agent. We expand this with section grouping, content status tracking, and a promotion script. No new apps created.

**Tech Stack:** Next.js 16 (App Router), TSX with semantic docs components, Tailwind CSS v4, existing landing design system

**Reference Architecture:** `docs/architecture/SMARTOUT_docs_NEXTRA_architecture.md` (updated to reflect landing-first approach)

---

## What Already Exists (DO NOT REBUILD)

| Component                | File(s)                                       | Notes                                                                |
| ------------------------ | --------------------------------------------- | -------------------------------------------------------------------- |
| 10 module doc pages      | `apps/landing/src/app/docs/{module}/page.tsx` | Hardcoded JSX, Norwegian                                             |
| DocsArticle + components | `docs/_components/docs-article.tsx`           | Heading, SubHeading, Paragraph, Step, StepList, InfoBox, FeatureCard |
| Sidebar with search      | `docs/_components/docs-sidebar.tsx`           | Client component, mobile responsive                                  |
| Breadcrumbs              | `docs/_components/docs-breadcrumb.tsx`        | Auto-generates from pathname                                         |
| Markdown renderer        | `docs/_components/markdown-renderer.tsx`      | react-markdown + remark-gfm                                          |
| Dynamic slug route       | `docs/[slug]/page.tsx`                        | Currently shadowed by hardcoded pages                                |
| API reference            | `docs/api/page.tsx`                           | Extensive (50KB), has own sidebar                                    |
| API sidebar              | `docs/_components/api-sidebar.tsx`            | Section-grouped navigation                                           |
| Navigation data          | `docs/_data/navigation.ts`                    | 10 sections with sub-items                                           |
| AI docs agent            | `docs/_components/docs-agent-panel.tsx`       | Chat panel on docs overview                                          |
| Docs footer links        | `docs/_components/docs-footer-links.tsx`      | Related links at page bottom                                         |
| Docs nav (alternative)   | `docs/_components/docs-nav.tsx`               | Icon-based nav variant                                               |
| User Manual markdown     | `docs/User Manual/*.md` (20 files)            | Unused — Norwegian + Swedish                                         |
| user-manual.ts lib       | `apps/landing/src/lib/user-manual.ts`         | File scanner, slugifier, search                                      |

---

## Execution Model: Agent Teams

| Team                             | Scope                                             | Dependencies              |
| -------------------------------- | ------------------------------------------------- | ------------------------- |
| **Team A: Sidebar & Navigation** | Audience-grouped sidebar, section routing         | None — starts immediately |
| **Team B: Content Expansion**    | New admin/user pages, content status metadata     | Team A (needs sections)   |
| **Team C: Quality Pipeline**     | User stories, promotion script, content lifecycle | Team A + Team B           |

```
Phase 1:  Team A (Sidebar & Navigation)   ← can start immediately
Phase 2:  Team B (Content Expansion)       ← after Team A completes
Phase 3:  Team C (Quality Pipeline)        ← after Team B completes
Phase 4:  Integration test + CLAUDE.md     ← all teams done
```

---

## Team A: Sidebar & Navigation

### Task A.1: Refactor navigation data for audience sections

**Files:**

- Modify: `apps/landing/src/app/docs/_data/navigation.ts`

**Context:** The current navigation is a flat array of `DocSection[]`. We need to group items by audience: Admin (restauranteiere/ledere), Ansatt (alle ansatte), API (utviklere). The existing 10 modules map to audiences like this:

| Current Module      | Audience | Reason                          |
| ------------------- | -------- | ------------------------------- |
| Kom i gang          | Admin    | Setup guide for owners          |
| Onboarding          | Admin    | Configuring employee onboarding |
| Vaktplan            | Admin    | Shift planning is admin task    |
| Ansatte             | Admin    | Staff management                |
| Oppgaver og Rutiner | Admin    | Operations management           |
| HACCP               | Admin    | Compliance setup                |
| Kommunikasjon       | Admin    | Communication config            |
| Lise AI Assistent   | Both     | Admin configures, employees use |
| Rapporter           | Admin    | Analytics and KPIs              |
| Innstillinger       | Admin    | System settings                 |

**Step 1: Add audience grouping to navigation types**

In `apps/landing/src/app/docs/_data/navigation.ts`, update the types and data:

```typescript
import {
  Rocket,
  UserPlus,
  CalendarDays,
  Users,
  ClipboardCheck,
  ShieldCheck,
  MessageSquare,
  Bot,
  BarChart3,
  Settings,
  BookOpen,
  Briefcase,
  GraduationCap,
  Clock,
  ListChecks,
  Shield,
  Code,
  type LucideIcon,
} from "lucide-react";

export type DocAudience = "admin" | "ansatt" | "api";

export type DocSection = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  items: DocItem[];
};

export type DocItem = {
  title: string;
  href: string;
};

export type DocAudienceGroup = {
  audience: DocAudience;
  label: string;
  icon: LucideIcon;
  description: string;
  sections: DocSection[];
};

export const docsAudiences: DocAudienceGroup[] = [
  {
    audience: "admin",
    label: "Administrasjon",
    icon: Briefcase,
    description: "For restauranteiere og ledere",
    sections: [
      // existing sections: kom-i-gang, onboarding, vaktplan, ansatte,
      // oppgaver-rutiner, haccp, kommunikasjon, rapporter, innstillinger
      // (move existing docsNavigation items here)
    ],
  },
  {
    audience: "ansatt",
    label: "Ansatt",
    icon: GraduationCap,
    description: "For alle ansatte",
    sections: [
      // New sections for employees:
      // min-foerste-dag, mine-vakter, min-opplaering, daglige-oppgaver, mattrygghet, meldinger
    ],
  },
  {
    audience: "api",
    label: "API",
    icon: Code,
    description: "For utviklere og integrasjonspartnere",
    sections: [
      // Existing API reference page + future endpoints
    ],
  },
];

// Keep flat export for backward compatibility with sidebar
export const docsNavigation: DocSection[] = docsAudiences.flatMap((g) => g.sections);
```

**Step 2: Move all existing sections into the admin group**

Take the existing 10 `DocSection` objects from the current `docsNavigation` array and place them inside `docsAudiences[0].sections` (admin group). Keep the exact same data — just nest it.

**Step 3: Verify no regressions**

Run: `pnpm --filter landing dev`
Expected: Docs overview page still works, sidebar still renders all items.

**Step 4: Commit**

```bash
git add apps/landing/src/app/docs/_data/navigation.ts
git commit -m "refactor(docs): group navigation by audience (admin/ansatt/api)"
```

---

### Task A.2: Update sidebar to show audience groups

**Files:**

- Modify: `apps/landing/src/app/docs/_components/docs-sidebar.tsx`
- Modify: `apps/landing/src/app/docs/layout.tsx`

**Context:** The sidebar currently receives a flat `DocsNavItem[]`. We need it to display grouped sections with audience headers (Administrasjon, Ansatt, API) while keeping search functional across all groups.

**Step 1: Update sidebar to accept grouped navigation**

Modify `DocsSidebar` to accept `DocAudienceGroup[]` instead of (or in addition to) the flat list. Add collapsible group headers with the audience icon and label.

```tsx
// Key changes to docs-sidebar.tsx:

import { docsAudiences, type DocAudienceGroup, type DocSection } from "../_data/navigation";

export function DocsSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Flatten for search
  const allSections = docsAudiences.flatMap((g) => g.sections);
  const filteredSections = searchQuery
    ? allSections.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null; // null = show grouped view

  // ... render logic:
  // If searchQuery is set: show flat filtered results (current behavior)
  // If no search: show grouped by audience with headers
}
```

Each audience group renders as:

```
───────────────────
ADMINISTRASJON        ← uppercase label, xs text, zinc-600
───────────────────
  📦 Kom i gang       ← existing nav item style
  📦 Onboarding
  📦 Vaktplan
  ...

───────────────────
ANSATT
───────────────────
  📦 Min første dag
  ...
```

Use this styling for group headers:

```tsx
<div className="mt-6 mb-2 px-3">
  <div className="flex items-center gap-2">
    <GroupIcon className="h-3.5 w-3.5 text-zinc-600" />
    <span className="text-xs font-bold tracking-wider text-zinc-600 uppercase">{group.label}</span>
  </div>
</div>
```

**Step 2: Update layout.tsx to not pass navigation prop**

The sidebar now imports `docsAudiences` directly instead of receiving it as a prop. Update `layout.tsx`:

```tsx
// apps/landing/src/app/docs/layout.tsx
import type { Metadata } from "next";
import { DocsSidebar } from "./_components/docs-sidebar";

export const metadata: Metadata = {
  title: "Dokumentasjon – SmartOut",
  description: "Brukerveiledning og dokumentasjon for SmartOut.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#050505] text-white">
      <DocsSidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 lg:px-12 lg:py-16">{children}</div>
      </main>
    </div>
  );
}
```

**Step 3: Verify grouped sidebar works**

Run: `pnpm --filter landing dev`
Navigate to: http://localhost:3055/docs
Expected: Sidebar shows "ADMINISTRASJON" header above existing 10 items. Search still filters across all groups.

**Step 4: Commit**

```bash
git add apps/landing/src/app/docs/_components/docs-sidebar.tsx apps/landing/src/app/docs/layout.tsx
git commit -m "feat(docs): audience-grouped sidebar with collapsible sections"
```

---

### Task A.3: Update docs overview page with audience sections

**Files:**

- Modify: `apps/landing/src/app/docs/page.tsx`

**Context:** The overview page currently shows a flat list of 10 modules. Update it to show three audience cards at the top, then the module grid grouped by audience.

**Step 1: Add audience selector cards**

Add three prominent cards at the top of the docs overview (before the modules grid):

```tsx
// New audience cards section (above existing features grid)
<div className="mb-12 grid gap-4 md:grid-cols-3">
  {docsAudiences.map((group) => (
    <Link
      key={group.audience}
      href={`/docs#${group.audience}`}
      className="group rounded-xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-orange-500/20 hover:bg-orange-500/5"
    >
      <group.icon className="mb-3 h-6 w-6 text-zinc-500 group-hover:text-orange-400" />
      <h3 className="text-sm font-bold text-white">{group.label}</h3>
      <p className="mt-1 text-xs text-zinc-500">{group.description}</p>
      <span className="mt-2 block text-xs text-zinc-600">{group.sections.length} moduler</span>
    </Link>
  ))}
</div>
```

**Step 2: Group the module list by audience**

Instead of one flat `features` array, iterate over `docsAudiences` and render each group with a section header + anchor:

```tsx
{docsAudiences.map((group) => (
  <section key={group.audience} id={group.audience} className="mb-12">
    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
      <group.icon className="h-5 w-5 text-zinc-500" />
      {group.label}
    </h2>
    <div className="space-y-0">
      {group.sections.map((section) => (
        // ... existing feature link row
      ))}
    </div>
  </section>
))}
```

**Step 3: Verify overview renders correctly**

Run: `pnpm --filter landing dev`
Navigate to: http://localhost:3055/docs
Expected: Three audience cards at top. Modules grouped under audience headers below.

**Step 4: Commit**

```bash
git add apps/landing/src/app/docs/page.tsx
git commit -m "feat(docs): audience-grouped overview with section cards"
```

---

## Team B: Content Expansion

> **Depends on:** Team A must be complete (audience groups in sidebar and overview).

### Task B.1: Create employee (ansatt) documentation pages

**Files:**

- Create: `apps/landing/src/app/docs/min-foerste-dag/page.tsx`
- Create: `apps/landing/src/app/docs/mine-vakter/page.tsx`
- Create: `apps/landing/src/app/docs/min-opplaering/page.tsx`
- Create: `apps/landing/src/app/docs/daglige-oppgaver/page.tsx`
- Create: `apps/landing/src/app/docs/mattrygghet/page.tsx`
- Create: `apps/landing/src/app/docs/meldinger/page.tsx`
- Modify: `apps/landing/src/app/docs/_data/navigation.ts` (add to ansatt group)

**Context:** The existing 10 doc pages are admin-focused. Employees need their own simpler guides written from their perspective. These pages use the same `DocsArticle` component library.

**Step 1: Add ansatt sections to navigation.ts**

Add these sections to the `ansatt` audience group:

```typescript
{
  audience: "ansatt",
  label: "Ansatt",
  icon: GraduationCap,
  description: "For alle ansatte",
  sections: [
    {
      title: "Min første dag",
      href: "/docs/min-foerste-dag",
      icon: Rocket,
      description: "Alt du trenger for å komme i gang som ny ansatt.",
      items: [
        { title: "Aksepter invitasjonen", href: "/docs/min-foerste-dag#invitasjon" },
        { title: "Opprett profil", href: "/docs/min-foerste-dag#profil" },
        { title: "Trainee-modus", href: "/docs/min-foerste-dag#trainee" },
      ],
    },
    {
      title: "Mine vakter",
      href: "/docs/mine-vakter",
      icon: Clock,
      description: "Se, bytte og stemple inn/ut av vaktene dine.",
      items: [
        { title: "Vaktkalender", href: "/docs/mine-vakter#kalender" },
        { title: "Stemple inn/ut", href: "/docs/mine-vakter#stempling" },
        { title: "Bytte vakt", href: "/docs/mine-vakter#bytte" },
      ],
    },
    {
      title: "Min opplæring",
      href: "/docs/min-opplaering",
      icon: GraduationCap,
      description: "Fullfør opplæringen og nå 100% klarhet.",
      items: [
        { title: "Opplæringsstatus", href: "/docs/min-opplaering#status" },
        { title: "Prosedyrer", href: "/docs/min-opplaering#prosedyrer" },
        { title: "Kunnskapstest", href: "/docs/min-opplaering#test" },
      ],
    },
    {
      title: "Daglige oppgaver",
      href: "/docs/daglige-oppgaver",
      icon: ListChecks,
      description: "Gjennomfør oppgavene dine og hold avdelingen i rute.",
      items: [
        { title: "Oppgavelisten", href: "/docs/daglige-oppgaver#liste" },
        { title: "Fullføre oppgaver", href: "/docs/daglige-oppgaver#fullfore" },
      ],
    },
    {
      title: "Mattrygghet",
      href: "/docs/mattrygghet",
      icon: Shield,
      description: "HACCP-kontroller og temperaturlogging.",
      items: [
        { title: "Temperaturmåling", href: "/docs/mattrygghet#temperatur" },
        { title: "Avvikshåndtering", href: "/docs/mattrygghet#avvik" },
      ],
    },
    {
      title: "Meldinger",
      href: "/docs/meldinger",
      icon: MessageSquare,
      description: "Send og motta meldinger fra teamet ditt.",
      items: [
        { title: "Sende melding", href: "/docs/meldinger#sende" },
        { title: "Varsler", href: "/docs/meldinger#varsler" },
      ],
    },
  ],
},
```

**Step 2: Create min-foerste-dag/page.tsx**

Use the same component patterns as existing pages (DocsArticle, Heading, Step, InfoBox):

```tsx
import { Rocket } from "lucide-react";
import {
  DocsArticle,
  Heading,
  Paragraph,
  Step,
  StepList,
  InfoBox,
} from "../_components/docs-article";

export default function MinFoersteDagPage() {
  return (
    <DocsArticle next={{ title: "Mine vakter", href: "/docs/mine-vakter" }}>
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <Rocket className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            Min første dag
          </h1>
        </div>
        <Paragraph>
          Velkommen til SmartOut! Denne guiden tar deg gjennom alt du trenger for å komme i gang som
          ny ansatt.
        </Paragraph>
      </div>

      <Heading id="invitasjon">1. Aksepter invitasjonen</Heading>
      <Paragraph>
        Du har mottatt en invitasjon fra arbeidsgiveren din via e-post eller SMS. Klikk på lenken
        for å komme i gang.
      </Paragraph>
      <StepList>
        <Step number={1} title="Åpne invitasjonslenken">
          Klikk på lenken i e-posten eller SMS-en du mottok.
        </Step>
        <Step number={2} title="Opprett passord">
          Velg et sikkert passord, eller logg inn med Google/Microsoft.
        </Step>
      </StepList>

      <Heading id="profil">2. Opprett profil</Heading>
      <Paragraph>
        Fyll inn navn, telefonnummer, og last opp et profilbilde. Din leder har allerede satt
        avdeling og stilling for deg.
      </Paragraph>

      <Heading id="trainee">3. Trainee-modus</Heading>
      <Paragraph>
        Du starter som trainee. Det betyr at du kan utforske hele systemet uten å påvirke ekte data.
        Det er helt trygt å prøve seg frem!
      </Paragraph>
      <InfoBox type="tip">
        Fullfør all opplæring for å gå fra trainee til aktiv ansatt. Sjekk opplæringsstatus under
        &laquo;Min opplæring&raquo;.
      </InfoBox>
    </DocsArticle>
  );
}
```

**Step 3: Create remaining employee pages**

Create each of the remaining 5 employee pages following the exact same pattern:

- `mine-vakter/page.tsx` — Shift calendar, clock in/out, swap shifts
- `min-opplaering/page.tsx` — Training status, procedures, knowledge tests
- `daglige-oppgaver/page.tsx` — Task list, completing tasks, notes
- `mattrygghet/page.tsx` — Temperature logging, deviation handling
- `meldinger/page.tsx` — Sending messages, notification preferences

Each page must:

- Import from `../_components/docs-article`
- Use `DocsArticle` wrapper with prev/next links
- Follow the same header pattern (icon badge + h1 title)
- Use `Heading`, `Paragraph`, `Step`, `InfoBox`, `FeatureCard` as needed
- Write content from the **employee perspective** (not admin)
- All content in Norwegian

**Step 4: Verify all employee pages render**

Run: `pnpm --filter landing dev`
Check each page:

- http://localhost:3055/docs/min-foerste-dag
- http://localhost:3055/docs/mine-vakter
- http://localhost:3055/docs/min-opplaering
- http://localhost:3055/docs/daglige-oppgaver
- http://localhost:3055/docs/mattrygghet
- http://localhost:3055/docs/meldinger

Expected: All render with correct styling, sidebar shows them under "ANSATT" group.

**Step 5: Commit**

```bash
git add apps/landing/src/app/docs/min-foerste-dag/ apps/landing/src/app/docs/mine-vakter/ \
  apps/landing/src/app/docs/min-opplaering/ apps/landing/src/app/docs/daglige-oppgaver/ \
  apps/landing/src/app/docs/mattrygghet/ apps/landing/src/app/docs/meldinger/ \
  apps/landing/src/app/docs/_data/navigation.ts
git commit -m "feat(docs): add 6 employee-facing documentation pages"
```

---

### Task B.2: Add API section to audience navigation

**Files:**

- Modify: `apps/landing/src/app/docs/_data/navigation.ts` (add API group)

**Context:** The API reference page already exists at `/docs/api` and is extensive (~50KB with endpoint documentation, code examples, and its own sidebar). We just need to add it to the audience navigation so it appears in the grouped sidebar.

**Step 1: Add API to navigation**

```typescript
{
  audience: "api",
  label: "API",
  icon: Code,
  description: "For utviklere og integrasjonspartnere",
  sections: [
    {
      title: "API-referanse",
      href: "/docs/api",
      icon: Code,
      description: "Endepunkter, autentisering, webhooks og rate limits.",
      items: [
        { title: "Autentisering", href: "/docs/api#auth" },
        { title: "Workspace", href: "/docs/api#workspace" },
        { title: "Profiler", href: "/docs/api#profiles" },
        { title: "Vakter", href: "/docs/api#shifts" },
        { title: "Webhooks", href: "/docs/api#webhooks" },
      ],
    },
  ],
},
```

**Step 2: Verify API appears in sidebar**

Run: `pnpm --filter landing dev`
Expected: Sidebar shows "API" group at bottom with API-referanse link.

**Step 3: Commit**

```bash
git add apps/landing/src/app/docs/_data/navigation.ts
git commit -m "feat(docs): add API section to audience-grouped navigation"
```

---

### Task B.3: Add Lise AI Assistent to both admin and ansatt

**Files:**

- Modify: `apps/landing/src/app/docs/_data/navigation.ts`

**Context:** The AI assistant documentation is relevant to both audiences. Add it to both groups (same href, but described differently per audience).

**Step 1: Add to admin group (existing)**

Already exists as `ai-assistent` in admin group. Verify it's there.

**Step 2: Add to ansatt group**

Add a section linking to the same page:

```typescript
{
  title: "Lise AI-assistent",
  href: "/docs/ai-assistent",
  icon: Bot,
  description: "Spør Lise om hva som helst — hun er din AI-kollega.",
  items: [
    { title: "Spør Lise", href: "/docs/ai-assistent#spor-lise" },
    { title: "Stemmeassistent", href: "/docs/ai-assistent#stemme" },
  ],
},
```

**Step 3: Commit**

```bash
git add apps/landing/src/app/docs/_data/navigation.ts
git commit -m "feat(docs): add AI assistant to both admin and employee navigation"
```

---

## Team C: Quality Pipeline

> **Depends on:** Team A + Team B must be complete.

### Task C.1: Add content status metadata to navigation

**Files:**

- Modify: `apps/landing/src/app/docs/_data/navigation.ts`

**Context:** Each documentation page needs a status field to track its lifecycle. Since our pages are JSX (not MDX with frontmatter), we track status in the navigation data structure.

**Step 1: Add status to DocSection type**

```typescript
export type DocStatus = "draft" | "implemented" | "verified" | "production";

export type DocSection = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  status: DocStatus; // NEW
  items: DocItem[];
};
```

**Step 2: Set status on all existing sections**

All existing admin pages: `status: "implemented"` (code exists, content written, not yet verified)
All new employee pages: `status: "draft"` (just created, needs review)
API reference: `status: "implemented"`

**Step 3: Optionally show status badge in sidebar**

Add a small colored dot next to each nav item indicating status:

```tsx
// In sidebar nav item
{
  section.status === "draft" && (
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Utkast" />
  );
}
{
  section.status === "verified" && (
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="Verifisert" />
  );
}
{
  section.status === "production" && (
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" title="Publisert" />
  );
}
```

**Step 4: Commit**

```bash
git add apps/landing/src/app/docs/_data/navigation.ts apps/landing/src/app/docs/_components/docs-sidebar.tsx
git commit -m "feat(docs): add content lifecycle status to navigation data"
```

---

### Task C.2: Create user story template and initial stories

**Files:**

- Create: `docs/user-stories/template.md`
- Create: `docs/user-stories/US-001-workspace-setup.md`
- Create: `docs/user-stories/US-002-employee-onboarding.md`

**Step 1: Create template**

```markdown
# US-NNN: [Feature Name]

## Story

**Som** [rolle]
**vil jeg** [handling]
**slik at** [verdi]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Docs som verifiseres

- `apps/landing/src/app/docs/{page}/page.tsx` → seksjon "{section}"

## Test-referanse

- TBD

## Status

- [ ] Spec skrevet
- [ ] Implementert
- [ ] Testet
- [ ] Docs-status satt til "verified"
```

**Step 2: Create US-001 and US-002**

Based on the architecture doc's user story format, adapted for JSX pages instead of MDX files.

**Step 3: Commit**

```bash
git add docs/user-stories/
git commit -m "feat(docs): add user story template and initial stories"
```

---

### Task C.3: Create status audit script

**Files:**

- Create: `scripts/docs-status.ts`
- Modify: `package.json` (root — add script)

**Context:** Since content is in JSX (not MDX with frontmatter), status tracking lives in `navigation.ts`. The audit script reads the navigation data and reports on content lifecycle status.

**Step 1: Create script**

```typescript
// scripts/docs-status.ts
//
// Reports on documentation content lifecycle status.
//
// Usage:
//   npx tsx scripts/docs-status.ts              → Show all statuses
//   npx tsx scripts/docs-status.ts --verified   → Show only verified pages

import { readFileSync } from "fs";
import { join } from "path";

// Read and evaluate the navigation data
// Since it's TypeScript with imports, we'll parse it more simply
const navPath = join(
  import.meta.dirname,
  "..",
  "apps",
  "landing",
  "src",
  "app",
  "docs",
  "_data",
  "navigation.ts",
);

const content = readFileSync(navPath, "utf-8");

// Extract status fields with regex (pragmatic approach for a script)
const statusMatches = [...content.matchAll(/title:\s*"([^"]+)"[\s\S]*?status:\s*"([^"]+)"/g)];

const args = process.argv.slice(2);
const filterStatus = args.find((a) => a.startsWith("--"))?.slice(2);

console.log("📄 Documentation Status Report\n");

const counts: Record<string, number> = { draft: 0, implemented: 0, verified: 0, production: 0 };

for (const [, title, status] of statusMatches) {
  counts[status] = (counts[status] || 0) + 1;
  if (!filterStatus || status === filterStatus) {
    const emoji =
      { draft: "📝", implemented: "🔨", verified: "✅", production: "🚀" }[status] || "❓";
    console.log(`  ${emoji} ${status.padEnd(12)} ${title}`);
  }
}

console.log("\n--- Summary ---");
console.log(`  Draft:       ${counts.draft}`);
console.log(`  Implemented: ${counts.implemented}`);
console.log(`  Verified:    ${counts.verified}`);
console.log(`  Production:  ${counts.production}`);
console.log(`  Total:       ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
```

**Step 2: Add root script**

```json
"docs:status": "npx tsx scripts/docs-status.ts"
```

**Step 3: Test**

Run: `pnpm docs:status`
Expected: Shows all docs with their status.

**Step 4: Commit**

```bash
git add scripts/docs-status.ts package.json
git commit -m "feat(docs): add documentation status audit script"
```

---

## Phase 4: Integration & Cleanup

### Task D.1: Update architecture document

**Files:**

- Modify: `docs/architecture/SMARTOUT_docs_NEXTRA_architecture.md`

**Step 1: Add a "Decision Update" section**

Add at the top, below the status:

```markdown
> **Architecture Decision Update (2026-02-28):** After deep diving the codebase,
> we decided AGAINST creating a separate Nextra app. The landing app (`apps/landing/`)
> already has a complete documentation system with sidebar, search, semantic components,
> breadcrumbs, AI agent, and 10 documented modules. We expanded this existing system
> with audience grouping and content lifecycle tracking instead. See ADR-0021.
```

**Step 2: Update the system map**

Replace the "packages/docs-content" and "apps/docs" references with the actual location in `apps/landing/src/app/docs/`.

**Step 3: Commit**

```bash
git add docs/architecture/SMARTOUT_docs_NEXTRA_architecture.md
git commit -m "docs: update architecture doc — landing-first approach over Nextra"
```

---

### Task D.2: Write ADR-0021 (updated)

**Files:**

- Create: `docs/decisions/0021-documentation-in-landing-app.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Step 1: Create ADR**

```markdown
---
id: "0021"
title: Documentation System in Landing App
status: Accepted
date: 2026-02-28
---

# ADR-0021: Documentation System in Landing App

## Context and Problem Statement

Smartout needs customer-facing documentation. The architecture doc proposed a separate Nextra app (`apps/docs/`). Investigation revealed the landing app already has a complete documentation system.

## Decision Drivers

- Landing app has 10 documented modules with custom component library
- Sidebar, search, breadcrumbs, prev/next navigation already built
- AI docs agent panel already integrated
- API reference page (50KB) already complete
- Creating a separate app would duplicate all branding and navigation

## Considered Options

1. Separate Nextra app (architecture doc proposal)
2. Expand existing landing docs system (chosen)
3. Hybrid — both landing + separate Nextra

## Decision Outcome

Expand the existing documentation in `apps/landing/src/app/docs/`. Add audience grouping (admin/ansatt/api), content lifecycle status tracking, and user stories as quality gates.

## Rules & Consequences

- All customer docs live in `apps/landing/src/app/docs/`
- Navigation data in `_data/navigation.ts` with status tracking
- No separate Nextra app needed
- No `packages/docs-content/` package needed
- Internal module docs (`docs/modules/`) unchanged — AI context only
- Documentation deploys with the landing site (single Vercel project)
```

**Step 2: Add to decision log**

**Step 3: Commit**

```bash
git add docs/decisions/
git commit -m "docs: ADR-0021 — documentation system lives in landing app"
```

---

### Task D.3: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Update landing section**

Add to the existing route list under landing:

```
/docs                  → Documentation overview (audience-grouped)
/docs/kom-i-gang       → Getting started (admin)
/docs/onboarding       → Onboarding setup (admin)
/docs/vaktplan         → Shift planning (admin)
/docs/ansatte          → Staff management (admin)
/docs/oppgaver-rutiner → Operations (admin)
/docs/haccp            → HACCP compliance (admin)
/docs/kommunikasjon    → Communication (admin)
/docs/ai-assistent     → AI assistant (admin + ansatt)
/docs/rapporter        → Reports (admin)
/docs/innstillinger    → Settings (admin)
/docs/min-foerste-dag  → First day (ansatt)
/docs/mine-vakter      → My shifts (ansatt)
/docs/min-opplaering   → My training (ansatt)
/docs/daglige-oppgaver → Daily tasks (ansatt)
/docs/mattrygghet      → Food safety (ansatt)
/docs/meldinger        → Messages (ansatt)
/docs/api              → API reference
```

**Step 2: Add ADR-0021 to ADR table**

**Step 3: Add docs:status to dev commands**

```bash
# Check documentation lifecycle status
pnpm docs:status
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with expanded documentation routes and ADR-0021"
```

---

### Task D.4: Final verification

**Step 1: Full build**

Run: `pnpm --filter landing build`
Expected: Successful build with no errors.

**Step 2: Verify all pages render**

Run: `pnpm --filter landing dev`
Check these pages load:

- http://localhost:3055/docs → Overview with audience cards
- http://localhost:3055/docs/kom-i-gang → Admin: getting started
- http://localhost:3055/docs/min-foerste-dag → Employee: first day
- http://localhost:3055/docs/api → API reference
- Sidebar shows three audience groups

**Step 3: Run docs status**

Run: `pnpm docs:status`
Expected: Shows ~16 pages with status (10 implemented + 6 draft)

**Step 4: Typecheck**

Run: `pnpm --filter landing typecheck`
Expected: No errors.

---

## Summary

| Phase | Team                  | Tasks   | Key Output                                    |
| ----- | --------------------- | ------- | --------------------------------------------- |
| 1     | Team A: Sidebar & Nav | A.1–A.3 | Audience-grouped sidebar + overview           |
| 2     | Team B: Content       | B.1–B.3 | 6 employee pages, API + AI in all groups      |
| 3     | Team C: Pipeline      | C.1–C.3 | Status tracking, user stories, audit script   |
| 4     | Integration           | D.1–D.4 | ADR-0021, CLAUDE.md, architecture doc updated |

**No new apps created.** Everything stays in `apps/landing/`.

**Total new files:** ~10 (6 employee pages + user stories + script + ADR)
**Modified files:** ~5 (navigation.ts, sidebar, layout, overview, CLAUDE.md)
