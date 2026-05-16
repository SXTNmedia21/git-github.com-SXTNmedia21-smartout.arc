---
id: L_0271
title: Frontend reviewer blocked by smart-explore hook loop on file reads
status: accepted
layer: learning
created: 2026-05-14
updated: 2026-05-14
tags: [council, agent-tooling, hooks, mcp]
---

# L-0271: Frontend reviewer blocked by smart-explore hook loop on file reads

## Context

WFM merge-readiness council 2026-05-14 dispatched 5 reviewers in parallel. Frontend Designer agent reported environment failure: every tool call (Read, Grep, Glob) was intercepted by a hook auto-firing `claude-mem:smart-explore` skill. The skill's underlying MCP tools (`smart_search`, `smart_outline`, `smart_unfold`) were not registered in the agent's tool surface, so the skill returned only its instruction payload without performing the actual read. This created an infinite no-op loop — the agent could not read a single file across the entire review window.

Result: Frontend Designer issued a **NEEDS MORE INFO** verdict based only on briefing metadata + Nordic Split design rules. No per-page audit possible. Provided grep commands for the orchestrator to run manually as fallback.

Other 4 reviewers (system-steward, supervisor, system-agent-coordinator, botsson-harness-builder) completed normally — apparently their tool calls did not trigger the same hook, OR they used MCP tools that bypassed it.

## Observation

A `PreToolUse` or `PostToolUse` hook configured to auto-invoke an MCP-dependent skill creates a hard failure mode when the MCP server is unavailable: every tool call falls through the hook → skill → empty payload, with no file content reaching the agent.

The failure is silent at orchestrator level — the agent reports "NEEDS MORE INFO" with a plausible reason ("could not read files"), but the root cause (hook configuration) isn't visible. Reviewer disagreement between "completed agents" and "blocked agent" is the only signal.

This is a class of failure not covered in council skill SKILL.md §"Error Recovery & Degraded Mode" — that section assumes reviewers run normally or hit usage limits, not that their tool layer is corrupted by environment config.

## How to apply

**For council orchestrator:**
- When an agent reports NEEDS MORE INFO due to "cannot read files / hook loop / MCP unavailable", tag the verdict **TOOLING-DEGRADED** and either re-dispatch the agent with a workaround prompt (pre-load file contents into briefing) or run the agent's grep battery manually.
- Frontend Designer is the documented sensitive case (per `agent-tooling-meta` 2026-04-13) — always pre-load file contents into its briefing as default, do NOT rely on it reading files itself.

**For hook config (`~/.claude/settings.json` / `settings.local.json`):**
- Audit hooks that auto-invoke MCP-dependent skills. If the skill's MCP server is unavailable, the hook should either skip silently OR raise a visible orchestrator-level error — not loop.
- Hooks firing on `PreToolUse` for every tool call should be high-confidence + low-cost; smart-explore is neither.

**For council skill SKILL.md:**
- Add row to Error Recovery section: *"Hook-loop / MCP-unavailable failure → tag TOOLING-DEGRADED, re-dispatch with pre-loaded file contents."*

## Related

- Council session: 2026-05-14 — WFM Campaign Merge Readiness
- Meta-memory: 2026-04-13 frontend-designer file-read limitation
- Skill: `/home/sxtnl/.claude/skills/run-council/SKILL.md` §"Error Recovery & Degraded Mode"
- Hook config: `~/.claude/settings.json` (audit pending)
