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
    expect(first.label).toBe("Oversikt");
    expect(first.standalone).toBe(true);
  });

  it("has exactly 9 groups in declared order", () => {
    expect(SIDEBAR_GROUPS_ADMIN).toHaveLength(9);
    const labels = SIDEBAR_GROUPS_ADMIN.map((g) => g.label);
    expect(labels).toEqual([
      "Oversikt",
      "Drift",
      "Planlegging",
      "Administrasjon",
      "HMS & Compliance",
      "Kommunikasjon",
      "Integrasjoner",
      "AI & Botsson",
      "Veiledning",
    ]);
  });

  it("Drift's Rutiner has status not-yet-built, disabled true, href /dashboard/tasks", () => {
    const drift = SIDEBAR_GROUPS_ADMIN.find((g) => g.label === "Drift");
    expect(drift).toBeDefined();
    const rutiner = drift!.items.find((i) => i.href === "/dashboard/tasks");
    expect(rutiner).toBeDefined();
    expect(rutiner!.status).toBe("not-yet-built");
    expect(rutiner!.disabled).toBe(true);
  });

  it("HMS group has 8 items including Handbok", () => {
    const hms = SIDEBAR_GROUPS_ADMIN.find((g) => g.label === "HMS & Compliance");
    expect(hms).toBeDefined();
    expect(hms!.items).toHaveLength(8);
    const handbook = hms!.items.find((i) => i.href === "/dashboard/handbook");
    expect(handbook).toBeDefined();
    expect(handbook!.label).toBe("Handbok");
  });

  it("every item has label, href starting with /, and valid status", () => {
    for (const group of SIDEBAR_GROUPS_ADMIN) {
      for (const item of group.items) {
        expect(item.label).toBeTruthy();
        expect(item.href).toMatch(/^\//);
        expect(VALID_STATUSES).toContain(item.status);
      }
    }
  });

  it("AI group Mr. Botsson has featureFlag AI_CHAT and ai: true", () => {
    const aiGroup = SIDEBAR_GROUPS_ADMIN.find((g) => g.label === "AI & Botsson");
    expect(aiGroup).toBeDefined();
    const botsson = aiGroup!.items.find((i) => i.href === "/dashboard/ai");
    expect(botsson).toBeDefined();
    expect(botsson!.featureFlag).toBe("AI_CHAT");
    expect(botsson!.ai).toBe(true);
  });

  it("Ansatte item has compositeActive containing /dashboard/contracts", () => {
    const drift = SIDEBAR_GROUPS_ADMIN.find((g) => g.label === "Drift");
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
    const minTid = SIDEBAR_GROUPS_EMPLOYEE.find((g) => g.label === "Min Tid");
    expect(minTid).toBeDefined();
    const stempelur = minTid!.items.find((i) => i.href === "/dashboard/shift-clock");
    expect(stempelur).toBeDefined();
    expect(stempelur!.label).toBe("Stempelur");
  });

  it("every item has label, href starting with /, and valid status", () => {
    for (const group of SIDEBAR_GROUPS_EMPLOYEE) {
      for (const item of group.items) {
        expect(item.label).toBeTruthy();
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
    expect(showcase.label).toBe("Showcase");
    const hrefs = showcase.items.map((i) => i.href);
    expect(hrefs).toContain("/dashboard/schedule"); // Templates
    expect(hrefs).toContain("/dashboard/reports"); // Analytics
  });
});
