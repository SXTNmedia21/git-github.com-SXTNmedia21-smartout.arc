---
title: "Mobile Production Readiness — Implementation Plan"
status: in_progress
updated: 2026-03-26
created: 2026-03-26
module: mobile
tags: [mobile, walkAi, capabilities, hub, deep-links]
---

# Mobile Production Readiness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Smartout mobile app production-ready for employee journeys: WalkAi voice/text, smart home hub, deep link routing, and 3 new AI capabilities.

**Architecture:** Hub-and-spoke mobile app with WalkAi (Ultravox voice via Expo Web) as first-class interaction. 3 new backend capabilities (schedule, operations, communication) shared between web and mobile. Pure function priority engine for home hub. Deep link map migrated to shared package.

**Tech Stack:** React Native + Expo (Web first), TypeScript, TanStack Query, Zustand, Reanimated, @smartout/agent-sdk, @smartout/telemetry, @smartout/i18n, Supabase

**Spec:** `docs/superpowers/specs/2026-03-26-mobile-production-readiness-design.md`

---

## Task Summary (18 tasks across 5 phases)

| Phase | Task | Description                       | Files                                             |
| ----- | ---- | --------------------------------- | ------------------------------------------------- |
| 0     | T1   | Add agent telemetry types         | `packages/telemetry/src/registry.ts`              |
| 0     | T2   | Create mobile i18n namespace      | `packages/i18n/locales/nb/mobile.json`            |
| 0     | T3   | Fix authority default mismatch    | `services/stage-engine/src/core/agent-router.ts`  |
| 1     | T4   | Build schedule capability         | `packages/ai/src/capabilities/schedule/`          |
| 1     | T5   | Build operations capability       | `packages/ai/src/capabilities/operations/`        |
| 1     | T6   | Build communication capability    | `packages/ai/src/capabilities/communication/`     |
| 1     | T7   | Register all 3 capabilities       | `packages/ai/src/capabilities/registry.ts`        |
| 1     | T8   | Create deep link map (migrate)    | `packages/notifications/src/deep-links.ts`        |
| 1     | T9   | Create priority engine + tests    | `apps/mobile/src/lib/prioritize-actions.ts`       |
| 2     | T10  | Create WalkAi provider            | `apps/mobile/src/providers/walkai-provider.tsx`   |
| 2     | T11  | Create mobile client tools        | `apps/mobile/src/lib/walkai-tools.ts`             |
| 2     | T12  | Build WalkAiSheet (voice UI)      | `apps/mobile/src/components/ai/WalkAiSheet.tsx`   |
| 2     | T13  | Update FAB gestures               | `apps/mobile/src/components/navigation/AIFab.tsx` |
| 3     | T14  | Smart Home Hub (priority cards)   | `apps/mobile/app/(app)/(home)/index.tsx`          |
| 3     | T15  | Deep link routing in push handler | `apps/mobile/src/lib/push.ts`                     |
| 3     | T16  | Ring Leader wiring                | `apps/mobile/app/(app)/(me)/index.tsx`            |
| 4     | T17  | RLS audit                         | All query hooks                                   |
| 4     | T18  | Final typecheck + tests           | Monorepo-wide                                     |

## Parallelization

- **Phase 0:** T1, T2, T3 — all parallel
- **Phase 1:** T4, T5, T6, T8, T9 — all parallel. T7 depends on T4+T5+T6.
- **Phase 2:** Sequential: T10 → T11 → T12 → T13
- **Phase 3:** T14, T15, T16 — parallel (T14 depends on T9, T15 depends on T8)
- **Phase 4:** Sequential: T17 → T18

## Detailed task instructions

Full implementation code for all 18 tasks was presented in the conversation session. Each task includes:

- Exact file paths (create/modify)
- Complete code blocks with imports
- Test code where applicable
- Typecheck commands
- Commit messages

The conversation contains the complete plan. Execute using superpowers:subagent-driven-development with one agent per task.
