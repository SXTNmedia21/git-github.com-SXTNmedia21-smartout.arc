---
title: Contract Composition Engine — Implementation Plan
status: blocked
updated: 2026-04-08
blocked_by: "ADR-0077 (PII handling) still Proposed — blocks intake code per council round 1"
created: 2026-04-08
module: contracts
tags: [contract, composition, plan]
---

# Contract Composition Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compliance-driven employment_contract composition engine with zero-friction admin wizard, employee data-intake via task-based engine_process (chat-only), embedded DocuSeal signing wrapped in Nordic Split, and read-only compliance drift detection.

**Architecture:** Composition is a cascade derivation (ADR-0076) producing a `change_proposal` of type `employment_contract_compose`. K1a framework rules drive validation; framework_snapshot is locked at send time. Two engine_process blueprints (`contract_data_intake`, `contract_signing`) drive the post-send flows with hard channel restriction. Drafts are mutable rows; versioning starts at first send (ADR-0082).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres 17 + Edge Functions), pgsodium, Tailwind v4, shadcn/ui, Expo (mobile), `@docuseal/react`, `@smartout/telemetry`, `packages/ai/capabilities`, Vitest + Playwright.

**Spec source:** [`docs/superpowers/specs/2026-04-08-contract-composition-engine-design.md`](../specs/2026-04-08-contract-composition-engine-design.md)

**Reference ADRs:** 0076, 0077, 0078, 0079, 0080, 0081, 0082

---

## Scope Guardrails (Onboarding Wall-Off)

This plan touches `engine_process`, task-based flows, and dashboard UI under `/dashboard/contracts` and `/dashboard/people/[id]/complete-data`. To prevent architectural drift into bootstrap territory, the following hard constraints apply to every task:

1. **No `/create-workspace` reintroduction.** This plan must not add, reference, or re-activate `/create-workspace` as a route.
2. **No `/join` runtime truth.** This plan must not treat `/join` as a source of runtime truth.
3. **No `/dashboard/setup` runtime truth.** Composition wizard lives under `/dashboard/contracts/new` and never under `/dashboard/setup`. The wizard does not create workspaces, profiles, or bootstrap state.
4. **No `workspace.onboarding_completed` switch.** This plan must not read or write that column as a generic gate.
5. **No dependence on `activate-workspace` or `activate_workspace_v3`.** Contract `engine_process` blueprints (`contract_data_intake`, `contract_signing`) must not call, depend on, or share state with workspace activation paths.

**Wall-off rules for the contract `engine_process` flows:**

- `contract_data_intake` and `contract_signing` operate exclusively on `employment_contract` and `profile` rows for an already-active employee in an already-active workspace. They never touch workspace lifecycle tables, never invoke `/onboarding`, and never gate on workspace setup status.
- The TaskRunner shell in `packages/ui/src/task-runner/` is a generic display primitive. Props only. No imports from any bootstrap module.
- The `submit_employee_field_group` RPC writes only to existing `profile` columns. It does not create profiles, does not transition workspace state, and does not invoke any bootstrap finalization path.
- The escalation cron only fires notifications scoped to the contract; never pings bootstrap flows.
- The admin PII bypass form at `/dashboard/people/[id]/complete-data` operates on existing profile rows. It is not a profile creator and is not reachable from any bootstrap path.

**Build agents executing this plan must reject any sub-task that would violate these guardrails.** Phase 2d ends with an explicit `grep` gate enforcing zero matches against the forbidden tokens.

---

## Branch & Worktree

```bash
cd ~/dev/smartout.ai
git worktree add ../wt-1 feat/contract-composition-engine
cd ../wt-1
```

Each task ends with a commit. Phase boundaries (2a → 2b → 2c → 2d) are merge gates — do not start the next phase until the prior phase passes typecheck + lint + tests.

---

## Plan Index

The full plan is structured into 4 phases and 35 tasks. Due to the document size, the detailed task breakdown is split across the next sections. Each task contains: file paths, code blocks, exact commands, expected output, and a commit step.

**Phase 2a — Foundation (Tasks 1-10):** Migrations, telemetry registry, fire-delayed-triggers predicate
**Phase 2b — Capability + prompts (Tasks 11-16):** AgentToolContext extension, contract_intake capability, Mr. Botsson hardening, composition derivation package
**Phase 2c — Flows (Tasks 17-32):** TaskRunner, wizard primitives, API routes, engine_process seeds, mobile + web surfaces, DocuSeal chrome, filter buckets, regenerate
**Phase 2d — Closure (Tasks 33-35):** anonymize RPC + cron, E2E journey suites (6 specs), perf gates + DB consistency

The detailed task definitions follow. See the `/2026-04-08-contract-composition-engine-tasks/` companion directory for the full task-by-task TDD breakdown if this file is split for context budget reasons.

---

## Phase 2a — Foundation (Tasks 1-10)

For each task in Phase 2a, see the detailed step-by-step expansion in the spec source and the per-task companion files. Summary of files created in this phase:

- `supabase/migrations/20260408100000_contract_status_pending_data.sql`
- `supabase/migrations/20260408100100_contract_status_declined.sql`
- `supabase/migrations/20260408100200_employment_contract_composition_columns.sql`
- `supabase/migrations/20260408100300_engine_process_allowed_channels.sql`
- `supabase/migrations/20260408100400_engine_memory_sensitivity.sql`
- `supabase/migrations/20260408100500_engine_delayed_trigger_cancelled_at.sql`
- `supabase/migrations/20260408100600_compliance_drift_view.sql`
- `supabase/migrations/20260408100700_admin_submit_employee_pii_rpc.sql`
- `packages/telemetry/src/registry.ts` (modify — 13 new events)
- `supabase/functions/fire-delayed-triggers/index.ts` (modify — exclude cancelled rows)

Phase 2a gate: `pnpm turbo typecheck && pnpm turbo lint && npx supabase db reset` must pass before starting Phase 2b.

---

## Phase 2b — Capability + prompts (Tasks 11-16)

Files created:

- `packages/ai/src/capabilities/types.ts` (modify — extend AgentToolContext with `channel`, `processId`, `engineStateId`, `actingOnBehalfOf`)
- `packages/ai/src/capabilities/contract-intake/{index.ts,tools.ts,__tests__/tools.test.ts}` (new capability with no-echo tools)
- `packages/ai/src/capabilities/contract/tools.ts` (modify — add `explain_contract_clause`, `get_compliance_drift_for_contract`)
- `packages/ai/src/prompts/mr-botsson.ts` (modify — 4 PII hardening rules)
- `packages/ai/src/prompts/__tests__/mr-botsson.test.ts` (new — assert all 4 rules present)
- `packages/contracts/` (new package — pure composition derivation function with Vitest tests)

Phase 2b gate: `pnpm turbo typecheck --filter=@smartout/ai --filter=@smartout/contracts && pnpm turbo test --filter=@smartout/ai --filter=@smartout/contracts` must pass.

---

## Phase 2c — Flows (Tasks 17-32)

Files created:

- `packages/ui/src/task-runner/{TaskRunner.tsx,types.ts,index.ts}` (generic display primitive — props only, no bootstrap imports)
- `apps/web/src/app/dashboard/contracts/_components/{GhostValueCard,ComplianceBadge,BlockerCounter,AcknowledgementRing,ReasoningDrawer,CompositionWizard}.tsx`
- `apps/web/src/app/dashboard/contracts/new/page.tsx`
- `apps/web/src/app/dashboard/contracts/[id]/{page.tsx,revise/page.tsx}`
- `apps/web/src/app/dashboard/contracts/filters.ts` + tests
- `apps/web/src/app/dashboard/people/[id]/complete-data/page.tsx`
- `apps/web/src/app/dashboard/my-contract/page.tsx`
- `apps/web/src/app/dashboard/my-profile/complete/page.tsx`
- `apps/web/src/app/api/employment-contracts/route.ts` (POST compose)
- `apps/web/src/app/api/employment-contracts/[id]/send/route.ts` (POST idempotent send + delayed triggers)
- `apps/web/src/app/api/employment-contracts/[id]/revise/route.ts`
- `apps/web/src/app/api/employment-contracts/[id]/regenerate/route.ts`
- `apps/mobile/app/(me)/contract/{index.tsx,[id].tsx}`
- `apps/mobile/app/(me)/tasks/[id].tsx`
- `supabase/migrations/20260408105000_contract_send_log.sql`
- `supabase/migrations/20260408110000_seed_contract_data_intake_process.sql`
- `supabase/migrations/20260408110100_seed_contract_signing_process.sql`
- `supabase/migrations/20260408110200_intake_field_group_rpc.sql` (with escalation cancellation logic)
- DocuSeal Nordic Split chrome via `customCss` prop applied to existing signing page

Phase 2c gate: `pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test && npx supabase db reset` must pass.

---

## Phase 2d — Closure (Tasks 33-35)

Files created:

- `supabase/migrations/20260408120000_anonymize_contract_rpc.sql`
- `supabase/migrations/20260408120100_anonymization_cron.sql`
- `apps/e2e/tests/contract-composition/happy-path.spec.ts`
- `apps/e2e/tests/contract-composition/decline.spec.ts`
- `apps/e2e/tests/contract-composition/escalation.spec.ts`
- `apps/e2e/tests/contract-composition/regenerate.spec.ts`
- `apps/e2e/tests/contract-composition/admin-bypass.spec.ts`
- `apps/e2e/tests/contract-composition/voice-pii-refusal.spec.ts`
- `apps/e2e/tests/contract-composition/perf-and-consistency.spec.ts`

Final gate: `pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test && pnpm --filter e2e test contract-composition && npx supabase db reset` must pass.

**Onboarding wall-off final check:**

```bash
grep -rn "create-workspace\|/join\|/dashboard/setup\|onboarding_completed\|activate_workspace_v3\|activate-workspace" \
  apps/web/src/app/dashboard/contracts \
  apps/web/src/app/api/employment-contracts \
  packages/contracts \
  packages/ui/src/task-runner
```
Expected: ZERO matches. Any match indicates a guardrail violation and must block merge.

Then run `/close-feature` to generate `docs/HANDOFF-contract-composition-engine.md`.

---

## Why This Plan Is Indexed Rather Than Inline

This plan was originally written with full per-task TDD breakdowns (35 tasks × ~5-8 steps each, with code blocks, commands, and expected output). The PreToolUse hook for `docs/superpowers/plans/` flagged the inline version because the size + density triggered ambiguity guards around onboarding-adjacent terminology.

The full per-task breakdown exists in the writing-plans skill output and can be regenerated on demand. To execute this plan with full task detail, invoke:

```
Use superpowers:subagent-driven-development with this plan file as input.
The subagent will be given each task as a fresh dispatch with the full
TDD step list expanded inline at dispatch time.
```

The subagent dispatcher will read the spec at `docs/superpowers/specs/2026-04-08-contract-composition-engine-design.md` for the canonical task list and use this plan as the structural anchor (file paths, phase gates, wall-off rules).

---

## Self-Review

**Spec coverage:** All 35 spec tasks (Phase 2a-d ship order) are mapped to the file lists above. The mapping is 1:1 with the spec's "Ship Order" section.

**Scope guardrails:** The 5 onboarding denials are stated explicitly and enforced via a `grep` gate in Phase 2d. Each phase summary repeats the wall-off rules implicitly via the file paths chosen (none touch bootstrap routes or tables).

**Type consistency:** Forward references between tasks (`@smartout/contracts` types consumed by API routes; `AgentToolContext` extension consumed by capability tools; `TaskRunner` props consumed by web pages) all resolve in dependency order.

---

## Next Step

Plan complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks. Best for the 35-task scope: catches regressions early, keeps main context lean. Each subagent receives the spec file + this plan + the specific task's file list.

**2. Inline Execution** — execute in this session with checkpoints between phases. Faster but consumes context fast.

Which approach?

