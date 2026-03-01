---
title: "Documentation System Architecture (Nextra)"
id: NEXTRA_ARCH
version: "1.1"
status: superseded
layer: architecture
created: 2026-02-28
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: ADR_0030
depends_on:
  - CORE_ARCH_V2
  - SUBDOMAIN_ARCH
tags:
  - documentation
  - nextra
  - docs-site
tables: []
changelog:
  - date: 2026-02-28
    change: "Updated: apps/docs/ Nextra v4 scaffold now exists (ADR-0025). Internal docs restructured with YAML frontmatter + layered system. This architecture doc needs revision to match actual implementation."
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout — Documentation System Architecture

> **Status:** Superseded by ADR-0030 — documentation lives in `apps/landing/src/app/docs/`, not a separate Nextra app
> **Updated:** February 28, 2026
> **Depends on:** Core Architecture v2 (Monorepo structure), Subdomain Architecture (docs.smartout.ai)
> **Cross-reference:** `SMARTOUT_SUBDOMAIN_ARCHITECTURE.md`, ADR-0025

---

> **Note (2026-02-28):** The documentation system has been restructured (ADR-0025):
>
> - Internal docs (`docs/`) now have YAML frontmatter with layered discovery (INDEX.md, reference/, modules/, architecture/, archive/)
> - Public docs site scaffolded at `apps/docs/` using Nextra v4 (App Router, port 3060)
> - The `packages/docs-content/` approach described below was NOT implemented — evaluate whether apps/docs/ Nextra replaces it entirely
> - Existing `apps/landing/docs/` pages continue to serve hardcoded Norwegian documentation

---

## 1. Overview

Smartout's documentation system separates development specifications (C-data) from production-facing customer documentation. Production docs at `docs.smartout.ai` contain exclusively tested and verified content — nothing speculative, nothing planned. Development docs serve as the implementation roadmap for AI agents and developers.

### Core Principle

```
dev/   = What we WILL build    (C-data, specifications, roadmap)
prod/  = What we HAVE built    (verified, tested, deployed)
```

User stories are the bridge: they bind a specification in `dev/` to an implementation, tests, and — once verified — a promotion to `prod/`.

---

## 2. System Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERNAL (Developer)                           │
│                                                                  │
│  docs/                          Source of truth for AI agents     │
│  ├── architecture/              and developers. NOT published.    │
│  ├── modules/                   Referenced during implementation. │
│  └── decisions/                                                  │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Informs
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    packages/docs-content/                         │
│                                                                  │
│  dev/                           prod/                            │
│  ├── admin/*.mdx  (C-data)      ├── admin/*.mdx  (verified)     │
│  ├── user/*.mdx   (C-data)      ├── user/*.mdx   (verified)     │
│  └── api/*.mdx    (C-data)      └── api/*.mdx    (verified)     │
│                                                                  │
│  user-stories/                                                   │
│  └── US-NNN-*.md                                                 │
│      ├── Acceptance criteria                                     │
│      ├── References dev/ MDX files                               │
│      ├── References test files                                   │
│      └── Status: spec → implemented → tested → promoted          │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Promotion (verified only)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION (Customer)                          │
│                    docs.smartout.ai                               │
│                                                                  │
│  Renders ONLY packages/docs-content/prod/                        │
│  Three sections: /admin, /user, /api                             │
│  100% verified, tested, deployed functionality                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Content Architecture

### 3.1 Three Audiences

All documentation is categorized by audience. This determines both navigation structure and content tone.

| Section   | URL       | Audience                         | Content                                                                           |
| --------- | --------- | -------------------------------- | --------------------------------------------------------------------------------- |
| **Admin** | `/admin/` | Restaurant owners, managers      | Dashboard setup, workspace config, policy management, team management, scheduling |
| **User**  | `/user/`  | Employees (all skill levels)     | Getting started, profile, shifts, training, daily tasks                           |
| **API**   | `/api/`   | Integration partners, developers | Endpoint reference, authentication, webhooks, rate limits                         |

### 3.2 Content States

Every MDX file carries a `status` field in its frontmatter:

```
draft         → Specification written, not yet implemented
implemented   → Code exists, not yet tested
verified      → All tests pass, QA approved
production    → Promoted to prod/, live on docs.smartout.ai
```

Only files with status `verified` can be promoted. The promotion script changes status to `production` and copies the file to `prod/`.

### 3.3 Frontmatter Schema

```yaml
---
title: Workspace-oppsett # Required
description: Opprett og konfigurer din workspace # Required
status: implemented # draft | implemented | verified | production
user_stories: ["US-001", "US-012"] # References to user story files
updated: 2026-02-28 # Last content update
promoted_at: null # Set by promotion script
---
```

---

## 4. User Stories

### 4.1 Purpose

User stories are the quality gate between specification and production documentation. They bind three things together:

```
User Story (US-001)
    │
    ├── References: dev/admin/workspace-setup.mdx  (what it documents)
    ├── References: workspace-creation.spec.ts      (what tests it)
    └── Status: tracks the full lifecycle
```

### 4.2 Format

```markdown
# US-NNN: [Feature Name]

## Story

**Som** [rolle]
**vil jeg** [handling]
**slik at** [verdi]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] ...

## Docs som verifiseres

- `dev/admin/workspace-setup.mdx` → seksjon "Opprett workspace"
- `dev/api/workspaces.mdx` → POST /workspaces

## Test-referanse

- `apps/web/tests/e2e/workspace-creation.spec.ts`
- `supabase/tests/workspace-slug.test.sql`

## Status

- [ ] Spec skrevet
- [ ] Implementert
- [ ] Testet
- [ ] Promotert til prod/
```

### 4.3 Lifecycle

```
1. SPEC        → Write MDX in dev/, create user story file
2. IMPLEMENT   → Build feature per BUILD_ORDER.md
3. TEST        → Write E2E tests, reference in user story
4. VERIFY      → All criteria checked, tests green, set status: verified
5. PROMOTE     → Run promotion script → MDX copied to prod/
```

---

## 5. Technology: Nextra

### 5.1 Why Nextra

Nextra is a Next.js-based documentation framework. It runs inside the monorepo as a standard Next.js app, requires no external platform, and supports MDX with React components.

| Requirement            | Nextra                  | External (Mintlify/GitBook) |
| ---------------------- | ----------------------- | --------------------------- |
| Cost                   | Free (OSS)              | $150+/month                 |
| Hosting                | Vercel (already used)   | Third-party                 |
| Customization          | Full (it's Next.js)     | Limited                     |
| Monorepo integration   | Native (pnpm workspace) | Separate repo               |
| MDX + React components | Yes                     | Varies                      |
| External dependency    | None                    | Vendor lock-in              |
| Norwegian i18n         | Built-in                | Varies                      |

### 5.2 App Structure

```
apps/docs/
├── next.config.mjs          → Nextra configuration
├── theme.config.tsx          → Branding, navigation, i18n
├── pages/                    → Symlinked or copied from packages/docs-content/prod/
│   ├── admin/
│   ├── user/
│   └── api/
├── package.json
└── tsconfig.json
```

### 5.3 Dev vs Prod Build

```
NODE_ENV=development  → Nextra serves from packages/docs-content/dev/ + prod/
NODE_ENV=production   → Nextra serves ONLY from packages/docs-content/prod/
```

This means developers see all documentation (including unverified specs) locally, while customers only see verified content.

---

## 6. Content Migration

### 6.1 Source Mapping

Existing internal module documentation maps to customer-facing MDX files:

| Internal Doc                 | → Admin MDX                                        | → User MDX            | → API MDX                      |
| ---------------------------- | -------------------------------------------------- | --------------------- | ------------------------------ |
| `MODULE_01_ONBOARDING.md`    | `workspace-setup.mdx`                              | `getting-started.mdx` | `authentication.mdx`           |
| `MODULE_02_ORG_STRUCTURE.md` | `department-management.mdx`, `team-management.mdx` | —                     | `departments.mdx`, `teams.mdx` |
| `MODULE_03_SCHEDULING.md`    | `scheduling.mdx`                                   | `my-shifts.mdx`       | `shifts.mdx`                   |
| `MODULE_04_OPERATIONS.md`    | `operations.mdx`                                   | `daily-tasks.mdx`     | `sessions.mdx`                 |
| `MODULE_05_HACCP.md`         | `haccp-setup.mdx`                                  | `food-safety.mdx`     | `haccp.mdx`                    |
| `MODULE_06_TRAINING.md`      | `training-setup.mdx`                               | `training.mdx`        | `training.mdx`                 |
| `MODULE_09_COMMUNICATION.md` | `communication.mdx`                                | `messages.mdx`        | `messaging.mdx`                |

### 6.2 Migration Rules

- Internal docs (`docs/modules/`) remain unchanged — they are the source of truth for AI agents
- MDX files in `dev/` are rewritten for the target audience (admin, user, or API consumer)
- MDX files use Nextra components (`Callout`, `Steps`, `Tabs`, `Cards`) for rich presentation
- All new MDX files start with status `draft` until implementation exists

---

## 7. Promotion Pipeline

### 7.1 Script: `promote-docs.ts`

```
pnpm promote-docs US-001              → Promote docs for specific user story
pnpm promote-docs --all-verified      → Promote all verified docs
pnpm promote-docs --dry-run           → Preview without changes
```

**Logic:**

1. Find MDX files referenced by the user story
2. Check each file has `status: verified` in frontmatter
3. Copy from `dev/` → `prod/`
4. Update status to `production`, add `promoted_at` timestamp
5. Preserve directory structure

### 7.2 CI/CD

```
Push to main with changes in packages/docs-content/dev/
    │
    ▼
GitHub Action: promote-docs.yml
    ├── Check for MDX files with status: verified
    ├── Run promotion script
    ├── Commit promoted files to prod/
    └── Push → triggers Vercel deploy for docs.smartout.ai
```

### 7.3 Safety Guarantees

| Guard                         | Mechanism                                            |
| ----------------------------- | ---------------------------------------------------- |
| No unverified content in prod | Script checks `status: verified` before copy         |
| No orphaned docs              | User stories reference both MDX files and test files |
| No regression                 | Tests must pass before status can be set to verified |
| Audit trail                   | `promoted_at` timestamp + git history                |

---

## 8. Monorepo Impact

### 8.1 New Packages

| Package                  | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `apps/docs/`             | Nextra docs app, deployed to docs.smartout.ai      |
| `packages/docs-content/` | Shared MDX content, user stories, promotion config |

### 8.2 Files Added

| File                                      | Purpose                    |
| ----------------------------------------- | -------------------------- |
| `apps/docs/next.config.mjs`               | Nextra configuration       |
| `apps/docs/theme.config.tsx`              | Branding, nav, i18n        |
| `apps/docs/package.json`                  | Dependencies               |
| `packages/docs-content/dev/**/*.mdx`      | Development specifications |
| `packages/docs-content/prod/**/*.mdx`     | Production documentation   |
| `packages/docs-content/user-stories/*.md` | User story files           |
| `scripts/promote-docs.ts`                 | Promotion script           |
| `.github/workflows/promote-docs.yml`      | CI/CD for promotion        |

### 8.3 Files Modified

| File                  | Change                                   |
| --------------------- | ---------------------------------------- |
| `turbo.json`          | Add `docs#dev`, `docs#build` targets     |
| `pnpm-workspace.yaml` | Add `apps/docs`, `packages/docs-content` |
| `CLAUDE.md`           | Add docs conventions, user story format  |
| `BUILD_ORDER.md`      | Add Phase 0.12 (docs system)             |

---

## 9. Agent Team Dispatch

Three agent teams execute this architecture.

### Team 5: Docs Infrastructure

|                |                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **Scope**      | Create Nextra app, docs-content package, Turborepo integration, Vercel deploy                    |
| **Files**      | `apps/docs/*`, `packages/docs-content/package.json`, `turbo.json`, `pnpm-workspace.yaml`         |
| **Depends on** | Nothing — can start immediately                                                                  |
| **Criteria**   | `pnpm dev --filter docs` works; prod build shows only prod/ content; deploys to docs.smartout.ai |

### Team 6: Docs Content

|                |                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Scope**      | Migrate module docs to MDX, write user stories, categorize by audience                                               |
| **Files**      | `packages/docs-content/dev/**/*.mdx`, `packages/docs-content/user-stories/*.md`                                      |
| **Depends on** | Team 5 (needs Nextra app to preview)                                                                                 |
| **Criteria**   | All modules have corresponding MDX; frontmatter correct; user stories exist for implemented features; prod/ is empty |

### Team 7: Promotion Pipeline

|                |                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Scope**      | Promotion script, GitHub Action, deploy hooks                                                                       |
| **Files**      | `scripts/promote-docs.ts`, `.github/workflows/promote-docs.yml`, `package.json`                                     |
| **Depends on** | Team 5 + Team 6 (needs content to promote)                                                                          |
| **Criteria**   | Script promotes only verified docs; non-verified blocked; GitHub Action runs on push; docs.smartout.ai auto-updates |

### Execution Order

```
Phase 1:  Team 5 (Docs Infrastructure)
Phase 2:  Team 6 (Docs Content)          ← after Nextra is running
Phase 3:  Team 7 (Promotion Pipeline)    ← after content exists
Phase 4:  Integration test — full promotion cycle
```

---

## 10. Design Decisions

| Decision                        | Choice                                 | Rationale                                                                                                    |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Nextra vs Mintlify/GitBook      | Nextra (self-hosted)                   | Free, full control, monorepo native. No vendor lock-in. Claude Code can build/maintain it.                   |
| Dev/prod separation             | Filesystem-based (dev/ and prod/ dirs) | Simple, auditable, works with git. No database needed for docs state.                                        |
| User stories as quality gate    | Mandatory for promotion                | Prevents speculative content from reaching customers. Ties docs to tested code.                              |
| Three audience sections         | admin/user/api                         | Matches Smartout's user personas. Admin and user have fundamentally different needs. API is future-proofing. |
| MDX format                      | Nextra-native with React components    | Rich docs (tabs, callouts, steps) without leaving the Next.js ecosystem.                                     |
| Promotion script vs manual copy | Automated script + CI                  | Eliminates human error, enforces status checks, creates audit trail.                                         |
| Internal docs unchanged         | Keep docs/modules/ as-is               | They serve a different purpose (AI agent context) and should not be customer-facing.                         |
| Norwegian-first                 | i18n support in Nextra config          | Primary market is Norway. English as secondary language.                                                     |
