export * from "./database.types";
export * as BrowserClient from "./client";
export * as ServerClient from "./server";
export * as Middleware from "./middleware";
export * as AdminClient from "./admin";
export * as Vault from "./vault";
export * as ServiceConfig from "./service-config";

// Gate client (ADR-0091 WP3) — routes governance-gated writes through
// cascade_gate_write() RPC. Call-site migration follows in a later PR.
export {
  gatedInsert,
  gatedUpdate,
  gatedDelete,
  GateDeniedError,
  type GateContext,
  type GateOutcome,
  type GatedWriteResult,
  type SupabaseGateClient,
} from "./gate-client";
