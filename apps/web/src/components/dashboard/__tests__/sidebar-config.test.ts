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

  it("has exactly 9 groups in declared order", () => {
    expect(SIDEBAR_GROUPS_ADMIN).toHaveLength(9);
    const labelKeys = SIDEBAR_GROUPS_ADMIN.map((g) => g.labelKey);
    expect(labelKeys).toEqual([
      "sidebar.group_oversikt",
      "sidebar.group_drift",
      "sidebar.group_planlegging",
      "sidebar.group_administrasjon",
      "sidebar.group_hms_compliance",
      "sidebar.group_kommunikasjon",
      "sidebar.group_integrasjoner",
      "sidebar.group_ai_botsson",
      "sidebar.group_veiledning",
    ]);
  });

  it("Drift's Rutiner has status not-yet-built, disabled true, href /dashboard/tasks", () => {
    const drift = SIDEBAR_GROUPS_ADMIN.find((g) => g.labelKey === "sidebar.group_drift");
    expect(drift).toBeDefined();
    const rutiner = drift!.items.find((i) => i.href === "/dashboard/tasks");
    expect(rutiner).toBeDefined();
    expect(rutiner!.status).toBe("not-yet-built");
    expect(rutiner!.disabled).toBe(true);
  });

  it("HMS group has 8 items including Handbok", () => {
    const hms = SIDEBAR_GROUPS_ADMIN.find((g) => g.labelKey === "sidebar.group_hms_compliance");
    expect(hms).toBeDefined();
    expect(hms!.items).toHaveLength(8);
    const handbook = hms!.items.find((i) => i.href === "/dashboard/handbook");
    expect(handbook).toBeDefined();
    expect(handbook!.labelKey).toBe("sidebar.item_handbok");
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

  it("AI group Mr. Botsson has featureFlag AI_CHAT and ai: true", () => {
    const aiGroup = SIDEBAR_GROUPS_ADMIN.find((g) => g.labelKey === "sidebar.group_ai_botsson");
    expect(aiGroup).toBeDefined();
    const botsson = aiGroup!.items.find((i) => i.href === "/dashboard/ai");
    expect(botsson).toBeDefined();
    expect(botsson!.featureFlag).toBe("AI_CHAT");
    expect(botsson!.ai).toBe(true);
  });

  it("Ansatte item has compositeActive containing /dashboard/contracts", () => {
    const drift = SIDEBAR_GROUPS_ADMIN.find((g) => g.labelKey === "sidebar.group_drift");
    expect(drift).toBeDefined();
    const ansatte = drift!.items.find((i) => i.href === "/dashboard/people");
    expect(ansatte).toBeDefined();
    expect(ansatte!.compositeActive).toContain("/dashboard/contracts");
  });
});

describe("SIDEBAR_GROUPS_EMPLOYEE", () => {
  it("has exactly 3 groups", () => {
    expect(SIDEBAR_GROUPS_EMPLOYEE).toHaveLength(3);
  });

  it("Min Tid group contains Stempelur with href /dashboard/shift-clock", () => {
    const minTid = SIDEBAR_GROUPS_EMPLOYEE.find((g) => g.labelKey === "sidebar.group_min_tid");
    expect(minTid).toBeDefined();
    const stempelur = minTid!.items.find((i) => i.href === "/dashboard/shift-clock");
    expect(stempelur).toBeDefined();
    expect(stempelur!.labelKey).toBe("sidebar.item_stempelur");
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
