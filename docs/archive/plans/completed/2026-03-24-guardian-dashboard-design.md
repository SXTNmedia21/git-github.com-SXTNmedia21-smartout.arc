---
title: Guardian Dashboard — Platform Admin
status: approved
updated: 2026-03-24
created: 2026-03-24
module: ai
tags: [guardian, dashboard, stage-engine, platform-admin]
---

# Guardian Dashboard — Platform Admin

## Purpose

Build out the Guardian page at `/platform-admin/guardian/` into a full monitoring dashboard for the Stage Engine and agent system. Three tabs: Overview, Live Monitor, Analytics.

## Architecture

### Tab Navigation

Client-side tabs on a single URL (`/platform-admin/guardian/`). No sub-routes. Tabs share WebSocket connection state but only Live Monitor actively subscribes.

### Tab 1: Overview

**Health Signal Cards** (top row, 4 cards using SignalCard component):

- **Active Sessions** — count of `engine_sessions` where `status = 'active'`, sparkline of session count over last 7 days
- **Health Status** — overall status from `guardian_signal` aggregation (critical/warning/healthy), count of active signals
- **Avg Session Duration** — mean duration of completed sessions today, trend vs yesterday
- **Tool Calls Today** — count of tool invocations from `guardian_log` where `event_type LIKE 'tool.%'`, top 3 tools listed

**Active Alerts** (below cards):

- Table/list of `guardian_signal` where `status = 'active'`
- Columns: severity badge, domain, title, entity_label, created_at (relative)
- Actions: acknowledge (opens note dialog), dismiss
- Sorted: critical first, then warning, then info, newest within each
- Empty state: "No active alerts — all systems healthy"

### Tab 2: Live Monitor (existing, polished)

Keeps current 3-panel layout:

- **Left** — Session list (active sessions via WebSocket)
- **Center** — Event feed with actor color coding + whisper input
- **Right** — Session details with stats

Polish items:

- Stage progress bar (current stage / total stages for mission sessions)
- Tool call events rendered with tool name badge + params summary
- Better empty states
- Connection status indicator (connected/reconnecting/disconnected)

### Tab 3: Analytics

**Session Statistics** (top section):

- Completion rate (completed / total sessions, %)
- Abandoned rate (abandoned / total, %)
- Avg session duration (in minutes)
- Sessions by mission (bar chart or table: mission_id → count)
- Sessions by channel (voice/chat/sms breakdown)
- Time range selector: Today | 7d | 30d

**Tool Usage** (middle section):

- Table: tool name | call count | success rate
- Derived from `guardian_log` where `event_type = 'tool.*'`
- Top 10 most used tools

**Stage Analysis** (bottom section):

- Per-mission stage progression: stage_id → avg time spent → completion %
- Identify bottleneck stages (longest avg duration)
- Derived from `guardian_log` stage_advance events

## Data Sources

| Data             | Source                          | Access         |
| ---------------- | ------------------------------- | -------------- |
| Active sessions  | WebSocket `/guardian/ws`        | Real-time      |
| Live events      | WebSocket subscription          | Real-time      |
| Health signals   | `guardian_signal` table         | TanStack Query |
| Event history    | `guardian_log` table            | TanStack Query |
| Session history  | `engine_sessions` table         | TanStack Query |
| Authority config | `engine_authority_config` table | TanStack Query |
| Memory stats     | `engine_memory` table           | TanStack Query |

## Components

### New Components

- `GuardianDashboard.tsx` — Tab container, replaces direct GuardianMonitor render
- `GuardianOverview.tsx` — Tab 1 content
- `GuardianAnalytics.tsx` — Tab 3 content
- `AlertsList.tsx` — Active alerts table with actions
- `SessionStats.tsx` — Session statistics cards/charts
- `ToolUsageTable.tsx` — Tool usage breakdown
- `StageAnalysis.tsx` — Stage progression analysis

### Existing (kept/polished)

- `GuardianMonitor.tsx` — Tab 2 content (live monitor)
- `SessionList.tsx` — Left panel
- `EventFeed.tsx` — Center panel
- `SessionDetails.tsx` — Right panel
- `WhisperInput.tsx` — Admin whisper

### Shared (from dashboard)

- `SignalCard` — Reusable metric card (imported from `components/dashboard/SignalCard`)

## Hooks

### New TanStack Query Hooks (`_hooks/`)

- `useGuardianSignals()` — active signals from `guardian_signal`
- `useGuardianHealth()` — aggregated health status
- `useSessionHistory(timeRange)` — completed/abandoned sessions
- `useToolUsageStats(timeRange)` — tool call aggregation from `guardian_log`
- `useStageAnalysis(missionId?)` — stage timing from `guardian_log`

### Existing (kept)

- `useGuardianSocket()` — WebSocket connection for live monitor

## UI Patterns

- Dark theme (platform-admin forces dark)
- shadcn/ui Tabs component for navigation
- SignalCard for metric cards (consistent with workspace dashboard)
- shadcn/ui Table for alerts and analytics tables
- CSS variable colors only (bg-background, text-foreground, etc.)
- Status colors: emerald (good), orange (warning), red (critical)

## Non-Goals

- No workspace-scoped Guardian view (platform-admin only for now)
- No guardian_signal creation UI (signals are system-generated)
- No authority config editing (already exists at /dashboard/ai/config)
- No memory browsing (future feature)
