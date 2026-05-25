import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
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

    // Non-null assertion: expect() above guarantees impl is defined; TypeScript
    // cannot narrow through expect(), so we assert explicitly.
    const result = await impl!({});
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

/**
 * DayControlToolsBridge component — static contract assertions.
 *
 * WHY static analysis instead of a mount test:
 * vitest is configured with environment:"node" (vitest.config.ts) and
 * @testing-library/react is not installed (apps/web/package.json). Mounting
 * a React component that uses useEffect (via useRegisterTools) requires a DOM
 * renderer — neither jsdom nor happy-dom is available in this vitest env.
 *
 * react-dom/server renderToStaticMarkup IS available but does NOT run useEffect,
 * so "useRegisterTools called on mount" cannot be asserted via server render.
 *
 * Path B (chosen): read the bridge source file and assert the literal call
 * `useRegisterTools("day-control",` is present. This validates the contract at
 * the source level — any refactor that changes the source key breaks this test.
 *
 * Limitation: does not prove the hook fires at runtime. If a DOM renderer is
 * added in a future sortie, replace this block with a renderHook assertion.
 * See G20 in docs/domains/day-session/GAPS-AND-DEBT.md for the upgrade path.
 */
describe("DayControlToolsBridge component", () => {
  // Resolve the bridge source relative to this test file's __dirname equivalent.
  // Using import.meta.url would require ESM config; resolve() from the known
  // monorepo structure is robust for the node vitest environment.
  const BRIDGE_SOURCE = resolve(__dirname, "..", "day-control-tools-bridge.tsx");

  it("source calls useRegisterTools with source key 'day-control' (static contract)", () => {
    // Read the bridge TypeScript source as plain text.
    const src = readFileSync(BRIDGE_SOURCE, "utf-8");

    // Assert the ADR-0282 canonical registration call is present in the source.
    // The literal `useRegisterTools("day-control",` must appear — any rename of
    // the source key or removal of the call will fail this assertion.
    expect(src).toContain('useRegisterTools("day-control",');
  });

  it("source imports useRegisterTools from the tool-registry (static contract)", () => {
    const src = readFileSync(BRIDGE_SOURCE, "utf-8");

    // Verify the import binding exists, confirming the function is not shadowed
    // by a local re-implementation that bypasses the registry singleton.
    expect(src).toContain(
      'import { useRegisterTools } from "@/app/Botsson/_components/tool-registry"',
    );
  });

  it("source returns null (mount-only side-effect component, no visual output)", () => {
    const src = readFileSync(BRIDGE_SOURCE, "utf-8");

    // Bridge must be a pure side-effect component per ADR-0282 pattern.
    // renderToStaticMarkup would return "" — this assertion is the source-level proxy.
    expect(src).toContain("return null");
  });
});
