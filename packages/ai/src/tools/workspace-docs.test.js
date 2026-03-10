// ============================================
// workspace-docs.test.js
// Verifies workspace doc tool exports are present.
// This guards Task 6 barrel/tool export contracts.
// Connected to: src/tools/workspace-docs.ts
// Connected to: src/index.ts
// ============================================

import { describe, expect, it } from "vitest";
import { WORKSPACE_DOC_TOOLS } from "./workspace-docs";
import { WORKSPACE_DOC_TOOLS as BARREL_WORKSPACE_DOC_TOOLS } from "../index";

describe("workspace doc tools exports", () => {
  it("exports search_workspace_docs tool from module and barrel", () => {
    expect(WORKSPACE_DOC_TOOLS.length).toBeGreaterThan(0);
    expect(WORKSPACE_DOC_TOOLS[0]?.name).toBe("search_workspace_docs");
    expect(BARREL_WORKSPACE_DOC_TOOLS.length).toBeGreaterThan(0);
    expect(BARREL_WORKSPACE_DOC_TOOLS[0]?.name).toBe("search_workspace_docs");
  });
});
