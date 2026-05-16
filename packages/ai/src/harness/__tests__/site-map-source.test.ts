/**
 * site-map-source.test.ts — Unit tests for SiteMapSource (Phase 2).
 *
 * All tests use inline fixture data. The real apps/web/.botsson/site-map.json
 * is NOT loaded here — that would make these tests brittle to site-map edits.
 *
 * Fixture design: 4 routes covering owner/admin, manager, employee subsets,
 * plus one admin-only route — enough to exercise all filter branches.
 */

import { describe, expect, it } from "vitest";
import { createSiteMapSource, SiteMapJsonSchema } from "../sources/site-map-source.js";
import type { UserContext } from "../types.js";

/* ━━━ Inline fixture ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const FIXTURE_SITE_MAP = {
  version: 1 as const,
  generated_at: "2026-05-14T00:00:00.000Z",
  notes: "Test fixture — do not use in production",
  routes: [
    {
      // Accessible to everyone
      path: "/dashboard",
      purpose: "Daily operations console",
      module: "Core",
      tier: 1,
      access: ["owner", "admin", "manager", "employee"],
      polished_at: "2026-05-14",
      owns_chat_surface: false,
      domain_chat_endpoint: null,
      tools: [
        { name: "getDaySnapshot", description: "Get the full day snapshot" },
        { name: "getRosterForDay", description: "Get the roster for a day" },
      ],
      common_intents: ["Hvor mange er på vakt i dag?", "Start dagen"],
    },
    {
      // Accessible to managers and above
      path: "/dashboard/schedule",
      purpose: "Plan, publiser og juster vakter for hele teamet",
      module: "Schedule",
      tier: 2,
      access: ["owner", "admin", "manager"],
      polished_at: "2026-05-14",
      owns_chat_surface: false,
      domain_chat_endpoint: null,
      tools: [
        { name: "getWeekSchedule", description: "Get the week schedule" },
        { name: "addShift", description: "Add a shift" },
        { name: "deleteShift", description: "Delete a shift" },
      ],
      common_intents: ["Vis vaktplan for neste uke"],
    },
    {
      // Admin/owner only
      path: "/dashboard/settings",
      purpose: "Workspace configuration and user management",
      module: "Settings",
      tier: 3,
      access: ["owner", "admin"],
      polished_at: "2026-05-14",
      owns_chat_surface: false,
      domain_chat_endpoint: null,
      tools: [{ name: "getSettings", description: "Get workspace settings" }],
      common_intents: [],
    },
    {
      // Employee-only (e.g. my-time)
      path: "/dashboard/my-time",
      purpose: "Employee's own shift history and time bank",
      module: "TimeBank",
      tier: 1,
      access: ["employee", "manager", "admin", "owner"],
      polished_at: "2026-05-14",
      owns_chat_surface: false,
      domain_chat_endpoint: null,
      tools: [{ name: "getMyTime", description: "Get personal time bank" }],
      common_intents: ["Vis min tidskonto"],
    },
  ],
};

const adminCtx: UserContext = {
  profile_id: "p-admin",
  workspace_id: "ws-1",
  role: "admin",
};

const employeeCtx: UserContext = {
  profile_id: "p-employee",
  workspace_id: "ws-1",
  role: "employee",
};

const managerCtx: UserContext = {
  profile_id: "p-manager",
  workspace_id: "ws-1",
  role: "manager",
};

/* ━━━ Tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("createSiteMapSource — schema validation", () => {
  it("parses a valid fixture without throwing", () => {
    expect(() => createSiteMapSource(FIXTURE_SITE_MAP)).not.toThrow();
  });

  it("throws ZodError when version is wrong", () => {
    const bad = { ...FIXTURE_SITE_MAP, version: 2 };
    expect(() => createSiteMapSource(bad)).toThrow();
  });

  it("throws ZodError when routes is missing", () => {
    const { routes: _routes, ...rest } = FIXTURE_SITE_MAP;
    expect(() => createSiteMapSource(rest)).toThrow();
  });
});

describe("getSiteMap — admin sees all routes", () => {
  it("admin receives all 4 routes (admin is in every access array)", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(adminCtx);
    expect(siteMap.routes).toHaveLength(4);
    const paths = siteMap.routes.map((r) => r.path);
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/dashboard/schedule");
    expect(paths).toContain("/dashboard/settings");
    expect(paths).toContain("/dashboard/my-time");
  });

  it("admin routes contain expected toolCount values", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(adminCtx);
    const dashboard = siteMap.routes.find((r) => r.path === "/dashboard");
    const schedule = siteMap.routes.find((r) => r.path === "/dashboard/schedule");
    const settings = siteMap.routes.find((r) => r.path === "/dashboard/settings");
    expect(dashboard?.toolCount).toBe(2);
    expect(schedule?.toolCount).toBe(3);
    expect(settings?.toolCount).toBe(1);
  });
});

describe("getSiteMap — employee filtered to subset", () => {
  it("employee receives only routes whose access includes 'employee'", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(employeeCtx);
    // /dashboard (all) and /dashboard/my-time (employee+) → 2 routes
    expect(siteMap.routes).toHaveLength(2);
    const paths = siteMap.routes.map((r) => r.path);
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/dashboard/my-time");
  });

  it("employee does NOT see schedule or settings", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(employeeCtx);
    const paths = siteMap.routes.map((r) => r.path);
    expect(paths).not.toContain("/dashboard/schedule");
    expect(paths).not.toContain("/dashboard/settings");
  });
});

describe("getSiteMap — routes outside user role are excluded", () => {
  it("manager does NOT receive the owner/admin-only settings route", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(managerCtx);
    const paths = siteMap.routes.map((r) => r.path);
    expect(paths).not.toContain("/dashboard/settings");
  });

  it("manager receives dashboard, schedule, and my-time (3 routes)", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(managerCtx);
    expect(siteMap.routes).toHaveLength(3);
  });
});

describe("getSiteMap — empty result when user has no accessible routes", () => {
  it("returns empty routes and intents without throwing", async () => {
    // Construct a fixture with only owner-access routes
    const ownerOnlyFixture = {
      ...FIXTURE_SITE_MAP,
      routes: [
        {
          path: "/dashboard/owner-panel",
          purpose: "Owner-only governance panel",
          module: "Governance",
          tier: 3,
          access: ["owner"],
          polished_at: "2026-05-14",
          owns_chat_surface: false,
          domain_chat_endpoint: null,
          tools: [],
          common_intents: [],
        },
      ],
    };
    const source = createSiteMapSource(ownerOnlyFixture);
    const siteMap = await source.getSiteMap(employeeCtx);
    expect(siteMap.routes).toHaveLength(0);
    expect(siteMap.commonIntents).toHaveLength(0);
  });
});

describe("getSiteMap — commonIntents derived from route metadata", () => {
  it("includes commonIntents from all accessible routes", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(adminCtx);
    // dashboard (2) + schedule (1) + settings (0) + my-time (1) = 4 total
    expect(siteMap.commonIntents).toHaveLength(4);
  });

  it("each commonIntent has the correct routePath", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(managerCtx);
    const scheduleIntents = siteMap.commonIntents.filter(
      (i) => i.routePath === "/dashboard/schedule",
    );
    expect(scheduleIntents).toHaveLength(1);
    expect(scheduleIntents[0]?.phrase).toBe("Vis vaktplan for neste uke");
  });

  it("employee commonIntents only include intents from accessible routes", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(employeeCtx);
    // dashboard (2) + my-time (1) = 3
    expect(siteMap.commonIntents).toHaveLength(3);
    const phrases = siteMap.commonIntents.map((i) => i.phrase);
    expect(phrases).toContain("Vis min tidskonto");
    expect(phrases).not.toContain("Vis vaktplan for neste uke");
  });
});

describe("getSiteMap — SiteMapRoute shape", () => {
  it("returns correct SiteMapRoute fields for each route", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(adminCtx);
    const dashboard = siteMap.routes.find((r) => r.path === "/dashboard");
    expect(dashboard).toMatchObject({
      path: "/dashboard",
      purpose: "Daily operations console",
      module: "Core",
      tier: 1,
      toolCount: 2,
      scope: null,
    });
  });

  it("scope is null when not present in raw route", async () => {
    const source = createSiteMapSource(FIXTURE_SITE_MAP);
    const siteMap = await source.getSiteMap(adminCtx);
    for (const route of siteMap.routes) {
      // None of the fixture routes have a scope field → all should be null
      expect(route.scope).toBeNull();
    }
  });
});

describe("SiteMapJsonSchema — exported for reuse", () => {
  it("is a ZodObject that can parse the fixture", () => {
    const result = SiteMapJsonSchema.safeParse(FIXTURE_SITE_MAP);
    expect(result.success).toBe(true);
  });
});
