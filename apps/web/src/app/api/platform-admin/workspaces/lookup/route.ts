import { NextResponse } from "next/server";
import { requireGodmode } from "@/lib/platform-admin";

const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api";
const SCRAPLING_URL = process.env.SCRAPLING_SERVICE_URL ?? "";

// ---------------------------------------------------------------------------
// GET /api/platform-admin/workspaces/lookup?orgNumber=123456789
// GET /api/platform-admin/workspaces/lookup?name=Smartout&city=Oslo
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const result = await requireGodmode();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const orgNumber = searchParams.get("orgNumber")?.replace(/\s/g, "");
  const name = searchParams.get("name");
  const city = searchParams.get("city");

  try {
    // Direct lookup by org number
    if (orgNumber && orgNumber.length >= 9) {
      const [entityRes, dagligLeder] = await Promise.all([
        fetch(`${BRREG_BASE}/enheter/${orgNumber}`),
        fetchDagligLeder(orgNumber),
      ]);
      if (!entityRes.ok) {
        return NextResponse.json({ error: "Fant ikke bedriften" }, { status: 404 });
      }
      const entity = await entityRes.json();
      const company = mapBrregEntity(entity);
      company.dagligLeder = dagligLeder;

      // Enrich with website scraping if available (fills gaps only)
      if (company.website) {
        const scraped = await scrapeWebsite(company.website);
        if (scraped) {
          if (!company.email) company.email = scraped.email || null;
          if (!company.phone) company.phone = scraped.phone || null;
        }
      }

      return NextResponse.json({ type: "match", company });
    }

    // Fuzzy search by name
    if (name) {
      const params = new URLSearchParams({ navn: name, size: "10" });
      if (city) params.set("poststed", city);
      const res = await fetch(`${BRREG_BASE}/enheter?${params}`);
      if (!res.ok) {
        return NextResponse.json({ candidates: [] });
      }
      const data = await res.json();
      const entities = data?._embedded?.enheter ?? [];
      const candidates = entities.map(mapBrregCandidate);
      return NextResponse.json({ type: "candidates", candidates });
    }

    return NextResponse.json({ error: "orgNumber or name required" }, { status: 400 });
  } catch (err) {
    console.error("[workspace-lookup]", err);
    return NextResponse.json({ error: "Brreg lookup failed" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Brreg: Daglig leder (roller endpoint)
// ---------------------------------------------------------------------------

async function fetchDagligLeder(orgNumber: string): Promise<string | null> {
  try {
    const res = await fetch(`${BRREG_BASE}/enheter/${orgNumber}/roller`);
    if (!res.ok) return null;
    const data = await res.json();
    const groups =
      (data?.rollegrupper as {
        roller?: {
          type?: { kode?: string };
          person?: { navn?: { fornavn?: string; mellomnavn?: string; etternavn?: string } };
        }[];
      }[]) || [];
    const rolePriority = ["DAGL", "LEDE", "INHA"];
    for (const code of rolePriority) {
      for (const group of groups) {
        for (const rolle of group.roller || []) {
          if (rolle.type?.kode === code && rolle.person?.navn) {
            const n = rolle.person.navn;
            return [n.fornavn, n.mellomnavn, n.etternavn].filter(Boolean).join(" ");
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scrapling
// ---------------------------------------------------------------------------

async function scrapeWebsite(url: string): Promise<{ email?: string; phone?: string } | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = process.env.SCRAPLING_AUTH_TOKEN;
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${SCRAPLING_URL}/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url,
        config: { include_company_info: true },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { email: data?.email || undefined, phone: data?.phone || undefined };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapBrregEntity(e: Record<string, unknown>) {
  const forretningsadresse = e.forretningsadresse as Record<string, unknown> | undefined;
  const postadresse = e.postadresse as Record<string, unknown> | undefined;
  const nace = e.naeringskode1 as { kode?: string; beskrivelse?: string } | undefined;
  const orgForm = e.organisasjonsform as { kode?: string; beskrivelse?: string } | undefined;

  return {
    orgNumber: e.organisasjonsnummer as string,
    legalName: e.navn as string,
    website: (e.hjemmeside as string) || null,
    naceCode: nace?.kode || null,
    naceDescription: nace?.beskrivelse || null,
    companyType: orgForm?.beskrivelse || null,
    companyTypeCode: orgForm?.kode || null,
    address: {
      street: ((forretningsadresse?.adresse as string[]) ?? [])[0] || "",
      postalCode: (forretningsadresse?.postnummer as string) || "",
      city: (forretningsadresse?.poststed as string) || "",
      municipality: (forretningsadresse?.kommune as string) || "",
      country: (forretningsadresse?.landkode as string) || "NO",
    },
    postAddress: postadresse
      ? {
          street: ((postadresse.adresse as string[]) ?? [])[0] || "",
          postalCode: (postadresse.postnummer as string) || "",
          city: (postadresse.poststed as string) || "",
        }
      : null,
    employeeCount: (e.antallAnsatte as number) ?? null,
    phone: (e.mobil as string) || null,
    email: null as string | null,
    dagligLeder: null as string | null,
    vatRegistered: (e.registrertIMvaregisteret as boolean) ?? false,
    foundingDate: (e.stiftelsesdato as string) || null,
    registrationDate: (e.registreringsdatoEnhetsregisteret as string) || null,
  };
}

function mapBrregCandidate(e: Record<string, unknown>) {
  const addr = e.forretningsadresse as Record<string, unknown> | undefined;
  const nace = e.naeringskode1 as { kode?: string; beskrivelse?: string } | undefined;
  return {
    orgNumber: e.organisasjonsnummer as string,
    name: e.navn as string,
    city: (addr?.poststed as string) || "",
    industry: nace?.beskrivelse || "",
    industryCode: nace?.kode || "",
  };
}
