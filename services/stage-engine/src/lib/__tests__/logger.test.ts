/**
 * logger.test.ts
 * Verifies pino logger factory: base logger exposes standard level methods,
 * and childLogger binds context (requestId) to every log line.
 *
 * We stub NODE_ENV=production so pino emits JSON to stdout synchronously
 * instead of piping through the pino-pretty worker thread (which would not
 * be intercepted by spying on process.stdout.write).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    // Force JSON output (no pino-pretty worker) so spy on stdout captures the line.
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("baseLogger exposes info/warn/error methods", async () => {
    const { baseLogger } = await import("../logger.js");
    expect(typeof baseLogger.info).toBe("function");
    expect(typeof baseLogger.warn).toBe("function");
    expect(typeof baseLogger.error).toBe("function");
  });

  it("childLogger binds requestId to every log line", async () => {
    const { childLogger } = await import("../logger.js");
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const log = childLogger({ requestId: "req_abc123" });
    log.info("hello");
    const output = spy.mock.calls.map((c) => String(c[0])).join("");
    expect(output).toContain("req_abc123");
    expect(output).toContain("hello");
    spy.mockRestore();
  });
});
