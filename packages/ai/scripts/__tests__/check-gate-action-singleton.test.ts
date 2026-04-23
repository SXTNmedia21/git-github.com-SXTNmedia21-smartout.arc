import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkGateActionSingleton } from "../check-gate-action-singleton.js";

const thisDir = dirname(fileURLToPath(import.meta.url));

describe("check-gate-action-singleton", () => {
  it("no violations when engine_authority_config is only read inside RPC / migrations", async () => {
    const result = await checkGateActionSingleton({
      root: join(thisDir, "fixtures/gate-action-singleton/clean"),
    });
    expect(result.violations).toEqual([]);
  });

  it("reports violations when app code reads engine_authority_config directly", async () => {
    const result = await checkGateActionSingleton({
      root: join(thisDir, "fixtures/gate-action-singleton/dirty"),
    });
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
