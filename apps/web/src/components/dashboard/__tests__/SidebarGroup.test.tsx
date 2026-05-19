/**
 * SidebarGroup.test.tsx
 * Unit tests for SidebarGroup — focuses on group logic (feature-flag gating,
 * active-state computation, disabled rendering) without testing NavItem internals.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Mock NavItem so tests focus on SidebarGroup logic, not NavItem internals
// ---------------------------------------------------------------------------
vi.mock("../NavItem", () => ({
  NavItem: (props: {
    href: string;
    label: string;
    active: boolean;
    ai?: boolean;
    isCollapsed?: boolean;
  }) => (
    <a
      data-href={props.href}
      data-active={String(props.active)}
      data-ai={props.ai ? "true" : undefined}
    >
      {props.label}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Mock FEATURE_FLAGS — overridden per test via vi.mocked
// ---------------------------------------------------------------------------
vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: {
    MY_CV: false,
    AI_CHAT: false,
    SHIFT_CLOCK_LEADER: false,
  },
}));

import { SidebarGroup } from "../SidebarGroup";
import type { SidebarGroupDef } from "../sidebar-config";
import * as featureFlags from "@/lib/feature-flags";

// Minimal icon stub satisfying LucideIcon shape
const IconStub = () => null;
IconStub.displayName = "IconStub";
const icon = IconStub as unknown as LucideIcon;

// ---------------------------------------------------------------------------
// Fixture helpers
// labelKey values use short strings so t() returns them verbatim (key fallback)
// ---------------------------------------------------------------------------

function makeGroup(overrides: Partial<SidebarGroupDef> = {}): SidebarGroupDef {
  return {
    labelKey: "TestGroup",
    items: [
      { labelKey: "Alpha", href: "/dashboard/alpha", icon, status: "live" },
      { labelKey: "Beta", href: "/dashboard/beta", icon, status: "live" },
    ],
    ...overrides,
  };
}

const defaultProps = {
  pathname: "/dashboard/alpha",
  isDark: false,
  isCollapsed: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SidebarGroup", () => {
  beforeEach(() => {
    // Reset feature flags to all-false before each test
    vi.mocked(featureFlags).FEATURE_FLAGS = {
      MY_CV: false,
      AI_CHAT: false,
      SHIFT_CLOCK_LEADER: false,
    };
  });

  // 1. Renders group label as header when not standalone
  it("renders group label as uppercase header when not standalone", () => {
    const html = renderToStaticMarkup(<SidebarGroup group={makeGroup()} {...defaultProps} />);
    expect(html).toContain("TestGroup");
    expect(html).toContain("uppercase");
  });

  // 2. Skips header when standalone
  it("omits group-label header when standalone=true", () => {
    const group = makeGroup({ standalone: true });
    const html = renderToStaticMarkup(<SidebarGroup group={group} {...defaultProps} />);
    // Label should NOT appear as header text (items Alpha/Beta still render)
    expect(html).not.toContain("TestGroup");
  });

  // 3. Renders divider class when footer
  it("renders border-t divider wrapper when footer=true", () => {
    const group = makeGroup({ footer: true });
    const html = renderToStaticMarkup(<SidebarGroup group={group} {...defaultProps} />);
    expect(html).toContain("border-t");
  });

  // 4. Renders all non-feature-flagged items
  it("renders all items that have no featureFlag set", () => {
    const html = renderToStaticMarkup(<SidebarGroup group={makeGroup()} {...defaultProps} />);
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta");
  });

  // 5. Hides feature-flagged item when flag is false
  it("hides item with featureFlag when flag is false", () => {
    const group = makeGroup({
      items: [
        { labelKey: "Alpha", href: "/dashboard/alpha", icon, status: "live" },
        {
          labelKey: "FlaggedItem",
          href: "/dashboard/flagged",
          icon,
          status: "live",
          featureFlag: "MY_CV",
        },
      ],
    });
    const html = renderToStaticMarkup(<SidebarGroup group={group} {...defaultProps} />);
    expect(html).toContain("Alpha");
    expect(html).not.toContain("FlaggedItem");
  });

  // 5b. Shows feature-flagged item when flag is true
  it("shows item with featureFlag when flag is true", () => {
    vi.mocked(featureFlags).FEATURE_FLAGS = {
      MY_CV: true,
      AI_CHAT: false,
      SHIFT_CLOCK_LEADER: false,
    };
    const group = makeGroup({
      items: [
        {
          labelKey: "FlaggedItem",
          href: "/dashboard/flagged",
          icon,
          status: "live",
          featureFlag: "MY_CV",
        },
      ],
    });
    const html = renderToStaticMarkup(<SidebarGroup group={group} {...defaultProps} />);
    expect(html).toContain("FlaggedItem");
  });

  // 6. Active item has active=true forwarded to NavItem
  it("forwards active=true for the matching pathname", () => {
    const group = makeGroup();
    const html = renderToStaticMarkup(
      <SidebarGroup group={group} {...defaultProps} pathname="/dashboard/alpha" />,
    );
    // data-active="true" on Alpha's rendered anchor
    expect(html).toContain('data-href="/dashboard/alpha"');
    expect(html).toContain('data-active="true"');
  });

  // 7. compositeActive paths trigger active state
  it("activates item via compositeActive path", () => {
    const group = makeGroup({
      items: [
        {
          labelKey: "Ansatte",
          href: "/dashboard/people",
          icon,
          status: "live",
          compositeActive: ["/dashboard/people/contracts"],
        },
      ],
    });
    const html = renderToStaticMarkup(
      <SidebarGroup group={group} {...defaultProps} pathname="/dashboard/people/contracts" />,
    );
    expect(html).toContain('data-active="true"');
  });

  // 7b. compositeActive prefix also matches
  it("activates item via compositeActive prefix match", () => {
    const group = makeGroup({
      items: [
        {
          labelKey: "Ansatte",
          href: "/dashboard/people",
          icon,
          status: "live",
          compositeActive: ["/dashboard/people/contracts"],
        },
      ],
    });
    const html = renderToStaticMarkup(
      <SidebarGroup group={group} {...defaultProps} pathname="/dashboard/people/contracts/123" />,
    );
    expect(html).toContain('data-active="true"');
  });

  // 8. exactMatch=true — only exact pathname triggers active
  it("exactMatch=true: active only on exact match, not prefix", () => {
    const group = makeGroup({
      items: [
        {
          labelKey: "Oversikt",
          href: "/dashboard",
          icon,
          status: "live",
          exactMatch: true,
        },
      ],
    });

    const exactHtml = renderToStaticMarkup(
      <SidebarGroup group={group} {...defaultProps} pathname="/dashboard" />,
    );
    expect(exactHtml).toContain('data-active="true"');

    const prefixHtml = renderToStaticMarkup(
      <SidebarGroup group={group} {...defaultProps} pathname="/dashboard/people" />,
    );
    expect(prefixHtml).toContain('data-active="false"');
  });

  // 9. Disabled item renders without link, with data-disabled="true"
  it("renders disabled item as div with data-disabled=true, not as a link", () => {
    const group = makeGroup({
      items: [
        {
          labelKey: "Rutiner",
          href: "/dashboard/tasks",
          icon,
          status: "not-yet-built",
          disabled: true,
        },
      ],
    });
    const html = renderToStaticMarkup(<SidebarGroup group={group} {...defaultProps} />);
    expect(html).toContain('data-disabled="true"');
    // Disabled item must NOT render as an anchor link
    expect(html).not.toContain("<a ");
    expect(html).toContain("Rutiner");
  });

  // Returns null when all items are filtered out by flags
  it("returns null when all items are feature-flag-gated and flags off", () => {
    const group = makeGroup({
      items: [
        {
          labelKey: "Hidden",
          href: "/dashboard/hidden",
          icon,
          status: "live",
          featureFlag: "AI_CHAT",
        },
      ],
    });
    const html = renderToStaticMarkup(<SidebarGroup group={group} {...defaultProps} />);
    expect(html).toBe("");
  });
});
