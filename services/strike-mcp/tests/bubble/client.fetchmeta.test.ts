import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BubbleClient } from "../../src/bubble/client.js";
import { BubbleAuthError } from "../../src/bubble/errors.js";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(__dirname, "..", "fixtures", name), "utf-8"));
}

describe("BubbleClient.fetchMeta", () => {
  it("returns parsed schema from /api/1.1/meta", async () => {
    const fixture = loadFixture("bubble_meta.json");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://smartout.bubbleapps.io", bubbleApiToken: "tok" },
      fetchSpy,
    );
    const meta = await client.fetchMeta();

    expect(meta.get.workspace).toBeDefined();
    expect(meta.get.workspace.fields.name_text.display).toBe("Name");
    expect(meta.get.shift_satellite.fields["date_start_date"].display).toBe("date.start 🟢");
  });

  it("hits /api/1.1/meta with Bearer auth", async () => {
    const fixture = loadFixture("bubble_meta.json");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://smartout.bubbleapps.io", bubbleApiToken: "my-secret" },
      fetchSpy,
    );
    await client.fetchMeta();

    const call = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe("https://smartout.bubbleapps.io/api/1.1/meta");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer my-secret");
  });

  it("throws BubbleAuthError on 401", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status: 401 })) as unknown as typeof fetch;
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      fetchSpy,
    );
    await expect(client.fetchMeta()).rejects.toBeInstanceOf(BubbleAuthError);
  });
});
