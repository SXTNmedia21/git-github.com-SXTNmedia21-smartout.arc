/**
 * sidebar-config.test.ts
 * Unit tests for SIDEBAR_GROUPS_ADMIN, SIDEBAR_GROUPS_EMPLOYEE, SIDEBAR_GROUPS_DEMO.
 * Pure data — no React, no DOM.
 */
import { describe, it, expect } from "vitest";
import {
  SIDEBAR_GROUPS_ADMIN,
  SIDEBAR_GROUPS_EMPLOYEE,
  SIDEBAR_GROUPS_DEMO,
  type SidebarItemStatus,
} from "../sidebar-config";

const VALID_STATUSES: SidebarItemStatus[] = ["live", "linked-orphan", "not-yet-built"];

describe("SIDEBAR_GROUPS_ADMIN", () => {
  it("first group is Oversikt with standalone: true", () => {
    const first = SIDEBAR_GROUPS_ADMIN[0]!;
    expect(first).toBeDefined();
    expect(first.labelKey).toBe("sidebar.group_oversikt");
    expect(first.standalone).toBe(true);
  });

  it("has exactly 11 groups in declared order", () => {
    expect(SIDEBAR_GROUPS_ADMIN).toHaveLength(11);
    const labelKeys = SIDEBAR_GROUPS_ADMIN.map((g) => g.labelKey);
    expect(labelKeys).toEqual([
      "sidebar.group_oversikt",
      "sidebar.group_oppgaver",
      "sidebar.group_planlegging",
      "sidebar.group_vaktplan",
      "sidebar.group_ansatte",
      "sidebar.group_hms",
      "sidebar.group_lonn",
      "sidebar.group_avstemming",
      "sidebar.group_rapporter",
      "sidebar.group_chat",
      "sidebar.group_kommunikasjon",
    ]);
  });

  it("Oppgaver has status not-yet-built, disabled true, href /dashboard/tasks", () => {
    const oppgaver = SIDEBAR_GROUPS_ADMIN.find((g) => g.labelKey === "sidebar.group_oppgaver");
    expect(oppgaver).toBeDefined();
    const item = oppgaver!.items.find((i) => i.href === "/dashboard/tasks");
    expect(item).toBeDefined();
    expect(item!.status).toBe("not-yet-built");
    expect(item!.disabled).toBe(true);
  });

  it("HMS group has /dashboard/hms with compositeActive containing /dashboard/handbook", () => {
    const hms = SIDEBAR_GROUPS_ADMIN.find((g) => g.labelKey === "sidebar.group_hms");
    expect(hms).toBeDefined();
    const hmsItem = hms!.items.find((i) => i.href === "/dashboard/hms");
    expect(hmsItem).toBeDefined();
    expect(hmsItem!.compositeActive).toContain("/dashboard/handbook");
    expect(hmsItem!.compositeActive).toContain("/dashboard/policies");
  });

  it("every item has labelKey, href starting with /, and valid status", () => {
    for (const group of SIDEBAR_GROUPS_ADMIN) {
      for (const item of group.items) {
        expect(item.labelKey).toBeTruthy();
        expect(item.href).toMatch(/^\//);
        expect(VALID_STATUSES).toContain(item.status);
      }
    }
  });

  it("Lonn item has compositeActive containing /dashboard/cost and /dashboard/billing", () => {
    const lonn = SIDEBAR_GROUPS_ADMIN.find((g) => g.labelKey === "sidebar.group_lonn");
    expect(lonn).toBeDefined();
    const lonnItem = lonn!.items.find((i) => i.href === "/dashboard/payroll");
    expect(lonnItem).toBeDefined();
    expect(lonnItem!.compositeActive).toContain("/dashboard/cost");
    expect(lonnItem!.compositeActive).toContain("/dashboard/billing");
  });

  it("Planlegging item has compositeActive containing /dashboard/calendar", () => {
    const planlegging = SIDEBAR_GROUPS_ADMIN.find(
      (g) => g.labelKey === "sidebar.group_planlegging",
    );
    expect(planlegging).toBeDefined();
    const planItem = planlegging!.items.find((i) => i.href === "/dashboard/planning");
    expect(planItem).toBeDefined();
    expect(planItem!.compositeActive).toContain("/dashboard/calendar");
  });
});

describe("SIDEBAR_GROUPS_EMPLOYEE", () => {
  it("has exactly 10 groups", () => {
    expect(SIDEBAR_GROUPS_EMPLOYEE).toHaveLength(10);
  });

  it("Stempelur group contains /dashboard/shift-clock", () => {
    const stempelur = SIDEBAR_GROUPS_EMPLOYEE.find((g) => g.labelKey === "sidebar.group_stempelur");
    expect(stempelur).toBeDefined();
    const item = stempelur!.items.find((i) => i.href === "/dashboard/shift-clock");
    expect(item).toBeDefined();
    expect(item!.labelKey).toBe("sidebar.item_stempelur");
  });

  it("every item has labelKey, href starting with /, and valid status", () => {
    for (const group of SIDEBAR_GROUPS_EMPLOYEE) {
      for (const item of group.items) {
        expect(item.labelKey).toBeTruthy();
        expect(item.href).toMatch(/^\//);
        expect(VALID_STATUSES).toContain(item.status);
      }
    }
  });
});

describe("SIDEBAR_GROUPS_DEMO", () => {
  it("starts with Showcase group containing Templates and Analytics", () => {
    const showcase = SIDEBAR_GROUPS_DEMO[0]!;
    expect(showcase).toBeDefined();
    expect(showcase.labelKey).toBe("sidebar.group_showcase");
    const hrefs = showcase.items.map((i) => i.href);
    expect(hrefs).toContain("/dashboard/schedule"); // Templates
    expect(hrefs).toContain("/dashboard/reports"); // Analytics
  });
});
