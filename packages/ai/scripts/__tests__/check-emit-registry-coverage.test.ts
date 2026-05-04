import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkEmitRegistryCoverage } from "../check-emit-registry-coverage.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const positive = join(thisDir, "fixtures/emit-registry-coverage/positive");
const negative = join(thisDir, "fixtures/emit-registry-coverage/negative");

describe("check-emit-registry-coverage", () => {
  it("returns no violations for fixture where every emit is registered", async () => {
    const result = await checkEmitRegistryCoverage({ root: positive });
    expect(result.violations).toEqual([]);
  });

  it("reports violations for fixture with unregistered emit", async () => {
    const result = await checkEmitRegistryCoverage({ root: negative });
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toMatchObject({
      event: "phantom.made_up_event",
    });
  });
});
