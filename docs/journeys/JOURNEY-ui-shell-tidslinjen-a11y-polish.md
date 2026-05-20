---
title: "Journey — ui-shell-tidslinjen-a11y-polish"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: dashboard-dagslinjen
tags: [journey, a11y, wcag, dagslinjen, council-r1-follow-up]
---

# Journey — Tidslinjen A11y Polish (Council R1 Follow-up)

## Journey: Vestibular-sensitive user views Dagslinjen with prefers-reduced-motion

**Precondition:** User has macOS / Windows / browser setting `prefers-reduced-motion: reduce` active. User opens `/dashboard/Dagslinjen` during an active department session where the now-marker is visible (current time falls inside session window).

1. User navigates to `/dashboard/Dagslinjen` → System renders `<DayTimelineStrip>` with the now-marker positioned at `nowMin` → User sees the static orange vertical line + "NÅ HH:MM" badge.
2. User focuses on the now-marker dot → System renders the marker dot with the `animate-pulse` Tailwind class **OMITTED** because `useReducedMotion()` returned `true` → User sees a static dot, no opacity animation.
3. User remains on the page for >1s → System does NOT pulse the dot opacity (no movement) → User does not experience vestibular discomfort.

**Postcondition:** Now-marker visible at correct time; no continuous opacity animation on the dot. The orange ring + label remain fully visible (no functional regression).

**Error paths:**
- `useReducedMotion()` returns `null` (SSR or pre-hydration): treated as `false` by JavaScript truthiness in `!reduceMotion && "animate-pulse"` → animation enabled (default-on). Acceptable graceful degradation; ssr-safe.

## Journey: Keyboard-only user navigates Tidslinjen cluster markers

**Precondition:** User navigates to `/dashboard/Dagslinjen` using only the keyboard. The day's timeline has at least 2 events within the same 15-minute bucket so a `<ClusterMarker>` renders.

1. User presses `Tab` repeatedly to traverse the page → Focus moves through the dashboard chrome and into the timeline strip → User sees a focus ring move across each interactive element.
2. User reaches the cluster trigger button → System applies `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:rounded-full` → User sees a visible 2px ring in the `--ring` token color around the cluster icon, offset by 1px.
3. User presses `Enter` or `Space` → Radix Popover opens (state managed by `onOpenChange(true)` at `ClusterMarker.tsx:179`) → User sees the popover content; focus auto-moves to the popover (Radix default).
4. User presses `Tab` inside the popover → Focus moves between the per-event list rows → User can select any event by pressing `Enter`/`Space` on a row.
5. User presses `Escape` → Popover closes (Radix default) → Focus returns to the cluster trigger button → User sees the focus ring on the trigger again.

**Postcondition:** Keyboard user can locate, open, navigate, and close the cluster popover with full visual focus feedback at every step. WCAG 2.4.11 (Focus Appearance) satisfied.

**Error paths:**
- `--ring` CSS variable not defined in current theme: Tailwind falls back to `var(--ring, <default>)` → default focus ring color used. Cluster trigger still visibly focused.
- `focus-visible` not supported (legacy browser): browser falls back to default `outline`; ring class no-ops but `focus-visible:outline-none` also no-ops → native outline shows. Functionally equivalent.

## Journey: Mouse user clicks now-marker dot

**Precondition:** `prefers-reduced-motion` NOT set. Day session active with now-marker rendered.

1. User views `/dashboard/Dagslinjen` → System renders the now-marker dot with `animate-pulse` class (because `!reduceMotion === true`) → User sees the orange dot pulsing every 2s.
2. User does not interact with the dot → System keeps pulsing indefinitely while the marker is visible → No regression vs. pre-sortie behavior.

**Postcondition:** Pulsing behavior preserved for the default user. No regression introduced.

**Error paths:** None — this is the legacy code path, only gated by the new `reduceMotion` check.
