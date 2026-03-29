import { describe, expect, it } from "vitest";
import {
  buildPostBootstrapRoute,
  buildSetupSummaryItems,
  buildWorkspaceFinalizationRequest,
} from "../lib/finalization";

describe("buildWorkspaceFinalizationRequest", () => {
  it("uses finalize-workspace for onboarding shells", () => {
    const request = buildWorkspaceFinalizationRequest("ws_123", {
      name: "Nordic Bistro",
      departments: [{ name: "Kjøkken", positions: ["Kokk"] }],
    });

    expect(request).toEqual({
      functionName: "finalize-workspace",
      body: {
        workspaceId: "ws_123",
        workspaceData: {
          name: "Nordic Bistro",
          departments: [{ name: "Kjøkken", positions: ["Kokk"] }],
        },
      },
    });
  });

  it("falls back to activate-workspace for legacy paths", () => {
    const request = buildWorkspaceFinalizationRequest(null, {
      name: "Nordic Bistro",
    });

    expect(request).toEqual({
      functionName: "activate-workspace",
      body: {
        workspaceData: {
          name: "Nordic Bistro",
        },
      },
    });
  });
});

describe("buildPostBootstrapRoute", () => {
  it("routes finalized workspaces into dashboard setup on subdomains", () => {
    expect(buildPostBootstrapRoute("nordic", "smartout.ai")).toBe(
      "https://nordic.smartout.ai/dashboard/setup",
    );
  });

  it("routes locally into dashboard setup", () => {
    expect(buildPostBootstrapRoute(null, "localhost")).toBe("/dashboard/setup");
  });
});

describe("buildSetupSummaryItems", () => {
  it("summarizes setup without contract cards", () => {
    const items = buildSetupSummaryItems({
      businessName: "Nordic Bistro",
      businessIndustry: "Restaurant",
      businessCity: "Oslo",
      seasonName: "Sommer 2026",
      seasonStartDate: "2026-06-01",
      seasonEndDate: "2026-08-31",
      departmentNames: ["Kjøkken", "Sal"],
      locationNames: ["Hovedrestaurant"],
      zoneCount: 3,
      procedureNames: ["Åpning", "Stenging"],
    });

    expect(items.map((item) => item.label)).toEqual([
      "Nordic Bistro",
      "Sommer 2026",
      "2 avdelinger",
      "1 lokasjon",
      "2 prosedyrer",
    ]);
  });
});
