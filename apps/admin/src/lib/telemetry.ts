/**
 * telemetry.ts — emit() factory pre-bound for accountant actor
 *
 * Stub — implemented in M3.
 * In M3 this will import emit() from @smartout/telemetry and pre-bind
 * the actor_id (user_identity.user_id — special billing category exception,
 * per blueprint §7 + ADR-A comment in registry.ts).
 *
 * workspace_id is nullable for platform-scoped billing events
 * (order list_viewed when no company filter, accountant signed_in/out).
 */

export type BillingEmitPayload = {
  event: string;
  actor_id: string;
  workspace_id: string | null;
  properties?: Record<string, unknown>;
};

/**
 * Emit a billing-category telemetry event.
 * TODO M3: wire to @smartout/telemetry emit()
 */
export async function emitBillingEvent(_payload: BillingEmitPayload): Promise<void> {
  // TODO M3: implement via @smartout/telemetry
}
