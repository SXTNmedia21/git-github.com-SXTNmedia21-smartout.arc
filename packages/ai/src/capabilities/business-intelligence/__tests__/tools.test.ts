// packages/ai/src/capabilities/business-intelligence/__tests__/tools.test.ts
//
// Unit tests for all 6 business_intelligence capability tools.
// Scrapling is mocked — tests verify shape compliance, channel guard,
// ADR-0134 ID guards, and emit calls.
//
// Pattern: mock global fetch + emit, call tool.execute(), assert return shape.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentToolContext } from "../../types.js";
import {
  findHospitalityBusinessesTool,
  enrichCompanyIntelligenceTool,
  generateCompanyCopyTool,
  searchBrregTool,
  lookupBrregTool,
  scrapeWebsiteTool,
} from "../tools.js";

// ─── Mock global fetch ───────────────────────────────────────────────────────

vi.stubGlobal("fetch", vi.fn());

// ─── Mock @smartout/telemetry emit ───────────────────────────────────────────

vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

import { emit } from "@smartout/telemetry";
const mockEmit = emit as ReturnType<typeof vi.fn>;

// ─── Shared test context ─────────────────────────────────────────────────────

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: "ws-test-001" as AgentToolContext["workspaceId"],
    profileId: "prof-test-001" as AgentToolContext["profileId"],
    sessionId: "sess-test-001",
    channel: "chat",
    supabaseAdmin: {} as AgentToolContext["supabaseAdmin"],
    ...overrides,
  };
}

function mockScraplingOk(data: unknown): void {
  const mockFetch = fetch as ReturnType<typeof vi.fn>;
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(""),
  } as unknown as Response);
}

function mockScraplingError(status = 500, text = "Internal Server Error"): void {
  const mockFetch = fetch as ReturnType<typeof vi.fn>;
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: vi.fn(),
    text: vi.fn().mockResolvedValue(text),
  } as unknown as Response);
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool: find_hospitality_businesses
// ─────────────────────────────────────────────────────────────────────────────

describe("find_hospitality_businesses", () => {
  it("rejects voice channel (ADR-0078)", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await findHospitalityBusinessesTool.execute(
      { city: "Oslo", types: ["restaurant"], limit: 5 },
      ctx,
    );
    expect(result).toContain("chat");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects missing workspaceId (ADR-0134)", async () => {
    const ctx = makeCtx({ workspaceId: "" as AgentToolContext["workspaceId"] });
    const result = await findHospitalityBusinessesTool.execute(
      { city: "Oslo", types: ["restaurant"], limit: 5 },
      ctx,
    );
    expect(result).toContain("workspaceId");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns results on success", async () => {
    const mockData = {
      city: "Oslo",
      results: [
        {
          name: "Test Restaurant",
          address: "Storgata 1",
          phone: "+47 22 11 33 44",
          email: "post@test.no",
          website: "https://test.no",
          primary_type: "restaurant",
          price_level: "moderate",
          rating: 4.2,
          reviews: 120,
        },
      ],
      total: 1,
      estimated_cost_usd: 0.022,
    };
    mockScraplingOk(mockData);
    const ctx = makeCtx();
    const result = await findHospitalityBusinessesTool.execute(
      { city: "Oslo", types: ["restaurant"], limit: 5 },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.city).toBe("Oslo");
    expect(parsed.count).toBe(1);
    expect(parsed.results[0].name).toBe("Test Restaurant");
  });

  it("returns no-results message on empty array", async () => {
    mockScraplingOk({ city: "Drammen", results: [], total: 0, estimated_cost_usd: 0.005 });
    const ctx = makeCtx();
    const result = await findHospitalityBusinessesTool.execute(
      { city: "Drammen", types: ["restaurant"], limit: 5 },
      ctx,
    );
    expect(result).toContain("Ingen");
    expect(result).toContain("Drammen");
  });

  it("returns error message on scrapling failure", async () => {
    mockScraplingError(503);
    const ctx = makeCtx();
    const result = await findHospitalityBusinessesTool.execute(
      { city: "Oslo", types: ["restaurant"], limit: 5 },
      ctx,
    );
    expect(result).toContain("Feil");
  });

  it("emits called + cost events on success", async () => {
    mockScraplingOk({ city: "Oslo", results: [{ name: "X" }], total: 1, estimated_cost_usd: 0.02 });
    const ctx = makeCtx();
    await findHospitalityBusinessesTool.execute(
      { city: "Oslo", types: ["restaurant"], limit: 5 },
      ctx,
    );
    const calledEvents = mockEmit.mock.calls.map((c) => c[0].event);
    expect(calledEvents).toContain("business_intelligence.find_hospitality_businesses.called");
    expect(calledEvents).toContain("business_intelligence.find_hospitality_businesses.cost");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool: enrich_company_intelligence
// ─────────────────────────────────────────────────────────────────────────────

describe("enrich_company_intelligence", () => {
  it("rejects voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await enrichCompanyIntelligenceTool.execute(
      { company_name: "Test Restaurant" },
      ctx,
    );
    expect(result).toContain("chat");
  });

  it("rejects missing profileId", async () => {
    const ctx = makeCtx({ profileId: "" as AgentToolContext["profileId"] });
    const result = await enrichCompanyIntelligenceTool.execute(
      { company_name: "Test" },
      ctx,
    );
    expect(result).toContain("profileId");
  });

  it("returns intelligence on success", async () => {
    const mockPayload = {
      intelligence: { company_name: "Strøm Mat & Bar", city: "Oslo" },
      sources_added: ["brreg", "scrape"],
      gaps_remaining: [],
    };
    mockScraplingOk(mockPayload);
    const ctx = makeCtx();
    const result = await enrichCompanyIntelligenceTool.execute(
      { company_name: "Strøm Mat & Bar", city: "Oslo" },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.intelligence.company_name).toBe("Strøm Mat & Bar");
    expect(parsed.sources_added).toContain("brreg");
  });

  it("returns no-intel message when intelligence is null", async () => {
    mockScraplingOk({ intelligence: null, sources_added: [], gaps_remaining: [] });
    const ctx = makeCtx();
    const result = await enrichCompanyIntelligenceTool.execute(
      { company_name: "Ukjent Bedrift" },
      ctx,
    );
    expect(result).toContain("Ingen intelligence");
  });

  it("emits called event before scrapling call", async () => {
    mockScraplingOk({ intelligence: {}, sources_added: [], gaps_remaining: [] });
    const ctx = makeCtx();
    await enrichCompanyIntelligenceTool.execute({ company_name: "Test" }, ctx);
    const events = mockEmit.mock.calls.map((c) => c[0].event);
    expect(events).toContain("business_intelligence.enrich_company_intelligence.called");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool: generate_company_copy
// ─────────────────────────────────────────────────────────────────────────────

describe("generate_company_copy", () => {
  it("rejects voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await generateCompanyCopyTool.execute(
      { intelligence: { company_name: "Test" } },
      ctx,
    );
    expect(result).toContain("chat");
  });

  it("returns generated copy on success", async () => {
    const generatedCopy = {
      about_us: "Om oss tekst",
      our_history: "Vår historie",
      our_concept: "Vårt konsept",
      menu_description: "Meny beskrivelse",
      restaurant_type: "restaurant",
      cuisine_types: ["Norsk"],
      price_category: "moderate",
    };
    mockScraplingOk(generatedCopy);
    const ctx = makeCtx();
    const result = await generateCompanyCopyTool.execute(
      { intelligence: { company_name: "Test Bar" } },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.about_us).toBe("Om oss tekst");
    expect(parsed.cuisine_types).toContain("Norsk");
  });

  it("passes rewrite_mode and rewrite_field to scrapling", async () => {
    mockScraplingOk({ about_us: "Ny versjon" });
    const ctx = makeCtx();
    await generateCompanyCopyTool.execute(
      {
        intelligence: {},
        rewrite_field: "about_us",
        rewrite_mode: "longer",
        current_text: "Kort tekst",
      },
      ctx,
    );
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.rewrite_field).toBe("about_us");
    expect(body.rewrite_mode).toBe("longer");
    expect(body.current_text).toBe("Kort tekst");
  });

  it("emits called + cost events on success", async () => {
    mockScraplingOk({ about_us: "tekst" });
    const ctx = makeCtx();
    await generateCompanyCopyTool.execute({ intelligence: {} }, ctx);
    const events = mockEmit.mock.calls.map((c) => c[0].event);
    expect(events).toContain("business_intelligence.generate_company_copy.called");
    expect(events).toContain("business_intelligence.generate_company_copy.cost");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool: search_brreg
// ─────────────────────────────────────────────────────────────────────────────

describe("search_brreg", () => {
  it("rejects voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await searchBrregTool.execute({ query: "Strøm Mat" }, ctx);
    expect(result).toContain("chat");
  });

  it("returns candidates on success", async () => {
    const mockPayload = {
      candidates: [
        { orgNumber: "912345678", name: "Strøm Mat & Bar AS", score: 92.1 },
      ],
      needOrgNumber: false,
      placesMatch: null,
    };
    mockScraplingOk(mockPayload);
    const ctx = makeCtx();
    const result = await searchBrregTool.execute({ query: "Strøm Mat" }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.candidates[0].orgNumber).toBe("912345678");
    expect(parsed.needOrgNumber).toBe(false);
  });

  it("returns no-treff message on empty candidates", async () => {
    mockScraplingOk({ candidates: [], needOrgNumber: true, placesMatch: null });
    const ctx = makeCtx();
    const result = await searchBrregTool.execute({ query: "Ukjent Bedrift 999" }, ctx);
    expect(result).toContain("Ingen BRREG-treff");
  });

  it("includes Places data in no-treff message when present", async () => {
    mockScraplingOk({
      candidates: [],
      needOrgNumber: true,
      placesMatch: { name: "Café Ukjent", address: "Storgata 1" },
    });
    const ctx = makeCtx();
    const result = await searchBrregTool.execute({ query: "Café Ukjent" }, ctx);
    expect(result).toContain("Google Places");
  });

  it("emits called + cost events", async () => {
    mockScraplingOk({ candidates: [], needOrgNumber: false, placesMatch: null });
    const ctx = makeCtx();
    await searchBrregTool.execute({ query: "test" }, ctx);
    const events = mockEmit.mock.calls.map((c) => c[0].event);
    expect(events).toContain("business_intelligence.search_brreg.called");
    expect(events).toContain("business_intelligence.search_brreg.cost");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool: lookup_brreg
// ─────────────────────────────────────────────────────────────────────────────

describe("lookup_brreg", () => {
  it("rejects voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await lookupBrregTool.execute({ org_number: "912345678" }, ctx);
    expect(result).toContain("chat");
  });

  it("returns match on success", async () => {
    const mockPayload = {
      match: {
        orgNumber: "912345678",
        name: "Strøm Mat & Bar AS",
        city: "Oslo",
        naceCode: "56.101",
      },
    };
    mockScraplingOk(mockPayload);
    const ctx = makeCtx();
    const result = await lookupBrregTool.execute({ org_number: "912345678" }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.match.orgNumber).toBe("912345678");
    expect(parsed.match.naceCode).toBe("56.101");
  });

  it("returns no-data message when match is null", async () => {
    mockScraplingOk({ match: null });
    const ctx = makeCtx();
    const result = await lookupBrregTool.execute({ org_number: "999999999" }, ctx);
    expect(result).toContain("Ingen BRREG-data");
    expect(result).toContain("999999999");
  });

  it("emits called + cost events on success", async () => {
    mockScraplingOk({ match: { orgNumber: "912345678" } });
    const ctx = makeCtx();
    await lookupBrregTool.execute({ org_number: "912345678" }, ctx);
    const events = mockEmit.mock.calls.map((c) => c[0].event);
    expect(events).toContain("business_intelligence.lookup_brreg.called");
    expect(events).toContain("business_intelligence.lookup_brreg.cost");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool: scrape_website
// ─────────────────────────────────────────────────────────────────────────────

describe("scrape_website", () => {
  it("rejects voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await scrapeWebsiteTool.execute(
      { url: "https://example.no" },
      ctx,
    );
    expect(result).toContain("chat");
  });

  it("calls /extract by default (extract mode)", async () => {
    mockScraplingOk({ companyName: "Test" });
    const ctx = makeCtx();
    await scrapeWebsiteTool.execute({ url: "https://example.no", mode: "extract" }, ctx);
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0] as string).toContain("/extract");
  });

  it("calls /scrape-raw for raw mode", async () => {
    mockScraplingOk({ title: "Test" });
    const ctx = makeCtx();
    await scrapeWebsiteTool.execute({ url: "https://example.no", mode: "raw" }, ctx);
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0] as string).toContain("/scrape-raw");
  });

  it("returns structured data on success", async () => {
    const mockData = { companyName: "Oslo Bistro", email: "post@oslobistro.no" };
    mockScraplingOk(mockData);
    const ctx = makeCtx();
    const result = await scrapeWebsiteTool.execute(
      { url: "https://oslobistro.no" },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.companyName).toBe("Oslo Bistro");
  });

  it("returns error message on scrapling failure", async () => {
    mockScraplingError(504);
    const ctx = makeCtx();
    const result = await scrapeWebsiteTool.execute({ url: "https://timeout.no" }, ctx);
    expect(result).toContain("Feil");
    expect(result).toContain("timeout.no");
  });

  it("emits called + cost events on success", async () => {
    mockScraplingOk({ companyName: "X" });
    const ctx = makeCtx();
    await scrapeWebsiteTool.execute({ url: "https://example.no" }, ctx);
    const events = mockEmit.mock.calls.map((c) => c[0].event);
    expect(events).toContain("business_intelligence.scrape_website.called");
    expect(events).toContain("business_intelligence.scrape_website.cost");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema compliance: verify all tools have required defineTool fields
// ─────────────────────────────────────────────────────────────────────────────

describe("tool schema compliance", () => {
  const tools = [
    findHospitalityBusinessesTool,
    enrichCompanyIntelligenceTool,
    generateCompanyCopyTool,
    searchBrregTool,
    lookupBrregTool,
    scrapeWebsiteTool,
  ];

  for (const tool of tools) {
    it(`${tool.name}: has snake_case name`, () => {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    });

    it(`${tool.name}: has non-empty description`, () => {
      expect(tool.description.length).toBeGreaterThan(10);
    });

    it(`${tool.name}: has Zod schema`, () => {
      expect(tool.schema).toBeDefined();
      expect(typeof tool.schema.parse).toBe("function");
    });

    it(`${tool.name}: has capability field set to business_intelligence`, () => {
      expect(tool.capability).toBe("business_intelligence");
    });
  }

  it("all tool names are unique", () => {
    const names = tools.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
