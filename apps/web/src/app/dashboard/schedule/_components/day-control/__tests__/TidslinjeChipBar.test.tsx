/**
 * TidslinjeChipBar unit tests.
 *
 * Uses renderToStaticMarkup (project convention — vitest runs in node env,
 * no @testing-library/react / jsdom installed). Assertions are made against
 * the serialised HTML string.
 *
 * useTranslation uses useContext which returns the default context value ("nb")
 * in SSR — no LocaleProvider wrapper needed. t("tidslinje.chip_all") resolves
 * to "Alle" from packages/i18n/locales/nb/dashboard.json.
 *
 * onClick / aria-pressed state is static in SSR — we assert:
 *   1. Button count (Alle + N location chips)
 *   2. aria-pressed="false" on unselected chips (selectedLocations empty Set)
 *   3. aria-pressed="true" on the selected chip
 *   4. Location names are rendered inside buttons
 *
 * Limitation: fireEvent / click callbacks cannot be exercised server-side.
 * Static source assertion used to verify onToggleLocation wiring (Path B).
 * If jsdom is added to vitest in a future sortie, replace with @testing-library assertions.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import { TidslinjeChipBar } from "../TidslinjeChipBar";

const locations = [
  { id: "loc-1", name: "Sal" },
  { id: "loc-2", name: "Kjøkken" },
];

const SOURCE = resolve(__dirname, "..", "TidslinjeChipBar.tsx");

describe("TidslinjeChipBar", () => {
  it("renders Alle + one button per location", () => {
    const html = renderToStaticMarkup(
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={new Set()}
        onToggleLocation={() => {}}
      />,
    );
    // "Alle" label from nb dashboard.tidslinje.chip_all
    expect(html).toContain(">Alle<");
    // Each location name appears inside a button
    expect(html).toContain(">Sal<");
    expect(html).toContain(">Kjøkken<");
  });

  it("marks all chips aria-pressed=false when selectedLocations is empty", () => {
    const html = renderToStaticMarkup(
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={new Set()}
        onToggleLocation={() => {}}
      />,
    );
    // Location chips must be aria-pressed="false" when no selection active
    const pressedFalseCount = (html.match(/aria-pressed="false"/g) ?? []).length;
    // 2 location chips: loc-1 (Sal) and loc-2 (Kjøkken)
    expect(pressedFalseCount).toBe(2);
    // "Alle" chip is active when nothing is selected — aria-pressed="true"
    expect(html).toContain('aria-pressed="true"');
  });

  it("marks selected chip aria-pressed=true and unselected aria-pressed=false", () => {
    const html = renderToStaticMarkup(
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={new Set(["loc-1"])}
        onToggleLocation={() => {}}
      />,
    );
    // loc-1 (Sal) is selected — at least one aria-pressed="true" for Sal's button
    const pressedTrue = (html.match(/aria-pressed="true"/g) ?? []).length;
    const pressedFalse = (html.match(/aria-pressed="false"/g) ?? []).length;
    // Sal=true, Kjøkken=false, Alle=false (selection non-empty → Alle is inactive)
    expect(pressedTrue).toBe(1);
    expect(pressedFalse).toBe(2);
  });

  it("renders buttons with type=button (no unintentional form submission)", () => {
    const html = renderToStaticMarkup(
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={new Set()}
        onToggleLocation={() => {}}
      />,
    );
    const typeButtonCount = (html.match(/type="button"/g) ?? []).length;
    // Alle + 2 location chips = 3 buttons total
    expect(typeButtonCount).toBe(3);
  });

  it("applies focus-visible ring classes for a11y (WCAG 2.4.7) — static contract", () => {
    const src = readFileSync(SOURCE, "utf-8");
    // Every button must carry both ring + outline-none classes (compensating ring per ADR)
    expect(src).toContain("focus-visible:ring-2");
    expect(src).toContain("focus-visible:ring-ring");
    expect(src).toContain("focus-visible:outline-none");
  });

  it("wires onToggleLocation to each location chip — static contract", () => {
    const src = readFileSync(SOURCE, "utf-8");
    // The callback must appear connected to onClick on location buttons
    expect(src).toContain("onToggleLocation(loc.id)");
  });

  it("uses only CSS-variable utility classes (no hardcoded colors) — static contract", () => {
    const src = readFileSync(SOURCE, "utf-8");
    // ADR-0361 ban: no hardcoded Tailwind palette tokens
    expect(src).not.toMatch(/\btext-zinc-\d/);
    expect(src).not.toMatch(/\bbg-zinc-\d/);
    expect(src).not.toMatch(/\bbg-orange-\d/);
    expect(src).not.toMatch(/\btext-orange-\d/);
    expect(src).not.toMatch(/\bborder-gray-\d/);
    // ADR-0366 ban: no OKLCH literals in arbitrary values
    expect(src).not.toContain("oklch(");
  });

  it("active state uses fg/bg inversion (Manager Timeline recipe) — static contract", () => {
    const src = readFileSync(SOURCE, "utf-8");
    // Active chip MUST use bg-foreground + text-background (inverted fg/bg)
    // NOT bg-primary / text-primary-foreground (brand-orange — wrong per artifact)
    expect(src).toContain("bg-foreground");
    expect(src).toContain("text-background");
    expect(src).toContain("border-foreground");
    // Confirm brand-orange tokens are NOT used for active state
    expect(src).not.toContain("bg-primary");
    expect(src).not.toContain("text-primary-foreground");
  });
});
