/**
 * LighthouseAvatar unit tests.
 *
 * Uses renderToStaticMarkup (project convention; no @testing-library/react).
 * Verifies halo container sizing (1.5× avatar), initials logic, src override,
 * and halo chroma mapping for the three intensities.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LighthouseAvatar } from "../LighthouseAvatar";

describe("LighthouseAvatar", () => {
  it("renders with default size 56 inside 84px halo container (1.5×)", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn Andersen" />);
    expect(html).toContain("width:84px");
    expect(html).toContain("height:84px");
  });

  it("renders initials from two-word name", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn Andersen" />);
    expect(html).toContain(">LA<");
  });

  it("renders single initial for single-word name", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn" />);
    expect(html).toContain(">L<");
  });

  it("renders ? fallback when name is empty", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar />);
    expect(html).toContain(">?<");
  });

  it("renders background image url when src provided (and no initials)", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn" src="/avatar.png" />);
    expect(html).toContain("/avatar.png");
    // initials must NOT render when src is provided
    expect(html).not.toContain(">L<");
  });

  it("maps halo=idle to chroma 0.06", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn" halo="idle" />);
    expect(html).toContain("0.06");
  });

  it("maps halo=waiting to chroma 0.1", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn" halo="waiting" />);
    // 0.10 normalises to 0.1 in CSS serialisation
    expect(html).toContain("0.1 ");
  });

  it("maps halo=active to chroma 0.12", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn" halo="active" />);
    expect(html).toContain("0.12");
  });

  it("applies blur(2px) to halo layer", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn" />);
    expect(html).toContain("blur(2px)");
  });

  it("uses size*0.36 for initials font-size (size=100 → 36px)", () => {
    const html = renderToStaticMarkup(<LighthouseAvatar name="Linn" size={100} />);
    expect(html).toContain("font-size:36px");
  });
});
