---
topic: telemetry-three-layers
status: active
created: 2026-06-01T01:30:00Z
updated: 2026-06-01T01:30:00Z
supersedes:
metadata:
  class: measurement-validity
  severity: high
  enforcement: emit-coverage gate must measure layer 2 (emitted), not layer 1 (defined)
---

# Telemetry has three layers — defined ≠ emitted ≠ implemented. Measure the deepest.

## The trap (2026-06-01)

The telemetry-coverage campaign measured "events_in_registry" — events DEFINED in
`packages/telemetry/src/registry.ts`. That gave a rosy **92.4%**. It was measuring the
shallowest, least meaningful layer.

Sampling 5 redesign events against the actual app surface (`apps/web/src`, `apps/mobile/src`):
**all 5 were defined in registry.ts and emitted from a wired component 0 times.** The 731
existing `emit()` calls are the OLD telemetry, not the redesign events. `control.json`
corroborates: "design uses local state mock", hooks unwired across domains.

## The three layers

| Layer              | Meaning                                                | How to measure                                                |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------- |
| 1. **Defined**     | event type exists in registry.ts                       | grep registry.ts (what completion-rate.sh did)                |
| 2. **Emitted**     | a wired component actually calls `emit("event")`       | grep `emit("event")` call-sites in apps/, excluding registry  |
| 3. **Implemented** | the redesigned component is built + wired to real data | the design is wired into the app, not vendored as a prototype |

Layer 1 is cheap and nearly meaningless on its own. The foundation Pontus means by
"100% telemetry" is layer 2/3 — events FIRING from the wired redesigned product.

## The rule

1. **A coverage metric must measure the layer that carries the value, not the easiest layer
   to count.** "Defined in a registry" is necessary but proves nothing fires. Measure
   `emit()` call-sites in the app (layer 2), reconciled against the registry.
2. **A rosy sub-metric next to an all-FAIL gate is the tell.** Every domain's control gate
   was FAIL (hooks unwired); only the shallow rate looked good. Trust the gate, distrust the
   flattering number.
3. **"Vendored design source" ≠ "design implemented".** A committed prototype dir
   (smartout-re-designe/) is input, not wiring.

## Synthesis — why it felt like chaos (2026-06-01)

The danger is not just a wrong number. It is that **the gap between "looks done" and "is done"
becomes invisible** when the metric is a proxy that drifted from reality at three levels at once:
stale map (layer 0) → counting definitions not emissions (layer 1 vs 2) → vendored design not
implemented (layer 3). The dashboard said 57–92%; real redesign emit ≈ 0%. Every time you looked,
the number and the code disagreed — so progress _felt_ like it kept evaporating. Fix: trust only
the deepest MEASURED layer (does the wired component actually `emit`), and build that, not the proxy.

Related: [[coverage-map-drifts-from-source]] (same family — measure against truth, not a proxy).
