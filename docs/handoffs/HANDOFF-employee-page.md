---
title: "Handoff — employee-page"
feature: employee-page
branch: feat/employee-page
closed: 2026-04-09
module: people
---

# Handoff — employee-page

## Summary

Comprehensive bugfix and wiring session for the people page and contract system. Found and fixed 6 dead/broken UI elements on the people page, 2 critical contract system bugs (non-functional wizard + broken template fetch), a 14-field data loss in the onboarding finalize RPC, and added a live Tiptap contract preview editor. 12 commits, ~2000 lines changed across 25 files.

## What Was Done

- [x] People page: emergency contact save fixed (was writing to wrong table)
- [x] People page: "Send påminnelse" button wired to sendProtocolReminder
- [x] People page: "Opprett" contract button wired to ContractSendDrawer
- [x] People page: "Active Now / clocked in" label corrected to "Active / employees"
- [x] People page: telemetry added to all 7 server actions (7 new event types registered)
- [x] People page: navigation link to /dashboard/contracts added
- [x] Contract wizard: wired to POST /api/employment-contracts (was static mockup)
- [x] Contract wizard: UUID input replaced with searchable employee picker
- [x] Contract wizard: telemetry emit on successful composition
- [x] Contract send-drawer: template fetch data-format bug fixed ({ data } unwrap)
- [x] Contract send-drawer: placeholder values pre-filled from profile via new API route
- [x] Contract send-drawer: resilient send (queues when microservice is down)
- [x] Contract draft creation: writes directly to Supabase, no microservice needed
- [x] Contract preview editor: live Tiptap editor in send-drawer (from wt-1)
- [x] Tariff lookup: framework_id filter added to resolve-composition
- [x] Company org_number: fixed column name in placeholder resolver
- [x] CEO/daglig leder: added to BusinessData + data-merger from Brreg
- [x] Finalize RPC: complete restoration (14 lost fields across 5 sections)
- [x] Navigation: contracts as sub-link under Ansatte + global search
- [x] Council session: Contract System Reconciliation (all 4 agents)
- [x] E2E: 23/23 pass, results logged

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Contract draft without microservice | Microservice only needed for DocuSeal signing, not for draft persistence | POST /api/contracts writes directly to Supabase |
| Resilient send (202 always) | Contract-service may be down; user should not be blocked | Queued contracts have send_requested_at in metadata |
| Two strategies are complementary | Council verdict: cascade derives substance, templates own form | No architectural change needed, just wiring |
| Finalize RPC full restoration | 7 successive CREATE OR REPLACE lost 5 sections | Single migration with guard comment |
| Separate address fields in payload | Joined string was unparseable by RPC | addressLine1/postalCode/city sent individually |

## Learnings

| Learning | Context |
|----------|---------|
| UI shells without API calls are invisible failures | CompositionWizard was merged as "complete" but never called resolveComposition — silent mockup |
| API response shape mismatches are silent | { data: [...] } vs [...] — drawer always showed empty |
| CREATE OR REPLACE clobbers entire function | 7 migrations each rewrote the RPC, losing sections from earlier versions |
| Column name mismatches fail silently in Supabase | organization_number vs org_number — join returns null, no error |
| Service-role seed data masks RLS gaps | Seed creates contracts via admin client but user can't read them via RLS |

## Known Issues / Debt

- Hardcoded Norwegian text throughout (i18n deferred)
- 16+ hardcoded Tailwind colors in contract components
- No E2E tests for people page mutations or contract send flow
- Composition wizard i18n + Nordic Split compliance not done
- change_proposal integration per ADR-0076 not implemented (Phase 2)
- Workspace admin template CRUD not built (Phase 2)
- contract_intake AI capability unreachable (Phase 3 — 3 blockers)
- authority config seeds use wrong key format (dotted vs flat)
- time_entry query 400 error (pre-existing, not related)

## Next Steps

- Phase 2: change_proposal integration, workspace admin template CRUD at /dashboard/settings/contracts/
- Phase 3: wire contract_intake into intent classifier + fix channel guard
- Write E2E tests for people page mutations and contract flow
- i18n pass on all contract + people components
- Nordic Split compliance (hardcoded colors → CSS variables)
