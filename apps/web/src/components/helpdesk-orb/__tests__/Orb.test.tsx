/**
 * Orb unit tests.
 *
 * Uses renderToStaticMarkup (matches project convention — vitest runs in node
 * env, no @testing-library/react installed). Assertions are made against the
 * raw HTML string so we verify gradient chroma, pulse class, and check-icon
 * presence without a DOM.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Orb } from "../Orb";

describe("Orb", () => {
  it("renders with default size 48 and waiting status (chroma 0.08)", () => {
    const html = renderToStaticMarkup(<Orb aria-label="ticket status" />);
    expect(html).toContain("width:48px");
    expect(html).toContain("height:48px");
    expect(html).toContain('aria-label="ticket status"');
    // waiting chroma = 0.08
    expect(html).toContain("0.08");
  });

  it("maps status=active to chroma 0.12", () => {
    const html = renderToStaticMarkup(<Orb status="active" aria-label="active" />);
    expect(html).toContain("0.12");
  });

  it("maps status=complete to chroma 0.04", () => {
    const html = renderToStaticMarkup(<Orb status="complete" aria-label="complete" />);
    expect(html).toContain("0.04");
  });

  it("maps status=waiting to chroma 0.08", () => {
    const html = renderToStaticMarkup(<Orb status="waiting" aria-label="waiting" />);
    expect(html).toContain("0.08");
  });

  it("applies pulse class when pulse=true", () => {
    const html = renderToStaticMarkup(<Orb pulse aria-label="pulsing" />);
    // css-module class name is hashed in production but ts-vitest inlines
    // via a stable transformer — the data attribute lets us locate the
    // gradient layer and we assert a class attribute is present on it.
    expect(html).toMatch(/data-orb-gradient[^>]*class="[^"]*orbPulse/);
  });

  it("does not apply pulse class by default", () => {
    const html = renderToStaticMarkup(<Orb aria-label="still" />);
    expect(html).not.toMatch(/orbPulse/);
  });

  it("renders Check SVG icon when withCheck=true", () => {
    const html = renderToStaticMarkup(<Orb withCheck aria-label="done" />);
    // lucide-react renders svg root
    expect(html).toMatch(/<svg/);
  });

  it("respects role=status for a11y", () => {
    const html = renderToStaticMarkup(<Orb aria-label="status" />);
    expect(html).toContain('role="status"');
  });

  it("includes blur(1px) filter for softness", () => {
    const html = renderToStaticMarkup(<Orb aria-label="blur" />);
    expect(html).toContain("blur(1px)");
  });
});
