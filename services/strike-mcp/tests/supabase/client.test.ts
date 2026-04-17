import { describe, it, expect, vi } from "vitest";
import { SupabaseReadClient } from "../../src/supabase/client.js";

describe("SupabaseReadClient.count", () => {
  it("returns the count from PostgREST Content-Range header", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-range": "0-0/42",
        },
      });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "key" },
      fetchSpy,
    );
    const count = await client.count("workspaces", { slug: "alpha" });
    expect(count).toBe(42);
  });

  it("returns 0 when range header reports zero", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-range": "*/0" },
      });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "key" },
      fetchSpy,
    );
    const count = await client.count("workspaces", { slug: "missing" });
    expect(count).toBe(0);
  });

  it("sends auth headers and Prefer: count=exact", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-range": "*/0" },
      });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "secret-key" },
      fetchSpy,
    );
    await client.count("workspaces", { slug: "alpha" });

    const init = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["apikey"]).toBe("secret-key");
    expect(headers["Authorization"]).toBe("Bearer secret-key");
    expect(headers["Prefer"]).toContain("count=exact");
  });

  it("builds the URL with eq filter", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-range": "*/0" },
      });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "k" },
      fetchSpy,
    );
    await client.count("workspaces", { slug: "alpha" });

    const url = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/rest/v1/workspaces");
    expect(url).toContain("slug=eq.alpha");
    expect(url).toContain("select=*");
  });

  it("throws on non-2xx response", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response("nope", { status: 401 });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "k" },
      fetchSpy,
    );
    await expect(client.count("workspaces", {})).rejects.toThrow(/401/);
  });
});
