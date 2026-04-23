import type { NextRequest } from "next/server";
import { generateEhfExport } from "@smartout/billing";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Fase 3B B5 — EHF CSV-eksport (platform-admin).
//
// GET /platform-admin/billing/ehf-export/download?period_from=YYYY-MM-DD&period_to=YYYY-MM-DD
//    [&grouping=bundled|per_workspace&format=csv|pdf&include_exported=1]
//
// MVP: bare grouping=bundled + format=csv støttes for nedlasting. Per-
// workspace og PDF-format returnerer 501 med `code` så UI kan vise en
// "kommer snart"-banner. Pure-action B3 håndterer format-validering;
// routen oversetter feilkoder til HTTP-status.

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GROUPING_VALUES = new Set(["bundled", "per_workspace"] as const);
const FORMAT_VALUES = new Set(["csv", "pdf"] as const);

export async function GET(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return new Response("unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodFrom = searchParams.get("period_from");
  const periodTo = searchParams.get("period_to");

  if (!periodFrom || !DATE_RE.test(periodFrom)) {
    return new Response("invalid_period_from", { status: 400 });
  }
  if (!periodTo || !DATE_RE.test(periodTo)) {
    return new Response("invalid_period_to", { status: 400 });
  }
  if (periodFrom > periodTo) {
    return new Response("period_from_after_to", { status: 400 });
  }

  const grouping = (
    searchParams.getAll("grouping").length ? searchParams.getAll("grouping") : ["bundled"]
  ) as Array<"bundled" | "per_workspace">;
  const format = (
    searchParams.getAll("format").length ? searchParams.getAll("format") : ["csv"]
  ) as Array<"csv" | "pdf">;

  for (const g of grouping) {
    if (!GROUPING_VALUES.has(g)) {
      return new Response(`invalid_grouping:${g}`, { status: 400 });
    }
  }
  for (const f of format) {
    if (!FORMAT_VALUES.has(f)) {
      return new Response(`invalid_format:${f}`, { status: 400 });
    }
  }

  // MVP-begrensning: bare bundled+csv kan leveres som nedlasting.
  // Per-workspace ville krevd zip-bundling; PDF ville krevd B4.
  if (grouping.includes("per_workspace")) {
    return new Response("per_workspace_not_supported_yet", { status: 501 });
  }
  if (format.includes("pdf")) {
    return new Response("pdf_format_not_supported_yet", { status: 501 });
  }

  const excludeAlreadyExported = searchParams.get("include_exported") !== "1";

  const supabase = createAdminClient();
  const result = await generateEhfExport(supabase, {
    period: { from: periodFrom, to: periodTo },
    grouping: ["bundled"],
    format: ["csv"],
    excludeAlreadyExported,
  });

  if (!result.ok) {
    const status = result.code === "no_invoices" ? 404 : 400;
    return new Response(result.error, { status });
  }

  const artifact = result.artifacts[0];
  if (!artifact) {
    return new Response("no_artifact_produced", { status: 500 });
  }

  await emit({
    event: "billing ehf_export_generated",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: null,
    properties: {
      entity_type: "company",
      entity_id: adminId, // platform-admin-scope: Smartouts egen company_id gir mer mening hvis vi senere laster den; adminId som placeholder
      data: {
        period_start: periodFrom,
        period_end: periodTo,
        format: ["csv"],
        grouping: ["bundled"],
        invoice_count: result.invoice_count,
        workspace_count: result.workspace_count,
        total_amount_incl_vat: 0, // aggregat ikke returnert av action; B5b kan legge til et summary-felt senere
        currency: "NOK",
      },
    },
  });

  return new Response(artifact.content, {
    headers: {
      "Content-Type": artifact.content_type,
      "Content-Disposition": `attachment; filename="${artifact.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
