/**
 * Pill unit tests — uses renderToStaticMarkup (project convention).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Pill } from "../Pill";

describe("Pill", () => {
  it("renders children", () => {
    const html = renderToStaticMarkup(<Pill>3</Pill>);
    expect(html).toContain(">3<");
  });

  it("applies muted tone by default", () => {
    const html = renderToStaticMarkup(<Pill>test</Pill>);
    expect(html).toContain("background:var(--muted)");
    expect(html).toContain("color:var(--foreground)");
  });

  it("applies brand tone (oklch 0.65 0.22 40 / 0.10 → brand-orange-dark fg)", () => {
    const html = renderToStaticMarkup(<Pill tone="brand">test</Pill>);
    expect(html).toContain("oklch(0.65 0.22 40 / 0.1");
    expect(html).toContain("var(--brand-orange-dark)");
  });

  it("applies success tone (oklch 0.68 0.15 145 / 0.10 → 0.45 fg)", () => {
    const html = renderToStaticMarkup(<Pill tone="success">test</Pill>);
    expect(html).toContain("oklch(0.68 0.15 145 / 0.1");
    expect(html).toContain("oklch(0.45 0.15 145)");
  });

  it("is rounded-full with padding 2px 8px and mono 11px", () => {
    const html = renderToStaticMarkup(<Pill>x</Pill>);
    expect(html).toContain("padding:2px 8px");
    expect(html).toContain("border-radius:9999");
    expect(html).toContain("font-size:11px");
    expect(html).toContain("var(--font-mono)");
    expect(html).toContain("white-space:nowrap");
  });
});
