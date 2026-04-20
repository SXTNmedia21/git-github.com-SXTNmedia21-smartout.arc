export interface SupabaseClientConfig {
  url: string;       // e.g. https://abc.supabase.co
  anonKey: string;   // anon (read-only) key
}

export class SupabaseReadClient {
  private readonly config: SupabaseClientConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SupabaseClientConfig, fetchImpl: typeof fetch = globalThis.fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  /**
   * Count rows in a table matching equality filters.
   * Uses PostgREST count=exact via the Prefer header.
   */
  async count(table: string, filters: Record<string, string>): Promise<number> {
    const params = new URLSearchParams();
    params.set("select", "*");
    for (const [key, value] of Object.entries(filters)) {
      params.set(key, `eq.${value}`);
    }
    const url = `${this.config.url}/rest/v1/${encodeURIComponent(table)}?${params.toString()}`;

    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        apikey: this.config.anonKey,
        Authorization: `Bearer ${this.config.anonKey}`,
        Prefer: "count=exact",
        "Range-Unit": "items",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
    }

    const range = res.headers.get("content-range") ?? "";
    const total = range.split("/")[1] ?? "0";
    return parseInt(total, 10) || 0;
  }
}
