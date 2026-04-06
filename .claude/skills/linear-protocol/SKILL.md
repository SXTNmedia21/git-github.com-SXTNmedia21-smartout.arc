---
name: linear-protocol
description: Mandatory logging and reference protocol for Linear. THE LAW. Use when Linear MCP is invoked, when referencing Linear issues, or when working on any development task tied to Linear. Enforces comment logging for decisions, blockers, errors, discoveries, and product insights. Comments become a storytelling product journal with selling points and elevator pitches captured at creation time.
---

# Linear Protocol

**Linear is the source of truth. This is the law.**

## The Rules

1. **Linear is truth** — If it's not in Linear, it doesn't exist
2. **Mandatory logging** — Every meaningful action gets a comment
3. **No silent work** — Announce presence before touching anything
4. **Shuffle-proof** — Comments are self-contained (survives session breaks)
5. **Capture gold** — Product insights, selling points, pitches logged when fresh

## Emoji System

| Emoji | Type | When |
|-------|------|------|
| 👀 | Looking | Starting work, first impressions |
| 💭 | Thinking | Weighing options, trade-offs |
| 📋 | Plan | Breaking down into tasks |
| 📌 | Decision | Choice made + why |
| 💡 | Discovery | Learned something useful |
| 🎯 | Insight | Product value, selling point |
| 🚀 | Potential | "This could be big because..." |
| ⚠️ | Warning | Watch out, gotcha |
| 🚫 | Blocked | Stuck, need help |
| ❌ | Error | Failed, what happened |
| 🔥 | Critical | Urgent, needs attention now |
| ✅ | Done | Wrapped up, summary |

## Hard Enforcement

⛔ **DO NOT proceed with work until 👀 Looking comment is posted.**

⛔ **DO NOT complete work without ✅ Done comment.**

⛔ **DO NOT make decisions without 📌 Decision comment.**

⛔ **DO NOT encounter blockers without 🚫 Blocked comment.**

This is not optional. This is the protocol.

---

## Task Stacking

When starting work, check for related tasks using labels:

| Label Group | Purpose | Examples |
|-------------|---------|----------|
| **Path →** | File/area affected | docker-compose, migrations, twenty-server |
| **Operation →** | Action type | deploy, migrate, configure, refactor |
| **Stack →** | Technology | Docker, n8n, TypeScript, Supabase |

**Stacking workflow:**
1. Detect labels from user prompt (path, operation keywords)
2. Query Linear for tasks with matching labels
3. Present stack to user: "Found 3 related tasks. Stack them?"
4. Work stack sequentially, applying protocol to each

See: [task-stacking skill](../task-stacking/SKILL.md)

---

## Tool Index

**Status (2026-01-17):** Full Linear access via plugin. GitHub removed from Docker MCP Gateway.

| Tool | Purpose | Status |
|------|---------|--------|
| `mcp__plugin_linear_linear__create_issue` | Create issues | ✅ Available |
| `mcp__plugin_linear_linear__list_issues` | List/search issues | ✅ Available |
| `mcp__plugin_linear_linear__get_issue` | Get issue details | ✅ Available |
| `mcp__plugin_linear_linear__update_issue` | Update state/labels | ✅ Available |
| `mcp__plugin_linear_linear__create_comment` | Comment on issues | ✅ Available |
| `mcp__plugin_linear_linear__list_issue_labels` | List labels | ✅ Available |

See: [mcp-tool-index](./references/mcp-tool-index.md)