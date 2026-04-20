import { describe, expect, it } from "vitest";
import { ReadinessBadge } from "./readiness-badge";

describe("ReadinessBadge", () => {
  it("renders 'ready' with green styling and Norwegian aria-label", () => {
    const element = ReadinessBadge({ state: "ready" });
    expect(element.props["aria-label"]).toBe("Status: Klar");
    expect(element.props.role).toBe("status");
    expect(element.props.className).toContain("green");
  });

  it("renders 'in_progress' with yellow styling and Norwegian aria-label", () => {
    const element = ReadinessBadge({ state: "in_progress" });
    expect(element.props["aria-label"]).toBe("Status: Pågår");
    expect(element.props.role).toBe("status");
    expect(element.props.className).toContain("yellow");
  });

  it("renders 'blocked' with red styling and Norwegian aria-label", () => {
    const element = ReadinessBadge({ state: "blocked" });
    expect(element.props["aria-label"]).toBe("Status: Blokkert");
    expect(element.props.role).toBe("status");
    expect(element.props.className).toContain("red");
  });
});
