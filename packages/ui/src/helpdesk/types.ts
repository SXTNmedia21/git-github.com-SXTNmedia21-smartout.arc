// packages/ui/src/helpdesk/types.ts
// ADR-0161 — ticket status is the engine_state.status enum reduced to the
// three values the UI needs to render. Phase 2 may add `reassigned` or
// `waiting_for_requester` as display-only derivations from context.

export type TicketStatus = "waiting" | "active" | "complete";

export type OrbHaloState = "idle" | "active" | "waiting";

/**
 * Shared props surface for the darkening-orb primitive. Phase 1 only uses
 * `status` and `size`; `slaProgress` is reserved for Phase 2 (hue 50→40,
 * chroma statusChroma→0.18 as progress 0→1). Consumers pass `slaProgress`
 * now so the Phase 2 switch is one prop flip.
 */
export type ResponsibilityOrbProps = {
  status: TicketStatus;
  size: number;
  /** Phase 1: ignored. Phase 2: 0..1 clamped drives hue + chroma lerp. */
  slaProgress?: number;
  /** Opt-in pulse override. Default: only `waiting` pulses. */
  pulse?: boolean;
  /** Decorative by default; set false for cases where the orb conveys status. */
  decorative?: boolean;
};
