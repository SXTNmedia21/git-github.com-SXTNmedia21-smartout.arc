# Docs Restructuring, Standard Format & Nextra Scaffold

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure all documentation into a layered system with YAML frontmatter, reference files, archive, and a Nextra scaffold — eliminating duplication and making every doc agent-discoverable.

**Architecture:** Five-layer information model (L0: CLAUDE.md → L1: reference/ → L2: modules/ → L3: architecture/ → L4: archive/). Every .md file except CLAUDE.md and INDEX.md gets YAML frontmatter. Four new reference files consolidate lookup data. Stale files move to archive/. Nextra app scaffolded at apps/docs/.

**Tech Stack:** Markdown, YAML frontmatter, Next.js + Nextra (for apps/docs/), pnpm workspace

---

## Reality Check (Exploration Results)

The instruction document assumed a `SMARTOUT_COMPLETE_DOCUMENTATION.md` exists — it does NOT. Modules 7, 8, 10, 11, 12 and all cross-cutting files have already been extracted into separate files. This plan adapts accordingly.

**Current state:**

- 121 .md files across docs/ (46,817 lines)
- 0 files have YAML frontmatter
- `docs/archive/` does not exist
- `apps/docs/` does not exist
- `smartout-modul3-vaktplanlegging.md` (91 lines) is a duplicate of `SMARTOUT_MODULE_3_SCHEDULING.md` (1,156 lines)
- `docs/User Manual/` has 20 Norwegian/Swedish user-facing docs (future Nextra content)
- `docs/reference/` has 6 API-focused files but missing DATABASE, ROUTES, PACKAGES, ENV_VARS

**Files to archive (3):**

- `docs/architecture/SMARTOUT_V1_REVISED_ARCHITECTURE.md` (567 lines)
- `docs/architecture/SMARTOUT_REBUILD_STRATEGY.md` (271 lines)
- `docs/architecture/smartout-full-index-v2.md` (850 lines)

**Files to delete (1):**

- `docs/modules/smartout-modul3-vaktplanlegging.md` (91 lines, duplicate)

**Files to move (1):**

- `docs/BUILD_ORDER.md` → `docs/plans/BUILD_ORDER.md`

---

## Agent Team Structure

```
┌─────────────────────────────────────────────────────────┐
│                    TEAM LEAD (you)                       │
│         Coordinates, validates, runs Phase 3             │
├───────────┬───────────┬───────────┬─────────────────────┤
│ Phase 1   │ Phase 1   │ Phase 1   │ Phase 1             │
│ Agent A   │ Agent B   │ Agent C   │ Agent D             │
│ Reference │ Reorganize│ Nextra    │ YAML: modules/      │
│ Files     │ + Archive │ Scaffold  │ (17 files)           │
├───────────┼───────────┼───────────┼─────────────────────┤
│ Phase 2   │ Phase 2   │           │                     │
│ Agent E   │ Agent F   │           │                     │
│ YAML:     │ YAML:     │           │                     │
│ arch/     │ cross-cut │           │                     │
│ (19 files)│ + rest    │           │                     │
│           │ (25 files)│           │                     │
├───────────┴───────────┴───────────┴─────────────────────┤
│ Phase 3 (sequential, team lead)                          │
│ Task 8: Update CLAUDE.md                                 │
│ Task 9: Update MEMORY.md + validate                      │
└─────────────────────────────────────────────────────────┘
```

**Phase 1:** Agents A, B, C, D run in parallel (no dependencies)
**Phase 2:** Agents E, F run in parallel (no dependencies between them, but after Phase 1 reorganize is done)
**Phase 3:** Sequential, team lead handles CLAUDE.md and validation

---

## YAML Frontmatter Standard

Every .md file in docs/ (except INDEX.md) gets this header:

```yaml
---
title: "Human-readable title"
id: UNIQUE_STABLE_ID
version: "1.0"
status: canonical | draft | superseded | archived
layer: reference | module | architecture | cross-cutting | plan | research | decision | learning
created: YYYY-MM-DD
updated: YYYY-MM-DD
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags: []
tables: []
changelog:
  - date: YYYY-MM-DD
    change: "Initial version with YAML frontmatter"
---
```

**Rules:**

- `id` never changes once assigned
- `status` is one of: canonical, draft, superseded, archived
- `depends_on` uses ids, not filenames
- `tables` lists database tables this file documents
- Summary section (max 3 sentences) immediately after frontmatter header

**Exceptions:**

- `CLAUDE.md` — no YAML (loaded raw by Claude Code)
- `docs/INDEX.md` — simplified YAML (title + updated only)
- `docs/decisions/*.md` — keep ADR template format, add minimal YAML (title, id, status, layer: decision)
- `docs/learnings/*.md` — keep learning template format, add minimal YAML (title, id, status, layer: learning)
- `docs/plans/completed/*.md` — skip (historical, never loaded)

---

## Task 1: Create docs/INDEX.md [Agent A]

**Files:**

- Create: `docs/INDEX.md`

**What:** Master navigation map for all documentation. An agent reads this to find any document.

**Content structure:**

```markdown
---
title: "Smartout Documentation Index"
updated: 2026-02-28
---

# Smartout Documentation Index

## Source of Truth Hierarchy

1. **Code + database schema** → implementation always wins
2. **CLAUDE.md** → conventions, rules, verified facts
3. **docs/reference/** → detailed lookup during coding
4. **docs/modules/** → business logic per module
5. **docs/architecture/** → system design decisions
6. **docs/cross-cutting/** → concerns spanning modules
7. **docs/archive/** → historical, never loaded actively

## All Documents

### Reference (Layer 1)

| id                 | File                                             | Status    | Tables |
| ------------------ | ------------------------------------------------ | --------- | ------ |
| REF_DATABASE       | reference/DATABASE.md                            | canonical | [all]  |
| REF_ROUTES         | reference/ROUTES.md                              | canonical | —      |
| REF_PACKAGES       | reference/PACKAGES.md                            | canonical | —      |
| REF_ENV            | reference/ENV_VARS.md                            | canonical | —      |
| REF_API_ENDPOINTS  | reference/API_ENDPOINT_REFERENCE.md              | canonical | —      |
| REF_API_DATA       | reference/API_DATA_DICTIONARY.md                 | canonical | —      |
| REF_API_OVERVIEW   | reference/API_REFERENCE_OVERVIEW.md              | canonical | —      |
| REF_API_VERSIONING | reference/API_VERSIONING_AND_LIFECYCLE.md        | canonical | —      |
| REF_API_VISIBILITY | reference/API_VISIBILITY_AND_RELEASE_PROFILES.md | canonical | —      |
| REF_API_INVENTORY  | reference/API_INVENTORY_AND_COVERAGE.md          | canonical | —      |

### Modules (Layer 2)

| id        | File                                          | Status    | Key Tables                       |
| --------- | --------------------------------------------- | --------- | -------------------------------- |
| MODULE_01 | modules/SMARTOUT_MODULE_1_ONBOARDING.md       | canonical | onboarding_session               |
| MODULE_02 | modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md    | canonical | department, location, team       |
| MODULE_03 | modules/SMARTOUT_MODULE_3_SCHEDULING.md       | canonical | shift, schedule                  |
| MODULE_04 | modules/SMARTOUT_MODULE_4_OPERATIONS.md       | canonical | department_session, session_task |
| MODULE_05 | modules/SMARTOUT_MODULE_5_HACCP.md            | canonical | —                                |
| MODULE_06 | modules/SMARTOUT_MODULE_6_TRAINING.md         | canonical | —                                |
| MODULE_07 | modules/SMARTOUT_MODULE_7_ABSENCE.md          | draft     | —                                |
| MODULE_08 | modules/SMARTOUT_MODULE_8_PAYROLL.md          | draft     | —                                |
| MODULE_09 | modules/SMARTOUT_MODULE_9_COMMUNICATION.md    | canonical | —                                |
| MODULE_10 | modules/SMARTOUT_MODULE_10_REPORTS.md         | canonical | —                                |
| MODULE_11 | modules/SMARTOUT_MODULE_11_SETTINGS.md        | draft     | —                                |
| MODULE_12 | modules/SMARTOUT_MODULE_12_AI.md              | canonical | —                                |
| MODULE_13 | modules/SMARTOUT_MODULE_13_MULTITENANT.md     | canonical | —                                |
| MODULE_14 | modules/SMARTOUT_MODULE_14_PRODUCTION.md      | canonical | —                                |
| MODULE_15 | modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md | canonical | season                           |
| MODULE_17 | modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md  | canonical | platform\_\*                     |
| MODULE_18 | modules/SMARTOUT_MODULE_18_WEBRTC.md          | canonical | —                                |

### Architecture (Layer 3)

| id  | File | Status |
| --- | ---- | ------ |

(list all architecture files that survive, ~19 files)

### Cross-Cutting

| id  | File | Status |
| --- | ---- | ------ |

(list all cross-cutting files, ~11 files)

### Decisions (ADRs)

See `docs/decisions/0000-decision-log.md` — 24 accepted ADRs.

### Learnings

See `docs/learnings/0000-learning-log.md` — 11 learning records.

### Plans

Active plans in `docs/plans/`. Completed plans in `docs/plans/completed/`.

### Research

(list research files)

### Archive

(list archived files with reason)
```

**Step 1:** Read all file listings to build complete table.
**Step 2:** Create the file with proper content.
**Step 3:** Verify all ids are unique and all files exist.

---

## Task 2: Create Reference Files [Agent A]

**Files:**

- Create: `docs/reference/DATABASE.md`
- Create: `docs/reference/ROUTES.md`
- Create: `docs/reference/PACKAGES.md`
- Create: `docs/reference/ENV_VARS.md`

### 2a: DATABASE.md

**Source data:** Extract from `CLAUDE.md` (Database Ground Truth section) + `docs/architecture/SMARTOUT_CORE_ARCHITECTURE_v2.md` (data model sections) + `docs/architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md`.

```yaml
---
title: "Database Reference"
id: REF_DATABASE
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
depends_on: []
tags: [database, schema, rls, enums, tables]
tables:
  [
    user_identity,
    company,
    company_member,
    workspace,
    profile,
    department,
    location,
    team,
    policy,
    protocol,
    season,
    contract_template,
    contract,
    contract_event,
    contract_reminder,
    message_template,
    clause_library,
    landing_config,
    landing_config_version,
    platform_audit_log,
    platform_impersonation_log,
    platform_metrics_daily,
  ]
changelog:
  - date: 2026-02-28
    change: "Initial version — consolidated from CLAUDE.md + CORE_ARCH_V2 + FOUNDATION_DATA_MODEL"
---
```

**Content includes:**

- All table schemas with columns (from database.types.ts or migrations)
- RLS patterns with examples
- All 30 enums (from database.types.ts)
- Naming conventions
- Auth trigger documentation
- Migration naming rules
- Seed data reference

**Step 1:** Read `CLAUDE.md` Database Ground Truth section.
**Step 2:** Read `docs/architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md` for detailed schema.
**Step 3:** Read `packages/supabase/src/database.types.ts` for actual enums.
**Step 4:** Read `docs/architecture/SMARTOUT_APPENDIX_ENUMS.md` for enum details.
**Step 5:** Compose `docs/reference/DATABASE.md` — single source for all DB facts.
**Step 6:** Verify all tables mentioned in CLAUDE.md appear in the reference.

### 2b: ROUTES.md

**Source data:** Extract from `CLAUDE.md` (Existing Routes section) + `docs/architecture/SMARTOUT_UI_ARCHITECTURE.md` (screen inventory).

```yaml
---
title: "Routes & Endpoints Reference"
id: REF_ROUTES
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
depends_on: []
tags: [routes, api, pages, endpoints]
tables: []
changelog:
  - date: 2026-02-28
    change: "Initial version — consolidated from CLAUDE.md + UI_ARCHITECTURE"
---
```

**Content includes:**

- All web app routes (from CLAUDE.md Existing Routes)
- All landing page routes
- All API routes
- All signing routes
- Route ownership (which module owns which route)
- Middleware behavior per route

**Step 1:** Read `CLAUDE.md` routes sections.
**Step 2:** Scan `apps/web/src/app/` for actual route folders.
**Step 3:** Scan `apps/landing/src/app/` for actual route folders.
**Step 4:** Compose `docs/reference/ROUTES.md`.

### 2c: PACKAGES.md

**Source data:** Extract from `CLAUDE.md` (Package Exports section).

```yaml
---
title: "Package Exports Reference"
id: REF_PACKAGES
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
depends_on: []
tags: [packages, monorepo, exports, dependencies]
tables: []
changelog:
  - date: 2026-02-28
    change: "Initial version — consolidated from CLAUDE.md + actual package.json files"
---
```

**Content includes:**

- All package names and export paths
- Dependencies between packages
- Build commands per package
- What each export provides

**Step 1:** Read all `packages/*/package.json` for actual exports.
**Step 2:** Cross-reference with CLAUDE.md Package Exports section.
**Step 3:** Compose `docs/reference/PACKAGES.md`.

### 2d: ENV_VARS.md

**Source data:** Extract from `CLAUDE.md` (Environment Variables section) + `apps/web/src/env.ts`.

```yaml
---
title: "Environment Variables Reference"
id: REF_ENV
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
depends_on: []
tags: [env, secrets, configuration, 1password]
tables: []
changelog:
  - date: 2026-02-28
    change: "Initial version — consolidated from CLAUDE.md + env.ts validation"
---
```

**Content includes:**

- All environment variables with context, required status, validation rules
- 1Password integration instructions
- Local development setup
- Per-environment differences (local vs production)

**Step 1:** Read `apps/web/src/env.ts` for actual validation.
**Step 2:** Read `apps/landing/src/env.ts` if it exists.
**Step 3:** Compose `docs/reference/ENV_VARS.md`.

---

## Task 3: Reorganize — Archive, Move, Delete [Agent B]

**Files:**

- Create: `docs/archive/` directory
- Move: `docs/architecture/SMARTOUT_V1_REVISED_ARCHITECTURE.md` → `docs/archive/`
- Move: `docs/architecture/SMARTOUT_REBUILD_STRATEGY.md` → `docs/archive/`
- Move: `docs/architecture/smartout-full-index-v2.md` → `docs/archive/`
- Move: `docs/BUILD_ORDER.md` → `docs/plans/BUILD_ORDER.md`
- Delete: `docs/modules/smartout-modul3-vaktplanlegging.md` (91 lines, duplicate of MODULE_3)

**Step 1:** Create `docs/archive/` directory.
**Step 2:** Move 3 files to archive with `git mv`.
**Step 3:** Add YAML frontmatter to archived files with `status: archived`.
**Step 4:** Move BUILD_ORDER.md to plans/ with `git mv`.
**Step 5:** Delete the duplicate modul3 file with `git rm`.
**Step 6:** Verify no broken references exist (grep for old filenames in remaining docs).

**Archived files get this frontmatter:**

```yaml
---
title: "Original Title"
id: ARCH_V1_REVISED # or ARCH_REBUILD_STRATEGY, ARCH_FULL_INDEX
version: "1.0"
status: archived
layer: architecture
created: 2026-02-24
updated: 2026-02-28
author: pontus
superseded_by: CORE_ARCH_V2 # or INDEX, etc.
tags: [archived]
changelog:
  - date: 2026-02-28
    change: "Archived — superseded by newer documents"
---
```

---

## Task 4: YAML Frontmatter — Module Files [Agent D]

**Files:** All 17 files in `docs/modules/` (after duplicate deletion)

**Pattern:** For each file, prepend YAML frontmatter block. Do NOT change any content below the existing header.

**ID mapping:**

| File                                  | id        | status    | depends_on                           |
| ------------------------------------- | --------- | --------- | ------------------------------------ |
| SMARTOUT_MODULE_1_ONBOARDING.md       | MODULE_01 | canonical | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_2_ORG_STRUCTURE.md    | MODULE_02 | canonical | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_3_SCHEDULING.md       | MODULE_03 | canonical | [CORE_ARCH_V2, MODULE_02]            |
| SMARTOUT_MODULE_4_OPERATIONS.md       | MODULE_04 | canonical | [CORE_ARCH_V2, MODULE_02, MODULE_03] |
| SMARTOUT_MODULE_5_HACCP.md            | MODULE_05 | canonical | [CORE_ARCH_V2, MODULE_04]            |
| SMARTOUT_MODULE_6_TRAINING.md         | MODULE_06 | canonical | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_7_ABSENCE.md          | MODULE_07 | draft     | [CORE_ARCH_V2, MODULE_03, MODULE_08] |
| SMARTOUT_MODULE_8_PAYROLL.md          | MODULE_08 | draft     | [CORE_ARCH_V2, MODULE_03]            |
| SMARTOUT_MODULE_9_COMMUNICATION.md    | MODULE_09 | canonical | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_10_REPORTS.md         | MODULE_10 | canonical | [CORE_ARCH_V2, MODULE_04]            |
| SMARTOUT_MODULE_11_SETTINGS.md        | MODULE_11 | draft     | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_12_AI.md              | MODULE_12 | canonical | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_13_MULTITENANT.md     | MODULE_13 | canonical | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_14_PRODUCTION.md      | MODULE_14 | canonical | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_15_SEASON_PLANNING.md | MODULE_15 | canonical | [CORE_ARCH_V2]                       |
| SMARTOUT_MODULE_17_PLATFORM_ADMIN.md  | MODULE_17 | canonical | [CORE_ARCH_V2, MODULE_13]            |
| SMARTOUT_MODULE_18_WEBRTC.md          | MODULE_18 | canonical | [CORE_ARCH_V2]                       |

**Status logic:**

- `canonical` — substantial content, actively maintained
- `draft` — file header says "PLACEHOLDER" or content is thin (<200 lines)

**Steps per file:**

1. Read first 10 lines to capture existing header info (version, dependencies, status).
2. Determine `tags` from content (grep for key topics).
3. Determine `tables` from content (grep for table names).
4. Prepend YAML frontmatter.
5. Add Summary section (3 sentences) if missing — right after the H1 title.

**Example for MODULE_07:**

```yaml
---
title: "Module 7: Absence & Leave (Fravær & Permisjon)"
id: MODULE_07
version: "1.0"
status: draft
layer: module
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
  - MODULE_03
  - MODULE_08
tags:
  - absence
  - leave
  - vacation
  - sick-leave
  - norwegian-labor-law
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
  - date: 2026-02-24
    change: "Initial version (placeholder)"
---
```

---

## Task 5: YAML Frontmatter — Architecture Files [Agent E]

**Files:** ~19 files in `docs/architecture/` (after 3 moved to archive)

**ID mapping:**

| File                                          | id                 | status    |
| --------------------------------------------- | ------------------ | --------- |
| SMARTOUT_CORE_ARCHITECTURE_v2.md              | CORE_ARCH_V2       | canonical |
| SMARTOUT_UI_ARCHITECTURE.md                   | UI_ARCH            | draft     |
| SMARTOUT_PRODUCTION_ARCHITECTURE.md           | PROD_ARCH          | canonical |
| SMARTOUT_FOUNDATION_ARCHITECTURE.md           | FOUND_ARCH         | canonical |
| SMARTOUT_FOUNDATION_DATA_MODEL.md             | FOUND_DATA_MODEL   | canonical |
| SMARTOUT_FOUNDATION_PRODUCT_IDENTITY.md       | FOUND_PRODUCT_ID   | canonical |
| SMARTOUT_IMPLEMENTATION_GUIDE.md              | IMPL_GUIDE         | canonical |
| SMARTOUT_PACKAGES_ARCHITECTURE.md             | PACKAGES_ARCH      | canonical |
| SMARTOUT_CONTRACT_SYSTEM.md                   | CONTRACT_ARCH      | canonical |
| SMARTOUT_TELEMETRY_ARCHITECTURE.md            | TELEMETRY_ARCH     | canonical |
| SMARTOUT_Subdomain_Routing_Architecture.md    | SUBDOMAIN_ARCH     | canonical |
| SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md | WS_ONBOARD_ARCH    | canonical |
| SMARTOUT_docs_NEXTRA_architecture.md          | NEXTRA_ARCH        | draft     |
| SMARTOUT_ORG_STRUCTURE_ROADMAP.md             | ORG_ROADMAP        | canonical |
| SMARTOUT_APPENDIX_ENUMS.md                    | APPENDIX_ENUMS     | canonical |
| SMARTOUT_MODULE_10_REPORTS_AND_KPIS.md        | ARCH_REPORTS_KPIS  | canonical |
| PERFORMANCE_BUILD_GOVERNANCE.md               | PERF_GOVERNANCE    | canonical |
| PRD-03_Avstemmingssystem.md                   | PRD_03             | canonical |
| SCHEDULE_PAGE_UX_AUDIT_AND_WORKFLOWS.md       | SCHED_UX_AUDIT     | canonical |
| DATABASE_REVIEW_2026-02-28.md (docs/ root)    | DB_REVIEW_20260228 | canonical |
| project-roadmap.md (docs/ root)               | PROJECT_ROADMAP    | canonical |

**Steps:** Same pattern as Task 4 — read file, determine tags/tables, prepend YAML.

---

## Task 6: YAML Frontmatter — Cross-cutting, Reference, Research, Roadmaps [Agent F]

**Files:** ~25 files across multiple directories

### Cross-cutting (11 files)

| File                                          | id                   |
| --------------------------------------------- | -------------------- |
| SMARTOUT_CROSSCUT_LEGAL_GDPR_COMPLIANCE.md    | XCUT_LEGAL_GDPR      |
| SMARTOUT_CROSSCUT_CONTRACTS_CERTIFICATIONS.md | XCUT_CONTRACTS       |
| SMARTOUT_CROSSCUT_BILLING_STRIPE.md           | XCUT_BILLING         |
| SMARTOUT_CROSSCUT_I18N.md                     | XCUT_I18N            |
| SMARTOUT_CROSSCUT_SECURITY_INFRA.md           | XCUT_SECURITY        |
| performance-checklist.md                      | XCUT_PERF_CHECKLIST  |
| performance-governance.md                     | XCUT_PERF_GOVERNANCE |
| API_CLIENT_SETUP_AND_BYOK.md                  | XCUT_API_CLIENT      |
| API_GOVERNANCE_AND_DATA_SHARING.md            | XCUT_API_GOVERNANCE  |
| API_RELEASE_GATES_AND_COMPLIANCE.md           | XCUT_API_RELEASE     |
| vercel-operations-review.md                   | XCUT_VERCEL_OPS      |

### Reference (6 existing API files)

| File                                   | id                 |
| -------------------------------------- | ------------------ |
| API_DATA_DICTIONARY.md                 | REF_API_DATA       |
| API_ENDPOINT_REFERENCE.md              | REF_API_ENDPOINTS  |
| API_INVENTORY_AND_COVERAGE.md          | REF_API_INVENTORY  |
| API_REFERENCE_OVERVIEW.md              | REF_API_OVERVIEW   |
| API_VERSIONING_AND_LIFECYCLE.md        | REF_API_VERSIONING |
| API_VISIBILITY_AND_RELEASE_PROFILES.md | REF_API_VISIBILITY |

### Research (6 files)

| File                                                                       | id                  |
| -------------------------------------------------------------------------- | ------------------- |
| Workforce management research report.md                                    | RESEARCH_WORKFORCE  |
| LiveKit as Smartout's real-time.md                                         | RESEARCH_LIVEKIT    |
| Production architecture for a Norwegian hospitality SaaS on Supabase.md    | RESEARCH_PROD_ARCH  |
| Seven AI Council personas for Smartout's Norwegian hospitality platform.md | RESEARCH_AI_COUNCIL |
| Pricing card prompt.md                                                     | RESEARCH_PRICING    |
| DocuSeal API complete integration reference.md                             | RESEARCH_DOCUSEAL   |

### Roadmaps (2 files)

| File                          | id              |
| ----------------------------- | --------------- |
| API_KPI_AND_REVIEW_CADENCE.md | ROADMAP_API_KPI |
| API_ROADMAP.md                | ROADMAP_API     |

### Plans (3 active + BUILD_ORDER)

| File                                      | id                 |
| ----------------------------------------- | ------------------ |
| BUILD_ORDER.md (after move)               | PLAN_BUILD_ORDER   |
| 2026-02-27-docs-knowledge-system.md       | PLAN_KNOWLEDGE_SYS |
| 2026-02-28-docs-nextra-system.md          | PLAN_NEXTRA        |
| 2026-02-28-subdomain-workspace-routing.md | PLAN_SUBDOMAIN     |

### User Manual (20 files)

| File             | id           |
| ---------------- | ------------ |
| INDEX.md         | MANUAL_INDEX |
| 01-kom-i-gang.md | MANUAL_01    |
| 02-onboarding.md | MANUAL_02    |
| (etc.)           | MANUAL_NN    |

**Steps:** Same pattern — read, determine metadata, prepend YAML frontmatter.

**Note for User Manual files:** Use `layer: manual` and `status: draft` for stubs (<30 lines).

---

## Task 7: Scaffold apps/docs/ (Nextra) [Agent C]

**Files:**

- Create: `apps/docs/package.json`
- Create: `apps/docs/next.config.mjs`
- Create: `apps/docs/theme.config.tsx`
- Create: `apps/docs/tsconfig.json`
- Create: `apps/docs/pages/index.mdx`
- Create: `apps/docs/pages/guides/getting-started.mdx` (placeholder)
- Create: `apps/docs/pages/developers/quickstart.mdx` (placeholder)
- Create: `apps/docs/pages/api/overview.mdx` (placeholder)
- Create: `apps/docs/pages/_meta.json`
- Create: `apps/docs/pages/guides/_meta.json`
- Create: `apps/docs/pages/developers/_meta.json`
- Create: `apps/docs/pages/api/_meta.json`

**Step 1:** Check latest Nextra version and patterns.
Use Context7 to look up Nextra v4 (latest) documentation.

**Step 2:** Create `package.json`:

```json
{
  "name": "docs",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3060",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^16.1.6",
    "nextra": "^4",
    "nextra-theme-docs": "^4",
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {
    "typescript": "^5.0"
  }
}
```

**Step 3:** Create `next.config.mjs`:

```js
import nextra from "nextra";

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
});

export default withNextra({
  reactStrictMode: true,
});
```

**Step 4:** Create `theme.config.tsx`:

```tsx
import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: <span style={{ fontWeight: 800 }}>Smartout Docs</span>,
  project: {
    link: "https://github.com/smartout-ai/smartout_v3",
  },
  docsRepositoryBase: "https://github.com/smartout-ai/smartout_v3/tree/main/apps/docs",
  footer: {
    content: "© 2026 Smartout AS",
  },
  primaryHue: 30, // Orange accent matching brand
  primarySaturation: 100,
};

export default config;
```

**Step 5:** Create `tsconfig.json` extending shared config.
**Step 6:** Create placeholder pages with minimal content.
**Step 7:** Create `_meta.json` files for sidebar navigation.
**Step 8:** Add `"docs"` entry to root `pnpm-workspace.yaml` if not present.
**Step 9:** Verify `pnpm install` works from root.

**Important:** Do NOT copy content from `docs/` into `apps/docs/`. These are completely separate. `docs/` = internal maskinrum. `apps/docs/` = external showroom.

---

## Task 8: Update CLAUDE.md [Team Lead — after Phase 1+2]

**Files:**

- Modify: `CLAUDE.md`

**Step 1:** Add Source of Truth section after Project Identity:

```markdown
## Source of Truth

1. **Code + database schema** → implementation always wins
2. **This file** → conventions and rules
3. **docs/reference/** → detailed lookup during coding
4. **docs/modules/** → business logic per module
5. **docs/architecture/** → system design decisions

> Full navigation map: `docs/INDEX.md`
```

**Step 2:** Add trigger lines before Database section:

```markdown
## Database

> **Load** `docs/reference/DATABASE.md` when: creating/modifying tables, writing RLS, adding enums.
> **Not needed for:** simple queries on known tables listed below.
```

Before Existing Routes:

```markdown
## Routes

> **Load** `docs/reference/ROUTES.md` when: adding pages, API routes, checking all existing routes.
> **Not needed for:** modifying content on existing pages.
```

Before Module Documentation table:

```markdown
## Modules

> **Load** relevant `docs/modules/MODULE_*.md` BEFORE implementing any module feature.
> Full list with dependencies: `docs/INDEX.md`
```

**Step 3:** Remove these sections from CLAUDE.md (now in reference files):

- "Key Enums" section (~30 lines) → lives in `docs/reference/DATABASE.md`
- Module Documentation table (~20 lines) → lives in `docs/INDEX.md`

**Step 4:** Verify CLAUDE.md is still under 900 lines.
**Step 5:** Update the changelog table.

---

## Task 9: Finalize — MEMORY.md + Validation [Team Lead — after Task 8]

**Files:**

- Modify: `C:\Users\sxtnl\.claude\projects\C--Users-sxtnl-Dev-smartout-v3\memory\MEMORY.md`

**Step 1:** Add note about docs restructuring:

```markdown
## Documentation System

- All docs have YAML frontmatter (except CLAUDE.md and docs/INDEX.md)
- docs/INDEX.md is the master navigation map
- docs/reference/ has DATABASE, ROUTES, PACKAGES, ENV_VARS for quick lookup
- docs/archive/ has superseded files (V1_REVISED, REBUILD_STRATEGY, full-index-v2)
- apps/docs/ is Nextra scaffold (docs.smartout.ai) — separate from internal docs/
```

**Step 2:** Run validation:

```bash
# Check all files have YAML frontmatter (except exceptions)
for f in docs/**/*.md; do
  if [[ "$f" != *"INDEX.md"* && "$f" != *"plans/completed"* ]]; then
    head -1 "$f" | grep -q "^---" || echo "MISSING YAML: $f"
  fi
done

# Verify archived files are in archive/
ls docs/archive/

# Verify duplicate modul3 is deleted
ls docs/modules/smartout-modul3* 2>/dev/null && echo "ERROR: duplicate still exists"

# Verify BUILD_ORDER moved
ls docs/BUILD_ORDER.md 2>/dev/null && echo "ERROR: BUILD_ORDER not moved"

# Verify reference files created
ls docs/reference/DATABASE.md docs/reference/ROUTES.md docs/reference/PACKAGES.md docs/reference/ENV_VARS.md

# Verify Nextra scaffold
ls apps/docs/package.json apps/docs/next.config.mjs apps/docs/theme.config.tsx

# CLAUDE.md line count
wc -l CLAUDE.md
```

**Step 3:** Create ADR-0025 for this restructuring:

```markdown
---
id: "0025"
title: Documentation Restructuring — Layered System with YAML Frontmatter
status: Accepted
date: 2026-02-28
---

# ADR-0025: Documentation Restructuring

## Context

121 documentation files with no standard format, duplicate content, no machine-readable metadata.

## Decision

- All docs get YAML frontmatter with id, status, layer, depends_on, tables
- New reference files (DATABASE, ROUTES, PACKAGES, ENV_VARS) for quick lookup
- docs/INDEX.md as master navigation map
- Stale files archived to docs/archive/
- Nextra scaffolded at apps/docs/ for public documentation

## Consequences

- Agents can discover and filter docs by reading frontmatter only
- Source-of-truth hierarchy is explicit
- No more duplicate content across files
```

---

## Execution Summary

| Phase | Agents     | Tasks | Files Touched                               | Can Parallelize |
| ----- | ---------- | ----- | ------------------------------------------- | --------------- |
| 1     | A, B, C, D | 1-4   | ~30 creates, ~4 moves, ~1 delete, ~17 edits | Yes (all 4)     |
| 2     | E, F       | 5-6   | ~44 edits                                   | Yes (both)      |
| 3     | Lead       | 7-9   | ~3 edits + validation                       | Sequential      |

**Total files touched:** ~80+ edits/creates
**Estimated parallel execution:** 3 phases, ~6 agents total
**No code changes.** Documentation only. No tests needed.
