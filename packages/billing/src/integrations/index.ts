// Public surface of the integrations sub-package.
//
// Consumers (Edge Function handler, Server Actions, Vitest suite) import
// from here. Keep this barrel explicit so a future refactor can trace
// what's considered part of the stable adapter contract.

export * from "./types";
export { integrationAdapterRegistry, getIntegrationAdapter } from "./registry";
export { PlaceholderAdapter } from "./adapters/placeholder";
