---
name: task-stacking
description: Index and stack related Linear tasks by Path, Operation, and Stack labels. Use when starting work on a file/area to find all related tasks. Triggers on file paths, operation keywords, or /stack command.
---

# Task Stacking

**Purpose:** Find and batch related Linear tasks based on metadata labels.

## When to Use

1. **File path mentioned** → Find tasks affecting that path
2. **Operation keyword** → Find tasks for that operation type
3. **`/stack` command** → Manual task discovery
4. **Starting work session** → Check for stackable tasks

---

## Label Hierarchy

### Existing Labels (Use These)

| Group       | Labels                                                                     | Color               |
| ----------- | -------------------------------------------------------------------------- | ------------------- |
| **Stack →** | Docker, n8n, TypeScript, Supabase, Bubble, Python                          | Various             |
| **Track →** | Track-A (Backend), Track-B (Frontend), Track-C (Testing), Track-D (DevOps) | Orange/Purple/Green |

### New Labels (Created for Stacking)

| Group           | Labels                                                                      | Color           | ID Prefix     |
| --------------- | --------------------------------------------------------------------------- | --------------- | ------------- |
| **Path →**      | docker-compose, migrations, twenty-server, twenty-front, env, hooks, skills | #10B981 (Green) | `Path →`      |
| **Operation →** | deploy, migrate, configure, integrate, refactor, test                       | #F59E0B (Amber) | `Operation →` |

---

## Keyword Detection

### File Path Keywords

| Keywords                                           | Detected Label        |
| -------------------------------------------------- | --------------------- |
| `docker-compose`, `compose file`, `docker compose` | Path → docker-compose |
| `migration`, `schema change`, `database migration` | Path → migrations     |
| `twenty-server`, `backend`, `server code`, `API`   | Path → twenty-server  |
| `twenty-front`, `frontend`, `UI`, `react`          | Path → twenty-front   |
| `.env`, `environment`, `config file`               | Path → env            |
| `hooks.json`, `hook`, `PreToolUse`                 | Path → hooks          |
| `skill`, `SKILL.md`, `.claude/skills`              | Path → skills         |

### Operation Keywords

| Keywords                                         | Detected Label        |
| ------------------------------------------------ | --------------------- |
| `deploy`, `ship`, `release`, `push to prod`      | Operation → deploy    |
| `migrate`, `migration`, `schema update`          | Operation → migrate   |
| `configure`, `config`, `settings`, `setup`       | Operation → configure |
| `integrate`, `integration`, `connect`, `hook up` | Operation → integrate |
| `refactor`, `cleanup`, `restructure`, `improve`  | Operation → refactor  |
| `test`, `testing`, `verify`, `check`             | Operation → test      |

### Stack Keywords (Existing)

| Keywords                           | Detected Label     |
| ---------------------------------- | ------------------ |
| `docker`, `container`, `compose`   | Stack → Docker     |
| `n8n`, `workflow`, `automation`    | Stack → n8n        |
| `typescript`, `ts`, `type`         | Stack → TypeScript |
| `supabase`, `database`, `postgres` | Stack → Supabase   |

---

## Stacking Algorithm

```
INPUT: User prompt or /stack command

1. DETECT LABELS
   ├── Scan for path keywords → Path labels
   ├── Scan for operation keywords → Operation labels
   └── Scan for stack keywords → Stack labels

2. QUERY LINEAR (when issue search available)
   ├── Find issues with ANY detected label
   ├── Filter by state: Backlog, Todo, In Progress
   └── Sort by priority, then created date

3. PRESENT STACK
   ├── Group by primary label
   ├── Show issue ID, title, labels
   └── Ask: "Work on this stack? (y/n/pick)"

4. EXECUTE
   ├── If yes → Process all in sequence
   ├── If pick → Let user select subset
   └── Apply linear-protocol to each
```

---

## Commands

### `/stack`

Auto-detect from recent context and show stackable tasks.

```
> /stack

Detecting context...
Found: Path → docker-compose, Stack → Docker

📦 Stack: Docker + docker-compose (3 tasks)

  □ SMA-45  Add redis service          [Stack→Docker, Path→compose]
  □ SMA-67  Configure volumes          [Stack→Docker, Path→compose]
  □ SMA-89  Add health checks          [Stack→Docker, Operation→deploy]

Work on this stack? (y/all/pick/cancel)
```

### `/stack <label>`

Find tasks by specific label.

```
> /stack docker-compose
> /stack deploy
> /stack twenty-server
```

### `/stack <issue-id>`

Find tasks sharing labels with a specific issue.

```
> /stack SMA-45

Issue SMA-45 has labels: [Stack→Docker, Path→docker-compose]

📦 Related tasks (2 more):
  □ SMA-67  Configure volumes
  □ SMA-89  Add health checks
```

---

## Integration with Linear Protocol

When working a stack:

1. **Post 👀 comment** on FIRST task in stack
2. **Reference stack** in comment: "Working stack: SMA-45, SMA-67, SMA-89"
3. **Post 📌 decisions** as you go
4. **Post ✅ comment** on EACH completed task

---

## Label Reference (IDs)

### Path Labels

| Label                 | ID                                     |
| --------------------- | -------------------------------------- |
| Path (group)          | `4e965117-0b44-4b37-b333-314c8b308999` |
| Path → docker-compose | `d785febf-d528-4764-ab69-c2853b125a07` |
| Path → migrations     | `d625968c-3262-4d36-a22b-cf20745829ff` |
| Path → twenty-server  | `a0a975a3-762d-4723-b412-f357d172493e` |
| Path → twenty-front   | `6f93842d-cd27-42c7-80ea-319f0bbff41e` |
| Path → env            | `5e30251e-6eda-453a-a4d1-6c44b834ffa7` |
| Path → hooks          | `5c7ff06f-a25f-4df4-9fa4-70983eef5591` |
| Path → skills         | `3e12dbb7-1174-4a2e-9ba0-e711a3a6a21c` |

### Operation Labels

| Label                 | ID                                     |
| --------------------- | -------------------------------------- |
| Operation (group)     | `3258af52-5a4b-4a92-973d-b24b7efeeddf` |
| Operation → deploy    | `49e7ec79-a0cf-4b15-a203-2dd7eef84926` |
| Operation → migrate   | `7885fe24-b04d-47e7-a266-4ad1cc2d732e` |
| Operation → configure | `b4fd4b9e-59e5-4f1f-8818-3a2009386fcf` |
| Operation → integrate | `cf897ee6-3c72-4594-bb9d-88784087d4fc` |
| Operation → refactor  | `bad309b2-0821-4733-b7f7-8491236565b5` |
| Operation → test      | `9e2eeec6-7ec5-4267-a5c1-8f3aef989618` |

### Stack Labels (Existing)

| Label              | ID                                     |
| ------------------ | -------------------------------------- |
| Stack → Docker     | `e5875bb8-4a58-49b7-8d85-23206757be95` |
| Stack → n8n        | `5364368c-707e-4c30-aeaa-5e8d7b665002` |
| Stack → TypeScript | `5e8d89d4-6793-4990-8e1f-aa9b4ec49c15` |
| Stack → Supabase   | `3397d63d-5b42-4184-b31e-9160b345ca96` |
| Stack → Bubble     | `67ac38af-09d8-481f-98e7-cd780b8f24bd` |
| Stack → Python     | `bab5ce10-baca-41b6-a096-e9239de55123` |

---

## Status (2026-01-17)

**Full Linear access now available.** GitHub was removed from Docker MCP Gateway.

Task stacking can now:

- Query issues by label: `mcp__plugin_linear_linear__list_issues` with `label` param
- List issues for stacking
- Create/update issues with Path/Operation labels

---

## Hook Trigger

The stacking skill is triggered by `UserPromptSubmit` hook when:

- File path keywords detected
- Operation keywords detected
- `/stack` command used

See `.claude/hooks.json` for implementation.
