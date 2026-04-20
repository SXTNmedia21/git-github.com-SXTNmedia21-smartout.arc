import { createLogger } from "../logger.js";
import type { Config } from "../config.js";
import type {
  BubbleListResponse,
  BubbleRecord,
  BubbleConstraint,
  BubbleMetaResponse,
} from "./types.js";
import { bubbleErrorFromResponse } from "./errors.js";

const log = createLogger("bubble-client");

export interface ListPage {
  results: BubbleRecord[];
  cursor: number;
  count: number;
  remaining: number;
}

export interface ListOptions {
  cursor: number;
  limit: number;
  constraints?: BubbleConstraint[];
}

export interface ListAllOptions {
  constraints?: BubbleConstraint[];
  pageSize?: number;
  maxRecords?: number;
}

export interface BidirectionalSample {
  firstN: BubbleRecord[];
  lastN: BubbleRecord[];
  totalCount: number;
}

export class BubbleClient {
  private readonly config: Config;
  private readonly fetchImpl: typeof fetch;

  constructor(config: Config, fetchImpl: typeof fetch = globalThis.fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async listType(bubbleType: string, opts: ListOptions): Promise<ListPage> {
    const url = this.buildListUrl(bubbleType, opts);
    log.info("list request", {
      type: bubbleType,
      cursor: opts.cursor,
      limit: opts.limit,
    });

    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.bubbleApiToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await this.safeJson(res);
      throw bubbleErrorFromResponse(res.status, body);
    }

    const json = (await res.json()) as BubbleListResponse;
    return {
      results: json.response.results,
      cursor: json.response.cursor,
      count: json.response.count,
      remaining: json.response.remaining,
    };
  }

  async listAll(
    bubbleType: string,
    opts: ListAllOptions,
  ): Promise<BubbleRecord[]> {
    const pageSize = opts.pageSize ?? 100;
    const out: BubbleRecord[] = [];
    let cursor = 0;

    while (true) {
      const page = await this.listType(bubbleType, {
        cursor,
        limit: pageSize,
        constraints: opts.constraints,
      });
      out.push(...page.results);

      if (opts.maxRecords !== undefined && out.length >= opts.maxRecords) {
        return out.slice(0, opts.maxRecords);
      }
      if (page.remaining <= 0 || page.results.length === 0) {
        return out;
      }
      cursor += page.results.length;
    }
  }

  async sampleBidirectional(
    bubbleType: string,
    n: number,
    opts: { constraints?: BubbleConstraint[] } = {},
  ): Promise<BidirectionalSample> {
    const first = await this.listType(bubbleType, {
      cursor: 0,
      limit: n,
      constraints: opts.constraints,
    });
    const totalCount = first.cursor + first.results.length + first.remaining;

    if (first.remaining === 0) {
      return { firstN: first.results, lastN: [], totalCount };
    }

    const lastCursor = Math.max(0, totalCount - n);
    const last = await this.listType(bubbleType, {
      cursor: lastCursor,
      limit: n,
      constraints: opts.constraints,
    });
    return { firstN: first.results, lastN: last.results, totalCount };
  }

  async fetchMeta(): Promise<BubbleMetaResponse> {
    const url = `${this.config.bubbleAppUrl}/api/1.1/meta`;
    log.info("meta request", { url });

    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.bubbleApiToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await this.safeJson(res);
      throw bubbleErrorFromResponse(res.status, body);
    }

    return (await res.json()) as BubbleMetaResponse;
  }

  private buildListUrl(bubbleType: string, opts: ListOptions): string {
    const params = new URLSearchParams();
    params.set("cursor", String(opts.cursor));
    params.set("limit", String(opts.limit));
    if (opts.constraints && opts.constraints.length > 0) {
      params.set("constraints", JSON.stringify(opts.constraints));
    }
    return `${this.config.bubbleAppUrl}/api/1.1/obj/${encodeURIComponent(
      bubbleType,
    )}?${params.toString()}`;
  }

  private async safeJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}
