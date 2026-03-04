---
title: Governance Admin UI — MVP Design
status: approved
updated: 2026-03-25
created: 2026-03-25
module: governance
tags: [governance, protocol, training, readiness, admin, ui, dashboard]
---

# Governance Admin UI — MVP Design

> Manager/admin view for monitoring employee protocol completion. First layer: done / not done.

## Context

Builds on existing governance data model (13 tables) and the Roadmap Protocol Design (`2026-03-04-roadmap-protocol-design.md`). This is the **Protocol perspective** — how the leader sees and controls governance.

## Approach: Protocol-Centric Dashboard

Three layers, one page, progressive disclosure.

### Layer 0 — Timeline Strip (top, collapsible)

- Overdue protocol assignments as alerts
- Upcoming assignments due this week
- Data: `protocol_assignment` with due dates, joined to `profile` + `protocol`

### Layer 1 — Protocol Cards (main view)

- Grid of cards, one per active protocol in workspace
- Each card: protocol name, policy type badge, completion ratio (e.g. "8/12"), progress bar, color
- Color: green (100%), orange (50-99%), red (<50%)
- Sorted by: worst completion first
- Data: `protocol` + aggregated `protocol_assignment` counts

### Layer 2 — Employee List (click protocol → accordion/sheet)

- List of assigned employees for that protocol
- Each row: employee name, avatar, binary status (Done / Not done), sub-progress (e.g. "3/7 steps")
- Filter: All / Done / Not done
- Data: `protocol_assignment` joined with `profile`

### Layer 3 — Journey Map + Steps (click employee → expand)

- Horizontal journey phases: **Learn** (procedures) → **Test** (knowledge test) → **Sign** (confirmation)
- Each phase: completed/total, visual indicator
- Below: step-by-step checklist (done/not done per `procedure_step`)
- Data: `procedure_step` completion, `knowledge_test` pass status, `confirmation` signed status

## Components

| Component              | Data Source                                                        | Purpose                               |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `GovernanceOverview`   | `protocol` + aggregated `protocol_assignment`                      | Top-level card grid with completion % |
| `OverdueAlerts`        | `protocol_assignment` with expired/overdue status                  | Timeline strip alerts                 |
| `ProtocolEmployeeList` | `protocol_assignment` joined with `profile`                        | Employee list, binary done/not done   |
| `EmployeeJourneyMap`   | `procedure` + `procedure_step` + `knowledge_test` + `confirmation` | Journey phases + step checklist       |

## Hooks

| Hook                               | Query                                                    | Returns                              |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| `useProtocolOverview(workspaceId)` | Active protocols + COUNT assignments by status           | Protocol name, total, completed, %   |
| `useProtocolAssignees(protocolId)` | Assignments for a protocol with profile join             | Employee name, status, step progress |
| `useProtocolJourney(assignmentId)` | Procedure steps + test + confirmation for one assignment | Phase statuses, step completion      |

## Status Simplification

`protocol_assignment.status` has 3 values: `pending | completed | expired`.

For Layer 1-2, collapse to binary:

- `completed` → **Done** (green check)
- Everything else → **Not done** (with sub-text showing progress)

## Tech Choices

- Server Component page shell, Client Components for interactive parts
- TanStack Query v5 for all data fetching
- shadcn/ui: Card, Accordion, Badge, Progress, Avatar
- CSS variable colors only (bg-background, text-foreground, etc.)
- Local state only (useState for selection) — no new context providers

## NOT in MVP

- Routine scheduling engine (trigger_config parsing)
- Protocol/procedure CRUD (admin content creation)
- Employee self-service view ("my training")
- Competence matrix (employees × protocols)
- Knowledge test taking UI
- Confirmation signing UI
- New database tables or migrations

## Route

`/dashboard/governance` — replaces current placeholder page.

## Placement

New tab in DashboardShell's admin view switcher, OR accessible from sidebar (governance already exists in sidebar nav). Decision: use existing sidebar nav, don't add a 5th admin view tab.
