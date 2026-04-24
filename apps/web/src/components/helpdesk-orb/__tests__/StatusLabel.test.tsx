/**
 * StatusLabel unit tests — uses renderToStaticMarkup (project convention).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusLabel } from "../StatusLabel";

describe("StatusLabel", () => {
  it("renders VENTER for waiting status", () => {
    const html = renderToStaticMarkup(<StatusLabel status="waiting" />);
    expect(html).toContain(">VENTER<");
  });

  it("renders AKTIV for active status", () => {
    const html = renderToStaticMarkup(<StatusLabel status="active" />);
    expect(html).toContain(">AKTIV<");
  });

  it("renders LØST for complete status", () => {
    const html = renderToStaticMarkup(<StatusLabel status="complete" />);
    expect(html).toContain(">LØST<");
  });

  it("uses Geist Mono at 11px weight 500 uppercase letter-spacing 0.12em", () => {
    const html = renderToStaticMarkup(<StatusLabel status="waiting" />);
    expect(html).toContain("var(--font-mono)");
    expect(html).toContain("font-size:11px");
    expect(html).toContain("font-weight:500");
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain("letter-spacing:0.12em");
    expect(html).toContain("var(--muted-foreground)");
  });
});
