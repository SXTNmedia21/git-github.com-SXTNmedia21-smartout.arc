---
title: "Plan — swap-marketplace-pipeline-ui"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: scheduler
tags: [plan, scheduler, pipeline, ui, admin, web]
---

# Plan — swap-marketplace-pipeline-ui

> Branch: `feat/world-best-wfm-swap-marketplace-pipeline-ui` | Worktree: /home/sxtnl/dev/smartout.ai-world-best-wfm-wt-1 | Base: `campaign/world-best-wfm` | Module: scheduler | Started: 2026-05-16

## Goal

Build the 4 missing UI surfaces post-ADR-0340 backend ship. Backend pipeline + override tools shipped without UI; this sortie closes the visibility gap. Web-only per ADR-0133 Compose verb. Nordic Split design system (`smartout-nordic-split` skill). All BFF endpoints are READ-ONLY — override action goes via existing Botsson chat capability tools (`override_swap_pipeline` / `override_marketplace_pipeline`), not new direct API.

## ADR refs

- ADR-0340 (Shift Lifecycle Pipeline Implementation) — backend baseline
- ADR-0287 — mutateWithGate single-call invariant (UI must trigger via chat, not direct mutation)
- ADR-0133 — Compose = web-only (admin surfaces ✓)
- ADR-0151 — server-derived identity (BFF reads workspace_id from session)
- ADR-0204 — correlation_id audit chain (audit trail viewer surfaces this)
- ADR-0328 — friendly Norwegian errors (race feedback toast)

## Tasks

### U0 — Read-only BFF endpoints (data plane)
- [ ] **U0.1** `GET /api/admin/pipeline` — list pipeline instances with filter (status, blueprint_id, workspace-scoped)
- [ ] **U0.2** `GET /api/admin/pipeline/[id]` — single pipeline instance detail with stage_event chain (gate_evaluation join)
- [ ] **U0.3** `GET /api/schedule/shifts/[id]/pipeline` — lightweight read for shift-card indicator (pipeline_lock_state_id + blueprint_id)

### U1 — Admin override dashboard (`/dashboard/schedule/pipeline`)
- [ ] **U1.1** Server-component page reading U0.1 endpoint
- [ ] **U1.2** Client component: filter chips (status: pending/rejected/cancelled/all), list rows
- [ ] **U1.3** Override drawer: reason textarea (min 20 chars per ADR-0328) + confirm CTA
- [ ] **U1.4** Override CTA opens Botsson chat with prefilled prompt invoking `override_swap_pipeline` / `override_marketplace_pipeline` (no direct API)
- [ ] **U1.5** Loading + empty states; status badges; Nordic Split tokens

### U2 — Pipeline-lock indicator on shift cells
- [ ] **U2.1** Augment `WeekGrid` shift cell with conditional badge when `pipeline_lock_state_id IS NOT NULL`
- [ ] **U2.2** Tooltip surfacing blueprint_id (e.g. "Vakttilbud venter på godkjenning")
- [ ] **U2.3** Mobile shift card parity — same indicator on `apps/mobile/src/components/shift/ShiftCard.tsx`

### U3 — Cross-capability race feedback
- [ ] **U3.1** API client catch `409 PIPELINE_LOCK_HELD` response → sonner toast with Norwegian copy
- [ ] **U3.2** Toast references locking blueprint when available (e.g. "Vakten er låst av et åpent vakttilbud")
- [ ] **U3.3** Mobile parity — `apps/mobile/src/lib/web-api.ts` 409 handling

### U4 — Pipeline audit trail viewer (admin)
- [ ] **U4.1** Drawer/sheet opened from U1 detail row
- [ ] **U4.2** Chronological list of stage events: actor + channel + gate_evaluation_id + reason
- [ ] **U4.3** Override events visually distinct (purple/governance accent per Nordic Split governance category)
- [ ] **U4.4** Correlation chain linked via gate_evaluation_id (read U0.2 endpoint output)

### Closure
- [ ] **U5** — Typecheck 52/52 + ai tests pass
- [ ] **U6** — E2E spec extension to existing `p-swap-marketplace-pipeline.ts` (new admin override journey via UI)
- [ ] **U7** — HANDOFF + decision log

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` — 52/52 FULL TURBO
- [ ] Admin override end-to-end via UI works (chat dispatch verified)
- [ ] Pipeline-lock badge surfaces on web + mobile shift cards
- [ ] 409 race feedback friendly Norwegian
- [ ] Audit trail shows full stage chain incl. override events
- [ ] Nordic Split tokens used (no hardcoded colors)
- [ ] ADR-0240 honored — UI only READS pipeline state, never writes cross-namespace
- [ ] 4 journeys verified end-to-end
- [ ] HANDOFF written

## Out of Scope

- Push fanout notifications (deferred V2.1)
- Real-time pipeline status WebSocket (deferred — needs LiveKit data-channel infra)
- Manager-approve UI surfacing pipeline_instance_id (existing SwapApprovalSection works backward-compat — V2 polish)
- Cross-workspace pipeline view (blocked on Q2 ADR-0340 cross-workspace policy)
