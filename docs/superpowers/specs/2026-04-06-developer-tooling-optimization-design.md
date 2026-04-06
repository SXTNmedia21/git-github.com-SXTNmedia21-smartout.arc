---
title: Developer Tooling Optimization
status: draft
updated: 2026-04-06
created: 2026-04-06
module: developer-experience
tags: [skills, plugins, mcp, hooks, optimization, cleanup, claude-mem]
---

# Developer Tooling Optimization

## Summary

Full audit and optimization of Claude Code skills, plugins, MCP servers, and session memory for the Smartout monorepo. Four-stage approach: Value → Cleanup → CLAUDE.md Slimming → Verification.

**Core design decision:** Skills are the authoritative source for domain knowledge. CLAUDE.md is slimmed to core rules only. Content moves FROM CLAUDE.md INTO skills, not the other way around. This reduces always-loaded context and ensures domain knowledge is only loaded when triggered.

**Council verdict:** APPROVE WITH CHANGES (2026-04-06). All council feedback incorporated.

**Audit findings:**

- 45 skills on disk (18 irrelevant, 6 need Smartout-update + repo migration)
- 14 plugins (2 duplicates)
- 18 MCP servers (6 irrelevant, 1 needs auth, 2 missing)
- 10 agents (good, but frontend-designer prompt needs post-cleanup update)
- Hooks and CI/CD (solid, no changes needed)

**Target state:**

- 15 repo-local skills (from 4) — authoritative domain sources
- 16 global skills (from 41) — infrastructure + tech reference
- 13 active MCP servers (from 18) — including claude-mem worker
- 1 new plugin (claude-mem) — persistent session memory
- 0 duplicate plugins (from 2)
- CLAUDE.md slimmed from ~350 lines to ~150 lines

---

## Stage 1: VALUE — New Capabilities

Each sub-stage is independent. Failure in one does not block others.

### 1.1 Authenticate Linear MCP

Linear MCP is installed but not authenticated. Run OAuth flow.

**Action:** Run `mcp__plugin_linear_linear__authenticate`

### 1.2 Install claude-mem Plugin

[thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) (v6.5.0) — automatic session memory that captures tool usage, compresses with AI, and injects relevant context into future sessions.

**Why:** Replaces manual `remembering-conversations` skill. Provides persistent cross-session context automatically via hooks + MCP tools + SQLite.

**Installation:**

```bash
npx claude-mem install
```

**What it adds:**

- 5 lifecycle hooks: SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd
- 4 MCP tools: search, timeline, get_observations, + 1 more
- 1 skill: mem-search (auto-invokes on "what did we do last session?")
- Worker service on port 37777 (web viewer UI)
- SQLite DB at `~/.claude-mem/claude-mem.db`

**Requirements:** Node.js 18+ (already met), Bun (auto-installed), uv (auto-installed)

**Consideration:** Verify no hook conflicts with existing SessionStart (preflight-json.sh) and PostToolUse (metadata-updater.sh) hooks. claude-mem hooks should coexist — they are additive, not replacing.

**Post-install:** After installing, `remembering-conversations` global skill becomes redundant and can be removed in Stage 2.

### 1.3 Install Missing MCP Servers

#### n8n MCP

n8n is core to Smartout's automation (Docker service, env vars, webhooks). Adding n8n MCP connects existing `n8n-workflow-patterns` skill to actual workflow management.

**Config in `.claude/settings.local.json`:**

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["@n8n/mcp-server"],
      "env": {
        "N8N_HOST": "${N8N_HOST}",
        "N8N_BASIC_AUTH_USER": "${N8N_BASIC_AUTH_USER}",
        "N8N_BASIC_AUTH_PASSWORD": "${N8N_BASIC_AUTH_PASSWORD}"
      }
    }
  }
}
```

**Secrets:** All three env vars must use `op://` references in `.env.template`. Add to `docs/reference/ENV_VARS.md`. Run via `op run --env-file=.env.template`.

#### Sentry MCP

Error tracking — enables querying errors and correlating with code changes from Claude.

**Config in `.claude/settings.local.json`:**

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["@sentry/mcp-server"],
      "env": {
        "SENTRY_AUTH_TOKEN": "${SENTRY_AUTH_TOKEN}"
      }
    }
  }
}
```

**Secrets:** `SENTRY_AUTH_TOKEN` must use `op://` reference. Add to `.env.template` and `docs/reference/ENV_VARS.md`.

### 1.4 Create New Smartout Authority Skills (repo-local)

These skills are the AUTHORITATIVE SOURCE for their domain. Content is moved FROM CLAUDE.md INTO these skills, not duplicated. Each skill includes a `# Last synced: YYYY-MM-DD` header for staleness detection.

#### `smartout-database-guide`

**Trigger:** Any work touching database tables, schemas, enums, RLS, migrations.
**Content (authoritative — removed from CLAUDE.md):**

- Schema map: public (169 tables), payroll (23), websites (13), timesheet (1)
- All critical traps (user_identity, profile.display_name, contract_status, etc.)
- RLS pattern templates (JWT + API key dual policy)
- Enum reference workflow (check database.types.ts first)
- Migration workflow (never ALTER directly, always migration file)
- Schema placement decision tree (when public vs dedicated schema)
- Common joins (profile → user_identity, company → workspace, etc.)
- Schema brainstorm requirement (every feature must discuss schema placement)

**Source files:** `docs/reference/DATABASE.md`, `packages/supabase/src/database.types.ts`
**Size:** ~200 lines
**CLAUDE.md impact:** Remove "Database — Critical Traps", "Database — Architecture Rules", "Database Migrations" sections (~60 lines). Replace with one-liner: "Database: see `smartout-database-guide` skill."

#### `smartout-cascade-developer`

**Trigger:** Any work touching cascade tables, dimensions, control planes, scheduling, season planning.
**Content (authoritative):**

- I1 Industry Intelligence Bootstrap (pre-runtime layer)
- D1-D6 Execution Dimensions with table mapping
- C1-C4 Control Planes with "Confident != Authorized" principle
- K1a/K1b Knowledge Substrate
- Cascade provenance rules (source_type + source_id)
- Domain Concepts (department session, session hooks, readiness, trainee mode, season, event engine)
- Implementation status (Phase A done, B partial, C in progress, D not started)
- Triple operating hours trap

**Source files:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
**Size:** ~200 lines
**CLAUDE.md impact:** Remove "Cascade Core Model" and "Domain Concepts" sections (~80 lines). Replace with one-liner.
**Gate:** System Steward reviews content before shipping — cascade guidance must be accurate.

#### `smartout-edge-function-guide`

**Trigger:** Any work creating or modifying Edge Functions, API endpoints, dual-auth, scopes.
**Content (authoritative):**

- Auth pattern decision tree (JWT-only vs dual-auth vs cron-only)
- `_shared/auth-middleware.ts` usage (never roll your own)
- `config.toml` rules (verify_jwt = false requires entry)
- Scope guard checklist (requireScope() before every query)
- Canonical scope list (15 scopes)
- Gateway pattern: external consumers → Edge Function → service
- New endpoint checklist: handler → route registration → API registry → scope
- Service authentication rules (managed service keys)

**Source files:** `supabase/functions/`, `supabase/functions/config.toml`
**Size:** ~120 lines
**CLAUDE.md impact:** Remove "API Gateway — Mandatory Checklists" section (~60 lines). Replace with one-liner.

#### `smartout-nordic-split`

**Trigger:** Any UI work, component building, animation, styling, design tokens.
**Content (authoritative — not in CLAUDE.md today, fills a gap):**

- OKLCH warm palette with exact CSS variable names (hue 50-60)
- Spring physics presets: stiffness 30-45, damping 20-24, mass 2-2.5 (NOT framer-motion-animator defaults of 300)
- Font stack: Instrument Serif (headings, `font-heading`), Geist Sans (body), Geist Mono (data)
- Glassmorphism recipe (blur values, noise overlay, 1px gradient borders)
- Orb construction rules (radial-gradient, not blur blobs)
- Tailwind v4 CSS-based config patterns (no tailwind.config.ts)
- "40% reduction" principle (strip borders/boxes, replace with space and light)
- Icons: Lucide React only. No emojis in UI.
- File references: `docs/design/ren-og-varm-styleguide.html`, `packages/design-tokens/src/tokens.ts`

**Size:** ~150 lines
**CLAUDE.md impact:** Remove detailed "UI & Styling" content (~30 lines). Keep font names and "read styleguide" pointer.
**Rationale:** Council identified that framer-motion-animator has wrong spring values (300 vs 30-45) and no skill covers Nordic Split specifics. This prevents agents from producing technically correct but visually off-brand UI.

---

## Stage 2: RYDD — Cleanup

### 2.1 Remove 18 Irrelevant Skills

Delete from `~/.claude/skills/`:

| Skill                       | Lines | Reason                                        |
| --------------------------- | ----- | --------------------------------------------- |
| `gsap-core`                 | 254   | Smartout uses Framer Motion                   |
| `gsap-timeline`             | 107   | Not in use                                    |
| `gsap-utils`                | 284   | Not in use                                    |
| `gsap-plugins`              | 426   | Not in use                                    |
| `gsap-scrolltrigger`        | 296   | Not in use                                    |
| `gsap-performance`          | 79    | Not in use                                    |
| `flow-authoring`            | 292   | FlowPlayer not in Smartout                    |
| `board-ops`                 | ?     | Unknown/compressed, stale                     |
| `board-ops-extracted`       | 0     | Empty file                                    |
| `sixten-protocol`           | 0     | Empty directory, removed in CLAUDE.md v3.2.0  |
| `remembering-conversations` | 202   | Replaced by claude-mem plugin                 |
| `n8n-code-javascript`       | 4468  | Overkill — n8n-workflow-patterns covers needs |
| `n8n-code-python`           | 4205  | Python in n8n not relevant                    |
| `n8n-expression-syntax`     | 1485  | Covered by workflow-patterns                  |
| `n8n-mcp-tools-expert`      | 2175  | Covered by workflow-patterns                  |
| `n8n-node-configuration`    | 2851  | Covered by workflow-patterns                  |
| `n8n-validation-expert`     | 2642  | Covered by workflow-patterns                  |

Delete from `.claude/skills/` (after verifying plugin parity):

| Skill                       | Reason              | Pre-condition                                                             |
| --------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `ui-ux-pro-max` (repo copy) | Duplicate of plugin | Verify plugin has data/ and scripts/ directories. If not, keep repo copy. |

Commit 5 already-deleted skill files from git working tree:

- `.claude/skills/agent-scoring-SKILL.md`
- `.claude/skills/journey.md`
- `.claude/skills/mission-training.md`
- `.claude/skills/mission.md`
- `.claude/skills/roadmap.md`

**Total removed: ~20,000+ lines**

### 2.2 Move + Update 6 Skills to Repo

Move from `~/.claude/skills/` to `.claude/skills/` and update content against actual codebase state:

#### `secrets-protocol`

- Verify vault names match actual 1Password vaults (`smartout_ai_dev`, `smartout_ai_prod`)
- Verify op:// references match `.env.template`
- Add n8n and Sentry credentials (from Stage 1)
- Absorb Security section from CLAUDE.md (Three Laws, API key tiers, env vars)

#### `linear-protocol`

- Sync label taxonomy against actual Linear workspace
- Verify team structure and project IDs
- Update emoji system if changed

#### `project-lifecycle`

- Verify Epic/Story structure against current Linear setup
- Verify 4-track model (A/B/C/D) is still active
- Sync branching rules with CLAUDE.md git workflow

#### `smartout-agent-dev` (FULL REWRITE — separate branch + steward verification)

This is NOT a sync — the skill is severely out of date. Separate task with own branch.

Rewrite scope:

- Rebuild capability registry table from actual `packages/ai/src/capabilities/*/` (6 active: profile, ui, guardian, schedule, operations, communication — NOT 1 as currently documented)
- Read every `capabilities/*/tools.ts` to rebuild tool index
- Add `packages/ai/src/agents/*.ts` persona section (contract, docs, journey, onboarding, reports, schedule)
- Add `packages/ai/src/industry/` I1 bootstrap section
- Fix ports: stage-engine 5010, shift-mcp 5011, contract-service 5012 (NOT 3000/3001/3100)
- Update "How to Add a New Capability" guide
- Ensure consistency with `walkai-bridge-builder` agent instructions

#### `task-stacking`

- Verify Path/Operation/Stack labels exist in Linear
- Update file path patterns for current monorepo structure

#### `project-development`

- Add Smartout context: agent architecture, n8n as orchestration, Supabase state
- Reference cascade model for pipeline design

### 2.3 Remove Duplicate Plugins

From `~/.claude/plugins/installed_plugins.json` (path: `~/.claude/plugins/installed_plugins.json`):

| Plugin            | Remove from               | Keep from                             |
| ----------------- | ------------------------- | ------------------------------------- |
| `code-review`     | `claude-plugins-official` | `claude-code-plugins` (has subagents) |
| `frontend-design` | `claude-plugins-official` | `claude-code-plugins` (has subagents) |

### 2.4 Deactivate Irrelevant MCP Servers

These are plugin-provided MCP servers in `~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/`. Deactivate by removing or disabling the plugin config.

| Server        | Reason                                      |
| ------------- | ------------------------------------------- |
| Firebase      | Not in Smartout tech stack                  |
| Laravel Boost | PHP — not in stack                          |
| Terraform     | Not used for infra (Docker Compose + Caddy) |
| Asana         | Linear is the PM tool                       |
| GitLab        | GitHub is the VCS                           |
| iMessage      | macOS only, not relevant                    |

No agent impact — confirmed by Agent Coordinator.

### 2.5 Fix 5 Symlinks

Copy actual files from `/mnt/c/Users/sxtnl/.agents/skills/` into `~/.claude/skills/` to eliminate Windows WSL path dependency:

1. `framer-motion-animator`
2. `web-design-guidelines`
3. `vercel-react-best-practices`
4. `vercel-composition-patterns`
5. `vercel-react-native-skills`

### 2.6 Update Agent Definitions

After skill cleanup, update `.claude/agents/frontend-designer.md`:

- Remove `gsap-core` reference
- Update `ui-ux-pro-max` to reference plugin version
- Add `smartout-nordic-split` skill reference
- Clarify: "Use frontend-design plugin for creative exploration. Use Nordic Split skill + design docs for implementation. When they conflict, Nordic Split wins."

### 2.7 Update tool-index

Update `~/.claude/skills/tool-index/` to reflect:

- Added MCP servers (n8n, Sentry, claude-mem)
- Removed MCP servers (Firebase, Laravel, Terraform, Asana, GitLab, iMessage)

---

## Stage 3: CLAUDE.md SLIMMING

### Principle

Skills are authoritative. CLAUDE.md keeps only what EVERY session needs.

### What stays in CLAUDE.md (~150 lines)

- Project Identity (5 lines)
- Source of Truth hierarchy (10 lines)
- Tech Stack (5 lines)
- Monorepo Structure (15 lines)
- Data Model overview (20 lines — entity names and relationships only, no traps)
- Code Conventions (25 lines — naming, patterns, readability)
- Protocols table (5 lines — pointers to protocol files)
- What NOT To Do (20 lines — critical rules only)
- Dev Commands (15 lines)
- Orchestrator Mode (15 lines)
- Changelog (15 lines)

### What moves OUT of CLAUDE.md → INTO skills

| CLAUDE.md Section                  | Lines | Moves to skill                 |
| ---------------------------------- | ----- | ------------------------------ |
| Database — Architecture Rules      | ~15   | `smartout-database-guide`      |
| Database — Critical Traps          | ~30   | `smartout-database-guide`      |
| Database Migrations                | ~10   | `smartout-database-guide`      |
| Cascade Core Model                 | ~50   | `smartout-cascade-developer`   |
| Domain Concepts                    | ~30   | `smartout-cascade-developer`   |
| API Gateway — Mandatory Checklists | ~60   | `smartout-edge-function-guide` |
| Security — Always Enforced         | ~40   | `secrets-protocol`             |
| UI & Styling (detailed)            | ~25   | `smartout-nordic-split`        |

**Total moved: ~260 lines → CLAUDE.md drops from ~350 to ~150 lines**

### Replacement pattern

Each removed section gets a one-liner:

```markdown
**Database rules:** See `smartout-database-guide` skill (triggered on any DB work).
**Cascade model:** See `smartout-cascade-developer` skill (triggered on cascade/scheduling work).
**API Gateway:** See `smartout-edge-function-guide` skill (triggered on Edge Function work).
**Security:** See `secrets-protocol` skill (triggered on secrets/auth work).
**Design system:** See `smartout-nordic-split` skill (triggered on any UI work).
```

---

## Stage 4: KONTROLL — Verification

### 4.1 System Check

- [ ] Run SessionStart preflight (`bash apps/web/scripts/preflight-json.sh`)
- [ ] Verify all MCP servers respond (Linear authenticated, n8n connected, Sentry connected)
- [ ] Verify claude-mem worker running (`curl http://localhost:37777`)
- [ ] Verify no broken symlinks in `~/.claude/skills/`
- [ ] Verify no hook conflicts (preflight + metadata-updater + claude-mem hooks coexist)
- [ ] Verify all repo-local skills have valid frontmatter + `# Last synced:` header

### 4.2 Skill Trigger Test

For each repo-local skill, verify trigger conditions work:

| Skill                          | Test trigger                           |
| ------------------------------ | -------------------------------------- |
| `smartout-database-guide`      | "Add a new table for X"                |
| `smartout-cascade-developer`   | "Work on cascade scheduling"           |
| `smartout-edge-function-guide` | "Create a new Edge Function"           |
| `smartout-nordic-split`        | "Build a new dashboard card component" |
| `secrets-protocol`             | "Add a new API key"                    |
| `linear-protocol`              | "Log this decision in Linear"          |
| `project-lifecycle`            | "Start a new Epic"                     |
| `smartout-agent-dev`           | "Add a capability to the agent"        |
| `task-stacking`                | "Find related tasks for this file"     |
| `project-development`          | "Design a new pipeline"                |
| `protocol-writer`              | "Build a new journey package"          |
| `journey-test`                 | "Write E2E test for journey"           |
| `journey-manual-test`          | "Manual test this journey"             |

### 4.3 CLAUDE.md Verification

- [ ] CLAUDE.md is under 200 lines
- [ ] All skill pointers resolve to actual skills
- [ ] No duplicated content between CLAUDE.md and skills
- [ ] `claude-md-management:claude-md-improver` runs clean

### 4.4 Plugin Verification

- [ ] No duplicate plugins in `~/.claude/plugins/installed_plugins.json`
- [ ] All enabled plugins load without errors
- [ ] claude-mem plugin active with hooks registered
- [ ] superpowers plugin is latest version

### 4.5 Cross-Verify Agent Definitions

After `smartout-agent-dev` rewrite:

- [ ] `system-agent-coordinator.md` references match current `packages/ai/` paths
- [ ] `walkai-bridge-builder.md` references match current capability patterns
- [ ] `frontend-designer.md` updated (no gsap-core, has nordic-split)

### 4.6 Update Memory

Update `MEMORY.md` with:

- New skill inventory (15 repo + 16 global)
- MCP server list (13 active)
- claude-mem installation status
- CLAUDE.md slimming date
- Date of last tooling audit

---

## Final State

### Repo-local skills (15) — AUTHORITATIVE domain sources

```
.claude/skills/
├── journey-test/SKILL.md                (existing)
├── journey-manual-test/SKILL.md         (existing)
├── protocol-writer/                     (existing, 4 parts)
├── smartout-database-guide/SKILL.md     (NEW — authority for DB)
├── smartout-cascade-developer/SKILL.md  (NEW — authority for cascade)
├── smartout-edge-function-guide/SKILL.md (NEW — authority for EFs)
├── smartout-nordic-split/SKILL.md       (NEW — authority for design)
├── secrets-protocol/SKILL.md            (MOVED — authority for security)
├── linear-protocol/SKILL.md             (MOVED + UPDATED)
├── project-lifecycle/SKILL.md           (MOVED + UPDATED)
├── smartout-agent-dev/SKILL.md          (MOVED + REWRITTEN — separate branch)
├── task-stacking/SKILL.md               (MOVED + UPDATED)
└── project-development/SKILL.md         (MOVED + UPDATED)
```

### Global skills (16)

```
~/.claude/skills/
├── using-superpowers/            (infrastructure)
├── working-with-claude-code/     (infrastructure)
├── writing-skills/               (infrastructure)
├── command-development/          (infrastructure)
├── hook-development/             (infrastructure)
├── agent-development/            (infrastructure)
├── mcp-integration/              (infrastructure)
├── find-skills/                  (infrastructure)
├── claude-api/                   (infrastructure, plugin-provided)
├── framer-motion-animator/       (tech reference)
├── vercel-react-best-practices/  (tech reference)
├── vercel-composition-patterns/  (tech reference)
├── vercel-react-native-skills/   (tech reference)
├── n8n-workflow-patterns/        (tech reference)
├── web-design-guidelines/        (tech reference)
├── deploying/                    (Smartout deploy)
├── email-writer/                 (communication)
├── run-council/                  (architecture review)
└── tool-index/                   (MCP mapping, UPDATED)
```

Note: `deploying` and `run-council` are Smartout-specific but stay global for now. Council recommended moving to repo-local in a separate PR.

### Active MCP servers (13)

| Server     | Transport | Purpose                              |
| ---------- | --------- | ------------------------------------ |
| Supabase   | HTTP      | Database, migrations, Edge Functions |
| Linear     | HTTP      | Issue tracking, project management   |
| GitHub     | HTTP      | VCS, PRs, issues                     |
| Slack      | HTTP      | Team communication                   |
| Context7   | Command   | Library documentation                |
| Playwright | Command   | Browser automation, E2E              |
| Greptile   | HTTP      | Code search                          |
| Discord    | Command   | Community                            |
| Telegram   | Command   | Messaging                            |
| Serena     | Command   | Code analysis                        |
| n8n        | Command   | Workflow automation (NEW)            |
| Sentry     | Command   | Error tracking (NEW)                 |
| claude-mem | Worker    | Session memory (NEW, port 37777)     |

### Plugins (13, no duplicates)

| Plugin               | Source                      |
| -------------------- | --------------------------- |
| context7             | claude-plugins-official     |
| linear               | claude-plugins-official     |
| supabase             | claude-plugins-official     |
| vercel               | claude-plugins-official     |
| github               | claude-plugins-official     |
| claude-md-management | claude-plugins-official     |
| superpowers          | claude-plugins-official     |
| agent-sdk-dev        | claude-code-plugins         |
| feature-dev          | claude-code-plugins         |
| code-review          | claude-code-plugins         |
| frontend-design      | claude-code-plugins         |
| ui-ux-pro-max        | ui-ux-pro-max-skill         |
| claude-mem           | thedotmack/claude-mem (NEW) |

---

## Implementation Notes

### Separate branches

| Work                               | Branch                         | Gate                            |
| ---------------------------------- | ------------------------------ | ------------------------------- |
| Stage 1 + 2 + 3 (except agent-dev) | `feat/tooling-optimization`    | Standard review                 |
| `smartout-agent-dev` rewrite       | `feat/agent-dev-skill-rewrite` | System Steward verifies content |
| `deploying` + `run-council` move   | Future PR                      | Not blocking                    |

### Scope boundary

This spec touches ONLY:

- `~/.claude/skills/` (global skills)
- `.claude/skills/` (repo-local skills)
- `.claude/settings.local.json` (MCP config)
- `~/.claude/plugins/installed_plugins.json` (plugin dedup)
- `.claude/agents/frontend-designer.md` (reference update)
- `CLAUDE.md` (slimming)
- `docs/reference/ENV_VARS.md` (new MCP credentials)
- `.env.template` (new op:// references)

It does NOT touch application code, database schema, hooks config, CI/CD, or any runtime behavior.

### Council learnings

- **Pointer skills beat content duplication** — but authority skills (content lives IN the skill, removed from CLAUDE.md) beat both. Single source of truth per domain.
- **Plugin-provided skills (claude-api) cannot be managed as file-based skills** — track separately.
- **Spring physics defaults in generic skills can produce wrong-brand output** — always override with project-specific values via a design system skill.
