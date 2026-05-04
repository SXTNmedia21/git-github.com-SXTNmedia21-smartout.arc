---
title: "Harness Invariants — Compiled Index"
status: canonical
updated: 2026-04-23
created: 2026-04-23
module: MODULE_BOTSSON
tags: [invariants, ci, harness, adr-index, intent-coverage]
---

# Harness Invariants

> **Purpose:** Single compiled index of every invariant the Botsson harness relies on. Each row cites its binding ADR and its CI-enforcement status. Colours follow `BOTSSON-SYSTEM-MAP.md` convention:
>
> - 🟢 enforced by CI (compile-time or PR-blocking script)
> - 🟡 partially enforced (some paths covered, gaps known)
> - 🔴 prose-only (no CI signal — honest gap, tracked as follow-up)
>
> This file does NOT re-state ADR bodies. It links.

## Contract-Layer Invariants

| #   | Invariant                                                                                                                                                      | Source ADR                 | CI check                                       | Status |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------- | ------ |
| I1  | Every capability registered in `capabilities/registry.ts` declares `name`, `description`, `tools`, `readOnlyTools`, `allowedChannels`, `toolAuthPattern`, `emitPrefix` | ADR-0198                   | `pnpm turbo typecheck`                         | 🟢     |
| I2  | Every `emit()` event name in repo has a matching entry in `packages/telemetry/src/registry.ts`                                                                 | ADR-0116, ADR-0175, L-0094 | `invariants:emit-coverage`                     | 🟢     |
| I3  | Every `CapabilityDefinition.emitPrefix` is non-overlapping + registered to exactly one capability                                                              | ADR-0198                   | runtime assertion in `getAllCapabilities()`    | 🟢     |
| I4  | Every stage-engine POST body schema omits `profile_id`/`actor_id` (server-derived)                                                                             | ADR-0151                   | `invariants:server-actor`                      | 🟢     |
| I5  | Every capability tool's `execute` signature accepts exactly `AgentToolContext`                                                                                 | ADR-0099                   | `pnpm turbo typecheck`                         | 🟢     |
| I6  | `gate_action` is the single authorization gate (no direct `engine_authority_config` reads outside migrations)                                                  | ADR-0099                   | `invariants:gate-singleton`                    | 🟢     |
| I10 | Every capability in `capabilities/registry.ts` appears in the `intentSchema.capability` enum, and every non-`general` enum value is either registered or in the `DOCUMENTED_TOOLLESS` allow-list (`knowledge`, `payroll`, `general`) | ADR-0112                   | `invariants:intent-coverage`                   | 🟢     |

## Harness-Layer Invariants

| #   | Invariant                                                                          | Source ADR | CI check               | Status |
| --- | ---------------------------------------------------------------------------------- | ---------- | ---------------------- | ------ |
| I7  | Every migration touches RLS explicitly                                             | ADR-0018   | partial pgTAP coverage | 🟡     |
| I8  | Every Edge Function has dual-auth or explicit `verify_jwt=false` + signature verification | ADR-0039   | (none today)           | 🔴     |
| I9  | Every mutation emits to `activity_trail` (not just PostHog)                        | ADR-0116   | partial via auto-emit  | 🟡     |

## Changelog

| Date       | Change                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-04-23 | Initial version. 9 invariants. 6 🟢, 2 🟡, 1 🔴.                                                                      |
| 2026-04-23 | Added I10 (intent-classifier coverage, ADR-0112) — `invariants:intent-coverage`. 10 invariants. 7 🟢, 2 🟡, 1 🔴.    |
