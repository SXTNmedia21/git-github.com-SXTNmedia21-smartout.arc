---
title: "Plan — contract-hub-fix-forward"
feature: contract-hub-fix-forward
spec: ../../docs/superpowers/specs/2026-04-22-contract-hub-redesign.md
status: in_progress
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [plan, fix-forward, p0, cve]
---

# Plan — contract-hub-fix-forward

> Branch: `feat/contract-hub-fix-forward` | Worktree: `~/dev/smartout.ai-wt-1` | Module: contracts

**Spec:** [Contract Hub Redesign](../superpowers/specs/2026-04-22-contract-hub-redesign.md) (this is a follow-up; original spec covers context)

**Council Gate 4 R2 verdict:** APPROVE WITH FIX-FORWARD SORTIE — 4 P0 defects block `development → preview` promotion.

## Journeys (the contract)

- [JOURNEY-fix-authority-seed-cve](../journeys/JOURNEY-fix-authority-seed-cve.md) — UPSERT seed + bootstrap trigger; backfill unseeded workspaces
- [JOURNEY-fix-fork-template-auth](../journeys/JOURNEY-fix-fork-template-auth.md) — Forward agent identity to BFF (or refactor to direct admin per ADR-0191) + re-enable MalerTab fork buttons
- [JOURNEY-fix-fork-triple-emit](../journeys/JOURNEY-fix-fork-triple-emit.md) — Single canonical emit site; deprecate duplicates
- [JOURNEY-fix-bulk-gate-action](../journeys/JOURNEY-fix-bulk-gate-action.md) — gate_action wiring + bulk_send_initiated event

## Goal

Close 4 critical defects post-merge of PR #234 so contract-hub-redesign can promote to preview environment safely.

## Tasks

### Fix #1 — Authority seed CVE (P0)
- [ ] Create new migration: convert seed to UPSERT, mirror helpdesk_query COALESCE pattern
- [ ] Add BEFORE INSERT trigger on workspace that auto-seeds engine_authority_config rows
- [ ] Backfill unseeded workspaces (existing rows in workspace table without contract authority)
- [ ] pgTAP test: fresh DB → seed → contract authority row exists for all registered capabilities

### Fix #2 — forkTemplate auth (P0)
- [ ] Decide pattern per ADR-0191 (when accepted): BFF + signed header OR direct admin
- [ ] Implement chosen pattern in packages/ai/src/capabilities/contract/tools.ts:fork
- [ ] If direct admin: mirror publish/deprecate signature
- [ ] If BFF: add x-agent-actor + service-key dual-auth to /api/contract-templates/copy
- [ ] Re-enable MalerTab fork buttons (apps/web/src/app/dashboard/contracts/_components/MalerTab.tsx:236-245)

### Fix #3 — Triple-emit dedup (P0)
- [ ] Choose canonical emit site: route OR tool, not both
- [ ] Drop duplicate `contract_template forked` from tools.ts:476-488
- [ ] Decide fate of legacy `contract_template copied` event (deprecate or keep)

### Fix #4 — Bulk endpoint gate_action (P0)
- [ ] Add gate_action call at bulk/route.ts entry
- [ ] Add `contract.bulk_send_initiated` event to telemetry registry
- [ ] Emit at bulk start with batch_id + profile_count

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] `pnpm turbo typecheck` passes 0 errors
- [ ] pgTAP authority-seed parity test passes
- [ ] Fork via agent (Botsson chat) succeeds end-to-end (no 401)
- [ ] Single audit_trail row per fork operation
- [ ] Bulk-send creates gate_evaluation row
