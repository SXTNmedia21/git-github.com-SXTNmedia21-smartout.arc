import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "../request-id.js";
import type { AppEnv } from "../../types/app-env.js";

describe("requestIdMiddleware", () => {
  const makeApp = () => {
    const app = new Hono<AppEnv>();
    app.use(requestIdMiddleware);
    app.get("/", (c) => c.text(c.get("requestId") ?? ""));
    return app;
  };

  it("generates UUID when no header supplied + sets response header", async () => {
    const app = makeApp();
    const res = await app.request("/");
    const body = await res.text();
    expect(body).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("x-request-id")).toBe(body);
  });

  it("honors incoming x-request-id header", async () => {
    const app = makeApp();
    const res = await app.request("/", { headers: { "x-request-id": "req_incoming" } });
    expect(await res.text()).toBe("req_incoming");
    expect(res.headers.get("x-request-id")).toBe("req_incoming");
  });

  it("ignores oversize incoming header (>200 chars) and generates fresh UUID", async () => {
    const app = makeApp();
    const huge = "a".repeat(500);
    const res = await app.request("/", { headers: { "x-request-id": huge } });
    const body = await res.text();
    expect(body).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).not.toBe(huge);
    expect(res.headers.get("x-request-id")).toBe(body);
  });

  it("rejects incoming header with control chars and generates fresh UUID", async () => {
    // Note: undici's Headers rejects CR/LF/NUL at the HTTP layer before middleware
    // runs. This test covers other control chars (0x01-0x1f, 0x7f) that can slip
    // through Headers validation and must be defended against in middleware.
    const app = makeApp();
    const res = await app.request("/", { headers: { "x-request-id": "abc\x01evil" } });
    const body = await res.text();
    expect(body).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).not.toContain("evil");
  });

  it("treats empty-string incoming header as missing, generates fresh UUID", async () => {
    const app = makeApp();
    const res = await app.request("/", { headers: { "x-request-id": "" } });
    const body = await res.text();
    expect(body).toMatch(/^[0-9a-f-]{36}$/);
  });
});
