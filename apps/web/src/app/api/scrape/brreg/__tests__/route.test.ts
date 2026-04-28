/**
 * Route tests for /api/scrape/brreg.
 *
 * The route prefers scrapling and falls back to direct BRREG. We mock
 * env to disable scrapling so each test exercises the fallback path
 * deterministically, then mock global.fetch to control BRREG responses.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    SCRAPLING_SERVICE_URL: undefined,
    SCRAPLING_AUTH_TOKEN: undefined,
  },
}));

import { GET } from "../route";

const BRREG_HIT = {
  organisasjonsnummer: "975360040",
  navn: "CAFE OSEBRO AS",
  organisasjonsform: { kode: "AS" },
  naeringskode1: { kode: "56.101", beskrivelse: "Drift av restauranter" },
  forretningsadresse: {
    adresse: ["Storgata 5"],
    postnummer: "3920",
    poststed: "PORSGRUNN",
  },
  stiftelsesdato: "1995-06-01",
  konkurs: false,
  underAvvikling: false,
};

function brregEntitiesResponse(entities: unknown[]) {
  return new Response(JSON.stringify({ _embedded: { enheter: entities } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function brregEntityResponse(entity: unknown) {
  return new Response(JSON.stringify(entity), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/scrape/brreg", () => {
  test("rejects when neither name nor orgNumber provided", async () => {
    const res = await GET(new Request("http://x/api/scrape/brreg"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  test("orgNumber direct lookup returns mapped entity", async () => {
    fetchMock.mockResolvedValueOnce(brregEntityResponse(BRREG_HIT));
    const res = await GET(new Request("http://x/api/scrape/brreg?orgNumber=975360040"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { match: { name: string; city: string } };
    expect(body.match.name).toBe("CAFE OSEBRO AS");
    expect(body.match.city).toBe("PORSGRUNN");
  });

  test("orgNumber with spaces is cleaned", async () => {
    fetchMock.mockResolvedValueOnce(brregEntityResponse(BRREG_HIT));
    const res = await GET(new Request("http://x/api/scrape/brreg?orgNumber=975%20360%20040"));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/enheter/975360040"),
      expect.any(Object),
    );
  });

  test("orgNumber not found returns match=null", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const res = await GET(new Request("http://x/api/scrape/brreg?orgNumber=000000001"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { match: unknown };
    expect(body.match).toBeNull();
  });

  test("name search forwards forretningsadresse.poststed when city given", async () => {
    fetchMock.mockResolvedValueOnce(brregEntitiesResponse([BRREG_HIT]));
    await GET(
      new Request(
        "http://x/api/scrape/brreg?name=Cafe%20Osebro&city=Porsgrunn&industry=restaurant",
      ),
    );
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("forretningsadresse.poststed=PORSGRUNN");
    expect(calledUrl).toContain("naeringskode=56.10");
  });

  test("name search returns candidates when BRREG has hits", async () => {
    fetchMock.mockResolvedValueOnce(brregEntitiesResponse([BRREG_HIT]));
    const res = await GET(
      new Request(
        "http://x/api/scrape/brreg?name=Cafe%20Osebro&city=Porsgrunn&industry=restaurant",
      ),
    );
    const body = (await res.json()) as {
      candidates: { name: string }[];
      needOrgNumber: boolean;
      placesMatch: unknown;
    };
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0]!.name).toBe("CAFE OSEBRO AS");
    expect(body.needOrgNumber).toBe(false);
    expect(body.placesMatch).toBeNull();
  });

  test("relax sequence retries without filters when first attempt empty", async () => {
    // First two attempts (with poststed+naeringskode, then poststed only)
    // return empty, third (naeringskode only) succeeds.
    fetchMock
      .mockResolvedValueOnce(brregEntitiesResponse([]))
      .mockResolvedValueOnce(brregEntitiesResponse([]))
      .mockResolvedValueOnce(brregEntitiesResponse([BRREG_HIT]));

    const res = await GET(
      new Request("http://x/api/scrape/brreg?name=Cafe%20Osebro&city=Skien&industry=restaurant"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const body = (await res.json()) as { candidates: unknown[]; needOrgNumber: boolean };
    expect(body.candidates).toHaveLength(1);
    expect(body.needOrgNumber).toBe(false);
  });

  test("all relax attempts empty → needOrgNumber=true", async () => {
    // All four attempts (with city+nace, city, nace, name-only) empty
    fetchMock
      .mockResolvedValueOnce(brregEntitiesResponse([]))
      .mockResolvedValueOnce(brregEntitiesResponse([]))
      .mockResolvedValueOnce(brregEntitiesResponse([]))
      .mockResolvedValueOnce(brregEntitiesResponse([]));

    const res = await GET(
      new Request(
        "http://x/api/scrape/brreg?name=Nonsense%20XYZ&city=Porsgrunn&industry=restaurant",
      ),
    );
    const body = (await res.json()) as {
      candidates: unknown[];
      needOrgNumber: boolean;
      placesMatch: unknown;
    };
    expect(body.candidates).toHaveLength(0);
    expect(body.needOrgNumber).toBe(true);
    expect(body.placesMatch).toBeNull();
  });

  test("city match preference sorts hits when multiple returned", async () => {
    const wrongCity = {
      ...BRREG_HIT,
      navn: "OTHER AS",
      forretningsadresse: { ...BRREG_HIT.forretningsadresse, poststed: "OSLO" },
    };
    const rightCity = { ...BRREG_HIT };
    fetchMock.mockResolvedValueOnce(brregEntitiesResponse([wrongCity, rightCity]));
    const res = await GET(
      new Request(
        "http://x/api/scrape/brreg?name=Cafe%20Osebro&city=Porsgrunn&industry=restaurant",
      ),
    );
    const body = (await res.json()) as { candidates: { city: string }[] };
    expect(body.candidates[0]!.city).toBe("PORSGRUNN");
  });

  test("returns 400 for short name without orgNumber", async () => {
    const res = await GET(new Request("http://x/api/scrape/brreg?name=A"));
    expect(res.status).toBe(400);
  });
});
