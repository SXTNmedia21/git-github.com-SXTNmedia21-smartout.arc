---
title: "Journey — Fix forkTemplate end-to-end auth wiring"
feature: contract-hub-fix-forward
journey: fix-fork-template-auth
status: verified
verified_at: 2026-04-22
e2e_test: null
created: 2026-04-22
updated: 2026-04-22
module: contracts
tags: [journey, fix-forward, p0]
---

# Journey: Fix forkTemplate end-to-end auth wiring + MalerTab UI re-enable

**Role:** workspace-admin (forking via UI) / agent (Mr. Botsson invoking capability tool)

**Precondition:** Capability tool `packages/ai/src/capabilities/contract/tools.ts:fork` calls BFF endpoint `/api/contract-templates/copy` without forwarding agent identity → BFF requires Supabase JWT → request returns 401 → fork fails silently from agent context. MalerTab fork buttons disabled (`MalerTab.tsx:236-245`) since no callable path exists.

## Happy Path

1. Per ADR-0191, **Option A (direct admin)** chosen → `fork` tool rewritten to write directly via `ctx.supabaseAdmin`, mirroring sibling `publishWorkspaceTemplate` / `deprecateWorkspaceTemplate` pattern. Rationale: architectural consistency with sibling tools, no new auth surface, no cross-process service-key handling, tool remains canonical emit site for agent path.
2. Implementation lands in `packages/ai/src/capabilities/contract/tools.ts` (tool refactor) and `apps/web/src/app/api/contract-templates/copy/route.ts` (route emit dedup) → tool authenticates via in-tool role gate (`resolveActorRole`) + chat-only channel guard, with upstream `gate_action` enforced by agent dispatcher (ADR-0099).
3. MalerTab "Ny fra systemmal" re-enabled in `apps/web/src/app/dashboard/contracts/_components/MalerTab.tsx` → admin clicks → `SystemTemplatePicker` dialog opens → select K1a template → fires `/api/contract-templates/copy` → returns 200 → new workspace template appears in left zone immediately. Both the workspace-templates footer button and the empty-state CTA invoke the same picker.
4. **Deferred:** "Ny fra bunnen" remains disabled with hover label `new_from_scratch_pending`. The copy route requires `system_template_id` (Zod-required), so blank-from-scratch needs a new endpoint or schema relaxation — moved to P1 follow-up sortie.
5. Mr. Botsson invokes fork capability via chat → tool succeeds end-to-end → activity_trail records single `contract_template forked` event with correct actor_id.

**Postcondition:** Fork works from agent path (chat) AND UI path ("Ny fra systemmal"). No 401. MalerTab "Ny fra systemmal" buttons (footer + empty-state CTA) live; "Ny fra bunnen" still disabled pending P1.

## Error Paths

- **Scenario (pre-fix):** Admin clicks fork in MalerTab → button disabled → no feedback → admin confused → **Now:** Button enabled; click triggers authenticated request; success toast or explicit error.
- **Scenario (pre-fix):** Agent invokes fork tool → BFF returns 401 → tool throws auth error → audit_trail records nothing → **Now:** Tool forwards identity (header or admin client) → BFF accepts → fork completes → single audit_trail row.

## Verification

- [x] Implementation matches Council Gate 4 R2 fix spec — Option A (direct admin) per ADR-0191 (commit `288fde05`)
- [x] Sibling tool pattern preserved — `forkTemplate` mirrors `publishWorkspaceTemplate` / `deprecateWorkspaceTemplate`
- [x] MalerTab "Ny fra systemmal" wired to `SystemTemplatePicker` (footer + empty-state CTA)
- [x] "Ny fra bunnen" deferred to P1 — `new_from_scratch_pending` hover label live
- [ ] E2E test exists (deferred to P1 follow-up sortie)

**Status flipped to `verified` 2026-04-22 — implementation verified against `288fde05`.**
