import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ShiftUnlockHint } from "../ShiftUnlockHint";

describe("ShiftUnlockHint", () => {
  it("renders nothing when no missing protocols", () => {
    const html = renderToStaticMarkup(<ShiftUnlockHint missingProtocols={[]} />);
    expect(html).toBe("");
  });

  it("renders protocol name, remaining steps, and training link", () => {
    const html = renderToStaticMarkup(
      <ShiftUnlockHint
        missingProtocols={[{ protocol_id: "haccp-basics", name: "HACCP", steps_remaining: 2 }]}
      />,
    );

    expect(html).toContain("HACCP");
    expect(html).toContain("mangler");
    expect(html).toContain("2 steg igjen");
    expect(html).toContain("/dashboard/my-training/haccp-basics");
  });

  it("renders one hint per missing protocol", () => {
    const html = renderToStaticMarkup(
      <ShiftUnlockHint
        missingProtocols={[
          { protocol_id: "haccp", name: "HACCP", steps_remaining: 1 },
          { protocol_id: "hms", name: "HMS", steps_remaining: 3 },
        ]}
      />,
    );

    expect(html).toContain("HACCP");
    expect(html).toContain("HMS");
    expect(html).toContain("/dashboard/my-training/haccp");
    expect(html).toContain("/dashboard/my-training/hms");
  });
});
