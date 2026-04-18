// Public surface of the dispatch sub-package.
//
// Consumers (Edge Function handler, Server Actions, Vitest suite) import
// from here. Keep this barrel explicit so a future refactor can trace
// what's considered part of the stable adapter contract.

export * from "./types";
export { renderTemplate } from "./template";
export { ADAPTER_REGISTRY, getAdapter } from "./registry";
export { EmailCustomerAdapter } from "./adapters/email-customer";
export { EmailInternalAdapter } from "./adapters/email-internal";
export { HttpApiAdapter } from "./adapters/http-api";
export { sendViaSendGrid } from "./adapters/sendgrid";
export { StripeDispatchAdapter, getStripe, STRIPE_API_VERSION } from "./adapters/stripe";
export { redactStripeEvent, FORBIDDEN_KEYS } from "./adapters/stripe-redact";
export type { RedactedStripeEvent } from "./adapters/stripe-redact";
