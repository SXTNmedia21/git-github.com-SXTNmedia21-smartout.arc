---
title: "Full Repository Audit — Smartout.ai"
status: done
updated: 2026-03-24
created: 2026-03-24
module: all
tags: [audit, status, review, comprehensive]
---

# Full Repository Audit — Smartout.ai

> Comprehensive review of the entire Smartout.ai monorepo.
> Date: 2026-03-24 | Branch: `development` | Auditor: Claude Opus 4.6
> Typecheck: 27/27 GREEN | Build: PASSING

---

## Executive Summary

Smartout.ai is a **remarkably ambitious** Employee Readiness System built by a solo entrepreneur with AI assistance. The codebase is **114,761 lines of TypeScript** across 2,100 files, with a complete Cascade Core architecture, 87 web routes, 37 mobile screens, 30+ landing pages, 38 Edge Functions, 200 migrations, 18 packages, 5 services, and 742 documentation files.

### Strengths

- Architecture is **world-class** — the Cascade Core model (I1+6D+4C+K1a/K1b) is deeply thought through
- Documentation density is **exceptional** — 742 docs, 63 ADRs, 57 journeys, 73 worklogs
- Design token system is **well-structured** — single source of truth with web/mobile outputs
- Typecheck passes 27/27 — clean type discipline across monorepo
- Feature breadth is **extraordinary** for a solo-built product

### Critical Gaps

- **i18n coverage ~5%** — 388 translated keys vs ~5,500+ hardcoded Norwegian strings across all apps
- **6 of 8 declared languages have zero translation files** — will break if selected
- **Mobile app is early** — 37 screens, employee-focused. Admin/manager features absent
- **Control Planes (C1-C4) not implemented** — schema exists, no runtime behavior
- **No test coverage** — zero test files in web/mobile/landing (only shift-clock + cascade libs have tests)
- **Design tokens drift** — tokens.ts and tokens.css have 7+ mismatched surface color values
- **hospitality.ts tariff rates are WRONG** — critical for payroll correctness

---

## 1. Codebase Statistics

| Metric                    | Count                                              |
| ------------------------- | -------------------------------------------------- |
| Total TS/TSX files        | 2,100                                              |
| Lines of code             | 114,761                                            |
| Web components (.tsx)     | 680 (100 reusable UI components)                   |
| Web routes (pages)        | 87 + 89 API routes = 176 total                     |
| Mobile components (.tsx)  | 69 (62 reusable + screens)                         |
| Mobile screens            | 37                                                 |
| Landing components (.tsx) | 114 (53 components, 34 pages + 8 API routes)       |
| Shared packages           | 18 (270 TS files across packages)                  |
| Supabase Edge Functions   | 38 (+`_shared`)                                    |
| Database migrations       | 200                                                |
| Custom enums              | 124                                                |
| Database tables           | ~215 (196 with RLS, 704 RLS policies)              |
| Services                  | 5 (4 Docker + 1 external)                          |
| Documentation files (.md) | 742                                                |
| TODO/FIXME markers        | 51 total (39 web, 4 mobile, 3 landing, 5 packages) |
| Translation keys          | 388 (nb + en, 7 namespaces)                        |
| Hardcoded strings         | ~5,500+ across all apps                            |

---

## 2. Design Tokens & Theme System

### 2.1 Token Architecture

**Source of truth:** `packages/design-tokens/src/tokens.ts` (175 lines)

| Category            | Tokens                                                                                                                                | Status   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Brand colors        | 6 (orange, orangeLight, orangeDark, purple, purpleLight, purpleDark)                                                                  | COMPLETE |
| Semantic colors     | 8 (success, warning, error, info + foregrounds)                                                                                       | COMPLETE |
| Light mode surfaces | 27 (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, sidebar x7, chart x5) | COMPLETE |
| Dark mode surfaces  | 27 (same set)                                                                                                                         | COMPLETE |
| Domain colors       | 5 department + 4 status + 4 priority = 13                                                                                             | COMPLETE |
| Spacing             | 5 (page, section, card, element, tight)                                                                                               | COMPLETE |
| Radius              | 6 (base, sm, md, lg, xl, full)                                                                                                        | COMPLETE |
| Shadows             | 4 (sm, md, lg, glow.orange, glow.blue)                                                                                                | COMPLETE |
| Wizard themes       | 12 (dark x6, warm x6)                                                                                                                 | COMPLETE |

**Color format:** OKLCH throughout (modern, perceptually uniform). Good choice.

**Outputs:**

- `tokens.css` — CSS custom properties for web
- `native.ts` — React Native compatible values
- `index.ts` — TypeScript re-exports

### 2.2 Web Integration (Tailwind v4)

- **Config:** CSS-based in `apps/web/src/app/globals.css` (no tailwind.config.ts)
- **CSS variables** map to tokens: `--background`, `--foreground`, `--primary`, etc.
- **Usage:** Components use semantic classes (`bg-background`, `text-foreground`)
- **Font imports:** Geist Sans (body), Geist Mono (code), Instrument Serif (headings)

### 2.3 Mobile Integration

- **Theme files:** `apps/mobile/src/theme/colors.ts` + `apps/mobile/src/theme/index.ts`
- **Sync status:** Mobile has its OWN color definitions — NOT importing from `packages/design-tokens`
- **Risk:** Drift between web and mobile tokens over time

### 2.4 Style Guide

- **File:** `docs/design/ren-og-varm-styleguide.html` — 24-section interactive reference
- **Live at:** `design.smartout.ai`
- **Coverage:** Colors, typography, motion, icons, patterns, components

### 2.5 Issues Found

| Issue                                | Severity | Description                                                                                                                                  |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **tokens.ts vs tokens.css mismatch** | HIGH     | 7+ light mode surface colors differ between tokens.ts and tokens.css. E.g. background: `oklch(1 0 0)` in ts vs `oklch(0.99 0.004 60)` in css |
| Hardcoded colors in components       | Medium   | 30+ component files use `bg-zinc-900`, `text-orange-500`, `border-red-500` bypassing tokens                                                  |
| Missing motion tokens                | Medium   | Spring physics values (stiffness 30-45, damping 20-24) scattered in components, not in tokens.ts                                             |
| No typography tokens                 | Medium   | Font sizes, weights, line heights not tokenized                                                                                              |
| Web-only colors not in tokens.ts     | Medium   | 11 onboarding, join, document-mode colors only in globals.css                                                                                |
| Mobile shadow tokens separate        | Low      | Mobile defines own shadow presets not in design-tokens package                                                                               |
| No breakpoint tokens                 | Low      | Responsive breakpoints not in token system                                                                                                   |

### 2.6 Recommendations

1. **Add motion tokens** to tokens.ts (spring physics, durations)
2. **Add typography scale** to tokens.ts
3. **Make mobile import from design-tokens** — eliminate parallel definitions
4. **Audit hardcoded colors** in the 428 flagged web component files

---

## 3. Internationalization (i18n)

### 3.1 Infrastructure

| Aspect        | Detail                                                               |
| ------------- | -------------------------------------------------------------------- |
| Package       | `packages/i18n/` — custom-built, no library dependency               |
| Approach      | Static JSON imports, `useTranslation` hook, `LocaleProvider` context |
| Namespaces    | 7: common, landing, docs, onboarding, wizard, join, dashboard        |
| Interpolation | `{param}` syntax in strings                                          |
| RTL support   | Configured for Arabic (`ar`)                                         |

### 3.2 Language Coverage

| Language           | Code | Status             | Keys |
| ------------------ | ---- | ------------------ | ---- |
| Norwegian (Bokmal) | `nb` | COMPLETE           | 388  |
| English            | `en` | COMPLETE           | 388  |
| Swedish            | `sv` | DECLARED, NO FILES | 0    |
| Danish             | `da` | DECLARED, NO FILES | 0    |
| Polish             | `pl` | DECLARED, NO FILES | 0    |
| Arabic             | `ar` | DECLARED, NO FILES | 0    |
| Somali             | `so` | DECLARED, NO FILES | 0    |
| Finnish            | `fi` | DECLARED, NO FILES | 0    |

### 3.3 Translation Key Distribution

| Namespace       | Keys    | Coverage Area        |
| --------------- | ------- | -------------------- |
| onboarding.json | 164     | Wizard 11 steps      |
| landing.json    | 119     | Marketing site       |
| common.json     | 38      | Nav, footer, consent |
| docs.json       | 35      | Documentation site   |
| dashboard.json  | 13      | Setup labels         |
| join.json       | 11      | Join form            |
| wizard.json     | 8       | Nav buttons          |
| **TOTAL**       | **388** |                      |

### 3.4 Hardcoded Norwegian String Audit

| App                      | Files with hardcoded Norwegian | Estimated strings    | i18n hook usage                       |
| ------------------------ | ------------------------------ | -------------------- | ------------------------------------- |
| Web (apps/web/src)       | 428 files                      | ~3,329               | 1 component (AnimatedWizardShell.tsx) |
| Mobile (apps/mobile/src) | 52 files                       | ~493 (in strings.ts) | 0 — centralized constant file         |
| Landing (apps/landing)   | 77 files                       | ~1,752               | 0 — URL-based routing                 |
| **TOTAL**                | **557 files**                  | **~5,574+**          | **1 component total**                 |

**Mobile mitigation:** `apps/mobile/src/constants/strings.ts` (212 lines, 90+ keys) — centralized but hardcoded. Comment says "i18n via @smartout/i18n planned for V2".

**Most common hardcoded words found:**

- "Legg til" (Add) — 68 files
- "Lagre" (Save) — 30+ instances in setup wizards
- "Oversikt" (Overview) — 19 files
- "Avbryt" (Cancel) — 20+ instances
- "Innstillinger" (Settings) — 10 files

### 3.5 Translation Coverage Assessment

- **Translated:** ~388 keys = ~7% of total UI text
- **Hardcoded:** ~5,574+ strings = ~93% of total UI text
- **Web coverage:** 12% (455 t() calls vs 3,329 hardcoded)
- **Mobile coverage:** 0% (100% hardcoded, V2 planned)
- **Landing coverage:** 0% (URL-based routing, no hooks)
- **Worst areas:** Dashboard components, settings, governance, operations
- **Best areas:** Onboarding wizard (only component using useTranslation)

### 3.6 Critical i18n Bug

**6 stub languages will break the UI if selected.** `createTranslator()` only loads nb + en. Selecting Swedish returns an empty message object — all text renders as raw key strings. Either remove stubs from config or add fallback chain.

### 3.6 i18n Recommendations

1. **Critical: Extract dashboard strings** — this is the core product surface
2. **Add missing language files** for sv, da, pl (Nordic expansion markets)
3. **Create a string extraction script** to automate finding hardcoded text
4. **Consider adopting a proper i18n library** (e.g., next-intl) for plural handling, date formatting
5. **Mobile needs i18n integration** — currently zero i18n usage

---

## 4. Documentation

### 4.1 Documentation Inventory

| Category               | Count    | Quality                                          |
| ---------------------- | -------- | ------------------------------------------------ |
| Total docs (.md files) | 742      | —                                                |
| ADR files (decisions/) | 63       | HIGH — numbered, with rationale                  |
| Journey files          | 57       | GOOD — step-by-step user flows                   |
| Worklogs               | 73       | GOOD — active tracking                           |
| Module docs            | 24       | GOOD — business logic captured                   |
| Learning files         | 19       | GOOD — discoveries documented                    |
| Reference docs         | 5+       | HIGH — DATABASE, ROUTES, PACKAGES, ENV_VARS      |
| Architecture docs      | Multiple | GOOD — system design decisions                   |
| Cross-cutting docs     | Multiple | GOOD — GDPR, billing, security, i18n             |
| Templates              | 3+       | decision.md, learning.md, plan.md                |
| Protocols              | 4        | SECURITY, DOCUMENTATION, KNOWLEDGE, ENV_PROTOCOL |

### 4.2 Documentation Strengths

- **STATE.md** is exceptional — verified system state organized by Cascade dimensions
- **DASHBOARD.md** tracks all worktrees, sessions, closures over 3+ months
- **SESSION.md** provides cross-session continuity
- **CLAUDE.md** is comprehensive (project-level 350+ lines, global 250+ lines)
- **ADR discipline** — 63 decisions documented with rationale and consequences
- **Journey documentation** — 57 user journey files with step-by-step flows

### 4.3 Documentation Gaps

| Missing                              | Severity | Notes                                                           |
| ------------------------------------ | -------- | --------------------------------------------------------------- |
| Missing journey files                | Medium   | 5 features listed as "missing" in DASHBOARD.md                  |
| No README.md files in packages       | Low      | All 18 packages lack usage docs                                 |
| No API documentation for consumers   | High     | No Swagger/OpenAPI spec for workspace-api                       |
| No onboarding doc for new developers | Medium   | CLAUDE.md serves this purpose but is agent-focused              |
| ROUTES.md has future date            | Low      | 2026-04-13 when today is 2026-03-24 — likely YAML typo          |
| Module 16 missing                    | Low      | INDEX.md jumps from 15 to 17 — intentional or oversight?        |
| Engines layer mostly draft           | Medium   | 32 files in engines/ but not yet canonical                      |
| 12 docs awaiting rewrite             | Low      | In docs/architecture/NEEDS-REWRITE/                             |
| Duplicate learning IDs               | Low      | 0001, 0002 each appear twice (likely from concurrent worktrees) |

### 4.4 YAML Frontmatter Compliance

**99.9% compliance** — 741 of 742 files have proper YAML frontmatter. Only `docs/archive/joine-codes.md` (archived) is missing frontmatter. Field adoption: title 100%, status 100%, updated ~95%, created ~85%, author ~70%, module ~80%, tags ~75%.

### 4.5 Documentation Status Distribution

| Status      | Count | Notes                                |
| ----------- | ----- | ------------------------------------ |
| Canonical   | 67    | Solid core (~60%)                    |
| Draft       | 63    | Intentional WIP (~25%)               |
| Archived    | 8     | Properly tagged                      |
| In-progress | 5     | Active work                          |
| Other       | 5     | Design-spec, review, pending rewrite |

---

## 5. Web Dashboard (apps/web)

### 5.1 Route Map — 87 Total Pages

**Public Routes (10):**

- `/join` — Workspace creation wizard (7 steps, Nordic Split layout)
- `/login`, `/signup`, `/reset-password` — Auth screens (split-screen gradient design)
- `/onboarding` + `/onboarding/showcase` — Authenticated bootstrap
- `/select-plan`, `/select-workspace` — Post-auth routing
- `/welcome`, `/invite/[token]`, `/sign/[token]`, `/access-denied`

**Dashboard Routes (28):**

| Route                                    | Status      | Cascade | Notes                                                           |
| ---------------------------------------- | ----------- | ------- | --------------------------------------------------------------- |
| `/dashboard`                             | WORKING     | D6      | 5 tabs: Tactical, Strategic, Reconciliation, Activity, Guardian |
| `/dashboard/schedule`                    | WORKING     | D6      | Week/day/month views, DnD, Day Control Panel, publish           |
| `/dashboard/people` + `/[id]`            | WORKING     | D2      | DataTable, invite, employee cards                               |
| `/dashboard/operations`                  | WORKING     | D6      | Live stress dashboard, 4 metrics, auto-refresh                  |
| `/dashboard/governance`                  | WORKING     | C4      | Full CRUD: 5 forms, readiness scores                            |
| `/dashboard/season`                      | WORKING     | D4      | 4 tabs: overview, budget, day-factors, hour-factors             |
| `/dashboard/organization` + entity pages | WORKING     | D1      | Departments, locations, teams, positions                        |
| `/dashboard/reports`                     | WORKING     | C1/C3   | ReportsPageShell, AI chat, saved reports                        |
| `/dashboard/chat`                        | WORKING     | C2      | Real-time chat, DMs                                             |
| `/dashboard/ai` + `/config`              | WORKING     | C2      | Mr. Botsson interface + authority config                        |
| `/dashboard/close`                       | WORKING     | D6/C1   | Close-out flow, checklist, image upload                         |
| `/dashboard/reconciliation`              | WORKING     | C1      | DayList, approval, revenue, deviations                          |
| `/dashboard/settings`                    | PARTIAL     | D1      | 11/16 tabs working, 5 placeholder                               |
| `/dashboard/handbook`                    | WORKING     | K1b     | Tiptap editor, 10 chapters                                      |
| `/dashboard/shift-clock` + `/leader`     | WORKING     | D6      | GPS, breaks, supplements, realtime                              |
| `/dashboard/hms` + sub-routes            | WORKING     | —       | HMS module: deviations, docs, drift, training                   |
| `/dashboard/komm`                        | WORKING     | C2      | Communications                                                  |
| `/dashboard/website` + sub-routes        | WORKING     | —       | Website builder, page editor                                    |
| `/dashboard/my-schedule`                 | WORKING     | D6      | Employee week view                                              |
| `/dashboard/my-training`                 | WORKING     | —       | 4 components, real progress data                                |
| `/dashboard/my-salary`                   | WORKING     | C3      | PeriodList, PayslipDetail, Balances                             |
| `/dashboard/my-cv`                       | PLACEHOLDER | D2      | "Under construction"                                            |
| `/dashboard/help`                        | EXISTS      | —       | Help page                                                       |
| `/dashboard/onboarding-assistant`        | EXISTS      | I1      | Onboarding assistant                                            |
| `/dashboard/setup`                       | WORKING     | —       | Post-bootstrap setup guide                                      |

**Platform Admin Routes (18):**
Full admin portal with users, workspaces, billing, communications, contracts, content, guardian, health, journeys, keys, landing variants, services.

### 5.2 Components

- **27 shadcn/ui components** installed (accordion through tooltip)
- **680 .tsx files** total in apps/web/src
- **Component directories:** contract-editor, dashboard, onboarding, platform-admin, providers, ui, wizard
- **Hooks:** 9 custom hooks in apps/web/src/hooks/

### 5.3 Configuration

- Next.js 16 with App Router
- TypeScript strict mode
- Tailwind v4 CSS-based config
- shadcn/ui (new-york style)
- 27/27 typecheck pass

### 5.4 Web Dashboard Verdict

**Score: 8/10** — Extraordinary breadth for a solo project. Nearly every planned feature has at least a working shell. The 5 placeholder settings tabs and missing C1-C4 control plane UIs are the main gaps. Code quality is consistent, type-safe, and well-organized.

---

## 6. Landing Page (apps/landing)

### 6.1 Route Map — 34 Pages + 8 API Routes

| Section  | Pages                                                      | Notes                                                                                                 |
| -------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Home     | `/` (nb) + `/en`                                           | Dual language, VariantMLanding (active)                                                               |
| Features | 6 pages                                                    | shiftplanner, staff-training, task-rutines, communications, haccp-complience, punchclock-timetracking |
| Concepts | 4 pages                                                    | daily-session, lokations, procedures, seasons                                                         |
| Docs     | `/docs` + `/docs/[slug]` + `/en/docs/[slug]` + `/docs/api` | Customer documentation + AI chat sidebar                                                              |
| Blog     | `/blog` + `/blog/[slug]`                                   | Blog system                                                                                           |
| Legal    | personvern, vilkar                                         | Privacy, terms                                                                                        |
| Sales    | pricing, compare, free-forever, om-oss                     | Pricing and about                                                                                     |
| Auth     | login, signup, waitlist                                    | Lead capture                                                                                          |
| Demo     | `/demo` + `/demo/[journey]`                                | 6 interactive journeys with AI assistant                                                              |
| Design   | `/design`                                                  | Design system showcase                                                                                |
| Variants | `/v`                                                       | A/B testing                                                                                           |

**API Routes (8):** track, waitlist, wizard/start, wizard/engine-start, auth/callback, health, revalidate, docs-agent

### 6.2 Components — 53 Total

- **19 block components** — HeroBlock, FeaturesGridBlock, TestimonialBlock, StatsBlock, PricingPreviewBlock, FaqBlock, etc.
- **6 demo journeys** — punch-in, schedule-ai, quiz, deviation, haccp, onboarding with AI AssistantPanel
- **9 landing variants** (8 archived, 1 active: VariantMLanding)
- **Core:** navigation, footer, theme-toggle, language-switcher, cookie-consent, voice-assistant (Ultravox), workspace-analyzer, motion-provider, tracking, variant system

### 6.3 Content & Quality

- Dual language (Norwegian + English) via URL routing + cookie
- Design consistent with "Ren og Varm" style guide
- Voice assistant integration (Ultravox, 6 demo missions)
- **Comprehensive tracking:** PostHog + custom landing_event/visitor/session tables in Supabase
- Cookie consent (GDPR)
- Supabase integration for lead capture (waitlist with name, company, email, phone, employee count)
- **SEO:** Dynamic sitemap with hreflang alternates, robots.txt, canonical URLs
- **Performance:** Turbopack, next/image (AVIF+WebP), font loading optimized, lazy-loaded interactives

### 6.4 Landing Verdict

**Score: 8.5/10** — Production-ready, feature-rich landing site. 34 pages, dual language, 6 interactive demo journeys with AI chat, voice assistant, comprehensive analytics (PostHog + custom tables), SEO-ready. Main issues: 8 archived variant files need cleanup, no per-page OG tags for social sharing.

---

## 7. Mobile App (apps/mobile)

### 7.1 Screen Map — 37 Screens

**Auth Flow (7):**

- Welcome → Verify (OTP) → Pending → Workspace Select
- Invite accept flow: `/invite/[token]` → `/invite/confirm`

**Home Tab (7):**

- Index (dashboard), punch-clock, team, team/[id], deviation, haccp, edit-profile, spokesperson-approval

**Shifts Tab (3):**

- Index (my shifts list), shift detail /[id]

**Chat Tab (3):**

- Index, conversation /[id]

**Komm Tab (3):**

- Index, channel /[id]

**Me Tab (7):**

- Index (profile), payroll, payroll-supplements, payslip detail, absence-request, absence-balance, timebank

### 7.2 Components — 69 .tsx Files

| Directory    | Files    | Purpose                                                   |
| ------------ | -------- | --------------------------------------------------------- |
| home/        | 4+       | HomeHeader, NoShiftView, NotificationSheet, SettingsSheet |
| shift-clock/ | Multiple | Punch clock components                                    |
| payroll/     | 2+       | PayrollHomeCard, SupplementBadges                         |
| navigation/  | 1+       | TabBar                                                    |
| auth/        | Multiple | Welcome, login screens                                    |
| chat/        | Multiple | Chat components                                           |
| ai/          | Multiple | AI assistant                                              |
| ui/          | Multiple | Card, Badge, etc.                                         |

### 7.3 Hooks — 18+ Custom Hooks

**Query hooks:** use-my-shifts, use-my-profile, use-my-tasks, use-payslips, use-payroll-summary, use-day-info, use-channels, use-channel-messages, use-conversations, use-messages, use-absence-balance, use-absence-types, use-my-absence-requests, use-supplement-rules, use-timebank-balance, use-shift-colleagues, use-active-time-entry

**Feature hooks:** use-botsson-chat, use-shift-phase, use-sync-status

**Stores:** use-theme-store (Zustand)

### 7.4 Theme System

- Own color definitions in `apps/mobile/src/theme/colors.ts`
- Theme index in `apps/mobile/src/theme/index.ts`
- Recently force-set to light mode (`2662f7cd`)
- **NOT** importing from `packages/design-tokens` — separate definitions

### 7.5 Feature Parity with Web

| Feature        | Web                 | Mobile     | Parity |
| -------------- | ------------------- | ---------- | ------ |
| Dashboard/Home | FULL                | PARTIAL    | 40%    |
| Schedule       | FULL (planner, DnD) | LIST VIEW  | 30%    |
| People/Team    | FULL (table, cards) | BASIC LIST | 25%    |
| Punch Clock    | FULL                | FULL       | 90%    |
| Chat           | FULL                | FULL       | 85%    |
| Payroll        | FULL                | FULL       | 80%    |
| Governance     | FULL CRUD           | NONE       | 0%     |
| Operations     | FULL dashboard      | NONE       | 0%     |
| Season         | FULL (4 tabs)       | NONE       | 0%     |
| Settings       | 11/16 tabs          | NONE       | 0%     |
| HMS            | FULL module         | NONE       | 0%     |
| AI/Agent       | FULL                | BASIC      | 20%    |
| Reports        | FULL                | NONE       | 0%     |
| Handbook       | FULL                | NONE       | 0%     |

### 7.6 Data Layer

- **TanStack Query v5** — 15 query hooks + 12 mutation hooks
- **Zustand stores** — 3 (shift-phase, sync-status, theme-store)
- **Offline sync** — SQLite queue (`lib/sync/queue.ts`) with auto-sync on reconnect
- **MMKV** — Persistent key-value for theme, push prefs, query cache

### 7.7 Configuration

- **Expo SDK 55**, React Native 0.83.2, React 19
- **Bundle IDs:** `ai.smartout.mobile` (iOS + Android)
- **Deep links:** `app.smartout.ai/invite`
- **LiveKit 2.17.3** for video calls
- **Expo Notifications 55** for push

### 7.8 Mobile Verdict

**Score: 6/10** — More capable than initially assessed. 37 screens, 62 reusable components, 39 hooks, sophisticated state management (Zustand + TanStack Query + SQLite offline sync). Employee experience is strong (shifts, punch clock, payroll, chat, HACCP). But admin/manager features are completely absent. Architecture mirrors web parity with native enhancements (MMKV caching, Expo location, LiveKit calls, push, offline sync).

---

## 8. Shared Packages (packages/)

### 8.1 Package Inventory — 18 Packages

| Package             | Purpose                                                       | Source Files | Quality         |
| ------------------- | ------------------------------------------------------------- | ------------ | --------------- |
| `ai`                | Agent system (capabilities, tools, prompts, router, adapters) | 50+          | HIGH            |
| `supabase`          | DB types, client creation, database.types.ts                  | 5+           | HIGH            |
| `telemetry`         | Event system, registry, 4 providers                           | 10+          | HIGH            |
| `ui`                | Shared UI (WizardShell, FlowPlayer)                           | 15+          | GOOD            |
| `i18n`              | Translation system                                            | 5+           | GOOD            |
| `types`             | Shared type definitions                                       | 5+           | GOOD            |
| `design-tokens`     | Theme tokens (colors, spacing, radius, shadows)               | 4            | GOOD            |
| `utils`             | Shared utilities                                              | 3+           | BASIC           |
| `shift-clock`       | Shift clock state machine, GPS, breaks                        | 10+          | HIGH (21 tests) |
| `hms`               | HMS module types and logic                                    | 5+           | GOOD            |
| `walkAi`            | Walk AI integration                                           | 5+           | GOOD            |
| `walkieTalkie`      | Communication layer                                           | 5+           | GOOD            |
| `notifications`     | Notification types                                            | 3+           | BASIC           |
| `website`           | Website builder types                                         | 3+           | BASIC           |
| `agent-sdk`         | Agent SDK                                                     | 5+           | GOOD            |
| `docs-pipeline`     | Documentation pipeline                                        | 3+           | BASIC           |
| `eslint-config`     | Shared ESLint config                                          | 1            | INFRA           |
| `typescript-config` | Shared tsconfig                                               | 1            | INFRA           |

### 8.2 Key Observations

- **`packages/ai`** is the most complex — agents, capabilities, tools, adapters, context, engine, generators, journey, missions, prompts, router, schemas, tools
- **`packages/shift-clock`** is the best tested — 21 unit tests covering state machine, GPS, breaks, points
- **`packages/telemetry`** is well-architected — 4 provider destinations, registry-driven routing
- **`packages/design-tokens`** is clean — single source of truth with CSS/native outputs
- **No tests** found in most packages (only shift-clock has tests)
- Turborepo config: 27 tasks defined, 12 cached in last run

### 8.3 Package Dependencies

- `ai` depends on `supabase`, `telemetry`, `types`
- `ui` depends on `design-tokens`, `i18n`
- `shift-clock` depends on `types`
- No circular dependencies detected

---

## 9. API & Edge Functions

### 9.1 Edge Functions — 38 Total

| Category            | Functions                                                                                                                                                                                                               | Count |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Auth & Identity** | accept-invitation, create-invitation, activate-workspace, finalize-workspace                                                                                                                                            | 4     |
| **Intelligence**    | analyze-workspace, analyze-setup-documents, extract-workspace-data, gather-workspace-intelligence, google-places-intelligence, identify-company, scrape-raw-data, scrape-website, search-brreg, web-search-intelligence | 10    |
| **Engine**          | engine-dispatch, fire-delayed-triggers, emma-task-trigger                                                                                                                                                               | 3     |
| **Operations**      | process-settlement-image, validate-settlement, shift-clock-compliance                                                                                                                                                   | 3     |
| **Cascade**         | bootstrap-cascade, apply-change-proposal                                                                                                                                                                                | 2     |
| **Communications**  | sendgrid-webhook, push-dispatch, call-command                                                                                                                                                                           | 3     |
| **Voice**           | livekit-token, livekit-webhook                                                                                                                                                                                          | 2     |
| **API Gateway**     | workspace-api, validate-api-key, cleanup-api-keys                                                                                                                                                                       | 3     |
| **Contracts**       | contract-lifecycle                                                                                                                                                                                                      | 1     |
| **Monitoring**      | guardian-actions, guardian-notify, guardian-sweep, health-check, watchdog-integrity, watchdog-uptime                                                                                                                    | 6     |
| **Leader**          | leader-pulse                                                                                                                                                                                                            | 1     |

### 9.2 Workspace API Gateway

Routes registered in `workspace-api/index.ts` with scoped access:

- `profiles:read`, `organization:read`, `schedules:read/write`, `operations:read`
- `reports:read`, `guardian:read`, `events:read`, `suppliers:read`
- `waste:read`, `equipment:read`, `training:read`, `contracts:read`

### 9.3 Services — 5 Microservices

| Service          | Framework | Port | Purpose                      |
| ---------------- | --------- | ---- | ---------------------------- |
| stage-engine     | Hono      | 5010 | AI workflow runtime          |
| shift-mcp        | Hono      | 5011 | Schedule MCP protocol        |
| contract-service | Fastify   | 5012 | DocuSeal contract management |
| scrapling        | Python    | 8000 | Web scraping service         |
| interview-mcp    | —         | —    | Interview anchor (MCP)       |

### 9.4 Database

- **200 migrations** (00001-00013 sequential + timestamped)
- **~213 tables** across schemas: public (170+), payroll, websites, timesheet
- **124 custom enums**
- **RLS on all workspace-scoped tables**

---

## 10. Cascade Core Architecture — Implementation Status

### 10.1 Phase Status

| Phase | Description                     | Status      | Completion |
| ----- | ------------------------------- | ----------- | ---------- |
| A     | Schema (tables, enums, RLS)     | DONE        | 100%       |
| B     | Pure Functions (9 functions)    | DONE        | 100%       |
| C     | Bootstrap & I1 Integration      | PARTIAL     | 70%        |
| D     | Adapters & External Integration | NOT STARTED | 0%         |
| E     | Control Plane Behavior          | NOT STARTED | 0%         |
| F     | Missing RPCs & Services         | PARTIAL     | 40%        |

### 10.2 Dimension Implementation

| Dimension                | Schema  | Pure Functions | UI      | Runtime | Overall |
| ------------------------ | ------- | -------------- | ------- | ------- | ------- |
| D1 Operational Envelope  | DONE    | DONE           | PARTIAL | PARTIAL | 60%     |
| D2 Resource Availability | DONE    | NONE           | WORKING | NONE    | 40%     |
| D3 Rules & Constraints   | DONE    | DONE           | WORKING | NONE    | 60%     |
| D4 Demand Signal         | DONE    | DONE           | WORKING | PARTIAL | 60%     |
| D5 Service Concept       | DONE    | EXISTS (buggy) | NONE    | NONE    | 30%     |
| D6 Production            | DONE    | DONE           | WORKING | WORKING | 80%     |
| C1 Observability         | DONE    | NONE           | PARTIAL | NONE    | 25%     |
| C2 Context               | PARTIAL | DONE           | WORKING | PARTIAL | 40%     |
| C3 Commercial            | DONE    | DONE           | WORKING | NONE    | 50%     |
| C4 Governance            | DONE    | DONE           | NONE    | NONE    | 35%     |
| K1a Industry             | DONE    | EXISTS         | PARTIAL | PARTIAL | 50%     |
| K1b Workspace            | DONE    | NONE           | WORKING | NONE    | 35%     |

### 10.3 Known Critical Gaps

1. **hospitality.ts tariff rates are WRONG** — kveldstillegg: 56 should be 15.65, helgetillegg: 56 should be 29.74
2. **Framework seed missing** — hospitality.no.default.v1 not populated
3. **C1 EWMA calibration** — no correction loop
4. **C4 change proposal lifecycle** — preview exists, apply does not
5. **Handbook-to-RAG pipeline missing** — chapters not chunked into workspace_doc_chunk
6. **Shift publish -> Session flow untested** end-to-end

---

## 11. The 10 Original Gaps — Status

| #   | Gap                                  | Status  |
| --- | ------------------------------------ | ------- |
| 1   | No Event Emission                    | CLOSED  |
| 2   | Two Disconnected Event Systems       | CLOSED  |
| 3   | No Completion Tracking               | CLOSED  |
| 4   | No Per-Step Instance Tracking        | CLOSED  |
| 5   | Schedule -> Operations Disconnect    | PARTIAL |
| 6   | Invite -> Trainee Dead End           | CLOSED  |
| 7   | Employee Pages Are Shells            | CLOSED  |
| 8   | Document Mode Has No Reader          | PARTIAL |
| 9   | Governance Has No CRUD               | CLOSED  |
| 10  | No Session Hooks / Operational Tasks | CLOSED  |

**8 of 10 gaps closed.** Two remain partial (schedule->ops flow, handbook RAG).

---

## 12. Active Work & In-Flight Features

### 12.1 Active Worktrees

| #    | Branch                            | Module         | Status                           |
| ---- | --------------------------------- | -------------- | -------------------------------- |
| wt-1 | `feat/notification-system`        | communications | In progress — 13-task plan ready |
| wt-3 | `feat/emma-arena-views`           | walkAi         | Spec + mockups done              |
| wt-5 | `feat/hospitality-framework-seed` | cascade        | In progress                      |

### 12.2 Parked Work

| Branch            | Status | Notes                     |
| ----------------- | ------ | ------------------------- |
| `feat/onboarding` | WIP    | FlowPlayer + alkohol flow |

### 12.3 Recent Closures (last 30 days)

35+ feature branches merged to development, including:

- Unified Wizard Shell, ShiftClock (web+mobile), HMS Phase 1, Cascade Foundation
- Season Creation Wizard, Governance Admin UI, Service Layer, Onboarding Showcase
- Infra Hardening, Mobile App V1 (13 phases)

---

## 13. Quality Signals

### 13.1 Type Safety

- **Typecheck: 27/27 GREEN** (1m52s, 12 cached)
- TypeScript strict mode across monorepo
- `database.types.ts` auto-generated from Supabase

### 13.2 Test Coverage

| Area                     | Tests                  | Status  |
| ------------------------ | ---------------------- | ------- |
| packages/shift-clock     | 21 tests, 8 test files | GOOD    |
| apps/web/src/lib/cascade | 8 test files           | GOOD    |
| apps/web (components)    | 0                      | MISSING |
| apps/mobile              | 0                      | MISSING |
| apps/landing             | 0                      | MISSING |
| apps/e2e (Playwright)    | Some specs             | PARTIAL |

**Test coverage is a critical gap.** Only cascade pure functions and shift-clock have unit tests.

### 13.3 Code Quality Markers

- **TODO/FIXME:** 51 total (39 web, 4 mobile, 3 landing, 5 packages) — reasonable
- **Commit discipline:** Conventional commits enforced via commitlint + husky
- **Co-Authored-By:** Consistent AI attribution on commits
- **No `any` types policy** enforced

### 13.4 Security

- RLS on all workspace-scoped tables
- API key system with SHA-256 hashing
- Dual-auth Edge Functions via `_shared/auth-middleware.ts`
- Vault wrappers for external secrets
- 1Password CLI for env management

---

## 14. Scoring Summary

| Area                       | Score  | Notes                                                                                   |
| -------------------------- | ------ | --------------------------------------------------------------------------------------- |
| **Architecture**           | 9/10   | Cascade Core (I1+6D+4C+K1a/K1b) is world-class. Deeply stress-tested by AI Council      |
| **Web Dashboard**          | 8/10   | 87 pages + 89 API routes = 176 total. Role-based routing, mission context, voice AI     |
| **Landing Page**           | 8.5/10 | 34 pages + 8 APIs, 6 demo journeys, voice assistant, dual language, rich analytics      |
| **Mobile App**             | 6/10   | 37 screens, 62 components, offline sync, push. Employee-strong, admin absent            |
| **Design Tokens**          | 6/10   | Good structure BUT tokens.ts/tokens.css mismatch (7+ values), 30+ hardcoded color files |
| **i18n**                   | 2/10   | Only 7% translated. 6 stub languages will break UI. Mobile 0% coverage                  |
| **Documentation**          | 9/10   | 742 files, 99.9% frontmatter compliance, 67 canonical docs. Exceptional                 |
| **API Layer**              | 8/10   | 38 EFs, 23 workspace-api routes, dual-auth, 704 RLS policies. Production-ready          |
| **Packages**               | 7/10   | 18 packages, 270 TS files. Zero README files. Only shift-clock has tests                |
| **Services**               | 7/10   | 5 services active, Docker multi-stage, health checks, Caddy reverse proxy               |
| **Test Coverage**          | 2/10   | Only shift-clock (21 tests) and cascade functions (8 test files)                        |
| **Security**               | 8/10   | RLS 91% coverage, Vault, SHA-256 API keys, 1Password, HSTS headers                      |
| **Type Safety**            | 9/10   | 27/27 typecheck GREEN, strict mode, only 2 `any` violations in entire monorepo          |
| **Cascade Implementation** | 6/10   | Phase A+B done, C partial, D+E not started. Schema + pure functions solid               |
| **Infrastructure**         | 8/10   | CI/CD pipeline, Docker compose, Caddy auto-HTTPS, 1Password env management              |

### Overall: 7.2/10 — Exceptionally ambitious, well-architected, approaching production readiness

---

## 15. Priority Recommendations

### Tier 1 — Blocking Production Launch

1. **Fix hospitality.ts tariff rates** — current rates are wrong and will cause payroll errors
2. **Seed framework** (hospitality.no.default.v1) — regulatory rules not populated
3. **Add basic test coverage** — at minimum, E2E tests for critical paths (login, shift clock, payroll)
4. **Validate cascade migrations** — run `supabase db reset` to confirm all 200 migrations apply cleanly

### Tier 2 — User-Facing Quality

5. **i18n extraction sprint** — extract top 200 hardcoded dashboard strings
6. **Mobile feature parity** — add schedule detail, operations summary, settings for managers
7. **Add motion tokens** — spring physics documented but not in token system
8. **Sync mobile theme** with design-tokens package
9. **Build notification system** — spec and plan ready, critical for user engagement

### Tier 3 — Platform Maturity

10. **Control plane runtime** — C1 EWMA calibration, C4 change proposal lifecycle
11. **Handbook-to-RAG pipeline** — enable semantic search over workspace docs
12. **Shift publish -> Session** end-to-end test
13. **API documentation** — OpenAPI spec for workspace-api
14. **Add missing language files** — sv, da, pl for Nordic expansion
15. **CI/CD hardening** — test coverage gates, automated E2E on PR

---

## 16. Appendix: File Counts by Area

```
apps/web/src          680 .tsx files
apps/mobile/src        69 .tsx files
apps/landing          114 .tsx files
packages/             18 packages
supabase/functions/    38 Edge Functions
supabase/migrations/  200 SQL files
services/               5 microservices
docs/                 742 .md files
  decisions/           63 ADRs
  journeys/            57 journey files
  worklogs/            73 worklogs
  modules/             24 module docs
  learnings/           19 learning files
```

---

_Generated by Claude Opus 4.6 (1M context) on 2026-03-24._
_9 parallel audit agents + direct analysis across all repo areas._
