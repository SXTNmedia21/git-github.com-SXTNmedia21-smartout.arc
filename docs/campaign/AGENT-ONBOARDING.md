---
title: Agent Onboarding — START HERE
status: draft
updated: 2026-06-03
created: 2026-06-03
module: campaign
tags: [onboarding, bootstrap, start-here, agents, cockpit]
---

# Agent Onboarding — START HERE

> Two moments. **Bootstrap the campaign once** (Phase 0), then **onboard each agent** every dispatch
> (Phase 1). Pointer-first — this sequences the pieces, it doesn't re-inline them.

## Phase 0 — Campaign bootstrap (ONCE — skip if `.sxtn/config` + a real `feature_list.json` exist)

The campaign is **live**, not greenfield (min-dag shipped, `.sxtn/` populated, 305-table DB). So every
step is **import/verify, never init** — init clobbers.

1. **`sxtn-import`** — NOT `sxtn-init`. Import/refresh semantics; fresh scaffold would overwrite live state.
2. **`supabase-probe`** — NOT `supabase-init`. Verify the local DB is up + schema live (ping · table count).
   The DB exists; adapters **read** it. New schema = a finding → `supabase-upgrade` via the Database Agent
   + founder approval (DB-wall). Never init, never invent a table.
3. **Feed the fundamental list** — don't hand-draft `feature_list.json`. **Ingest a domain spec**
   (`docs/domains/<domain>/`) and extract: `backend-discovery` → dimensions/entities/datatypes ·
   `component-indexer` → components. The domain-steward docs (`DATA-MODEL.md` etc) already did the
   extraction — map them into `feature_list.json` + the component-index.
4. **Mount templates + component-index** — from `.sxtn/runbook/` canon (the **one runtime hub**; root
   `templates/`+`schemas/` are drift to dedupe).
5. **Wire gates + arm controllers** — `control.json` per domain · L3 done-oracle (B6) · steward · heartbeat
   triggers · orchestrator nudge.

**Single `.sxtn` writer** — one instance runs Phase 0 on this tree. Others plan; mutations land here (rule 9).

## Phase 1 — Agent onboarding (EACH dispatch)

1. **Read** `docs/campaign/ORIENTATION.md` — where we are, where things live.
2. **Mount** `work-mode-core` (+ `work-mode-orchestrator` if you conduct).
3. **Read your memory** — `.claude/agent-memory/<agent_id>/` (what you learned last run; never amnesiac).
4. **Know the loop** — port → adapter → wire → telemetry register → **L3-prove** → steward commit → tag.
5. **Know the gates** — `control.json` (readiness) · `activity_trail` row (L3 done) · **G8 = human** (C4).

## The one rule

**Done = a row in `activity_trail`.** Confident ≠ authorized. Verify on disk — never a relayed claim.

---

| Pointer | Path |
|---------|------|
| North-star | `docs/campaign/ORIENTATION.md` |
| Operating core | `work-mode-core` skill |
| Conductor | `work-mode-orchestrator` skill |
| Mission + waves | `docs/campaign/MISSION-MANIFEST.md` · `MISSION-DASHBOARD.html` |
| Done-oracle | `work-mode-core` §1 + `telemetry-map/<domain>/control.json` |
| Runtime hub | `.sxtn/runbook/` (templates · schemas · playbooks) |
| Telemetry onboarding | `docs/campaign/templates/tell-me-telemetry.md` |
