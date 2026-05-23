import { describe, it, expect } from "vitest";
import { DraftSchema } from "../draft-schema.js";

const GOOD = {
  routine_name: "Åpningsrutine",
  trigger_guess: { trigger_type: "scheduled", trigger_config: { times: ["07:00"] } },
  location_hint: "Restaurant",
  steps: [
    {
      title: "Lås opp",
      description: "Åpne hovedinngangen",
      is_required: true,
      estimated_minutes: 5,
    },
  ],
};

describe("DraftSchema", () => {
  it("accepts a well-formed draft and applies is_required default", () => {
    const parsed = DraftSchema.parse({ ...GOOD, steps: [{ title: "x", description: "y" }] });
    expect(parsed.steps[0]!.is_required).toBe(true);
    expect(parsed.location_hint).toBe("Restaurant");
  });
  it("rejects empty step list", () => {
    expect(() => DraftSchema.parse({ ...GOOD, steps: [] })).toThrow();
  });
  it("rejects bad trigger_type", () => {
    expect(() =>
      DraftSchema.parse({ ...GOOD, trigger_guess: { trigger_type: "nope", trigger_config: {} } }),
    ).toThrow();
  });
  it("allows null location_hint", () => {
    expect(DraftSchema.parse({ ...GOOD, location_hint: null }).location_hint).toBeNull();
  });
});
