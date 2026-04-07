---
title: "Handoff — employee-contract-management"
feature: employee-contract-management
branch: feat/employee-contract-management
closed: 2026-04-07
module: contracts
status: ready_for_merge
tags: [contracts, docuseal, botsson, handoff]
---

# Handoff — employee-contract-management

## Summary

Workspace admins can now create, send, and track employee contracts via DocuSeal e-signing. Botsson AI surfaces 5 contract tools (3 read-only, 2 mutation in suggestTools tier). Webhook propagates DocuSeal signing events to `employment_contract` via the new `signing_contract_id` FK. Architecture reuses the existing `contract` table by branching on `contract_type='employee'`. All 4 council reviewers approved (R3) after 6 R1 blockers and 3 R2 blockers were fixed.

## What Was Done

### Database
- [x] Migration `20260428210000_employee_contract_signing.sql`: adds `signing_contract_id` FK on `employment_contract`, 4 RLS policies for workspace-scoped employee contract access, 3 Norwegian system templates seeded (Fast ansatt, Deltid, Tilkallingsvikar)

### API Layer
- [x] `GET /api/contracts/templates` — list active employee templates (system + workspace)
- [x] `GET/POST /api/contracts` — list employee contracts paginated, create draft contract via contract-service with role gate (admin/owner only) and `emit("contract created")`
- [x] `GET /api/contracts/[id]` — detail with events
- [x] `POST /api/contracts/[id]/send` — send for signing via contract-service with `emit("contract sent")`
- [x] `POST /api/contracts/[id]/cancel` — cancel via contract-service with `emit("contract cancelled")`
- [x] DocuSeal webhook extended to branch on `contract_type` — employee contracts sync to `employment_contract.status` (declined → terminated mapping)

### Botsson Capability
- [x] New `contract` capability registered in CapabilityName union, intent classifier z.enum, registry, and tool selector
- [x] 5 tools using `defineTool` pattern: `list_employee_templates`, `list_employee_contracts`, `check_contract_status`, `create_employee_contract`, `send_employee_contract`
- [x] Read tools in `readOnlyTools`, both mutations in `suggestTools` (irreversible — require user confirm flow)
- [x] In-tool admin/owner role guard via `resolveActorRole(ctx)`
- [x] 10s `AbortController` timeout on contract-service fetch calls
- [x] `contract_type === "employee"` filter on send to prevent cross-type sends
- [x] `X-Service-Key` header (matches API route + lib/contract-service convention)
- [x] `emit("contract created")` after successful create — same registry shape as REST route

### Shared Packages
- [x] `packages/utils/src/employee-contract-placeholders.ts` — `buildEmployeePlaceholderMap()` resolves profile + employment_contract + workspace + company in parallel into 17 Norwegian placeholder keys
- [x] `packages/ui/src/components/contract-timeline.tsx` — reusable horizontal timeline (draft → sent → viewed → signed) with semantic CSS variable colors, `font-mono` timestamps, accessibility roles
- [x] `packages/telemetry` refactored to use `globalThis["window"]`/`globalThis["document"]` instead of `typeof window` — removes DOM-lib coupling so telemetry imports cleanly into server-only `@smartout/ai`

### UI
- [x] `/dashboard/contracts` page with DataTable (server pagination, status filter, semantic status badges, empty states)
- [x] Contract send drawer with 3-step flow (template selection → data review → preview & send), confirmation dialog, sonner toasts
- [x] People row action: "Send kontrakt" with `FileSignature` icon, gated on `profileId && onSendContract`
- [x] People DataTable wires `ContractSendDrawer` via `contractProfileId` state

### Quality
- [x] 5 ADRs registered in `docs/decisions/0000-decision-log.md`
- [x] 2 learnings filed (`0026-drawer-api-boundary-verification.md`, `0027-botsson-mutation-tools-must-emit.md`)
- [x] 4 API regression tests in `apps/e2e/tests/contracts-api.spec.ts` (schema + auth gates)
- [x] User journeys in `docs/journeys/JOURNEY-employee-contract-management.md` (4 journeys + cross-cutting concerns)
- [x] Performance gate tests fixed as side benefit (8 failing → 9 passing, 3 legit skips)
- [x] Typecheck passes on all touched packages: `web`, `@smartout/ai`, `@smartout/ui`, `@smartout/telemetry`, `@smartout/utils`
- [x] Lint: 0 errors on touched packages
- [x] Council R1 → R2 → R3 (3 rounds, all 4 reviewers, healthy 6→3→0 convergence)

## Decisions Made

| # | Decision | Reason | Impact |
|---|----------|--------|--------|
| 1 | Reuse `contract` table for employee contracts via `contract_type='employee'` branching | Existing infrastructure (DocuSeal integration, contract service, templates, reminders, audit) is already built. Creating a parallel `employee_contract_document` table would duplicate state | One table powers both SaaS and employee contracts; webhook branches on type |
| 2 | DocuSeal webhook owns `contract.status`; `employment_contract.status` propagated from webhook | Clear ownership, no race conditions, single source of truth for signing state | Webhook is the only place that writes to `contract.status`; HR record status follows |
| 3 | Map `declined` → `terminated` since `contract_status` enum has no `declined` value | Migration already applied, schema change would require data backfill across all existing contracts | Semantic loss documented as debt; revisit if HR needs to distinguish declined vs terminated |
| 4 | Botsson `sendEmployeeContract` placed in `suggestTools` (not `tools`) | Irreversible legal action requires user confirm flow; `suggestTools` tier is the only one that gates on user UI confirmation | AI cannot send contracts autonomously even at confirm/autonomous authority levels |
| 5 | Service-to-service auth uses `X-Service-Key` header (NOT `Authorization: Bearer`) | Matches existing pattern in `lib/contract-service.ts` and all other API routes that call contract-service | Botsson tools and Next.js routes use the same header convention |
| 6 | Botsson tool fetch calls require 10s `AbortController` timeout | Prevents agent hangs on slow/down services; protects WalkAi UX | All future Botsson tools should follow this pattern |
| 7 | POST `/api/contracts` requires admin/owner role check via user-scoped query | Prevents privilege escalation — caught by R2 council. Botsson had role guard but REST route did not | Sets a pattern: ALL contract-mutation surfaces require role check, not just AI tools |
| 8 | Botsson `createEmployeeContract` must call `emit()` directly, same shape as REST route | Capability layer is part of telemetry coverage, not separate. Caught by R2 council | Required refactoring `@smartout/telemetry` to remove DOM-lib coupling so server-only packages can import it |

All registered in `docs/decisions/0000-decision-log.md` (entries 1-5; 6-8 should be added during merge follow-up).

## Learnings

| Learning | Context |
|----------|---------|
| Drawer→API boundary requires end-to-end shape verification ([0026](learnings/0026-drawer-api-boundary-verification.md)) | R1 reviewed each side in isolation, R2 found drawer sent `field_values` while route expected `overrides` and drawer read `id` while route returned `contract_id`. Zod silent-strip + undefined cascade = broken send flow. Future reviews must trace every payload field both directions |
| Every Botsson mutation tool must call `emit()` ([0027](learnings/0027-botsson-mutation-tools-must-emit.md)) | R1 verified routes had emit() and assumed satisfied. R2 found Botsson tools were a parallel mutation path with no telemetry. Capability layer is NOT separate from telemetry — it's another emission site. Required refactoring telemetry package to be importable from server-only contexts |
| Council depth scales with cross-cutting surface area | Captured in council log R3 entry. R1→R2→R3 healthy convergence (6→3→0 blockers). Simpler features should converge in 2 rounds; cascade-touching features may need 4+ |
| Service-to-service auth pattern is `X-Service-Key`, not Bearer | Second time this confusion has happened in the codebase. Future Botsson tools and integration code should use `X-Service-Key` |
| Always verify Botsson tool schemas against `database.types.ts` before writing | 3 R1 reviewers independently caught the same column-name mismatches. Plans written from memory drift from reality fast |

## Known Issues / Debt

### Closure-blockers (must address before merge to development is fully clean — but not blocking R3 verdict)

1. **Type regen + `as never` cleanup** — Migration `20260428210000_employee_contract_signing.sql` not yet applied to local Supabase due to migration history drift from parallel worktree work (`Remote migration versions not found in local migrations directory`). After resolving the drift (`supabase migration repair --status reverted 20260428100500` then `supabase db reset`), regenerate `database.types.ts` and remove the `as never` cast on `apps/web/src/app/api/webhooks/docuseal/route.ts` line 225 (and the `as Record<string, unknown>` cast on the webhook update payload). Estimated 10 minutes after drift resolution.

2. **PII (personnummer) handling decision** — Norwegian personnummer flows through `buildEmployeePlaceholderMap` to DocuSeal as plain text in template placeholders. GDPR compliance requires an explicit decision: (a) accept the data flow with a documented data-residency analysis of DocuSeal, (b) defer personnummer to DocuSeal's secure-field mechanism, or (c) split into a separate restricted-access table. Needs Pontus decision + ADR. Estimated 30 minutes.

### Tracked debt (not blocking, follow-up tickets)

3. **Rename Test 1 in `apps/e2e/tests/contracts-api.spec.ts`** — Currently named "rejects POST body with field_values key" but Zod silently strips so it doesn't actually reject. Test 2 (canonical overrides shape) is the real guard. Either rename to "documents wrong shape" OR add `.strict()` to the route's Zod schema (Supervisor R3 finding).

4. **Document or widen route response shape for `recipient_name`** — Drawer destructures `recipient_name` from POST /api/contracts response, but route TS cast only declares `contract_id`. The drawer relies on undocumented contract-service behavior. Either document the contract-service response contract OR have the Next.js route enrich the response from `profileData.display_name` (Supervisor R3 finding).

5. **Extract `requireWorkspaceAdmin(supabase, userId, workspaceId)` helper** — Three call sites now use the same role-check pattern. Worth extracting once a 4th appears (Steward R3 finding).

6. **TanStack Query migration** — `ContractsDataTable` and `ContractSendDrawer` use raw `useState + useEffect + fetch` instead of `useQuery + useMutation`. Pattern deviation from rest of dashboard (Supervisor R1 + R2 finding, deferred).

7. **Drawer component split** — `contract-send-drawer.tsx` is 612 lines. Should be split into `TemplateStep`, `ReviewStep`, `PreviewStep` components for maintainability (Frontend Designer R1 finding, deferred).

8. **Framer Motion step transitions** — Drawer step transitions use no animation. Should use spring physics (`stiffness: 35, damping: 22, mass: 2.2`) when other dashboard components get the motion treatment (Frontend Designer R1 finding, deferred).

9. **Timeline ARIA enhancements** — `contract-timeline.tsx` has basic accessibility but should add `aria-current="step"` on the active step and richer screen reader announcements (Frontend Designer R1 finding, deferred).

10. **E2E happy-path test** — Only API gate regression tests exist. A full UI E2E test (drawer → send → DocuSeal mock → webhook) would catch shape regressions earlier. Requires seeded test contract service.

## Next Steps

### Immediate (before merging to development)
- Run `git pull origin development` to get the migration drift fixes from parallel worktree work
- Resolve any merge conflicts (likely in learning numbering — already mitigated by renaming our learnings to 0026/0027)
- Apply migration to local Supabase: `supabase db reset` (or `migration up` after repair)
- Regenerate `database.types.ts`
- Remove `as never` cast on webhook line 225
- Add the 3 follow-up ADRs (#6-#8) to the decision log

### Before feature closure script runs
- PII decision call with Pontus, write ADR
- Verify all gates green: typecheck, lint, decision log, journeys, handoff

### Post-merge
- Schedule 30-min PII decision meeting
- Address debt items 3-10 in priority order based on user feedback
- Watch telemetry events `contract created`, `contract sent`, `contract signed` in PostHog after first production use to validate end-to-end flow

## Council Review Trail

| Round | Date | Verdict | Blockers Found | Notes |
|-------|------|---------|----------------|-------|
| R1 | 2026-04-06 | APPROVE WITH CHANGES | 6 must-fix | Column names, enum, telemetry, auth header, suggestTools, hardcoded colors |
| R2 | 2026-04-06 | REJECT | 3 new blockers | Drawer/route shape mismatch, missing Botsson telemetry, missing role check |
| R3 | 2026-04-07 | APPROVE WITH CHANGES | 0 new blockers | All R2 blockers verified fixed; 2 closure-blockers tracked (type regen + PII) |

Full transcript in `docs/council/COUNCIL-LOG.md`.

## Files Touched (highlight)

- 23 files in feature branch (2038+ insertions across 19 commits)
- New: migration, 5 API routes, placeholder resolver, ContractTimeline, contract-send-drawer, contracts-data-table, contracts page, contract capability + 5 tools, regression tests, 2 learnings, journey doc, this handoff
- Modified: docuseal webhook, capability registry, intent classifier, capability types, people-row-actions, people-data-table, telemetry providers (3 files), packages/ai/package.json, packages/ui/index.ts, packages/utils/index.ts, decision log, council log, learning log
