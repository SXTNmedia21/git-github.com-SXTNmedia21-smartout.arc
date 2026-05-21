import { isShiftActiveForTasks } from "../shift-task-visibility";

describe("isShiftActiveForTasks", () => {
  it("shows tasks for scheduled (pre-shift prep) and clocked_in", () => {
    expect(isShiftActiveForTasks("scheduled")).toBe(true);
    expect(isShiftActiveForTasks("clocked_in")).toBe(true);
  });
  it("hides tasks for clocked_out and cancelled", () => {
    expect(isShiftActiveForTasks("clocked_out")).toBe(false);
    expect(isShiftActiveForTasks("cancelled")).toBe(false);
  });
  it("hides when status undefined/null (no shift)", () => {
    expect(isShiftActiveForTasks(undefined)).toBe(false);
    expect(isShiftActiveForTasks(null)).toBe(false);
  });
});
