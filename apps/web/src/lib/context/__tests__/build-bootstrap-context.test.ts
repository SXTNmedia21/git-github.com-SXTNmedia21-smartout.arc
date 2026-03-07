/**
 * build-bootstrap-context.test.ts
 *
 * Verifies the server bootstrap builder returns the core role-scoped shape
 * required by the dashboard context contract.
 */

import { describe, expect, it } from "vitest";
import { buildBootstrapContext } from "../build-bootstrap-context";

describe("buildBootstrapContext", () => {
  it("returns role-scoped context shape", async () => {
    const result = await buildBootstrapContext({
      workspaceId: "w1",
      profileId: "p1",
      pageId: "schedule",
    });

    expect(result.system.page_id).toBe("schedule");
    expect(Array.isArray(result.system.permissions)).toBe(true);
    expect(result.intelligence.readiness_score).toBeTypeOf("number");
  });
});
