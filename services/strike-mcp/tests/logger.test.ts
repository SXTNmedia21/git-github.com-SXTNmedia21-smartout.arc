import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../src/logger.js";

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it("writes info messages to stderr, not stdout", () => {
    const log = createLogger("test");
    log.info("hello");
    expect(stderrSpy).toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("includes the scope name in the output", () => {
    const log = createLogger("bubble-client");
    log.info("fetching");
    const call = stderrSpy.mock.calls[0]?.[0]?.toString() ?? "";
    expect(call).toContain("bubble-client");
    expect(call).toContain("fetching");
  });

  it("serializes structured fields", () => {
    const log = createLogger("test");
    log.info("event", { count: 42, name: "alpha" });
    const call = stderrSpy.mock.calls[0]?.[0]?.toString() ?? "";
    expect(call).toContain("count=42");
    expect(call).toContain('name="alpha"');
  });

  it("has warn and error methods that also go to stderr", () => {
    const log = createLogger("test");
    log.warn("careful");
    log.error("broken");
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
