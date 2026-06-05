---
name: register-events
description: >
  Gap-class skill (A2). Register design telemetry events into the ONE registry so they typecheck,
  route, and can land in activity_trail. Closes a domain's `events_missing_from_registry[]` gap —
  the telemetry-spine's layer-1 gate. Load when a ported page emits an event that errors TS2322
  ("not assignable to SmartoutEvent"), when a control.json lists missing events, or before wiring
  any new `emit(...)` call-site.
  Triggers (EN): register event, telemetry event, emit, registry.ts, SmartoutEvent, EVENT_ROUTING,
  events_missing_from_registry, unregistered event, TS2322 emit, add telemetry, wire emit.
  Triggers (NO): registrer event, telemetri, legg til event, manglende event.
  ALWAYS load before adding an `emit({event:"..."})` call whose event is not yet in registry.ts.
---

# Register Events — the telemetry-spine layer-1 gate (A2)

Register every event a design surface emits into the **one** registry, so the compiler proves it
exists and the router can land it. `emit()` is **union-typed** (`emit(event: SmartoutEvent)`), so an
unregistered event is a hard `TS2322` — it **cannot ship**. Registration is therefore the cheapest,
compiler-enforced layer-1 gate of the telemetry spine. Proven on `min-dag-v2` (commit `8767e1adc`).

> Layer reminder (telemetry-three-layers): registering = **layer-1 (defined)**. It does NOT prove the
> event fires from a wired component (layer-2) or lands a row in `activity_trail` (layer-3). Those are
> `check-telemetry-coverage` (B6) + a runtime call. Registration is necessary, not sufficient.

## The one registry

`packages/telemetry/src/registry.ts` (~16k lines). `events.ts` is gone. Three structures matter:
- `interface XxxEvent extends BaseEvent` — the event shape (`event` literal + `properties`).
- `export type SmartoutEvent = … | XxxEvent | …` — the master union `emit()` accepts (~line 8931).
- `export const EVENT_ROUTING: Record<SmartoutEvent["event"], EventMeta> = { … }` — runtime routing.
  It is **exhaustive** — a missing key is a `TS2740`, so every event needs a routing entry too.

## The 3-site recipe (per L-0072 — all three or it won't compile)

For each missing event `domain.area.action`:

**1. Interface** (near related events):
```ts
export interface DomainAreaAction extends BaseEvent {
  event: "domain.area.action";
  properties: { data: { /* exactly what the emit call passes */ } };
}
```
**2. Union member** — add `| DomainAreaAction` to `SmartoutEvent`.

**3. Routing entry** — add to `EVENT_ROUTING`:
```ts
"domain.area.action": { destinations: ["posthog", "logger"], category: "navigation" },
```

## Classification — destinations + the await rule (emit-contract)

Read the call-site to classify. **This decides destinations AND whether emit is awaited.**

| Call-site kind | Real DB effect? | destinations | emit pattern |
|----------------|-----------------|--------------|--------------|
| **Mutation** (insert/update/delete via a gated hook) | yes | `["posthog", "activity_trail"]` (+`logger`) | `await emit(...)` in `onSuccess` — the gate reads the row |
| **Nav / view / click / intent** (no backend effect; incl. honest "ikke implementert ennå" stubs) | no | `["posthog", "logger"]` | `void emit(...).catch(noop)` — must not block render |

`category` ∈ the `EventCategory` enum (auth · scheduling · operations · navigation · communication · …).
Reuse an existing category; only add a new one if none fits (rare). No new category was needed for min-dag.

## The load-bearing gotcha — rebuild dist

The web app imports `@smartout/telemetry` via its **built `dist/`** (`types: dist/index.d.ts`), NOT src.
Editing `registry.ts` alone leaves web blind — it still sees the old union and keeps erroring. After
registering, **rebuild**:
```bash
pnpm --filter @smartout/telemetry build   # tsc + fix-esm-imports
```
`dist/` is gitignored — commit `registry.ts` only; CI/consumers rebuild.

## Verify (evidence on disk)

```bash
pnpm --filter @smartout/telemetry typecheck   # registry self-consistent (union ↔ routing exhaustive)
pnpm --filter @smartout/telemetry build        # refresh dist so web resolves the new union
pnpm --filter web typecheck                     # the emit call-sites now typecheck (0 TS2322)
```
All three green = the events are registered. Cross-check the page: `grep emit\(.*event:` call-sites ↔
the registry keys — every emitted event has all three sites.

## The gate it feeds

A domain's `control.json` `events_missing_from_registry[]` → `[]`, and DoD #4 (telemetry
registered + emitting) passes its registration half. The emitting/landing half is layer-2/3
(`check-telemetry-coverage` B6 + a runtime invocation).

## Traps

- **Forgot the union member** → `TS2322` persists. **Forgot the routing entry** → `TS2740` (record
  incomplete). **Forgot to rebuild dist** → web still errors though telemetry package is green.
- **Stop-hook typecheck mid-edit is noisy** — it fires per write; the union references interfaces that
  may not exist yet between edits. Trust a fresh full `pnpm --filter web typecheck`, not an intermediate.
- **`properties` must match the emit exactly** — the call passes `properties:{ data:{...} }`; the
  interface must declare the same `data` shape or it won't typecheck.
- **No new `EventCategory`** unless genuinely needed — reuse the enum.
