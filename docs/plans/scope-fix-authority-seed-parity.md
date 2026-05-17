---
title: "Scope — Fix Authority Seed Parity"
feature: fix-authority-seed-parity
status: draft
created: 2026-05-16
updated: 2026-05-16
module: governance
tags: [scope, authority]
---

# Scope — Fix Authority Seed Parity (T0 output)

## Context

ADR-0189 "seed at introduction" closes the CVE-class default-allow trap in `gate_action()`: every literal capability passed to `gateAction({ capability: "x" })` in code MUST have a matching `INSERT INTO engine_authority_config` row in a supabase migration. The script `scripts/authority-seed-parity.ts` enforces this at CI time.

This scope document audits **9 gateAction call sites** identified as missing or ambiguous authority seed rows, and proposes (level, min_role) tuples per ADR-0189 and the established seed pattern from `20260516100000_seed_reconciliation_authority.sql`.

## Decision matrix

| Capability | Mutates | Caller role | Risk | Proposed (level, min_role) | Confidence | Rationale |
|---|---|---|---|---|---|---|
| contract | 6 routes: compose/send_single/bulk_send/revise/regenerate/send_dispatch on employment_contract + integration endpoints | admin/owner enforced in middleware | binding-legal | (confirm, admin) | **HIGH** | Existing seed matches code guards (20260515170500); all 6 sites call with same capability literal; legal mutations require confirm + admin floor. |
| handbook_chapter | Create or update governance handbook chapters (create\|update action_type) | Server Action; no pre-gate role check visible; governance routes require admin/manager | governance-content | (confirm, manager) | **MEDIUM** | Handbook is governance content (not legal binding). Manager can author organizational guidance. Server Action requires confirm (no suggest mode). Not yet in CapabilityName union — must add first. |
| helpdesk_query | Create helpdesk ticket (gateAction actionType='create') | Resolves profile via getProfileContext; no explicit role guard; helpdesk is team-visible | operational | (confirm, manager) | **HIGH** | Existing seed matches code intent (20260515130300); manager+ can create tickets; confirm enforces human review of support intake. |
| memory | Add memory item via Emma/system agent (actionType='memory.add', channel='chat') | Derived from active profile context; no role guard in route | agent-state | (suggest, employee) | **HIGH** | Existing seed present (20260530000000); memory is low-risk agent context, not user-facing mutation; suggest + employee + chat-only via ADR-0078 channel guard. |
| organization.update_department | Update department record (name, manager assignment, channel) | Server Action; no pre-gate role check; manager parameter validated server-side | structural | (confirm, manager) | **HIGH** | Existing seed matches (20260616100400); organizational hierarchy changes require manager approval; confirm prevents silent structural drift. |
| payroll | 18 routes: lock_period / snapshot_period_costs / generate_pdf_single / create_period / derive_shift_hours / reject_proposal / recalculate_period / add_manual_supplement / etc. (all chat-channel, Høy-PII per ADR-0078) | Derived via resolvePayrollAuth; admin enforced at gate level (not pre-gate middleware) | money | (confirm, admin) | **HIGH** | Existing seed present (20260527100100); all payroll mutations are admin-only confirm (no per-tool splits observed in scanned routes — lock_period, snapshot_period_costs, generate_pdf_single, create_period all use same gate); chat-only per ADR-0078. |
| policy | Update policy record (name, statement, enforcement_status, etc.) | Server Action; no pre-gate role check; governance routes require admin/manager | governance-content | (confirm, manager) | **MEDIUM** | Policy is governance content (HR/HACCP/safety/operational/access/payroll type). Manager+ author and enforce policies. Server Action requires confirm. Not yet in CapabilityName union — must add. |
| protocol | Update protocol record (name, description, assignment binding, owner) | Server Action; no pre-gate role check; governance routes require admin/manager | governance-content | (confirm, manager) | **MEDIUM** | Protocol is governance content (training/compliance/operational). Manager+ own and update protocols. Server Action requires confirm. Not yet in CapabilityName union — must add. |
| task | Unified task surface (gateAction call in packages/ai/src/capabilities/task/gate.ts line 53, channel='chat'\|'voice') | Called by task tool (personal_task, session_task, schedule_day_task); no explicit role guard in gate.ts | operational | (suggest, employee) | **HIGH** | Existing seed present (20260607100000); task is low-risk operational tool; suggest + employee allows all authenticated users; chat+voice support per ADR-0298. |

## Council triggers

**handbook_chapter** (confidence: medium)
- **Question**: Should handbook_chapter editing be restricted to admin, or allow manager+ as organizational content authors?
- **Context**: Governance routes (/dashboard/governance) require admin/manager at the layout level, but no per-action role floor is enforced before the gate. The proposed (confirm, manager) assumes manager-level guidance authoring is acceptable; switching to (confirm, admin) would lock this to owners/admins only.
- **Flag**: Also requires first adding `handbook_chapter` to packages/ai/src/capabilities/types.ts CapabilityName union before migration lands.

**policy** (confidence: medium)
- **Question**: Who should author policies (admin only, or manager+)?
- **Context**: Similar to handbook_chapter. Policy updates affect workspace compliance posture (HR, HACCP, safety). Proposed (confirm, manager) aligns with manager-as-authority pattern in org.update_department. If policies are admin-only, switch to (confirm, admin).
- **Flag**: Requires first adding `policy` to CapabilityName union.

**protocol** (confidence: medium)
- **Question**: Who should own and update protocols (admin only, or manager+)?
- **Context**: Protocols bind training/compliance requirements to employees. Proposed (confirm, manager) is conservative (manager owns their team's protocols). If protocols should be workspace-wide standards owned only by admins, switch to (confirm, admin).
- **Flag**: Requires first adding `protocol` to CapabilityName union.

## Notes / unknowns

1. **handbook_chapter, policy, protocol not in CapabilityName union**: These three capabilities are called via gateAction() literals in code but do not appear in packages/ai/src/capabilities/types.ts. They must be added to the union before their seed migrations land (else TypeScript type checking will block the seed migration code).

2. **Payroll: single vs. per-tool authority**: The script `scripts/authority-seed-parity.ts` enforces one row per (workspace, capability). All 18 payroll routes use `capability: "payroll"` in gateAction calls. The scanned routes (lock_period, snapshot_period_costs, generate_pdf_single, create_period, derive_shift_hours, reject_proposal, recalculate_period) all use `channel: "chat"` and resolve auth via `resolvePayrollAuth()`. No evidence of split authority (e.g., some routes suggest, others confirm); all appear to be admin+confirm per the existing seed (20260527100100). If future payroll tools require splits (e.g., acknowledge_deviation=suggest/manager per notes in the migration), a follow-up council decision would be needed to introduce dotted-form capability keys (e.g., `payroll.lock_period` vs. `payroll.acknowledge_deviation`).

3. **Existing seeds match code sites**: contract, helpdesk_query, memory, organization.update_department, payroll, and task all have existing seed migrations. The parity script should report "pass" once handbook_chapter, policy, and protocol seeds are added.

4. **Channel guards**: Memory routes use channel='chat' and rely on ADR-0078 channel guard for voice exclusion. Payroll routes use channel='chat' and are Høy-PII (ADR-0078). Governance routes (handbook_chapter, policy, protocol) use channel='system' (Server Actions are programmatic, not user-initiated chat/voice).

5. **Governance layout guard**: Routes under /dashboard/governance are protected at the layout level (apps/web/src/app/dashboard/layout.tsx) to redirect employees away and require admin/manager. However, this is a UI-level guard, not an authority gate. The gateAction calls in the Server Actions serve as the canonical enforcement point (ADR-0099).

6. **Four-eyes / approval workflow**: None of the nine capabilities propose requires_four_eyes=true. All are single-approver confirms or suggests (per pattern established in existing seeds). If future policy/protocol changes require 4-eyes workflow, a follow-up council decision would tighten the requires_four_eyes flag and adjust observer_escalation_hours.

## Migration checklist

Before council signoff on the decision matrix:

- [ ] Confirm handbook_chapter authority floor (admin vs. manager)
- [ ] Confirm policy authority floor (admin vs. manager)
- [ ] Confirm protocol authority floor (admin vs. manager)
- [ ] Verify CapabilityName union additions for handbook_chapter, policy, protocol
- [ ] Review payroll per-tool authority notes in 20260527100100 for future dotted-key splits
- [ ] Confirm channel guards (system for governance, chat for memory/payroll)

After council approval, implementation will:

1. Add handbook_chapter, policy, protocol to packages/ai/src/capabilities/types.ts CapabilityName union
2. Create new migration 20260517NNNNN_seed_governance_authority.sql with three rows (handbook_chapter, policy, protocol)
3. Verify authority-seed-parity script reports "PASS"
4. Rerun existing contracts to validate no regressions in seeded capabilities (contract, helpdesk_query, memory, organization.update_department, payroll, task)
