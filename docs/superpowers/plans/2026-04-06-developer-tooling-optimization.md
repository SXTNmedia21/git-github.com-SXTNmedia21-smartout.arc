# Developer Tooling Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize Smartout's Claude Code tooling — skills, plugins, MCP, session memory — and slim CLAUDE.md by moving domain content into authoritative skills.

**Architecture:** Three parallel tracks + one sequential finish. Track A creates repo-local authority skills. Track B cleans global skills/symlinks. Track C handles MCP/plugin config. After A+B+C converge, Track D slims CLAUDE.md (depends on skills existing). Agent-dev rewrite is a separate branch.

**Tech Stack:** Claude Code skills (markdown), MCP config (JSON), 1Password (op://), claude-mem plugin (npm)

**Spec:** `docs/superpowers/specs/2026-04-06-developer-tooling-optimization-design.md`

---

## Parallel Execution Map

```
Track A (repo — main repo)     Track B (global — any terminal)     Track C (config — any terminal)
├── Task 1: database-guide      ├── Task 5: delete 18 skills        ├── Task 8: MCP config
├── Task 2: cascade-developer   ├── Task 6: fix 5 symlinks          ├── Task 9: plugin dedup
├── Task 3: edge-function-guide ├── Task 7: commit deleted files     └── Task 10: claude-mem install
└── Task 4: nordic-split        │
                                └── (waits for Track A skills)
                                    Task 11: move 6 skills to repo
                                         ↓
                            Task 12: CLAUDE.md slimming (sequential)
                                         ↓
                            Task 13: update agent definitions
                                         ↓
                            Task 14: update tool-index
                                         ↓
                            Task 15: verification
                                         ↓
                            Task 16: smartout-agent-dev rewrite (separate branch)
```

**User manual steps (before agents start):**

1. Authenticate Linear MCP: run `mcp__plugin_linear_linear__authenticate` in Claude Code
2. Install claude-mem: run `npx claude-mem install` in terminal

---

## Track A: Create Authority Skills (repo-local)

### Task 1: Create smartout-database-guide skill

**Files:**

- Create: `.claude/skills/smartout-database-guide/SKILL.md`

- [ ] **Step 1: Create skill directory**

```bash
mkdir -p .claude/skills/smartout-database-guide
```

- [ ] **Step 2: Write SKILL.md**

````markdown
---
name: smartout-database-guide
description: Authoritative guide for Smartout database work — schemas, tables, enums, RLS, migrations, traps. Use when touching any database table, schema, enum, RLS policy, or migration.
tools: Read, Grep, Glob, Bash
---

# Last synced: 2026-04-06

# Smartout Database Guide

This skill is the AUTHORITATIVE source for database conventions. CLAUDE.md points here.

## Schema Map

| Schema      | Tables | Purpose              |
| ----------- | ------ | -------------------- |
| `public`    | 169    | Core + HMS + cascade |
| `payroll`   | 23     | Payroll domain       |
| `websites`  | 13     | Website factory      |
| `timesheet` | 1      | Time tracking        |

**Schema placement rule:** Every new feature MUST brainstorm schema placement. A dedicated schema is warranted when the domain has 5+ tables, distinct RLS patterns, or clear ownership boundary.

## Critical Traps

- Table is `user_identity`, NOT `user`. No `public.user` table exists.
- `profile` has `display_name` only — NOT `first_name`/`last_name`. Identity data lives on `user_identity`.
- Subscription data on `company` table. No `stripe_subscription` table.
- `contract_status` enum already taken by `employment_contract`. Don't reuse.
- 72 enums — check `packages/supabase/src/database.types.ts` before creating new ones.
- `database.types.ts` is auto-generated. Never edit manually.
- Season table has `status` enum (draft/active/archived) — NOT `is_active` boolean.
- `is_godmode` on `user_identity` gates all platform-admin access (renamed from `is_super_admin`).
- Triple operating hours: `company_opening_hours` (wizard intake), `operating_hours` (legacy — MUST migrate away), `department_operating_hours` (cascade runtime truth). Never read/write `operating_hours` in new code.
- `change_proposal_status` enum — do NOT confuse with `contract_status`.
- `tariff_rate_table.workspace_id` is nullable — platform-level rates have NULL workspace_id.

## RLS Patterns

Every workspace-scoped table needs BOTH auth paths:

**JWT policy:**

```sql
CREATE POLICY "jwt_read_{table}" ON {table}
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
```
````

**API key policy:**

```sql
CREATE POLICY "api_key_read_{table}" ON {table}
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );
```

Skip API key policies only for internal-only tables (platform-admin, audit logs).

## Enum Workflow

1. Check `packages/supabase/src/database.types.ts` for existing enums
2. Search: `grep -i "enum_name" packages/supabase/src/database.types.ts`
3. If creating new: add to migration file, regenerate types after

## Migration Workflow

ALDRI kjør ALTER TABLE direkte. ALLTID lag migrasjonsfil først.

1. Create: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<file>.sql`
3. Regenerate: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

## Common Joins

- Profile → Identity: `profile!inner(user_identity(first_name, last_name))`
- Company → Workspace: `company → workspace (company_id FK)`
- Profile → Department: `profile → department (department_id FK)`
- Workspace → Members: `workspace → company_member → user_identity`

## Key Tables by Domain

- **Identity:** user_identity → company → company_member → workspace → profile
- **Governance:** policy → protocol → {procedure, routine, runbook, control_list, knowledge_test, confirmation}
- **Engine:** engine_process → engine_state → engine_state_step
- **Agent:** engine_memory, engine_authority_config, engine_sessions
- **Schedule:** schedule_shift, schedule_absence
- **Session:** department_session → session_hook, session_task, session_note

## Reference Files

- Full schema: `docs/reference/DATABASE.md`
- Types: `packages/supabase/src/database.types.ts`
- Migrations: `supabase/migrations/`

````

- [ ] **Step 3: Verify skill loads**

```bash
cat .claude/skills/smartout-database-guide/SKILL.md | head -5
````

Expected: frontmatter with `name: smartout-database-guide`

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/smartout-database-guide/SKILL.md
git commit -m "feat(skills): add smartout-database-guide authority skill

Authoritative source for DB conventions, traps, RLS patterns, migrations.
Content will be removed from CLAUDE.md in a follow-up task.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create smartout-cascade-developer skill

**Files:**

- Create: `.claude/skills/smartout-cascade-developer/SKILL.md`

- [ ] **Step 1: Create skill directory**

```bash
mkdir -p .claude/skills/smartout-cascade-developer
```

- [ ] **Step 2: Read cascade spec for accuracy**

```bash
head -100 docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md
```

Verify dimension names and table mappings before writing.

- [ ] **Step 3: Write SKILL.md**

```markdown
---
name: smartout-cascade-developer
description: Authoritative guide for cascade scheduling system — I1+6D+4C+K1a/K1b model, dimensions, control planes, bootstrap. Use when touching cascade tables, dimensions, scheduling, season planning, or control planes.
tools: Read, Grep, Glob
---

# Last synced: 2026-04-06

# Smartout Cascade Developer Guide

This skill is the AUTHORITATIVE source for the Cascade Core Model. CLAUDE.md points here.

## Canonical Model: I1 + 6D + 4C + K1a/K1b

### I1 — Industry Intelligence Bootstrap (pre-runtime)

Pre-runtime layer. Loads vertical defaults, applies SQL templates, seeds all dimensions.

- Code: `packages/ai/src/industry/` (packages/hospitality.ts, loader.ts, index.ts)
- Templates: `supabase/templates/restaurant/` (13 SQL + \_apply.sql)
- Docs: `docs/engines/industri-inteligence/hospitalety/`
- Admin portal NEVER creates empty workspaces — always from I1 bootstrap.

### Execution Dimensions (D1-D6)

| #   | Name                  | Core Question                       | Type       | Key Tables                                                                                  |
| --- | --------------------- | ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| D1  | Operational Envelope  | When/where/with what capacity?      | Structural | department, location, department_operating_hours, department_hours_override, planning_cycle |
| D2  | Resource Availability | Who is available now?               | Volatile   | profile, employment_contract, employee_payroll_profile, schedule_absence, team              |
| D3  | Rules & Constraints   | What is allowed/required/forbidden? | Stable     | regulatory_framework, framework_rule, framework_trigger, tariff_rate_table, public_holiday  |
| D4  | Demand Signal         | How much activity to prepare for?   | Predictive | season_budget, day_factor, hour_factor, workspace_budget, planning_event                    |
| D5  | Service Concept       | What kind of operation are we?      | Strategic  | workspace config, niche parameters (parameterizes D1-D4, D6)                                |
| D6  | Production & Product  | What to produce, what is the state? | Live       | department_session, session_hook, session_task, schedule_shift, deviation                   |

### Control Planes (C1-C4)

| #   | Name                        | Core Question                    | Loop                            |
| --- | --------------------------- | -------------------------------- | ------------------------------- |
| C1  | Observability & Calibration | What happened vs plan?           | Plan → actual → correction      |
| C2  | Context & Interaction       | What's relevant, how to explain? | State → inference → response    |
| C3  | Commercial & Outcome        | What value, what cost?           | Value → attribution → pricing   |
| C4  | Policy & Governance         | What is system ALLOWED to do?    | Capability → permission → audit |

**"Confident != Authorized"** — C1 determines belief, C4 determines permission. Always separate.

### Knowledge Substrate

| Tier          | Owner                       | Contents                                                     |
| ------------- | --------------------------- | ------------------------------------------------------------ |
| K1a Industry  | Platform (per vertical)     | Tariff baselines, policy templates, role capabilities        |
| K1b Workspace | Workspace (tenant-isolated) | Semantic memory (pgvector), learned factors, local overrides |

## Implementation Status

- **Phase A (schema):** Done — 7 migrations, 17 tables, 16 enums
- **Phase B (pure functions):** Partial — 4/6 done in `apps/web/src/lib/cascade/`
- **Phase C (bootstrap):** In progress — framework seed + bootstrap service
- **Phase D (adapters):** Not started — Tripletex, external integrations

## Domain Concepts

- **Department Session** (D6) — Daily container per dept. Lifecycle: upcoming → active → pending_signoff → closed | missed
- **Session Hooks** (D6) — Time triggers firing procedures/routines at pre_open, open, scheduled, pre_close, close
- **Readiness** (D2/D6) — Employee "ready" when all assigned Protocols completed. Score = % completed.
- **Trainee Mode** (D2) — Status flag on profile (`profile_status = 'trainee'`). Sandbox restrictions planned, NOT yet implemented.
- **Season** (D4/D5) — Time period wrapping operations, gamification, revenue planning. Status enum: draft/active/archived.
- **Event Engine** — `engine_process` (blueprint) → `engine_state` (live instance) → `engine_state_step` (per-step). Cascade produces, Event Engine consumes.

## Critical Traps

- Triple operating hours: `company_opening_hours` (wizard), `operating_hours` (legacy — NEVER use), `department_operating_hours` (runtime truth)
- Cascade provenance: every record carries `source_type` + `source_id`
- `tariff_rate_table.workspace_id` is nullable — platform-level rates have NULL
- Cascade tables use `btree_gist` extension for exclusion constraints
- Never mix dimension concerns across tables (D2 data in D4 table = wrong)
- Never treat cascade pipeline and Event Engine as the same thing
- Riksavtalen rates in hospitality.ts may need correction — verify against `tariff_rate_table`

## Reference Files

- Canonical spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Cascade functions: `apps/web/src/lib/cascade/`
- Season calc: `apps/web/src/lib/season-calculations.ts`
- Industry packages: `packages/ai/src/industry/`
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/smartout-cascade-developer/SKILL.md
git commit -m "feat(skills): add smartout-cascade-developer authority skill

Authoritative source for I1+6D+4C+K1a/K1b cascade model.
Content will be removed from CLAUDE.md in a follow-up task.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Create smartout-edge-function-guide skill

**Files:**

- Create: `.claude/skills/smartout-edge-function-guide/SKILL.md`

- [ ] **Step 1: Create skill directory**

```bash
mkdir -p .claude/skills/smartout-edge-function-guide
```

- [ ] **Step 2: Write SKILL.md**

````markdown
---
name: smartout-edge-function-guide
description: Authoritative guide for Supabase Edge Functions — auth patterns, dual-auth, scopes, gateway, config.toml. Use when creating or modifying Edge Functions, API endpoints, or scope guards.
tools: Read, Grep, Glob, Bash
---

# Last synced: 2026-04-06

# Smartout Edge Function Guide

This skill is the AUTHORITATIVE source for Edge Function patterns. CLAUDE.md points here.

## Auth Pattern Decision Tree

| Pattern   | When                                    | `verify_jwt`     | Auth                                                 |
| --------- | --------------------------------------- | ---------------- | ---------------------------------------------------- |
| JWT-only  | User-facing (onboarding, workspace ops) | `true` (default) | `supabase.auth.getUser()`                            |
| Dual-auth | Public API, data endpoints              | `false`          | `resolveAuth(req)` from `_shared/auth-middleware.ts` |
| Cron-only | Scheduled tasks (cleanup, watchdog)     | `false`          | `WATCHDOG_CRON_SECRET` bearer token                  |

**NEVER roll your own auth.** Use `_shared/auth-middleware.ts` for dual-auth.

## config.toml Rules

Every `verify_jwt = false` function MUST be listed in `supabase/functions/config.toml`.

```toml
[functions.your-function-name]
verify_jwt = false
```
````

## Scope Guard Checklist

Every data endpoint MUST call `requireScope()` before querying.

### Canonical Scope List

| Scope               | Tables                                                                       | Status  |
| ------------------- | ---------------------------------------------------------------------------- | ------- |
| `profiles:read`     | profile, department, location, team, position                                | Active  |
| `organization:read` | workspace, department, location, team                                        | Active  |
| `schedules:read`    | schedule_shift, schedule_absence                                             | Active  |
| `schedules:write`   | schedule_shift                                                               | Active  |
| `operations:read`   | department_session, deviation                                                | Active  |
| `operations:write`  | department_session (future)                                                  | Planned |
| `reports:read`      | daily_reconciliation, shift_approval, workspace_kpi_target, workspace_budget | Active  |
| `guardian:read`     | guardian_signal, guardian_log                                                | Active  |
| `events:read`       | engine_event                                                                 | Active  |
| `suppliers:read`    | supplier, supplier_order                                                     | Active  |
| `waste:read`        | waste_log                                                                    | Active  |
| `equipment:read`    | asset, asset_maintenance, asset_downtime                                     | Active  |
| `training:read`     | protocol, protocol_assignment                                                | Active  |
| `contracts:read`    | employment_contract                                                          | Active  |
| `haccp:read`        | haccp_log (future)                                                           | Planned |
| `haccp:write`       | haccp_log (future)                                                           | Planned |

## Gateway Pattern

External consumers get one API key → validated by Edge Functions → services behind the gate.

**The web app/Edge Function IS the gateway.** Services don't hold consumer keys.

## New Endpoint Checklist

1. Create handler in `workspace-api/handlers/`
2. Register route in `workspace-api/index.ts`
3. Add to API registry
4. Add scope to canonical list above
5. Update preset bundles

## New Table Checklist (workspace-scoped)

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. JWT policy: `USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))`
3. API key policy: `USING (workspace_id = get_api_workspace_id())`
4. Write policy if needed: `api_key_write_{table}`
5. Handler + route + registry if publicly exposed

## Service Authentication

ALL microservices (contract-service, scrapling, etc.):

- MUST use managed service keys (`smo_svc_live_*`) in `platform_api_key`
- MUST validate via `validate-api-key` Edge Function
- MUST NOT use hardcoded env var keys

## API Key Tiers

| Tier   | What               | Storage                            | Key prefix                      |
| ------ | ------------------ | ---------------------------------- | ------------------------------- |
| Tier 1 | Workspace API keys | SHA-256 hash in `platform_api_key` | `smo_sk_live_` / `smo_sk_test_` |
| Tier 2 | External secrets   | Supabase Vault (pgsodium)          | Provider-specific               |
| Tier 3 | Service-to-service | SHA-256 hash in `platform_api_key` | `smo_svc_live_`                 |

## Reference Files

- Edge Functions: `supabase/functions/`
- Config: `supabase/functions/config.toml`
- Auth middleware: `supabase/functions/_shared/auth-middleware.ts`
- Vault wrappers: `get_secret()`, `upsert_secret()`, `delete_vault_secret()`

````

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/smartout-edge-function-guide/SKILL.md
git commit -m "feat(skills): add smartout-edge-function-guide authority skill

Authoritative source for Edge Function auth patterns, scopes, gateway.
Content will be removed from CLAUDE.md in a follow-up task.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
````

---

### Task 4: Create smartout-nordic-split skill

**Files:**

- Create: `.claude/skills/smartout-nordic-split/SKILL.md`

- [ ] **Step 1: Read design tokens for accuracy**

```bash
head -80 packages/design-tokens/src/tokens.ts
```

Verify exact OKLCH values and CSS variable names.

- [ ] **Step 2: Create skill directory and write SKILL.md**

```bash
mkdir -p .claude/skills/smartout-nordic-split
```

````markdown
---
name: smartout-nordic-split
description: Authoritative guide for Smartout's Nordic Split design system — OKLCH colors, spring physics, fonts, glassmorphism, orbs, Tailwind v4. Use when building UI components, animations, styling, or design work.
tools: Read, Glob
---

# Last synced: 2026-04-06

# Nordic Split Design System

This skill is the AUTHORITATIVE source for Smartout's visual identity. Read `docs/design/ren-og-varm-styleguide.html` for the full interactive reference. This skill encodes the non-negotiable rules.

## Colors — OKLCH Warm Palette

All colors use OKLCH with warm hue range 50-60. Use CSS variables, NEVER hardcoded values.

| Variable                | Purpose            | Rule                                |
| ----------------------- | ------------------ | ----------------------------------- |
| `bg-background`         | Page background    | Always use, never `bg-zinc-950`     |
| `text-foreground`       | Primary text       | Always use, never `text-zinc-100`   |
| `border-border`         | Borders            | Always use, never `border-zinc-800` |
| `bg-muted`              | Secondary surfaces | Warm tone                           |
| `text-muted-foreground` | Secondary text     | Warm tone                           |

**Source of truth:** `packages/design-tokens/src/tokens.ts` → `tokens.css` (web) → `native.ts` (mobile)

## Fonts

| Font             | Usage      | Class          |
| ---------------- | ---------- | -------------- |
| Instrument Serif | Headings   | `font-heading` |
| Geist Sans       | Body text  | default        |
| Geist Mono       | Data, code | `font-mono`    |

No other fonts. No variation. No "interesting" font choices.

## Motion — Spring Physics

**These are the CORRECT values. Generic animation skills (framer-motion-animator) use wrong defaults.**

| Parameter | Range | Feel                |
| --------- | ----- | ------------------- |
| stiffness | 30-45 | Slow, organic       |
| damping   | 20-24 | Gentle deceleration |
| mass      | 2-2.5 | Heavy, lava-lamp    |

**Timing rules:**

- Min 250ms exit animations
- Min 500ms entrance animations
- Never abrupt transitions
- Spring physics preferred over duration-based

**Framer Motion example:**

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
/>
```
````

## Glassmorphism Recipe

1. Background: `bg-background/80` (80% opacity)
2. Backdrop blur: `backdrop-blur-xl`
3. Border: 1px gradient border (light edge on top-left)
4. Noise: subtle noise overlay texture
5. No heavy drop shadows — use subtle glow

## Orb Construction

- Use `radial-gradient`, NOT blur blobs
- Generator: `docs/design/orb-generator.html` (sliders, presets, CSS export)
- Orbs are ambient, never interactive
- Multiple gradient layers for depth

## The 40% Reduction Principle

Strip borders, boxes, and containers. Replace with:

- Space (generous padding/margin)
- Light (subtle gradients, glow)
- Typography hierarchy (size/weight contrast)

## Tailwind v4

- CSS-based config in `globals.css` — NO `tailwind.config.ts`
- Root `package.json` has Tailwind v3 — that's for Remotion only
- Use CSS variable classes only

## Icons

Lucide React only. No emojis in UI. No other icon libraries.

## Component Library

- shadcn/ui (new-york style)
- Add: `cd apps/web && npx shadcn@latest add <component>`
- Config: `apps/web/components.json`

## Reference Files

- Interactive styleguide: `docs/design/ren-og-varm-styleguide.html`
- Orb generator: `docs/design/orb-generator.html`
- Design tokens: `packages/design-tokens/src/tokens.ts`
- Design docs: `docs/design/` (README + colors, typography, motion, components, mobile, patterns)

````

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/smartout-nordic-split/SKILL.md
git commit -m "feat(skills): add smartout-nordic-split design system skill

Authoritative source for OKLCH colors, spring physics, fonts,
glassmorphism, Tailwind v4 patterns. Fixes wrong framer-motion defaults.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
````

---

## Track B: Global Cleanup

### Task 5: Delete 18 irrelevant global skills

**Files:**

- Delete: 18 directories/files in `~/.claude/skills/`

- [ ] **Step 1: Delete GSAP skills (6)**

```bash
rm -rf ~/.claude/skills/gsap-core ~/.claude/skills/gsap-timeline ~/.claude/skills/gsap-utils ~/.claude/skills/gsap-plugins ~/.claude/skills/gsap-scrolltrigger ~/.claude/skills/gsap-performance
```

- [ ] **Step 2: Delete n8n detailed skills (6)**

```bash
rm -rf ~/.claude/skills/n8n-code-javascript ~/.claude/skills/n8n-code-python ~/.claude/skills/n8n-expression-syntax ~/.claude/skills/n8n-mcp-tools-expert ~/.claude/skills/n8n-node-configuration ~/.claude/skills/n8n-validation-expert
```

- [ ] **Step 3: Delete misc irrelevant skills (4)**

```bash
rm -rf ~/.claude/skills/flow-authoring ~/.claude/skills/board-ops.skill ~/.claude/skills/board-ops-extracted ~/.claude/skills/sixten-protocol
```

- [ ] **Step 4: Delete remembering-conversations (replaced by claude-mem)**

```bash
rm -rf ~/.claude/skills/remembering-conversations
```

- [ ] **Step 5: Verify removal**

```bash
ls ~/.claude/skills/ | wc -l
```

Expected: 22 remaining (41 - 18 - 1 remembering = 22, then 6 will move to repo in Task 11)

---

### Task 6: Fix 5 symlinks

**Files:**

- Replace symlinks with actual files in `~/.claude/skills/`

- [ ] **Step 1: Check symlink targets exist**

```bash
for s in framer-motion-animator web-design-guidelines vercel-react-best-practices vercel-composition-patterns vercel-react-native-skills; do
  target=$(readlink -f ~/.claude/skills/$s 2>/dev/null)
  echo "$s -> $target (exists: $(test -e "$target" && echo yes || echo no))"
done
```

- [ ] **Step 2: Copy files and remove symlinks**

For each symlink that resolves:

```bash
for s in framer-motion-animator web-design-guidelines vercel-react-best-practices vercel-composition-patterns vercel-react-native-skills; do
  target=$(readlink -f ~/.claude/skills/$s)
  rm ~/.claude/skills/$s
  cp -r "$target" ~/.claude/skills/$s
  echo "Copied $s"
done
```

If any target doesn't exist, manually find the content or download from source.

- [ ] **Step 3: Verify no symlinks remain**

```bash
find ~/.claude/skills/ -type l
```

Expected: no output (zero symlinks)

---

### Task 7: Commit already-deleted repo skill files

**Files:**

- Stage deleted: `.claude/skills/agent-scoring-SKILL.md`, `journey.md`, `mission-training.md`, `mission.md`, `roadmap.md`

- [ ] **Step 1: Check git status for deleted files**

```bash
git status .claude/skills/
```

- [ ] **Step 2: Verify ui-ux-pro-max plugin parity**

Before deleting repo copy, check if plugin has data/ and scripts/:

```bash
ls .claude/skills/ui-ux-pro-max/
find ~/.claude/plugins/cache/ui-ux-pro-max-skill -name "data" -o -name "scripts" 2>/dev/null
```

If plugin has matching directories, delete repo copy. If not, KEEP repo copy.

- [ ] **Step 3: Stage and commit deletions**

```bash
git add .claude/skills/agent-scoring-SKILL.md .claude/skills/journey.md .claude/skills/mission-training.md .claude/skills/mission.md .claude/skills/roadmap.md
# Only add ui-ux-pro-max if verified in step 2:
# git add .claude/skills/ui-ux-pro-max
git commit -m "chore(skills): remove stale skill files

Remove agent-scoring, journey, mission, mission-training, roadmap
(replaced by protocol-writer directory structure).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Track C: MCP & Plugin Config

### Task 8: Configure n8n and Sentry MCP servers

**Files:**

- Modify: `.claude/settings.local.json`
- Modify: `.env.template` (add op:// references)

- [ ] **Step 1: Read current settings.local.json**

```bash
cat .claude/settings.local.json
```

- [ ] **Step 2: Update settings.local.json with MCP servers**

Add n8n and Sentry to the existing `mcpServers` block (keep Playwright):

```json
{
  "permissions": {
    "allow": [
      "Bash(ss:*)",
      "Bash(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \"SELECT email, email_confirmed_at FROM auth.users WHERE email = ''admin@smartout.local'';\")",
      "Bash(for f:*)",
      "Bash(do echo:*)",
      "Read(//home/sxtnl/dev/smartout.ai/**)",
      "Bash(done)"
    ]
  },
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "n8n": {
      "command": "npx",
      "args": ["@n8n/mcp-server"],
      "env": {
        "N8N_HOST": "${N8N_HOST}",
        "N8N_BASIC_AUTH_USER": "${N8N_BASIC_AUTH_USER}",
        "N8N_BASIC_AUTH_PASSWORD": "${N8N_BASIC_AUTH_PASSWORD}"
      }
    },
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

- [ ] **Step 3: Add op:// references to .env.template**

Check if these vars already exist. If not, add them:

```bash
grep -c "N8N_HOST\|N8N_BASIC_AUTH\|SENTRY_AUTH_TOKEN" .env.template
```

Add missing vars with op:// references:

```
# n8n MCP
N8N_HOST=op://smartout_ai/n8n/host
N8N_BASIC_AUTH_USER=op://smartout_ai/n8n/username
N8N_BASIC_AUTH_PASSWORD=op://smartout_ai/n8n/password

# Sentry MCP
SENTRY_AUTH_TOKEN=op://smartout_ai/sentry/auth-token
```

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.local.json .env.template
git commit -m "feat(mcp): add n8n and sentry MCP server config

Credentials injected via op:// references in .env.template.
Requires op run --env-file=.env.template for secret injection.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Remove duplicate plugins

**Files:**

- Modify: `~/.claude/plugins/installed_plugins.json`

- [ ] **Step 1: Read current installed plugins**

```bash
cat ~/.claude/plugins/installed_plugins.json | python3 -m json.tool
```

- [ ] **Step 2: Remove code-review and frontend-design from claude-plugins-official**

Edit `~/.claude/plugins/installed_plugins.json` to remove the `claude-plugins-official` entries for `code-review` and `frontend-design`. Keep the `claude-code-plugins` versions (they have subagents).

- [ ] **Step 3: Verify**

```bash
grep -c "code-review\|frontend-design" ~/.claude/plugins/installed_plugins.json
```

Expected: 2 (one each from claude-code-plugins only)

---

### Task 10: Install claude-mem plugin

**This is a USER manual step.** The agent cannot install plugins.

- [ ] **Step 1: User runs installation**

```bash
npx claude-mem install
```

- [ ] **Step 2: Verify worker is running**

```bash
curl -s http://localhost:37777 | head -5
```

- [ ] **Step 3: Verify no hook conflicts**

Check that existing hooks (preflight-json.sh, metadata-updater.sh) still fire alongside claude-mem hooks. Start a new Claude Code session and check preflight output appears.

---

## Sequential Tasks (after Track A + B + C converge)

### Task 11: Move 6 skills from global to repo-local

**Files:**

- Move: 6 skill directories from `~/.claude/skills/` to `.claude/skills/`

- [ ] **Step 1: Copy skills to repo**

```bash
for skill in secrets-protocol linear-protocol project-lifecycle task-stacking project-development; do
  cp -r ~/.claude/skills/$skill .claude/skills/$skill
  echo "Copied $skill"
done
```

Note: `smartout-agent-dev` is handled separately in Task 16.

- [ ] **Step 2: Update each skill's content**

For each skill, read current content and verify against actual project state:

**secrets-protocol:** Verify vault names (`smartout_ai_dev`, `smartout_ai_prod`), add n8n + Sentry credentials from Task 8, absorb Security Three Laws content from CLAUDE.md.

**linear-protocol:** Verify team/project structure in Linear. No major content changes expected.

**project-lifecycle:** Verify Epic/Story/Track structure. Sync branching rules with CLAUDE.md git workflow section.

**task-stacking:** Verify Path/Operation/Stack labels against Linear workspace.

**project-development:** Add Smartout context (agent architecture, n8n orchestration, Supabase state, cascade model reference).

- [ ] **Step 3: Remove from global**

```bash
for skill in secrets-protocol linear-protocol project-lifecycle task-stacking project-development; do
  rm -rf ~/.claude/skills/$skill
  echo "Removed global $skill"
done
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/secrets-protocol .claude/skills/linear-protocol .claude/skills/project-lifecycle .claude/skills/task-stacking .claude/skills/project-development
git commit -m "feat(skills): move 5 domain skills to repo-local

Moved secrets-protocol, linear-protocol, project-lifecycle,
task-stacking, project-development from global to repo-local.
Updated content against current project state.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Slim CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md section boundaries**

```bash
grep -n "^## " CLAUDE.md
```

Identify exact line ranges for sections being moved to skills.

- [ ] **Step 2: Replace Database sections with pointer**

Remove "Database — Architecture Rules", "Database — Critical Traps", "Database Migrations" sections. Replace with:

```markdown
**Database rules:** See `smartout-database-guide` skill (auto-triggered on any DB work). Reference: `docs/reference/DATABASE.md`.
```

- [ ] **Step 3: Replace Cascade section with pointer**

Remove "Cascade Core Model" and "Domain Concepts" sections. Replace with:

```markdown
**Cascade model:** See `smartout-cascade-developer` skill (auto-triggered on cascade/scheduling work). Spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`.
```

- [ ] **Step 4: Replace API Gateway section with pointer**

Remove "API Gateway — Mandatory Checklists" section. Replace with:

```markdown
**API Gateway & Edge Functions:** See `smartout-edge-function-guide` skill (auto-triggered on Edge Function work).
```

- [ ] **Step 5: Replace Security section with pointer**

Remove "Security — Always Enforced" section (Three Laws, API key tiers, env vars). Replace with:

```markdown
**Security:** See `secrets-protocol` skill (auto-triggered on secrets/auth work). Three laws: (1) never plaintext secrets, (2) never bypass RLS, (3) never commit secrets.
```

- [ ] **Step 6: Slim UI & Styling section**

Remove detailed design content. Keep only:

```markdown
## UI & Styling

- **Design System: "Nordic Split"** — See `smartout-nordic-split` skill for all design rules.
- **Tailwind v4** — CSS-based config in `globals.css`. NO `tailwind.config.ts`.
- **shadcn/ui** — new-york style, `apps/web/components.json`
- **Fonts:** Instrument Serif (headings), Geist Sans (body), Geist Mono (data)

> All routes: `docs/reference/ROUTES.md`
```

- [ ] **Step 7: Verify line count**

```bash
wc -l CLAUDE.md
```

Target: under 350 lines (was 566). Exact count depends on how much is moved.

- [ ] **Step 8: Update changelog**

Add entry to CLAUDE.md changelog:

```markdown
| 2026-04-06 | 11.0.0 | Skills authority model: moved DB, Cascade, API Gateway, Security, UI content to authoritative skills. CLAUDE.md slimmed from 566 to ~300 lines. | Claude |
```

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md
git commit -m "refactor(docs): slim CLAUDE.md — move domain content to authority skills

Database, Cascade, API Gateway, Security, and UI sections moved to
repo-local skills that load on-demand. CLAUDE.md retains core rules
and pointers. Reduces always-loaded context by ~260 lines.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Update agent definitions

**Files:**

- Modify: `.claude/agents/frontend-designer.md`

- [ ] **Step 1: Read current frontend-designer agent**

```bash
cat .claude/agents/frontend-designer.md
```

- [ ] **Step 2: Update references**

- Remove any `gsap-core` reference
- Update `ui-ux-pro-max` to reference plugin version
- Add `smartout-nordic-split` skill reference
- Add clarity note: "Use frontend-design plugin for creative exploration. Use Nordic Split skill + design docs for implementation. When they conflict, Nordic Split wins."

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/frontend-designer.md
git commit -m "fix(agents): update frontend-designer refs after skill cleanup

Remove gsap-core reference, add nordic-split skill, clarify
frontend-design plugin role (exploration vs implementation).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Update tool-index skill

**Files:**

- Modify: `~/.claude/skills/tool-index/SKILL.md`

- [ ] **Step 1: Read current tool-index**

```bash
cat ~/.claude/skills/tool-index/SKILL.md
```

- [ ] **Step 2: Add new MCP server entries**

Add entries for n8n, Sentry, and claude-mem MCP tools. Remove entries for deactivated servers (Firebase, Laravel, Terraform, Asana, GitLab, iMessage).

- [ ] **Step 3: No commit needed** (global skill, not in repo)

---

### Task 15: Verification

- [ ] **Step 1: Run preflight**

```bash
bash apps/web/scripts/preflight-json.sh
```

- [ ] **Step 2: Verify MCP connections**

In Claude Code, test each new MCP:

- Linear: try creating a test comment
- n8n: try listing workflows
- Sentry: try querying recent errors
- claude-mem: `curl http://localhost:37777`

- [ ] **Step 3: Verify no broken symlinks**

```bash
find ~/.claude/skills/ -type l
```

Expected: no output

- [ ] **Step 4: Verify repo skill frontmatter**

```bash
for f in .claude/skills/*/SKILL.md .claude/skills/*.md; do
  echo "=== $f ==="
  head -5 "$f"
done
```

All should have valid YAML frontmatter with `name:` and `description:`.

- [ ] **Step 5: Verify CLAUDE.md has skill pointers**

```bash
grep -c "See.*skill" CLAUDE.md
```

Expected: at least 5 pointers (database, cascade, edge-function, secrets, nordic-split)

- [ ] **Step 6: Count final state**

```bash
echo "Repo-local skills: $(ls .claude/skills/ | wc -l)"
echo "Global skills: $(ls ~/.claude/skills/ | wc -l)"
echo "CLAUDE.md lines: $(wc -l < CLAUDE.md)"
```

Target: 15 repo-local, 16 global, CLAUDE.md under 350 lines.

- [ ] **Step 7: Update MEMORY.md**

Update `/home/sxtnl/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/MEMORY.md` with:

- New skill inventory (15 repo + 16 global)
- MCP server list (13 active)
- claude-mem installation status
- CLAUDE.md slimming date
- Date of last tooling audit: 2026-04-06

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore(tooling): complete developer tooling optimization

Stage 1-4 complete. 15 repo-local authority skills, 16 global skills,
13 MCP servers, claude-mem installed, CLAUDE.md slimmed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: smartout-agent-dev Full Rewrite (SEPARATE BRANCH)

**This task runs on its own branch with System Steward verification.**

**Files:**

- Create: `.claude/skills/smartout-agent-dev/SKILL.md` (rewrite from scratch)
- Delete: `~/.claude/skills/smartout-agent-dev/` (after repo copy verified)

- [ ] **Step 1: Create branch**

```bash
git checkout -b feat/agent-dev-skill-rewrite development
```

- [ ] **Step 2: Read all capability source files**

```bash
ls packages/ai/src/capabilities/
for dir in packages/ai/src/capabilities/*/; do
  echo "=== $dir ==="
  ls "$dir"
done
```

Read every `tools.ts`, `index.ts` to map actual capabilities.

- [ ] **Step 3: Read agent personas**

```bash
ls packages/ai/src/agents/
for f in packages/ai/src/agents/*.ts; do
  echo "=== $f ==="
  head -30 "$f"
done
```

- [ ] **Step 4: Read industry bootstrap**

```bash
ls packages/ai/src/industry/
```

- [ ] **Step 5: Read service configs for correct ports**

```bash
grep -r "port" services/stage-engine/src/config* services/shift-mcp/src/config* services/contract-service/src/config* 2>/dev/null | head -10
```

- [ ] **Step 6: Write new SKILL.md from scratch**

Build the skill with accurate:

- Capability registry (all 6 active + type union)
- Tool index per capability (from actual tools.ts files)
- Agent persona directory
- I1 industry bootstrap awareness
- Correct ports (5010, 5011, 5012)
- Service topology
- "How to Add a New Capability" guide
- Debugging section (engine_sessions, engine_memory queries)
- Cross-reference with walkai-bridge-builder

- [ ] **Step 7: System Steward reviews content**

Dispatch system-steward agent to verify:

- Capability table matches code
- Port numbers correct
- Cascade dimension references accurate
- No contradictions with other skills

- [ ] **Step 8: Cross-verify agent definitions**

Read `.claude/agents/system-agent-coordinator.md` and `.claude/agents/walkai-bridge-builder.md`. Verify their references to `packages/ai/` paths still match after the skill rewrite.

- [ ] **Step 9: Remove from global and commit**

```bash
rm -rf ~/.claude/skills/smartout-agent-dev
git add .claude/skills/smartout-agent-dev/SKILL.md
git commit -m "feat(skills): rewrite smartout-agent-dev as authority skill

Full rewrite: 6 capabilities (not 1), correct ports (5010/5011/5012),
agent personas, I1 bootstrap, updated tool index from actual code.
System Steward verified content accuracy.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Merge to development**

```bash
git checkout development
git merge feat/agent-dev-skill-rewrite
git branch -d feat/agent-dev-skill-rewrite
```

---

## Council Log Entry

After all tasks complete, append to `docs/council/COUNCIL-LOG.md`:

```markdown
## 2026-04-06 — Developer Tooling Optimization

**Type:** spec
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decisions:**

- Skills are authoritative sources; CLAUDE.md points to them (not the reverse)
- smartout-agent-dev requires full rewrite (separate branch)
- Nordic Split design skill fills gap in frontend coverage
- claude-mem replaces remembering-conversations for session memory
- Pointer skills rejected in favor of authority skills (content lives IN skills)
  **ADR created:** none (operational cleanup)
  **Learning:** Authority skills beat pointer skills beat content duplication. Single source of truth per domain, loaded on demand.
```
