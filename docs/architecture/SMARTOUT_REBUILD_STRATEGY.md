# SMARTOUT — Clean-Slate Rebuild Strategy

> **Purpose:** Guide the full rebuild of Smartout using Cursor + Claude Code
> **Date:** February 24, 2026
> **Author:** Pontus (via Claude planning session)

---

## 1. The Situation

You have ~350KB of detailed functional documentation across 12 files covering 14 modules, ~150 subcategories, 11 core data types, 8 AI engines, and complete database schemas. This is an enormous advantage — most projects start with a napkin sketch. You're starting with a blueprint.

The challenge: Cursor and Claude Code are powerful but need **structured context** to produce consistent, high-quality code across a system this large. Without proper prompting infrastructure, each coding session starts from zero and produces inconsistent results.

---

## 2. Recommended Approach: "Layered Context Architecture"

### The Problem with Dumping Everything

Your documentation is ~350KB. That won't fit in a single prompt context window. Even if it did, the AI would lose focus. The solution is a **layered system** where each coding session gets exactly the context it needs.

### The Three Layers

```
LAYER 1: SYSTEM PROMPT (always loaded)
├── Product identity, tech stack, conventions
├── Database naming rules, TypeScript patterns
├── File structure and import conventions
└── ~2-3KB — fits in any system prompt

LAYER 2: MODULE CONTEXT (loaded per task)
├── The specific module documentation
├── Relevant core architecture sections
├── Database schemas for tables being touched
└── ~15-30KB — loaded via Cursor rules or .md reference

LAYER 3: TASK CONTEXT (per coding session)
├── The specific story/issue being worked on
├── Acceptance criteria
├── Related files already in the codebase
└── ~2-5KB — provided in the prompt
```

### Why This Works

- **Layer 1** ensures every file follows the same conventions (naming, patterns, error handling)
- **Layer 2** ensures the AI understands the domain it's working in (e.g., "what is a Department Session?")
- **Layer 3** ensures the AI knows exactly what to build right now

---

## 3. Recommended File Structure

```
smartout/
├── .cursor/
│   └── rules/                    # Cursor rules (auto-loaded context)
│       ├── smartout-system.mdc   # Layer 1: Always-on system prompt
│       ├── core-schema.mdc       # Core database schemas
│       └── conventions.mdc       # Code conventions & patterns
│
├── docs/                         # All documentation (Layer 2 source)
│   ├── architecture/
│   │   ├── CORE_ARCHITECTURE.md  # Core data model, governance
│   │   ├── UI_ARCHITECTURE.md    # Screen inventory, personas
│   │   └── SYSTEM_INDEX.md       # Full module index
│   │
│   ├── modules/
│   │   ├── MODULE_01_ONBOARDING.md
│   │   ├── MODULE_02_ORG_STRUCTURE.md
│   │   ├── MODULE_03_SCHEDULING.md
│   │   ├── MODULE_04_OPERATIONS.md
│   │   ├── MODULE_05_HACCP.md
│   │   ├── MODULE_06_TRAINING.md
│   │   ├── MODULE_09_COMMUNICATION.md
│   │   └── MODULE_13_MULTITENANT.md
│   │
│   └── decisions/
│       ├── DECISIONS.md          # All architectural decisions
│       └── BUILD_ORDER.md        # Implementation sequence
│
├── supabase/
│   ├── migrations/               # SQL migrations (numbered)
│   │   ├── 00001_core_tables.sql
│   │   ├── 00002_governance_tables.sql
│   │   ├── 00003_rls_policies.sql
│   │   └── ...
│   ├── functions/                # Edge Functions
│   │   └── ...
│   └── seed.sql                  # Development seed data
│
├── apps/
│   ├── web/                      # Next.js dashboard
│   │   ├── src/
│   │   │   ├── app/              # App router pages
│   │   │   ├── components/       # UI components
│   │   │   ├── lib/              # Utilities, Supabase client, types
│   │   │   └── hooks/            # React hooks
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── mobile/                   # React Native + Expo
│       ├── src/
│       └── package.json
│
├── packages/                     # Shared code (monorepo)
│   ├── types/                    # TypeScript types (shared web + mobile)
│   │   └── src/
│   │       ├── core.ts           # Core entity types
│   │       ├── governance.ts     # Policy, Protocol, etc.
│   │       ├── operations.ts     # Sessions, tasks, hooks
│   │       ├── scheduling.ts     # Shifts, availability
│   │       └── enums.ts          # All option sets
│   │
│   ├── supabase/                 # Shared Supabase client & helpers
│   │   └── src/
│   │       ├── client.ts
│   │       ├── queries/          # Reusable query functions
│   │       └── rls-helpers.ts
│   │
│   └── utils/                    # Shared utilities
│       └── src/
│
├── CLAUDE.md                     # Claude Code system prompt
├── package.json                  # Monorepo root (pnpm workspaces)
├── turbo.json                    # Turborepo config
└── tsconfig.base.json
```

---

## 4. Recommended Build Order

### Phase 0: Foundation (Week 1-2)
**What:** Monorepo setup, Supabase project, core SQL migrations, shared types, auth
**Why:** Everything else depends on this. No module can function without core tables and auth.

| Step | Deliverable | Dependencies |
|------|------------|--------------|
| 0.1 | Monorepo scaffold (pnpm + Turborepo) | None |
| 0.2 | Supabase project + CLI setup | None |
| 0.3 | Core SQL migrations (User, Company, Workspace, Profile, Department, Location, Team, Season) | 0.2 |
| 0.4 | Governance SQL (Policy, Protocol, Procedure, Routine, Runbook, ControlList, KnowledgeTest, Confirmation) | 0.3 |
| 0.5 | Extension SQL (Zone, Asset, Position) | 0.3 |
| 0.6 | RLS policies (workspace isolation) | 0.3–0.5 |
| 0.7 | Shared TypeScript types package | 0.3–0.5 |
| 0.8 | Supabase client + auth helpers | 0.2 |
| 0.9 | Next.js scaffold with auth (login, signup) | 0.7, 0.8 |
| 0.10 | Seed data for development | 0.3–0.5 |

### Phase 1: Module 1 — Onboarding (Week 3-4)
**What:** Company creation, workspace setup, invite flow, profile creation
**Why:** You can't do anything without users in the system.

### Phase 2: Module 2 — Org Structure (Week 5-6)
**What:** Department, Location, Zone, Asset, Position, Team CRUD + UI
**Why:** The organizational skeleton that everything hangs on.

### Phase 3: Module 3 — Scheduling (Week 7-9)
**What:** Shift templates, shift creation, calendar UI, punch clock, availability
**Why:** Core daily operation — employees need shifts before sessions make sense.

### Phase 4: Module 4 — Operations (Week 10-13)
**What:** Department Sessions, hooks, session tasks, sign-off, Day Brief, handoffs
**Why:** The operational engine. This is the heart of the daily workflow.

### Phase 5: Module 5 — HACCP (Week 14-15)
**What:** Temperature logging, hygiene checklists, deviation handling, Mattilsynet reports
**Why:** Compliance requirement. Builds on Operations (session_task with HACCP category).

### Phase 6: Module 6 — Training (Week 16-17)
**What:** Protocol assignment, procedure completion, knowledge tests, confirmations, readiness scoring
**Why:** The "readiness" in Employee Readiness System.

### Phase 7: Module 9 — Communication (Week 18-19)
**What:** Team chat, notifications, announcements, escalations
**Why:** Connects all the operational pieces with real-time communication.

### Phase 8: Gamification + Season (Week 20-21)
**What:** Season activation, points, leaderboard, boosters/penalties
**Why:** Engagement layer on top of the operational foundation.

### Phase 9: Module 12 — AI Layer (Week 22-26)
**What:** Mr. Botsson, context engine, operation engine, onboarding engine
**Why:** The differentiator. Built last because it needs all other modules to have data to work with.

### Phase 10: Module 13 — Multi-tenant & Scaling (Week 27-28)
**What:** Stripe billing, plan limits, workspace switcher, super-admin
**Why:** Production readiness. RLS is already in place from Phase 0.

### Phase 11: Mobile App (Week 29-34)
**What:** React Native + Expo, core employee flows, punch clock, task board, chat
**Why:** Parallel track possible from Phase 4 onward, but listed here as focused sprint.

---

## 5. What To Build Now

Before any code is written, you need three files that power the entire rebuild:

1. **`CLAUDE.md`** — The master system prompt for Claude Code
2. **`.cursor/rules/smartout-system.mdc`** — The always-on Cursor rules file
3. **`docs/decisions/BUILD_ORDER.md`** — The implementation sequence with stories

These are provided as companion files to this strategy document.

---

## 6. How To Use This In Practice

### Starting a New Module

```
1. Open the module documentation (e.g., docs/modules/MODULE_04_OPERATIONS.md)
2. Reference it in your Cursor prompt: "Read docs/modules/MODULE_04_OPERATIONS.md"
3. Start with database migration
4. Then shared types
5. Then Edge Functions (API)
6. Then UI components
7. Then page assembly
8. Then tests
```

### Daily Workflow with Cursor

```
1. Pick a story from Linear (or BUILD_ORDER.md)
2. Open Cursor in the monorepo
3. The system rules auto-load (Layer 1)
4. Reference the relevant module doc (Layer 2)
5. Describe the specific task (Layer 3)
6. Review, test, commit
7. Log progress in Linear (per linear-protocol)
```

### Daily Workflow with Claude Code

```
1. Claude Code reads CLAUDE.md automatically
2. Give it the task: "Implement story 4.3 — session hooks"
3. It reads the referenced docs
4. It writes code following the conventions
5. Review, test, commit
```

---

## 7. Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Context window overflow | Layered context architecture — never dump everything |
| Inconsistent code across sessions | System prompt with strict conventions |
| Database drift between modules | Single migration folder, numbered sequentially |
| AI "forgetting" domain concepts | Comprehensive type definitions in shared package |
| Losing track of progress | Linear as source of truth (linear-protocol) |
| Scope creep per module | Stories with acceptance criteria in BUILD_ORDER.md |
| Mobile/web code duplication | Shared types + queries in packages/ |
