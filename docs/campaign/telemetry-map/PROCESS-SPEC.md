---
title: Telemetry-Map Orchestration — Process Spec
status: in_progress
updated: 2026-05-31
created: 2026-05-31
module: redesign-wiring
tags: [orchestration, telemetry, control-points, dashboard]
---

# Telemetry-Map Orchestration — Process Spec

> Pre-stage the **telemetry map** (the wayfinder) per domain, as pure data, before init.
> One subagent per Supabase-domain. Each maps its design → folder + dedicated plan + a
> machine-checkable control point. No judgment about "is it ready" — the control point answers it.

---

## 1. The unit of work (one subagent = one domain)

Each subagent owns ONE domain. It:

1. **Finds the design** — its `pages/<domain>*.jsx` + the matching `shared/<domain>-data.js` mock (the mock reveals what each control consumes).
2. **Maps every interactive element** — every button / link / form / toggle / mutation in the design.
3. **Resolves each element** against backend reality: which mutation it triggers → which telemetry event must fire (cross-referenced against `packages/telemetry/src/registry.ts`) → which existing hook serves it.
4. **Writes its folder** — `.sxtn-staging/telemetry-map/<domain>/`:
   - `TELEMETRY-MAP.md` — the full element→event→hook table.
   - `PLAN.md` — the dedicated sortie plan: exactly which buttons + telemetry must work, ordered, with the control-point DoD.
   - `control.json` — the machine-readable control point (the gate reads THIS, not prose).

---

## 2. The control-point contract (`control.json`)

Every domain emits this exact shape. The gate is mechanical — all `control_points` true ⇒ `gate: PASS`.

```json
{
  "domain": "<name>",
  "design_files": ["..."],
  "interactive_elements_total": 0,
  "elements_mapped": 0,
  "mutations": 0,
  "events_required": 0,
  "events_in_registry": 0,
  "events_missing_from_registry": ["..."],
  "hooks_found": 0,
  "hooks_missing": ["..."],
  "noop_candidates": ["..."],
  "control_points": {
    "every_element_mapped": false,
    "every_mutation_has_event": false,
    "every_event_registry_status_known": false,
    "every_mutation_has_hook_or_flagged": false,
    "baseline_count_recorded": false
  },
  "gate": "PASS | FAIL",
  "blockers": ["..."]
}
```

- `interactive_elements_total` is the **noop baseline** the council demanded — the indexer count the build sortie must match or exceed.
- `events_missing_from_registry` feeds F0.1 (register-first reconcile).
- `hooks_missing` + `noop_candidates` are honest gaps surfaced, never hidden.

### Control-point gate (`bin` check, no judgment)

```
gate = PASS  iff  elements_mapped == interactive_elements_total
              AND  every mutation has an event
              AND  every event's registry status is known (in/missing listed)
              AND  every mutation maps to a hook OR is explicitly flagged
              AND  baseline count recorded
else FAIL  (blockers[] lists why)
```

---

## 3. The dashboard

`.sxtn-staging/telemetry-map/DASHBOARD.html` — self-contained, reads the per-domain `control.json`.
Renders a grid: domain × control-points, color-coded (green PASS / amber gaps / red FAIL),
with counts (elements, events, registry-gaps, hooks-missing) and the blocker list per domain.
This is the "follow the process" surface — open in a browser, refresh as domains land.

---

## 4. Reinforcement (can't question if ready)

- The control point is **mechanical** — a JSON the gate reads. "Is the domain mapped?" = `gate=="PASS"`, not a vote.
- Every gap is **surfaced, never dropped** — missing events, missing hooks, noop candidates all list explicitly.
- The dashboard makes status **visible** at a glance.
- Each domain's `PLAN.md` is **self-contained** — its buttons + events are pre-listed, so the build sortie is small, isolated, focused.

---

## 5. Domains in this batch (7 — Wave 1 + Wave 2 PASS set)

vaktplan · ansatte · min-dag · oversikt · planlegging · lonn · kommunikasjon

(Wave 3: avstemming · hms · min-lonn · handbook · oppgaver · rapporter — batch 2, gated behind F0.4 seed-PR.)

---

## 6. After the batch

1. Generate `DASHBOARD.html` from the 7 `control.json`.
2. Aggregate `events_missing_from_registry` across domains → the F0.1 reconcile worklist.
3. Each `PLAN.md` becomes a sortie at init — plans on tap.
