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

  it("applies brand tone (var(--brand-orange) 10% mix → brand-orange-dark fg)", () => {
    const html = renderToStaticMarkup(<Pill tone="brand">test</Pill>);
    expect(html).toContain("color-mix(in oklch, var(--brand-orange) 10%, transparent)");
    expect(html).toContain("var(--brand-orange-dark)");
  });

  it("applies success tone (var(--success) 10% mix → status-active fg)", () => {
    const html = renderToStaticMarkup(<Pill tone="success">test</Pill>);
    expect(html).toContain("color-mix(in oklch, var(--success) 10%, transparent)");
    expect(html).toContain("var(--status-active)");
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
