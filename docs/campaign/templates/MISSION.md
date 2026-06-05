---
title: MISSION — dispatch brief template (campaign sub-agent)
status: template
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [template, mission, dispatch, checklist, steward-gate]
---

# MISSION — `<short-title>`

> The standard brief for a dispatched campaign sub-agent. The orchestrator fills this, hands it to
> one agent, and the agent works to it — ending by **filling a checklist** the `commit-steward` gate
> reads. One mission = one agent = one filled checklist. Copy this file per dispatch.

## 1. Identity
- **Mission ID:** `<domain>-<verb>-<n>` (e.g. `min-dag-polish-1`)
- **Agent type / model:** `<Explore|sxtn-builder|frontend-designer|general-purpose>` · **`<haiku|sonnet>`** (NEVER opus for build/throughput)
- **Domain · tier:** `<domain>` · `<ready|gap>`
- **Lane:** `<web | mobile | db | campaign>`

## 2. Goal (one sentence)
What "done" produces — stated as the filled checklist, not the activity. e.g. *"`min-dag-v2`'s
`run.yml` reaches `verified: true` (browser phases deferred)."*

## 3. Scope
- **DO:** `<the bounded change>`
- **OUT of scope (do NOT touch):** `<files/areas off-limits — prevents scope-creep>`

## 4. Inputs (read these first)
- Skills to load: `<smartout-design-port | register-events | smartout-nordic-split | smartout-page-polish | …>`
- Design source / PLAN: `<path>`
- Reuse-map (read-only): `docs/campaign/reports/backend-reuse-map.json`
- Reference port (the proven shape): `apps/web/src/app/dashboard/min-dag-v2/`

## 5. The checklist to fill (the deliverable)
The mission ends when this artifact is filled + true on disk:
- [ ] `<.claude/page-polish/<slug>.run.yml>` — every required field, `verified: true` · **or**
- [ ] `<docs/campaign/telemetry-map/<domain>/control.json>` — `gate: PASS`, `blockers: []` · **or**
- [ ] `<other named artifact>`

## 6. DoD — the steward gate you will be measured against (read `commit-steward` skill)
Page/domain unit, ALL must hold (else bounced):
- [ ] Plan stated · [ ] copy-law held (~1× source) · [ ] adapter + no-ghost-data
- [ ] telemetry registered + emitting (`register-events`) · [ ] `pnpm --filter web typecheck` exit 0
- [ ] `control.json` PASS (or honest gap surfaced + `tier=gap`) · [ ] all hooks pass (no `--no-verify`)

## 7. Rails (never cross)
Copy-not-rewrite · no-ghost-data (real-or-empty) · Nordic tokens only · DB-wall (no migration/seed/schema) ·
never `--no-verify` · **never push / never commit — leave it gate-green for the steward** · evidence on disk, not claims.

## 8. Report back
- What changed (files) · the checklist artifact path + its status · `pnpm --filter web typecheck` result ·
  any DoD criterion you could NOT satisfy + why (a bounce is fine — surface it, don't fake `verified`).
