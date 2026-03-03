---
title: "Design — Guardian Capability Skeleton"
status: in_progress
updated: 2026-03-14
created: 2026-03-14
module: ai
tags: [design, guardian, capability, stage-engine]
---

# Design — Guardian Capability Skeleton

> Branch: `feat/guardian` | Module: ai

## Goal

Prepare the `@smartout/ai` package and stage-engine so that the Guardian feature (workspace health monitoring) can integrate without friction. Another agent is building the full Guardian feature — we provide the skeleton.

## Changes

| # | File | Change |
|---|------|--------|
| 1 | `packages/ai/src/capabilities/types.ts` | Add `"guardian"` to `CapabilityName` and `Situation` unions |
| 2 | `packages/ai/src/router/intent-classifier.ts` | Add `"guardian"` to Zod enum + LLM prompt |
| 3 | `packages/ai/src/capabilities/guardian/tools.ts` | New — 3 tool stubs with Zod schemas |
| 4 | `packages/ai/src/capabilities/guardian/index.ts` | New — `guardianCapability` definition |
| 5 | `packages/ai/src/capabilities/registry.ts` | Register guardian capability |
| 6 | `services/stage-engine/src/core/agent-router.ts` | Add guardian → situation mapping |

## Tool Stubs

### get_signals
- Schema: `{ domain?: string, severity?: string, status?: string }`
- Returns: Active guardian signals for the workspace, filtered by params
- Authority: read_only

### acknowledge_signal
- Schema: `{ signal_id: string, note?: string }`
- Returns: Confirmation that signal was acknowledged
- Authority: confirm (requires at least suggest level)

### get_workspace_health
- Schema: `{}`
- Returns: Summary health score across all domains (readiness, workspace_maturity, agent_behavior)
- Authority: read_only

## What This Enables

The Guardian colleague can:
1. Fill in tool `execute` functions with real DB queries
2. Add the sweep Edge Function that writes signals
3. Build the dashboard UI that reads signals
4. Everything routes correctly through the agent pipeline automatically

## Out of Scope

- Guardian sweep Edge Function (other agent)
- Dashboard UI (other agent)
- Signal cleanup job (other agent)
- Real DB queries in tools (other agent fills stubs)
