---
title: "Contracts — Roadmap"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: contracts
mirror: aspirational
last_verified: 2026-05-23
tags: [contracts, roadmap, forward-plan, adr]
---

# Contracts — Roadmap

> This file is aspirational. Confirmed builds are in GAPS-AND-DEBT (built) or README (build state). Plans below may be superseded by newer specs.

## Active Plans

### Route migration: `/dashboard/contracts/*` → `/dashboard/people/contracts/*`

**Plan:** `docs/superpowers/plans/2026-05-19-sm-2fu-contracts-move.md`
**Status:** Draft (as of 2026-05-23)
**Risk:** Highest-risk sortie in SM-2 campaign. 132 hard refs across 7 layers (44 self-refs, 27 cross-refs, 6 packages, 17 supabase, 30 e2e, 8 site-map, totaling 132). 40 files to move.
**Deliverable:** All old paths get permanent `redirect()` stubs; Kontrakter tab wired into Ansatte hub.

## Proposed ADRs (not yet accepted)

| ADR | Topic | Status |
|---|---|---|
| ADR-0241 (proposed) | Contract Schema Migration Foundation — FK fixes, ALTER TYPE additive, RLS denorm, Lovsen amendments | proposed (Council 2026-04-29) |
| ADR-0242 | Contract / Payroll Capability Split — resurrect `payroll` enum, `legal` sibling | **accepted** |
| ADR-0243 (proposed) | Obligation Lifecycle — TS field-classification map, SECURITY DEFINER trigger, cascade trigger | proposed |
| ADR-0244 (proposed) | Amendment Flow + AcknowledgementRing as §14-6 legal evidence | proposed |
| ADR-0245 (proposed) | Employee Contract Mobile Flow — 6 mobile screens, WebView DocuSeal, biometric C4, push trigger map | proposed |

## Forward Work by Phase

### Phase: Amendment Classifier

The `packages/ai/src/capabilities/legal/` capability includes tooling for `classify_amendment` (cited in `docs/architecture/contract-service/CAPABILITY-legal.md`). A proper amendment classifier that uses lovsen-mcp to determine whether a change is a material amendment requiring re-sign (§14-6(2)) vs an administrative correction is partially wired but not fully built.

**ADR reference:** ADR-0244 (proposed).

### Phase: Phantom Contracts Promotion UI

ADR-0197 phantom contracts promotion logic exists in code. A management UI for bulk-promoting pre-Smartout legacy contracts is not built. Data model supports it.

### Phase: Lærling-Kontrakter (ADR-0253)

Opplæringsloven kap. 4 compliance for apprentice contracts. The block is enforced (cannot create apprentice contract without lærling-type template). Full lærling flow (opplæringskontor, praksisnivå, periode-plan) is deferred.

**ADR reference:** ADR-0253.

### Phase: Tripletex Push-Sync

Columns added (`20260515100100`): `tripletex_employee_id`, `tripletex_contract_id`. Bidirectional sync (push employment contract data to Tripletex) is deferred — same as payroll domain phase 7.

### Phase: Mobile Contract (ADR-0245)

6 mobile screens defined in ADR-0245: contract list, detail, sign (WebView DocuSeal), amendment review, obligation checklist, biometric C4 confirmation. Status: plan complete, UI partial.

### Phase: AcknowledgementRing (ADR-0244)

WCAG AAA per-clause acknowledgement UI for material amendments. Employee must confirm each changed clause. Full-screen sequential flow on mobile. Not built.

### Phase: A-Melding / Skatteetaten Integration

Explicit non-goal per PRD: "Skatteetaten-integrasjon i Fase 0 ... blokkerer for go-live men planlagt." Post-go-live integrasjon.

## Key ADRs Reference

| ADR | Topic |
|---|---|
| ADR-0024 | Contract system architecture (DocuSeal, Fastify, Tiptap, embedding) |
| ADR-0076 | Composition as cascade derivation (7-phase pipeline) |
| ADR-0077 | PII handling — RPC-controlled Høy-PII tier |
| ADR-0079 | Employment vs platform contract split |
| ADR-0082 | Drafts are NOT versions |
| ADR-0093 | Draft proposals — unified cascade |
| ADR-0109 | Migrated shell — block + supersede (`migration_incomplete`) |
| ADR-0111 | `employment_contract_detail` versioning |
| ADR-0182 | Template vs contract lifecycle |
| ADR-0197 | Phantom contracts promotion |
| ADR-0241 | Contract Schema Migration Foundation (proposed) |
| ADR-0242 | Contract / Payroll Capability Split |
| ADR-0243 | Obligation Lifecycle (proposed) |
| ADR-0244 | Amendment Flow + AcknowledgementRing (proposed) |
| ADR-0245 | Employee Contract Mobile Flow (proposed) |
| ADR-0253 | Lærling-kontrakter Opplæringsloven kap. 4 |
| ADR-0256 | Lovsen Citation Contract (type schema interface) |
| ADR-0384 | Billing gate on signed contract |

## Completed Specs / Plans (evidence of built phases)

| Spec/Plan | What was built |
|---|---|
| `docs/superpowers/specs/2026-03-20-contract-enhancements-design.md` | Placeholder resolution + per-contract attachments + DocuSeal delivery rewrite |
| `docs/superpowers/plans/completed/2026-03-20-contract-enhancements.md` | ✅ completed |
| `docs/superpowers/specs/2026-04-08-contract-composition-engine-design.md` | Composition 7-phase engine |
| `docs/superpowers/plans/completed/2026-04-08-contract-composition-engine.md` | ✅ completed |
| `docs/superpowers/specs/2026-04-06-employee-contract-management-design.md` | Employee contract management hub |
| `docs/superpowers/plans/completed/2026-04-06-employee-contract-management.md` | ✅ completed |
| `docs/superpowers/specs/2026-04-13-contract-end-to-end-gap-closure-design.md` | Phase 1 gap closure |
| `docs/superpowers/plans/completed/2026-04-13-contract-phase-1-gap-closure.md` | ✅ completed |
| `docs/superpowers/specs/2026-04-13-contract-management-workspace-tab-design.md` | Workspace contracts tab |
| `docs/superpowers/plans/completed/2026-04-13-contract-management-workspace-tab.md` | ✅ completed |
| `docs/superpowers/specs/2026-04-22-contract-hub-redesign.md` | Contract hub redesign |
| `docs/superpowers/specs/2026-04-30-contract-employee-design.md` | Employee-side contract detail + sign |
| `docs/superpowers/plans/completed/2026-04-09-contract-preview-editor-council-fixes.md` | ✅ completed |
| `docs/superpowers/plans/completed/2026-04-13-contract-template-binding.md` | ✅ completed |
| `docs/superpowers/plans/completed/2026-04-14-emma-voice-contract-tools-entity-drawer.md` | ✅ completed |

**Spec/plan reconciliation (relative to contracts domain):**
- **Confirmed (code verified):** 15 specs/plans — composition engine, management hub, gap closure, template binding, voice tools, enhancements, preview editor, workspace tab.
- **Deviations:** Route is at `/dashboard/people/contracts/` in code but both old (`/dashboard/contracts/`) and new paths exist (migration plan pending). ADR-0241/0243/0244/0245 proposed but not accepted.
- **Gaps:** Amendment classifier, phantom promotion UI, lærling full flow, Tripletex push-sync, mobile contract UI.
