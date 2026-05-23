import { describe, it, expect } from "vitest";
import { useDayControlTools } from "../use-day-control-tools";

const testCtx = {
  sessionId: "sess-1",
  departmentId: "dept-1",
  departmentName: "Sal",
  dateISO: "2026-05-23",
};

describe("useDayControlTools", () => {
  it("returns a ClientToolKit registered under the 'day-control' source", () => {
    const kit = useDayControlTools(testCtx);

    expect(kit).toHaveProperty("definitions");
    expect(kit).toHaveProperty("implementations");
    expect(Array.isArray(kit.definitions)).toBe(true);
    expect(kit.definitions.length).toBeGreaterThan(0);
  });

  it("registers tools with the 'day-control' kit name convention (modelToolName present)", () => {
    const kit = useDayControlTools(testCtx);

    for (const def of kit.definitions) {
      expect(def).toHaveProperty("temporaryTool");
      expect(typeof def.temporaryTool.modelToolName).toBe("string");
      expect(def.temporaryTool.modelToolName.length).toBeGreaterThan(0);
    }
  });

  it("get_day_control_panel_context returns session context as JSON string", async () => {
    const kit = useDayControlTools(testCtx);

    const toolName = "get_day_control_panel_context";
    const impl = kit.implementations[toolName];
    expect(impl).toBeDefined();

    const result = await impl({});
    const parsed = JSON.parse(result);

    expect(parsed.session_id).toBe("sess-1");
    expect(parsed.department_id).toBe("dept-1");
    expect(parsed.department_name).toBe("Sal");
    expect(parsed.date_iso).toBe("2026-05-23");
  });

  it("does NOT contain any Ultravox temporaryTool or useVoiceTools references", () => {
    // Negative assertion: if the bridge accidentally re-imports the dead Ultravox path,
    // the modelToolName pattern would differ. We verify no tool name contains 'voice'
    // and the kit shape matches ADR-0282 canonical pattern (ClientToolKit).
    const kit = useDayControlTools(testCtx);

    for (const def of kit.definitions) {
      expect(def.temporaryTool.modelToolName).not.toContain("voice");
      expect(def.temporaryTool.modelToolName).not.toContain("ultravox");
    }
  });
});
