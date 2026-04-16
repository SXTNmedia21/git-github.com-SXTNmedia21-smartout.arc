import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "../request-id.js";

describe("requestIdMiddleware", () => {
  it("generates UUID when no header supplied + sets response header", async () => {
    const app = new Hono();
    app.use(requestIdMiddleware);
    app.get("/", (c) => c.text((c.get("requestId" as never) as string) ?? ""));
    const res = await app.request("/");
    const body = await res.text();
    expect(body).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("x-request-id")).toBe(body);
  });

  it("honors incoming x-request-id header", async () => {
    const app = new Hono();
    app.use(requestIdMiddleware);
    app.get("/", (c) => c.text((c.get("requestId" as never) as string) ?? ""));
    const res = await app.request("/", { headers: { "x-request-id": "req_incoming" } });
    expect(await res.text()).toBe("req_incoming");
    expect(res.headers.get("x-request-id")).toBe("req_incoming");
  });

  it("ignores malicious oversize incoming header (>200 chars) and generates fresh UUID", async () => {
    const app = new Hono();
    app.use(requestIdMiddleware);
    app.get("/", (c) => c.text((c.get("requestId" as never) as string) ?? ""));
    const huge = "a".repeat(500);
    const res = await app.request("/", { headers: { "x-request-id": huge } });
    const body = await res.text();
    expect(body).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).not.toBe(huge);
  });
});
