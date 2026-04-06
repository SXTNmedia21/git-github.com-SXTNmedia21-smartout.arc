---
name: project-lifecycle
description: Project initiation, structuring, and closure in Linear. Use when starting a new project/module, setting up Epic hierarchy, breaking work into Stories with tracks, or closing out completed work. Covers the full arc from brainstorming through delivery. Works with linear-protocol for logging.
---

# Project Lifecycle

How to initiate, structure, and close projects in Linear.

## Status Update (2026-01-17)

**Full Linear access now available via Linear Plugin.**
GitHub was removed from Docker MCP Gateway, resolving the naming collision.
All issue CRUD tools now work.

## Hierarchy (The Structure)
```
PROJECT = Repository (e.g., ai-layer, crm-twenty)
    └── EPIC = Module (labeled: Epic)
        └── SUB-EPIC = Feature/Area (labeled: Sub-Epic)
            └── STORY = Function/Task (labeled: Story + Track)
```

## Labels Reference

| Group | Labels | Purpose |
|-------|--------|---------|
| Type | `Epic`, `Sub-Epic`, `Story` | Hierarchy level |
| Stack | `Stack → TypeScript`, `Stack → Python`, `Stack → n8n`, `Stack → Supabase`, `Stack → Bubble`, `Stack → Docker` | Technology |
| Track | `Track → Track-A`, `Track → Track-B`, `Track → Track-C`, `Track → Track-D` | Parallel execution |
| Skill | `Skill → brainstorming`, `Skill → writing-plans`, `Skill → executing-plans` | Workflow phase |
| Status | `Approved`, `Needs-Review`, `Agent` | Flow control |

## Tracks (Parallel Execution)
```
Track A ──── Story 1 ──── Story 5 ────────────────  (Backend/API)
Track B ──── Story 2 ──── Story 3 ──── Story 6 ──  (Frontend/UI)
Track C ──── Story 4 ────────────────────────────  (Testing/QA)
Track D ──── Story 7 ──── Story 8 ────────────────  (Integration/DevOps)
```

- Same track = sequential (must complete in order)
- Different tracks = parallel (can run simultaneously)

## Status Flow
```
Backlog → Todo → In Progress → In Review → Done
                      │
                      ↓
                   Blocked
```

---

# Phase 1: Initiation (Brainstorming)

## When to Use

- New module/feature request
- "I need a [thing]" conversation
- Exploring scope and requirements

## Process

### 1. Explore Requirements

Ask clarifying questions. Understand the "why" before the "what."

### 2. Create Epic
```
mcp__plugin_linear_linear__create_issue:
  title: "[Epic] {Module Name}"
  team: "Smartout"
  labels: ["Epic"]
  description: |
    # Epic: {Module Name}

    ## Overview
    [What this module does, why it exists]

    ## Goals
    1. [Goal one]
    2. [Goal two]

    ## Success Criteria
    - [ ] [Measurable outcome]
```

### 3. Create Sub-Epics (Features/Areas)
```
mcp__plugin_linear_linear__create_issue:
  title: "[Sub-Epic] {Feature Name}"
  team: "Smartout"
  labels: ["Sub-Epic", "Stack → {technology}"]
  parentId: "{Epic ID}"
  description: |
    # Sub-Epic: {Feature Name}

    ## Overview
    [What this feature does]

    ## Scope
    - [What's included]
    - [What's excluded]
```

### 4. Create Stories (Functions)
```
mcp__plugin_linear_linear__create_issue:
  title: "{Function/Task Name}"
  team: "Smartout"
  labels: ["Story", "Track → {A/B/C/D}", "Stack → {technology}"]
  parentId: "{Sub-Epic ID}"
  state: "Backlog"
  description: |
    ## What
    [Clear description of the deliverable]

    ## Why
    [Business value, user benefit]

    ## Acceptance Criteria
    - [ ] [Testable criterion]
```

## Track Assignment Guidelines

| Track | Use For | Examples |
|-------|---------|----------|
| Track-A | Backend, API, data | Database schema, API endpoints, services |
| Track-B | Frontend, UI | Components, pages, user flows |
| Track-C | Testing, QA | Test suites, validation, edge cases |
| Track-D | Integration, DevOps | Deployment, webhooks, external services |

---

# Phase 2: Planning (Writing Plans)

## When to Use

- Story is in Backlog, ready for planning
- Need to break Story into tasks
- Preparing for execution

## Process

### 1. Pick Up Story

```
mcp__plugin_linear_linear__get_issue: id="{SMA-XXX}"
mcp__plugin_linear_linear__create_comment: issueId="{uuid}", body="👀 Looking..."
```

### 2. Break Into Tasks

Each Story becomes 1→many tasks in the plan comment:
```
mcp__plugin_linear_linear__create_comment:
  issueId: "{uuid}"
  body: |
    📋 Plan for {Story Title}

    **Estimate:** {X}h
    **Track:** {A/B/C/D}

    ## Tasks
    1. [ ] {First task}
    2. [ ] {Second task}
    3. [ ] {Third task}

    ## Acceptance Criteria
    - [ ] {Criterion from story}

    ## Dependencies
    - Blocked by: {SMA-XX} (if any)
    - Enables: {SMA-YY} (if any)
```

### 3. Request Review

```
mcp__plugin_linear_linear__update_issue:
  id: "{SMA-XXX}"
  state: "Todo"
  labels: ["Needs-Review"]
  assignee: "pontus"
```

---

# Phase 3: Execution

## When to Use

- Story has `Approved` label
- Plan is reviewed and accepted
- Ready to implement

## Process

### 1. Start Work

```
mcp__plugin_linear_linear__update_issue:
  id: "{SMA-XXX}"
  state: "In Progress"
  labels: ["Agent"]

mcp__plugin_linear_linear__create_comment:
  issueId: "{uuid}"
  body: "👀 Starting execution..."
```

### 2. Execute Tasks

Follow the plan. Log progress per linear-protocol:
- 📌 Decisions
- 💡 Discoveries
- 🎯 Product gold (selling points!)
- ⚠️ Warnings
- 🚫 Blockers

### 3. Complete

```
mcp__plugin_linear_linear__create_comment:
  issueId: "{uuid}"
  body: |
    ✅ Done.

    [Summary]

    Elevator pitch:
    "[2-3 sentence pitch]"

mcp__plugin_linear_linear__update_issue:
  id: "{SMA-XXX}"
  state: "In Review"
  assignee: "pontus"
```

---

# Phase 4: Closure

## When to Use

- All Stories in Epic are Done
- Module is complete
- Ready to wrap up

## Process

### 1. Verify Completion

```
mcp__plugin_linear_linear__list_issues:
  parentId: "{Epic ID}"
  state: "!Done"  # Any not done?
```

### 2. Harvest Product Gold

Scan all comments for:
- 🎯 Selling points
- 🚀 Differentiators
- Elevator pitches

Compile into Epic description or separate doc.

### 3. Write Epic Summary

```
mcp__plugin_linear_linear__update_issue:
  id: "{Epic SMA-XXX}"
  description: |
    ## Summary

    [What was delivered]

    ## Selling Points
    - [Point 1 from 🎯 comments]
    - [Point 2]

    ## Elevator Pitch
    "[2-3 sentence pitch for this module]"

    ## Learnings
    - [Key discoveries from 💡 comments]
    - [Gotchas from ⚠️ comments]
```

### 4. Close Epic

```
mcp__plugin_linear_linear__update_issue:
  id: "{Epic SMA-XXX}"
  state: "Done"
```

---

# Agent Permissions

> **Status:** Full Linear access via Linear Plugin (GitHub removed 2026-01-17)

```yaml
# ALL LINEAR TOOLS AVAILABLE:
ISSUE_CRUD:
  - mcp__plugin_linear_linear__create_issue         # ✅ Create issues
  - mcp__plugin_linear_linear__list_issues          # ✅ List/search issues
  - mcp__plugin_linear_linear__get_issue            # ✅ Get issue details
  - mcp__plugin_linear_linear__update_issue         # ✅ Update state/assignee

COMMENTS:
  - mcp__plugin_linear_linear__create_comment       # ✅ Comment on issues
  - mcp__plugin_linear_linear__list_comments        # ✅ List comments

PROJECTS:
  - mcp__plugin_linear_linear__list_projects        # ✅ List projects
  - mcp__plugin_linear_linear__get_project          # ✅ Get project
  - mcp__plugin_linear_linear__create_project       # ✅ Create project
  - mcp__plugin_linear_linear__update_project       # ✅ Update project

LABELS:
  - mcp__plugin_linear_linear__list_issue_labels    # ✅ List labels
  - mcp__plugin_linear_linear__create_issue_label   # ✅ Create label

DENIED (NEVER):
  - delete_issue        # ❌
  - archive_issue       # ❌
  - delete_comment      # ❌
```

---

# Templates

## Epic Description
```markdown
# Epic: {Name}

## Overview
[What and why]

## Goals
1. [Goal]

## Success Criteria
- [ ] [Outcome]

## Sub-Epics
- [ ] [Feature 1]
- [ ] [Feature 2]
```

## Sub-Epic Description
```markdown
# Sub-Epic: {Name}

## Overview
[What this feature does]

## Stories
- [ ] [Story 1]
- [ ] [Story 2]

## Technical Notes
[Stack, dependencies, considerations]
```

## Story Description
```markdown
## What
[Deliverable]

## Why
[Value]

## Acceptance Criteria
- [ ] [Criterion]

## Technical Notes
[Implementation hints]
```

---

# Quick Reference

| Action | Tool | Status |
|--------|------|--------|
| Create Epic | `mcp__plugin_linear_linear__create_issue` | ✅ Available |
| Create Sub-Epic | `mcp__plugin_linear_linear__create_issue` | ✅ Available |
| Create Story | `mcp__plugin_linear_linear__create_issue` | ✅ Available |
| List issues | `mcp__plugin_linear_linear__list_issues` | ✅ Available |
| Get issue | `mcp__plugin_linear_linear__get_issue` | ✅ Available |
| Update issue | `mcp__plugin_linear_linear__update_issue` | ✅ Available |
| Log comment | `mcp__plugin_linear_linear__create_comment` | ✅ Available |
| List teams | `mcp__plugin_linear_linear__list_teams` | ✅ Available |
| List projects | `mcp__plugin_linear_linear__list_projects` | ✅ Available |
| List labels | `mcp__plugin_linear_linear__list_issue_labels` | ✅ Available |
| Create label | `mcp__plugin_linear_linear__create_issue_label` | ✅ Available |
