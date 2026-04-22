// apps/web/src/components/journey/fjernkontroll-spring.ts
//
// Shared spring constant for the Fjernkontroll (ADR-0177).
//
// Why a single exported tuple, not a `Transition` object:
//   `framer-motion` widens the inferred types when used inline, so
//   `{ type: "spring", ...FJERN_SPRING }` lets each caller add `delay`
//   or `repeat` without wrestling with the Transition union. The values
//   themselves are the Nordic Split spec and are checked at lint-time
//   by the ADR-0177 spec-pin test (see Fjernkontroll.test.tsx when it
//   lands in a follow-up sub-sortie).
//
// Council red-line R5.1-4: hardcoded colors are banned. Motion values
// are numbers, not colors, and ARE the design contract here — do not
// promote them to tokens (they are a physical spec, not a theme value).

export const FJERN_SPRING = {
  stiffness: 35,
  damping: 22,
  mass: 2.2,
} as const;

/**
 * 6-state machine per ADR-0177. Keep in lock-step with
 * `useFjernkontrollMachine.ts::FjernkontrollState` — the union is
 * duplicated there so hook consumers don't have to import this file
 * purely for a type.
 */
export const FJERN_STATES = ["idle", "running", "paused", "stuck", "completed", "failed"] as const;

export type FjernkontrollStateName = (typeof FJERN_STATES)[number];
