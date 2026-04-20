import { describe, it, expect, vi } from "vitest";
import { BubbleClient } from "../../src/bubble/client.js";

describe("BubbleClient.sampleBidirectional", () => {
  it("returns first N + last N records for a large collection", async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      const u = new URL(url as string);
      const cursor = Number(u.searchParams.get("cursor"));
      const limit = Number(u.searchParams.get("limit"));
      if (cursor === 0) {
        return new Response(
          JSON.stringify({
            response: {
              results: Array.from({ length: limit }, (_, i) => ({ _id: `first-${i}` })),
              cursor: 0,
              count: limit,
              remaining: 1000 - limit,
            },
          }),
          { status: 200 },
        );
      }
      if (cursor === 950) {
        return new Response(
          JSON.stringify({
            response: {
              results: Array.from({ length: 50 }, (_, i) => ({ _id: `last-${i}` })),
              cursor: 950,
              count: 50,
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
      fetchSpy,
    );
    const sample = await client.sampleBidirectional("shift_satellite", 50);

    expect(sample.totalCount).toBe(1000);
    expect(sample.firstN).toHaveLength(50);
    expect(sample.lastN).toHaveLength(50);
    expect(sample.firstN[0]._id).toBe("first-0");
    expect(sample.lastN[0]._id).toBe("last-0");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns a single set and empty lastN when the collection is smaller than n", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          response: {
            results: [{ _id: "a" }, { _id: "b" }, { _id: "c" }],
            cursor: 0,
            count: 3,
            remaining: 0,
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      fetchSpy,
    );
    const sample = await client.sampleBidirectional("workspace", 50);

    expect(sample.totalCount).toBe(3);
    expect(sample.firstN).toHaveLength(3);
    expect(sample.lastN).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns empty when the collection has zero records", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          response: { results: [], cursor: 0, count: 0, remaining: 0 },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      fetchSpy,
    );
    const sample = await client.sampleBidirectional("empty_type", 50);

    expect(sample.totalCount).toBe(0);
    expect(sample.firstN).toEqual([]);
    expect(sample.lastN).toEqual([]);
  });
});
