---
title: "Plan — audit-adr0151-derivation"
feature: audit-adr0151-derivation
spec: ../audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: cross-cutting
tags: [plan, audit, adr-0151, identity, derivation, se-02-01, f-mo-06]
---

# Plan — audit-adr0151-derivation

> Branch: `feat/audit-adr0151-derivation` | Worktree: `~/dev/smartout.ai-wt-8` | Module: cross-cutting

**Spec:** SE-02-01 + F-MO-06 from synthesis. Both inject body-supplied identity. ADR-0151 spirit violation.

## Background

ADR-0151: identity (workspace_id, profile_id, user_id) MUST be derived server-side from JWT/session, never body-supplied. Two open violations:

- **SE-02-01** (HIGH): `apps/web/src/app/api/botsson/chat/route.ts:142-149` injects `body.primeContext.profileId` directly into LLM-visible system prompt. Risk: admin feeds agent false employee identity. Not DB key — LLM context integrity + audit-trail pollution.
- **F-MO-06** (HIGH): `apps/mobile/src/app/(me)/contract/complete-data.tsx:86,105` calls `submit_own_pii` RPC with body-supplied `p_workspace_id` from `profile?.workspace_id`. Highest-risk mobile surface for workspace leak on PII path.

## Journeys

- [JOURNEY-audit-adr0151-derivation-bff-derives-profile-id-not-body](../journeys/JOURNEY-audit-adr0151-derivation-bff-derives-profile-id-not-body.md)
- [JOURNEY-audit-adr0151-derivation-rpc-rejects-forged-workspace-id](../journeys/JOURNEY-audit-adr0151-derivation-rpc-rejects-forged-workspace-id.md)

## Goal

Close SE-02-01 + F-MO-06. Server-derive identity in both surfaces. Body-supplied identity ignored or rejected.

## Tasks

- [ ] T1 SE-02-01: Read `apps/web/src/app/api/botsson/chat/route.ts:142-149` context. Find existing JWT-derive helper (likely `getProfileContext()` or session util in same route). Replace `body.primeContext.profileId` with derived value in LLM system prompt interpolation. Body-supplied other primeContext fields (workspace name etc) preserved.
- [ ] T2 SE-02-01 test: vitest asserts body-supplied profileId IGNORED — derived value wins in system prompt.
- [ ] T3 F-MO-06: Read `submit_own_pii` RPC definition (`supabase/migrations/*submit_own_pii*.sql`). If RPC accepts `p_workspace_id` arg, refactor to use `auth.uid()` server-side OR add server-check that p_workspace_id matches JWT workspace.
- [ ] T4 F-MO-06: Update mobile caller (`complete-data.tsx`) to drop body-supplied p_workspace_id. Use server-derived from JWT.
- [ ] T5 Synthesis SE-02-01 + F-MO-06 → CLOSED.
- [ ] T6 Flip 2 journeys.

## Acceptance Criteria

- [ ] **S1** SE-02-01: `botsson/chat/route.ts` no longer reads `body.primeContext.profileId` into LLM prompt
- [ ] **S2** SE-02-01 vitest: body-supplied profileId IGNORED, derived from JWT used
- [ ] **S3** F-MO-06: `complete-data.tsx` no longer passes body-supplied `p_workspace_id`
- [ ] **S4** F-MO-06: `submit_own_pii` RPC server-derives workspace_id from auth.uid() OR rejects body-supplied if mismatch
- [ ] **S5** Mobile smoke or vitest: complete-data flow still works
- [ ] **S6** Audit synthesis SE-02-01 + F-MO-06 → CLOSED
- [ ] **S7** `pnpm turbo typecheck` 0 errors
- [ ] **S8** 2 journeys verified

## Council triggers

- Mobile JWT inaccessibility (ADR-0132 thin-client) → BFF wrap of submit_own_pii instead of RPC change?
- LLM context degradation if body.primeContext.profileId removed without replacement → confirm replacement source

## Out of scope

- Other ADR-0151 violations beyond these 2 (separate sweep)
- LLM-context contract changes (out of synthesis scope)
- BFF redesign (only minimal change needed to close findings)
