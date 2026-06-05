---
title: "Handoff — contract-composition-engine"
feature: contract-composition-engine
branch: feat/contract-composition-engine
closed: 2026-04-09
module: contracts
---

# Handoff — contract-composition-engine

## Summary

Built a compliance-driven employment contract composition engine implementing ADRs 0076-0082. Admin wizard derives contract terms from cascade (D2 profile + K1a framework rules + tariff rates), employees complete PII intake via chat-only engine_process, and contracts are signed via DocuSeal. Includes compliance drift detection, admin PII bypass with audit trail, and contract versioning with lineage. 34 commits, 79 files, ~5300 lines added.

## What Was Done

- [x] 8 database migrations: enum extensions, composition columns, engine infra, compliance drift view, PII bypass RPC, engine process seeds, anonymize RPC
- [x] 13 new telemetry events registered and routed
- [x] fire-delayed-triggers updated with cancelled_at predicate
- [x] AgentToolContext extended with channel, processId, engineStateId, actingOnBehalfOf
- [x] New contract_intake capability (3 tools, chat-only, no-echo PII)
- [x] Extended contract capability (explain_contract_clause, get_compliance_drift)
- [x] Mr. Botsson prompt hardened with 4 PII rules + 32 passing tests
- [x] resolveComposition cascade derivation function
- [x] TaskRunner shared UI primitive in packages/ui
- [x] 5 wizard primitives (GhostValueCard, ComplianceBadge, BlockerCounter, AcknowledgementRing, ReasoningDrawer)
- [x] Composition wizard at /dashboard/contracts/new (6 steps)
- [x] Contract detail + revise pages
- [x] Dashboard filter bucketing (3 groups with tests)
- [x] Admin PII bypass form at /dashboard/people/[id]/complete-data
- [x] Employee my-contract + my-profile/complete pages
- [x] Mobile contract + task screens (3 screens)
- [x] Send, revise, regenerate API routes
- [x] Contracts list page updated with filter tabs
- [x] E2E test stubs (3 spec files)
- [x] Council review: 8 blocking bugs fixed (column names, process lookup, JSONB access, role gates, actor_id, scope creep reverts)

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Composition bypasses change_proposal (ADR-0076 deviation) | MVP scope — wizard produces ContractDraftProposal directly, not via change_proposal table | Must document as tracked debt, amend ADR-0076 or implement later |
| Drafts are mutable, versioning at send (ADR-0082) | Reduces complexity — single mutable draft row until first send | parent_contract_id FK tracks lineage after send |
| Chat-only for PII intake (ADR-0078) | Voice/SMS cannot guarantee PII security | 3-layer defence: process, capability, tool level |
| Compliance drift read-only (ADR-0080) | No reactive fan-out, too risky for automated contract changes | Admin must manually regenerate from framework |
| Admin PII bypass via SECURITY DEFINER (ADR-0081) | Cross-user write needs elevated privileges | Audit trail + employee notification enforced in RPC |

## Learnings

| Learning | Context |
|----------|---------|
| Column naming matters: address_line_1 vs address_line1 | Database uses underscores before numbers, TypeScript camelCase doesn't match. Always verify against database.types.ts |
| Engine process lookup by id, not name | process_id is the TEXT PK, name is human-readable. Seed sets both differently |
| Subagents need schema verification | 3 of 6 critical bugs were column/field mismatches that subagents introduced because they didn't verify against actual DB schema |
| Council review catches real bugs | All 4 agents found independent issues. Steward + Supervisor both found bugs 1-2. Agent Coordinator found 6 missing contracts. Frontend found 9 design issues |
| actor_id must be profile_id, not auth UID | Telemetry registry documents this but API routes easily mistake auth.uid() for the right value |

## Known Issues / Debt

- ReasoningDrawer should use Sheet component instead of fixed panel (breaks Nordic Split on <1440px)
- DerivationStep uses bare spinner instead of WizardLoadingOverlay
- 16+ hardcoded Tailwind colors (text-green-600 etc.) need CSS variable migration
- Hardcoded Norwegian text needs i18n keys
- Missing motion/animation on wizard transitions
- GhostCard should be shared primitive in packages/ui (diverges from join wizard)
- ADR-0076 change_proposal integration not implemented
- ADR-0082 idempotency key on send endpoint not implemented
- Intent classifier needs update for contract vs contract_intake disambiguation
- Authority config defaults for contract_intake not seeded
- actingOnBehalfOf should be stripped from agent context
- Entity type inconsistency: "contract" vs "employment_contract" in tools
- DocuSeal Nordic Split chrome not implemented
- E2E tests are stubs (test.skip)
- Performance gates not measured
- engine_memory.expires_at cleanup job not implemented
- anonymize_contract has no scheduled invocation

## Next Steps

- Address council follow-up items (design issues first, then architectural gaps)
- Implement real E2E tests using seed helpers
- Add DocuSeal customCss wrapping
- Seed authority config defaults for contract_intake
- Update intent classifier for capability disambiguation
- Consider amending ADR-0076 to document the change_proposal omission
