import { NextResponse } from "next/server";
import { z } from "zod";

const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api";

const QuerySchema = z
  .object({
    name: z.string().min(2).optional(),
    orgNumber: z.string().min(9).optional(),
  })
  .refine((d) => d.name || d.orgNumber, { message: "name or orgNumber required" });

/**
 * GET /api/scrape/brreg?name=Solsiden+Restaurant
 * GET /api/scrape/brreg?orgNumber=123456789
 *
 * Public BRREG lookup — no auth required.
 * Used by join wizard to autofill org number + address.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? undefined;
  const city = searchParams.get("city") ?? undefined;
  const orgNumber = searchParams.get("orgNumber")?.replace(/\s/g, "") ?? undefined;

  const parsed = QuerySchema.safeParse({ name, orgNumber });
  if (!parsed.success) {
    return NextResponse.json({ error: "name or orgNumber required" }, { status: 400 });
  }

  try {
    // Direct lookup by org number
    if (orgNumber && orgNumber.length >= 9) {
      const res = await fetch(`${BRREG_BASE}/enheter/${orgNumber}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return NextResponse.json({ match: null });
      }
      const entity = await res.json();
      return NextResponse.json({ match: mapEntity(entity) });
    }

    // Fuzzy search by name — rank by city match if provided
    if (name) {
      const params = new URLSearchParams({ navn: name, size: "10" });
      const res = await fetch(`${BRREG_BASE}/enheter?${params}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return NextResponse.json({ candidates: [] });
      }
      const data = await res.json();
      const entities = (data?._embedded?.enheter ?? []) as Record<string, unknown>[];

      // Map and rank — city matches first
      const candidates = entities.map(mapCandidate);
      if (city) {
        const cityUpper = city.toUpperCase();
        candidates.sort((a, b) => {
          const aMatch = a.city.toUpperCase() === cityUpper ? 0 : 1;
          const bMatch = b.city.toUpperCase() === cityUpper ? 0 : 1;
          return aMatch - bMatch;
        });
      }

      return NextResponse.json({
        candidates: candidates.slice(0, 5),
      });
    }

    return NextResponse.json({ error: "name or orgNumber required" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "BRREG lookup failed" }, { status: 500 });
  }
}

function mapEntity(e: Record<string, unknown>) {
  const addr = e.forretningsadresse as Record<string, unknown> | undefined;
  return {
    orgNumber: e.organisasjonsnummer as string,
    name: e.navn as string,
    street: ((addr?.adresse as string[]) ?? [])[0] || "",
    postalCode: (addr?.postnummer as string) || "",
    city: (addr?.poststed as string) || "",
  };
}

function mapCandidate(e: Record<string, unknown>) {
  const addr = e.forretningsadresse as Record<string, unknown> | undefined;
  const nace = e.naeringskode1 as { beskrivelse?: string } | undefined;
  return {
    orgNumber: e.organisasjonsnummer as string,
    name: e.navn as string,
    street: ((addr?.adresse as string[]) ?? [])[0] || "",
    postalCode: (addr?.postnummer as string) || "",
    city: (addr?.poststed as string) || "",
    industry: nace?.beskrivelse || "",
  };
}
