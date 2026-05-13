import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkServerDerivedActor } from "../check-server-derived-actor.js";

const thisDir = dirname(fileURLToPath(import.meta.url));

describe("check-server-derived-actor", () => {
  it("no violations when POST body schema omits profile_id", async () => {
    const result = await checkServerDerivedActor({
      root: join(thisDir, "fixtures/server-derived-actor/clean"),
    });
    expect(result.violations).toEqual([]);
  });

  it("reports violations when profile_id appears in zValidator schema", async () => {
    const result = await checkServerDerivedActor({
      root: join(thisDir, "fixtures/server-derived-actor/dirty"),
    });
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("ignores lines with the not-actor inline marker", async () => {
    const result = await checkServerDerivedActor({
      root: join(thisDir, "fixtures/server-derived-actor/marked"),
    });
    expect(result.violations).toEqual([]);
  });
});
