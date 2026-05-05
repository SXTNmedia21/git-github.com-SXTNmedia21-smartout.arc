/**
 * telemetry.ts — re-export of @smartout/telemetry for apps/admin
 *
 * Re-exports emit() and nonEmpty() for use in Server Components, Server Actions,
 * and Route Handlers. The @smartout/telemetry package has conditional exports:
 * react-server → server impl, default → client impl. In Next.js RSC context
 * the correct server implementation is selected automatically.
 *
 * actor_id = user_identity.user_id for accountant events (no workspace profile).
 * Exception documented in registry.ts ~6530 and blueprint §7.
 *
 * workspace_id is null for platform-scoped billing events.
 *
 * NEVER import in "use client" modules (emit() makes DB calls).
 */

export { emit, nonEmpty } from "@smartout/telemetry";
export type { SmartoutEvent, NonEmptyString } from "@smartout/telemetry";
