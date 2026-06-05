---
title: Tell-Me-Telemetry — the 3-beat hook template
status: draft
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [template, telemetry, onboarding, hooks, less-is-more]
---

# 🛰 Tell-Me-Telemetry

*Every interaction has a story. Telemetry is how it tells you.*
*Three beats. Each tiny. Then the row proves it — and you're done.*

> **The whole game:** an interaction that doesn't emit is a **phantom**.
> Phantom = a gap = your next five minutes. Land the row, and the story's told.

---

## ① Name it — register the event

Two small adds in `packages/telemetry/src/registry.ts` (dual-registered, L-0072).
The `destinations` array **must** include `activity_trail` — that's the proof channel.

```ts
// a — the interface
export interface ShiftPublished extends BaseEvent {
  event: "shift published";
  properties: { entity: EntityRef; data: { shift_id: string } };
}

// b — the routing  (activity_trail = where the proof lands)
"shift published": { destinations: ["activity_trail", "logger"], category: "schedule" },
```

## ② Fire it — emit where the mutation *succeeds*

One `await emit()` in `onSuccess`. Never on intent, never on click — on **success**.

```ts
await emit({
  event: "shift published",
  workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
  actor_id:     nonEmpty(actor.profileId,  "actor_id"),
  properties: {
    entity: { entity_type: "shift", entity_id: res.shift_id },
    data:   { shift_id: res.shift_id },
  },
});
```

## ③ Prove it — the row, not your word

Done isn't a feeling. It's a row in `activity_trail`.

```sql
select * from activity_trail order by created_at desc limit 1;   -- your event, fresh on top
```

Row lands → **told.** No row → **phantom.** (Silent? check `destinations` has `activity_trail`.)

---

**Less is more.** If your hook is bigger than this, you're overbuilding.
The design already fires — you just let it speak. Now go make something tell you its story. 🛰
