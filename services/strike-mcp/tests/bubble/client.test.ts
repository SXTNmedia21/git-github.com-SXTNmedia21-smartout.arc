import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BubbleClient } from "../../src/bubble/client.js";
import { BubbleAuthError, BubbleApiError } from "../../src/bubble/errors.js";

function loadFixture(name: string): unknown {
  const path = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function mockFetch(
  response: { status: number; body: unknown },
): typeof fetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("BubbleClient.listType", () => {
  it("fetches records and returns results + cursor metadata", async () => {
    const fixture = loadFixture("bubble_list_workspaces.json");
    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "tok",
      },
      mockFetch({ status: 200, body: fixture }),
    );

    const page = await client.listType("workspace", { cursor: 0, limit: 100 });

    expect(page.results).toHaveLength(2);
    expect(page.results[0]._id).toBe("1612345678901x111111111111111111");
    expect(page.cursor).toBe(0);
    expect(page.count).toBe(2);
    expect(page.remaining).toBe(0);
  });

  it("sends the Bearer token in the Authorization header", async () => {
    const fixture = loadFixture("bubble_list_empty.json");
    const spy = vi.fn(async () => {
      return new Response(JSON.stringify(fixture), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "my-secret",
      },
      spy,
    );
    await client.listType("workspace", { cursor: 0, limit: 100 });

    const call = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as RequestInit;
    expect(init.headers).toBeDefined();
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer my-secret");
  });

  it("builds the correct URL with cursor and limit params", async () => {
    const fixture = loadFixture("bubble_list_empty.json");
    const spy = vi.fn(async () => {
      return new Response(JSON.stringify(fixture), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "tok",
      },
      spy,
    );
    await client.listType("shift_satellite", { cursor: 200, limit: 50 });

    const url = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/api/1.1/obj/shift_satellite");
    expect(url).toContain("cursor=200");
    expect(url).toContain("limit=50");
  });

  it("throws BubbleAuthError on 401", async () => {
    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "tok",
      },
      mockFetch({ status: 401, body: { error: "invalid token" } }),
    );
    await expect(
      client.listType("workspace", { cursor: 0, limit: 100 }),
    ).rejects.toBeInstanceOf(BubbleAuthError);
  });

  it("throws BubbleApiError on 500", async () => {
    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "tok",
      },
      mockFetch({ status: 500, body: { error: "boom" } }),
    );
    await expect(
      client.listType("workspace", { cursor: 0, limit: 100 }),
    ).rejects.toBeInstanceOf(BubbleApiError);
  });
});

describe("BubbleClient.listAll", () => {
  it("follows pagination until remaining is 0", async () => {
    let callCount = 0;
    const spy = vi.fn(async (url: string) => {
      callCount++;
      const urlObj = new URL(url as string);
      const cursor = Number(urlObj.searchParams.get("cursor"));
      if (cursor === 0) {
        return new Response(
          JSON.stringify({
            response: {
              results: [{ _id: "a" }, { _id: "b" }],
              cursor: 0,
              count: 2,
              remaining: 2,
            },
          }),
          { status: 200 },
        );
      }
      if (cursor === 2) {
        return new Response(
          JSON.stringify({
            response: {
              results: [{ _id: "c" }, { _id: "d" }],
              cursor: 2,
              count: 2,
              remaining: 0,
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      spy,
    );
    const all = await client.listAll("shift_satellite", {});

    expect(all).toHaveLength(4);
    expect(all.map((r) => r._id)).toEqual(["a", "b", "c", "d"]);
    expect(callCount).toBe(2);
  });

  it("stops at maxRecords if provided", async () => {
    const spy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          response: {
            results: Array.from({ length: 100 }, (_, i) => ({ _id: `r${i}` })),
            cursor: 0,
            count: 100,
            remaining: 900,
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      spy,
    );
    const limited = await client.listAll("shift_satellite", { maxRecords: 100 });

    expect(limited).toHaveLength(100);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when there are no records", async () => {
    const spy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          response: { results: [], cursor: 0, count: 0, remaining: 0 },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      spy,
    );
    const all = await client.listAll("workspace", {});
    expect(all).toEqual([]);
  });
});
