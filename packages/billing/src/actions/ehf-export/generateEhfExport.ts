// generateEhfExport — Fase 3B B3 platform-admin CSV export builder.
//
// Background (ADR-0148 + Fase 3B-v2 spec):
//   Smartout sender IKKE EHF direkte. Platform-admin genererer en
//   månedlig CSV/PDF-eksport som ekstern regnskapsfører bruker til å
//   produsere EHF-fakturaer i sitt eget system (Fiken / Tripletex).
//   Denne filen eier CSV-halvdelen. PDF kommer i B4 — formatet avvises
//   eksplisitt her slik at UI ikke kan komme foran implementasjonen.
//
// Pure async function — INGEN Next.js-primitiver, ingen "use server".
// Web-laget wrapper dette i en Server Action (B5) som også laster opp
// artefaktet til Supabase Storage og signerer URLen. Mobil kan kalle
// samme funksjon direkte. Telemetry emit() er caller-concern — dette
// laget leverer kun data + mutasjon (ehf_exported_at-stempelet).
//
// Output shape (spec §4): UTF-8 m/ BOM (så Excel åpner æøå riktig),
// RFC-4180-escaping, CRLF-linjer, tallene locale-nøytrale (. som desimal)
// slik at regnskapsførerens import er trygg uansett bokføringssystem.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

type BillingClient = SupabaseClient<Database>;

export type GenerateEhfExportArgs = {
  /** ISO-dato YYYY-MM-DD, inklusiv begge ender. */
  period: { from: string; to: string };
  grouping: ReadonlyArray<"bundled" | "per_workspace">;
  /** Kun "csv" er støttet i B3. "pdf" avvises med format_not_supported_yet. */
  format: ReadonlyArray<"csv" | "pdf">;
  /** true = filtrér bort fakturaer som allerede har ehf_exported_at stemplet. */
  excludeAlreadyExported: boolean;
};

export type EhfExportArtifact = {
  filename: string;
  content_type: string;
  /** Rå CSV-body (UTF-8 + BOM). Web-adapter (B5) laster opp til Storage og signerer URL. */
  content: string;
};

export type GenerateEhfExportResult =
  | {
      ok: true;
      artifacts: EhfExportArtifact[];
      invoice_count: number;
      workspace_count: number;
      invoice_ids: string[];
    }
  | {
      ok: false;
      error: string;
      code?: "no_invoices" | "invalid_input" | "format_not_supported_yet" | "internal_error";
    };

// ─── Row shapes brukt under bygging ───────────────────────────────

type EligibleInvoiceRow = {
  invoice_id: string;
  invoice_number: number | null;
  issued_at: string | null;
  due_at: string | null;
  amount_excl_vat: number;
  amount_incl_vat: number;
  vat_amount: number;
  currency: string;
  company_id: string;
};

type CompanyRow = {
  company_id: string;
  peppol_participant_id: string | null;
  org_number: string | null;
};

type WorkspaceRow = {
  workspace_id: string;
  company_id: string | null;
  name: string;
  slug: string;
};

type LineItemRow = {
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount_excl_vat: number;
  vat_rate: number;
};

/** CSV-rad etter join + normalisering. Én per faktura. */
type CsvRow = {
  invoice_id: string;
  invoice_number: number | null;
  invoice_date: string;
  due_date: string;
  workspace_id: string | null;
  workspace_name: string;
  workspace_slug: string;
  workspace_org_nr: string;
  peppol_participant_id: string;
  amount_ex_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  currency: string;
  line_items: ReadonlyArray<{
    description: string;
    quantity: number;
    unit_price: number;
    amount_excl_vat: number;
    vat_rate: number;
  }>;
};

// ─── Hovedfunksjon ────────────────────────────────────────────────

export async function generateEhfExport(
  client: BillingClient,
  args: GenerateEhfExportArgs,
): Promise<GenerateEhfExportResult> {
  // 1) Input-validering. Billige sjekker først — failer raskt uten DB-rundtur.
  const inputError = validateInput(args);
  if (inputError) return inputError;

  // Format: PDF blokkeres her for å hindre at UI bestiller noe som
  // B3 ikke kan levere. B4 overtar PDF-grenen og åpner denne porten.
  if (args.format.includes("pdf")) {
    return {
      ok: false,
      code: "format_not_supported_yet",
      error: "PDF-builder kommer i B4",
    };
  }

  // 2) Hent eligible fakturaer. Filteret matcher spec §5.
  //    invoice_type = alt unntatt credit_note — credit notes blir ikke
  //    EHF'd direkte (spec §5 + ADR-0148). Enum: recurring | onboarding
  //    | one_off | credit_note.
  const invoicesRes = await client
    .from("invoice")
    .select(
      "invoice_id, invoice_number, issued_at, due_at, amount_excl_vat, amount_incl_vat, vat_amount, currency, company_id",
    )
    .in("invoice_type", ["recurring", "onboarding", "one_off"])
    .in("status", ["issued", "overdue"])
    .gte("issued_at", `${args.period.from}T00:00:00.000Z`)
    .lte("issued_at", `${args.period.to}T23:59:59.999Z`);

  if (invoicesRes.error) {
    return { ok: false, code: "internal_error", error: invoicesRes.error.message };
  }

  let invoices = (invoicesRes.data ?? []) as EligibleInvoiceRow[];

  // excludeAlreadyExported filtreres post-hent for å unngå chained-filter
  // kompleksitet i mock-klienten. Volum er månedsvis — hundrevis av rader,
  // ikke millioner — så memory-filtrering er trygt her.
  if (args.excludeAlreadyExported) {
    const withTimestampRes = await client
      .from("invoice")
      .select("invoice_id, ehf_exported_at")
      .in(
        "invoice_id",
        invoices.map((i) => i.invoice_id),
      );
    if (withTimestampRes.error) {
      return { ok: false, code: "internal_error", error: withTimestampRes.error.message };
    }
    const alreadyExported = new Set(
      (withTimestampRes.data ?? [])
        .filter((r: { ehf_exported_at: string | null }) => r.ehf_exported_at !== null)
        .map((r: { invoice_id: string }) => r.invoice_id),
    );
    invoices = invoices.filter((i) => !alreadyExported.has(i.invoice_id));
  }

  if (invoices.length === 0) {
    return { ok: false, code: "no_invoices", error: "Ingen fakturaer matcher filteret" };
  }

  // 3) Hent company-rader for EHF-gate. Kun companies med
  //    ehf_enabled=true OG peppol_participant_id NOT NULL er eligible.
  const companyIds = Array.from(new Set(invoices.map((i) => i.company_id)));
  const companiesRes = await client
    .from("company")
    .select("company_id, peppol_participant_id, org_number")
    .in("company_id", companyIds)
    .eq("ehf_enabled", true)
    .not("peppol_participant_id", "is", null);

  if (companiesRes.error) {
    return { ok: false, code: "internal_error", error: companiesRes.error.message };
  }

  const eligibleCompanies = new Map<string, CompanyRow>(
    ((companiesRes.data ?? []) as CompanyRow[]).map((c) => [c.company_id, c]),
  );

  // Filter invoices to only those whose company passed the EHF gate.
  invoices = invoices.filter((i) => eligibleCompanies.has(i.company_id));

  if (invoices.length === 0) {
    return { ok: false, code: "no_invoices", error: "Ingen fakturaer matcher filteret" };
  }

  // 4) Hent workspaces for canonical workspace-identifisering i CSV.
  //    En company kan ha flere workspaces — vi sorterer deterministisk
  //    på slug og plukker første. Matcher "per_workspace"-grouping ved
  //    å gruppere rader etter workspace-slug på samme måte.
  const workspacesRes = await client
    .from("workspace")
    .select("workspace_id, company_id, name, slug")
    .in("company_id", companyIds);

  if (workspacesRes.error) {
    return { ok: false, code: "internal_error", error: workspacesRes.error.message };
  }

  const workspacesByCompany = new Map<string, WorkspaceRow[]>();
  for (const w of (workspacesRes.data ?? []) as WorkspaceRow[]) {
    if (!w.company_id) continue;
    const list = workspacesByCompany.get(w.company_id) ?? [];
    list.push(w);
    workspacesByCompany.set(w.company_id, list);
  }
  // Deterministic canonical-workspace valg: sort by slug ascending.
  for (const list of workspacesByCompany.values()) {
    list.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  // 5) Hent line items for alle eligible fakturaer.
  const invoiceIds = invoices.map((i) => i.invoice_id);
  const lineItemsRes = await client
    .from("invoice_line_item")
    .select("invoice_id, description, quantity, unit_price, amount_excl_vat, vat_rate")
    .in("invoice_id", invoiceIds);

  if (lineItemsRes.error) {
    return { ok: false, code: "internal_error", error: lineItemsRes.error.message };
  }

  const lineItemsByInvoice = new Map<string, LineItemRow[]>();
  for (const li of (lineItemsRes.data ?? []) as LineItemRow[]) {
    const list = lineItemsByInvoice.get(li.invoice_id) ?? [];
    list.push(li);
    lineItemsByInvoice.set(li.invoice_id, list);
  }

  // 6) Bygg CSV-rader. issued_at er timestamptz — coerce til YYYY-MM-DD.
  const rows: CsvRow[] = invoices.map((inv) => {
    const company = eligibleCompanies.get(inv.company_id)!;
    const workspaces = workspacesByCompany.get(inv.company_id) ?? [];
    const canonical = workspaces[0];
    return {
      invoice_id: inv.invoice_id,
      invoice_number: inv.invoice_number,
      invoice_date: toIsoDate(inv.issued_at),
      due_date: toIsoDate(inv.due_at),
      workspace_id: canonical?.workspace_id ?? null,
      workspace_name: canonical?.name ?? "",
      workspace_slug: canonical?.slug ?? "",
      workspace_org_nr: company.org_number ?? "",
      peppol_participant_id: company.peppol_participant_id ?? "",
      amount_ex_vat: inv.amount_excl_vat,
      vat_amount: inv.vat_amount,
      amount_incl_vat: inv.amount_incl_vat,
      currency: inv.currency,
      line_items: (lineItemsByInvoice.get(inv.invoice_id) ?? []).map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        amount_excl_vat: li.amount_excl_vat,
        vat_rate: li.vat_rate,
      })),
    };
  });

  // 7) Artefakter — én eller flere avhengig av grouping-kombinasjon.
  const monthLabel = deriveMonthLabel(args.period.from);
  const artifacts: EhfExportArtifact[] = [];

  if (args.grouping.includes("bundled")) {
    artifacts.push({
      filename: `ehf-eksport-${monthLabel}.csv`,
      content_type: "text/csv; charset=utf-8",
      content: buildCsv(rows),
    });
  }

  if (args.grouping.includes("per_workspace")) {
    // Gruppér rader etter workspace-slug. Rader uten workspace går i
    // en fallback-bucket "uten-workspace" så de ikke silent droppes.
    const bySlug = new Map<string, { name: string; rows: CsvRow[] }>();
    for (const row of rows) {
      const slug = row.workspace_slug || "uten-workspace";
      const bucket = bySlug.get(slug) ?? { name: row.workspace_name || slug, rows: [] };
      bucket.rows.push(row);
      bySlug.set(slug, bucket);
    }
    // Deterministisk rekkefølge for stabile tester.
    const slugs = Array.from(bySlug.keys()).sort();
    for (const slug of slugs) {
      const bucket = bySlug.get(slug)!;
      artifacts.push({
        filename: `${slug}-${monthLabel}.csv`,
        content_type: "text/csv; charset=utf-8",
        content: buildCsv(bucket.rows),
      });
    }
  }

  // 8) Mark-exported. Batch-UPDATE IN(...) så én rundtur dekker alle
  //    rader. Web-adapter (B5) kaller denne AFTER signed URL succeeded
  //    slik at failed upload ikke etterlater feil stemplede rader.
  const now = new Date().toISOString();
  const updateRes = await client
    .from("invoice")
    .update({ ehf_exported_at: now })
    .in("invoice_id", invoiceIds);
  if (updateRes.error) {
    return { ok: false, code: "internal_error", error: updateRes.error.message };
  }

  // workspace_count = antall unike workspaces faktisk brukt i output
  // (ikke total i DB — brukt for telemetry-attribution).
  const workspaceCount = new Set(rows.map((r) => r.workspace_id ?? `no-ws:${r.workspace_org_nr}`))
    .size;

  return {
    ok: true,
    artifacts,
    invoice_count: rows.length,
    workspace_count: workspaceCount,
    invoice_ids: invoiceIds,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function validateInput(args: GenerateEhfExportArgs): GenerateEhfExportResult | null {
  if (!args.grouping || args.grouping.length === 0) {
    return { ok: false, code: "invalid_input", error: "grouping kan ikke være tom" };
  }
  if (!args.format || args.format.length === 0) {
    return { ok: false, code: "invalid_input", error: "format kan ikke være tom" };
  }
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(args.period.from) || !isoDateRegex.test(args.period.to)) {
    return { ok: false, code: "invalid_input", error: "period må være YYYY-MM-DD" };
  }
  if (args.period.from > args.period.to) {
    return { ok: false, code: "invalid_input", error: "period.from må være <= period.to" };
  }
  return null;
}

/** Coerce timestamptz-streng til YYYY-MM-DD (UTC-date-del). */
function toIsoDate(value: string | null): string {
  if (!value) return "";
  // ISO-strenger som '2026-04-15T12:00:00.000Z' → behold kun dato-delen.
  // Rå YYYY-MM-DD slipper gjennom uendret (noe DB-paths kan returnere).
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM fra periodens from-dato, brukt i filnavn. */
function deriveMonthLabel(periodFrom: string): string {
  // Forventet input er allerede YYYY-MM-DD — valideringen over gater det.
  return periodFrom.slice(0, 7);
}

/** Bygg RFC-4180 CSV med UTF-8 BOM og CRLF-linjer. */
function buildCsv(rows: ReadonlyArray<CsvRow>): string {
  const header = [
    "invoice_number",
    "invoice_date",
    "due_date",
    "workspace_name",
    "workspace_org_nr",
    "peppol_participant_id",
    "amount_ex_vat",
    "vat_amount",
    "amount_incl_vat",
    "currency",
    "line_items_json",
  ];

  const lines: string[] = [];
  lines.push(header.map(escapeCsvField).join(","));

  for (const r of rows) {
    const lineItemsJson = JSON.stringify(
      r.line_items.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        amount_excl_vat: li.amount_excl_vat,
        vat_rate: li.vat_rate,
      })),
    );
    const cells = [
      r.invoice_number === null ? "" : String(r.invoice_number),
      r.invoice_date,
      r.due_date,
      r.workspace_name,
      r.workspace_org_nr,
      r.peppol_participant_id,
      numberToCsv(r.amount_ex_vat),
      numberToCsv(r.vat_amount),
      numberToCsv(r.amount_incl_vat),
      r.currency,
      lineItemsJson,
    ];
    lines.push(cells.map(escapeCsvField).join(","));
  }

  // BOM + CRLF per spec. Excel krever BOM for å tolke UTF-8 riktig;
  // RFC-4180 krever CRLF mellom records.
  const BOM = "\ufeff";
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Locale-nøytralt tall — punktum som desimal, ingen tusen-separator. */
function numberToCsv(n: number): string {
  if (!Number.isFinite(n)) return "";
  // toString gir alltid "." som desimal i JS — safe mtp. regnskapsimport.
  return n.toString();
}

/** RFC-4180 felt-escape: wrap i "" hvis feltet inneholder , " \r eller \n, og doble alle ". */
function escapeCsvField(value: string): string {
  if (value === null || value === undefined) return "";
  const needsQuote = /[",\r\n]/.test(value);
  if (!needsQuote) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
