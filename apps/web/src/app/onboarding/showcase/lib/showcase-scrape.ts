type RawScrape = {
  summary?: string;
  email?: string;
  phone?: string;
  locations?: Array<{ name?: string }>;
} | null;

export function normalizeScrapeData(raw: RawScrape) {
  if (!raw) {
    return { summary: "", email: "", phone: "", locations: [] as string[] };
  }

  return {
    summary: raw.summary ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    locations: (raw.locations ?? []).map((loc) => loc.name || "Ukjent lokasjon"),
  };
}
