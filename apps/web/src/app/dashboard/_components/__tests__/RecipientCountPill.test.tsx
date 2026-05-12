/**
 * RecipientCountPill unit tests.
 *
 * Uses renderToStaticMarkup (project convention — vitest runs in node env,
 * no @testing-library/react / jsdom installed). Assertions made against
 * the serialised HTML string.
 *
 * framer-motion `motion.span` renders as a plain <span> in SSR.
 * useReducedMotion returns false in SSR (no matchMedia in node).
 * useTranslation falls back to "nb" locale (default context value).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";

// framer-motion hooks are no-ops in node/SSR
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => false,
    motion: {
      ...actual.motion,
      // In node, motion.span can fail to serialise properly — ensure it renders as span
      span: (props: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => {
        const { animate, transition, ...rest } = props as Record<string, unknown>;
        void animate;
        void transition;
        return <span {...(rest as React.HTMLAttributes<HTMLSpanElement>)} />;
      },
    },
  };
});

import { RecipientCountPill } from "../RecipientCountPill";

describe("RecipientCountPill", () => {
  it("renders count with plural label when count > 1", () => {
    const html = renderToStaticMarkup(<RecipientCountPill count={3} />);
    expect(html).toContain(">3<");
    expect(html).toContain("ansatte vil få denne");
  });

  it("renders count=1 with singular label", () => {
    const html = renderToStaticMarkup(<RecipientCountPill count={1} />);
    expect(html).toContain(">1<");
    expect(html).toContain("1 ansatt vil få denne");
  });

  it("renders muted variant when count=0", () => {
    const html = renderToStaticMarkup(<RecipientCountPill count={0} />);
    expect(html).toContain('data-tone="muted"');
  });

  it("exposes aria-live=polite and aria-atomic=true for screen reader updates", () => {
    const html = renderToStaticMarkup(<RecipientCountPill count={5} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
  });

  it("renders as <span> (inline) so it composes inside label rows", () => {
    const html = renderToStaticMarkup(<RecipientCountPill count={2} />);
    // Outer element must be a <span>, not a <div>
    expect(html).toMatch(/^<span /);
  });
});
