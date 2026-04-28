---
title: Onboarding Reduced-Motion Conformance
status: draft
feature: c3-1-onboarding-reduced-motion
campaign: botsson-arena
phase: C3.1
created: 2026-04-28
updated: 2026-04-28
module: MODULE_BOTSSON
tags: [onboarding, a11y, reduced-motion, framer-motion, c3]
adrs: [ADR-0177]
---

# Onboarding Reduced-Motion Conformance (C3.1)

A11y compliance pass on the cinematic onboarding track — applying ADR-0177's
`useReducedMotion()` guard pattern to all motion components in
`apps/web/src/app/onboarding/components/`. Pure conformance; no visual
redesign, no spring tuning changes.

## Scope

Seven `framer-motion` components guarded:

1. `BotssonAvatar.tsx`
2. `DataMaterializer.tsx`
3. `FinaleOverlay.tsx`
4. `KeyFactsPanel.tsx`
5. `TypewriterText.tsx`
6. `BigBoard.tsx`
7. `VoiceSessionOverlay.tsx`

Pattern per file:

- Import `useReducedMotion` from `framer-motion`.
- Hook returns `true` when OS-level `prefers-reduced-motion: reduce` is set.
- `motion.*` components: `initial={prefersReducedMotion ? false : { … }}` skips entrance animation.
- Transition objects: `transition={prefersReducedMotion ? { duration: 0 } : { … }}` neutralises spring/repeat.
- Looping animations (e.g. `VoiceSessionOverlay` bar visualizer): replace keyframe arrays with static states gated on `isSpeaking`.

## Journey: User with reduced-motion preference completes onboarding

**Precondition:** User has `prefers-reduced-motion: reduce` set at OS or browser level.

1. User opens `/onboarding` → System loads onboarding shell → User sees full UI immediately (no fade-in).
2. User progresses through wizard sections → System swaps section content → User sees instant content swap (no slide/scale).
3. Voice session overlay opens → System mounts overlay → User sees overlay fully visible (no fade/slide entrance).
4. Bar visualizer renders during speech → System animates bars statically (height collapsed to 14px speaking / 6px idle) → User sees discrete on/off state, no oscillation.
5. BigBoard panels reveal as data lands → System mounts panels with `initial=false` → User sees data appear instantly per panel.
6. KeyFacts checkmarks land → System renders ✓ at scale 1 immediately → User sees check without spring bounce.
7. FinaleOverlay completes onboarding → System mounts finale → User sees finale at full opacity.

**Postcondition:** User completed onboarding without any motion exceeding 0ms duration.

**Error paths:**
- `useReducedMotion()` hook returns `null` server-side → SSR renders motion variants → on hydration, hook resolves and applies user preference. Mismatch lasts <1 frame, no visible flicker on properly tokenised components.
- User toggles preference mid-session → React subscription via `framer-motion` re-renders affected components on next state change. No forced re-mount.

## Journey: User without reduced-motion preference completes onboarding

**Precondition:** Default — no `prefers-reduced-motion` setting.

1. User opens `/onboarding` → System loads onboarding shell → User sees animated entrance (fade + slight scale).
2. Through wizard → animated section swaps with EASE_EXPO.
3. Voice session → bars oscillate at 0.6–2s cycles, height varies 6px–55px.
4. BigBoard panels → stagger-reveal at 50ms increments, scale 0.97 → 1.
5. Checkmarks → spring (stiffness 500, damping 25) bounce in.
6. FinaleOverlay → fade + scale entrance.

**Postcondition:** User saw the cinematic onboarding as designed.

**Error paths:** unchanged from pre-C3.1 baseline.

## Decisions

- **No new ADR.** C3.1 is conformance to existing ADR-0177 — that ADR establishes the `useReducedMotion()` guard as a Smartout-wide motion contract. Onboarding components were the unguarded long tail.
- **No spring re-tuning.** ADR-0177 mandates spring 35/22/2.2 for the journey runner; onboarding kept its existing springs (e.g. 500/25 for checkmarks) because onboarding is a content-driven flow, not the runner state machine. ADR-0177 is the *pattern* source, not the spring authority across all surfaces.
- **No layout-effect probe for reduced-motion.** Relied on framer-motion's built-in hook subscription rather than `useMediaQuery` — simpler, framework-supplied.

## Learnings

- **Bar visualizers can't just zero `transition.duration`.** They use `animate` keyframe arrays which loop regardless of duration when `repeat: Infinity`. Had to collapse the keyframe array to a static object gated on `isSpeaking` for `VoiceSessionOverlay`.
- **`initial=false` is the canonical "skip entrance" signal.** Setting `initial={undefined}` re-runs the variant; only `initial={false}` truly skips. Verified in framer-motion v11 source.
- **Two-pass commit pattern.** First commit (`46f9d9ba`) covered 5 files. BigBoard + VoiceSessionOverlay missed because they were not in initial grep — discovered via dirty tree on `/status`. Second commit (`e9553d11`) closed the gap. Lesson: grep onboarding/* exhaustively, not just files known to use motion at the time the work was scoped.

## Known issues / debt

- No automated a11y test asserts `prefers-reduced-motion: reduce` zeros all transitions on this surface. Manual verification only (DevTools → Rendering → Emulate CSS media `prefers-reduced-motion`).
- Other surfaces (dashboard tour, year-wheel reveal animations, deviation-bridge modal) remain unaudited for ADR-0177 conformance. Tracked as future C3 follow-ups.

## Next steps

- Merge to `campaign/botsson-arena` via `/close-feature`.
- Schedule a sweep of remaining onboarding-adjacent surfaces (dashboard, year-wheel) — recommend recurring agent every 2 weeks until ADR-0177 grep returns zero unguarded `motion.*` outside guarded files.
