---
title: Drive-to-100% — the iteration loop
status: in_progress
updated: 2026-05-31
created: 2026-05-31
module: redesign-wiring
tags: [orchestration, loop, gates, telemetry]
---

# Drive-to-100% — the iteration loop

> Not a one-shot. A machine that iterates until 100%. "Done" is not declared — it is **read from disk**.

---

## 1. Definition of 100% (0 friction)

The campaign is at 100% **iff** every domain's `control.json` satisfies:

```
gate == "PASS"   AND   blockers == []   AND   every control_points value == true
```

across **all 13 domains**. `blockers == []` IS "0 friction". Anything less = keep iterating. There is no human verdict in this — `bash gen-dashboard.sh` reads the truth.

| Metric                    | Now (batch 1, 7 domains) | Target                        |
| ------------------------- | ------------------------ | ----------------------------- |
| Domains mapped            | 7 / 13                   | 13 / 13                       |
| Gate PASS                 | 0 / 7                    | 13 / 13                       |
| Events to register (F0.1) | 112                      | 0 (all registered/reconciled) |
| Blockers (friction)       | many                     | 0                             |

---

## 2. The loop (mechanical, control.json-driven)

```
LOOP until ALL 13 domains gate==PASS && blockers==[]:
  1. READ      every control.json → current gate state (gen-dashboard.sh)
  2. PICK      the highest-friction domain (most blockers / most missing events)
  3. DISPATCH  a fix-agent for that domain's blockers:
                 - register its missing events (events.ts↔registry.ts reconcile)
                 - wire/flag its missing hooks
                 - gate its ungated writes
  4. RE-RUN    the domain's control check → rewrite control.json
  5. REGEN     dashboard ← gen-dashboard.sh
  6. EMIT      activity (logon/working/delivered/gate/logoff) to activity/feed.jsonl
  REPEAT
```

The loop never asks "is it done?" — it reads `gate`. It never stops on a FAIL — it fixes and re-checks. It only halts when the read says all-green. This is the sxtn standing goal ("no scoped task left undone") instantiated on the control.json surface, driven by the autonomous loop-gate.

### Order of iteration

1. **Complete the map** — batch 2 (avstemming · hms · min-lønn · handbook · oppgaver · rapporter) so all 13 have a control.json.
2. **F0.1 reconcile** — register the full (now 13-domain) missing-events set; collapse `events.ts`↔`registry.ts`.
3. **Per-domain fix loops** — drive each FAIL→PASS in wave order (vaktplan golden path first).
4. **0-friction sweep** — no domain closes while any `blocker` remains.

---

## 3. Activity emission (makes the dashboard live)

Every dispatched agent appends to `activity/feed.jsonl`, one JSON object per line:

```json
{
  "ts": "<ISO-8601>",
  "agent": "<id>",
  "domain": "<name>",
  "event": "logon|working|delivered|gate|logoff",
  "detail": "<text>",
  "artifact": "<path|null>",
  "gate": "PASS|FAIL|null"
}
```

- `logon` when an agent starts; `logoff` when it returns.
- `working` for in-flight steps ("scanning design", "grepping registry").
- `delivered` per artifact written (with path).
- `gate` with the domain's verdict.

The dashboard reads this feed → shows who is on/off, what each delivered, what they work on. The control.json files give the gate grid. The spec + design are linked.

---

## 4. Stop condition

The loop halts (and only then) when `gen-dashboard.sh` reports `pass=13 fail=0 missing_events=0` and every `control.json` has `blockers:[]`. Until that read: iterate, iterate, iterate.
