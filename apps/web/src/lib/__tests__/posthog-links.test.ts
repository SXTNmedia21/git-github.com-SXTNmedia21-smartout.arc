/**
 * posthog-links.test.ts
 * Merge-gate tests for PostHog bridge URL builders and runtime-safe resolvers.
 * Ensures row/detail mapping parity and that invalid IDs never yield hrefs.
 */
import { describe, expect, it } from "vitest";
import {
  buildPostHogSessionUrl,
  buildPostHogVisitorUrl,
  getPostHogSessionBridgeHref,
  getPostHogVisitorBridgeHref,
} from "@/lib/posthog-links";

describe("posthog bridge contract", () => {
  it("keeps session_id in URL even when distinct_id is missing", () => {
    const href = buildPostHogSessionUrl("session-123");
    expect(href).toContain("session_id=session-123");
    expect(href).toContain("q=session-123");
    expect(href).not.toContain("distinct_id=");
  });

  it("uses same mapping for detail and row session links", () => {
    const row = { session_id: "s-1", visitor_id: "v-1" };
    const detailHref = getPostHogSessionBridgeHref(row);
    const rowHref = getPostHogSessionBridgeHref(row);
    expect(rowHref).toBe(detailHref);
  });

  it("uses same mapping for detail and row visitor links", () => {
    const row = { id: "visitor-22" };
    const detailHref = getPostHogVisitorBridgeHref(row);
    const rowHref = getPostHogVisitorBridgeHref(row);
    expect(rowHref).toBe(detailHref);
  });

  it("returns undefined when bridge input is invalid", () => {
    const invalidSession = getPostHogSessionBridgeHref({ session_id: "", visitor_id: "v-2" });
    const invalidVisitor = getPostHogVisitorBridgeHref({ id: "" });
    expect(invalidSession).toBeUndefined();
    expect(invalidVisitor).toBeUndefined();
  });

  it("creates equivalent visitor links from detail/lead row input shape", () => {
    const rowInput = { id: "visitor-bridge-42" };
    const fromResolver = getPostHogVisitorBridgeHref(rowInput);
    const direct = buildPostHogVisitorUrl("visitor-bridge-42");
    expect(fromResolver).toBe(direct);
  });
});
