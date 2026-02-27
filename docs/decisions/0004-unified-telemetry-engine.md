# 4. Unified Telemetry & Audit Trail Engine

Date: 2026-02-24
Status: Accepted

## Context

SmartOut operations require three distinct layers of tracking:

1. **Product Analytics**: Funnel conversions, user behavior, and cohort analysis (PostHog).
2. **Server Observability**: Traceable debugging, error logs, and system metrics (Structured JSON).
3. **User Audit Trail**: Non-repudiable logs for shift changes, approvals, and system mutations, directly accessible via the UI for managers and agents.

Historically, retrofitting these systems separately leads to misaligned taxonomies, ghost integrations, and missing data points across scopes.

## Decision

We are implementing the "One Registry, Three Destinations" architecture pattern:

1. All telemetry must be funneled through the strict, single TypeScript type registry (`SmartoutEvent` in `packages/telemetry`).
2. Components must not independently trigger analytics plugins. They must hook exclusively into `@smartout/telemetry` which handles background `sendBeacon` execution logic.
3. Every interactive UI primitive (especially `@smartout/ui` components like `Button`) will enforce an "Always Track Interactions" standard, utilizing `trackingId` and `trackingContext` props to automatically bubble up event states rather than leaving implementation to downstream developers.
4. Database Audit logs bypass restrictive generic solutions (`supa_audit`) in favor of a specialized, UI-queryable `activity_trail` table utilizing the Service Role for resilient mutability while adhering completely to strict Row Level Security (RLS) for read access.

## Consequences

- **Standardization**: Enforced Type definitions for analytics guarantee consistency in nomenclature and preventing missing metadata.
- **Component Lock-In**: Standard component wrappers must be used to inherit event telemetry. Bypassing `@smartout/ui` breaks the observability chain.
- **Performance Impact**: Writing to the `activity_trail` adds minor overhead, but executing this strictly via lightweight asynchronous service-role functions guarantees the UX/request cycle remains non-blocking.
- **Data Growth**: The `activity_trail` table will require monthly partitioning as it surpasses 10M rows to retain operational efficiency in queries.
