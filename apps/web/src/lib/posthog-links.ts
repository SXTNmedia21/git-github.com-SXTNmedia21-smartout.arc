// ============================================
// posthog-links.ts
// Builds safe PostHog UI URLs from environment values.
// Why: Platform Admin needs one-click handoff into PostHog
// without hardcoding project hosts or brittle URL fragments.
//
// Connected to: apps/web/src/app/platform-admin/landing/_components/session-detail.tsx
//               apps/web/src/app/platform-admin/landing/_components/lead-detail.tsx
//               apps/web/src/env.ts
// ============================================

import { env } from "@/env";

const DEFAULT_POSTHOG_UI_HOST = "https://eu.posthog.com";

/**
 * Converts ingest/API host values (for example eu.i.posthog.com) into a UI host.
 * Why: existing env var may point to ingestion, while links should open the UI.
 *
 * @returns A normalized PostHog UI host URL.
 */
function getPostHogUiHost(): string {
  const configuredHost = env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (!configuredHost) return DEFAULT_POSTHOG_UI_HOST;

  try {
    const url = new URL(configuredHost);
    if (url.hostname.includes(".i.posthog.com")) {
      url.hostname = url.hostname.replace(".i.posthog.com", ".posthog.com");
    }
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return DEFAULT_POSTHOG_UI_HOST;
  }
}

/**
 * Returns the PostHog project base URL when project id is configured.
 * Falls back to the UI root when project id is missing.
 *
 * @returns Project-specific or global PostHog UI URL.
 */
function getPostHogProjectBaseUrl(): URL {
  const base = getPostHogUiHost();
  const projectId = env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim();
  if (!projectId) return new URL("/", base);
  return new URL(`/project/${projectId}/`, base);
}

/**
 * Builds a PostHog URL for replay/session inspection.
 * If project id is configured we deep link to replay view and include query context.
 * If not configured we still open PostHog with context query params for manual lookup.
 *
 * @param sessionId - Internal session id from landing_session.
 * @param distinctId - Visitor id (used as person distinct id in lookups).
 * @returns Shareable URL string for opening PostHog.
 */
export function buildPostHogSessionUrl(sessionId: string, distinctId?: string): string {
  const projectId = env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim();
  const url = projectId
    ? new URL("replay/", getPostHogProjectBaseUrl())
    : getPostHogProjectBaseUrl();

  // q provides a useful fallback query in PostHog search inputs.
  url.searchParams.set("q", sessionId);
  url.searchParams.set("session_id", sessionId);
  if (distinctId) {
    url.searchParams.set("distinct_id", distinctId);
  }
  return url.toString();
}

/**
 * Builds a PostHog URL for person/visitor-level investigation.
 *
 * @param distinctId - Visitor id to look up in PostHog.
 * @returns Shareable URL string for opening PostHog person context.
 */
export function buildPostHogVisitorUrl(distinctId: string): string {
  const projectId = env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim();
  const url = projectId
    ? new URL("persons/", getPostHogProjectBaseUrl())
    : getPostHogProjectBaseUrl();
  url.searchParams.set("q", distinctId);
  url.searchParams.set("distinct_id", distinctId);
  return url.toString();
}

type SessionBridgeInput = {
  session_id?: string | null;
  visitor_id?: string | null;
};

type VisitorBridgeInput = {
  id?: string | null;
};

/**
 * Normalizes optional string fields from API rows before building external URLs.
 * Why: Empty strings and whitespace should not produce broken PostHog links.
 *
 * @returns Trimmed non-empty string, or undefined.
 */
function toNonEmptyString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolves a PostHog session/replay URL from landing session row or detail shape.
 * Validates `session_id` at runtime; optional `visitor_id` maps to PostHog distinct id.
 *
 * @returns URL string, or undefined when session id is missing or invalid.
 */
export function getPostHogSessionBridgeHref(input: SessionBridgeInput): string | undefined {
  const sessionId = toNonEmptyString(input.session_id);
  if (!sessionId) return undefined;
  const visitorId = toNonEmptyString(input.visitor_id);
  return buildPostHogSessionUrl(sessionId, visitorId);
}

/**
 * Resolves a PostHog person/visitor URL from lead row or detail shape (`id` = visitor id).
 *
 * @returns URL string, or undefined when id is missing or invalid.
 */
export function getPostHogVisitorBridgeHref(input: VisitorBridgeInput): string | undefined {
  const visitorId = toNonEmptyString(input.id);
  if (!visitorId) return undefined;
  return buildPostHogVisitorUrl(visitorId);
}
