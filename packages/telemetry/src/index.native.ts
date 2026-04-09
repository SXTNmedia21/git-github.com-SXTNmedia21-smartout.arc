// React Native entry point — uses native PostHog SDK and edge function proxy
export { emit } from "./emit.native";
export type { SmartoutEvent } from "./registry";
export { EVENT_ROUTING } from "./registry";
