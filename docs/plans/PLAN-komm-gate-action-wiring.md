---
title: "Komm Gate-Action Wiring — Implementation Plan"
id: PLAN-komm-gate-action-wiring
status: in_progress
layer: plan
created: 2026-04-29
updated: 2026-04-29
module: botsson
tags: [botsson, komm, gate-action, adr-0099, voice-guard]
depends_on:
  - ADR-0099
  - ADR-0078
---

# Komm Gate-Action Wiring — Implementation Plan

**Goal:** Wire `gate_action` authority checks into the two komm mutation hooks (`useSendMessage`, `useCreateChannel`) and add ADR-0078 voice channel guards in the `sendMessage` + `createChat` Botsson tool executors.

**Tech Stack:** Next.js 14 App Router, TanStack Query v5, Supabase anon client, `@smartout/telemetry`.

**Source documents:**

- ADR-0099 — gate_action as the single AI-write authority gate
- ADR-0078 — voice channel restriction for sensitive/write operations
- `packages/ai/src/capabilities/season/gate.ts` — canonical gate_action call shape
- `supabase/migrations/20260518030000_season_archive_duplicate_authority_seed.sql` — migration seed pattern

---

## Architecture Overview

The `useSendMessage` and `useCreateChannel` hooks currently insert directly into `channel_message` / call `create_channel` RPC without passing through the C4 authority gate. Per Law 2 (ADR-0099) every mutation must call `gate_action` first.

The gate call is made from the **client-side anon client** (same client used for the insert). The RPC is callable by any authenticated user; the gate evaluates capability + actor role against `engine_authority_config`. New authority rows (`komm.send_message`, `komm.create_channel`) are seeded in a migration so workspaces have an explicit config.

The voice-channel guard (ADR-0078) lives in the Botsson tool executors in `use-komm-tools.ts` — it must reject `sendMessage` and `createChat` calls when the tool is invoked over a voice session. The tools already delegate to `onSendMessage` / `onCreateChat` callbacks provided by `KommToolsBridge`; the guard goes at the top of each executor before the delegate call.

## Prerequisites

- [x] `useSendMessage` and `useCreateChannel` hooks exist
- [x] `use-komm-tools.ts` and `komm-tools-bridge.tsx` exist in main repo
- [x] `gate_action` RPC is deployed (migrations landed)
- [x] `engine_authority_config` table exists

## Tasks

### Task 1: Authority migration — seed `komm.send_message` + `komm.create_channel`

**What:** Create a migration that seeds `engine_authority_config` rows for both actions across all existing workspaces. Default `min_role='employee'`, `level='suggest'`. Idempotent via ON CONFLICT DO NOTHING.

**Files:** `supabase/migrations/20260519200000_seed_komm_authority.sql`

**Acceptance:** Migration applies cleanly on local. Rows visible in `engine_authority_config`.

### Task 2: Wire `gate_action` in `useSendMessage`

**What:** Before the `.from("channel_message").insert(...)`, call `supabase.rpc("gate_action", { p_workspace_id, p_capability: "komm.send_message", p_action_type: "send", p_actor_profile_id: profileId, p_channel: "chat" })`. If `data.allow !== true`, throw a descriptive error (which surfaces via `onError` + toast).

**Files:** `apps/web/src/app/dashboard/komm/_hooks/use-send-message.ts`

**Acceptance:** Hook throws before insert when gate denies. Emit still fires only on `onSuccess`.

### Task 3: Wire `gate_action` in `useCreateChannel`

**What:** Same pattern as Task 2 before the `.rpc("create_channel", ...)` call. Capability: `komm.create_channel`, action_type: `create`.

**Files:** `apps/web/src/app/dashboard/komm/_hooks/use-create-channel.ts`

**Acceptance:** Hook throws before RPC when gate denies.

### Task 4: Voice channel guard in `sendMessage` + `createChat` tool executors

**What:** At the top of the `sendMessage` and `createChat` implementations in `use-komm-tools.ts` (inside `implementations` memo), check if the tool was invoked via voice. The `KommToolInput` does not carry a `channel` field — the guard cannot inspect it from inside the executor. Instead, the guard is added to `KommToolInput` as an optional `sessionChannel?: "voice" | "chat"` prop, wired through from `KommToolsBridge` (which has access to `useWorkspace` / session context). The executor returns `{ ok: false, reason: "Kan ikke sende meldinger eller opprette kanaler over voice. Bytt til chat." }` when `sessionChannel === "voice"`.

**Files:**
- `apps/web/src/app/dashboard/komm/_tools/use-komm-tools.ts`
- `apps/web/src/app/dashboard/komm/_tools/komm-tools-bridge.tsx`

**Acceptance:** `sendMessage` and `createChat` executors return early with a Norwegian error string when `sessionChannel === "voice"`.

### Task 5: Update BOTSSON-SYSTEM-MAP.md

**What:** Add komm tooling row under L1 showing 5 mounts + 8 tools, 🟢.

**Files:** `docs/architecture/BOTSSON-SYSTEM-MAP.md`

**Acceptance:** Map updated with komm row.

## Validation

- [ ] `pnpm turbo typecheck` passes (0 errors)
- [ ] `use-send-message.ts` calls gate_action before insert
- [ ] `use-create-channel.ts` calls gate_action before rpc
- [ ] sendMessage + createChat executors guard voice channel
- [ ] Authority migration is idempotent (ON CONFLICT DO NOTHING)
- [ ] emit() still fires only after successful DB write (onSuccess, not mutationFn)

## Post-Implementation

- [ ] Update BOTSSON-SYSTEM-MAP.md (included in Commit 4)
- [ ] Record in ROADMAP-ai-harness.md evidence trail
- [ ] Move to `docs/plans/completed/` when done

---

> After writing: add to `docs/INDEX.md` under Plans.
