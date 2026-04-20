// generateEhfExport Fase 3B B3 pure-action contract tests.
//
// Dekker (Fase 3B-v2 spec §10 + task-krav):
//   1. Happy path bundled CSV — 2 fakturaer / 2 workspaces, grouping=['bundled']
//   2. Happy path per_workspace — 3 fakturaer / 2 workspaces, filnavn m/ slug
//   3. Begge grouping — 1 bundled + N per-workspace i samme kall
//   4. PDF format avvises eksplisitt (code:'format_not_supported_yet')
//   5. Ingen fakturaer → code:'no_invoices', ingen UPDATE
//   6. excludeAlreadyExported=true filtrerer bort allerede-stemplede
//   7. Mark-exported UPDATE issues med IN(...) av invoice_ids ved success
//   8. Invalid input (period.from > period.to) → code:'invalid_input'
//   9. CSV-escaping — description m/ komma og citater escapes riktig
//
// Mock-klient er fluent-chain mimikry; holder tabell-navn → kall-handler-
// tabell pr. test for deterministiske asserts.

import { describe, expect, test } from "vitest";
import { generateEhfExport } from "../generateEhfExport";

// ─── Typed fixture rows ───────────────────────────────────────────

type InvoiceFixture = {
  invoice_id: string;
  invoice_number: number | null;
  issued_at: string | null;
  due_at: string | null;
  amount_excl_vat: number;
  amount_incl_vat: number;
  vat_amount: number;
  currency: string;
  company_id: string;
  status: "issued" | "overdue" | "paid" | "draft" | "void";
  invoice_type: "recurring" | "onboarding" | "one_off" | "credit_note";
  ehf_exported_at: string | null;
};

type CompanyFixture = {
  company_id: string;
  peppol_participant_id: string | null;
  org_number: string | null;
  ehf_enabled: boolean;
};

type WorkspaceFixture = {
  workspace_id: string;
  company_id: string | null;
  name: string;
  slug: string;
};

type LineItemFixture = {
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount_excl_vat: number;
  vat_rate: number;
};

type UpdateCall = {
  table: string;
  payload: Record<string, unknown>;
  inColumn?: string;
  inValues?: unknown[];
};

type MockOpts = {
  invoices: InvoiceFixture[];
  companies: CompanyFixture[];
  workspaces: WorkspaceFixture[];
  lineItems: LineItemFixture[];
};

function createMockClient(opts: MockOpts) {
  const updateCalls: UpdateCall[] = [];

  // Filter-state akkumulator brukt av select-chainen. Én ny instans per
  // from(...)-kall slik at hvert query starter "rent". Alle .eq/.in/.gte/.lte
  // pusher predikat som så brukes når kjeden termineres (array-retur).
  type Predicate = (row: Record<string, unknown>) => boolean;

  const client = {
    from(table: string) {
      const predicates: Predicate[] = [];

      const selectBuilder = {
        eq(col: string, val: unknown) {
          predicates.push((r) => r[col] === val);
          return selectBuilder;
        },
        in(col: string, vals: unknown[]) {
          predicates.push((r) => vals.includes(r[col]));
          return selectBuilder;
        },
        gte(col: string, val: unknown) {
          predicates.push((r) => (r[col] as string) >= (val as string));
          return selectBuilder;
        },
        lte(col: string, val: unknown) {
          predicates.push((r) => (r[col] as string) <= (val as string));
          return selectBuilder;
        },
        not(col: string, op: string, val: unknown) {
          // Vi støtter kun den varianten action-filen bruker: not(col, 'is', null)
          if (op === "is" && val === null) {
            predicates.push((r) => r[col] !== null && r[col] !== undefined);
          }
          return selectBuilder;
        },
        // Terminal: promise-like. Returnerer { data, error }.
        then<TResult1, TResult2 = never>(
          onfulfilled?:
            | ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ): Promise<TResult1 | TResult2> {
          const dataset = pickDataset(table, opts);
          const filtered = dataset.filter((row) =>
            predicates.every((p) => p(row as Record<string, unknown>)),
          );
          const result = { data: filtered, error: null as null };
          return Promise.resolve(result).then(onfulfilled, onrejected);
        },
      };

      return {
        select(_cols: string) {
          return selectBuilder;
        },
        update(payload: Record<string, unknown>) {
          return {
            in(col: string, vals: unknown[]) {
              updateCalls.push({
                table,
                payload,
                inColumn: col,
                inValues: vals,
              });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, updateCalls };
}

function pickDataset(table: string, opts: MockOpts): unknown[] {
  switch (table) {
    case "invoice":
      return opts.invoices;
    case "company":
      return opts.companies;
    case "workspace":
      return opts.workspaces;
    case "invoice_line_item":
      return opts.lineItems;
    default:
      throw new Error(`unexpected table ${table}`);
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────

const COMPANY_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const WORKSPACE_A = "a1a1a1a1-1111-1111-1111-111111111111";
const WORKSPACE_B = "b1b1b1b1-2222-2222-2222-222222222222";
const INV_1 = "11111111-1111-1111-1111-111111111111";
const INV_2 = "22222222-2222-2222-2222-222222222222";
const INV_3 = "33333333-3333-3333-3333-333333333333";

function baseCompanies(): CompanyFixture[] {
  return [
    {
      company_id: COMPANY_A,
      peppol_participant_id: "0192:111111111",
      org_number: "111111111",
      ehf_enabled: true,
    },
    {
      company_id: COMPANY_B,
      peppol_participant_id: "0192:222222222",
      org_number: "222222222",
      ehf_enabled: true,
    },
  ];
}

function baseWorkspaces(): WorkspaceFixture[] {
  return [
    {
      workspace_id: WORKSPACE_A,
      company_id: COMPANY_A,
      name: "Alpha Bar",
      slug: "alpha-bar",
    },
    {
      workspace_id: WORKSPACE_B,
      company_id: COMPANY_B,
      name: "Beta Kjøkken",
      slug: "beta-kjokken",
    },
  ];
}

/** Minimal RFC-4180 rad-parser. Bruker state-machine for quoted-field
 *  + doble citater. Kun for test-assertion av roundtripping — ingen
 *  garanti om ytelse eller edge-cases utover det suiten trenger. */
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"' && cur === "") {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

// ─── Tests ────────────────────────────────────────────────────────

describe("generateEhfExport", () => {
  test("1. happy path bundled CSV — 2 fakturaer, 1 artefakt", async () => {
    const { client } = createMockClient({
      invoices: [
        {
          invoice_id: INV_1,
          invoice_number: 1001,
          issued_at: "2026-04-05T10:00:00.000Z",
          due_at: "2026-05-05T00:00:00.000Z",
          amount_excl_vat: 1000,
          amount_incl_vat: 1250,
          vat_amount: 250,
          currency: "NOK",
          company_id: COMPANY_A,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
        {
          invoice_id: INV_2,
          invoice_number: 1002,
          issued_at: "2026-04-15T10:00:00.000Z",
          due_at: "2026-05-15T00:00:00.000Z",
          amount_excl_vat: 2000,
          amount_incl_vat: 2500,
          vat_amount: 500,
          currency: "NOK",
          company_id: COMPANY_B,
          status: "overdue",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
      ],
      companies: baseCompanies(),
      workspaces: baseWorkspaces(),
      lineItems: [
        {
          invoice_id: INV_1,
          description: "Månedsabonnement",
          quantity: 1,
          unit_price: 1000,
          amount_excl_vat: 1000,
          vat_rate: 25,
        },
        {
          invoice_id: INV_2,
          description: "Månedsabonnement",
          quantity: 2,
          unit_price: 1000,
          amount_excl_vat: 2000,
          vat_rate: 25,
        },
      ],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-01", to: "2026-04-30" },
      grouping: ["bundled"],
      format: ["csv"],
      excludeAlreadyExported: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifacts).toHaveLength(1);
    expect(result.invoice_count).toBe(2);
    expect(result.workspace_count).toBe(2);
    expect(result.invoice_ids).toEqual([INV_1, INV_2]);

    const artifact = result.artifacts[0]!;
    expect(artifact.filename).toBe("ehf-eksport-2026-04.csv");
    expect(artifact.content_type).toBe("text/csv; charset=utf-8");

    // BOM prefix + CRLF line endings
    expect(artifact.content.startsWith("\ufeff")).toBe(true);
    expect(artifact.content.includes("\r\n")).toBe(true);

    // Header-kolonner (spec §4)
    const firstLine = artifact.content.slice(1).split("\r\n")[0]!;
    expect(firstLine).toBe(
      "invoice_number,invoice_date,due_date,workspace_name,workspace_org_nr,peppol_participant_id,amount_ex_vat,vat_amount,amount_incl_vat,currency,line_items_json",
    );

    // line_items_json — parse en celle og sjekk struktur.
    const dataLine = artifact.content.slice(1).split("\r\n")[1]!;
    // JSON-feltet er quoted fordi det inneholder komma — sist celle.
    const jsonMatch = dataLine.match(/"(\[.*\])"$/);
    expect(jsonMatch).toBeTruthy();
    const parsed = JSON.parse(jsonMatch![1]!.replace(/""/g, '"'));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toMatchObject({
      description: "Månedsabonnement",
      quantity: 1,
      unit_price: 1000,
      amount_excl_vat: 1000,
      vat_rate: 25,
    });
  });

  test("2. happy path per_workspace — 3 fakturaer / 2 workspaces, 2 artefakter", async () => {
    const { client } = createMockClient({
      invoices: [
        {
          invoice_id: INV_1,
          invoice_number: 1001,
          issued_at: "2026-04-01T10:00:00.000Z",
          due_at: "2026-05-01T00:00:00.000Z",
          amount_excl_vat: 500,
          amount_incl_vat: 625,
          vat_amount: 125,
          currency: "NOK",
          company_id: COMPANY_A,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
        {
          invoice_id: INV_2,
          invoice_number: 1002,
          issued_at: "2026-04-10T10:00:00.000Z",
          due_at: "2026-05-10T00:00:00.000Z",
          amount_excl_vat: 500,
          amount_incl_vat: 625,
          vat_amount: 125,
          currency: "NOK",
          company_id: COMPANY_A,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
        {
          invoice_id: INV_3,
          invoice_number: 1003,
          issued_at: "2026-04-20T10:00:00.000Z",
          due_at: "2026-05-20T00:00:00.000Z",
          amount_excl_vat: 800,
          amount_incl_vat: 1000,
          vat_amount: 200,
          currency: "NOK",
          company_id: COMPANY_B,
          status: "overdue",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
      ],
      companies: baseCompanies(),
      workspaces: baseWorkspaces(),
      lineItems: [],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-01", to: "2026-04-30" },
      grouping: ["per_workspace"],
      format: ["csv"],
      excludeAlreadyExported: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifacts).toHaveLength(2);
    // Sortert deterministisk etter slug
    expect(result.artifacts[0]!.filename).toBe("alpha-bar-2026-04.csv");
    expect(result.artifacts[1]!.filename).toBe("beta-kjokken-2026-04.csv");
    expect(result.invoice_count).toBe(3);
    expect(result.workspace_count).toBe(2);
  });

  test("3. begge grouping — 1 bundled + 2 per-workspace = 3 artefakter", async () => {
    const { client } = createMockClient({
      invoices: [
        {
          invoice_id: INV_1,
          invoice_number: 1001,
          issued_at: "2026-04-01T10:00:00.000Z",
          due_at: null,
          amount_excl_vat: 100,
          amount_incl_vat: 125,
          vat_amount: 25,
          currency: "NOK",
          company_id: COMPANY_A,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
        {
          invoice_id: INV_2,
          invoice_number: 1002,
          issued_at: "2026-04-10T10:00:00.000Z",
          due_at: null,
          amount_excl_vat: 200,
          amount_incl_vat: 250,
          vat_amount: 50,
          currency: "NOK",
          company_id: COMPANY_B,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
      ],
      companies: baseCompanies(),
      workspaces: baseWorkspaces(),
      lineItems: [],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-01", to: "2026-04-30" },
      grouping: ["bundled", "per_workspace"],
      format: ["csv"],
      excludeAlreadyExported: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifacts).toHaveLength(3);
    expect(result.artifacts.map((a) => a.filename)).toEqual([
      "ehf-eksport-2026-04.csv",
      "alpha-bar-2026-04.csv",
      "beta-kjokken-2026-04.csv",
    ]);
  });

  test("4. PDF format avvises — format_not_supported_yet", async () => {
    const { client, updateCalls } = createMockClient({
      invoices: [],
      companies: [],
      workspaces: [],
      lineItems: [],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-01", to: "2026-04-30" },
      grouping: ["bundled"],
      format: ["pdf"],
      excludeAlreadyExported: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("format_not_supported_yet");
    // Skal faile før DB-arbeid.
    expect(updateCalls).toHaveLength(0);
  });

  test("5. ingen fakturaer → no_invoices, ingen UPDATE", async () => {
    const { client, updateCalls } = createMockClient({
      invoices: [],
      companies: baseCompanies(),
      workspaces: baseWorkspaces(),
      lineItems: [],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-01", to: "2026-04-30" },
      grouping: ["bundled"],
      format: ["csv"],
      excludeAlreadyExported: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("no_invoices");
    expect(updateCalls).toHaveLength(0);
  });

  test("6. excludeAlreadyExported=true filtrerer bort allerede-stemplede", async () => {
    const { client } = createMockClient({
      invoices: [
        {
          invoice_id: INV_1,
          invoice_number: 1001,
          issued_at: "2026-04-01T10:00:00.000Z",
          due_at: null,
          amount_excl_vat: 100,
          amount_incl_vat: 125,
          vat_amount: 25,
          currency: "NOK",
          company_id: COMPANY_A,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: "2026-03-01T00:00:00.000Z", // already exported
        },
        {
          invoice_id: INV_2,
          invoice_number: 1002,
          issued_at: "2026-04-10T10:00:00.000Z",
          due_at: null,
          amount_excl_vat: 200,
          amount_incl_vat: 250,
          vat_amount: 50,
          currency: "NOK",
          company_id: COMPANY_B,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
      ],
      companies: baseCompanies(),
      workspaces: baseWorkspaces(),
      lineItems: [],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-01", to: "2026-04-30" },
      grouping: ["bundled"],
      format: ["csv"],
      excludeAlreadyExported: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice_count).toBe(1);
    expect(result.invoice_ids).toEqual([INV_2]);
  });

  test("7. mark-exported UPDATE issues med IN(...) av invoice_ids ved success", async () => {
    const { client, updateCalls } = createMockClient({
      invoices: [
        {
          invoice_id: INV_1,
          invoice_number: 1001,
          issued_at: "2026-04-01T10:00:00.000Z",
          due_at: null,
          amount_excl_vat: 100,
          amount_incl_vat: 125,
          vat_amount: 25,
          currency: "NOK",
          company_id: COMPANY_A,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
        {
          invoice_id: INV_2,
          invoice_number: 1002,
          issued_at: "2026-04-10T10:00:00.000Z",
          due_at: null,
          amount_excl_vat: 200,
          amount_incl_vat: 250,
          vat_amount: 50,
          currency: "NOK",
          company_id: COMPANY_B,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
      ],
      companies: baseCompanies(),
      workspaces: baseWorkspaces(),
      lineItems: [],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-01", to: "2026-04-30" },
      grouping: ["bundled"],
      format: ["csv"],
      excludeAlreadyExported: false,
    });

    expect(result.ok).toBe(true);
    expect(updateCalls).toHaveLength(1);
    const updateCall = updateCalls[0]!;
    expect(updateCall.table).toBe("invoice");
    expect(updateCall.inColumn).toBe("invoice_id");
    expect(updateCall.inValues).toEqual([INV_1, INV_2]);
    expect(updateCall.payload.ehf_exported_at).toBeTypeOf("string");
  });

  test("8. invalid input (period.from > period.to) → invalid_input", async () => {
    const { client, updateCalls } = createMockClient({
      invoices: [],
      companies: [],
      workspaces: [],
      lineItems: [],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-30", to: "2026-04-01" },
      grouping: ["bundled"],
      format: ["csv"],
      excludeAlreadyExported: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_input");
    expect(updateCalls).toHaveLength(0);
  });

  test("9. CSV-escaping — description m/ komma og citater escapes riktig", async () => {
    const { client } = createMockClient({
      invoices: [
        {
          invoice_id: INV_1,
          invoice_number: 1001,
          issued_at: "2026-04-01T10:00:00.000Z",
          due_at: null,
          amount_excl_vat: 100,
          amount_incl_vat: 125,
          vat_amount: 25,
          currency: "NOK",
          company_id: COMPANY_A,
          status: "issued",
          invoice_type: "recurring",
          ehf_exported_at: null,
        },
      ],
      companies: baseCompanies(),
      workspaces: baseWorkspaces(),
      lineItems: [
        {
          invoice_id: INV_1,
          // Både komma OG citattegn som trigger RFC-4180-escaping
          description: 'Linje med, komma og "citater"',
          quantity: 1,
          unit_price: 100,
          amount_excl_vat: 100,
          vat_rate: 25,
        },
      ],
    });

    const result = await generateEhfExport(client, {
      period: { from: "2026-04-01", to: "2026-04-30" },
      grouping: ["bundled"],
      format: ["csv"],
      excludeAlreadyExported: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = result.artifacts[0]!.content;
    // JSON-feltet inneholder \" og ,. Hele feltet skal wrappes i "..."
    // og alle " inni skal dobles til "".
    // Vi forventer altså minst "" et sted i feltet (doble citater).
    expect(content.includes('""')).toBe(true);

    // Parse hele CSVen via en enkel RFC-4180-parser og sjekk at
    // line_items_json-feltet roundtrippes til original beskrivelse.
    const lines = content.slice(1).split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2); // header + 1 rad
    const dataRow = parseCsvRow(lines[1]!);
    const lineItemsJson = dataRow[dataRow.length - 1]!;
    const parsed = JSON.parse(lineItemsJson);
    expect(parsed[0].description).toBe('Linje med, komma og "citater"');
  });
});
