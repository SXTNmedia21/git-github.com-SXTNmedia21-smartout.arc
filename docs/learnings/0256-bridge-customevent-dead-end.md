---
title: "Bridge CustomEvent dead-end: propose-* tool dispatches event with no listener"
id: L-0256
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
module: agent-harness
tags: [botsson, harness, customevent, dead-drop, voice-ux, L-0176-sibling, L-0255-sibling]
---

# L-0256: Bridge CustomEvent dead-end

## The Trap

Polish-Wave QA Council 2026-05-14 (Agent-coord code-trace, extending Steward Phase 3 findings) found 7 dispatched CustomEvents with ZERO matching listener:

| Bridge | Dead-drop events |
|--------|-----------------|
| `shift-clock` | `botsson:shift-clock:punch-in`, `botsson:shift-clock:punch-out`, `botsson:shift-clock:start-break`, `botsson:shift-clock:end-break`, `botsson:shift-clock:switch-tab` (5 events) |
| `my-contract` | `my-contract:download` |
| `setup` | `botsson:setup:advance` |

Pattern: bridge tool `propose<Verb>` calls `window.dispatchEvent(new CustomEvent("botsson:<surface>:<verb>"))` and returns `JSON.stringify({ ok: true, message: "..." })`. No component subscribes. Voice/chat user receives `ok: true`; nothing actually happens. Council verdict: BLOCKER (B1).

Steward Phase 3 found 5 of these (shift-clock × 5). Agent-coord code-trace extended to 7 by finding `my-contract:download` and `botsson:setup:advance`.

## Why it Happens

The propose-* pattern looks like the season/year-wheel pattern which IS correct (those call Server Actions directly). But propose-* tools that route via CustomEvent require the page to register `window.addEventListener` and wire to the actual mutation. Authors writing the bridge often skip this step — or assume "the page already listens" without verifying.

The tool returns `ok: true` regardless of whether anything received the event. From the bridge author's perspective, the code "works" (no exception). From the user's perspective, nothing happens.

## The Rule

For every `window.dispatchEvent(new CustomEvent("X"))` in `apps/web/src/app/dashboard/**/_tools/*.ts`:
1. Grep `apps/web/src` and `packages/` for `addEventListener("X")` or `addEventListener('X')` matching the literal event name.
2. ZERO matches = dead-drop = fail Trust Gate.
3. Bridge MUST NOT be merged until a matching listener exists OR the CustomEvent pattern is replaced with `uiActions` injection.

## Preferred Pattern (Council Verdict)

Replace CustomEvent dispatchers with `uiActions` injection — bridge receives mutation callbacks as props from the page that mounts it:
- `season-tools-bridge.tsx` calls a Server Action directly (no CustomEvent)
- `contracts-tools-bridge.tsx` calls `uiActions.router.push` (no CustomEvent)

The `uiActions` injection pattern eliminates the dead-drop class entirely: if the callback is not passed, TypeScript will fail at mount-site compilation, not silently at runtime.

## CI Detection (Proposed — M3 Sortie Scope)

```bash
# Detect dispatched events without listeners
for event in $(grep -rohE 'CustomEvent\("[^"]+"' apps/web/src/app/dashboard/**/_tools/ | grep -oP '"\K[^"]+'); do
  listeners=$(grep -rln "addEventListener.*['\"]${event}['\"]" apps/web/src packages/ 2>/dev/null)
  [ -z "$listeners" ] && echo "DEAD-DROP: $event"
done
```

Add as Phase 4.6 "CustomEvent listener audit" to `smartout-page-polish` skill 8-phase workflow.

## How to Fix B1 (shift-clock + my-contract + setup)

Three options per bridge, ranked:
1. **Replace with Server Action call** (preferred) — no CustomEvent, no listener needed
2. **Replace with `uiActions` injection** — page passes callback to bridge at mount, TypeScript-enforced
3. **Add matching `addEventListener`** in the page component (acceptable only when UX requires loose coupling)

## Cross-references

- L-0176 (docstring drift — propose-* JSDoc claims compliance while body has dead-drop)
- L-0254 (harness-bridge-reexposes-emit-gaps — same family, "new exposure surfaces old bug")
- L-0178 (silent-misroute — same UX failure class: user gets success-response, nothing happens)
- ADR-0324 (page-tool authority semantics — propose-* mode classification)
- Polish-Wave QA Council 2026-05-14 (B1 blocker — shift-clock 5 dead-drops + my-contract:download + botsson:setup:advance)
