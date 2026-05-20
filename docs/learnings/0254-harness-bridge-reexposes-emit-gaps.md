---
title: "Harness bridges re-expose pre-existing mutation hook emit gaps as agent-callable surface"
id: L-0254
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
module: agent-harness
tags: [botsson, harness, emit, telemetry, adr-0134, adr-0186, agent-surface]
---

# L-0254: Harness bridges re-expose pre-existing mutation hook emit gaps as agent-callable

## The Trap

The notifications harness bridge at `apps/web/src/app/dashboard/notifications/_tools/use-notifications-tools.ts` (shipped 2026-05-14, commit `379060c61`) registered 5 Botsson tools including `markAsRead` and `markAllAsRead`. Both delegate to existing mutation hooks `useMarkAsRead` and `useMarkAllAsRead` in `packages/notifications/src/hooks/use-notifications.ts` (lines 89, 113).

The underlying hooks performed `supabase.from("notification").update({...})` with no `emit()` call in `onSuccess`. This pre-existing gap was tolerable when only internal UI buttons could trigger it.

The new harness bridge made these mutations **agent-callable** via Mr. Botsson. The pre-existing gap was now reachable by an automated actor, violating ADR-0134 (telemetry contract) and ADR-0186 (4-destination emit).

## Why It Happens

When building a harness bridge, the natural review focuses on the new code (tool definitions, validation, parameter shape). The pre-existing underlying hooks are assumed correct because they shipped earlier and passed prior reviews. But "ships correctly for internal UI use" ≠ "ships correctly for agent use" — agent invocation is a new actor class with audit requirements.

## The Rule

When building a harness bridge that delegates to existing mutation hooks:
1. Open the underlying mutation hook body
2. Verify ADR-0134 emit() call in `onSuccess`
3. Verify ADR-0151 server-derived `workspace_id` (not body-supplied)
4. Verify ADR-0186 4-destination routing (posthog + logger + activity_trail + engine_event)
5. Verify L-0177 fail-fast on missing identity

If any of these is missing, fix the underlying hook in the SAME commit that registers the harness bridge. Do NOT ship a bridge over a non-compliant hook.

## Pattern Family

This is a sibling of:
- **L-0083** (Mobile direct-inserts to Edge surfaces) — old code, new exposure (mobile)
- **L-0177** (silent workspace-mismatch on body-supplied row reference) — old code, new bypass
- **F-CT-01** (dual-emit capability tool + BFF route) — same emit-gap class

Common shape: "new exposure surfaces old bug."

## How to Apply

Add to `smartout-page-polish` skill 8-phase workflow as Phase 4.5: "Underlying-hook audit." Before harness bridge registration in Phase 7 (tool descriptions), audit every hook the bridge delegates to for ADR-0134/0151/0186/L-0177 compliance.

Add to `botsson-harness-builder` agent's Phase 3 review checklist for any topic touching new harness bridges.

## Cross-references

- ADR-0134 (telemetry contract)
- ADR-0151 (server-derived workspace_id)
- ADR-0186 (4-destination emit routing)
- ADR-0204 (gatedMutation orchestrator)
- ADR-0287 (gate_action coverage)
- L-0083 (mobile fail-fast on missing identity — sibling)
- L-0177 (silent workspace-mismatch — sibling)
- F-CT-01 (dual-emit capability — same family)
- ADR-0323 Pre-Promote-Preview Council Protocol (parent council)
