---
title: "Handoff — contract-preview-editor"
feature: contract-preview-editor
branch: feat/contract-preview-editor
closed: 2026-04-09
module: contracts
status: done
updated: 2026-04-09
created: 2026-04-09
tags: [contracts, preview, tiptap, council]
---

# Handoff — contract-preview-editor

## Summary

Added a live Tiptap document preview/edit step to the contract send-drawer. Admins can now see the fully rendered contract with all placeholder values filled in, make text corrections, and send — all in a 3-step flow (Mal -> Data -> Gjennomgang). The feature was council-reviewed with all 7 identified issues fixed before merge.

## What Was Done

- [x] ContractPreviewEditor component — lightweight Tiptap wrapper with preview-mode toolbar
- [x] EditorToolbarV2 mode prop — hides Seksjon/Felt dropdowns in preview context
- [x] GET /api/contracts/templates/[id] — returns full template including content_html (admin-gated)
- [x] POST /api/contracts — accepts resolved_html override from preview editor
- [x] Server-side HTML sanitization with sanitize-html (Tiptap-compatible allowlist)
- [x] Canonical resolvePlaceholders from @smartout/utils (handles {{key}} + Tiptap spans)
- [x] Standardized drawer width to 640px (no jarring jump)
- [x] Edit-state tracking with "Redigert" badge and confirmation dialog warning
- [x] Step label renamed from "Dokument" to "Gjennomgang"
- [x] was_edited telemetry on "contract created" event
- [x] Skips unnecessary buildEmployeePlaceholderMap when clientHtml provided
- [x] System Council review (4 agents, all 7 issues resolved)

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Preview toolbar hides Seksjon/Felt dropdowns | Council: template-authoring tools in review context is dangerous for legal documents | EditorToolbarV2 now accepts mode="full"|"preview" |
| Server-side HTML sanitization | Council: resolved_html from client stored without validation, rendered to employees via DocuSeal | sanitize-html added as dependency with Tiptap-compatible allowlist |
| Canonical resolvePlaceholders | Council: local copy only handled {{key}} format, missed Tiptap span format | Uses @smartout/utils version that handles both formats |
| Admin role gate on template content | Council: GET templates/[id] exposed content_html to any authenticated user | Now checks admin/owner role via workspace_id param |
| 640px drawer width for all steps | Council: 500->700px width jump was jarring, broke Nordic Split motion principles | Consistent width, no animation needed |
| Fritekst editor (not locked sections) | Cascade composition is ~40% implemented; clause injection not yet in place | Admin can edit freely; was_edited telemetry tracks changes for future agent use |

## Learnings

| Learning | Context |
|----------|---------|
| Reusing shared components needs context-aware feature gating | EditorToolbarV2 was designed for template authoring — dropping it into a review context exposed dangerous insert tools |
| Canonical utils should always be preferred over local copies | Local resolvePlaceholders missed the Tiptap span format, would have silently broken placeholder resolution |
| Cascade composition is ~40% done | resolveComposition() collects + validates (phases 1-3), but change_proposal persistence + clause injection + approval flow are missing (phases 4-7) |
| K1a has no contract clause rules yet | hospitality.ts has tariff/shift data but no "this clause MUST be in the contract" rules |
| Council review catches real issues | 7 issues found by 4 agents; 3 were security/correctness blockers that would have shipped without review |

## Known Issues / Debt

- Hardcoded Norwegian strings throughout (i18n deferred — known project-wide debt)
- No client-side "contract viewed" telemetry (BaseEvent requires actor_id/profile_id not available in drawer)
- No "reset to original" button if admin makes accidental edits
- Mobile toolbar may overflow on small screens (toolbar wraps to 2-3 rows)
- was_edited is telemetry-only — no DB column on contract table yet
- No cascade-derived section locking (depends on completion of ADR-0076 phases 4-7)

## Cascade Composition Status (audited 2026-04-09)

| Component | Status |
|-----------|--------|
| D3 Regulatory binding (workspace_framework_binding) | Implemented |
| Compliance validation (PII, tariff) | Implemented |
| Framework snapshot on employment_contract | Implemented |
| Compliance drift materialized view | Implemented |
| resolveComposition() phases 1-3 | Implemented |
| change_proposal persistence (phase 4) | Missing |
| Approval workflow (phase 5) | Missing |
| Clause injection into template HTML (phase 6) | Missing |
| K1a contract clause rules | Missing |

## Next Steps

- Implement K1a contract clause rules in hospitality.ts (mandatory clauses per Riksavtalen)
- Complete ADR-0076 phases 4-7 (change_proposal, approval, clause injection)
- Add cascade-section locking in preview editor (read-only for derived clauses)
- Agent-powered validation: emit events when admin removes mandatory content
- Add was_edited boolean column to contract table
- Mobile-responsive toolbar (collapse or hide on small screens)
