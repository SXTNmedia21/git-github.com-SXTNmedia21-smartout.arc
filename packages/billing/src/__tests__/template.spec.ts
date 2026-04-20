// Template renderer contract tests. Locked-in behaviours:
//   - {{path}} interpolation walks object paths (dot notation)
//   - missing keys render empty string (never throw)
//   - HTML-escape by default, opt-out via { escape: false }
//   - Arrays + nested objects traversed via dot paths
//
// If any of these contracts change, dispatch adapter templates may
// render differently — making this a forcing function.

import { describe, test, expect } from "vitest";
import { renderTemplate } from "../dispatch/template";

describe("renderTemplate", () => {
  test("interpolates simple keys", () => {
    expect(renderTemplate("Hei {{name}}", { name: "Pontus" })).toBe("Hei Pontus");
  });

  test("walks dot paths", () => {
    const ctx = { invoice: { number: 42, amount: 125 } };
    expect(renderTemplate("Faktura {{invoice.number}}", ctx, { escape: false })).toBe("Faktura 42");
    expect(renderTemplate("{{invoice.amount}} NOK", ctx)).toBe("125 NOK");
  });

  test("renders empty string for missing keys (never throws)", () => {
    expect(renderTemplate("Hei {{missing}}", {})).toBe("Hei ");
    expect(renderTemplate("Hei {{a.b.c}}", { a: {} })).toBe("Hei ");
    expect(renderTemplate("Hei {{a.b.c}}", {})).toBe("Hei ");
  });

  test("HTML-escapes by default", () => {
    expect(renderTemplate("<p>{{msg}}</p>", { msg: "<script>alert(1)</script>" })).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  test("escape:false leaves value raw (for subject lines, etc.)", () => {
    expect(renderTemplate("Faktura {{num}}", { num: "F-2026-001" }, { escape: false })).toBe(
      "Faktura F-2026-001",
    );
  });

  test("multiple placeholders in one string", () => {
    expect(renderTemplate("{{a}} {{b}} {{c}}", { a: "x", b: "y", c: "z" }, { escape: false })).toBe(
      "x y z",
    );
  });

  test("null values render as empty", () => {
    expect(renderTemplate("{{val}}", { val: null }, { escape: false })).toBe("");
  });

  test("whitespace around placeholder name tolerated", () => {
    expect(renderTemplate("{{ val }}", { val: "ok" }, { escape: false })).toBe("ok");
  });
});
